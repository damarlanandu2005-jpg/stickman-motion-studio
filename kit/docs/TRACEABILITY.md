# TRACEABILITY: which rule is really used (generated from kit/reference/knowledge/traceability.json by kit/tools/build_trace.py; do not edit by hand)

No row has render_code_reads_rule = true: nothing in the renderer reads rules.json or beats.json. "Gemini consumes" means PLAYBOOK.md is part of the gen_api.py prompt (code step). The shot-planning step (tools/make_notes.py) does NOT receive the PLAYBOOK, only FORMAT.md, TEMPLATE.txt and one example. Whether Gemini obeys a rule in its output is untested.

## Summary
- rules: 84 (69 measured/observed before 2026-11-08, 15 added from the independent study)
- state: code-integrated 30, code-project-only 8, prompt-only 46, documentation-only 0  (the gaps are listed as unimplemented capabilities below)
- production test: none 55, in_range 7, partial 16, failed 5, passed 1
- render code that reads rules.json or beats.json: none (checked by this tool)

## States

- **code-integrated**: a capability exists in kit/engine or kit/tools that a new project gets without hand work (the choice to use it is still made by hand or by Gemini)
- **code-project-only**: implemented only inside the project copies mine/bomb_colorblind_v22 and mine/railroads_v2; a new Gemini project does NOT get it
- **prompt-only**: the rule text reaches Gemini through PLAYBOOK.md (tools/gen_api.py code step) or FORMAT.md, but no render code implements it
- **documentation-only**: only in docs or the learning log, not in any prompt (none left after the playbook update)
- **unimplemented**: listed under unimplemented_capabilities: a part of a rule that no code, prompt or check covers

## Four levels of maturity (kept separate on purpose)

1. **capability_exists**: code exists that can do it when something tells it to (kit/engine, kit/tools, or only a project copy: see state)
2. **automatically_selected**: a planner or selector chooses it from the narration, the beat plan or the rules without a person or Gemini writing the choice by hand (Step 2B: kit/tools/shot_selector.py does this for the shot recipe only, in the planning stage; camera moves, materials and acting are still written by Gemini)
3. **consumed_by_renderer**: the render code reads rule or plan DATA (rules.json, beats.json) and acts on it; today it only reads story.js written per project
4. **tested**: production_test status: in a real video, measured (not a claim that the system knows when to use it)

## Capabilities that are easy to confuse

| id | what | exists | where | auto-selected | consumed by renderer | tested | note |
|---|---|---|---|---|---|---|---|
| CAP-3D-FLIGHT | real 3D camera flight inside a scene (position, look-at, fov, ease, via-points) | yes | kit/engine | no | no | in_range | keys are written by hand or by Gemini in story.js |
| CAP-BLEND | cross-blend of two rendered scenes (dissolve, and the kind called fly, which runs the same code) | yes | project copies only | no | no | partial | a visual blend, not a camera travelling through geometry |
| CAP-FLY-THROUGH | scene change where the camera passes through geometry into the next place on one continuous 3D path | NO | - | no | no | none | not implemented anywhere; the validator warns if a plan asks for transition type fly_through |
| CAP-HARD-CUT | hard cut between scenes | yes | kit/engine | no | no | in_range | default behaviour at a shot boundary |
| CAP-CAMERA-KICK | impact camera kick | yes | kit/engine | no | no | in_range | frames listed by hand in story.js KICKS |
| CAP-SHOT-SELECTOR | chooses the shot recipe per beat from intent, assets, action, continuity, variety, camera purpose and renderer capabilities, and records why | yes | kit/tools (planning stage) | yes | no | partial | runs in the Gemini workflow when input beats=true; its decisions reach Gemini's code-writing prompt (checked with a dry run), not the render code. Tested by unit tests and on two real plans; not tested in a finished video. Does not move the camera. |
| CAP-PLAN-VALIDATOR | schema + automatic gate checks on a beat plan (names, ids, words, camera purpose vs mode, nouns in frame, physical events, pacing, hard cuts) | yes | kit/tools (planning stage) | yes | no | partial | gates make_beats.py retries; heuristic tables (purpose vs mode) are not measured values |
| CAP-PLAN-PREVIEW | phone-width storyboard sheets drawn from the plan + automatic/AI-assisted/human check list; with real stills it shows them and runs pixel checks | yes | kit/tools (planning stage) | yes | no | partial | plan tiles are NOT renders. AI-assisted checks are listed, not run. No real stills have been checked with it yet. |

## Rule table

| id | area | source | state | coverage | where / code | Gemini (code step / notes step) | 1 exists | 2 auto-selected | 3 consumed by renderer | 4 tested | what is missing |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CAM-01 | camera | measured/measured | prompt-only | none | - | playbook / no | no | no | no | partial | The mix of holds and flights is a RESULT of the camera keys in story.js; nothing plans it. Measured after ren... |
| CAM-02 | camera | measured/measured | code-integrated | partial | engine/motion.js:camFromKeys | playbook / no | yes | no | no | in_range | no planner decides when a flight starts or how long it is; keys are written by hand or by Gemini |
| CAM-03 | camera | measured/measured | code-integrated | partial | engine/motion.js:camFromKeys; engine/main.js:LK.push | playbook / no | yes | no | no | in_range | camFromKeys adds a slow push-in during holds by default (creep 0.0012); the two hand-made videos pass creep:... |
| CAM-04 | camera | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none | Reveal flights are authored per scene (railroads_v2 c5, c11). |
| CAM-05 | camera | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none | Land-on-prop is authored by hand with easeOut keys. |
| CAM-06 | camera | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none |  |
| CAM-07 | camera | observed/observed | code-integrated | partial | engine/motion.js:camFromKeys | playbook / no | yes | no | no | none | follow targets are keyed by hand; no tracking of a moving actor |
| CAM-08 | camera | observed/observed | prompt-only | none | - | playbook / format_partial | no | no | no | none |  |
| CAM-09 | camera | measured/measured | code-integrated | full | engine/motion.js:M = { | playbook / no | yes | no | no | in_range | Ease functions smooth/easeOut/easeIn/back/anticip/spring exist; which one a flight uses is chosen by hand. |
| CAM-10 | camera | measured/measured | prompt-only | none | - | playbook / no | no | no | no | failed | Nothing checks that moves differ between beats (validate_beats.py warns on the plan only). |
| CAM-11 | camera | observed/observed | prompt-only | none | - | playbook / format_partial | no | no | no | none | FORMAT.md gives near/mid/far distances; shot size as a language is not enforced. |
| CAM-12 | camera | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none | Soft foreground objects are built by hand; the blur itself is CAM-15. |
| CUT-01 | cuts | measured/measured | prompt-only | none | - | playbook / no | no | no | no | in_range |  |
| TRN-01 | transition | measured/measured | code-project-only | partial | mine/railroads_v2/web/main.js:window.snap; mine/bomb_colorblind_v22/web/main.js:window.snap | playbook / no | yes | no | no | partial | NOT a true fly-through: in snap() the kinds dissolve and fly run the same alpha cross-blend of two rendered s... |
| TRN-02 | transition | observed/observed | code-project-only | full | mine/railroads_v2/web/main.js:window.snap; mine/bomb_colorblind_v22/web/main.js:window.snap | playbook / no | yes | no | no | partial | ghost of the old picture is a plain alpha blend |
| TRN-03 | transition | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none | round-mask transitions do not exist in any code |
| TRN-04 | transition | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none | smoke/cloud wipe does not exist in any code |
| END-01 | structure | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none |  |
| LIT-01 | light | measured/measured | code-integrated | partial | tools/gen_api.py:def stills | playbook / no | yes | no | no | none | gen_api flags black/flat stills only; brightness range 0.30-0.54 is not enforced |
| LIT-02 | light | observed/observed | code-integrated | partial | engine/main.js:function applyLight | playbook / no | yes | no | no | none | one light preset per place (LIGHTS in story.js); warm-against-cool is chosen by hand |
| LIT-03 | light | observed/observed | code-integrated | partial | engine/main.js:function applyLight | playbook / no | yes | no | no | partial | grade can change per scene via lightFor(); the change at the emotional turn is chosen by hand |
| LIT-04 | light | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none | no bloom, god rays or sun glare pass exists in the renderer |
| COL-01 | colour | measured/measured | code-integrated | partial | tools/gen_api.py:REFS | playbook / no | yes | no | no | failed | gen_api measures palette/edge/saturation of stills against reference ranges and sets LOOK.sat automatically (... |
| WLD-01 | world | observed/observed | prompt-only | none | - | playbook / format_partial | no | no | no | none | FORMAT.md asks for 3 landmarks per place; 6-10 pieces and one hero object are not enforced. gen_api asset rou... |
| WLD-02 | world | observed/observed | code-integrated | partial | engine/paint.js:export | playbook / no | yes | no | no | none | texture painters exist as a library; their use is hand-built per project (railroads_v2 added sand, gravel, st... |
| WLD-03 | world | observed/observed | code-integrated | partial | engine/main.js:dofU | playbook / no | yes | no | no | none | fog and depth of field exist; the three layers are built by hand |
| WLD-04 | world | observed/observed | code-integrated | partial | engine/main.js:inkU | playbook / no | yes | no | no | partial | ink outline shader exists; width parameter LK.ink is read only in the project copies |
| WLD-05 | world | observed/observed | code-integrated | full | engine/roman.js:export const crowd | playbook / format | yes | no | no | none | FORMAT.md: crowd of more than 6 is background only. |
| CHR-01 | character | observed/observed | code-integrated | partial | engine/roman.js:export const romanFront | playbook / no | yes | no | no | failed | head size in frame is below the reference (0.10-0.12 vs 0.12-0.21); no parameter pushes it |
| CHR-02 | character | observed/observed | code-integrated | full | engine/roman.js:export const OUTFITS | playbook / format | yes | no | no | partial | FORMAT.md lists outfits and hats; new ones go to cast.js. |
| CHR-03 | character | observed/observed | code-integrated | partial | engine/main.js:function drawActors | playbook / no | yes | no | no | none | skin tint by light and contact shadow exist; strength not tuned per place |
| CHR-04 | character | observed/observed | code-integrated | partial | engine/roman.js:export const romanFront | playbook / format | yes | no | no | none | arm poses exist (spear, point, hip, ...); no crouch, kneel, run, lie, salute |
| FAC-01 | face | observed/observed | code-integrated | partial | engine/roman.js:FACE | playbook / format | yes | no | no | none | one face name per beat; no separate brow, pupil, mouth channels |
| FAC-02 | face | observed/observed | code-integrated | full | engine/roman.js:sweat2; engine/roman.js:spiral | playbook / format | yes | no | no | none | Face extras sweat, tears, vein, spiral, blush, sparkle, iris, zzz exist. Purple head comes from a skin overri... |
| PRP-01 | props | observed/observed | prompt-only | none | - | playbook / format_partial | no | no | no | none | FORMAT.md NEW OBJECTS asks for text on props only by example. |
| PRP-02 | props | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none | CHK-07 (noun appears within 0.3 s of the word) is manual; no program checks it. |
| PRP-03 | props | observed/observed | prompt-only | none | - | playbook / format_partial | no | no | no | none | FORMAT.md: numbers on screen stay consistent; the counter itself is coded by hand. |
| PRP-04 | props | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none |  |
| PRP-05 | props | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none |  |
| FX-01 | fx | observed/observed | code-integrated | partial | engine/motion.js:anticip; engine/motion.js:spring | playbook / no | yes | no | no | none | easing helpers only; anticipation of a body is animated by hand |
| FX-02 | fx | observed/observed | code-integrated | partial | engine/roman.js:export const fxDebris; engine/roman.js:export const fxRings | playbook / no | yes | no | no | partial | no ready starburst of 2-3 layers; debris and rings exist |
| FX-03 | fx | observed/observed | code-integrated | full | engine/roman.js:export const fxSpeed | playbook / no | yes | no | no | none |  |
| FX-04 | fx | observed/observed | code-integrated | full | engine/roman.js:export const fxMotes; engine/roman.js:export const fxSmoke | playbook / no | yes | no | no | partial |  |
| PHY-01 | physics | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none |  |
| PHY-02 | physics | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none |  |
| SCR-01 | script | observed/observed | prompt-only | none | - | playbook / format | no | no | no | none | FORMAT.md: one shot = one or two sentences, one place, one camera move. |
| SCR-02 | script | observed/observed | prompt-only | none | - | playbook / format | no | no | no | none | MUST SEE lines name every important noun; gen_api shot phase asks Gemini to compare stills with them (AI chec... |
| SCR-03 | script | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none |  |
| SCR-04 | script | observed/observed | prompt-only | none | - | playbook / format_partial | no | no | no | none | FORMAT.md gives the order hook > setup > incident > escalation > resolution > twist. |
| CAP-01 | captions | observed/observed | code-project-only | partial | mine/railroads_v2/web/main.js:WORDS; mine/bomb_colorblind_v22/web/main.js:WORDS | playbook / no | yes | no | no | partial | captions are drawn by the project main.js from words.js; not in kit/engine; tools/gen_api.py SYSTEM prompt te... |
| SND-01 | sound | measured/measured | code-integrated | full | kit/tools/finish.sh:loudnorm=I=-14 | playbook / no | yes | no | no | passed |  |
| CUT-02 | cuts | measured/measured | prompt-only | none | - | playbook / no | no | no | no | partial |  |
| CUT-03 | cuts | measured/measured | prompt-only | none | - | playbook / no | no | no | no | in_range |  |
| TRN-05 | transition | measured/measured | code-project-only | partial | mine/railroads_v2/web/main.js:window.snap | playbook / no | yes | no | no | partial | its "fly-through" share is produced only by cross-blends here, not by real 3D pass-throughs |
| CAM-13 | camera | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none |  |
| WLD-06 | world | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none |  |
| PRF-01 | profile | measured/measured | code-integrated | partial | tools/gen_api.py:REFS | playbook / no | yes | no | no | none | only saturation, palette and detail are compared; scene pace and parallax are not enforced |
| PRF-02 | profile | inferred/inferred | prompt-only | none | - | playbook / no | no | no | no | none |  |
| PRF-03 | profile | inferred/inferred | prompt-only | none | - | playbook / no | no | no | no | none |  |
| PRF-04 | profile | observed/observed | prompt-only | none | - | playbook / no | no | no | no | none |  |
| TRN-06 | transition | measured/measured | code-project-only | partial | mine/railroads_v2/web/main.js:STORY.TRANS | playbook / no | yes | no | no | partial | the mix is written by hand in story.js TRANS; no scheduler |
| CAM-14 | camera | measured/measured | code-integrated | partial | engine/motion.js:easeOut | playbook / no | yes | no | no | in_range | easeOut gives a quick attack and soft release; the exact 0.28 s / 0.47 s shape is not parameterised. |
| CAM-15 | camera | measured/measured | code-integrated | partial | engine/main.js:dofU; mine/bomb_colorblind_v22/web/story.js:dofAt | playbook / no | yes | no | no | partial | depth-of-field amount is chosen per shot by hand in dofAt (cinf map) |
| CHR-05 | character | measured/measured | code-project-only | partial | mine/bomb_colorblind_v22/web/main.js:LK.ink; mine/railroads_v2/web/main.js:LK.ink | playbook / no | yes | no | no | partial |  |
| COL-02 | colour | measured/measured | code-project-only | partial | mine/bomb_colorblind_v22/web/main.js:grain; mine/railroads_v2/web/main.js:grain | playbook / no | yes | no | no | failed | grain and a top-to-bottom gradient exist in the ink shader of the two project copies only; surfaces still rea... |
| COL-03 | colour | measured/measured | prompt-only | none | - | playbook / no | no | no | no | failed |  |
| CAP-02 | captions | measured/measured | code-project-only | partial | mine/railroads_v2/web/main.js:WORDS; mine/bomb_colorblind_v22/web/main.js:WORDS | playbook / no | yes | no | no | partial | same as CAP-01 |
| FX-05 | fx | inferred/inferred | code-integrated | full | engine/motion.js:kicks | playbook / no | yes | no | no | in_range |  |
| SND-02 | sound | measured/measured | prompt-only | none | - | playbook / no | no | no | no | none | A property of the references (no snapping to voice onsets), not a feature. |
| SCR-05 | script | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW (Step 1). intent field in beat schema; Gemini reads BEATS.md only if beats.json exists (tools/make_beats.... |
| CAM-16 | camera | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW. Schema field camera.purpose + validator Q03 exist (Step 1). Nothing in story.js or Gemini output carries... |
| CMP-01 | composition | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW (Step 1). composition object in beat schema; validate_beats.py Q02 warns if the focal point is inside the... |
| CON-01 | continuity | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW (Step 1). identity_lock and continuity_change in beat schema; validate_beats.py checks ids; nothing check... |
| ACT-01 | acting | chatgpt/designed | code-integrated | partial | engine/motion.js:export const idle; engine/motion.js:blinkAt; engine/motion.js:anticip | playbook / no | yes | no | no | none | no gaze-leads-hand, no contact/response phases; one face channel only |
| PHY-03 | physics | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW (Step 1). object_events with contact target and secondary effects in the schema; validate_beats.py Q05 wa... |
| PHY-04 | physics | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW (Step 1). motion_profile in the schema; no code |
| MAT-01 | materials | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW (Step 1). material_ids in the schema; validate_beats.py checks they exist; no material library in the kit |
| MAT-02 | materials | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW (Step 1). no field; documentation for authors |
| LIT-05 | light | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW (Step 1). no field; applyLight gives one sun per place but the key side is not checked |
| LIT-06 | light | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW (Step 1). no field; fxGlow exists as a building block |
| SND-03 | sound | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW (Step 1). audio_events in the schema; validate_beats.py Q09 checks triggers; audio.py is still written by... |
| QC-01 | qc | chatgpt/designed | code-integrated | partial | tools/gen_api.py:def stills; tools/gen_api.py:def asset_round; kit/tools/frame_qa.py:contact sheets | playbook / no | yes | no | no | partial | Gemini projects only: 3 stills per shot with brightness/flatness metrics and a Gemini PASS/FAIL against MUST... |
| ADP-01 | adapt | chatgpt/designed | prompt-only | none | - | playbook / no | no | no | no | none | NEW (Step 1). no code |
| ARC-01 | architecture | chatgpt/designed | code-integrated | partial | engine/roman.js:export const romanFront; engine/main.js:function drawActors | playbook / no | yes | no | no | none | the choice per object is made by hand |

## Test evidence (only rules with a test result)

- CAM-01 [partial]: bomb_v22 and railroads_v2: flights per minute inside the reference range; the share of time moving fast was not reported
- CAM-02 [in_range]: bomb_v22: flights/min, length, pause in range; railroads_v2: flights 15.9/min, pause 1.35 s in range
- CAM-03 [in_range]: bomb_v22 and railroads_v2: zoom-only shots 0 %
- CAM-09 [in_range]: bomb_v22: ramp-up and ramp-down times in range
- CAM-10 [failed]: railroads_v2: repeat-move share 0.71 (reference lower)
- CUT-01 [in_range]: bomb_v22 13 hard cuts/min; railroads_v2 7.4 (reference 1.8-14.6)
- TRN-01 [partial]: bomb_v22 and railroads_v2 use STORY.TRANS fly; classifier cannot tell fly-through from dissolve reliably
- TRN-02 [partial]: used in both videos; type shares not independently verified
- LIT-03 [partial]: railroads_v2 uses golden light from c11 (summer)
- COL-01 [failed]: bomb_v22 palette 27 (refs 32-45)
- WLD-04 [partial]: line width 3.2 in range in bomb_v22; railroads_v2 0.0047 low
- CHR-01 [failed]: bomb_v22 head 0.116; railroads_v2 0.102 (refs 0.12-0.21)
- CHR-02 [partial]: railroads_v2 uses outfit overrides via ov helper
- FX-02 [partial]: railroads_v2 c19 uses debris and dust
- FX-04 [partial]: motes and smoke used in railroads_v2
- CAP-01 [partial]: bomb_v22 pop in range; railroads_v2 3.5 words/s high, stay 0.2 s low
- SND-01 [passed]: runs on every render; finish.sh prints the loudness (not asserted)
- CUT-02 [partial]: bomb_v22 20 scene changes/min in range; railroads_v2 18 slightly low and scene length 3.0 s high
- CUT-03 [in_range]: hard cuts inside a scene low in both hand-made videos (v1 Gemini: 19/min)
- TRN-05 [partial]: mix applied by hand in STORY.TRANS of both videos
- TRN-06 [partial]: railroads_v2: 9 dissolve, 4 fly, 5 hard cut of 18
- CAM-14 [in_range]: bomb_v22: ramp times in range
- CAM-15 [partial]: railroads_v2 soft-edge share 36 % in range; bomb_v22 10 % outside (reference 24-61 %)
- CHR-05 [partial]: bomb_v22 in range; railroads_v2 low
- COL-02 [failed]: bomb_v22 flat 55 %, gradient 7 %; railroads_v2 flat 49 %, gradient 10.5 % (reference flat 35-48, gradient 14-20)
- COL-03 [failed]: railroads_v2 warm share 0.87, cool 0
- CAP-02 [partial]: as CAP-01
- FX-05 [in_range]: bomb_v22 and railroads_v2: shake per minute and decay in range
- QC-01 [partial]: ran inside the Gemini runs for bomb and railroads (results_api/*/qa files); pass/fail accuracy not verified

## Unimplemented capabilities (no code, no prompt text that does it, no check)

- round-mask transition (spyglass, window, closing circle) (rules: TRN-03)
- smoke / cloud wipe transition (rules: TRN-04)
- bloom, god rays, sun glare pass (rules: LIT-04)
- head size parameter that reaches 0.12-0.21 of frame height (rules: CHR-01)
- separate brow, pupil and mouth channels; gaze leads the hand (rules: FAC-01, ACT-01)
- poses: crouch, kneel, run, lie, salute (rules: CHR-04)
- physics: cause chain, motion profiles (only hand-made fx cards) (rules: PHY-03, PHY-04)
- material library (wood, metal, stone, water, foliage, glass) in kit/engine (rules: MAT-01)
- camera planner that picks flights from purpose (rules: CAM-16, CAM-02, CAM-04..08)
- transition scheduler that mixes dissolve / fly / cut by TRN-06 (rules: TRN-06)
- caption module in kit/engine (today only in two project copies) (rules: CAP-01, CAP-02)
- shot-recipe selector that reads intent (rules: SCR-05)
- pre-render gates Q01-Q10 on preview frames (rules: QC-01)
- a loader that makes the render code read rules.json or beats.json (rules: all)
- noun-within-0.3-s-of-word check (rules: PRP-02)
- identity check across rendered frames (rules: CON-01)
- Kaggle GPU path wired to the Gemini pipeline (speed test only) (rules: -)

## Quality gates: which checks are automatic, AI-assisted or human

| gate | check | class | where it is implemented |
|---|---|---|---|
| Q01 Character identity | character ids, outfit, hat and identity_lock are the same in every beat | automatic | validate_beats.py (implemented) |
| Q01 Character identity | head, face, costume look the same across the preview frames | ai_assisted | not implemented (step 2) |
| Q01 Character identity | final approval of the look | human | - |
| Q02 Composition | the focal point is not inside the caption clear zone (warning); the zone defaults to the measured caption band | automatic | validate_beats.py (implemented) |
| Q02 Composition | hero object and action readable at phone size in the preview frames | ai_assisted | existing, partly: tools/gen_api.py shot phase (Gemini PASS/FAIL on 3 stills per shot against MUST SEE / MUST NOT, Gemini projects only); not run on beats; accuracy untested |
| Q02 Composition | does the picture say what the words say | human | - |
| Q03 Camera intent | every beat has a camera purpose and mode; a move has duration, ease and from/to; a hold has a rationale | automatic | validate_beats.py (implemented) |
| Q03 Camera intent | the move helps the story | human | - |
| Q04 Narration match | beat words joined equal the narration; word ranges cover all words in order; beat times follow the word times | automatic | validate_beats.py (implemented); make_notes.py checks the words for the shot notes |
| Q04 Narration match | each named noun is visible within 0.3 s of its word (CHK-07) | ai_assisted | existing, partly: tools/gen_api.py shot phase (Gemini PASS/FAIL on 3 stills per shot against MUST SEE / MUST NOT, Gemini projects only); not run on beats; accuracy untested |
| Q05 Physics causality | physical events name a contact target and fitting secondary effects | automatic | validate_beats.py (implemented, warnings) |
| Q05 Physics causality | the motion looks causal and has weight | human | - |
| Q06 Environment depth | every environment declares foreground, midground, background | automatic | validate_beats.py (implemented, warnings) |
| Q06 Environment depth | parallax and soft-edge share on rendered frames | automatic | existing, after rendering: kit/tools/ref_study.py compare, ref_look.py |
| Q07 Material readability | every declared material id exists in material_recipes | automatic | validate_beats.py (implemented, warnings) |
| Q07 Material readability | the surface reads as that material in the preview | ai_assisted | existing, partly: tools/gen_api.py shot phase (Gemini PASS/FAIL on 3 stills per shot against MUST SEE / MUST NOT, Gemini projects only); not run on beats; accuracy untested |
| Q08 Edit purpose | every beat has a transition type and reason (frames for dissolve, fly-through, flash); hard cuts at most 45 % of scene changes (CHK-11) and at least one dissolve (warnings) | automatic | validate_beats.py (implemented, warnings) |
| Q08 Edit purpose | each cut is on a meaning beat | human | - |
| Q09 Audio events | audio events have a valid trigger and fall inside the beat; word triggers point at real words | automatic | validate_beats.py (implemented) |
| Q09 Audio events | mix level and loudness | automatic | existing, after rendering: kit/tools/mix.py, finish.sh |
| Q09 Audio events | sound quality and taste | human | - |
| Q10 Render preflight | all ids resolve; every required asset is declared; beats cover the whole video without gaps or overlaps | automatic | validate_beats.py (implemented) |
| Q10 Render preflight | a build check of the real code (assets render, no errors) | automatic | existing: tools/gen_api.py asset phase (each builder rendered alone, size and look checked by Gemini; Gemini projects only) |

## Contradictions found

- tools/gen_api.py SYSTEM says "No captions" while CAP-01/CAP-02 want one-word captions (captions are drawn by the project main.js, not by Gemini, so output is unaffected today)
- caption position: ChatGPT/other says safe zone y 0.78-0.95; decision: keep ours
- camera hold default: ChatGPT/other says hold unless purposeful (summary: "holding is often better"); decision: CAM-16: purpose first, no default either way
- Gemini prompt vs captions: ChatGPT/other says tools/gen_api.py SYSTEM says "no captions" while CAP-01/CAP-02 want one-word captions; decision: not changed in step 1 (captions are drawn by the engine copy from words, not by Gemini); noted in the traceability file
