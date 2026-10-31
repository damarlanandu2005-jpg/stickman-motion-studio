from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .adapters.comfyui import ComfyUIAdapter
from .models import STAGES
from .pipeline import record_stage
from .planner import readiness
from .project import init_project
from .render import render_project
from .state import load_state
from .validation import validate_project


def existing_project(value):
    path = Path(value).expanduser().resolve()
    if not path.is_dir():
        raise argparse.ArgumentTypeError(f"Project directory does not exist: {path}")
    return path


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="stickman-studio",
        description="Stickman Thoughts production controller",
    )
    subs = parser.add_subparsers(dest="command", required=True)

    p = subs.add_parser("init")
    p.add_argument("--project", required=True)
    p.add_argument("--title", required=True)

    for cmd in ("validate", "plan", "status"):
        p = subs.add_parser(cmd)
        p.add_argument("--project", required=True, type=existing_project)

    p = subs.add_parser("run-stage")
    p.add_argument("--project", required=True, type=existing_project)
    p.add_argument("--stage", required=True, choices=STAGES)
    p.add_argument(
        "--status",
        required=True,
        choices=["running", "completed", "failed", "blocked", "pending"],
    )
    p.add_argument("--message", default="")

    p = subs.add_parser("render")
    p.add_argument("--project", required=True, type=existing_project)
    p.add_argument("--output", default="final.mp4")

    p = subs.add_parser("comfyui-check", help="Check connection to a ComfyUI server")
    p.add_argument("--url", default="http://127.0.0.1:8188")

    p = subs.add_parser("comfyui-run", help="Submit an API-format workflow and download its image outputs")
    p.add_argument("--workflow", required=True, type=Path)
    p.add_argument("--output-dir", required=True, type=Path)
    p.add_argument("--url", default="http://127.0.0.1:8188")
    p.add_argument("--timeout", type=float, default=900)
    p.add_argument("--poll-interval", type=float, default=2)

    args = parser.parse_args(argv)
    try:
        if args.command == "init":
            path = init_project(Path(args.project), args.title)
            print(f"Created {path}\nStarter manifest is a placeholder; replace before production.")
            return 0

        if args.command == "validate":
            checks = validate_project(args.project)
            for check in checks:
                print(f"[{'PASS' if check.passed else 'FAIL'}] {check.name}: {check.message}")
            return 0 if all(check.passed for check in checks) else 2

        if args.command == "plan":
            for row in readiness(args.project):
                print(f"{row['stage']:<18} {'READY' if row['ready'] else 'WAITING'} [{row['status']}]")
                for item in row["missing"]:
                    print(f"  - {item}")
            return 0

        if args.command == "status":
            print(json.dumps(load_state(args.project), indent=2))
            return 0

        if args.command == "run-stage":
            record_stage(args.project, args.stage, args.status, args.message)
            print(f"{args.stage}: {args.status}")
            return 0

        if args.command == "render":
            print(f"Rendered: {render_project(args.project, args.output)}")
            return 0

        if args.command == "comfyui-check":
            adapter = ComfyUIAdapter(args.url)
            print(json.dumps(adapter.healthcheck(), indent=2))
            return 0

        if args.command == "comfyui-run":
            if not args.workflow.is_file():
                raise FileNotFoundError(f"Workflow file not found: {args.workflow}")
            workflow = json.loads(args.workflow.read_text(encoding="utf-8"))
            if not isinstance(workflow, dict):
                raise ValueError("Workflow JSON must contain an API-format object.")
            adapter = ComfyUIAdapter(args.url)
            result = adapter.run(
                workflow,
                args.output_dir,
                timeout=args.timeout,
                poll_interval=args.poll_interval,
            )
            print(json.dumps(result, indent=2))
            return 0

    except (ValueError, RuntimeError, FileExistsError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
