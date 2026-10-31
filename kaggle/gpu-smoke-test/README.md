# Kaggle GPU smoke test

This is the first remote execution check. It deliberately does not install ComfyUI yet.

## GitHub Actions secrets

Add these repository secrets under Settings → Secrets and variables → Actions:

- `KAGGLE_USERNAME`: your Kaggle account username/slug (used to create the notebook ID).
- `KAGGLE_API_TOKEN`: the API token copied from Kaggle Settings → API.

The current Kaggle CLI supports `KAGGLE_API_TOKEN` directly. The username is separate metadata for the notebook owner; it is not needed to authenticate when using the modern API token. Do not print either secret in workflow logs.

## Run

1. Push this branch to GitHub.
2. Open the repository's Actions tab.
3. Select **Kaggle GPU smoke test**.
4. Select **Run workflow** on branch `comfyui-integration`.
5. Open your Kaggle profile → Code and find **Stickman Motion Studio GPU Smoke Test**.
6. Check that the run completes and that the notebook prints `cuda_available: true` plus a GPU name.

The workflow requests a private notebook with GPU enabled, internet enabled, and a T4 accelerator. Kaggle may change accelerator availability or reject the run if your account has no GPU quota/access. The workflow only submits the notebook; the actual execution happens on Kaggle.

## If the run fails

- 401/403: recheck the API token secret and regenerate it if necessary.
- Notebook owner/slug error: check that `KAGGLE_USERNAME` exactly matches your Kaggle username slug.
- GPU/accelerator error: open the notebook settings on Kaggle and check GPU availability for your account.
- Quota or capacity error: wait and retry later; do not create repeated runs.

Never paste your API token into chat, source code, notebook cells, or commit history.
