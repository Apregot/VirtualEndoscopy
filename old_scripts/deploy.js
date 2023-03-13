/* ${ArterialTreeBuilder} справочник, куда клонирован проект https://boogie.inm.ras.ru/germank/ArterialTreeBuilder
 * ${ArterialTreeBuilder}/scripts/deploy.js - этот скрипт
 * ${DEPLOY_NAME} справочник, в котором происходят все сборки:
 *  для MODE=DEV        ${HOME}/public_html/FFR-dev
 *  для MODE=TEST|PROD  ${HOME}/public_html/FFR-0XX где XX номер билда из deploy.config.js
 * Предполагается, что исполняемый файл atb уже собран и находится в ${ArterialTreeBuilder}/build/atb
 * Скрипт работает от имени пользователя, который имеет право запускать docker (является членом группы docker)
 * Сборка проверялась только на логине germank
 * FFR_DIST это справочник, в котором находится FFR/, то есть программа blood.exe и все необходимые файлы
 *  ${ArterialTreeBuilder}/FFR это версия FFR, которая работает в мультивоксе
 *  /mnt/c/blender/polygon/_ФРК/Тимур/24.11.21/FFR_fortran_3 - это справочник с оптимизированной blood.exe,
 *  присланной Тимуром  24.11.21
 *  /mnt/c/blender/polygon/_ФРК/Тимур/FFR_f_march22/FFR     - это FFR от 02.03.22
 * При запуске blood в контенере blood-wine:0.1 FFR_DIST монтируется как /FFR
 *  docker run --rm -v ${FFR_DIST}:/FFR blood-wine:0.1
 * При всех сборках FFR_DIST/ копируется в ${DEPLOY_NAME}/bin/FFR
 *
 */
if(process.argv.length != 3) {
	console.log('Usage: deploy.js MODE={DEV | TEST | STAGE | PROD}');
	return;
}

const path = require('path')
const DeployConfig = require("../old_deploy.config.js")
const chalk = require('chalk')
//const rimraf = require('rimraf')  // я решил отказаться от fs+rimraf  в пользу fs-extra
const fs = require('fs-extra')
var {spawn, exec, execSync} = require('child_process');

const mode = process.argv[2]
const DEPLOY_NAME = mode == 'DEV' ? 'FFR-dev' :`FFR-0${DeployConfig.build}`
const DEV_HOME = process.env.PWD    // process.env.USER
//const FFR_DIST = path.join(DEV_HOME,'FFR')
//const FFR_DIST = '/mnt/c/blender/polygon/_ФРК/Тимур/24.11.21/FFR_fortran_3';
// FFR_f_march22 - это версия которая работала вместе с сервером D-63 включительно
//const FFR_DIST = '/mnt/c/blender/polygon/_ФРК/Тимур/FFR_f_march22/FFR';
// 01.06.22 - параллельная и последовательная версия blood c оптимизациями для коротких сосудов
// работает с версии D-64
//const FFR_DIST = '/mnt/c/blender/polygon/_ФРК/Тимур/01.06.22/FFRf_par'
const FFR_DIST = '/mnt/c/blender/polygon/_ФРК/Тимур/FFR_fort_22.10/FFR_fort'    // c 1.2.4.72

if(DeployConfig[mode] === undefined) {
    console.log('Usage: deploy.js MODE={DEV | TEST | STAGE | PROD}');
    return;
}

const pkgjson = path.join(__dirname,'../package.json')
const data = fs.readFileSync(pkgjson,'utf-8')
const pkgobj = JSON.parse(data)

const appconf = `const AppConfig = {
    version: '${pkgobj.version}',
    build: ${DeployConfig.build},
    wsurl: '${DeployConfig[mode].wsurl}',
    date: '${new Date().toLocaleString("ru-ru").split(',')[0]}'
}`

const docroot = path.join(process.env.HOME,'public_html')
const deployDir = path.join(docroot,DEPLOY_NAME)
const atbBinary = path.join(DEV_HOME,'ArterialTreeBuilder','build','atb')
const atb_dest_path = path.join(deployDir, 'bin', 'atb')
const FFR_dest_path = path.join(deployDir, 'bin', 'FFR')
const bloodContainer = 'blood-wine:0.1'

const msg=`Making ${mode} deployment from DEV to ${deployDir}`;
console.log(chalk.green.bold(msg)); 

// проверка, что исполняемый файл сервиса ATB собран в проекте
//
if(!fs.pathExistsSync(atbBinary)) {
    const msg = `ATB binary ${atbBinary} does not exist`;
    console.log(chalk.red(msg));
    return;
}
console.log(`исполняемый файл ATB сервиса найден: ${atbBinary}`)

// проверка, что контейнер blood-wine существует
// это правда имеет смысл только для DEV и TEST, так как они выполняются на машине сборки
// а вот для PROD (додо) надо подумать. В принципе можно выполнить проверку через удаленную
// команду через ssh, другое дело, доносит ли она назад код возврата
//
try {
    // 
    execSync(`docker image inspect ${bloodContainer}`, {stdio : 'pipe' })
} catch (error) {
    console.log(`необходимый для работы контейнер ${bloodContainer} не существует`)
    return;
}
console.log(`docker контейнер ${bloodContainer} найден`)

if(mode == 'DEV') {
    //
    // создать DEV appconf.js
    // atb -> deployDir + сменить группу на docker и подставить SUID "chmod ug+s atb",
    // иначе atb будет работать от имени вебсервера и не сможет запустить докер
    // смена группы на docker возможна потому, что germank является членом группы docker
    // если этот скрипт будет выполняться под другим логином, то вероятно atb будет иметь недостаточные привилегии
    // создать $deployDir/{service-log.txt, atb-stdout.txt} с правами a+w, иначе service.php не сможет писать в лог
    // TBD: сгенерировать и показать STAGE URL
    //
    console.log(`создаем appconf.js для сборки ${mode}`)
    fs.writeFileSync( './www/js/appconf.js', appconf/*, options={encoding|mode|flag} */)
    console.log('копируем atb в ', atb_dest_path)
    fs.ensureFileSync(atb_dest_path)
    fs.copySync(atbBinary,atb_dest_path)
    const cmd = "chown :docker " + atb_dest_path;
    execSync( cmd );    
    fs.chmodSync(atb_dest_path,'06755')     // подставить SUID: chmod ug+s

    // 2 файла логов надо создать с правами USER и разрешить в них запись всем
    const service_log_path = path.join(deployDir, 'service-log.txt')
    fs.ensureFileSync(service_log_path)
    fs.chmodSync(service_log_path,'0666')
    const atb_stdout_path = path.join(deployDir, 'bin', 'atb-stdout.txt')
    fs.ensureFileSync(atb_stdout_path)
    fs.chmodSync(atb_stdout_path,'0666')
    console.log(chalk.green.bold('Копируем '+FFR_DIST+' в '+FFR_dest_path)); 
    fs.copySync(FFR_DIST, FFR_dest_path)
    const deployURL = makeDeployURL(); console.log(deployURL)
}
else if(mode == 'TEST' || mode == 'PROD') {   
    //
    // безусловно удаляем deployDir не глядя, существует она или нет
    // $DEV/www/{img,FFR} -> $deployDir
    // mkdir $deployDir/js
    // atb -> deployDir + подставить SUID "chmod ug+s atb", иначе atb будет работать от имени вебсервера
    // $DEV/www/service.php -> $deployDir
    // создать $deployDir/{service-log.txt, atb-stdout.txt} с правами a+w, иначе service.php не сможет писать в лог
    // компилировать main-min.html в $deployDir/{bundle.css, index.html}
    // создать TEST appconf.js
    // компилировать ffr-min.js -> $deployDir/js
    // сгенерировать и показать STAGE URL
    //
    console.log(`пересоздаем справочник сборки ${deployDir}`)
    fs.removeSync(deployDir)
    fs.copySync(path.join(DEV_HOME,'www/img'), path.join(deployDir,'img'))
    fs.mkdirpSync(path.join(deployDir,'bin'))
    fs.copySync(FFR_DIST, FFR_dest_path)

    //fs.copySync(path.join(DEV_HOME,'FFR'), path.join(deployDir,'FFR'))
    fs.mkdirpSync(path.join(deployDir,'js'))
    fs.ensureFileSync(atb_dest_path)
    fs.copySync(atbBinary,atb_dest_path)
    const cmd = "chown :docker " + atb_dest_path;
    execSync( cmd );    
    fs.chmodSync(atb_dest_path,'06755')     // подставить SUID: chmod ug+s
    fs.copySync(path.join(DEV_HOME,'www','service.php'),path.join(deployDir,'service.php'))
 
    // 2 файла логов надо создать с правами USER и разрешить в них запись всем
    const service_log_path = path.join(deployDir, 'service-log.txt')
    fs.ensureFileSync(service_log_path)
    fs.chmodSync(service_log_path,'0666')
    const atb_stdout_path = path.join(deployDir, 'bin', 'atb-stdout.txt')
    fs.ensureFileSync(atb_stdout_path)
    fs.chmodSync(atb_stdout_path,'0666')

    // создаем bundle.css
    //
    try {
        const html = path.join(DEV_HOME,'www','main-min.html')
        const bundler = path.join(DEV_HOME,'scripts','bundler.go')
        const cmd = `go run ${bundler} -f ${html} -outdir ${deployDir}`
        // console.log(cmd)
        console.log('делаем сборку bundle.css')
        execSync(cmd, {stdio: 'pipe'})
    } catch (error) {
        console.log('ошибка компиляции bundle CSS')
        // return ?
    }

    console.log(`создаем appconf.js для сборки ${mode}`)
    fs.writeFileSync( './www/js/appconf.js', appconf/*, options={encoding|mode|flag} */)
    try {
        console.log(chalk.white('Compiling *.js sources to make bundle JS (ffr-min.js)'))
        const cmd='cd ./www/js; ./3comp.sh 2>err.txt'; // console.log(cmd)  
        execSync(cmd, {stdio: 'pipe'}) // {stdio: 'inherit'}
        const errtxt = path.join(DEV_HOME,'www', 'js', 'err.txt')
        const outlines = fs.readFileSync(errtxt,'utf-8').split('\n')
        console.log(outlines[outlines.length-2])
        fs.removeSync(errtxt)      
    } catch (error) { 
        console.log(chalk.red.bold('ошибка компиляции ffr-min.js'))
        return;
    }

    const bundlejs = path.join(DEV_HOME,'www', 'js', 'ffr-min.js')
    const bundlejsmap = path.join(DEV_HOME,'www', 'js', 'ffr-min.js.map')
    fs.copySync(bundlejs,path.join(deployDir, 'js', 'ffr-min.js'))
    fs.copySync(bundlejsmap,path.join(deployDir, 'js', 'ffr-min.js.map'))
    if(mode == 'DEV')
        {const deployURL = makeDeployURL(); console.log(deployURL);}
}

// Перед этим должен был отработать mode=TEST
if(mode == 'PROD') {
    try {
        // console.log(chalk.white('Compiling *.js sources to make bundle JS (ffr-min.js)'))
        const cmd = `tar -czf ${DEPLOY_NAME}.tgz -C ${docroot} ${DEPLOY_NAME}`
        console.log(cmd)
        execSync(cmd, {stdio: 'pipe'})
        const cmd1 = `scp ${DEPLOY_NAME}.tgz germank@dodo.inm.ras.ru:~/public_html`
        console.log(cmd1)
        execSync(cmd1, {stdio: 'inherit'})
        const cmd3 = `ssh germank@dodo.inm.ras.ru "cd ~/public_html; tar -pxzf ${DEPLOY_NAME}.tgz"`
        console.log('remotely untarring..')
        execSync(cmd3, {stdio: 'pipe'})
        const cmd4 = `ssh germank@dodo.inm.ras.ru "chgrp docker ~/public_html/${DEPLOY_NAME}/bin/atb"`
        console.log(cmd4)
        execSync(cmd4, {stdio: 'pipe'})
        const cmd5 = `ssh germank@dodo.inm.ras.ru "chmod ug+s ~/public_html/${DEPLOY_NAME}/bin/atb"`
        console.log(cmd5)
        execSync(cmd5, {stdio: 'pipe'})

    } catch (error) {
        console.log('tar error')
        return 0
    }

    const deployURL = `http://dodo.inm.ras.ru/~guerman/${DEPLOY_NAME}/index.html`
    console.log(deployURL)
}

if(mode == 'COLLECT') {
    const logURL = `http://dodo.inm.ras.ru/~guerman/FFR-0${DeployConfig.build}/bin`
    const collectDir = DeployConfig['COLLECT'].dir
    fs.ensureDirSync(collectDir)
    console.log(`копирование лог файлов из ${logURL} в ${collectDir}`)
    for(let logname of DeployConfig['COLLECT'].logs) {
        const parts = logname.split('/');// console.log(parts)
        const f = parts[parts.length-1]
        const cmd = `curl -f -s ${logURL}/${f} -o ${collectDir}/${f}`
        //console.log(f)
        try {
            console.log(`${logname} => ${collectDir}`)
            execSync(cmd, {stdio: 'pipe'})
        } catch (error) {
                console.log(`execSync error ${cmd}`)
        }

    }
}

// const urlExist = require('url-exist')
// await urlExist("https://google.com")
//import urlExist from "url-exist"    
// интересный код
// const urlExist = require("url-exist");

// (async () => {
//     const exists = await urlExist("https://google.com");
//     // Handle result
//     console.log(exists)
// })();

return;

function makeDeployURL() {
    try {
        execSync('hostname -I | awk "{print $1}" >out.txt', {stdio : 'inherit' })
        const outfile = path.join(DEV_HOME, 'out.txt')
        const IP = fs.readFileSync(outfile,'utf-8').split(' ')[0]
        const index_html = mode == 'DEV' ? 'main.html' : 'index.html'
        const deployURL = `http://${IP}/~${process.env.USER}/${DEPLOY_NAME}/${index_html}`
        // console.log(deployURL)
        fs.removeSync(outfile)
        return deployURL
    } catch (error) {
        console.log(`catch error`);
        return "";
    }    
}



try {
	console.log('scp FFR-001.tgz germank@dodo.inm.ras.ru:/home/guerman')
	execSync('scp FFR-001.tgz germank@dodo.inm.ras.ru:/home/guerman', {stdio: 'inherit'})
} catch (error) {
    error.status;  // 0 : successful exit, but here in exception it has to be greater than 0
    error.message; // Holds the message you typically want.
    error.stderr;  // Holds the stderr output. Use `.toString()`.
    error.stdout;  // Holds the stdout output. Use `.toString()`.
    console.log('catch error ', error)
 }
console.log('after exec')

// асинхронный запуск. Все работает и stderr перехватывается, но нет возможности дождаться, кроме как к handler'e 'exit'
//
// exec(cmd, (error, stdout, stderr)=>{
//     if (error) {
//         console.error(`exec error: ${error}`);
//         return;
//     }
//     // console.log(`stdout: ${stdout}`);
//     if(stderr) {
//         const lines = stderr.split('\n')
//         // console.log('stderr.length=',stderr.length)
//         console.log(lines[lines.length-2])
//         // console.error(`stderr: ${stderr}`);
//     }
// });

