console.log('\x1b[92mBuild Virtual Endoscopy Server\x1b[0m');
const path = require('node:path');
const { exec } = require('child_process');

const execCallback = (err, stdout, stderr) => {
	if (err) {
		console.log('\x1b[91mError Occured\x1b[0m');
		throw new Error(`error: ${stderr}`);
	}
}

const envCommand = 'go env -w CGO_ENABLED=0';
exec(envCommand, execCallback);

const buildDir = path.normalize(__dirname +  "/../builtServer");
console.log('\x1b[92mServer will be placed in: \x1b[0m' + buildDir);

const command = "go build -C ./server/cmd/main -o " + buildDir;

exec(command, execCallback);

console.log('\x1b[92mServer succefully built!\x1b[0m');