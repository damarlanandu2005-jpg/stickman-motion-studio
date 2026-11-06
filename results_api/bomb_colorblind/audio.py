import os, sys
D = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(D, "audiolib.py")).read())
F = lambda f: f / 30
music = np.zeros(N, np.float32); sfx = np.zeros(N, np.float32)

# Music
# s1-s3: curious/confident
place(music, folk(100, F(250)), 0, 0.4)
# s4-s11: tense electronic pulse
for i in range(int((F(796)-F(250))/0.5)):
    place(music, pluck(midi(45), 0.2, 0.8), F(250) + i*0.5, 0.3)
    if i % 4 == 0: place(music, pluck(midi(57), 0.4, 0.6), F(250) + i*0.5, 0.3)
# s12-s13: sustained suspense
place(music, brass([midi(45), midi(52)], F(917)-F(797)), F(797), 0.2)
# s14-s15: triumphant
place(music, ragtime(DUR - F(918), 60, 120), F(918), 0.6)

# SFX
place(sfx, thunk(80, 0.5), F(20), 0.6) # s1 hit
place(sfx, click(), F(100), 0.5) # s2 click
place(sfx, murmur(2.0), F(150), 0.3) # s3 radio/chatter
for i in range(3): place(sfx, ting(), F(260) + i, 0.4) # s4 beeps
place(sfx, scrape(1.0), F(350), 0.3) # s5 buzz
place(sfx, drum("kick"), F(450), 0.5) # s6 heartbeat
place(sfx, drum("kick"), F(475), 0.5)
place(sfx, click(), F(510), 0.4) # s7 tick
place(sfx, whoosh(0.5), F(560), 0.4) # s8 scan
place(sfx, whoosh(0.5), F(630), 0.4) # s9 trace
place(sfx, ting(), F(710), 0.6) # s10 warning
for i in range(3): place(sfx, ting(), F(772) + i*0.3, 0.8) # s11 loud beeps
place(sfx, noise(1.0), F(810), 0.1) # s12 static
place(sfx, bell(600, 1.0), F(870), 0.5) # s13 chime
place(sfx, click(), F(930), 0.6) # s14 final click
place(sfx, brass([midi(60), midi(64), midi(67)], 1.0), F(1000), 0.4) # s15 accent

write_stems(music, sfx)
