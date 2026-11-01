from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

CHARACTER_ID = "stickman_thoughts_mascot"
CHARACTER_SPEC = {
    "id": CHARACTER_ID,
    "name": "Stickman Thoughts mascot",
    "visual_identity": {
        "head": "large round white head, approximately one third of total character height",
        "outline": "clean, thick, dark charcoal outline with consistent line weight",
        "eyes": "two small black oval eyes",
        "eyebrows": "expressive black eyebrows",
        "mouth": "small simple mouth; expression changes, facial identity does not",
        "body": "thin black stick arms and thin black stick legs",
        "clothing": "no clothes, no bulky torso, no gloves, no shoes",
        "style": "flat 2D vector cartoon, soft muted colours, simple flat shading",
    },
    "invariants": [
        "same head size and circular silhouette in every image",
        "same eye spacing, eye shape and outline thickness",
        "same thin stick-limb construction and body proportions",
        "no torso, clothing, gloves, shoes or extra accessories unless explicitly approved",
        "one mascot only unless a shot explicitly requests a crowd",
        "background and props must not alter the mascot design",
    ],
}

VIEWS = ("front", "side", "three_quarter")
EXPRESSIONS = ("neutral", "happy", "sad", "surprised", "thinking", "scared")
POSES = ("standing", "walking", "running", "pointing", "sitting")


def _slug(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9_-]+", "-", value.strip()).strip("-").lower()
    if not value:
        raise ValueError("A non-empty identifier is required.")
    return value


def build_character_prompt(
    *, view: str = "front", expression: str = "neutral", pose: str = "standing",
    scene: str = "plain warm cream background", reference_instruction: str = "",
) -> str:
    if view not in VIEWS:
        raise ValueError(f"view must be one of: {', '.join(VIEWS)}")
    if expression not in EXPRESSIONS:
        raise ValueError(f"expression must be one of: {', '.join(EXPRESSIONS)}")
    if pose not in POSES:
        raise ValueError(f"pose must be one of: {', '.join(POSES)}")
    spec = CHARACTER_SPEC["visual_identity"]
    identity = (
        f"Draw exactly one {CHARACTER_SPEC['name']}. The character has a {spec['head']}; "
        f"{spec['outline']}; {spec['eyes']}; {spec['eyebrows']}; {spec['mouth']}; "
        f"{spec['body']}. {spec['clothing']}. Style: {spec['style']}."
    )
    invariants = " ".join(CHARACTER_SPEC["invariants"])
    ref = f" Reference guidance: {reference_instruction}" if reference_instruction else ""
    negative = (
        " Do not draw a human body, oval torso, astronaut suit, shirt, trousers, gloves, "
        "shoes, fingers, realistic anatomy, 3D render, photorealism, extra limbs, duplicate "
        "mascots, text, watermark, collage, grid or multiple panels."
    )
    return (
        f"{identity} View: {view}. Pose: {pose}. Expression: {expression}. "
        f"Scene: {scene}. {invariants}{ref}{negative}"
    )


def build_prompt_pack() -> dict[str, Any]:
    prompts = []
    for view in VIEWS:
        prompts.append({
            "asset_id": f"master-{view}",
            "kind": "master_view",
            "view": view,
            "expression": "neutral",
            "pose": "standing",
            "prompt": build_character_prompt(view=view),
        })
    for expression in EXPRESSIONS:
        prompts.append({
            "asset_id": f"expression-{expression}",
            "kind": "expression",
            "view": "front",
            "expression": expression,
            "pose": "standing",
            "prompt": build_character_prompt(expression=expression),
        })
    for pose in POSES:
        prompts.append({
            "asset_id": f"pose-{pose}",
            "kind": "pose",
            "view": "front",
            "expression": "neutral",
            "pose": pose,
            "prompt": build_character_prompt(pose=pose),
        })
    return {
        "schema_version": 1,
        "character": CHARACTER_SPEC,
        "generation_policy": {
            "model": "black-forest-labs/FLUX.2-klein-4B",
            "model_revision": "e7b7dc27f91deacad38e78976d1f2b499d76a294",
            "resolution": [576, 1024],
            "seed_policy": "Use and record an explicit seed for every image; do not claim a seed guarantees identity.",
            "reference_policy": (
                "Do not assume text-to-image provides identity consistency. Use a supported image-reference "
                "or editing path only after verifying the installed pipeline supports it. If unsupported, "
                "record the limitation and stop rather than silently switching models."
            ),
            "approval_policy": "Generated candidates are unapproved until a human explicitly approves their exact SHA-256.",
        },
        "prompts": prompts,
    }


def initialise_character_workspace(project: Path) -> dict[str, str]:
    project = Path(project).resolve()
    refs = project / "artwork" / "references" / "characters" / CHARACTER_ID
    candidates = project / "artwork" / "work" / "characters" / CHARACTER_ID
    approved = project / "artwork" / "approved" / "characters" / CHARACTER_ID
    for directory in (refs, candidates, approved):
        directory.mkdir(parents=True, exist_ok=True)
    manifest_path = refs / "character.json"
    prompt_path = refs / "prompt-pack.json"
    if manifest_path.exists() or prompt_path.exists():
        raise FileExistsError("Character reference files already exist; refusing to overwrite them.")
    manifest = {
        "schema_version": 1,
        "character": CHARACTER_SPEC,
        "status": "awaiting_human_approval",
        "approved_master": None,
        "candidates": [],
        "consistency_tests": [],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    prompt_path.write_text(json.dumps(build_prompt_pack(), indent=2) + "\n", encoding="utf-8")
    return {"manifest": str(manifest_path), "prompt_pack": str(prompt_path)}


def validate_character_workspace(project: Path) -> list[tuple[str, bool, str]]:
    project = Path(project).resolve()
    root = project / "artwork" / "references" / "characters" / CHARACTER_ID
    manifest_path = root / "character.json"
    prompt_path = root / "prompt-pack.json"
    results: list[tuple[str, bool, str]] = []
    for label, path in (("character_manifest", manifest_path), ("prompt_pack", prompt_path)):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            results.append((label, True, f"Valid JSON: {path}"))
            if label == "character_manifest":
                ok = data.get("character", {}).get("id") == CHARACTER_ID and isinstance(data.get("candidates"), list)
                results.append(("character_schema", ok, "Character identity and candidate list present" if ok else "Required character fields missing"))
            else:
                prompts = data.get("prompts")
                ok = isinstance(prompts, list) and len(prompts) == len(VIEWS) + len(EXPRESSIONS) + len(POSES)
                results.append(("prompt_coverage", ok, f"{len(prompts) if isinstance(prompts, list) else 0} prompts found; expected 14"))
                prompts_ok = ok and all(isinstance(p.get("prompt"), str) and p["prompt"].strip() for p in prompts)
                results.append(("prompt_content", prompts_ok, "All prompts are non-empty" if prompts_ok else "One or more prompts are empty"))
        except (OSError, json.JSONDecodeError) as exc:
            results.append((label, False, str(exc)))
    return results


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
