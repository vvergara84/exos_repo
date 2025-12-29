'use strict'
// SET ENVIRONMENT VARIABLE "instance" to the company/instance (one word) name
require('dotenv').config();

const NODE_MODULES = "./node_modules/";

const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const expressWs = require('express-ws')(app);
const Nexmo = require('nexmo');
const { Readable } = require('stream');
const cors = require('cors');
const https = require('https');
const request = require('request');
const mysql = require('mysql2');
const redis = require('redis');
const { promisify } = require('util');
var fs = require('fs');
const { spawnSync } = require('child_process');
const uuidv4 = require('uuid/v4');
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const storage = require('node-persist');
const { json } = require('body-parser');
const { response } = require('express');

var app_port = 8017;
var debug = 1;

var wnexmo;
const services = ["wa"]; 	// WhatsApp
const languages = ["es"];	// Spanish

var users = [];
var gjwt = '';
var basekey = 'verimetrics:';


// For Log
const path = require(NODE_MODULES + "path");

var logText = "[" + path.basename(__filename) + "]    ";

console.log(logText + "*********************************");
console.log(logText + "***   V E R I M E T R I C S   ***");
console.log(logText + "*********************************");
console.log(logText + "Starting");

function getEnv() {
	let LINSTANCE = process.env.APP_INSTANCE ? process.env.APP_INSTANCE : 'DEV';
	app_port = process.env.APP_PORT ? process.env.APP_PORT : '8017';
	debug = process.env.APP_DEBUG ? process.env.APP_DEBUG : '1';

	return {
		INSTANCE: LINSTANCE,
		
		S_MURL: process.env.SM_URL ? process.env.SM_URL : 'wss://172.32.0.156:9000/v2',
		
		VONAGE: process.env.VONAGE ? process.env.VONAGE : 0,
		
		VIDS: process.env.VIDS ? process.env.VIDS : 1,

		// App Parameters
		APP_SERVER: process.env.APP_SERVER ? process.env.APP_SERVER : 'https://3.227.24.56/',
		APP_USER: process.env.APP_USER ? process.env.APP_USER : 'exos',
		APP_PASSWORD: process.env.APP_PASSWORD ? process.env.APP_PASSWORD : '123456',

		// Webhooks
		WH_API_RESULTS: process.env.WH_API_RESULTS ? process.env.WH_API_RESULTS : 'results',
		
		// Validsoft Parameters
		VS_URL: process.env.VS_URL ? process.env.VS_URL : 'http://pilot.prod.validsoft.cloud/gateway/stdBiometric/',
		VS_USER: process.env.VS_USER ? process.env.VS_USER: 'EXO_server',
		VS_PASSWORD: process.env.VS_PASSWORD ? process.env.VS_PASSWORD: '!b?JyAINdtQAUPMl4xYEwuxP5gjaZrDm*Qe9',
		VS_THRESHOLD: process.env.VS_THRESHOLD ? parseFloat(process.env.VS_THRESHOLD) : 0.95,

		// Concepto Movil Parameters
		CM_WA_API_HOST: process.env.CM_WA_API_HOST ? process.env.CM_WA_API_HOST : 'https://whatsapp.broadcastermobile.com/whatsapp-bsp-api-endpoint-ws',
		CM_WA_API_SERVICE_AUTH: process.env.CM_WA_API_SERVICE_AUTH ? process.env.CM_WA_API_SERVICE_AUTH : '/services/v1/auth/token',
		CM_WA_API_SERVICE_SEND_MESSAGE: process.env.CM_WA_API_SERVICE_SEND_MESSAGE ? process.env.CM_WA_API_SERVICE_SEND_MESSAGE : '/services/v1/messaging',
		CM_WA_API_KEY: process.env.CM_WA_API_KEY ? process.env.CM_WA_API_KEY : '101',
		CM_WA_API_TOKEN: process.env.CM_WA_API_TOKEN ? process.env.CM_WA_API_TOKEN : 'Harz4TL7wrezVTS5P1hjnuyiARM=',
		CM_WA_SENDER_NUMBER: process.env.CM_WA_SENDER_NUMBER ? process.env.CM_WA_SENDER_NUMBER : '5215552624983',
		CM_WA_NAMESPACE: process.env.CM_WA_NAMESPACE ? process.env.CM_WA_NAMESPACE : 'exos-verimetrics',

		REDIS_HOST: process.env.REDIS_HOST ? process.env.REDIS_HOST : "localhost",
		REDIS_PORT: process.env.REDIS_PORT ? process.env.REDIS_PORT : 6379,
	}
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
};

// Getting Application Properties
let gnids = getEnv();

if (gnids['INSTANCE'] && gnids['INSTANCE'].length > 0) {
	basekey = gnids['INSTANCE'] + ':verimetrics:';
}

if (debug) {
	console.log(logText + "Global Parameters: " + JSON.stringify(gnids));
}

// Text Messages for language
var localization = [{
	language: 'Spanish',
	name: 'Miguel',
	code: 'es',
	fields: {
		register: "Repita la frase 3 veces hasta que escuche un beep: Yo apruebo esta transacción para el número, seguido de su número de teléfono",
		verify: "Para verificar tu voz, repita la frase: Yo apruebo esta transacción por $%AMOUNT% pesos con código de autorización ",
		registered: "Tu voz ha sido registrada exitosamente. Gracias por elegir Voice.",
		success: "Tu voz ha sido validada correctamente, continua tu proceso de compra.",
		failed: "Lo siento, pero tu voz no coincide con nuestros registros. Por favor espera mientras te trasladamos a un agente quien te puede ayudar.",
		failedreg: "Lo siento, pero tu voz no fue registrada correctamente. Por favor intente nuevamente.",
		connecting: "Un momento, por favor",
		pin: "Yo apruebo este registro con el código de autorización ",
		wait: "Por favor espere mientras confirmamos su identidad.",
		waitreg: "Por favor espere mientras procesamos su registro de voz.",
		terms: "Yo acepto los términos y condiciones del servicio",
		cancellation: "Yo acepto la cancelación para el número, seguido de su número de teléfono",
	}
},
];

// ******************************************************
// *					REDIS DATABASE					*
// ******************************************************
console.log(logText + "Creating Redis Client");

const rclient = redis.createClient({
    host: gnids['REDIS_HOST'],
    port: gnids['REDIS_PORT']
});
const getAsync = promisify(rclient.get).bind(rclient); 			// now getAsync is a promisified version of client.get:
const hgetAsync = promisify(rclient.hgetall).bind(rclient); 	// now hgetAsync is a promisified version of client.hgetall:

redis.RedisClient.prototype.delWildcard = function (key, callback = null) {
	var redis = this

	console.log(logText + "Wishing to delete redis key: " + key);

	redis.keys(key, function (err, keys) {
		keys.forEach(function (key) {
			console.log(logText + "Redis deleting key: " + key);

			redis.del(key);
		});
	});
	if (callback) {
		callback();
	}
};

var aConst;

storage.init().then(async function () {
	aConst = await storage.getItem('verimetricsConstant_' + gnids['INSTANCE']);

	console.log(logText + "Storage aConst = " + aConst);

	if (!aConst) {

		aConst = Math.floor(new Date() / 1000);
		storage.setItem('verimetricsConstant_' + gnids['INSTANCE'], aConst);

		console.log(logText + "New Storage aConst = " + aConst);
	}
})

// ***************** END REDIS DATABASE *****************

console.log(logText + "After Redis");

app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());
app.use(function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	res.header("Access-Control-Allow-Methods", "OPTIONS,GET,POST,PUT,DELETE");
	res.header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
	next();
});

console.log(logText + "After App Use");

// HTTP Authorization Validation
function getAuth(req) {
	console.log(logText + "Getting Authorization");

	if (!req.header('Authorization')) {
		return -1;
	}
	const token = req.header('Authorization').replace('Basic', '').trim();
	const credentials = Buffer.from(token, 'base64').toString('ascii');
	const [username, password] = credentials.split(':');

	console.log(logText + "Token: " + token);
	console.log(logText + "Credentials: " + credentials);

	if (debug) {
		console.log(logText + "Username: " + username + " Password: " + password);
	}
	let res = 0;

	// Validate Credentials Against VONAGE
	if (parseInt(gnids['VONAGE']) > 0) { 		// TODO - Do some actual authorization checking here...
		res = 1;
	} 
	else { 		// Not the Vonage account... check actual values!!!
		if (username == gnids['APP_USER'] && password == gnids['APP_PASSWORD']) {
			res = 1;
		}
	}
	console.log(logText + "Authorization Result: " + res);

	return res;
}

// Getting Request Id
function getId(req) {
	console.log(logText + "Getting Id");

	var id = getAuth(req);

	return id;
}

// **************************************************
// *					WHATSAPP					*
// **************************************************
// Get Authentication Token for Whatsapp
// Sending Whatsapp Message
async function sendWA(number, obj) {
	console.log(logText + "Sending WA");
	console.log(logText + "To Number: " + number);
	console.log(logText + "From Number: " + gnids['CM_WA_SENDER_NUMBER']);
	console.log(logText + "Template Object: " + JSON.stringify(obj));

	try {
		console.log(logText + "Getting Whatsapp Authentication Token");

		var sUrl = gnids['CM_WA_API_HOST'] + gnids['CM_WA_API_SERVICE_AUTH'];

		console.log(logText + "Auth WA Service Url: " + sUrl);

		// Requesting Authorization Token
		request.get(sUrl, {
			headers: {
				"Api-Key": gnids['CM_WA_API_KEY'],
				"Api-Token": gnids['CM_WA_API_TOKEN'], 
			},
			json: true,
		},
			function (error, response, body) {
				if (error) {
					return console.log(logText + "Error requesting Authentication Token ", error);
				}
				console.log(logText + "Auth WA Response Body: " + JSON.stringify(response.body));
					
				var cmToken = body.token;
				var date = new Date().toLocaleString();
				var sUrl = gnids['CM_WA_API_HOST'] + gnids['CM_WA_API_SERVICE_SEND_MESSAGE'];

				console.log(logText + "WA Token: " + cmToken);
				console.log(logText + "Sending WA text to: " + number + " at " + date);
				console.log(logText + "Auth WA Service Url: " + sUrl);

				var sType = obj.content.custom.type;
				var oTemplate = obj.content.custom.template;

				console.log(logText + "Type: " + sType);
				console.log(logText + "Text: " + JSON.stringify(oTemplate));

				request.post(sUrl, {
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer ' + cmToken,
					},
					json: true,
					body: {
						from: gnids['CM_WA_SENDER_NUMBER'],
						to: number,
						type: sType,
						template: oTemplate
					},
				},
					function (error, response, body) {
						if (error) {
							console.log(logText + "Error sending WA Message ", error);
						}
						console.log(logText + "Sending WA Message Response: " + JSON.stringify(response.body));
					}
				);
			}
		);
	}
	catch (err) {
		console.log(logText + "Error getting Sending WA Message");
	}
};

// ***************** END WHATSAPP *****************

// Getting Language Fields
function getFields(language) {
	console.log(logText + "Getting Fields");

	let cc = 0;

	for (var index = 0; index < localization.length; ++index) {
		if (localization[index].code == language) {
			cc = index;
			break;
		}
	}
	return localization[cc].fields;
}

// Generating Template Object
function getObject(templ, language, text) {
	console.log(logText + "Getting Object");

	let lng = (language == 'pt' ? 'pt_BR' : language);
	let obj = {
		"content": {
			"type": "custom",
			"custom": {
				"type": "template",
				"template": {
					"name": "bienvenida",
					"language": lng,
					"components": [
						{
							"type": "body",
							"parameters": [
								{
									"type": "text",
									"text": text,
								}
							]
						},
					]
				}
			}
		}
	};
	return obj;
}

// Verifies the Audio from the Client
app.post('/verify', async (req, res) => {
	console.log(logText + "---------  V E R I F Y - R E Q U E S T  ---------");
	console.log(logText + "Got incoming verify request", req.body);

	processRequest(req, res, 'verify');
});

// Enrolls the client voice
app.post('/enroll', async (req, res) => {
	console.log(logText + "---------  E N R O L L - R E Q U E S T  ---------");
	console.log(logText + "Got incoming enroll request: " + JSON.stringify(req.body));

	processRequest(req, res, 'enroll');
});

// Verifies if client is enrolled
app.post('/isenrolled', async (req, res) => {
	console.log(logText + "---------   I S - E N R O L L - R E Q U E S T  ---------");
	console.log(logText + "Got incoming isenrolled request: " + JSON.stringify(req.body));

	processExtra(req, res, 'isenrolled');
});

// Deletes a client enrollment
app.post('/deleteenrollment', async (req, res) => {
	console.log(logText + "---------  D E L E T E - E N R O L L - R E Q U E S T  ---------");
	console.log(logText + "Got incoming deleteenrollment request", req.body);

	processExtra(req, res, 'delete');
});

// Sends Whatsapp Message
app.post('/sendmessage', async (req, res) => {
	console.log(logText + "---------  S E N D - M E S S A G E - R E Q U E S T  ---------");
	console.log(logText + "Got incoming sendmessage request", req.body);
	
	var id = getId(req);

	if (id < 1) {
		return res.status(401).end();
	}
	if (!req.body.requestid) {
		return res.status(400).json({ error: 'Invalid requestid' });
	}
	if (!req.body.message) {
		return res.status(400).json({ error: 'Invalid message' });
	}
	let dkey = basekey + req.body.requestid;

	if (debug) {
		console.log(logText + "Checking for " + dkey);
	}
	rclient.hgetall(dkey, function (err, obj) {
		if (err) {
			return res.status(400).json({ error: 'Internal error' });
		}
		if (obj) {  // Got it!  We can send...
			let obj2 = {
				content: {
					type: "text",
					text: req.body.message
				}
			}
			sendWA(obj.phone, obj2);

			return res.status(200).end();
		} 
		else {	// If there was no requestId in the DB
			console.log(logText + "No RequestId Found, operation Expired");
			console.log(logText + "Looking for Msisdn");

			if (!req.body.msisdn) {
				return res.status(400).json({ error: 'Invalid requestid' });
			}

			let obj2 = {
				content: {
					type: "text",
					text: req.body.message
				}
			}
			console.log(logText + "Sending Message");

			sendWA(req.body.msisdn, obj2);
			
			return res.status(200).end();
		}
	});
	return res.status(200).end();
});

// Resets all the clients from database
app.post('/resetallusers', async (req, res) => {
	console.log(logText + "---------  R E S E T - A L L - U S E R S - R E Q U E S T  ---------");
	console.log(logText + "Got incoming resetallusers request", req.body);

	var id = getId(req);
	
	if (id < 1) {
		return res.status(401).end();
	}
	if (!req.body.force || req.body.force != 'YES') {
		return res.status(400).json({ error: 'Need force:YES' });
	}
	aConst = Math.floor(new Date() / 1000);
	
	await storage.setItem('verimetricsConstant', aConst);
	
	console.log(logText + "New Storage aConst = " + aConst);
	
	return res.status(200).end();
});

// For API services isEnrolled and deleteEnrollment
async function processExtra(req, res, action) {
	var id = getId(req);

	if (id < 1) {
		return res.status(401).end();
	}
	if (!req.body.phone) {
		return res.status(400).json({ error: 'Missing phone parameter' });
	}
	let phone = req.body.phone;

	// Validate the phone number format
	try {
		let number = phoneUtil.parseAndKeepRawInput("+" + phone, '');

		if (!phoneUtil.isValidNumber(number)) {
			console.log(logText + "Invalid phone number: " + phone);

			return res.status(400).json({ error: 'Invalid phone number' });
		}
		console.log(logText + "Valid Phone: " + phone);
	} 
	catch (e) {
		console.log(logText + "Exception: Invalid phone number: " + phone);
	
		return res.status(400).json({ error: 'Invalid phone number' });
	}
	let channel = req.body.channel ? req.body.channel.trim().toLowerCase() : 'wa';
	
	if (services.indexOf(channel) < 0) { // Invalid service
		console.log(logText + "Invalid Service: " + channel);

		return res.status(400).json({ error: 'Invalid service' });
	}
	let vmetric = {
		timestamp: Math.floor(new Date() / 1000),
		phone: phone,
		channel: channel,
	}
	var ret;

	if (action == 'delete') {
		ret = vsDelete(vmetric, (resp) => { return res.status(200).json({ result: resp }) });
	} 
	else if (action == 'isenrolled') {
		if (users[vmetric.phone] && users[vmetric.phone].enrollment == encodeURI('verimetric_' + vmetric.phone + '_' + aConst)) {
			return res.status(200).json({ result: 'success' })
		} 
		else {
			ret = vsCheck(vmetric, (resp) => { return res.status(200).json({ result: resp }) });
		}
	}
}

// For API services verify and enroll
async function processRequest(req, res, action) {
 	// Get Authorization
	var id = getId(req);

	if (id < 1) {
		return res.status(401).end();
	}
	if (!req.body.phone) {
		return res.status(400).json({ error: 'Missing phone parameter' });
	}
	let timeout = req.body.timeout ? parseInt(req.body.timeout) : 300;

	if (timeout < 10 || timeout > 1800) {
		console.log(logText + "Invalid timeout: " + timeout);

		return res.status(400).json({ error: 'Invalid timeout' });
	}
	let language = req.body.language ? req.body.language.trim() : 'es';

	if (languages.indexOf(language) < 0) { // Invalid language
		console.log(logText + "Invalid language: " + language);

		return res.status(400).json({ error: 'Invalid language' });
	}
	let channel = req.body.channel ? req.body.channel.trim().toLowerCase() : 'wa';

	if (services.indexOf(channel) < 0) { // Invalid service
		console.log(logText + "Invalid Service: " + channel);

		return res.status(400).json({ error: 'Invalid service' });
	}
	// Url to send results
	let resultUrl = req.body.url ? req.body.url : gnids['APP_SERVER'] + gnids['WH_API_RESULTS'];

	// Client Phone
	let phone = req.body.phone;

	// Validate the phone number format
	try {
		let number = phoneUtil.parseAndKeepRawInput("+" + phone, '');

		if (!phoneUtil.isValidNumber(number)) {
			console.log(logText + "Invalid phone number: " + phone);

			return res.status(400).json({ error: 'Invalid phone number' });
		}
		console.log(logText + "Valid Phone: " + phone);
	}
	catch (e) {
		console.log(logText + "Exception: Invalid phone number: " + phone);

		return res.status(400).json({ error: 'Invalid phone number' });
	}

	if (!users[phone]) {
		users[phone] = { phone: phone }
	}

	// Check to see if there is already a request pending...
	let rkey = basekey + channel + ':' + phone;
	var vmetric = await hgetAsync(rkey);

	if (vmetric) {
		console.log(logText + "Already pending verimetric for " + rkey);
		console.log(logText + "Pending Verimetric: " + vmetric);
		
		if (vmetric.uuid) {
			return res.status(400).json({ error: 'Already pending' });
		}
	}

	// If override, check for existing before creating a new one
	if ((action == 'enroll') && !(req.body.override ? req.body.override : false)) { 
		let waiting = true;
		let exists = false;

		vsCheck({ channel: channel, phone: phone }, (resp) => {
			if (resp == 'success') {
				exists = true;
			}
			waiting = false;

			console.log(logText + "Returned from vsCheck callback");
		});
		let cnt = 0;

		while (waiting && (cnt < 50)) {
			cnt++;
			await sleep(100);
		}
		if (waiting) {
			console.log(logText + "Done checking for existing registration... timeout.");

			return res.status(400).json({ error: 'Registration existence internal error' });
		}
		if (exists) {
			console.log(logText + "Done checking for existing registration... There is one, stop.");

			return res.status(400).json({ error: 'Registration already exists' });
		}
		console.log(logText + "Done checking for existing registration... go on.");
	}

	let uuid = uuidv4();
	let pin = "" + Math.floor(Math.random() * 89999999 + 10000000); // Random 8 digit number

	let verimetric = {
		uuid: uuid,
		timestamp: Math.floor(new Date() / 1000),
		phone: phone,
		biometrics: -1,
		rawscore: 0,
		pinmatch: -1,
		pin: pin,
		done: 0,
		language: language,
		channel: channel,
		action: action,
		url: resultUrl,
	}
	console.log(logText + "Verimetric Request: " + JSON.stringify(verimetric));
	
	let fields = getFields(language);
	let randomSpace = pin.replace(/\B(?=(\d{1})+(?!\d))/g, " ");
	let templ = gnids.PIN_TEMPLATE;
	let text = fields.verify + randomSpace;

	if (action == 'verify') {
		console.log(logText + "Transaction Amount: " + req.body.amount);

		text = text.replace('%AMOUNT%', req.body.amount);
	}
	
	if (action == 'enroll') {
		templ = gnids.ENROLL_TEMPLATE;
		text = fields.pin + randomSpace + '. ' + fields.pin + randomSpace + '. ' + fields.pin + randomSpace + '.';
	}
	let vobj = getObject(templ, language, text);

	console.log(logText + "WA Template Object: " + JSON.stringify(vobj));

	await sendWA(phone, vobj);

	console.log(logText + "Verimetric Request sent");

	try {
		let dkey = basekey + uuid;

		rclient.hmset(dkey, verimetric, function (err) {
			if (err) {
				return res.status(400).json({ error: 'Internal redis error' });
			} 
			else {
				rclient.expire(dkey, 86400); // Expires in 24 hours
			}
		});

		rclient.hmset(rkey, verimetric, function (err) {
			if (err) {
				return res.status(400).json({ error: 'Internal redis error' });
			} 
			else {
				rclient.expire(rkey, timeout); // Expires in timeout seconds
				
				console.log(logText + "Verification request cached");
				
				return res.status(200).json({ requestid: uuid });
			}
		});
	} 
	catch (e) {
		return res.status(400).json({ error: 'Internal error' });
	}
}

app.post('/clear', async (req, res) => {
	/*
	{
	  phone: uuid
	}
	*/
	console.log(logText + "Got incoming clear request");

	var id = getId(req);
	
	if (id < 1) {
		return res.status(401).end();
	}
	if (!req.body.phone) {
		return res.status(400).json({ error: 'Missing phone parameter' });
	}
	let channel = req.body.channel ? req.body.channel.trim().toLowerCase() : 'wa';
	
	rclient.del(basekey + channel + ':' + req.body.phone);
	
	return res.status(200).end();
});

app.post('/check', async (req, res) => {
	console.log(logText + "---------  C H E C K - R E Q U E S T  ---------");
	console.log(logText + "Got incoming check request: " + JSON.stringify(req.body));

	var id = getId(req);
	
	if (id < 1) {
		return res.status(401).end();
	}
	if (!req.body.requestid) {
		return res.status(400).json({ error: 'Invalid requestid' });
	}
	let dkey = basekey + req.body.requestid;
	
	console.log(logText + "Checking for: " + dkey);
	
	rclient.hgetall(dkey, function (err, obj) {
		if (err) {
			return res.status(400).json({ error: 'Internal error' });
		}
		if (obj) {
			return res.status(200).json({
				id: obj.uuid,
				timestamp: obj.timestamp,
				phone: obj.phone,
				biometrics: obj.biometrics,
				rawscore: obj.rawscore,
				pinmatch: obj.pinmatch,
				language: obj.language,
				channel: obj.channel,
				action: obj.action,
			});
		} else {
			return res.status(400).json({ status: 'Invalid requestid' });
		}
	});
});

// WEBHOOKS
app.post('/event', (req, res) => {
	console.log(logText + "---------  E V E N T - R E Q U E S T  ---------");
	console.log(logText + "Got incoming event request: " + JSON.stringify(req.body));

	if (debug) {
		console.log(logText + "Event webhook: ");
		console.log(req.body);
	}
	return res.status(200).end();
});

app.post('/wa_inbound', async (req, res) => {
	console.log(logText + "---------  I N C O M I N G - I N B O U N D - W E B H O O K  ---------");
	console.log(logText + "Incoming Inbound Webhook");
	console.log(logText + "WhatsApp Inbound: " + JSON.stringify(req.body));

	if (!req.body.from || !req.body.from.number) {
		console.log(logText + "WhatsApp invalid Inbound");

		return res.status(200).end();
	}
	let phone = req.body.from.number;

	let channel = 'wa';
	let rkey = basekey + channel + ':' + phone;
	var vmetric = await hgetAsync(rkey);

	if (!vmetric) {
		// NOTE: Special Case scenario for MX (+52) numbers using "1" (mobile) addition...
		if (phone.startsWith('52') && phone.charAt(2) == '1') {
			phone = phone.slice(0, 2) + phone.slice(3);
			rkey = basekey + channel + ':' + phone;
			vmetric = await hgetAsync(rkey);

			if (!vmetric) {
				console.log(logText + "Not expecting anything from this number, ignore");
			}
		} 
		else {
			console.log(logText + "Not expecting anything from this number, ignore");
		}
		// Object VMETRIC creation failed therefor we need to inform user something went wrong
		console.log(logText + "Sending Error Message or Expiry Time Message");

		let sUrl = gnids['APP_SERVER'] + "/sendmessage";

		let language = req.body.language ? req.body.language.trim() : 'es';

		if (languages.indexOf(language) < 0) { // Invalid language
			console.log(logText + "Invalid language: " + language);

			return res.status(400).json({ error: 'Invalid language' });
		}
		let oFields = getFields(language);

		var sMessage = oFields.failedreg;			// CAN CONFIGURE EXPIRED TIME MESSAGE
		console.log(logText + "MESSAGE: " + sMessage);
		// Sending Message
		console.log(logText + "NServer SendMessage Url: " + sUrl);
		console.log(logText + "Posting Message to Client");

		request.post(sUrl, {
				headers: {
					"Authorization": "Basic ZXhvczoxMjM0NTY=",
					"content-type": "application/json",
				},
				json: true,
				body: {
					requestid: "expired",
					message: sMessage,
					msisdn: phone,
				},
			},
			function (error, response, body) {
				if (error) {
					console.log(logText + "Error posting message to client", error);
				}
			}
		);
		return res.status(200).end();
	}
	if (req.body.message && req.body.message.content.type == 'audio') {
		console.log(logText + "Processing incoming Audio");

		processAudio(phone, vmetric, req.body.message.content.audio.url);
	}
	return res.status(200).end();
});

app.post('/wa_status', (req, res) => {
	console.log(logText + "---------  I N C O M I N G - S T A T U S - W E B H O O K  ---------");
	console.log(logText + "Incoming Status Webhook");

	if (debug) {
		console.log(logText + "WhatsApp Status: " + JSON.stringify(req.body));
	}
	return res.status(200).end();
});

app.post('/results', (req, res) => {
	console.log(logText + "---------  I N C O M I N G - R E S U L T S - W E B H O O K  ---------");
	console.log(logText + "Incoming Results Webhook");

	let sUrl = gnids['APP_SERVER'] + "/sendmessage";

	let language = req.body.language ? req.body.language.trim() : 'es';

	if (languages.indexOf(language) < 0) { // Invalid language
		console.log(logText + "Invalid language: " + language);

		return res.status(400).json({ error: 'Invalid language' });
	}
	let oFields = getFields(language);

	var sMessage = "";

	if (debug) {
		console.log(logText + "WhatsApp Enroll Results: " + JSON.stringify(req.body));
	}

	if (req.body.action == "enroll") {
		// Successful Result
		if (req.body.biometrics == 1 && req.body.pinmatch == 1) {
			sMessage = oFields.registered;
		}	// Error Result
		else {
			sMessage = oFields.failreg;
		}
	}
	else {
		// Successful Result
		if (req.body.biometrics == 1 && req.body.pinmatch == 1) {
			sMessage = oFields.success;
		}	// Error Result
		else {
			sMessage = oFields.failed;
		}
	}

	// Sending Message
	console.log(logText + "WA SendMessage Url: " + sUrl);
	console.log(logText + "Posting Message to Client");
	
	request.post(sUrl, {
			headers: {
				"Authorization": "Basic ZXhvczoxMjM0NTY=",
				"content-type": "application/json",
			},
			json: true,
			body: {
				requestid: req.body.id,
				message: sMessage,
			},
		},
		function (error, response, body) {
			if (error) {
				console.log(logText + "Error posting message to client", error);
			}
		}
	);
	return res.status(200).end();
});

function toASCII(chars) {
	var ascii = '';
	for (var i = 0, l = chars.length; i < l; i++) {
		var c = chars[i].charCodeAt(0);

		// make sure we only convert half-full width char
		if (c >= 0xFF00 && c <= 0xFFEF) {
			c = 0xFF & (c + 0x20);
		}

		ascii += String.fromCharCode(c);
	}
	return ascii;
}

function digitText(digit) {
	let ret = digit;
	switch (digit) {
		case '0':
			ret = '(' + digit + '|zero|cero|zéro|ゼロ)';
			break
		case '1':
			ret = '(' + digit + '|one|won|uno|un|一|um|uma)';
			break
		case '2':
			ret = '(' + digit + '|two|to|too|dos|deux|二|dois|duas)';
			break
		case '3':
			ret = '(' + digit + '|three|tree|tres|trois|三|três)';
			break
		case '4':
			ret = '(' + digit + '|four|for|cuatro|quatre|四|quatro)';
			break
		case '5':
			ret = '(' + digit + '|five|cinco|cinq|五)';
			break
		case '6':
			ret = '(' + digit + '|six|seis|six|六)';
			break
		case '7':
			ret = '(' + digit + '|seven|siete|sept|七|sete)';
			break
		case '8':
			ret = '(' + digit + '|eight|ate|ocho|huit|八|oito)';
			break
		case '9':
			ret = '(' + digit + '|nine|nueve|neuf|九|nove)';
			break
		default:
			break
	}
	return ret;
}

function setRedis(rkey, key, val, vmetric, done = 0) {
	if (debug) {
		console.log(logText + "In setRedis: " + rkey + " " + key + " " + val + " " + done);
	}
	if (done == 1) {
		rclient.exists(rkey, (err, res) => {
			if (!err && res === 1) {
				rclient.hset(rkey, 'done', 1, (err, res) => {
					if (debug) {
						console.log(logText + "In setRedis DONE " + key + " " + val);
					}
					rclient.hset(rkey, key, val, (err, res) => {
						checkDone(vmetric)
					})
				})
			}
		});
	} 
	else {
		rclient.exists(rkey, (err, res) => {
			if (!err && res === 1) {
				if (debug) {
					console.log(logText + "In setRedis " + key + " " + val);
				}
				rclient.hset(rkey, key, val, (err, res) => {
					checkDone(vmetric)
				})
			}
		});
	}
}

async function processText(vmetric, payload) {
	var date = new Date().toLocaleString();

	console.log(logText + "Speechmatics smSocket transcription at " + date + ": " + payload);
	
	let rkey = basekey + vmetric.channel + ':' + vmetric.phone;

	// Does the transcript match the random key???
	if (payload) {
		var validation = vmetric.pin;

		if (debug) {
			console.log(logText + "In processtext... still got validation key? " + validation);
		}
		if (validation) {
			let digits = validation.split('');

			console.log(logText + "Split validation code: ", digits);

			let matcher = '';

			for (let index = 1; index < (digits.length - 1); index++) { // The INSIDE digits... leave one on each end for late start/early end recording
				matcher = matcher + digitText(digits[index]) + '(\\D*)';
			}
			payload = toASCII(payload); // Account for fullwidth Unicode (such as Japanese translation!)

			console.log(logText + "Checking to see if " + payload + " matches regex: " + matcher);

			let ok = payload.match(matcher);

			console.log(logText + "Did we match it?");
			
			if (ok) {
				console.log(logText + "Yes! for " + rkey);

				setRedis(rkey, 'pinmatch', 1, vmetric);
			} 
			else {
				console.log(logText + "Sorry! Transcription mismatch... for " + rkey);

				setRedis(rkey, 'pinmatch', 0, vmetric, 0); // Setting done=0, to give another chance
			}
		}
	}
}

function smSocket(vmetric) {
	var W3CWebSocket = require('websocket').w3cwebsocket;

	let smurl = gnids.S_MURL;
	let rkey = basekey + vmetric.channel + ':' + vmetric.phone;

	var client = new W3CWebSocket(smurl, {
		protocolVersion: 8,
		rejectUnauthorized: false,
		origin: smurl
	});

	client.binaryType = "arraybuffer";
	client.onopen = function (event) {
		let key = basekey + 'smclient:' + vmetric.uuid;

		console.log(logText + "Speechmatics onOpen for " + vmetric.phone);

		rclient.set(key, 1, function (err) {
			if (err) {
				console.log(logText + "Redis error verimetrics:smclient: ", err)
			} 
			else {
				rclient.expire(key, 60); // Expires in 60 seconds
			}
		});
	}; //onopen

	client.onmessage = function (event) {
		var data = JSON.parse(event.data);
		var date = new Date().toLocaleString();
		let payload;

		switch (data.message) {
			case "RecognitionStarted":
				console.log(logText + "Speechmatics RecognitionStarted for " + vmetric.phone + " at " + date);

				let key = basekey + 'smstarted:' + vmetric.uuid;

				rclient.set(key, 1, function (err) {
					if (err) {
						console.log(logText + "Redis error verimetrics:smstarted: ", err)
					} else {
						rclient.expire(key, 60); // Expires in 60 seconds
					}
				});
				users[vmetric.phone].payload = '';
				break;
			case "AudioAdded":
				break;
			case "AddPartialTranscript":
				break;
			case "AddTranscript":
				payload = users[vmetric.phone].payload;
				payload = payload + (data.metadata.transcript).trim() + ' ';
				
				users[vmetric.phone].payload = payload;
				
				break;
			case "EndOfTranscript":
				console.log("Received SM EndOfTranscript message at " + date + " - " + data.metadata);

				payload = users[vmetric.phone].payload;
				
				if (payload.length > 0) {
					processText(vmetric, payload);
					users[vmetric.phone].payload = null;
					closeSM(client);
				}
				break;
			case "Info":
			case "Warning":
			case "Error":
				console.log(logText + "Speechmatics smSocket onMessage info/warning/error at " + date);
				console.log(logText + "Data: " + JSON.stringify(data));
				
				break;
			default:
				console.log(logText + "Speechmatics UNKNOWN MESSAGE: " + data.message);
		};
	};
	client.onclose = function (event) {
		console.log(logText + "Speechmatics smSocket client WS close " + vmetric.phone);
	};
	client.onerror = function (event) {
		setRedis(rkey, 'pinmatch', 0, vmetric, 1);

		console.log(logText + "Speechmatics smSocket client WS error: " + "connection error");
		console.log(logText + "Event: " + JSON.stringify(event));
	};
	return client;
}

function closeSM(smSock) {
	var msg = {
		"message": "EndOfStream",
	};
	if (smSock.readyState === smSock.OPEN) {
		smSock.send(JSON.stringify(msg));
	}
	console.log(logText + "Speechmatics smSocket Vonage-side WS close");

	smSock.close();
	smSock = null;
}

async function smStart(smSock, vmetric) {
	let rkey = basekey + vmetric.channel + ':' + vmetric.phone;
	var msg = {
		"message": "StartRecognition",
		"transcription_config": {
			"language": vmetric.language,
			"max_delay": 8,
		},
		"audio_format": {
			"type": "file",
		},
	};
	try {
		smSock.send(JSON.stringify(msg));
	} 
	catch (err) {
		console.log(logText + "smClient websocket closed unexpectedly...");

		setRedis(rkey, 'pinmatch', 0, vmetric, 1);
	}
}

async function smFile(smSock, fn, data, vmetric) {
	let key = basekey + 'smstarted:' + vmetric.uuid;
	let rkey = basekey + vmetric.channel + ':' + vmetric.phone;
	var contents = fs.readFileSync('/tmp/' + fn + '.ogg');
	let cnt = 0;

	const interval = setInterval(function () {
		rclient.get(key, function (err, reply) {
			// reply is null when the key is missing
			if (err || !reply) {
				cnt++;
				if (cnt > 50) {
					clearInterval(interval);
					rclient.del(key);

					console.log(logText + "smStarted timed out waiting for the sm connection");

					setRedis(rkey, 'pinmatch', 0, vmetric, 1);
				}
			} 
			else {
				clearInterval(interval);
				rclient.del(key);

				console.log(logText + "smFile got smStarted");
				
				let splitSize = 1024;
				
				if (debug) {
					console.log(logText + "Starting send of bytes: " + contents.length);
				}
				let seqNo = 0;

				for (var start = 0; start < contents.length; start += splitSize) {
					smSock.send(contents.slice(start, start + splitSize));
					seqNo++;
				}
				if (debug) {
					console.log(logText + "Done with send of bytes: " + contents.length);
				}
				setTimeout(() => {
					console.log(logText + "Sending EndOfStream");

					let msg = JSON.stringify({ "message": "EndOfStream", "last_seq_no": seqNo });
					smSock.send(msg);
				}, 20);
			}
		})
	}, 100);
}

async function smTranscribe(fn, data, vmetric) {
	var smsock = smSocket(vmetric);
	let cnt = 0;
	let rkey = basekey + vmetric.channel + ':' + vmetric.phone;
	
	const interval = setInterval(function () {
		rclient.get(basekey + 'smclient:' + vmetric.uuid, function (err, reply) {
			// reply is null when the key is missing
			if (err || !reply) {
				cnt++;
				
				if (cnt > 50) {
					clearInterval(interval);
					setRedis(rkey, 'pinmatch', 0, vmetric, 1);
					rclient.del(basekey + 'smclient:' + vmetric.uuid);
					var date = new Date().toLocaleString();
					
					console.log(logText + "smTranscribe timed out waiting for the sm connection at " + date);
				}
			} 
			else {
				rclient.del(basekey + 'smclient:' + vmetric.uuid);
				clearInterval(interval);
				var date = new Date().toLocaleString();
				
				console.log(logText + "smTranscribe got sm connection at " + date)
				
				smStart(smsock, vmetric);
				smFile(smsock, fn, data, vmetric);
			}
		})
	}, 100);
}

// Call to Validsoft Enroll Service
async function vsCheck(vmetric, callback) {
	var vkey = encodeURI('verimetric_' + vmetric.phone + '_' + aConst); ////// ENROLMENT FORMAT!!!!

	console.log(logText + "Checking Registration for ValidSoft user id: " + vkey)
	
	// Validsoft Body
	let body = {
		serviceData: {
			loggingId: "VeriMetrics_logging_001_WhatsApp_" + gnids['INSTANCE']
		},
		userData: {
			identifier: vkey
		},
		processingInformation: {
			biometric: {
				type: "text-independent",
				mode: "td_16k_19_generic"
			},
			metaInformation: [
				{
					key: "usage-context",
					value: {
						value: "verimetrics",
						encrypted: false
					}
				}
			]
		}
	};
	let serviceUrl = gnids.VS_URL;

	console.log(logText + "Checking for Speaker at: " + serviceUrl + "isSpeakerEnrolled " + vkey);

	request.post(serviceUrl + 'isSpeakerEnrolled', {
		'auth': {
			'user': gnids.VS_USER, 'pass': gnids.VS_PASSWORD, 'sendImmediately': false
		},
		headers: {
			"content-type": "application/json",
		},
		json: true,
		body: body,
	},
		function (error, response, body) {
			try {
				console.info(logText + "---------  V S - R E S P O N S E  ---------");
				console.log(logText + "Check Speaker Response Code: " + response.statusCode);

				if (response.body) {
					console.log(logText + "Check Speaker Response Body: " + JSON.stringify(response.body));
				}
				if (response.statusCode == 200) {
					if (body && body.outcome) {
						if (body.outcome == "KNOWN_USER_ACTIVE") {
							if (!users[vmetric.phone]) {
								users[vmetric.phone] = { phone: vmetric.phone }
							}
							users[vmetric.phone].enrollment = vkey;

							if (callback) {
								callback('success');
								return;
							}
						} 
						else {
							if (!users[vmetric.phone]) {
								users[vmetric.phone] = { phone: vmetric.phone }
							}
							users[vmetric.phone].enrollment = '';

							if (callback) {
								callback(body.outcome); 
								return;
							}
						}
					}
					return;
				} 
				else {
					if (callback) {
						callback('failure');
						return;
					}
					if (error) {
						console.error(logText + "HTTP Error [ " + response.statusCode + " ]", error.body);
					}
				}
			} 
			catch (error1) {
				if (callback) {
					callback('failure');
					return;
				}
				console.log(logText + "Check Speaker error");

				if (response) {
					if (error1) { 
						console.log(logText + "Exception: Unhandled Error [ " + response.statusCode + " ]", error1); 
					}
				} 
				else {
					if (error1) { 
						console.log(logText + "Exception: Unhandled Error", error1); 
					};
				}
			}
		}
	);
}

async function vsDelete(vmetric, callback) {
	var vkey = encodeURI('verimetric_' + vmetric.phone + '_' + aConst); ////// ENROLMENT FORMAT!!!!
	
	console.log(logText + "Deleting ValidSoft user id: " + vkey)
	
	if (users[vmetric.phone]) {
		delete users[vmetric.phone];
	}
	let body = {
		serviceData: {
			loggingId: "VeriMetrics_logging_001_WhatsApp_" + gnids['INSTANCE']
		},
		userData: {
			identifier: vkey
		},
		processingInformation: {
			biometric: {
				type: "text-independent"
			},
			metaInformation: [
				{
					key: "usage-context",
					value: {
						value: "verimetrics",
						encrypted: false
					}
				}
			]
		},
	};
	let serviceUrl = gnids.VS_URL;

	if (debug) {
		console.log(logText + "Deleting Speaker at: " + serviceUrl + "deleteSpeaker");
	}
	request.post(serviceUrl + 'deleteSpeaker', {
		'auth': {
			'user': gnids.VS_USER, 'pass': gnids.VS_PASSWORD, 'sendImmediately': false
		},
		headers: {
			"content-type": "application/json",
		},
		json: true,
		body: body,
	},
		function (error, response, body) {
			try {
				console.info(logText + "---------  V S - R E S P O N S E  ---------");
				console.log(logText + "Delete Speaker Response Code: " + response.statusCode);

				if (response.body) {
					console.log(logText + "Delete Speaker Response Body: " + JSON.stringify(response.body));
				}
				if (response.statusCode == 200) {
					if (body && body.outcome) {
						if (body.outcome == "SUCCESS") {
							if (callback) {
								callback('success');
							}
						}
					}
					return;
				} 
				else {
					if (callback) {
						callback('failure');
					}
					if (error) {
						console.log(logText + "deleteSpeaker HTTP Error [ " + response.statusCode + " ]", error.body);
					}
				}
			} 
			catch (error1) {
				if (callback) {
					callback('failure');
				}
				console.log(logText + "deleteSpeaker error");
				
				if (response) {
					if (error1) { 
						console.log(logText + "Exception: deleteSpeaker Unhandled Error [ " + response.statusCode + " ]", error1); 
					}
				} 
				else {
					if (error1) { 
						console.log(logText + "Exception: deleteSpeaker Unhandled Error", error1); 
					};
				}
			}
		}
	);
}

async function vsValidate(fn, b64, vmetric) {
	let rkey = basekey + vmetric.channel + ':' + vmetric.phone;
	var vkey = encodeURI('verimetric_' + vmetric.phone + '_' + aConst); ////// ENROLMENT FORMAT!!!!
	
	console.log(logText + "Validation ValidSoft user id: " + vkey)
	
	let body = {
		serviceData: {
			loggingId: "VeriMetrics_logging_001_WhatsApp_" + gnids['INSTANCE']
		},
		userData: {
			identifier: vkey
		},
		audioInput: {
			secondsThreshold: "0",
			audio: {
				base64: b64
			}
		},
		processingInformation: {
			biometric: {
				type: "text-independent",
				mode: "td_16k_19_generic"
			},
			audioCharacteristics: {
				samplingRate: 16000,
				format: "pcm16"
			},
			metaInformation: [
				{
					key: "usage-context",
					value: {
						value: "verimetrics",
						encrypted: false
					}
				},
				{
					key: "get-snr",
					value: {
						value: "8.0",
						encrypted: false
					}
				},
				{
					key: "detect-speech-td",
					value: {
						value: "20",
						encrypted: false
					}
				}
			]
		},
	};
	let tmpUrl = gnids.VS_URL;
	if (debug) {
		console.log(logText + "verifying Speaker at: " + tmpUrl + "verifySpeaker");
	}
	request.post(tmpUrl + 'verifySpeaker', {
		'auth': {
			'user': gnids.VS_USER, 'pass': gnids.VS_PASSWORD, 'sendImmediately': true
		},
		headers: {
			"content-type": "application/json",
		},
		json: true,
		body: body,
	},
		function (error, response, body) {
			try {				
				console.info(logText + "---------  V S - R E S P O N S E  ---------");
				console.log(logText + "Verify Speaker Response Code: " + response.statusCode);

				if (response.body) {
					console.log(logText + "Verify Speaker Response Body: " + JSON.stringify(response.body));
				}
				if (response.statusCode == 200) {
					if (body && body.result && body.result.metaInformation) {

						console.info(logText + "Meta Information: " + body.result.metaInformation);
					}
					return gotValidation(vmetric, 0, body);
				} 
				else {
					if (error) {
						console.log(logText + "HTTP Error [ " + response.statusCode + " ]", error.body);

						gotValidation(vmetric, 1, error.body);
					}
				}
			} 
			catch (error1) {
				console.log(logText + "VS init error");

				if (response) {
					if (error1) { 
						console.log(logText + "Unhandled Error [ " + response.statusCode + " ]", error1); 
					}
				} 
				else {
					if (error1) { 
						console.log(logText + "Unhandled Error", error1); 
					};
				}
				gotValidation(vmetric, 1, 'Unspecified Error');
			}
		}
	);
}

async function vsRegister(fn, data, vmetric) {
	let rkey = basekey + vmetric.channel + ':' + vmetric.phone;
	var vkey = encodeURI('verimetric_' + vmetric.phone + '_' + aConst); ////// ENROLMENT FORMAT!!!!

	console.log(logText + "Registration ValidSoft user id: " + vkey);

	let body = {
		serviceData: {
			loggingId: "VeriMetrics_logging_001_WhatsApp_" + gnids['INSTANCE']
		},
		userData: {
			identifier: vkey
		},
		audioInput: {
			secondsThreshold: "0",
			audio: {
				base64: data
			}
		},
		processingInformation: {
			biometric: {
				type: "text-independent",
				mode: "td_16k_19_generic"
			},
			audioCharacteristics: {
				samplingRate: 16000,
				format: "pcm16"
			},
			metaInformation: [
				{
					key: "usage-context",
					value: {
						value: "verimetrics",
						encrypted: false
					}
				},
				{
					key: "get-snr",
					value: {
						value: "8.0",
						encrypted: false
					}
				},
				{
					key: "detect-speech-td",
					value: {
						value: "20",
						encrypted: false
					}
				}
			]
		},
	};
	let tmpUrl = gnids.VS_URL;

	console.log(logText + "Validsoft Call Request Body: " + JSON.stringify(body));

	if (debug) {
		console.log(logText + "File enroling Speaker at: " + tmpUrl + "enrolSpeaker");
	}
	request.post(tmpUrl + 'enrolSpeaker', {
		'auth': {
			'user': gnids.VS_USER, 'pass': gnids.VS_PASSWORD, 'sendImmediately': true
		},
		headers: {
			"content-type": "application/json",
		},
		json: true,
		body: body,
	},
		function (error, response, body) {
			try {
				console.info(logText + "---------  V S - R E S P O N S E  ---------");
				console.log(logText + "Enroll Speaker Response Code: " + response.statusCode);

				if (response.body) {
					console.log(logText + "Enroll Speaker Response Body: " + JSON.stringify(response.body));
				}
				if (response.statusCode == 200) {
					users[vmetric.phone].enrollment = vkey;
					setRedis(rkey, 'biometrics', 1, vmetric, 0);

					if (body && body.result && body.result.metaInformation) {
						console.info(logText + "Meta Information: " + body.result.metaInformation);
					}
					return;
				} 
				else {
					setRedis(rkey, 'biometrics', 0, vmetric, 1);

					if (error) {
						console.error(logText + "HTTP Error Response: " + response.statusCode);
						console.error(logText + "HTTP Error Body: " + error.body)
					}
				}
			} 
			catch (error1) {
				setRedis(rkey, 'biometrics', 0, vmetric, 1);

				console.log(logText + "Enroll Speaker Error");

				if (response) {
					if (error1) { 
						console.log(logText + "Exception: Unhandled Error Response: " + response.statusCode); 
						console.error(logText + "Error Body: " + error1);
					}
				} 
				else {
					if (error1) { 
						console.log(logText + "Exception: Unhandled Error: " + error1); 
					};
				}
			}
		}
	);
}

function checkDone(vmetric) {
	let rkey = basekey + vmetric.channel + ':' + vmetric.phone;

	console.log(logText + "In checkDone for: " + rkey);

	rclient.hgetall(rkey, function (err, obj) {
		if (!err && obj) {
			console.log(logText + "In checkDone with results: " + JSON.stringify(obj));

			if (parseInt(obj.done) > 0 || (parseInt(obj.biometrics) >= 0 && parseInt(obj.pinmatch) >= 0)) { // We are done!
				// First, delete the key (open up for new requests)
				if ((parseInt(obj.biometrics) > 0 && parseInt(obj.pinmatch) > 0)) { // Only delete on success, so they can retry on failure
					rclient.del(rkey);
				}
				//Then, move it to the completed queue, based on uuid
				let dkey = basekey + obj.uuid;
				rclient.hmset(dkey, obj);

				if (obj.url && obj.url.length > 5) { // ooh, we have a callback!  Let them know the results.
					request.post(obj.url, {
						headers: {
							"content-type": "application/json",
						},
						json: true,
						body: {
							id: obj.uuid,
							timestamp: Math.floor(new Date() / 1000),
							phone: obj.phone,
							biometrics: obj.biometrics,
							rawscore: obj.rawscore,
							pinmatch: obj.pinmatch,
							language: obj.language,
							channel: obj.channel,
							action: obj.action,
						},
					},
						function (error, response, body) {
							if (error) {
								console.log(logText + "Error posting results to " + obj.url + ": ", error);
							} 
							else {
								console.log(logText + "Success, verimetrics results posted to " + obj.url);
							}
						}
					);
				}
			}
		}
	});
}
function gotValidation(vmetric, err, body) {
	let rkey = basekey + vmetric.channel + ':' + vmetric.phone;
	
	if (err) {
		setRedis(rkey, 'biometrics', 0, vmetric, 1);
	} 
	else {
		// Check here in body for results...
		if (body && body.result && body.result.score) {
			let score = parseFloat(body.result.score);

			rclient.exists(rkey, (err, res) => {
				rclient.hset(rkey, 'rawscore', score, (err, res) => {
					if (score >= gnids.VS_THRESHOLD) {
						setRedis(rkey, 'biometrics', 1, vmetric, 0);
					} 
					else {
						setRedis(rkey, 'biometrics', 0, vmetric, 1);
					}
				})
			})
		} 
		else {
			setRedis(rkey, 'biometrics', 0, vmetric, 1);
		}
	}
}

async function clearRequest(vmetric) {
	// If both Biometrics and PIN are valid, leave it alone.
	// We shouldn't see this, because it would be deleted and moved to the 24-hour queue
	if ((parseInt(vmetric.biometrics) >= 0 && parseInt(vmetric.pinmatch) >= 0)) {
		return;
	}
	if (parseInt(vmetric.done) == 1 || (parseInt(vmetric.biometrics) < 0 && parseInt(vmetric.pinmatch) < 0)) {
		return;
	}
	let rkey = basekey + vmetric.channel + ':' + vmetric.phone;
	
	rclient.hset(rkey, 'biometrics', -1, (err, res) => {
		rclient.hset(rkey, 'pinmatch', -1, (err, res) => {
			rclient.hset(rkey, 'done', 0, (err, res) => {
				rclient.hset(rkey, 'rawscore', 0, (err, res) => {
				})
			})
		})
	})
}

function deleteFile(url) {
	request.delete(url, {
		headers: {
			'Authorization': 'Bearer ' + gjwt,
			"content-type": "application/json",
		},
		json: false,
		body: '{}',
	},
		function (error, response, body) {
			if (debug) {
				if (error) {
					console.log(logText + "Error deleting url " + url, error);
				} 
				else {
					console.log(logText + "Deleted url " + url);
				}
			}
		})
}

async function processAudio(phone, vmetric, url) {
	if (debug) {
		console.log(logText + "Audio received: " + url);
	}
	let fields = getFields(vmetric.language);

	if (vmetric.action == 'verify' || vmetric.action == 'enroll') {
		// Ok, got an audio file, and we know we need to validate it... here we go!
		let obj2 = {
			content: {
				type: "text",
				text: (vmetric.action == 'verify' ? fields.wait : fields.waitreg)
			}
		}
		await sendWA(phone, obj2);

		// Clear out any pending process...
		await clearRequest(vmetric);

		var smRequest = require('request').defaults({ encoding: null });

		//First, get the file into a buffer, for SM and VS to use
		smRequest.get(url, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var date = new Date().toLocaleString();
				
				console.log(logText + "Got buffer chock-full of delicious Audio Data at " + date + " !")
				
				let data = body;

				if (debug) {
					console.log(logText + "How much Audio Data? " + data.length);
				}
				let fn = 'verimetrics_' + phone + '_' + vmetric.uuid;

				// Validate key
				fs.writeFile('/tmp/' + fn + '.ogg', data, (err) => {
					if (err) {
						console.log(logText + "Writing error: ", err);
					} 
					else {
						date = new Date().toLocaleString();
					
						if (debug) {
							console.log(logText + "File Written at " + date);
						}
						deleteFile(url);

						let b64 = Buffer.from(data).toString('base64');

						// Transcribe voice
						smTranscribe(fn, data, vmetric);

						// Validate voice
						if (vmetric.action == 'verify') {
							vsValidate(fn, b64, vmetric);
						} 
						else if (vmetric.action == 'enroll') {
							vsRegister(fn, b64, vmetric);
						}
					}
				}
				)
			} 
			else {
				if (debug) {
					console.log(logText + "Error retrieving audio file " + url);
				}
			}
		});
	}
}

console.log(logText + "Im Here");

app.use('/', express.static(__dirname));

//-----------
var date = new Date().toLocaleString();

console.log(logText + "Starting up verimetrics server (" + gnids['INSTANCE'] + ") at " + date);

app.listen(app_port, '0.0.0.0', () => {
	console.log(logText + "Verimetrics Server listening on port " + app_port);
});
