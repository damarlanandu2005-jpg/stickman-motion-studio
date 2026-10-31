# Architecture

## Principles
- Controller, not monolith: orchestration and project contracts live here; engines remain replaceable.
- Local-first: core commands make no network or paid API calls.
- Manifest-driven: story, shot, asset and timeline data are explicit JSON.
- Resumable: each stage stores status, attempt count and timestamp.
- Human-gated: generation is not approval; rendering requires approved animated clips.
- Traceable: record tool/model/version/seed/licence for assets when available.

## Modules
- project.py: safe workspace creation; never overwrites an existing story.
- validation.py: manifest and project-file checks.
- planner.py: stage readiness and missing-input report.
- state.py: atomic state persistence.
- render.py: FFmpeg concatenation of approved MP4 clips only.
- adapters/base.py: contract for optional engines.
- cli.py: command-line interface.

## Planned adapters
ComfyUI workflow submission; character/pose generation; 2D/Blender animation; local TTS/audio; media probing and QC. An adapter is not considered implemented until health checks and integration tests pass.
