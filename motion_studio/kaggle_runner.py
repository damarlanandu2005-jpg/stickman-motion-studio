"""Kaggle execution manager.

Three different events must never be confused:
  1. the push was accepted by Kaggle,
  2. Kaggle executed that specific notebook version,
  3. the execution returned valid output that belongs to *this* run.

This module records evidence for each one separately. It only uses documented
`kaggle` CLI behaviour (verified against kaggle 2.2.5: `kernels push|status|output|logs`,
`status` and `output` accept `<owner>/<kernel>/<version>`).

Known limit: the CLI does not expose a per-execution ID other than the notebook
*version number* printed by `push`. We poll and download that exact version, and we
additionally require the output to contain the run token we wrote into the notebook.
Both must agree; if the version number cannot be parsed from the push response we
fail instead of guessing.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import secrets
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .imagecheck import validate_png

STAMP_MARKER = "# STICKMAN_RUN_STAMP"
TERMINAL_STATES = {"COMPLETE", "ERROR", "CANCEL_ACKNOWLEDGED"}
EXPECTED_FILES = [
    "generated_image.png",
    "generation_report.json",
    "comfyui_server.log",
    "workflow_api.json",
    "model_metadata.json",
]
REPORT_REQUIRED_TRUE = [
    "comfyui_started", "api_system_stats_ok", "api_object_info_ok", "generation_submitted",
    "generation_completed", "image_downloaded", "image_valid", "cuda_available",
]
OUTPUT_FILE_PATTERN = r"(generated_image\.png|generation_report\.json|comfyui_server\.log|workflow_api\.json|model_metadata\.json|install\.log)$"
_STATUS_RE = re.compile(r'status\s+"?(?:KernelWorkerStatus\.)?([A-Za-z_]+)"?', re.IGNORECASE)
_VERSION_RE = re.compile(r"[Kk]ernel version\s+(\d+)\s+successfully pushed")
_UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


class KaggleRunError(RuntimeError):
    """Raised when a run cannot be trusted. The message states exactly why."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def make_identity(env: dict[str, str]) -> dict[str, Any]:
    return {
        "run_id": uuid.uuid4().hex,
        "run_token": secrets.token_hex(16),
        "commit_sha": env.get("GITHUB_SHA", "unknown"),
        "workflow_run_id": env.get("GITHUB_RUN_ID", "local"),
        "workflow_run_attempt": env.get("GITHUB_RUN_ATTEMPT", "0"),
        "created_utc": utc_now(),
    }


def stamp_notebook(path: Path, identity: dict[str, Any]) -> None:
    """Write the run identity into the notebook as its first cell (replacing any earlier stamp)."""
    notebook = json.loads(path.read_text(encoding="utf-8"))
    cells = [
        c for c in notebook["cells"]
        if not (c.get("cell_type") == "code" and "".join(c.get("source", [])).startswith(STAMP_MARKER))
    ]
    lines = [STAMP_MARKER + "\n"] + [
        f"{name.upper()} = {identity[name]!r}\n"
        for name in ("run_id", "run_token", "commit_sha", "workflow_run_id", "workflow_run_attempt")
    ]
    cells.insert(0, {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": lines})
    notebook["cells"] = cells
    path.write_text(json.dumps(notebook, indent=1) + "\n", encoding="utf-8")


def parse_status(text: str) -> str | None:
    match = _STATUS_RE.search(text or "")
    return match.group(1).upper() if match else None


def parse_pushed_version(text: str) -> int | None:
    match = _VERSION_RE.search(text or "")
    return int(match.group(1)) if match else None


def redact(text: str, secrets_to_hide: list[str]) -> str:
    for secret in secrets_to_hide:
        if secret and len(secret) >= 6:
            text = text.replace(secret, "***")
    return text


CommandRunner = Callable[[list[str]], tuple[int, str]]


def run_command(args: list[str]) -> tuple[int, str]:
    proc = subprocess.run(args, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return proc.returncode, proc.stdout


def validate_output(out_dir: Path, identity: dict[str, Any], expected_model_sha256: str | None = None) -> dict[str, Any]:
    """Independently verify a downloaded run. Returns {'ok': bool, 'failures': [...], 'checks': {...}}."""
    out_dir = Path(out_dir)
    failures: list[str] = []
    checks: dict[str, Any] = {}

    found = {name: next(iter(out_dir.rglob(name)), None) for name in EXPECTED_FILES}
    for name, location in found.items():
        checks[f"file:{name}"] = bool(location)
        if not location:
            failures.append(f"missing expected output file {name}")
    report_path = found["generation_report.json"]
    if not report_path:
        return {"ok": False, "failures": failures, "checks": checks}

    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return {"ok": False, "failures": failures + [f"report is not valid JSON: {exc}"], "checks": checks}

    if report.get("run_token") != identity["run_token"]:
        failures.append("report run_token does not match this run (output belongs to another execution)")
    if report.get("run_id") != identity["run_id"]:
        failures.append("report run_id does not match this run")
    if report.get("status") != "success":
        failures.append(f"report status is {report.get('status')!r}, not 'success'")
    if report.get("error_message"):
        failures.append(f"report carries an error: {report.get('error_message')}")
    for key in REPORT_REQUIRED_TRUE:
        if report.get(key) is not True:
            failures.append(f"report field {key} is not True")
    prompt_id = report.get("prompt_id")
    if not isinstance(prompt_id, str) or not _UUID_RE.match(prompt_id):
        failures.append("report prompt_id is missing or not a UUID")
    if expected_model_sha256 and report.get("model_sha256") != expected_model_sha256:
        failures.append("report model_sha256 does not match the pinned hash")

    image_path = found["generated_image.png"]
    if image_path:
        png = validate_png(image_path)
        checks["png"] = {k: png[k] for k in ("valid", "width", "height", "bytes", "sha256", "error")}
        if not png["valid"]:
            failures.append(f"generated_image.png is not a valid PNG: {png['error']}")
        else:
            if png["sha256"] != report.get("image_sha256"):
                failures.append("downloaded image hash differs from the hash in the report")
            if (png["width"], png["height"]) != (report.get("image_width"), report.get("image_height")):
                failures.append("downloaded image dimensions differ from the report")
    return {"ok": not failures, "failures": failures, "checks": checks}


BENCHMARK_OUTPUT_PATTERN = r"(benchmark_report\.json|model_metadata\.json|install\.log|klein4b_[a-z0-9_]+\.png)$"


def validate_benchmark_output(out_dir: Path, identity: dict[str, Any], expected_model_sha256: str | None = None) -> dict[str, Any]:
    """Verify a model-benchmark run: identity, status, and every reported picture re-checked from the downloaded file."""
    out_dir = Path(out_dir)
    failures: list[str] = []
    checks: dict[str, Any] = {}
    report_path = next(iter(out_dir.rglob("benchmark_report.json")), None)
    if not report_path:
        return {"ok": False, "failures": ["missing benchmark_report.json"], "checks": checks}
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return {"ok": False, "failures": [f"report is not valid JSON: {exc}"], "checks": checks}
    if report.get("run_token") != identity["run_token"]:
        failures.append("report run_token does not match this run (output belongs to another execution)")
    if report.get("run_id") != identity["run_id"]:
        failures.append("report run_id does not match this run")
    if report.get("status") != "success":
        failures.append(f"report status is {report.get('status')!r}, not 'success'")
    if report.get("error_message"):
        failures.append(f"report carries an error: {report.get('error_message')}")
    for key in ("install_ok", "model_downloaded", "pipeline_loaded", "cuda_available"):
        if report.get(key) is not True:
            failures.append(f"report field {key} is not True")
    results = report.get("results") or []
    if not results:
        failures.append("report lists no generated pictures")
    pictures = []
    for item in results:
        image = next(iter(out_dir.rglob(str(item.get("file", "?")))), None)
        png = validate_png(image) if image else {"valid": False, "error": "file missing", "sha256": None, "width": None, "height": None}
        pictures.append({"file": item.get("file"), "valid": png["valid"], "sha256": png["sha256"], "seconds": item.get("seconds")})
        if not png["valid"]:
            failures.append(f"{item.get('file')}: not a valid PNG ({png['error']})")
            continue
        if png["sha256"] != item.get("image_sha256"):
            failures.append(f"{item.get('file')}: downloaded hash differs from the report")
        if (png["width"], png["height"]) != (item.get("image_width"), item.get("image_height")):
            failures.append(f"{item.get('file')}: downloaded dimensions differ from the report")
        if item.get("looks_broken"):
            failures.append(f"{item.get('file')}: flagged as a broken (flat/black) picture")
    checks["pictures"] = pictures
    return {"ok": not failures, "failures": failures, "checks": checks}



def validate_script_writer_output(out_dir: Path, identity: dict[str, Any], expected_model_sha256: str | None = None) -> dict[str, Any]:
    """Validate script outputs, meaningful scene narration, and conservative fact-check state."""
    failures: list[str] = []
    checks: dict[str, Any] = {}
    report_path = next(iter(Path(out_dir).rglob("benchmark_report.json")), None)
    if not report_path:
        return {"ok": False, "failures": ["missing benchmark_report.json"], "checks": checks}
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return {"ok": False, "failures": [f"benchmark report is invalid JSON: {exc}"], "checks": checks}
    for key in ("run_id", "run_token"):
        if report.get(key) != identity.get(key):
            failures.append(f"{key} does not match this workflow run")
    if report.get("status") != "success":
        failures.append(f"benchmark status is {report.get('status')!r}, not 'success'")
    for key in ("dependencies_installed", "at_least_one_model_completed", "outputs_saved"):
        if report.get(key) is not True:
            failures.append(f"report field {key} is not True")
    results = report.get("results") or []
    checks["models"] = results
    if not results:
        failures.append("no model results were recorded")
    for item in results:
        label = str(item.get("label", "model"))
        if item.get("completed") is not True and not item.get("error"):
            failures.append(f"{label}: result neither completed nor recorded an error")
        if item.get("completed"):
            output = item.get("json_file")
            if not output or not next(iter(Path(out_dir).rglob(str(output))), None):
                failures.append(f"{label}: completed result JSON file is missing")
    revised_path = next(iter(Path(out_dir).rglob("revised_script.json")), None)
    if revised_path:
        try:
            revised = json.loads(revised_path.read_text(encoding="utf-8"))
            if not isinstance(revised.get("continuity_bible"), dict):
                failures.append("revised script continuity_bible is not an object")
            scenes = revised.get("scenes") or []
            if not scenes:
                failures.append("revised script contains no scenes")
            narration = " ".join(str(revised.get("narration", "")).split())
            raw_segments = [str(scene.get("narration_segment", "")).strip() for scene in scenes]
            empty_scenes = [index + 1 for index, segment in enumerate(raw_segments) if not segment]
            if empty_scenes:
                failures.append("revised script has empty narration segments in scenes: " + ", ".join(map(str, empty_scenes)))
            segment_text = " ".join(" ".join(raw_segments).split())
            matches = bool(narration) and segment_text == narration
            if narration and not matches:
                failures.append("scene narration segments do not exactly match revised narration")
            checks["revised_script"] = {
                "scene_count": len(scenes),
                "continuity_bible_is_object": isinstance(revised.get("continuity_bible"), dict),
                "nonempty_scene_segments": len(raw_segments) - len(empty_scenes),
                "empty_scene_numbers": empty_scenes,
                "scene_segments_match_narration": matches,
            }
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            failures.append(f"revised script is invalid: {exc}")
    else:
        failures.append("missing revised_script.json")
    fact_path = next(iter(Path(out_dir).rglob("fact_check_report.json")), None)
    if not fact_path:
        failures.append("missing fact_check_report.json")
    else:
        try:
            fact = json.loads(fact_path.read_text(encoding="utf-8"))
            checks["fact_check"] = {"status": fact.get("status"), "first_pass_count": len(fact.get("first_pass") or []), "second_pass_count": len(fact.get("second_pass") or []), "unresolved_count": len(fact.get("unresolved_claims") or [])}
            for key in ("run_id", "run_token"):
                if fact.get(key) != identity.get(key):
                    failures.append(f"fact-check {key} does not match this workflow run")
            if fact.get("status") not in ("approved", "needs_human_review"):
                failures.append("fact-check status is invalid")
            if fact.get("status") == "approved":
                if not fact.get("second_pass") or any(x.get("verdict") != "supported" or float(x.get("confidence", 0)) < 0.80 for x in fact["second_pass"]):
                    failures.append("fact-check approval does not pass second-pass checks")
                if not next(iter(Path(out_dir).rglob("verified_script.json")), None):
                    failures.append("verified_script.json is missing")
            elif fact.get("approved_script_file") is not None:
                failures.append("human-review report must not name an approved script")
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            failures.append(f"fact-check report is invalid: {exc}")
    return {"ok": not failures, "failures": failures, "checks": checks}

IMAGE_TO_3D_PATTERN = r"(image_to_3d_report\.json|result_[a-z_]+\.json|object_[a-z_]+\.png|cutout_[a-z_]+\.png|[a-z_]+\.glb|[a-z_0-9]+\.log)$"


def validate_image_to_3d_output(out_dir: Path, identity: dict[str, Any], expected_model_sha256: str | None = None) -> dict[str, Any]:
    """Image-to-3D feasibility test: the output must belong to this run and every file the report claims must exist
    intact. Engines are allowed to fail (that is the finding), but a claimed success must be backed by a real GLB."""
    out_dir = Path(out_dir)
    failures: list[str] = []
    checks: dict[str, Any] = {"objects": [], "models": []}
    report_path = next(iter(out_dir.rglob("image_to_3d_report.json")), None)
    if not report_path:
        return {"ok": False, "failures": ["missing image_to_3d_report.json"], "checks": checks}
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return {"ok": False, "failures": [f"report is not valid JSON: {exc}"], "checks": checks}
    if report.get("run_token") != identity["run_token"]:
        failures.append("report run_token does not match this run (output belongs to another execution)")
    if report.get("run_id") != identity["run_id"]:
        failures.append("report run_id does not match this run")
    if report.get("status") != "completed":
        failures.append(f"test did not complete: status {report.get('status')!r}, error {report.get('error_message')!r}")
    engines = report.get("engines") or {}
    klein = engines.get("klein") or {}
    for item in klein.get("objects", []):
        image = next(iter(out_dir.rglob(str(item.get("file", "?")))), None)
        png = validate_png(image) if image else {"valid": False, "error": "file missing", "sha256": None}
        checks["objects"].append({"file": item.get("file"), "valid": png["valid"]})
        if not png["valid"]:
            failures.append(f"{item.get('file')}: not a valid PNG ({png['error']})")
        elif png["sha256"] != item.get("sha256"):
            failures.append(f"{item.get('file')}: hash differs from the report")
    if report.get("status") == "completed" and len(klein.get("objects", [])) != len(report.get("objects", [])):
        failures.append("klein did not draw every object listed in the report")
    for stage, data in engines.items():
        if stage == "klein":
            continue
        for item in data.get("objects", []):
            if item.get("status") != "success":
                continue
            glb = next(iter(out_dir.rglob(str(item.get("file", "?")))), None)
            ok = bool(glb) and glb.read_bytes()[:4] == b"glTF"
            same = ok and hashlib.sha256(glb.read_bytes()).hexdigest() == item.get("sha256")
            checks["models"].append({"stage": stage, "file": item.get("file"), "glb_header_ok": ok, "hash_matches": same})
            if not ok:
                failures.append(f"{stage}: claimed {item.get('file')} but it is missing or not a GLB")
            elif not same:
                failures.append(f"{stage}: {item.get('file')} hash differs from the report")
    return {"ok": not failures, "failures": failures, "checks": checks}


PROFILES = {
    "image-smoke": {"pattern": OUTPUT_FILE_PATTERN, "validate": "validate_output"},
    "klein-benchmark": {"pattern": BENCHMARK_OUTPUT_PATTERN, "validate": "validate_benchmark_output"},
    "image-to-3d": {"pattern": IMAGE_TO_3D_PATTERN, "validate": "validate_image_to_3d_output"},
    "script-writer": {"pattern": r".*(benchmark_report\.json|benchmark_results\.json|model_comparison\.csv|fact_check_report\.json|revised_script\.json|verified_script\.json|Qwen3-4B-Instruct-2507\.(json|txt)|Gemma-3-4B-IT\.(json|txt))$", "validate": "validate_script_writer_output"},
}


def execute(
    *,
    kernel_ref: str,
    kernel_dir: Path,
    notebook_name: str,
    metadata: dict[str, Any],
    work_dir: Path,
    out_dir: Path,
    identity: dict[str, Any],
    runner: CommandRunner = run_command,
    sleep: Callable[[float], None] = time.sleep,
    clock: Callable[[], float] = time.monotonic,
    poll_seconds: float = 30,
    timeout_seconds: float = 85 * 60,
    push_timeout_seconds: int = 3600,
    max_download_attempts: int = 3,
    max_status_failures: int = 5,
    expected_model_sha256: str | None = None,
    hide: list[str] | None = None,
    output_pattern: str = OUTPUT_FILE_PATTERN,
    validate: Callable[..., dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Push one stamped notebook, track that exact version, download and validate its output."""
    hide = hide or []
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    record: dict[str, Any] = {
        "identity": identity, "kernel": kernel_ref, "pushed_version": None, "push_attempts": 0,
        "observations": [], "download_attempts": 0, "validation": None,
        "limitations": [
            "The Kaggle CLI exposes the notebook version number, not a separate execution ID. "
            "Version tracking plus the run token in the output are used together.",
        ],
        "result": "started",
    }

    def note(event: str, **detail: Any) -> None:
        record["observations"].append({"at": utc_now(), "event": event, **detail})

    def save() -> None:
        (out_dir / "kaggle_execution_record.json").write_text(json.dumps(record, indent=2), encoding="utf-8")

    try:
        # Build an isolated copy so the repository working tree is never modified.
        build = Path(work_dir)
        if build.exists():
            shutil.rmtree(build)
        shutil.copytree(kernel_dir, build, ignore=shutil.ignore_patterns("kernel-metadata.json"))
        (build / "kernel-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
        stamp_notebook(build / notebook_name, identity)
        note("notebook_stamped", run_token_written=True)

        # 1. Push. A rejected push (no version in the reply) is safe to retry once; an accepted one never is.
        version = None
        for attempt in (1, 2):
            record["push_attempts"] = attempt
            code, out = runner(["kaggle", "kernels", "push", "-p", str(build), "-t", str(push_timeout_seconds)])
            out = redact(out, hide)
            note("push_response", attempt=attempt, exit_code=code, text=out.strip()[-600:])
            version = parse_pushed_version(out)
            if code == 0 and version is not None:
                break
            if version is not None:
                break  # accepted despite a non-zero exit: do NOT push again
            sleep(15)
        if version is None:
            raise KaggleRunError("Kaggle did not confirm a pushed notebook version; cannot identify the execution.")
        record["pushed_version"] = version
        versioned = f"{kernel_ref}/{version}"
        note("push_accepted", version=version)

        # 2. Poll the status of that exact version.
        deadline = clock() + timeout_seconds
        failures = 0
        last = None
        state = None
        while clock() < deadline:
            code, out = runner(["kaggle", "kernels", "status", versioned])
            state = parse_status(out) if code == 0 else None
            if state is None:
                failures += 1
                note("status_unreadable", exit_code=code, text=redact(out, hide).strip()[-300:])
                if failures >= max_status_failures:
                    raise KaggleRunError(f"Could not read the status of {versioned} {max_status_failures} times in a row.")
                sleep(20)
                continue
            failures = 0
            if state != last:
                note("status", state=state)
                last = state
            if state in TERMINAL_STATES:
                break
            sleep(poll_seconds)
        else:
            raise KaggleRunError(f"Timed out after {timeout_seconds / 60:.0f} min; last observed state: {last}.")

        if state != "COMPLETE":
            code, logs = runner(["kaggle", "kernels", "logs", versioned])
            (out_dir / "kaggle_execution.log").write_text(redact(logs, hide), encoding="utf-8")
            raise KaggleRunError(f"Kaggle execution of {versioned} ended in state {state}.")
        if not any(o.get("state") in {"QUEUED", "RUNNING"} for o in record["observations"]):
            note("warning", text="COMPLETE was the first state seen; the run was not observed executing. "
                                  "Relying on the run token in the output.")

        # 3. Download only the expected files, with retries (a reset connection once broke a run).
        for attempt in range(1, max_download_attempts + 1):
            record["download_attempts"] = attempt
            code, out = runner(["kaggle", "kernels", "output", versioned, "-p", str(out_dir),
                                "--file-pattern", output_pattern, "--page-size", "200", "-o"])
            note("download", attempt=attempt, exit_code=code, text=redact(out, hide).strip()[-300:])
            if code == 0:
                break
            sleep(10 * attempt)
        else:
            raise KaggleRunError("Run completed but its output could not be downloaded.")

        # 4. Validate independently of the notebook's own claims.
        validation = (validate or validate_output)(out_dir, identity, expected_model_sha256)
        record["validation"] = validation
        if not validation["ok"]:
            raise KaggleRunError("Output failed validation: " + "; ".join(validation["failures"]))
        record["result"] = "verified"
        return record
    except Exception as exc:  # record, then re-raise: failures are never swallowed
        record["result"] = "failed"
        record["error"] = redact(str(exc), hide)
        raise
    finally:
        save()


def summarize_report(out_dir: Path, profile: str) -> str:
    """Compact, human-readable lines from the already-verified report so the numbers are visible in CI logs."""
    if profile == "image-to-3d":
        path = next(iter(Path(out_dir).rglob("image_to_3d_report.json")), None)
        if not path:
            return "(no report to summarize)"
        r = json.loads(path.read_text(encoding="utf-8"))
        lines = [f"  environment: {r.get('environment')}", f"  notebook_duration_seconds: {r.get('notebook_duration_seconds')}"]
        for name, s in (r.get("summary") or {}).items():
            lines.append(f"  ENGINE {name}: {json.dumps(s)}")
        for name, data in (r.get("engines") or {}).items():
            for item in data.get("objects", []):
                lines.append(f"  {name} object: " + json.dumps({k: item.get(k) for k in (
                    "name", "status", "seconds", "faces", "raw_faces", "vertices", "depth_ratio", "looks_flat", "peak_vram_gib", "bytes", "file", "error")}))
        return "\n".join(lines)
    name = "benchmark_report.json" if profile in {"klein-benchmark", "script-writer"} else "generation_report.json"
    path = next(iter(Path(out_dir).rglob(name)), None)
    if not path:
        return "(no report to summarize)"
    r = json.loads(path.read_text(encoding="utf-8"))
    keys = ["model_id", "model_revision", "model_license", "dtype_used", "dtype_attempts", "download_bytes", "download_seconds",
            "pipeline_load_seconds", "seconds_per_picture_after_warmup_mean", "gpu_names", "torch_version", "library_versions",
            "prompt_id", "generation_duration_seconds", "gpu_memory_peak_used_mib_nvidia_smi", "image_sha256", "notebook_duration_seconds"]
    lines = [f"  {k}: {r[k]}" for k in keys if k in r]
    for item in r.get("results", []):
        lines.append("  picture: " + json.dumps({k: item.get(k) for k in (
            "file", "seconds", "dtype", "peak_vram_allocated_gib_torch", "gpu_used_mib_after", "peak_process_rss_gb", "stats", "image_sha256")}))
    return "\n".join(lines)


def _cli(argv: list[str] | None = None) -> int:
    import os

    parser = argparse.ArgumentParser(prog="kaggle_runner")
    parser.add_argument("--kernel", required=True, help="<owner>/<slug>")
    parser.add_argument("--title", required=True)
    parser.add_argument("--kernel-dir", required=True, type=Path)
    parser.add_argument("--notebook", required=True)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--work-dir", type=Path, default=Path(".kaggle-build"))
    parser.add_argument("--timeout-minutes", type=float, default=85)
    parser.add_argument("--model-sha256", default=None)
    parser.add_argument("--profile", choices=sorted(PROFILES), default="image-smoke")
    parser.add_argument("--kaggle-run-limit-seconds", type=int, default=3600,
                        help="Maximum run time Kaggle allows the notebook (kernels push -t)")
    args = parser.parse_args(argv)

    metadata = {
        "id": args.kernel, "title": args.title, "code_file": args.notebook, "language": "python",
        "kernel_type": "notebook", "is_private": "true", "enable_gpu": "true", "enable_internet": "true",
        "machine_shape": "NvidiaTeslaT4", "dataset_sources": [], "competition_sources": [],
        "kernel_sources": [], "model_sources": [],
    }
    hide = [os.environ.get(k, "") for k in ("KAGGLE_KEY", "KAGGLE_API_TOKEN")]
    identity = make_identity(dict(os.environ))
    print(f"run_id={identity['run_id']} workflow_run={identity['workflow_run_id']}-{identity['workflow_run_attempt']} commit={identity['commit_sha'][:12]}")
    try:
        record = execute(
            kernel_ref=args.kernel, kernel_dir=args.kernel_dir, notebook_name=args.notebook,
            metadata=metadata, work_dir=args.work_dir, out_dir=args.out, identity=identity,
            timeout_seconds=args.timeout_minutes * 60, expected_model_sha256=args.model_sha256, hide=hide,
            push_timeout_seconds=args.kaggle_run_limit_seconds,
            output_pattern=PROFILES[args.profile]["pattern"], validate=globals()[PROFILES[args.profile]["validate"]],
        )
    except KaggleRunError as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1
    print(f"VERIFIED: version {record['pushed_version']} produced output matching run token ({args.profile}).")
    print(summarize_report(args.out, args.profile))
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())
