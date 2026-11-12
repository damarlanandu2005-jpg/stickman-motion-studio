#!/usr/bin/env python3
"""Contact sheets of the stop-frame stills, big enough to judge (not thumbnails).
usage: sheets.py <out_stills dir> <out prefix> [--which b] [--per 7] [--w 360]  -> <prefix>_1.jpg, _2.jpg ..."""
import sys, glob, os
from PIL import Image, ImageDraw
d, pre = sys.argv[1], sys.argv[2]; a = sys.argv
which = a[a.index("--which") + 1] if "--which" in a else "b"; per = int(a[a.index("--per") + 1]) if "--per" in a else 7; w = int(a[a.index("--w") + 1]) if "--w" in a else 360
fs = sorted(f for f in glob.glob(os.path.join(d, "shot*_*.jpg")) if os.path.basename(f)[7] in which); h = w * 16 // 9
for s in range(0, len(fs), per):
    S = Image.new("RGB", (w * per, h), "white")
    for i, f in enumerate(fs[s:s + per]):
        im = Image.open(f).resize((w, h)); ImageDraw.Draw(im).text((8, 6), os.path.basename(f)[4:8], fill=(255, 255, 0)); S.paste(im, (i * w, 0))
    S.save("%s_%d.jpg" % (pre, s // per + 1), quality=88)
print((len(fs) + per - 1) // per, "sheets")
