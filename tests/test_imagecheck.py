import struct
import tempfile
import unittest
import zlib
from pathlib import Path

from motion_studio.imagecheck import validate_png


def make_png(width=4, height=3, corrupt_crc=False, truncate_pixels=False):
    def chunk(kind, body):
        crc = zlib.crc32(kind + body) & 0xFFFFFFFF
        if corrupt_crc and kind == b"IDAT":
            crc ^= 1
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", crc)

    raw = b"".join(b"\x00" + b"\x80\x40\x20" * width for _ in range(height))
    if truncate_pixels:
        raw = raw[:-5]
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


class PngValidationTests(unittest.TestCase):
    def write(self, data, name="x.png"):
        directory = Path(tempfile.mkdtemp())
        path = directory / name
        path.write_bytes(data)
        return path

    def test_valid_png(self):
        result = validate_png(self.write(make_png()), expected_size=(4, 3))
        self.assertTrue(result["valid"], result)
        self.assertEqual((result["width"], result["height"]), (4, 3))
        self.assertEqual(len(result["sha256"]), 64)

    def test_missing_file(self):
        self.assertFalse(validate_png(Path("/nonexistent/none.png"))["valid"])

    def test_not_a_png(self):
        self.assertIn("signature", validate_png(self.write(b"GIF89a not a png"))["error"])

    def test_empty_file(self):
        self.assertFalse(validate_png(self.write(b""))["valid"])

    def test_bad_crc(self):
        self.assertIn("CRC", validate_png(self.write(make_png(corrupt_crc=True)))["error"])

    def test_truncated_pixels(self):
        self.assertFalse(validate_png(self.write(make_png(truncate_pixels=True)))["valid"])

    def test_wrong_dimensions(self):
        self.assertIn("dimensions", validate_png(self.write(make_png()), expected_size=(512, 512))["error"])


if __name__ == "__main__":
    unittest.main()
