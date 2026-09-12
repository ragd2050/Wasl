$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "WASL - Website and AI speech model launcher"

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating the Python 3.11 environment..."
    py -3.11 -m venv .venv
}

& ".venv\Scripts\python.exe" -c `
    "import fastapi, httpx, librosa, parselmouth, sklearn, uvicorn, xgboost" `
    2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing WASL requirements. This is required only the first time..."
    & ".venv\Scripts\python.exe" -m pip install --upgrade pip
    & ".venv\Scripts\python.exe" -m pip install -r requirements.txt
}

Write-Host "Do not use VS Code Live Server for AI analysis."
Write-Host "WASL will open at http://127.0.0.1:8080/"
& ".venv\Scripts\python.exe" run_wasl.py
