const DeployConfig = {
	build: 72,
	DEV: {
		wsurl: 'ws://192.168.50.138:80'
	},

	TEST: {
		wsurl: 'ws://192.168.50.138:80'
	},

	PROD: {
		wsurl: 'wss://dodo.inm.ras.ru/websocket'
	},
	COLLECT: {
		logs:[	"trace.txt", "atb-stdout.txt", "log_frangi.txt",
				 "FFR/input_data.tre", "FFR/FFRfull.tre", "FFR/FFR.tre"
			 ],
		dir: "/mnt/c/blender/polygon/_ФРК/collect"
	}
};
module.exports = DeployConfig;