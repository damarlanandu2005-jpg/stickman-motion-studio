import os, sys
D = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(D, "audiolib.py")).read())
F = lambda f: f / 30
music = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32)

# --- music
# s1: curious mechanical rhythm
place(music, folk(100, F(55), 60), 0, 0.6)
# s2: steady rhythmic pulse
place(music, folk(100, F(136)-F(55), 60), F(55), 0.6)
# s3: chaotic strings
place(music, ragtime(F(213)-F(136), 65, 140), F(136), 0.6)
# s4: focused tone
place(music, folk(100, F(291)-F(213), 60), F(213), 0.6)
# s5: tension builds
place(music, rumble(F(427)-F(291)), F(291), 0.4)
# s6: steady beat
place(music, folk(100, F(543)-F(427), 60), F(427), 0.6)
# s7: steady mechanical beat
place(music, folk(100, F(678)-F(543), 60), F(543), 0.6)
# s8: playful pizzicato
place(music, ragtime(F(733)-F(678), 60, 100), F(678), 0.7)
# s9: steady patient rhythm
place(music, folk(100, F(896)-F(733), 60), F(733), 0.6)
# s10: warm chord swells
place(music, trombone_sad(F(947)-F(896)), F(896), 0.5)
# s11: resolute finish
place(music, folk(100, DUR-F(947), 60), F(947), 0.6)
place(music, ting(), DUR-1.0, 0.8)

# --- sfx
place(sfx, click(0.1), 1.37, 0.8) # tick
place(sfx, scrape(1.0), 2.73, 0.6) # winding
place(sfx, engine(2.0, 60), 6.0, 0.5) # whirring
place(sfx, click(0.1), 8.63, 0.8) # click
place(sfx, thunk(150, 0.2), 13.46, 0.8) # lock
place(sfx, whoosh(0.5), 14.59, 0.7) # whoosh
place(sfx, snap(), 21.3, 0.8) # clack
place(sfx, click(0.1), 22.6, 0.8) # tick
place(sfx, thunk(120, 0.15), 23.87, 0.8) # tock
place(sfx, click(0.1), 27.66, 0.6) # ticking
place(sfx, creak(0.6, 180), 31.06, 0.7) # creak
place(sfx, click(0.1), 33.12, 0.6) # ticking

write_stems(music, sfx)
