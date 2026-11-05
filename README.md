# gemini-cartoon: cartoon shorts made by Gemini CLI, run by GitHub

Method and look: `skills/cartoon-audio-short/SKILL.md` + the kit in `kit/` (same files that made the Pig War video).
Voice: Kokoro (free, offline). Scene code: written by Gemini CLI for each script. Rendering and encoding: plain code on GitHub.

## One-time setup (you)
1. Make a Gemini API key at https://aistudio.google.com/apikey (free; a free key allows Flash models with a daily request limit).
2. GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret: name `GEMINI_API_KEY`, value = the key.

## Make a short
Actions -> "Gemini cartoon short" -> Run workflow -> branch `gemini-cartoon`, script `scripts/<file>.txt`.
Result: `results/<file>/` on this branch (mp4, stills sheet, QA sheet, the plan Gemini wrote, its log).

Script format: `scripts/FORMAT.md`.
