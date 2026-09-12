#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PYTHON_BIN="${PYTHON_BIN:-python3.11}"

if [[ ! -x ".venv/bin/python" ]]; then
    "$PYTHON_BIN" -m venv .venv
fi

if ! .venv/bin/python -c \
    "import fastapi, httpx, librosa, parselmouth, sklearn, uvicorn, xgboost" \
    >/dev/null 2>&1; then
    .venv/bin/python -m pip install --upgrade pip
    .venv/bin/python -m pip install -r requirements.txt
fi

echo "WASL will open at http://127.0.0.1:8080/"
.venv/bin/python run_wasl.py
