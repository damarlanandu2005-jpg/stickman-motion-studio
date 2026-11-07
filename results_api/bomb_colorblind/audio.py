import os, sys
D = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(D, "audiolib.py")).read())
F = lambda f: f / 30
music = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32)

place(music, rumble(4.8), 0.0, 0.3)
place(music, rumble(3.5), 4.8, 0.4)
place(music, ragtime(3.0, 60, 140), 8.33, 0.3)
place(music, ragtime(3.2, 60, 140), 11.3, 0.3)
place(music, rumble(3.7), 14.53, 0.5)
place(music, ragtime(2.3, 60, 120), 18.23, 0.3)
place(music, ragtime(2.7, 60, 120), 20.53, 0.3)
# 23.2 to 26.57: none
place(music, rumble(2.0), 26.57, 0.5)
place(music, brass([midi(60), midi(64), midi(67)], 3.1), 28.6, 0.4)
place(music, brass([midi(60), midi(64), midi(67)], 2.5), 31.7, 0.5)
place(music, folk(120, 1.9), 34.2, 0.6)

place(sfx, steps(1.0, 1.5), 4.123, 0.8)
place(sfx, murmur(1.0), 6.547, 0.4)
place(sfx, click(0.1), 10.123, 0.5)
place(sfx, scrape(0.5), 11.475, 0.5)
place(sfx, thunk(60, 0.5), 15.491, 0.6)
place(sfx, click(0.1), 19.577, 0.5)
place(sfx, scrape(0.3), 21.784, 0.4)
place(sfx, snap(), 24.67, 0.6)
place(sfx, click(0.2), 26.211, 0.8)
place(sfx, noise(1.0), 27.314, 0.3)
place(sfx, ting(), 29.004, 0.7)
place(sfx, snap(), 32.092, 0.8)
place(sfx, cheer(1.5), 34.574, 0.7)

write_stems(music, sfx)
