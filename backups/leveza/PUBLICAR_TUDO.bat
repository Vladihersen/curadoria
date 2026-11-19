@echo off
setlocal enabledelayedexpansion
title PUBLICAR TUDO - Leveza de Viver (livre + acesso)
color 0F
cd /d "%~dp0"

echo =========================================================
echo   PUBLICAR TUDO
echo   Publica os DOIS workers de uma vez so (livre + com acesso),
echo   sempre a partir do MESMO index.html/sw.js - nunca mais
echo   ficam dessincronizados um do outro.
echo   Pasta: %CD%
echo =========================================================
echo.

echo [1/9] Node.js...
where node >nul 2>&1
if errorlevel 1 goto SEM_NODE
node -v
echo.

echo [2/9] Gerando o _worker.js a partir do index.html atual (app livre)...
where powershell >nul 2>&1
if errorlevel 1 goto SEM_POWERSHELL
powershell -NoProfile -ExecutionPolicy Bypass -File "gerar-worker.ps1"
if errorlevel 1 goto ERRO_GERAR
if not exist "_worker.js" goto ERRO_GERAR
echo.

echo [3/9] Carimbando a versao nova no sw.js (app com acesso)...
if not exist "carimbar-versao.ps1" goto FALTA_ACESSO
powershell -NoProfile -ExecutionPolicy Bypass -File "carimbar-versao.ps1"
if errorlevel 1 goto ERRO_SW
echo.

echo [4/9] Testando se este computador enxerga a Cloudflare...
curl -s -o nul -w "        Resposta: %%{http_code}\n" https://api.cloudflare.com/client/v4 --max-time 10
echo.

echo [5/9] Forcando IPv4 para esta janela ^(evita "fetch failed"^)...
set NODE_OPTIONS=--dns-result-order=ipv4first
if exist "%LOCALAPPDATA%\npm-cache\_npx" rmdir /s /q "%LOCALAPPDATA%\npm-cache\_npx" 2>nul
echo        Ajustado.
echo.

echo [6/9] Conferindo o wrangler...
call wrangler --version >nul 2>&1
if errorlevel 1 (
  echo        Nao instalado. Instalando agora...
  call npm install -g wrangler
  if errorlevel 1 goto ERRO_INSTALL
)
call wrangler --version
echo.

echo [7/9] Conferindo arquivos de configuracao...
if not exist "wrangler.toml" goto SEM_CONFIG
if not exist "_worker.js" goto ERRO_GERAR
if not exist "wrangler-acesso.toml" goto FALTA_ACESSO
if not exist "worker-acesso.js" goto FALTA_ACESSO
echo        OK - _worker.js e sw.js atualizados agora mesmo, sera isso que vai publicar.
echo.

echo [8/9] Publicando o app LIVRE (levezadeviver-oficial)...
echo        Se abrir o navegador pedindo login, autorize.
call wrangler deploy
if errorlevel 1 goto ERRO_DEPLOY_LIVRE
echo.

echo [9/9] Publicando o app COM ACESSO (levezadeviver-acesso)...
call wrangler deploy -c wrangler-acesso.toml
if errorlevel 1 goto ERRO_DEPLOY_ACESSO
echo.

echo =========================================================
echo   PUBLICADO - os dois workers atualizados juntos
echo =========================================================
echo   Livre:  https://levezadeviver-oficial.vladihersen.workers.dev
echo   Acesso: https://levezadeviver-acesso.vladihersen.workers.dev
echo   Controle de acessos: https://levezadeviver-acesso.vladihersen.workers.dev/admin
echo   Avise o Claude. Ele confere na Cloudflare se os dois subiram.
goto FIM

:SEM_NODE
echo.
echo === DEU ERRO: Node.js nao encontrado ===
goto FIM

:SEM_POWERSHELL
echo.
echo === DEU ERRO: PowerShell nao encontrado ===
echo   Isso e incomum no Windows. Mande print para o Claude.
goto FIM

:ERRO_GERAR
echo.
echo =========================================================
echo   DEU ERRO ao gerar o _worker.js
echo =========================================================
echo   Confere se "index.html" e "sw.js" estao nesta mesma pasta.
echo   Role esta janela ate o topo, tire print de tudo e manda
echo   para o Claude.
goto FIM

:FALTA_ACESSO
echo.
echo === DEU ERRO: faltam arquivos do pacote leveza-acesso nesta pasta ===
echo   Precisa de worker-acesso.js, carimbar-versao.ps1 e
echo   wrangler-acesso.toml nesta pasta.
goto FIM

:ERRO_SW
echo.
echo === DEU ERRO no sw.js ^(carimbar-versao.ps1^) ===
echo   Confere se o sw.js NAO esta aberto em outro programa agora
echo   (editor de texto, Explorador com preview, OneDrive
echo   sincronizando) e rode este arquivo de novo.
goto FIM

:ERRO_INSTALL
echo.
echo === DEU ERRO ao instalar o wrangler ===
echo   Tenta executar este arquivo como administrador.
goto FIM

:SEM_CONFIG
echo.
echo === DEU ERRO: falta o wrangler.toml nesta pasta ===
goto FIM

:ERRO_DEPLOY_LIVRE
echo.
echo =========================================================
echo   DEU ERRO na publicacao do APP LIVRE
echo =========================================================
echo   O app com acesso ainda NAO foi publicado - corrija o erro
echo   acima e rode este arquivo de novo.
echo   Role esta janela ate o topo, tire print de TUDO e manda
echo   para o Claude.
goto FIM

:ERRO_DEPLOY_ACESSO
echo.
echo =========================================================
echo   O APP LIVRE foi publicado, mas o APP COM ACESSO deu erro
echo =========================================================
echo   Os dois ficaram temporariamente dessincronizados. Corrija
echo   o erro acima e rode este arquivo de novo - republicar o
echo   app livre de novo nao tem problema nenhum.
echo   Role esta janela ate o topo, tire print de TUDO e manda
echo   para o Claude.
goto FIM

:FIM
echo.
pause
endlocal
