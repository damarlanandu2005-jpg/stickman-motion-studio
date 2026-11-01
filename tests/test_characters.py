import json
import tempfile
import unittest
from pathlib import Path

from motion_studio.characters import (
    CHARACTER_ID,
    build_character_prompt,
    build_prompt_pack,
    initialise_character_workspace,
    sha256_file,
    validate_character_workspace,
)


class CharacterWorkspaceTests(unittest.TestCase):
    def test_prompt_pack_covers_views_expressions_and_poses(self):
        pack = build_prompt_pack()
        self.assertEqual(len(pack["prompts"]), 14)
        self.assertEqual(pack["generation_policy"]["model"], "black-forest-labs/FLUX.2-klein-4B")
        self.assertTrue(all(item["prompt"] for item in pack["prompts"]))

    def test_prompt_rejects_unknown_view(self):
        with self.assertRaises(ValueError):
            build_character_prompt(view="isometric")

    def test_prompt_preserves_mascot_invariants(self):
        prompt = build_character_prompt()
        self.assertIn("thin black stick arms", prompt)
        self.assertIn("no bulky torso", prompt)
        self.assertIn("no gloves", prompt)
        self.assertIn("no shoes", prompt)

    def test_initialise_and_validate_workspace(self):
        with tempfile.TemporaryDirectory() as temp:
            paths = initialise_character_workspace(Path(temp) / "short")
            self.assertTrue(Path(paths["manifest"]).is_file())
            self.assertTrue(Path(paths["prompt_pack"]).is_file())
            results = validate_character_workspace(Path(temp) / "short")
            self.assertTrue(all(passed for _, passed, _ in results))
            manifest = json.loads(Path(paths["manifest"]).read_text(encoding="utf-8"))
            self.assertEqual(manifest["character"]["id"], CHARACTER_ID)
            self.assertEqual(manifest["status"], "awaiting_human_approval")

    def test_initialise_refuses_to_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            project = Path(temp) / "short"
            initialise_character_workspace(project)
            with self.assertRaises(FileExistsError):
                initialise_character_workspace(project)

    def test_sha256_is_stable(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "sample.bin"
            path.write_bytes(b"stickman")
            self.assertEqual(
                sha256_file(path),
                "5c7d4ca8541273a2d6793b5d75f4cbb8c07cf2385088e102427515e70a18169d",
            )


if __name__ == "__main__":
    unittest.main()
