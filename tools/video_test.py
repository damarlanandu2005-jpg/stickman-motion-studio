"""Feasibility test: can our Vertex Gemini access make short vertical clips with a shared cast/style bible?
Writes results to OUT/: models.txt, clip_N.mp4, log.txt. Never touches the render pipeline."""
import os, sys, time, json, traceback
from google import genai
from google.genai import types

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "log.txt"), "w")
def log(*a):
    s = " ".join(str(x) for x in a); print(s, flush=True); LOG.write(s + "\n"); LOG.flush()

loc = os.environ.get("VIDEO_LOCATION", "us-central1")
client = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location=loc,
                      http_options=types.HttpOptions(timeout=600000))

# 1. which media models can this account see?
names = []
try:
    for m in client.models.list():
        names.append(m.name)
except Exception as e:
    log("list error:", repr(e)[:300])
open(os.path.join(OUT, "models.txt"), "w").write("\n".join(sorted(names)))
media = [n for n in names if any(k in n.lower() for k in ("veo", "imagen", "image", "video"))]
log("location:", loc, "| models seen:", len(names)); log("media models:", media)

BIBLE = ("Vertical 9:16 animated cartoon, stylised 3D toon world with 2D 'bean head' characters: round white heads, thin black stick limbs, "
         "thick outlines, drawn expressive faces. Rich textured sets, warm golden-hour light, soft depth of field, smooth camera move. "
         "No on-screen text except signs that belong in the world. Same cast in every shot: "
         "ENGINEER = young man, red-striped flat cap, teal vest. BOSS = stocky man, brown bowler hat, yellow vest, moustache, face turns purple when angry. "
         "Setting: red-orange desert canyon, 1800s railroad. ")
SHOTS = [
 "Wide establishing shot: a huge red-orange canyon, two railroads racing toward each other across it, two company banners, tiny engineer on the trestle. Camera glides forward over the canyon.",
 "Close shot: the ENGINEER sits on a rail and saws a finger-wide gap into it, gravel and wooden sleepers, sawdust flying. Camera low along the track.",
 "The BOSS sees the gap, his face turns purple, he points and yells; the ENGINEER smirks with a sweat drop and shakes his head. Medium shot.",
 "Perfectly smooth rail with a train gliding silently past, then a close shot of a train going clickety-clack over a gap in the rail; a newspaper headline reads 'The Clickety Clack Line'.",
]
CAND = os.environ.get("VIDEO_MODELS", "veo-3.1-fast-generate-001,veo-3.1-generate-001,veo-3.0-fast-generate-001,veo-3.0-generate-001,veo-2.0-generate-001").split(",")
CAND = [c for c in CAND if c]
model = None; rows = []
for i, shot in enumerate(SHOTS, 1):
    done = False
    for mname in ([model] if model else CAND):
        t0 = time.time()
        try:
            cfg = types.GenerateVideosConfig(aspect_ratio="9:16", number_of_videos=1, duration_seconds=4 if "veo-2" not in mname else 5)
            op = client.models.generate_videos(model=mname, prompt=BIBLE + "Shot: " + shot, config=cfg)
            while not op.done:
                time.sleep(10); op = client.operations.get(op)
                if time.time() - t0 > 600: raise TimeoutError("over 10 min")
            r = op.response
            if not r or not r.generated_videos:
                raise RuntimeError("no video returned: " + str(getattr(op, "error", None) or r)[:300])
            v = r.generated_videos[0].video
            data = v.video_bytes
            if not data and v.uri:
                raise RuntimeError("video only as uri " + v.uri)
            p = os.path.join(OUT, f"clip_{i}.mp4"); open(p, "wb").write(data)
            log(f"shot {i}: OK model={mname} {len(data)//1024} KB {time.time()-t0:.0f}s")
            rows.append({"shot": i, "model": mname, "seconds": round(time.time()-t0), "kb": len(data)//1024})
            model = mname; done = True; break
        except Exception as e:
            log(f"shot {i}: model {mname} FAILED: {repr(e)[:400]}")
    if not done:
        log(f"shot {i}: no model worked"); rows.append({"shot": i, "model": None})
json.dump(rows, open(os.path.join(OUT, "summary.json"), "w"), indent=1)
