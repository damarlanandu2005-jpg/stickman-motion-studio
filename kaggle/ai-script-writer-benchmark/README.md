# AI Script-Writer Model Benchmark

A repeatable Kaggle benchmark for selecting a local open-weight language model for Stickman Motion Studio. It compares Qwen and Gemma on the same YouTube Short task. It does not call a paid inference API.

## What it tests
- Hook and narration for a 30–60 second Short.
- Factual claims that need source verification.
- Cast and continuity bible.
- 10–14 ordered scenes with narration, action, camera, expression, environment, lighting and detailed image prompts.
- JSON validity, runtime and peak GPU memory.

## Candidate models
1. Qwen/Qwen3-4B-Instruct-2507
2. google/gemma-3-4b-it

These are candidates, not a final decision. Verify each model's current licence, access terms and availability. Gemma may require accepting access terms. The notebook runs local inference; it does not imply unlimited free GPU sessions.

## Run on Kaggle
1. Open ai_script_model_benchmark.ipynb in Kaggle.
2. Select a GPU accelerator and enable Internet for model downloads.
3. Accept model access terms if prompted. Never paste access tokens into notebook cells.
4. Run all cells. Results are saved in /kaggle/working/stickman_script_benchmark/.
5. Manually review the outputs before selecting a model.

## Limitations
- No live research or fact verification is implemented; claims are flagged for a separate source-checking stage.
- This tests script-to-scene planning only. It does not generate images or call ComfyUI.
- No Kaggle execution is triggered automatically. Run the notebook manually.
- The structural score is not a creativity or factual-accuracy score.
