@echo off
title FramioMedia - AjansOS Studio
echo AjansOS Backend (4010) ve Frontend (4000) baslatiliyor...
start "AjansOS Backend" cmd /k "cd /d D:\Programlar\FramioMedia\AjansOS\backend && npm start"
timeout /t 2 /nobreak >nul
start "AjansOS Frontend" cmd /k "cd /d D:\Programlar\FramioMedia\AjansOS\frontend && npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:4000
