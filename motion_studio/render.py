from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path


def render_project(project: Path, output_name="final.mp4"):
    # Validate storyboard and clips before checking external rendering tools.
    shots = json.loads(
        (project / "storyboard" / "shots.json").read_text(encoding="utf-8")
    ).get("shots", [])

    if not shots:
        raise RuntimeError("No storyboard shots found.")

    clips = []
    for shot in shots:
        if shot.get("approval") != "approved":
            raise RuntimeError(f"Shot {shot.get('id')} is not approved.")

        relative = shot.get("animation_clip")
        if not relative:
            raise RuntimeError(
                f"Shot {shot.get('id')} has no animation_clip; "
                "still-image fallback is disabled."
            )

        clip = (project / relative).resolve()
        if not clip.is_file() or clip.suffix.lower() != ".mp4":
            raise RuntimeError(f"Missing animated MP4 for {shot.get('id')}: {clip}")

        clips.append(clip)

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg not found on PATH. Install a prebuilt FFmpeg release.")

    work = project / ".studio" / "render"
    work.mkdir(parents=True, exist_ok=True)

    concat = work / "concat.txt"
    concat.write_text(
        "\n".join("file '" + str(path).replace("'", "'\\''") + "'" for path in clips) + "\n",
        encoding="utf-8",
    )

    output = project / "renders" / output_name
    output.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(output),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("FFmpeg render failed:\n" + result.stderr[-3000:])
    return output
