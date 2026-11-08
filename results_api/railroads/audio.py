import os, sys
D = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(D, "audiolib.py")).read())
F = lambda f: f / 30
music = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32)

# --- Music
beat = 60 / 110
t = 0.0
# s1: rhythmic mechanical beat
while t < F(90):
    place(music, drum("kick"), t, 0.5)
    place(music, pluck(midi(48), 0.2, 0.4), t, 0.3)
    t += beat
# s2: grand orchestral swell
place(music, brass([midi(60), midi(64), midi(67)], 4.0), F(90), 0.3)
# s3: competitive upbeat tempo
t = F(219)
while t < F(298):
    place(music, drum("snare"), t, 0.3)
    place(music, pluck(midi(60), 0.2, 0.6), t, 0.4)
    t += beat / 2
# s4: determined steady rhythm
t = F(298)
while t < F(353):
    place(music, drum("kick"), t, 0.4)
    place(music, pluck(midi(55), 0.3, 0.5), t, 0.3)
    t += beat
# s5: sudden comedic halt
# s6: tense silence
# s7: stubborn drum beat
t = F(525)
while t < F(577):
    place(music, drum("kick"), t, 0.6)
    t += beat
# s8: triumphant brass
place(music, brass([midi(60), midi(64), midi(67), midi(72)], 3.0), F(577), 0.4)
# s9: smooth sweeping strings
place(music, brass([midi(65), midi(69), midi(72)], 2.0), F(692), 0.2)
# s10: bumpy chaotic rhythm
t = F(748)
while t < F(824):
    place(music, drum("snare"), t, 0.4)
    place(music, pluck(midi(45), 0.1, 0.8), t, 0.4)
    t += beat / 3
# s11: ragtime piano tune
place(music, ragtime(F(897) - F(824), 60, 120), F(824), 0.6)
# s12: busy cheerful melody
place(music, folk(120, F(956) - F(897)), F(897), 0.5)
# s13: mysterious shift in tone
place(music, brass([midi(55), midi(58), midi(62)], 2.0), F(956), 0.2)
# s14: slow building tension
t = F(1024)
while t < F(1077):
    place(music, pluck(midi(50 + int((t-F(1024))*10)), 0.2, 0.5), t, 0.3)
    t += beat / 2
# s15: curious ticking
t = F(1077)
while t < F(1139):
    place(music, click(), t, 0.5)
    t += beat / 2
# s16: happy upbeat chord
place(music, brass([midi(60), midi(64), midi(67)], 1.5), F(1139), 0.3)
# s17: playful pause
# s18: dark ominous drone
place(music, brass([midi(40), midi(43), midi(47)], 4.0), F(1264), 0.3)
# s19: fast ticking suspense
t = F(1358)
while t < F(1419):
    place(music, click(), t, 0.6)
    t += beat / 4
# s20: climactic build
place(music, brass([midi(50), midi(54), midi(57)], 2.0), F(1419), 0.4)
# s21: sudden silence
# s22: loud chaotic strike
place(music, sting(), F(1549), 0.6)
# s23: dramatic tragic finale
place(music, brass([midi(45), midi(48), midi(51)], 2.0), F(1656), 0.5)

# --- SFX
place(sfx, scrape(1.0), F(5), 0.5) # s1: metal sawing
place(sfx, whoosh(2.0), F(164), 0.6) # s2: wind howling
place(sfx, ting(), F(267), 0.6) # s3: cash register ding
place(sfx, scrape(0.5), F(317), 0.4) # s4: pencil scratching
place(sfx, honk(400, 0.5), F(461), 0.6) # s5: cartoon steam whistle
place(sfx, roar(1.0), F(490), 0.7) # s6: loud booming voice
place(sfx, thunk(100, 0.5), F(540), 0.7) # s7: heavy metal clank
place(sfx, ting(), F(647), 0.5) # s8: smooth sliding chime
place(sfx, whoosh(1.0), F(701), 0.5) # s9: gentle wind swoosh
place(sfx, hammer(0.2), F(766), 0.6) # s10: loud metallic clack
place(sfx, leaves(0.5), F(829), 0.5) # s11: paper rustling
place(sfx, murmur(1.5), F(902), 0.5) # s12: crowd murmuring
place(sfx, water(1.0), F(960), 0.4) # s13: subtle heat sizzle
place(sfx, creak(1.0, 100), F(1042), 0.5) # s14: metal groaning softly
place(sfx, ting(), F(1096), 0.5) # s15: coin ting
place(sfx, scrape(0.5), F(1166), 0.4) # s16: paper slide
place(sfx, murmur(0.5), F(1249), 0.4) # s17: smug chuckle
place(sfx, creak(1.5, 80), F(1322), 0.6) # s18: heavy metal creaking
place(sfx, scrape(1.0), F(1358), 0.5) # s19: high pitched metal strain
place(sfx, whoosh(1.5), F(1428), 0.6) # s20: desert wind
place(sfx, thunk(80, 0.5), F(1498), 0.7) # s21: solid metal thud
place(sfx, snap(), F(1616), 0.8) # s22: violent metal snap
place(sfx, crash(1.5), F(1678), 0.8) # s23: massive crash

write_stems(music, sfx)
