@echo off
title MTG Deck Relation Visualizer Launcher

echo ===================================================
echo    Starting MTG Deck Relation Visualizer
echo ===================================================
echo.

:: Ensure we are in the script's directory
cd /d "%~dp0"

:: Check if Ollama is installed on the user's PC and launch it in background if available
where ollama >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [INFO] Ollama CLI detected. Starting local Ollama server in background...
    start "Ollama Server" /min cmd /c "ollama serve"
)

:: Check if node_modules exists, run npm install if missing
if not exist "node_modules\" (
    echo [INFO] First time setup detected. Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed. Please make sure Node.js is installed.
        pause
        exit /b %ERRORLEVEL%
    )
    echo.
)

echo [INFO] Launching app server and opening browser...
call npm run dev -- --open
