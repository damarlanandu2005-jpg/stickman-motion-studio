import os, sys
os.environ["FRAMES"] = "866"
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shared", "audiolib.py")).read())
F = lambda f: f / 30
music = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32)
# single plucked string at the start, drum joins, full band, drone while the council thinks, fast folk band, stop on "the music stopped"
place(music, folk(96, F(327) - F(32), 62, 0.9) * 0.6, F(32), 0.9)
place(music, folk(112, F(455) - F(327) + 0.0, 62, 1.0) * 0.0, F(327), 0.0)
dn = int((F(455) - F(327)) * SR); td = np.arange(dn) / SR
drone = lp_fast(((np.sin(2 * np.pi * 55 * td) + 0.5 * np.sin(2 * np.pi * 82.4 * td)) * np.minimum(1, td / 0.8)).astype(np.float32), 500); place(music, drone, F(327), 0.12)
place(music, folk(140, F(711) - F(455), 62, 1.0), F(455), 0.9)
fast = folk(180, F(711) - F(531), 62, 1.15); place(music, fast, F(531), 0.5)
place(music, pluck(midi(50), 0.9, 0.5), F(780), 0.3)
i0 = int(F(709) * SR); music[i0:i0 + int(0.04 * SR)] *= np.linspace(1, 0, int(0.04 * SR)); music[i0 + int(0.04 * SR):int(F(780) * SR)] = 0
place(music, pluck(midi(62), 1.6, 0.5), F(0) + 0.2, 0.35)
# sfx
place(sfx, bell(480, 2.2), F(2), 0.6)
place(sfx, steps(F(100), 2.2), F(40), 0.4); place(sfx, steps(F(55), 2.6), F(145), 0.3)
place(sfx, crowd_steps(F(76)), F(199), 0.4); place(sfx, crowd_steps(F(50)), F(276), 0.7); place(sfx, cheer(1.2), F(278), 0.15)
place(sfx, murmur(F(30)), F(327), 0.4); place(sfx, thunk(120, 0.25), F(436), 1.0); place(sfx, boing(), F(440), 0.5); place(sfx, murmur(2.0), F(357), 0.3)
for k in range(6): place(sfx, hammer(), F(458) + k * 0.28, 0.6)
place(sfx, crowd_steps(F(60)), F(455), 0.5); place(sfx, whoosh(0.4), F(500), 0.4)
place(sfx, crowd_steps(F(55)), F(531), 0.8); place(sfx, crowd_steps(F(57)), F(587), 1.1)
for i, f0 in enumerate(range(648, 706, 7)): place(sfx, thunk(70, 0.3), F(f0), 0.8)
place(sfx, thunk(60, 0.5), F(715), 1.0); place(sfx, drum("kick"), F(712), 0.9)
place(sfx, water(F(48)) * 0.4, F(761), 0.2); place(sfx, bell(520, 2.5), F(812), 0.5)
write_stems(music, sfx)
