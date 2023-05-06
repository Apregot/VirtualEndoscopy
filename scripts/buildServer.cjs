const path = require('node:path');
const { exec } = require('child_process');

const execCallback = (err, stdout, stderr) => {
	if (err) {
		throw new Error(`error: ${stderr}`);
	}
	console.log(`out: ${stdout}`);
}

const buildDir = path.normalize(__dirname +  "/../builtServer") + "/";
console.log('buildDir: ' + buildDir);
const command = "go build -C ./server/cmd/main -o " + buildDir;
console.log('command: ' + command);
exec(command, execCallback);