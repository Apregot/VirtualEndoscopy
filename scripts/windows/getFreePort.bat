@echo off
for /L %%a in (8000,1,8999) do netstat /a /n | find "%%a" | find "LISTENING" > NUL || set free_port=%%a&& goto found
echo No free ports found in range 8000-8999
pause
exit /b -1
:found
echo Free port is found: %free_port%
exit /b %free_port%