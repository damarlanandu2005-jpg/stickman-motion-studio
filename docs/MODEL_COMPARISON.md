# Model comparison (Phase 4)

Every number below says where it came from. **Visual quality and character consistency have NOT been judged by anyone yet**:
the pictures from the klein run are in the GitHub Actions artifact `klein4b-benchmark-output` of run
[41291311167](https://github.com/damarlanandu2005-jpg/stickman-motion-studio/actions/runs/41291311167) and need a human look.

Source labels: **[measured]** by this repository's Kaggle runs, verified by the Kaggle execution manager;
**[owner notes]** recorded in the `yt-auto` repository (`CLAUDE.md`, `bench-results`), not re-measured here;
**[card]** model card fetched 2026-11-01; **[secondary]** a third-party web page, not verified against the licence text.

| | SD 1.5 (baseline) | FLUX.2 [klein] 4B | FLUX.2 [dev] 32B | Qwen-Image(-Edit) 20B |
|---|---|---|---|---|
| Time per picture (Kaggle T4) | 12.0 s at 512x512, 20 steps [measured, run 41285206537] | **23.6 s mean at 576x1024, 4 steps** (first picture 25.9 s incl. warm-up) [measured, run 41291311167] | ~336 s at 576x1024, 28 steps, 4-bit fp16 [owner notes] | ~19 min at 576x1024, 20 steps, 4-bit [owner notes, bf16 era; Lightning LoRA failed] |
| Peak VRAM | not recorded (old notebook measured the wrong process) | 7.75 GiB on GPU 0 with CPU offload [measured] | ~9.6 / 9.9 GiB across 2 GPUs [owner notes] | two GPUs, ~7.5 + 9.5 GiB limits [owner notes] |
| Peak RAM | not recorded | **24.4 GB process RSS** (Kaggle has ~31 GB) [measured] | not recorded | not recorded |
| Download size | 2.13 GB fp16 [earlier notebook] | **23.7 GB** (111.6 s) [measured] | large (bnb 4-bit build) [owner notes] | large [owner notes] |
| Kaggle fit | yes [measured] | yes, 1 GPU used [measured] | yes, needs both GPUs [owner notes] | yes, needs both GPUs, fragile [owner notes] |
| Style / consistency | not judged | **not judged yet** | "same stickman in every scene, rich flat-colour art" [owner notes] | "same stickman", flatter, much slower [owner notes] |
| Licence | CreativeML OpenRAIL-M (label from earlier notebook, not re-verified) | **Apache-2.0** [card] | FLUX Non-Commercial License [secondary]; licence text could not be retrieved | Apache-2.0 [card] |

## Recommendation (provisional)

1. **Use FLUX.2 [klein] 4B as the working model for Phase 5.** It is about 14x faster than dev on the same hardware and is Apache-2.0,
   which removes the commercial-use question. This is a *technical* conclusion only: it generated valid, non-flat pictures.
2. **It is only adopted if a human approves the pictures.** If klein's stickman is not good enough, FLUX.2 [dev] remains the quality reference,
   but its licence needs a proper read before commercial production use.
3. **Qwen-Image is parked:** it is Apache-2.0 but ~19 min per picture on this hardware per the owner's notes, which is not workable for a daily pipeline.
   It was not re-run here.

## Known limits of this comparison

- Only text-to-image klein was tested. Character consistency via reference images or editing was **not** tested; that is Phase 5.
- Peak RAM of 24.4 GB leaves little headroom on Kaggle; a second model in the same session would not fit.
- The 23.7 GB download counts against Kaggle disk and takes about two minutes each session unless cached.
- FLUX.2 [dev] and Qwen numbers come from a different codebase's runs and settings, so they are indicative, not a controlled comparison.
