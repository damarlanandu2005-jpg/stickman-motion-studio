"""Standard-library PNG validation.

Used by the Kaggle execution manager to independently re-check a generated image
after it has been downloaded, instead of trusting the notebook's own report.
"""
from __future__ import annotations

import hashlib
import struct
import zlib
from pathlib import Path
from typing import Any

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
# color type -> samples per pixel
_SAMPLES = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}


def sha256_file(path: Path, chunk: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for block in iter(lambda: handle.read(chunk), b""):
            digest.update(block)
    return digest.hexdigest()


def validate_png(path: Path, expected_size: tuple[int, int] | None = None) -> dict[str, Any]:
    """Validate signature, chunk CRCs, IHDR, and that the pixel data decompresses.

    Returns a dict; `valid` is True only if every check passed. Never raises for
    bad image content (only for programmer errors).
    """
    path = Path(path)
    result: dict[str, Any] = {
        "path": str(path), "exists": path.is_file(), "valid": False,
        "width": None, "height": None, "bytes": None, "sha256": None, "error": None,
    }
    if not path.is_file():
        result["error"] = "file does not exist"
        return result
    data = path.read_bytes()
    result["bytes"] = len(data)
    result["sha256"] = hashlib.sha256(data).hexdigest()
    if not data:
        result["error"] = "file is empty"
        return result
    if not data.startswith(PNG_SIGNATURE):
        result["error"] = "missing PNG signature"
        return result

    pos = len(PNG_SIGNATURE)
    idat = bytearray()
    ihdr: tuple[int, int, int, int, int] | None = None
    seen_iend = False
    first = True
    while pos + 8 <= len(data):
        length, ctype = struct.unpack(">I4s", data[pos:pos + 8])
        body_start, body_end = pos + 8, pos + 8 + length
        if body_end + 4 > len(data):
            result["error"] = f"truncated chunk {ctype!r}"
            return result
        body = data[body_start:body_end]
        (crc,) = struct.unpack(">I", data[body_end:body_end + 4])
        if zlib.crc32(ctype + body) & 0xFFFFFFFF != crc:
            result["error"] = f"bad CRC in chunk {ctype!r}"
            return result
        if first:
            if ctype != b"IHDR" or length != 13:
                result["error"] = "first chunk is not a valid IHDR"
                return result
            width, height, depth, ctype_color, _comp, _filt, interlace = struct.unpack(">IIBBBBB", body)
            ihdr = (width, height, depth, ctype_color, interlace)
            first = False
        elif ctype == b"IDAT":
            idat.extend(body)
        elif ctype == b"IEND":
            seen_iend = True
            break
        pos = body_end + 4

    if ihdr is None:
        result["error"] = "no IHDR chunk"
        return result
    width, height, depth, color, interlace = ihdr
    result["width"], result["height"] = width, height
    if width <= 0 or height <= 0:
        result["error"] = "non-positive dimensions"
        return result
    if not seen_iend:
        result["error"] = "missing IEND chunk"
        return result
    if color not in _SAMPLES:
        result["error"] = f"unknown color type {color}"
        return result
    try:
        raw = zlib.decompress(bytes(idat))
    except zlib.error as exc:
        result["error"] = f"pixel data does not decompress: {exc}"
        return result
    if interlace == 0:
        row_bytes = (width * _SAMPLES[color] * depth + 7) // 8
        expected = height * (1 + row_bytes)
        if len(raw) != expected:
            result["error"] = f"pixel data length {len(raw)} != expected {expected}"
            return result
    if expected_size is not None and (width, height) != tuple(expected_size):
        result["error"] = f"dimensions {width}x{height} != expected {expected_size[0]}x{expected_size[1]}"
        return result
    result["valid"] = True
    return result
