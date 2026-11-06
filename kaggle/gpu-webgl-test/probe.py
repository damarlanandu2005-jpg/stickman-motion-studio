# one browser variant -> prints one JSON line. usage: python probe.py <variant>
import sys, json, time
from playwright.sync_api import sync_playwright
V = {
 "default_headless":   dict(headless=True,  args=[]),
 "headless_egl":       dict(headless=True,  args=["--use-gl=egl","--ignore-gpu-blocklist","--enable-gpu"]),
 "newheadless_egl":    dict(headless=True,  channel="chromium", args=["--use-gl=egl","--ignore-gpu-blocklist","--enable-gpu"]),
 "newheadless_vulkan": dict(headless=True,  channel="chromium", args=["--use-angle=vulkan","--enable-features=Vulkan","--ignore-gpu-blocklist","--disable-vulkan-surface"]),
 "newheadless_angle_gles": dict(headless=True, channel="chromium", args=["--use-angle=gl-egl","--ignore-gpu-blocklist","--enable-gpu"]),
 "xvfb_angle_gl":      dict(headless=False, args=["--use-angle=gl","--ignore-gpu-blocklist","--enable-gpu"]),
 "xvfb_vulkan":        dict(headless=False, args=["--use-angle=vulkan","--enable-features=Vulkan","--ignore-gpu-blocklist","--disable-vulkan-surface"]),
}
name = sys.argv[1]
JS = """
() => {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const gl = c.getContext('webgl2', {antialias:false, powerPreference:'high-performance'});
  if (!gl) return {error:'no webgl2'};
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, '#version 300 es\\nin vec2 p; void main(){gl_Position=vec4(p,0.,1.);}');
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, '#version 300 es\\nprecision highp float; out vec4 o; void main(){ vec2 u=gl_FragCoord.xy/vec2(1080.,1920.); float a=0.; for(int i=0;i<300;i++){ a+=sin(u.x*float(i)+a)*cos(u.y*float(i)-a);} o=vec4(vec3(fract(a)),1.);}');
  gl.compileShader(fs);
  const pr = gl.createProgram(); gl.attachShader(pr,vs); gl.attachShader(pr,fs); gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const l = gl.getAttribLocation(pr,'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
  gl.viewport(0,0,1080,1920);
  const px = new Uint8Array(4);
  const draw = () => { gl.drawArrays(gl.TRIANGLES,0,3); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); };
  draw();
  const t0 = performance.now(); for (let i=0;i<5;i++) draw(); const ms=(performance.now()-t0)/5;
  return {renderer, vendor, ms_per_fullframe_pass: Math.round(ms*10)/10};
}
"""
out = {"variant": name}
t = time.time()
try:
    with sync_playwright() as p:
        b = p.chromium.launch(**V[name])
        pg = b.new_page()
        pg.goto("about:blank")
        out.update(pg.evaluate(JS))
        b.close()
except Exception as e:
    out["error"] = str(e)[:300]
out["wall_s"] = round(time.time() - t, 1)
print("RESULT " + json.dumps(out), flush=True)
