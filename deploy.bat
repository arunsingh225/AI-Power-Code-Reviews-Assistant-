@echo off
title CodeSentinel Production Deployment
cls
echo ===================================================
echo   🔍 CodeSentinel AI Code Reviewer Deployment
echo ===================================================
echo.
echo This script will help you deploy your application.
echo.
echo [1/3] Verifying Node.js and NPM...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed! Please install it from https://nodejs.org
    pause
    exit /b
)
echo Node.js is installed.
echo.

echo [2/3] Installing Vercel CLI globally...
echo Running 'npm install -g vercel'...
call npm install -g vercel
if %errorlevel% neq 0 (
    echo.
    echo [INFO] Global installation failed, trying local installation...
    call npm install vercel
)
echo.

echo [3/3] Authenticating with Vercel...
echo Please log in to your Vercel account when prompted in your browser.
call vercel login
if %errorlevel% neq 0 (
    echo Login failed! Exiting...
    pause
    exit /b
)
echo.

echo ===================================================
echo   📦 Building and Deploying Frontend
echo ===================================================
echo.
cd frontend
echo Running Vite Production Build...
call npm run build
echo.
echo Deploying to Vercel...
call vercel --prod --yes
echo.
echo ===================================================
echo   ✅ Frontend Deployment Complete!
echo ===================================================
echo.
echo Next Steps:
echo 1. Set your VITE_API_URL environment variable in Vercel to your Render backend URL.
echo 2. Set GEMINI_API_KEY and ALLOWED_ORIGINS in your Render Web Service.
echo.
cd ..
pause
