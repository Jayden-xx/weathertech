@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if errorlevel 1 goto badpath
if not exist "%~dp0server.py" goto missing
set "PYTHONUTF8=1"
set "KMA_PY="
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
if not errorlevel 1 (
    set "KMA_PY=py -3"
    goto launch
)
python -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
if not errorlevel 1 (
    set "KMA_PY=python"
    goto launch
)
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" (
    "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
    if not errorlevel 1 goto bundled
)
echo [실행 실패] Python 3.10 이상이 필요합니다.
echo https://www.python.org/downloads/windows/ 에서 Python 3을 설치하세요.
echo 설치 시 Add python.exe to PATH를 선택한 뒤 이 파일을 다시 실행하세요.
goto failed
:bundled
set KMA_PY="%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
:launch
echo Python 버전 확인:
%KMA_PY% --version
echo 프로젝트: %~dp0
echo 서버가 준비되면 터미널에 실제 접속 주소가 표시됩니다.
echo KEY.env가 없어도 설정 안내 화면은 실행됩니다.
%KMA_PY% -X utf8 -u "%~dp0server.py" %*
set "KMA_EXIT=%errorlevel%"
if not "%KMA_EXIT%"=="0" (
    echo.
    echo [서버 종료] 위 오류 메시지를 확인하세요. 다른 프로세스를 임의로 종료하지 않습니다.
    if not "%KMA_NO_PAUSE%"=="1" pause
)
exit /b %KMA_EXIT%
:badpath
echo [실행 실패] 실행 파일의 프로젝트 폴더로 이동할 수 없습니다.
goto failed
:missing
echo [실행 실패] 실행 파일과 같은 폴더에 server.py가 없습니다. 전체 ZIP을 풀어 실행하세요.
:failed
if not "%KMA_NO_PAUSE%"=="1" pause
exit /b 1
