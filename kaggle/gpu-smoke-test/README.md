# Kaggle GPU smoke test

This is the first remote execution check. It deliberately does not install ComfyUI yet.

## GitHub Actions secrets

This workflow uses the legacy Kaggle JSON credential format downloaded as `kaggle.json`. Add these repository secrets under Settings → Secrets and variables → Actions:

- `KAGGLE_USERNAME`: the `username` value from your downloaded Kaggle `kaggle.json`.
- `KAGGLE_KEY`: the `key` value from your downloaded Kaggle `kaggle.json`.

Do not put the JSON file contents or its `key` value into `KAGGLE_API_TOKEN`. The workflow writes a temporary `~/.kaggle/kaggle.json` file from the two secrets and sets restrictive file permissions. It never prints either secret.

## Run

1. Push this branch to GitHub.
2. Open the repository's Actions tab.
3. Select **tests**. A push to `comfyui-integration` runs unit tests first and submits the Kaggle notebook only if they pass.
4. Open your Kaggle profile → Code and find **Stickman Motion Studio GPU Smoke Test**.
5. Check that the run completes and that the notebook prints `cuda_available: true` plus a GPU name.

The workflow requests a private notebook with GPU enabled, internet enabled, and a T4 accelerator. Kaggle may change accelerator availability or reject the run if your account has no GPU quota/access. The workflow submits the notebook; actual execution happens on Kaggle.

## If the run fails

- Authentication error: check that `KAGGLE_USERNAME` and `KAGGLE_KEY` are the two separate values from the same downloaded `kaggle.json`.
- Notebook owner/slug error: check that `KAGGLE_USERNAME` exactly matches your Kaggle username slug.
- GPU/accelerator error: check GPU availability for your account on Kaggle.
- Quota or capacity error: wait and retry later; do not create repeated runs.

Never paste credentials into chat, source code, notebook cells, or commit history.
