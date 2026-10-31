# External projects

External repositories are research candidates and optional tools, not runtime dependencies. Code, model weights, LoRAs, datasets, fonts, music and SFX retain their own licences and terms.

| Project | Intended use | Decision |
|---|---|---|
| ComfyUI | Image generation/workflow execution | Optional core engine |
| comfyui-2d-character-pipeline | Layered sprite sheets | Research only; upstream documents 24 GB VRAM, 32 GB RAM and ~120 GB disk |
| 4brospix | Manifest-driven animation workflow ideas | Study architecture; upstream labels experimental |
| OpenScript | Raw-footage editing | Optional; not an animation generator |
| Automated Video Generator | TTS/Remotion assembly ideas | Reuse concepts selectively; stock-footage-first output is not our target |

## OpenScript nested dependency
The current checkout references third_party/PupCaps as a gitlink but has no .gitmodules mapping. Recursive initialization therefore fails. OpenScript is optional; do not invent a URL or modify upstream files to unblock the core pipeline.

Install Blender and FFmpeg from official prebuilt distributions. Pin submodule revisions when integrating. Never commit credentials, model weights or generated production media.
