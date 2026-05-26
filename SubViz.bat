@echo off
chcp 65001 >nul
title SubViz - Subscription Analyzer
echo.
echo   ======================================
echo        SubViz 订阅节点可视化分析器
echo   ======================================
echo.

if exist "%~dp0node\node.exe" (
    set "NODE=%~dp0node\node.exe"
) else (
    where node >nul 2>&1
    if errorlevel 1 (
        echo [错误] 未找到 Node.js，请安装 Node.js 18+ 或使用完整版发行包。
        pause
        exit /b 1
    )
    set "NODE=node"
)

cd /d "%~dp0"
echo [信息] 正在启动 SubViz...
echo [信息] 浏览器访问 http://localhost:3456
echo [信息] 按 Ctrl+C 停止
echo.
"%NODE%" server.js
pause
