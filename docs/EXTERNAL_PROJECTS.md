# External project integrations

This repository integrates selected open-source projects as Git submodules. Upstream source remains in its original repository; this project owns the adapters, orchestration, configuration and integration tests. Submodules pin exact commits so upstream changes do not silently alter our pipeline.

## Add submodules (Windows PowerShell)

From the root of this repository, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\add-submodules.ps1
```

Then commit the changes:

```powershell
git status
git add .gitmodules external
git commit -m "Add external production pipeline submodules"
git push
```

For future clones:

```powershell
git clone https://github.com/damarlanandu2005-jpg/stickman-motion-studio.git
cd stickman-motion-studio
git submodule update --init --recursive
```

## Selected submodules

| Path | Upstream | Intended role |
|---|---|---|
| `external/ComfyUI` | https://github.com/comfyanonymous/ComfyUI | Image generation and compatible AI workflows |
| `external/2d-character-pipeline` | https://github.com/mor-o/comfyui-2d-character-pipeline | Experimental 2D character workflow |
| `external/OpenScript` | https://github.com/ishan-parihar/openscript | Editing/timeline reference |
| `external/4brospix` | https://github.com/koo-bros/4brospix | Experimental pipeline architecture |
| `external/automated-video-generator` | https://github.com/itsPremkumar/Automated-Video-Generator | Narration/caption/render reference |
| `external/yt-factcheck` | https://github.com/mickpletcher/yt-factcheck | MIT-licensed claim extraction, evidence retrieval, verdict and reporting reference |
| `external/FAcTScore` | https://github.com/shmsw25/FAcTScore | MIT-licensed atomic-fact decomposition and evidence-support scoring research implementation |

The two fact-checking repositories are pinned to reviewed upstream commits. We integrate their design and reusable components; we do not blindly run their entire applications inside the production pipeline. Their dependencies, prompts, model requirements and data licensing still need review before runtime adoption.

## Fact-checking implementation in this repository

`motion_studio/factcheck.py` is our small provider-neutral adapter layer:
- Wikipedia MediaWiki search/extract is available without an API key.
- Tavily and Brave search are optional adapters, enabled only when their environment keys are configured.
- Each atomic claim is checked against retrieved evidence by an injected verifier. Without a verifier, verdicts remain `needs_review`; retrieval alone never claims a fact is true.
- Rewrites are injected as a separate operation and must pass a second verification pass. Uncertain claims are not silently approved.
- Reports retain source URLs, titles, snippets and verdicts for review.

This first integration is a library and testable workflow foundation. It does not yet run automatically inside the Kaggle notebook or modify generated narration; that next integration requires a model verifier/rewriter wired to Qwen and configured search credentials.

## Tools not copied as source

Blender and FFmpeg are standalone toolchains; install compatible releases and invoke them through adapters rather than copying their full source trees.

## Important

- Submodules pin upstream commits; update them deliberately.
- MIT licensing was confirmed for yt-factcheck and FActScore at the pinned commits. Review all transitive dependencies and model/data licences separately.
- FactLens was reviewed as an architecture reference but not copied because its repository did not expose a confirmed open-source licence at inspection time.
- Do not commit model weights, generated videos, datasets, API keys or large assets.
- `yt-auto` is a separate reference-only repository. It is not modified or imported as a code dependency.
