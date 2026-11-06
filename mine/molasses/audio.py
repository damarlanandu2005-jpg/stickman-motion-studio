import os, sys
os.environ["FRAMES"] = "947"
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared", "audiolib.py")).read())
F = lambda f: f / 30
music = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32)
place(music, ragtime(F(405) - 0.2, 60, 108), 0, 0.9)           # ragtime piano until the tank groans
place(music, ragtime(F(556) - F(502), 60, 150), F(405), 0.0)
place(music, ragtime(F(405) - F(328), 62, 130), F(328), 0.0)
for k in range(8): place(music, drum("kick" if k % 2 == 0 else "snare"), F(589) + k * 0.2, 0.55)  # fast chase drums
place(music, folk(190, F(722) - F(589), 55, 1.0) * 0.5, F(589), 0.6)
place(music, ragtime(F(947) - F(800), 60, 70), F(800), 0.8)  # slow piano
# stops: music silent from the groan until the wave, drums stop at the flatten
mi0, mi1 = int(F(405) * SR), int(F(589) * SR); music[mi0:mi1] = 0
mj0, mj1 = int(F(722) * SR), int(F(800) * SR); music[mj0:mj1] = 0
# sfx
place(sfx, steps(F(30), 2.0), F(69), 0.25); place(sfx, murmur(F(60)), F(90), 0.25)
place(sfx, rumble(1.2), F(159), 0.35); place(sfx, murmur(F(60)), F(265), 0.25)
for k in range(10): place(sfx, hammer(), F(332) + k * 0.25, 0.5)
place(sfx, boing(), F(372), 0.5)
place(sfx, creak(1.3, 70), F(425), 1.0); place(sfx, creak(1.0, 50), F(470), 1.0)
for i, f0 in enumerate((504, 510, 517, 525, 534, 545)): place(sfx, gun(0.2), F(f0), 0.9)
place(sfx, crash(1.6), F(556), 1.0); place(sfx, thunk(40, 0.8), F(556), 1.3)
place(sfx, roar(F(133)), F(589), 0.9); place(sfx, crash(1.4), F(722), 0.9); place(sfx, splash(1.2), F(740), 0.9); place(sfx, crash(1.0), F(760), 0.7)
for k in range(6): place(sfx, flip(), F(805) + k * 0.25, 0.5)
place(sfx, water(F(40)), F(805), 0.3); place(sfx, bell(880, 1.4), F(870), 0.35)
write_stats = None
write_stems(music, sfx)
