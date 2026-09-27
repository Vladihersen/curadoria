@echo off
cd /d "%~dp0"
echo ==========================================================
echo PUBLICANDO VERSAO CORRIGIDA - CUIDADO EM FAMILIA
echo ==========================================================
echo.
call npx wrangler deploy
echo.
echo ==========================================================
echo CONCLUIDO! APLICATIVO PUBLICADO COM SUCESSO!
echo https://cuidado-em-familia.vladihersen.workers.dev/
echo ==========================================================
pause
