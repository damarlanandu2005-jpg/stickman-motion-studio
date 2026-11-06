import os, sys
D = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(D, "audiolib.py")).read())
F = lambda f: f / 30
music = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32)

beat = 60 / 120
t = 0.0
while t < F(1082):
    if t < F(250):
        if int(t/beat) % 4 == 0: place(music, pluck(midi(55), 0.5, 0.3), t, 0.4)
    elif t < F(772):
        place(music, drum("kick"), t, 0.3)
        if int(t/(beat/2)) % 2 == 0: place(music, pluck(midi(60), 0.1, 0.6), t, 0.2)
    elif t < F(918):
        place(music, drum("kick"), t, 0.6)
        place(music, drum("kick"), t + 0.15, 0.4)
    else:
        if int(t/beat) % 2 == 0: place(music, brass([midi(60), midi(64), midi(67)], beat), t, 0.3)
        place(music, drum("snare"), t, 0.2)
    t += beat if t < F(772) else (beat/2 if t < F(918) else beat)

place(sfx, thunk(80, 0.4), F(20), 0.8)
place(sfx, click(), F(120), 0.8)
place(sfx, murmur(1.0), F(160), 0.5)
place(sfx, ting(), F(310), 0.8)
place(sfx, engine(0.5, 60), F(400), 0.5)
place(sfx, thunk(50, 0.3), F(470), 0.8)
place(sfx, click(), F(530), 0.8)
place(sfx, scrape(0.5), F(590), 0.6)
place(sfx, scrape(0.5), F(670), 0.6)
place(sfx, ting(), F(750), 0.8)
place(sfx, ting(), F(772), 0.9)
place(sfx, ting(), F(782), 0.9)
place(sfx, ting(), F(792), 0.9)
place(sfx, whoosh(0.5), F(830), 0.5)
place(sfx, bell(800, 1.0), F(890), 0.8)
place(sfx, click(), F(970), 0.8)
place(sfx, brass([midi(60), midi(64), midi(67)], 1.0), F(1030), 0.8)

write_stems(music, sfx)
