# Start a new short the way the template says: copy a working project, rename the video folder and composition.
# Usage: python engine/tools/new_short.py <name> [--from mine/railroads_remotion] [--comp NameShort]
# Result: mine/<name>_remotion/ with src/videos/<name>/, composition id <Name>Short.  Then edit the story/scene/cast files.
import sys, os, shutil, re
name = sys.argv[1]; src = "mine/railroads_remotion"; comp = name[:1].upper() + name[1:] + "Short"
if "--from" in sys.argv: src = sys.argv[sys.argv.index("--from") + 1]
if "--comp" in sys.argv: comp = sys.argv[sys.argv.index("--comp") + 1]
dst = f"mine/{name}_remotion"
if os.path.exists(dst): sys.exit(f"{dst} exists")
shutil.copytree(src, dst, ignore=shutil.ignore_patterns("node_modules", "out", ".git"))
vids = f"{dst}/src/videos"; old = [d for d in os.listdir(vids) if os.path.isdir(f"{vids}/{d}")][0]
shutil.move(f"{vids}/{old}", f"{vids}/{name}")
root = open(f"{dst}/src/Root.tsx").read()
m = re.search(r'id="(\w+)"', root); old_comp = m.group(1)
root = root.replace(f"videos/{old}/", f"videos/{name}/").replace(f'id="{old_comp}"', f'id="{comp}"')
open(f"{dst}/src/Root.tsx", "w").write(root)
for f in os.listdir(dst):
    if f.endswith(".mjs") or f == "README.md": pass
print(f"created {dst}  (video folder videos/{name}, composition {comp}, was {old}/{old_comp})")
print("next: edit src/videos/%s/<story>.ts, set RAIL/TOTAL frames in Root.tsx, then run engine/tools/shots_from_story.py" % name)
