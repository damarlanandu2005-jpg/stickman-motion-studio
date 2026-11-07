import os, sys
D = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(D, "audiolib.py")).read())
F = lambda f: f / 30
music = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32)

# Music
place(music, folk(100, 1.83), 0.0, 0.5)
place(music, ragtime(2.7, 60, 100), 1.83, 0.5)
place(music, ragtime(2.57, 60, 160), 4.53, 0.6)
place(music, ragtime(2.6, 60, 80), 7.1, 0.4)
place(music, trombone_sad(4.53), 9.7, 0.5)
place(music, folk(90, 3.87), 14.23, 0.5)
place(music, ragtime(4.5, 60, 120), 18.1, 0.5)
# s8 silent 22.6 to 23.07
place(music, ragtime(1.36, 60, 120), 23.07, 0.5)
place(music, folk(110, 5.44), 24.43, 0.5)
place(music, brass([midi(60), midi(64), midi(67)], 1.7), 29.87, 0.4)
place(music, ragtime(2.0, 60, 100), 31.57, 0.6)

# SFX
place(sfx, click(), 1.374, 0.6)
place(sfx, creak(0.5), 2.736, 0.7)
place(sfx, scrape(0.8), 6.008, 0.6)
place(sfx, snap(), 8.631, 0.8)
place(sfx, thunk(120, 0.3), 13.467, 0.8)
place(sfx, scrape(0.6), 16.792, 0.6)
place(sfx, click(), 21.3, 0.7)
place(sfx, snap(), 22.603, 1.0)
place(sfx, thunk(150, 0.3), 23.873, 0.9)
place(sfx, whoosh(0.6), 24.66, 0.6)
place(sfx, creak(0.6), 31.064, 0.7)
place(sfx, click(), 33.123, 0.6)

write_stems(music, sfx)
