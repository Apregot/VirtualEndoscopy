const path = require('node:path');
const { exec } = require('child_process');

const execCallback = (err, stdout, stderr) => {
	if (err) {
		console.log(`error: ${stderr}`);
		return;
	}
	console.log(`out: ${stdout}`);
}

const buildDir = path.normalize(__dirname +  '"\\..\\builtServer"') + '\\';
exec('go build -C .\\server\\cmd\\main -o ' + buildDir, execCallback);