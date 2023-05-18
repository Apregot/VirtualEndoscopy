const Old_deployConfig = {
	build: 72,
	DEV: {
		wsurl: 'ws://158.160.65.29:8889'
	},

	TEST: {
		wsurl: 'ws://158.160.65.29:8889'
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
module.exports = Old_deployConfig;