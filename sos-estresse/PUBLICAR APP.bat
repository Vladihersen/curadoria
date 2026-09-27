@echo off
cd /d "%~dp0"
echo ==========================================================
echo PUBLICANDO SOS ESTRESSE NO CLOUDFLARE
echo ==========================================================
echo.
call npx wrangler deploy
echo.
echo ==========================================================
echo CONCLUIDO!
echo https://sos-estresse.vladihersen.workers.dev/
echo ==========================================================
pause
