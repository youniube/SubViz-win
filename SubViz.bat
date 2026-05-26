@echo off
setlocal
title SubViz - Subscription Analyzer

cd /d "%~dp0"
if errorlevel 1 goto bad_dir

set "NODE_EXE=%~dp0node\node.exe"
if exist "%NODE_EXE%" goto have_node

where node >nul 2>nul
if errorlevel 1 goto no_node
set "NODE_EXE=node"

:have_node
if not exist "%~dp0server.js" goto no_server
if not exist "%~dp0public\index.html" goto no_public

echo.
echo ======================================
echo   SubViz - Subscription Analyzer
echo ======================================
echo.
echo [INFO] App folder: %CD%
echo [INFO] Node: %NODE_EXE%
echo [INFO] Open: http://localhost:3456
echo [INFO] Press Ctrl+C to stop.
echo.
start "" "http://localhost:3456"
"%NODE_EXE%" "%~dp0server.js"
echo.
echo [INFO] SubViz stopped.
pause
exit /b 0

:bad_dir
echo [ERROR] Failed to enter app folder: %~dp0
pause
exit /b 1

:no_node
echo [ERROR] Node.js was not found.
echo This full package should contain: node\node.exe
echo Please make sure you extracted the whole zip package before running SubViz.bat.
echo Current folder: %CD%
pause
exit /b 1

:no_server
echo [ERROR] server.js was not found.
echo Please run SubViz.bat from the extracted SubViz package folder.
echo Current folder: %CD%
pause
exit /b 1

:no_public
echo [ERROR] public\index.html was not found.
echo The package may be incomplete. Please download the full artifact again.
echo Current folder: %CD%
pause
exit /b 1
