"""Editor-driven generative pipeline (feasibility). Stages: refs | clips.
refs: make candidate reference images (N variants each) -> OUT/refs/<name>_<i>.png
clips: Veo 3.1 clips per plan using chosen refs (OUT/refs/<name>.png) -> OUT/clips/<id>.mp4 (8 s, 9:16, no audio)"""
import os, sys, json, time
from concurrent.futures import ThreadPoolExecutor
from google import genai
from google.genai import types

stage, plan_path, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
only = [x for x in (sys.argv[4].split(",") if len(sys.argv) > 4 else []) if x]
plan = json.load(open(plan_path))
os.makedirs(OUT, exist_ok=True)
LOGF = open(os.path.join(OUT, f"log_{stage}.txt"), "a")
def log(*a):
    s = " ".join(str(x) for x in a); print(s, flush=True); LOGF.write(s + "\n"); LOGF.flush()
client = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location="us-central1", http_options=types.HttpOptions(timeout=600000))

def gen_image(prompt, path):
    for m in ("gemini-2.5-flash-image",):
        for attempt in range(6):
          try:
            r = client.models.generate_content(model=m, contents=[prompt], config=types.GenerateContentConfig(response_modalities=["IMAGE"]))
            for p in r.candidates[0].content.parts:
                if getattr(p, "inline_data", None) and p.inline_data.data:
                    open(path, "wb").write(p.inline_data.data); log("image OK", path); return
            raise RuntimeError("no image")
          except Exception as e:
            log("image FAIL", path, repr(e)[:200])
            if "429" in repr(e): time.sleep(20 * (attempt + 1))
            else: break

if stage == "upgrade":
    os.makedirs(os.path.join(OUT, "key_up"), exist_ok=True)
    def run_u(c):
        path = os.path.join(OUT, "key_up", c["id"] + ".png")
        for att in range(6):
            try:
                r = client.models.generate_content(model="gemini-2.5-flash-image", contents=[types.Part.from_bytes(data=open(c["image"], "rb").read(), mime_type="image/png"), c["prompt"]],
                      config=types.GenerateContentConfig(response_modalities=["IMAGE"]))
                for p_ in r.candidates[0].content.parts:
                    if getattr(p_, "inline_data", None) and p_.inline_data.data:
                        open(path, "wb").write(p_.inline_data.data); log(c["id"], "upgrade OK"); return
                raise RuntimeError("no image")
            except Exception as e:
                log(c["id"], "FAIL", repr(e)[:200])
                if "429" in repr(e): time.sleep(20 * (att + 1))
                else: time.sleep(3)
    with ThreadPoolExecutor(2) as ex: list(ex.map(run_u, [c for c in plan["upgrade"] if not only or c["id"] in only]))
elif stage == "i2v":
    os.makedirs(os.path.join(OUT, "i2v"), exist_ok=True)
    def run_i(c):
        path = os.path.join(OUT, "i2v", c["id"] + ".mp4")
        for att in range(3):
            t0 = time.time()
            try:
                img = types.Image(image_bytes=open(c["image"], "rb").read(), mime_type="image/png")
                op = client.models.generate_videos(model="veo-3.1-generate-001", prompt=c["prompt"], image=img, config=types.GenerateVideosConfig(aspect_ratio="9:16", number_of_videos=1, duration_seconds=c.get("dur", 6), generate_audio=False))
                while not op.done:
                    time.sleep(10); op = client.operations.get(op)
                    if time.time() - t0 > 780: raise TimeoutError("over 13 min")
                r = op.response
                if not r or not r.generated_videos: raise RuntimeError("no video: " + str(getattr(op, "error", None) or r)[:300])
                open(path, "wb").write(r.generated_videos[0].video.video_bytes); log(c["id"], "OK", f"{time.time()-t0:.0f}s"); return
            except Exception as e:
                log(c["id"], "FAIL", repr(e)[:300])
                if "429" in repr(e): time.sleep(60)
    with ThreadPoolExecutor(3) as ex: list(ex.map(run_i, [c for c in plan["i2v"] if not only or c["id"] in only]))
elif stage == "refs":
    os.makedirs(os.path.join(OUT, "refs"), exist_ok=True)
    jobs = [(plan["refs"][k] + " Warm golden light.", os.path.join(OUT, "refs", f"{k}_{i}.png")) for k in plan["refs"] if not only or k in only for i in (1, 2, 3)]
    with ThreadPoolExecutor(2) as ex: list(ex.map(lambda j: gen_image(*j), jobs))
else:
    os.makedirs(os.path.join(OUT, "clips"), exist_ok=True)
    refdir = os.path.join(OUT, "refs")
    def run(c):
        path = os.path.join(OUT, "clips", c["id"] + ".mp4")
        ri = []
        for k in c["refs"]:
            fp = os.path.join(refdir, k + ".png")
            if os.path.exists(fp):
                ri.append(types.VideoGenerationReferenceImage(image=types.Image(image_bytes=open(fp, "rb").read(), mime_type="image/png"), reference_type="ASSET"))
        prompt = plan["style"] + " Shot: " + c["shot"]
        for m in ("veo-3.1-generate-001",) * 4:
            if os.path.exists(path): return
            t0 = time.time()
            try:
                op = client.models.generate_videos(model=m, prompt=prompt, config=types.GenerateVideosConfig(aspect_ratio="9:16", number_of_videos=1, duration_seconds=8, reference_images=ri or None, generate_audio=False))
                while not op.done:
                    time.sleep(10); op = client.operations.get(op)
                    if time.time() - t0 > 780: raise TimeoutError("over 13 min")
                r = op.response
                if not r or not r.generated_videos: raise RuntimeError("no video: " + str(getattr(op, "error", None) or r)[:300])
                open(path, "wb").write(r.generated_videos[0].video.video_bytes)
                log(f"{c['id']}: OK {m} {time.time()-t0:.0f}s refs={c['refs']}"); return
            except Exception as e:
                log(f"{c['id']}: FAIL {m}: {repr(e)[:400]}")
                if "429" in repr(e): time.sleep(60)
    todo = [c for c in plan["clips"] if not only or c["id"] in only]
    with ThreadPoolExecutor(3) as ex: list(ex.map(run, todo))
