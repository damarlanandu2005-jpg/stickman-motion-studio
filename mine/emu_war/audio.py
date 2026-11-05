import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
os.environ["FRAMES"] = "597"
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared", "audiolib.py")).read())
F = lambda f: f / 30
music = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32)
# --- music: military snare march (stops just before the guns), sad bar, playful ragtime for the ending
beat = 60 / 108; t = 0.0
while t < F(356):
    place(music, drum("kick" if int(t / beat) % 2 == 0 else "snare"), t, 0.5 if int(t / beat) % 2 == 0 else 0.32)
    if int(t / beat) % 4 == 3: place(music, brass([midi(60), midi(64), midi(67)], beat * 0.9), t, 0.09)
    place(music, pluck(midi(48 if int(t / beat) % 2 == 0 else 55), 0.3, 0.4), t, 0.3)
    t += beat / 2
place(music, trombone_sad(1.6), F(392), 0.35)
rg = ragtime(DUR - F(449), 60, 112); place(music, rg, F(449), 0.9)
i0 = int(F(356) * SR); music[i0:i0 + int(0.05 * SR)] *= np.linspace(1, 0, int(0.05 * SR))
# --- sfx
place(sfx, steps(F(32), 2.0), 0, 0.5)
place(sfx, whoosh(0.5), F(34), 0.5); place(sfx, honk(330, 0.45), F(93), 0.8); place(sfx, whoosh(0.3), F(97), 0.5)
place(sfx, crowd_steps(2.0), F(106), 0.18); place(sfx, murmur(2.0), F(106), 0.4)
place(sfx, engine(F(50), 46), F(168), 0.5); place(sfx, thunk(150, 0.2), F(205), 0.8); place(sfx, hammer(), F(212), 0.6)
place(sfx, crowd_steps(2.4), F(243), 0.5); place(sfx, boing(), F(246), 0.45); place(sfx, honk(420, 0.3), F(262), 0.4)
place(sfx, engine(F(36), 70), F(322), 0.55); place(sfx, honk(500, 0.3), F(338), 0.7)
for k in range(5): place(sfx, burst(5, 0.07), F(360) + k * 0.2, 0.55)
place(sfx, boing(), F(382), 0.5)
for k in range(5): place(sfx, flip(), F(400) + k * 0.28, 0.5)
place(sfx, honk(360, 0.35), F(449), 0.7); place(sfx, crowd_steps(1.0), F(480), 0.15)
place(sfx, honk(400, 0.3), F(520), 0.5); place(sfx, cheer(1.8), F(540), 0.5); place(sfx, honk(330, 0.5), F(578), 1.0)
for i, f0 in enumerate((582, 586, 590)): place(sfx, brass([midi(72)], 0.25), F(f0), 0.12)
write_stems(music, sfx)
