#!/bin/bash
PROJ_DIR=~/ArterialTreeBuilder
BUILD_DIR=${PROJ_DIR}/ArterialTreeBuilder/build
APP_BIN=${BUILD_DIR}/atb
DEPLOY_DIR=~/public_html/FFR-001
echo "deploy script: DEV ${PROJ_DIR} -> STAGE ${DEPLOY_DIR}"; 
# echo "deployment script dev -> http://dodo.inm.ras.ru/~guerman/FFR-www/"

# это локальное копирование
rm -rf ${DEPLOY_DIR}
mkdir -p ${DEPLOY_DIR}/js ${DEPLOY_DIR}/img
cp ${PROJ_DIR}/www/js/ffr-min.js ${DEPLOY_DIR}/js
cp ${PROJ_DIR}/www/img/* ${DEPLOY_DIR}/img
go run ${PROJ_DIR}/scripts/bundler.go -f ${PROJ_DIR}/www/main-min.html -outdir ${DEPLOY_DIR}
if [ -f $APP_BIN ]; then
   cp ${APP_BIN} ${DEPLOY_DIR}
   echo run ${DEPLOY_DIR}/atb to start server listening
else
   echo "File $APP_BIN does not exist."
fi

#tar -czf 0000.tgz -C /mnt/c/xampp/htdocs/ 0000
#scp 0000.tgz germank@dodo.inm.ras.ru:${REMOTE_WWW_ROOT}
#ssh germank@dodo.inm.ras.ru "cd ${REMOTE_WWW_ROOT}; tar -xzf 0000.tgz"




