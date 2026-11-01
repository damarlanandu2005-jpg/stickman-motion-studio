import json
import tempfile
import unittest
from pathlib import Path

from motion_studio import kaggle_runner as kr
from tests.test_imagecheck import make_png
from motion_studio.imagecheck import sha256_file

UUID = "123e4567-e89b-12d3-a456-426614174000"


def make_identity():
    return {"run_id": "run-abc", "run_token": "tok-123", "commit_sha": "deadbeef",
            "workflow_run_id": "99", "workflow_run_attempt": "1", "created_utc": "now"}


def write_good_output(out: Path, identity, **override):
    out.mkdir(parents=True, exist_ok=True)
    image = out / "generated_image.png"
    image.write_bytes(make_png(8, 8))
    report = {
        "run_token": identity["run_token"], "run_id": identity["run_id"], "status": "success", "error_message": None,
        "prompt_id": UUID, "comfyui_started": True, "api_system_stats_ok": True, "api_object_info_ok": True,
        "generation_submitted": True, "generation_completed": True, "image_downloaded": True, "image_valid": True,
        "cuda_available": True, "image_width": 8, "image_height": 8, "image_sha256": sha256_file(image),
        "model_sha256": "m" * 64,
    }
    report.update(override)
    (out / "generation_report.json").write_text(json.dumps(report))
    for name in ("comfyui_server.log", "workflow_api.json", "model_metadata.json"):
        (out / name).write_text("{}")


class FakeKaggle:
    """Scripted stand-in for the `kaggle` CLI. Only used to test control flow, never as evidence of a real run."""

    def __init__(self, identity, statuses, push_text='Kernel version 7 successfully pushed.', download_failures=0, output=True, **override):
        self.identity, self.statuses, self.push_text = identity, list(statuses), push_text
        self.download_failures, self.output, self.override = download_failures, output, override
        self.calls = []

    def __call__(self, args):
        self.calls.append(args)
        verb = args[2]
        if verb == "push":
            return 0, self.push_text
        if verb == "status":
            state = self.statuses.pop(0) if len(self.statuses) > 1 else self.statuses[0]
            return 0, f'owner/k has status "KernelWorkerStatus.{state}"'
        if verb == "output":
            if self.download_failures:
                self.download_failures -= 1
                return 1, "Connection aborted"
            if self.output:
                write_good_output(Path(args[args.index("-p") + 1]), self.identity, **self.override)
            return 0, "ok"
        if verb == "logs":
            return 0, "log text"
        return 1, "unknown"


def make_kernel_dir():
    directory = Path(tempfile.mkdtemp())
    (directory / "nb.ipynb").write_text(json.dumps({"cells": [], "metadata": {}, "nbformat": 4, "nbformat_minor": 5}))
    return directory


class RunnerTests(unittest.TestCase):
    def run_execute(self, fake, **kw):
        identity = fake.identity
        out = Path(tempfile.mkdtemp()) / "out"
        try:
            return kr.execute(
                kernel_ref="owner/k", kernel_dir=make_kernel_dir(), notebook_name="nb.ipynb", metadata={"id": "owner/k"},
                work_dir=Path(tempfile.mkdtemp()) / "build", out_dir=out, identity=identity, runner=fake,
                sleep=lambda s: None, clock=kw.pop("clock", None) or (lambda: 0.0), poll_seconds=0, **kw), out
        except kr.KaggleRunError as exc:
            self.last_out = out
            raise

    def test_parsers(self):
        self.assertEqual(kr.parse_status('x has status "KernelWorkerStatus.RUNNING"'), "RUNNING")
        self.assertEqual(kr.parse_status("status COMPLETE"), "COMPLETE")
        self.assertIsNone(kr.parse_status("nothing here"))
        self.assertEqual(kr.parse_pushed_version("Kernel version 13 successfully pushed. Please"), 13)
        self.assertIsNone(kr.parse_pushed_version("Push failed"))

    def test_stamp_is_idempotent_and_first(self):
        path = make_kernel_dir() / "nb.ipynb"
        ident = make_identity()
        kr.stamp_notebook(path, ident)
        kr.stamp_notebook(path, {**ident, "run_token": "second"})
        cells = json.loads(path.read_text())["cells"]
        self.assertEqual(len(cells), 1)
        source = "".join(cells[0]["source"])
        self.assertIn("RUN_TOKEN = 'second'", source)
        self.assertNotIn("tok-123", source)

    def test_verified_happy_path_polls_the_pushed_version(self):
        fake = FakeKaggle(make_identity(), ["QUEUED", "RUNNING", "COMPLETE"])
        record, out = self.run_execute(fake)
        self.assertEqual(record["result"], "verified")
        self.assertEqual(record["pushed_version"], 7)
        status_calls = [c for c in fake.calls if c[2] == "status"]
        self.assertTrue(all(c[3] == "owner/k/7" for c in status_calls))
        states = [o["state"] for o in record["observations"] if o["event"] == "status"]
        self.assertEqual(states, ["QUEUED", "RUNNING", "COMPLETE"])
        self.assertTrue((out / "kaggle_execution_record.json").exists())

    def test_foreign_token_is_rejected(self):
        fake = FakeKaggle(make_identity(), ["COMPLETE"], run_token="someone-elses-token")
        with self.assertRaises(kr.KaggleRunError) as ctx:
            self.run_execute(fake)
        self.assertIn("another execution", str(ctx.exception))

    def test_failed_report_is_rejected(self):
        fake = FakeKaggle(make_identity(), ["COMPLETE"], status="failed", error_message="boom", image_valid=False)
        with self.assertRaises(kr.KaggleRunError) as ctx:
            self.run_execute(fake)
        self.assertIn("not 'success'", str(ctx.exception))

    def test_hash_mismatch_is_rejected(self):
        fake = FakeKaggle(make_identity(), ["COMPLETE"], image_sha256="0" * 64)
        with self.assertRaises(kr.KaggleRunError) as ctx:
            self.run_execute(fake)
        self.assertIn("hash", str(ctx.exception))

    def test_missing_output_files_fail(self):
        fake = FakeKaggle(make_identity(), ["COMPLETE"], output=False)
        with self.assertRaises(kr.KaggleRunError):
            self.run_execute(fake)

    def test_error_state_fails_and_fetches_logs(self):
        fake = FakeKaggle(make_identity(), ["RUNNING", "ERROR"])
        with self.assertRaises(kr.KaggleRunError) as ctx:
            self.run_execute(fake)
        self.assertIn("ERROR", str(ctx.exception))
        self.assertTrue(any(c[2] == "logs" for c in fake.calls))

    def test_unparseable_push_response_never_guesses(self):
        fake = FakeKaggle(make_identity(), ["COMPLETE"], push_text="something unexpected")
        with self.assertRaises(kr.KaggleRunError) as ctx:
            self.run_execute(fake)
        self.assertIn("cannot identify", str(ctx.exception))
        self.assertEqual(len([c for c in fake.calls if c[2] == "push"]), 2)  # one safe retry only

    def test_accepted_push_is_never_repeated(self):
        class NonZeroButAccepted(FakeKaggle):
            def __call__(self, args):
                if args[2] == "push":
                    self.calls.append(args)
                    return 1, "Kernel version 3 successfully pushed. warning"
                return super().__call__(args)
        fake = NonZeroButAccepted(make_identity(), ["COMPLETE"])
        self.run_execute(fake)
        self.assertEqual(len([c for c in fake.calls if c[2] == "push"]), 1)

    def test_download_is_retried(self):
        fake = FakeKaggle(make_identity(), ["COMPLETE"], download_failures=2)
        record, _ = self.run_execute(fake)
        self.assertEqual(record["download_attempts"], 3)
        self.assertEqual(record["result"], "verified")

    def test_download_gives_up_after_limit(self):
        fake = FakeKaggle(make_identity(), ["COMPLETE"], download_failures=9)
        with self.assertRaises(kr.KaggleRunError):
            self.run_execute(fake)

    def test_timeout_is_reported_not_swallowed(self):
        ticks = iter(range(0, 10_000, 100))
        fake = FakeKaggle(make_identity(), ["RUNNING"])
        with self.assertRaises(kr.KaggleRunError) as ctx:
            self.run_execute(fake, clock=lambda: next(ticks), timeout_seconds=500)
        self.assertIn("Timed out", str(ctx.exception))

    def test_secrets_are_redacted(self):
        self.assertEqual(kr.redact("token SECRET123 here", ["SECRET123"]), "token *** here")

    def test_complete_without_observed_running_is_flagged(self):
        fake = FakeKaggle(make_identity(), ["COMPLETE"])
        record, _ = self.run_execute(fake)
        self.assertTrue(any(o["event"] == "warning" for o in record["observations"]))


if __name__ == "__main__":
    unittest.main()
