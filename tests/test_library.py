import copy
import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from motion_studio import library as lib

ROOT = Path(__file__).resolve().parents[1]


class FakeKaggle:
    """Scripted stand-in for the kaggle CLI: only tests control flow, never evidence of a real upload."""

    def __init__(self, exists=False, statuses=("ready",), store=None, zip_files=False):
        self.exists, self.statuses, self.calls = exists, list(statuses), []
        self.store, self.zip_files = store or {}, zip_files

    def __call__(self, args):
        self.calls.append(args)
        verb = args[2]
        if verb == "status":
            if not self.exists:
                return 1, "404 not found"
            return 0, self.statuses.pop(0) if len(self.statuses) > 1 else self.statuses[0]
        if verb in ("create", "version"):
            folder = Path(args[args.index("-p") + 1])
            self.store = {p.name: p.read_bytes() for p in folder.iterdir()}
            self.exists = True
            return 0, "Dataset upload ok"
        if verb == "download":
            name, dest = args[args.index("-f") + 1], Path(args[args.index("-p") + 1])
            if name not in self.store:
                return 1, "404"
            if self.zip_files:
                with zipfile.ZipFile(dest / (name + ".zip"), "w") as z:
                    z.writestr(name, self.store[name])
            else:
                (dest / name).write_bytes(self.store[name])
            return 0, "ok"
        return 1, "unknown"


def tiny_catalog(tmp: Path):
    (tmp / "a.glb").write_bytes(b"glTF-fake-model")
    (tmp / "b.png").write_bytes(b"\x89PNG-fake-card")
    def item(i, kind, local, **kw):
        data = (tmp / local).read_bytes()
        return {"id": i, "kind": kind, "file": f"{kind}__{local}", "local": local, "tags": [], "licence": "test", "source": {},
                "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), **kw}
    return {"title": "T", "dataset_slug": "t-lib", "items": [item("a", "model", "a.glb", height_m=2.0), item("b", "card", "b.png")]}


class CatalogTests(unittest.TestCase):
    def test_real_catalog_matches_files(self):
        self.assertEqual(lib.check_catalog(lib.load()), [])

    def test_bad_catalogs_are_caught(self):
        tmp = Path(tempfile.mkdtemp()); cat = tiny_catalog(tmp)
        bad = copy.deepcopy(cat); bad["items"][0]["height_m"] = 0
        self.assertTrue(any("height_m" in p for p in lib.check_catalog(bad, tmp)))
        bad = copy.deepcopy(cat); bad["items"][1]["id"] = "a"
        self.assertTrue(any("duplicate id" in p for p in lib.check_catalog(bad, tmp)))
        bad = copy.deepcopy(cat); bad["items"][0]["file"] = "models/a.glb"
        self.assertTrue(any("flat" in p for p in lib.check_catalog(bad, tmp)))
        (tmp / "a.glb").write_bytes(b"changed")
        self.assertTrue(any("does not match" in p for p in lib.check_catalog(cat, tmp)))


class PublishFetchTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp()); self.cat = tiny_catalog(self.tmp)

    def test_first_publish_creates_then_waits_until_ready(self):
        k = FakeKaggle(exists=False, statuses=("running", "ready"))
        r = lib.publish(self.cat, "nandu", "m", runner=k, sleep=lambda s: None, root=self.tmp)
        self.assertEqual(r["action"], "create")
        self.assertIn("model__a.glb", k.store)
        meta = json.loads(k.store["dataset-metadata.json"])
        self.assertEqual(meta["id"], "nandu/t-lib")

    def test_later_publish_versions(self):
        k = FakeKaggle(exists=True)
        self.assertEqual(lib.publish(self.cat, "nandu", "m", runner=k, sleep=lambda s: None, root=self.tmp)["action"], "version")
        self.assertTrue(any(c[2] == "version" for c in k.calls))

    def test_processing_error_is_reported(self):
        k = FakeKaggle(exists=True, statuses=("error: bad file",))
        with self.assertRaises(RuntimeError):
            lib.publish(self.cat, "nandu", "m", runner=k, sleep=lambda s: None, root=self.tmp)

    def test_fetch_checks_hashes_and_unzips(self):
        k = FakeKaggle(exists=True, zip_files=True)
        lib.publish(self.cat, "nandu", "m", runner=k, sleep=lambda s: None, root=self.tmp)
        got = lib.fetch(self.cat, "nandu", ["a", "b"], self.tmp / "dl", runner=k)
        self.assertEqual([g["id"] for g in got], ["a", "b"])

    def test_fetch_refuses_changed_bytes(self):
        k = FakeKaggle(exists=True)
        lib.publish(self.cat, "nandu", "m", runner=k, sleep=lambda s: None, root=self.tmp)
        k.store["model__a.glb"] = b"tampered"
        with self.assertRaises(RuntimeError):
            lib.fetch(self.cat, "nandu", ["a"], self.tmp / "dl", runner=k)

    def test_unknown_id_and_bad_owner(self):
        with self.assertRaises(KeyError):
            lib.fetch(self.cat, "nandu", ["zzz"], self.tmp, runner=FakeKaggle())
        with self.assertRaises(ValueError):
            lib.dataset_ref(self.cat, "a/b")


if __name__ == "__main__":
    unittest.main()


class CatalogSectionTests(unittest.TestCase):
    def test_real_catalog_sections_are_consistent(self):
        cat = lib.load()
        self.assertEqual(lib.check_sections(cat), [])
        ids = {i["id"] for i in cat["items"]}
        self.assertIn("moon_buggy_a", ids)
        self.assertIn("astronaut", cat["character"]["costumes"])

    def test_unknown_motion_and_missing_scene_are_reported(self):
        cat = copy.deepcopy(lib.load())
        cat["motions"].append({"id": "moonwalk", "code": "animation/src/motion.ts"})
        cat["scenes"].append({"id": "ghost", "file": "animation/scenes/ghost.json", "status": "test"})
        problems = lib.check_sections(cat)
        self.assertTrue(any("moonwalk" in p for p in problems))
        self.assertTrue(any("ghost" in p for p in problems))


class BehaviorFileTests(unittest.TestCase):
    def test_buggy_behavior_is_valid(self):
        self.assertEqual(lib.check_behavior(ROOT / "library/behaviors/moon_buggy_a.json", "moon_buggy_a"), [])

    def test_engine_copy_matches_library_copy(self):
        a = (ROOT / "library/behaviors/moon_buggy_a.json").read_text()
        b = (ROOT / "animation/assets/behaviors/moon_buggy_a.json").read_text()
        self.assertEqual(json.loads(a), json.loads(b))

    def test_broken_behavior_is_reported(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "x.json"
            f.write_text(json.dumps({"type": "vehicle", "parts": [{"id": "door", "region": {"min": [0, 0, 0], "max": [2, 1, 1]}, "axis": [0, 0, 0]}],
                                     "triggers": [{"part": "ghost", "within_m": 1}], "crash": {"min_speed_mps": 3, "open_parts": ["nope"]}}))
            problems = lib.check_behavior(f, "x")
        text = " ".join(problems)
        for word in ("region", "axis", "open_deg", "ghost", "nope"):
            self.assertIn(word, text)
