@echo off
chcp 65001 >nul
call "%~dp0서버실행.cmd" %*
exit /b %errorlevel%
