'use strict'
// SET ENVIRONMENT VARIABLE "instance" to the company/instance (one word) name
require('dotenv').config();

// Paths
const NODE_MODULES = "../node_modules/";
const CONFIG_PATH = "./config/";
const UTILS_PATH = "./utils/";
const DB_PATH = "./db/";
const LIB_PATH = "./lib/";

// Classes
const oEnvironment = require(CONFIG_PATH + "domain-config");
const oLocalization = require(CONFIG_PATH + "localization");
const oDatabase = require(DB_PATH + "database");
const oNexmo = require(UTILS_PATH + "nexmo");
const oValidSoft = require(LIB_PATH + "validsoft");
const oSpeechmatics = require(LIB_PATH + "speechmatics");

// Libraries
const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const request = require('request');
var fs = require('fs');
const uuidv4 = require('uuid/v4');
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();
const storage = require('node-persist');
const { json } = require('body-parser');

// Variables
var port = 8017;
var wnexmo;
const services = ["wa", "vb"]; // WhatsApp, Viber
const languages = ["en", "es", "fr", "ja", "pt", "es_MX"];
var users = [];
var gjwt = '';
var basekey = 'verimetrics:';
var debug = 1;

// Extraparams set
var extraparams = {
	gnids: null,
	rClient: null,
	basekey: null,
	aConst: null,
	users: null,
}

// Log
const path = require(NODE_MODULES + "path");

var logText = "[" + path.basename(__filename) + "]    ";

// Program Start
console.log(logText + "*********************************");
console.log(logText + "***   V E R I M E T R I C S   ***");
console.log(logText + "*********************************");

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Load Environment Properties
let gnids = oEnvironment.getEnv();

if (debug) {
	console.log(logText + "Global Parameters: " + JSON.stringify(gnids));
}

if (gnids['PORT'] && gnids['PORT'].length > 0) {
	port = gnids['PORT'];
}

if (gnids['DEBUG'] && gnids['DEBUG'].length > 0) {
	debug = gnids['DEBUG'];
}

if (gnids['INSTANCE'] && gnids['INSTANCE'].length > 0) {
	basekey = gnids['INSTANCE'] + ':verimetrics:';
}

if (gnids['N_SERVER'].indexOf('ngrok') > 0) {
	port = 8010;
}

// Load Localization Languages
var localization = oLocalization.getLocalization();

if (debug) {
	console.log(logText + "Localization: " + JSON.stringify(localization));
}

// Load DB Connection
let oGetClient = oDatabase.getClient(gnids['REDIS_HOST'], gnids['REDIS_PORT']);
const rClient = oGetClient.rClient;
const getAsync = oGetClient.getAsync;
const hgetAsync = oGetClient.hgetAsync;

var aConst;
storage.init().then(async function () {
	aConst = await storage.getItem('verimetricsConstant_' + gnids['INSTANCE']);

	console.log(logText + "Storage aConst: " + aConst);
	if (!aConst) {

		aConst = Math.floor(new Date() / 1000);
		storage.setItem('verimetricsConstant_' + gnids['INSTANCE'], aConst);

		console.log(logText + "New Storage aConst: " + aConst);
	}
})

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

// Extraparams set
extraparams = {
	gnids: gnids,
	rClient: rClient,
	basekey: basekey,
	aConst: aConst,
	users: users,
}
// Initialize Nexmo Object
wnexmo = oNexmo.initialize(extraparams);

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

	if (parseInt(gnids['VONAGE']) > 0) { // Do some actual authorization checking here...
		res = 1;
	}
	else { // Not the Vonage account... check actual values!!!
		if (username == gnids['APP_USER'] && password == gnids['APP_PASSWORD']) {
			res = 1;
		}
	}
	console.log(logText + "Authorization Result: " + res);

	return res;
}

function getId(req) {
	console.log(logText + "Getting Id");

	var id = getAuth(req);

	return id;
}

function getObject(templ, language, text) {
	console.log(logText + "Getting Object");

	let lng = (language == 'pt' ? 'pt_BR' : language);
	let obj = {
		"content": {
			"type": "custom",
			"custom": {
				"type": "template",
				"template": {
					"namespace": gnids['WA_NAMESPACE'],
					"name": templ,
					"language": {
						"policy": "deterministic",
						"code": lng
					},
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
	}
	return obj;
}

// Services
app.post('/login', async (req, res) => {
	console.log(logText + "---------  L O G I N - R E Q U E S T  ---------");
	console.log(logText + "Got incoming verify request: " + JSON.stringify(req.body));

	var type = req.body.type;
	var user = req.body.user;
	var pass = req.body.pass;

	if (type == 'bank') {
		if (user == 'test_bank@mailinator.com') {
			if (password == '12345678') {
				return res.status(200).end();
			}
			else {
				return res.status(400).json({ error: 'Login failed, incorrect password' });
			}
		}
		else {
			return res.status(400).json({ error: 'Login failed, incorrect user' });
		}
	}
	else {
		if (user == 'test_store@mailinator.com') {
			if (password == '12345678') {
				return res.status(200).end();
			}
			else {
				return res.status(400).json({ error: 'Login failed, incorrect password' });
			}
		}
		else {
			return res.status(400).json({ error: 'Login failed, incorrect password' });
		}

	}
});

app.post('/verify', async (req, res) => {
	console.log(logText + "---------  V E R I F Y - R E Q U E S T  ---------");
	console.log(logText + "Got incoming verify request: " + JSON.stringify(req.body));

	processRequest(req, res, 'verify');
});

app.post('/enroll', async (req, res) => {
	console.log(logText + "---------  E N R O L L - R E Q U E S T  ---------");
	console.log(logText + "Got incoming enroll request: " + JSON.stringify(req.body));

	processRequest(req, res, 'enroll');
});

app.post('/isenrolled', async (req, res) => {
	console.log(logText + "---------   I S - E N R O L L - R E Q U E S T  ---------");
	console.log(logText + "Got incoming isenrolled request: " + JSON.stringify(req.body));

	processExtra(req, res, 'isenrolled');
});

app.post('/deleteenrollment', async (req, res) => {
	console.log(logText + "---------  D E L E T E - E N R O L L - R E Q U E S T  ---------");
	console.log(logText + "Got incoming deleteenrollment request: " + JSON.stringify(req.body));

	processExtra(req, res, 'delete');
});

app.post('/sendmessage', async (req, res) => {
	console.log(logText + "---------  S E N D - M E S S A G E - R E Q U E S T  ---------");
	console.log(logText + "Got incoming sendmessage request: " + JSON.stringify(req.body));

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
	rClient.hgetall(dkey, function (err, obj) {
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
			// Extraparams set
			extraparams = {
				gnids: gnids,
				rClient: rClient,
				basekey: basekey,
				aConst: aConst,
				users: users,
			}
			oNexmo.sendWA(obj.phone, obj2, extraparams);

			return res.status(200).end();
		}
		else {
			return res.status(400).json({ error: 'Invalid requestid' });
		}
	});
});

app.post('/resetallusers', async (req, res) => {
	console.log(logText + "---------  R E S E T - A L L - U S E R S - R E Q U E S T  ---------");
	console.log(logText + "Got incoming resetallusers request" + JSON.stringify(req.body));

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

app.post('/clear', async (req, res) => {
	console.log(logText + "---------  C L E A R - R E Q U E S T  ---------");
	console.log(logText + "Got incoming clear request: " + JSON.stringify(req.body));

	var id = getId(req);

	if (id < 1) {
		return res.status(401).end();
	}
	if (!req.body.phone) {
		return res.status(400).json({ error: 'Missing phone parameter' });
	}
	let channel = req.body.channel ? req.body.channel.trim().toLowerCase() : 'wa';

	rClient.del(basekey + channel + ':' + req.body.phone);

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

	console.log(logText + "checking for " + dkey);

	rClient.hgetall(dkey, function (err, obj) {
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

// Webhooks
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

				return res.status(200).end();
			}
		}
		else {
			console.log(logText + "Not expecting anything from this number, ignore");

			return res.status(200).end();
		}
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
	console.log(logText + "---------  I N C O M I N G - R E S U L TS - W E B H O O K  ---------");
	console.log(logText + "Incoming Results Webhook");

	let sUrl = gnids['N_SERVER'] + "/sendmessage";
	let oFields = oLocalization.getFields(req.body.language);

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
	console.log(logText + "NServer SendMessage Url: " + sUrl);

	request.post(sUrl, {
			headers: {
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

	// Extraparams set
	extraparams = {
		gnids: gnids,
		rClient: rClient,
		basekey: basekey,
		aConst: aConst,
		users: users,
	}

	if (action == 'delete') {
		ret = oValidSoft.vsDelete(vmetric, (resp) => { return res.status(200).json({ result: resp }) }, extraparams);
	}
	else if (action == 'isenrolled') {
		if (users[vmetric.phone] && users[vmetric.phone].enrollment == encodeURI('verimetric_' + vmetric.phone + '_' + aConst)) {
			return res.status(200).json({ result: 'success' })
		}
		else {
			ret = oValidSoft.vsCheck(vmetric, (resp) => { return res.status(200).json({ result: resp }) }, extraparams);
		}
	}
}

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
//	let language = req.body.language ? req.body.language.trim().toLowerCase() : 'en';
	let language = req.body.language ? req.body.language.trim() : 'en';

	if (languages.indexOf(language) < 0) { // Invalid language
		console.log(logText + "Invalid language: " + language);

		return res.status(400).json({ error: 'Invalid language' });
	}
	let channel = req.body.channel ? req.body.channel.trim().toLowerCase() : 'wa';

	if (services.indexOf(channel) < 0) { // Invalid service
		console.log(logText + "Invalid Service: " + channel);

		return res.status(400).json({ error: 'Invalid service' });
	}
	let aurl = req.body.url ? req.body.url : '';
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

		// Extraparams set
		extraparams = {
			gnids: gnids,
			rClient: rClient,
			basekey: basekey,
			aConst: aConst,
			users: users,
		}
		oValidSoft.vsCheck({ channel: channel, phone: phone }, (resp) => {
			if (resp == 'success') {
				exists = true;
			}
			waiting = false;

			console.log(logText + "Returned from vsCheck callback");
		}, extraparams);
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
		url: aurl,
	}
	console.log(logText + "Verimetric Request: " + JSON.stringify(verimetric));

	let url = gnids['N_SERVER'] + "/wa_inbound";

	console.log(logText + "NServer WA Inbound Url: " + url);

	// Extraparams set
	extraparams = {
		gnids: gnids,
		rClient: rClient,
		basekey: basekey,
		aConst: aConst,
		users: users,
	}
	oNexmo.registerWA(phone, url, 'incoming', extraparams);

	url = gnids['N_SERVER'] + "/wa_status";

	console.log(logText + "NServer WA Status Url: " + url);

	oNexmo.registerWA(phone, url, 'event', extraparams);

	let fields = oLocalization.getFields(language);
	let randomSpace = pin.replace(/\B(?=(\d{1})+(?!\d))/g, " ");
	let templ = gnids['PIN_TEMPLATE'];
	let text = fields.verify + randomSpace;

	if (action == 'verify') {
		text = text.replace('%AMOUNT%' + req.body.amount);
	}

	if (action == 'enroll') {
		templ = gnids['ENROLL_TEMPLATE'];
		text = fields.pin + randomSpace + '. ' + fields.pin + randomSpace + '. ' + fields.pin + randomSpace + '.';
	}
	let vobj = getObject(templ, language, text);

	console.log(logText + "WA Object: " + JSON.stringify(vobj));

	// Extraparams set
	extraparams = {
		gnids: gnids,
		rClient: rClient,
		basekey: basekey,
		aConst: aConst,
		users: users,
	}
	await oNexmo.sendWA(phone, vobj, extraparams);

	console.log(logText + "Verimetric Request sent");

	try {
		let dkey = basekey + uuid;

		rClient.hmset(dkey, verimetric, function (err) {
			if (err) {
				return res.status(400).json({ error: 'Internal redis error' });
			}
			else {
				rClient.expire(dkey, 86400); // Expires in 24 hours
			}
		});

		rClient.hmset(rkey, verimetric, function (err) {
			if (err) {
				return res.status(400).json({ error: 'Internal redis error' });
			}
			else {
				rClient.expire(rkey, timeout); // Expires in timeout seconds

				console.log(logText + "Verification request cached");

				return res.status(200).json({ requestid: uuid });
			}
		});
	}
	catch (e) {
		return res.status(400).json({ error: 'Internal error' });
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

	rClient.hset(rkey, 'biometrics', -1, (err, res) => {
		rClient.hset(rkey, 'pinmatch', -1, (err, res) => {
			rClient.hset(rkey, 'done', 0, (err, res) => {
				rClient.hset(rkey, 'rawscore', 0, (err, res) => {
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
	let fields = oLocalization.getFields(vmetric.language);

	if (vmetric.action == 'verify' || vmetric.action == 'enroll') {
		// Ok, got an audio file, and we know we need to validate it... here we go!
		let obj2 = {
			content: {
				type: "text",
				text: (vmetric.action == 'verify' ? fields.wait : fields.waitreg)
			}
		}
		// Extraparams set
		extraparams = {
			gnids: gnids,
			rClient: rClient,
			basekey: basekey,
			aConst: aConst,
			users: users,
		}
		oNexmo.sendWA(phone, obj2, extraparams);

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

						console.log(logText + "CONST: " + aConst);

						// Extraparams set
						extraparams = {
							gnids: gnids,
							rClient: rClient,
							basekey: basekey,
							aConst: aConst,
							users: users,
						}
						console.log(logText + "EXTRA: " + JSON.stringify(extraparams));

						// Transcribe voice
						oSpeechmatics.smTranscribe(fn, data, vmetric, extraparams);

						// Validate voice
						if (vmetric.action == 'verify') {
							oValidSoft.vsValidate(fn, b64, vmetric, extraparams);
						}
						else if (vmetric.action == 'enroll') {
							oValidSoft.vsRegister(fn, b64, vmetric, extraparams);
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

app.use('/', express.static(__dirname));

//-----------
var date = new Date().toLocaleString();

console.log(logText + "Starting up verimetrics server (" + gnids['INSTANCE'] + ") at " + date);

app.listen(port, 'localhost', () => {
	console.log(logText + "Verimetrics Server listening on port " + port);
});
