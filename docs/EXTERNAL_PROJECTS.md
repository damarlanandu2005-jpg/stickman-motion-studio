# External project integrations

This repository integrates selected open-source projects as Git submodules. They remain separate upstream repositories; this project owns only the adapters, orchestration, configuration, and integration tests.

## Add submodules (Windows PowerShell)

From the root of this repository, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\add-submodules.ps1
```

Then review the changes and commit them:

```powershell
git status
git add .gitmodules external
git commit -m "Add external production pipeline submodules"
git push
```

For future fresh clones:

```powershell
git clone https://github.com/damarlanandu2005-jpg/stickman-motion-studio.git
cd stickman-motion-studio
git submodule update --init --recursive
```

## Selected submodules

| Path | Upstream | Intended role |
|---|---|---|
| `external/ComfyUI` | https://github.com/comfyanonymous/ComfyUI | Image generation and compatible AI workflows |
| `external/2d-character-pipeline` | https://github.com/mor-o/comfyui-2d-character-pipeline | Experimental 2D character workflow; verify GPU memory needs |
| `external/OpenScript` | https://github.com/ishan-parihar/openscript | Evaluate reusable editing/timeline components |
| `external/4brospix` | https://github.com/koo-bros/4brospix | Experimental pipeline architecture reference |
| `external/automated-video-generator` | https://github.com/itsPremkumar/Automated-Video-Generator | Evaluate reusable narration/caption/render components |

## Tools deliberately not cloned as source submodules

Blender and FFmpeg are large standalone applications/toolchains. We should install compatible prebuilt releases on the workstation/Kaggle environment and invoke them through adapters, rather than embedding their entire source trees in this repository.

- Blender: https://www.blender.org/
- FFmpeg: https://ffmpeg.org/

## Important

- Submodules pin an upstream commit; updating them is an explicit operation.
- Review each upstream license and any model/workflow licenses before commercial use.
- Do not put model weights, generated videos, datasets, API keys, or large assets in Git.
- The old `yt-auto` repository is not referenced or modified by this setup.
