"""Test 2: consistency with reference images. Mode REF = Veo reference images; Mode KEY = per-shot keyframe image (made from the character refs) -> Veo image-to-video."""
import os, sys, time, json
from google import genai
from google.genai import types

OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, "log.txt"), "w")
def log(*a):
    s = " ".join(str(x) for x in a); print(s, flush=True); LOG.write(s + "\n"); LOG.flush()
client = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"], location=os.environ.get("VIDEO_LOCATION", "us-central1"),
                      http_options=types.HttpOptions(timeout=600000))
IMG_MODELS = os.environ.get("IMG_MODELS", "gemini-3.1-flash-image,gemini-2.5-flash-image,gemini-3-pro-image").split(",")

STYLE = ("Stylised 3D toon world with 2D 'bean head' cartoon characters: perfectly round white head, thin black stick arms and legs, thick black outline, "
         "simple drawn face (dot eyes, brows, small mouth). Characters are flat 2D cartoon figures, NOT realistic humans. Warm golden-hour light, rich textured set. ")
CHARS = {
 "engineer": "Character sheet, full body, front view, plain light background: ENGINEER, young man, round white bean head, red-striped flat cap, teal vest over white shirt, brown trousers, thin black stick limbs.",
 "boss": "Character sheet, full body, front view, plain light background: BOSS, stocky man, round white bean head with brown moustache, brown bowler hat, yellow vest with brown belt, thin black stick limbs.",
 "canyon": "Environment reference, no characters: wide red-orange desert canyon in a stylised 3D toon look, two railroad lines racing toward each other across a deep gap on wooden trestles, two banners (A-LINE blue, B-LINE orange), golden hour.",
}
def gen_image(prompt, refs=(), name=""):
    for m in IMG_MODELS:
        try:
            parts = [types.Part.from_bytes(data=b, mime_type="image/png") for b in refs] + [prompt]
            r = client.models.generate_content(model=m, contents=parts,
                  config=types.GenerateContentConfig(response_modalities=["IMAGE"]))
            for c in r.candidates[0].content.parts:
                if getattr(c, "inline_data", None) and c.inline_data.data:
                    open(os.path.join(OUT, name + ".png"), "wb").write(c.inline_data.data)
                    log(f"image {name}: OK model={m}"); return c.inline_data.data
            raise RuntimeError("no image part")
        except Exception as e:
            log(f"image {name}: model {m} FAILED: {repr(e)[:300]}")
    return None

refs = {k: gen_image(STYLE + v, name="ref_" + k) for k, v in CHARS.items()}

SHOTS = {
 2: "Close shot: the ENGINEER (bean head, red-striped cap, teal vest) sits on a rail and saws a finger-wide gap into it, gravel and sleepers, sawdust. Camera low along the track.",
 3: "Medium shot: the BOSS (bean head, brown bowler hat, yellow vest, moustache) points and yells, his face turns purple; the ENGINEER (bean head, red-striped cap, teal vest) smirks with a sweat drop and shakes his head.",
}
def run_video(tag, prompt, image=None, ref_images=None, dur=4, aspect="9:16", models=("veo-3.1-generate-001", "veo-3.1-fast-generate-001")):
    for m in models:
        t0 = time.time()
        try:
            kw = dict(aspect_ratio=aspect, number_of_videos=1, duration_seconds=dur)
            if ref_images: kw["reference_images"] = ref_images
            op = client.models.generate_videos(model=m, prompt=prompt, image=image, config=types.GenerateVideosConfig(**kw))
            while not op.done:
                time.sleep(10); op = client.operations.get(op)
                if time.time() - t0 > 600: raise TimeoutError("over 10 min")
            r = op.response
            if not r or not r.generated_videos: raise RuntimeError("no video: " + str(getattr(op, "error", None) or r)[:300])
            data = r.generated_videos[0].video.video_bytes
            open(os.path.join(OUT, tag + ".mp4"), "wb").write(data)
            log(f"{tag}: OK model={m} {len(data)//1024} KB {time.time()-t0:.0f}s"); return True
        except Exception as e:
            log(f"{tag}: model {m} FAILED: {repr(e)[:400]}")
    return False

# Mode REF: reference images (engineer, boss, canyon)
if all(refs.get(k) for k in ("engineer", "boss")):
    ri = [types.VideoGenerationReferenceImage(image=types.Image(image_bytes=refs[k], mime_type="image/png"), reference_type="ASSET") for k in ("engineer", "boss")]
    for n in (2, 3):
        if not run_video(f"ref_shot{n}", STYLE + SHOTS[n], ref_images=ri, dur=8):
            run_video(f"ref_shot{n}_916_4s", STYLE + SHOTS[n], ref_images=ri, dur=4)

# Mode KEY: keyframe image per shot (conditioned on the character refs) -> image-to-video
for n in (2, 3):
    cond = [refs[k] for k in ("engineer", "boss", "canyon") if refs.get(k)]
    key = gen_image(STYLE + "Vertical 9:16 keyframe of this shot, keep the characters EXACTLY as in the reference images (same hat, vest, bean head, 2D cartoon look): " + SHOTS[n], refs=cond, name=f"key_shot{n}")
    if key:
        run_video(f"key_shot{n}", STYLE + SHOTS[n] + " Smooth camera move, characters stay exactly as in the first frame.", image=types.Image(image_bytes=key, mime_type="image/png"))
