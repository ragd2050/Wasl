@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ==========================================
echo WASL - Website and AI speech model launcher
echo ==========================================

where py >nul 2>nul
if errorlevel 1 goto python_missing

if not exist ".venv\Scripts\python.exe" (
    echo Creating the Python 3.11 environment...
    py -3.11 -m venv .venv
    if errorlevel 1 goto python_missing
)

call ".venv\Scripts\activate.bat"
python -c "import fastapi, httpx, librosa, parselmouth, sklearn, uvicorn, xgboost" >nul 2>nul
if errorlevel 1 (
    echo Installing WASL requirements. This is required only the first time...
    python -m pip install --upgrade pip
    if errorlevel 1 goto install_failed
    python -m pip install -r requirements.txt
    if errorlevel 1 goto install_failed
)

echo.
echo Do not use VS Code Live Server for AI analysis.
echo WASL will open automatically at http://127.0.0.1:8080/
echo.
python run_wasl.py
goto end

:python_missing
echo.
echo Python 3.11 64-bit is required.
echo Install Python 3.11, enable the Python Launcher, then run this file again.
pause
goto end

:install_failed
echo.
echo The required packages could not be installed.
echo Check the internet connection, then run START-WASL.bat again.
pause

:end
endlocal
