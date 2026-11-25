@echo off
title FramioMedia - AjansOS Studio
echo AjansOS Backend (4010) ve Frontend (4000) baslatiliyor...
echo Gereksinim: Node.js 22.13 veya uzeri.
start "AjansOS Backend" cmd /k "cd /d "%~dp0backend" && npm start"
timeout /t 2 /nobreak >nul
start "AjansOS Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:4000
