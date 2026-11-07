import os, sys
D = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(D, "audiolib.py")).read())
F = lambda f: f / 30
music = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32)

# --- music
beat = 60 / 108; t = 0.0
while t < F(1600):
    place(music, drum("kick" if int(t / beat) % 2 == 0 else "snare"), t, 0.4 if int(t / beat) % 2 == 0 else 0.25)
    if int(t / beat) % 4 == 3: place(music, brass([midi(60), midi(64), midi(67)], beat * 0.9), t, 0.08)
    place(music, pluck(midi(48 if int(t / beat) % 2 == 0 else 55), 0.3, 0.4), t, 0.25)
    t += beat / 2

place(music, sting(), F(1620), 0.8)

# --- sfx
place(sfx, scrape(0.6), F(10), 0.8)
place(sfx, hammer(0.2), F(120), 0.5)
place(sfx, thunk(80, 0.3), F(280), 0.7)
place(sfx, whoosh(0.8), F(310), 0.5)
place(sfx, roar(0.5), F(460), 0.6)
place(sfx, thunk(100, 0.4), F(500), 0.8)
place(sfx, whoosh(0.3), F(550), 0.4)
place(sfx, hammer(0.2), F(640), 0.7)
place(sfx, steps(4.0, 4.0), F(700), 0.6)
place(sfx, whoosh(0.4), F(840), 0.5)
place(sfx, whoosh(1.5), F(980), 0.6)
place(sfx, creak(1.0), F(1050), 0.7)
place(sfx, ting(), F(1110), 0.6)
place(sfx, whoosh(0.3), F(1160), 0.4)
place(sfx, murmur(1.0), F(1240), 0.6)
place(sfx, creak(1.5), F(1320), 0.8)
place(sfx, rumble(1.5), F(1440), 0.5)
place(sfx, hammer(0.3), F(1520), 0.8)
place(sfx, crash(2.0), F(1620), 1.0)

write_stems(music, sfx)
