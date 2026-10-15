@echo off
setlocal
title Hao Agent
set "HAO_ROOT=%~dp0distribution"
set "PI_DESKTOP_DATA_DIR=%HAO_ROOT%\data"
set "PI_DESKTOP_AGENTS_DIR=%HAO_ROOT%\agents"
set "PI_CODING_AGENT_DIR=%HAO_ROOT%\pi-agent"
set "XDG_CACHE_HOME=%HAO_ROOT%\cache"
set "TEMP=%HAO_ROOT%\temp"
set "TMP=%HAO_ROOT%\temp"
if not exist "%TEMP%" mkdir "%TEMP%"
if not exist "%PI_DESKTOP_DATA_DIR%" mkdir "%PI_DESKTOP_DATA_DIR%"
if not exist "%PI_DESKTOP_AGENTS_DIR%" mkdir "%PI_DESKTOP_AGENTS_DIR%"
if not exist "%HAO_ROOT%\pi-desktop\PI-Desktop.exe" goto missing
if /I "%~1"=="--check" goto check_only
echo Hao Agent uses PI-Desktop 0.20.1 as its desktop host.
echo First run: install local.hao-agent-0.1.0.piplug from the Plugins page.
echo Connect ChatGPT and OpenCode Go in Settings - Models, then open Hao Agent.
echo Runtime data and browser cache: %HAO_ROOT%
start "Hao Agent" "%HAO_ROOT%\pi-desktop\PI-Desktop.exe" "--user-data-dir=%HAO_ROOT%\chromium"
exit /b 0
:check_only
echo CHECK_OK: Desktop executable found. No application was launched.
exit /b 0
:missing
echo Portable PI-Desktop is missing. See PERSONAL-AGENT.md.
pause
exit /b 1
