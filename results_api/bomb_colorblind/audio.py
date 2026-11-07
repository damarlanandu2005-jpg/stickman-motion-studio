import os, sys
D = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(D, "audiolib.py")).read())
F = lambda f: f / 30
music = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32)

# Music
beat = 60 / 108; t = 0.0
while t < F(436):
    place(music, drum("kick" if int(t / beat) % 2 == 0 else "snare"), t, 0.3)
    place(music, pluck(midi(48 if int(t / beat) % 2 == 0 else 55), 0.3, 0.4), t, 0.2)
    t += beat / 2

place(music, trombone_sad(1.6), F(436), 0.3)
place(music, brass([midi(60), midi(64), midi(67)], 1.5), F(499), 0.2)
place(music, trombone_sad(1.6), F(696), 0.3)

rg = ragtime(DUR - F(858), 60, 112); place(music, rg, F(858), 0.6)

# SFX
place(sfx, thunk(120, 0.3), F(19), 0.6) # soft thud
place(sfx, steps(1.0, 1.5), F(123), 0.8) # heavy footsteps
place(sfx, noise(0.8), F(153), 0.3) # radio static
place(sfx, click(0.1), F(303), 0.8) # beeping
place(sfx, scrape(0.6), F(344), 0.5) # rustling
place(sfx, drum("kick"), F(464), 0.7) # heartbeat
place(sfx, whoosh(0.6), F(530), 0.5) # breath
place(sfx, ting(), F(587), 0.6) # clink
place(sfx, scrape(0.8), F(620), 0.4) # finger sliding
place(sfx, scrape(0.5), F(751), 0.7) # metallic scrape
place(sfx, click(0.1), F(786), 0.9) # loud ticking
place(sfx, murmur(2.0), F(819), 0.5) # crowd murmur
place(sfx, ting(), F(870), 0.8) # bright ding
place(sfx, snap(), F(962), 0.8) # sharp snip
place(sfx, scrape(0.4), F(1025), 0.6) # marker squeak

write_stems(music, sfx)
