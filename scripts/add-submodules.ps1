# Add the selected external projects as Git submodules.
# Run from the root of stickman-motion-studio in PowerShell.
# This script does not access or modify yt-auto.

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
    throw "Run this script from the root of the cloned stickman-motion-studio repository."
}

$modules = @(
    @{ Path = "external/ComfyUI"; Url = "https://github.com/comfyanonymous/ComfyUI.git" },
    @{ Path = "external/2d-character-pipeline"; Url = "https://github.com/mor-o/comfyui-2d-character-pipeline.git" },
    @{ Path = "external/OpenScript"; Url = "https://github.com/ishan-parihar/openscript.git" },
    @{ Path = "external/4brospix"; Url = "https://github.com/koo-bros/4brospix.git" },
    @{ Path = "external/automated-video-generator"; Url = "https://github.com/itsPremkumar/Automated-Video-Generator.git" }
)

foreach ($module in $modules) {
    if (Test-Path $module.Path) {
        Write-Host "Skipping existing path: $($module.Path)"
        continue
    }
    Write-Host "Adding $($module.Url) -> $($module.Path)"
    git submodule add $module.Url $module.Path
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to add submodule: $($module.Path)"
    }
}

Write-Host ""
Write-Host "Submodules added. Review licenses and dependency requirements before running them."
Write-Host "Commit .gitmodules and the gitlink entries with:"
Write-Host "  git add .gitmodules external"
Write-Host "  git commit -m 'Add external production pipeline submodules'"
