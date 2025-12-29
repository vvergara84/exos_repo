// Paths
const NODE_MODULES = "../../node_modules/";

// Log
const path = require(NODE_MODULES + "path");

var logText = "[" + path.basename(__filename) + "]    ";

function getEnv() {
	console.log(logText + "Getting Environment Properties");

	let LINSTANCE = process.env.INSTANCE ? process.env.INSTANCE : 'DEV';
	
	return {
		// Application Configuration
		INSTANCE: LINSTANCE,
		DEBUG: process.env.DEBUG ? process.env.DEBUG : 1,
		VONAGE: process.env.VONAGE ? process.env.VONAGE : 0,
		PORT: process.env.PORT ? process.env.PORT : 8017,
		APP_USER: process.env.APP_USER ? process.env.APP_USER : '',
		APP_PASSWORD: process.env.APP_PASSWORD ? process.env.APP_PASSWORD : '',

		// Database Configuration
		REDIS_HOST: process.env.REDIS_HOST ? process.env.REDIS_HOST : "voice-redis-dev-001.mgky9v.0001.use1.cache.amazonaws.com",
		REDIS_PORT: process.env.REDIS_PORT ? process.env.REDIS_PORT : 6379,

		// Nexmo Configuration
		MASTER_KEY: process.env.MASTER_KEY || '',
		MASTER_SECRET: process.env.MASTER_SECRET || '',
		MASTER_APP: process.env.MASTER_APP || '',
		MASTER_KEY_FILE: process.env.MASTER_KEY_FILE || '',

		// Vonage Configuration
		N_SERVER: process.env.N_SERVER + LINSTANCE,

		// Validsoft Configuration
		API_HOST_PROD: process.env.API_HOST_PROD ? process.env.API_HOST_PROD : '',
		API_HOST_SANDBOX: process.env.API_HOST_SANDBOX ? process.env.API_HOST_SANDBOX : '',
		WA_NUMBER: process.env.WA_NUMBER || '',
		WA_NAMESPACE: process.env.WA_NAMESPACE || '',		
		PIN_TEMPLATE: process.env.PIN_TEMPLATE || '',
		ENROLL_TEMPLATE: process.env.ENROLL_TEMPLATE,

		// Speechmatics Configuration
		S_MURL: process.env.SM_URL,

		// Verimetrics Configuration
		VS_URL: process.env.VS_URL,
		VS_USER: process.env.VS_USER,
		VS_PASSWORD: process.env.VS_PASSWORD,
		VS_THRESHOLD: process.env.VS_THRESHOLD ? parseFloat(process.env.VS_THRESHOLD) : 0.45,

		// Extra Configuration
		VIDS: process.env.VIDS ? process.env.VIDS : 1,
		NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED ? process.env.NODE_TLS_REJECT_UNAUTHORIZED : 0,				
	}
}

module.exports = { getEnv }
