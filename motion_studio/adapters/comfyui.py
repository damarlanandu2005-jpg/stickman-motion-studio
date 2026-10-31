from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

from .base import EngineAdapter


class ComfyUIError(RuntimeError):
    """Raised when ComfyUI is unreachable or rejects a workflow."""


class ComfyUIAdapter(EngineAdapter):
    """Small, dependency-free client for a local or remote ComfyUI server.

    Workflows must be exported by ComfyUI in API format. This adapter does not
    invent model-specific node graphs or install models/custom nodes.
    """

    name = "comfyui"

    def __init__(self, base_url: str = "http://127.0.0.1:8188", timeout: float = 30):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client_id = str(uuid.uuid4())

    def _request_json(self, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=data,
            headers={"Accept": "application/json", **({"Content-Type": "application/json"} if data else {})},
            method="POST" if data else "GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                body = response.read()
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise ComfyUIError(f"ComfyUI request failed ({url}): {exc}") from exc
        try:
            value = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ComfyUIError(f"ComfyUI returned invalid JSON from {path}") from exc
        if not isinstance(value, dict):
            raise ComfyUIError(f"ComfyUI returned an unexpected response from {path}")
        return value

    def healthcheck(self) -> dict[str, Any]:
        stats = self._request_json("/system_stats")
        devices = stats.get("devices", [])
        return {
            "available": True,
            "name": self.name,
            "url": self.base_url,
            "device_count": len(devices) if isinstance(devices, list) else 0,
            "system": stats.get("system", {}),
        }

    def submit(self, job: dict[str, Any], output_dir: Path) -> dict[str, Any]:
        workflow = job.get("workflow")
        if not isinstance(workflow, dict) or not workflow:
            raise ValueError("ComfyUI job requires a non-empty API-format 'workflow' object.")
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        response = self._request_json(
            "/prompt", {"prompt": workflow, "client_id": self.client_id}
        )
        prompt_id = response.get("prompt_id")
        if not prompt_id:
            details = response.get("node_errors") or response.get("error") or response
            raise ComfyUIError(f"ComfyUI rejected the workflow: {details}")
        return {
            "engine": self.name,
            "server": self.base_url,
            "prompt_id": str(prompt_id),
            "client_id": self.client_id,
            "output_dir": str(output_dir.resolve()),
            "queue_number": response.get("number"),
            "status": "queued",
        }

    def wait(self, prompt_id: str, output_dir: Path, timeout: float = 900, poll_interval: float = 2) -> dict[str, Any]:
        if timeout <= 0 or poll_interval <= 0:
            raise ValueError("timeout and poll_interval must be positive.")
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        deadline = time.monotonic() + timeout

        while time.monotonic() < deadline:
            history = self._request_json(f"/history/{urllib.parse.quote(prompt_id, safe='')}")
            entry = history.get(prompt_id)
            if entry:
                status = entry.get("status", {})
                status_text = status.get("status_str", "")
                if status_text and status_text != "success":
                    raise ComfyUIError(
                        f"ComfyUI job {prompt_id} finished with status '{status_text}'."
                    )
                if status.get("completed") or status_text == "success":
                    saved = self._save_images(entry.get("outputs", {}), output_dir)
                    if not saved:
                        raise ComfyUIError(
                            f"ComfyUI job {prompt_id} completed but returned no image outputs."
                        )
                    manifest = {
                        "engine": self.name,
                        "server": self.base_url,
                        "prompt_id": prompt_id,
                        "status": "completed",
                        "outputs": saved,
                    }
                    (output_dir / "comfyui-result.json").write_text(
                        json.dumps(manifest, indent=2), encoding="utf-8"
                    )
                    return manifest
            time.sleep(poll_interval)

        raise TimeoutError(f"Timed out waiting for ComfyUI job {prompt_id} after {timeout:g}s.")

    def run(self, workflow: dict[str, Any], output_dir: Path, timeout: float = 900, poll_interval: float = 2) -> dict[str, Any]:
        submitted = self.submit({"workflow": workflow}, output_dir)
        completed = self.wait(submitted["prompt_id"], output_dir, timeout, poll_interval)
        return {**submitted, **completed}

    def _save_images(self, outputs: dict[str, Any], output_dir: Path) -> list[dict[str, str]]:
        saved: list[dict[str, str]] = []
        for node_id, node_output in outputs.items():
            for image_info in node_output.get("images", []):
                filename = Path(str(image_info.get("filename", ""))).name
                if not filename:
                    continue
                query = urllib.parse.urlencode({
                    "filename": filename,
                    "subfolder": str(image_info.get("subfolder", "")),
                    "type": str(image_info.get("type", "output")),
                })
                url = f"{self.base_url}/view?{query}"
                request = urllib.request.Request(url)
                try:
                    with urllib.request.urlopen(request, timeout=self.timeout) as response:
                        data = response.read()
                except (urllib.error.URLError, TimeoutError, OSError) as exc:
                    raise ComfyUIError(f"Could not download ComfyUI output {filename}: {exc}") from exc
                target = output_dir / f"node-{node_id}-{filename}"
                target.write_bytes(data)
                saved.append({"node_id": str(node_id), "path": str(target.resolve())})
        return saved
