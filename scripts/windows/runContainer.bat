@echo off
set dockerExecutable=%1
set port=%2
set imageName=%3

%dockerExecutable% run -d -p %port%:8889 %imageName%
