# Generation prompts

Templates for everything Higgsfield generates. Fill the parts in `<angle brackets>`; keep the rest, because the fixed wording is what holds the style together from one asset to the next. Check model names and options with `models_explore` before the first call: catalogs change.

Contents: character · emotion sheet · textures · hero objects · background · voice · music

## Character

Image model: Nano Banana Pro, aspect 2:3, resolution 2k. One call per character. If the user has reference frames of the style, attach two or three as image references and start the prompt with "Exact same art style as the reference images (same character design language, same line weight, same shading)."

```
2D cartoon doodle character: a big round off-white head about as wide as the body, with a soft grey cel-shadow on one side, tiny solid black dot eyes, thick expressive black eyebrows, tiny simple line mouth, no nose, no ears; thick uniform black outline. Body is a soft rounded bean-shaped torso covered by simple flat-colored clothing with one soft shadow tone; arms are thin solid black stick lines ending in small round black dot hands, hanging relaxed at the sides slightly away from the torso; legs are two thin solid black stick lines with no trousers, no feet and no shoes drawn, coming straight out of the bottom of the torso, slightly apart. Clean vector lines, flat colors, no texture. Character asset: ONE character, full body, standing, front view, centered, whole figure visible from the top of the head to the tips of the stick legs, on a solid uniform light warm-grey backdrop; sharp focus everywhere, no environment, no fog, no blur, no gradient, no shadow on the floor. Character: <who they are, costume, hat, props, default expression>. No text, no labels, no captions, no extra characters, no color swatches.
```

Why the details matter:
- "head about as wide as the body" is the 1-to-2 proportion of this style. Realistic anatomy is the most common reason a character looks wrong.
- "arms ... slightly away from the torso" and "legs ... slightly apart" keep the limbs separable, so the puppet tool can cut them out.
- "no shadow on the floor" keeps the cutout clean. The stage adds the shadows.

Then remove the background (`remove_background` on the finished job) and download the cutout.

## Emotion sheet

Same model, aspect 3:2, 2k, with the character's finished image job as the image reference.

```
Emotion sheet for the exact same character as the reference image: SIX separate heads of this character (head with its hat only, cut off at the neck, no body, no shoulders), arranged in a clean grid of 3 columns and 2 rows with wide empty gaps between the heads so no two heads touch. Exact same art style, same line weight, same colors, same head size and hat in every cell, front view. Expressions, left to right, top row then bottom row: 1) happy, wide open smile; 2) nervous, sweat drop, wobbly mouth, worried eyebrows; 3) shocked, huge round eyes, open mouth; 4) shouting, wide open mouth, angry eyebrows; 5) confused, one eyebrow raised, small squiggle mouth; 6) neutral <the character's default look>. Solid uniform light warm-grey backdrop, no shadows on the backdrop, no text, no labels, no numbers, no frames, no grid lines.
```

A request for "six expressions" that lists only five gets the neutral face as the sixth. Other sets work the same way: keep six cells, change the list, and pass the same names in the same order to `puppet.py faces`.

Remove the background, download, then cut the sheet with `puppet.py faces`.

## Textures

Nano Banana Pro, aspect 1:1, resolution 1k, one call per surface. Ask for a flat, evenly lit, edge-to-edge pattern: perspective, shadows or objects in a texture show up as repeating artefacts once it tiles.

```
Seamless tileable texture, flat straight-on view, hand-painted comic style: <surface: e.g. "rounded warm grey-beige cobblestones of slightly different sizes with soft painted highlights, thin dark plum lines between the stones">, flat even lighting, no perspective, no cast shadows, no vignette, no objects, the pattern fills the whole frame edge to edge.
```

Surfaces that carry most sets: wood planks, stone or plaster walls, roof shingles, dirt or cobbled paths. Use plum-dark lines (`#271925`), not pure black.

## Hero objects (3D models)

For the few big props that need real volume: a windmill, a cart, a well.

Reliable route, two calls:
1. An image of the prop in the style (Nano Banana Pro, 1:1, 1k):
```
One stylized cartoon prop for a 3D animated game: <the object, its materials and colours>. Clean smooth shapes, soft even studio lighting, three-quarter view from slightly above, the whole object visible and centered with empty space around it, on a plain uniform light grey backdrop. No ground shadow, no people, no text, no other objects.
```
2. `generate_3d` with an image-to-3D model (for example `image_to_3d` with `should_texture: true`, `target_polycount` around 12000) and that image job as the `image` media.

Shortcut, one call: a text-to-3D model from `models_explore(type: '3d')`, with a low-poly option when it has one. It skips the style image, so the result matches the look less closely.

Download the GLB into `models/` and place it with a `model` prop; `height` scales it to the size you need.

## Background

One flat painting for the far distance. Nano Banana Pro, aspect 21:9, 2k.

```
Flat 2D painted backdrop for a cartoon, wide panorama: <sky and weather>, and along a low horizon in the bottom quarter <the distant scenery: hills, a hazy town, forest>, simple flat shapes, soft muted colours, gentle atmospheric haze, no people, no animals, no text, nothing in the foreground.
```

Keep the horizon low and the foreground empty: the stage wraps the painting around the world, blurs it and fades its top into the sky.

## Voice

`generate_audio`, speech model from the catalog (default `seed_audio`), with the user's own voice from `list_voices` (`voice_type: "element"`) or a preset. Paste the script as the prompt. Ask for English (US) output and check the result: a wrong language or accent is the first thing to rule out when timings look odd.

Delivery for this style: energetic, fast, punchy, about four words a second, no pauses between sentences. If the model takes a speed setting, raise it slightly instead of rewriting the script.

## Music

`generate_audio` with a music model from the catalog, instrumental, a few seconds longer than the voice track.

```
Minimal playful cartoon underscore: light pizzicato strings with a soft plucked bass, sneaky and curious, steady medium tempo, builds a little tension, no drums, no vocals, leaves room for a narrator.
```

The stage mixes it 18 dB under the voice and fades it out at the end.
