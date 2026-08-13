#!/usr/bin/env bash

echo "==================================================="
echo "   Starting MTG Deck Relation Visualizer"
echo "==================================================="
echo ""

# Ensure script runs from its directory
cd "$(dirname "$0")"

# Check if Ollama CLI is installed and launch server in background if available
if command -v ollama &> /dev/null; then
    echo "[INFO] Ollama CLI detected. Starting local Ollama server..."
    ollama serve > /dev/null 2>&1 &
fi

# Check if node_modules exists, install if missing
if [ ! -d "node_modules" ]; then
    echo "[INFO] First time setup detected. Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] npm install failed. Please make sure Node.js is installed."
        exit 1
    fi
    echo ""
fi

echo "[INFO] Launching app server and opening browser..."
npm run dev -- --open
