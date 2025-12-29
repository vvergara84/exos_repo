// Paths
const NODE_MODULES = "../../node_modules/";
const DB_PATH = "../db/";

// Libraries
const request = require('request');

// Classes
const oDatabase = require(DB_PATH + "database");

// Log
const path = require(NODE_MODULES + "path");

var logText = "[" + path.basename(__filename) + "]    ";

function gotValidation(vmetric, err, body, extraparams) {
	let rkey = extraparams.basekey + vmetric.channel + ':' + vmetric.phone;
	
	if (err) {
		oDatabase.setRedis(extraparams, 'biometrics', 0, vmetric, 1);
	} 
	else {
		// Check here in body for results...
		if (body && body.result && body.result.score) {
			let score = parseFloat(body.result.score);

			extraparams.rClient.exists(rkey, (err, res) => {
				extraparams.rClient.hset(rkey, 'rawscore', score, (err, res) => {
					if (score >= extraparams.gnids['VS_THRESHOLD']) {
						oDatabase.setRedis(extraparams, 'biometrics', 1, vmetric, 0);
					} 
					else {
						oDatabase.setRedis(extraparams, 'biometrics', 0, vmetric, 1);
					}
				})
			})
		} 
		else {
			oDatabase.setRedis(extraparams, 'biometrics', 0, vmetric, 1);
		}
	}
}

// Public
async function vsCheck(vmetric, callback, extraparams) {
	var vkey = encodeURI('verimetric_' + vmetric.phone + '_' + extraparams.aConst);             ////// ENROLMENT FORMAT!!!!

	console.log(logText + "Checking Registration for ValidSoft user id: " + vkey)
	
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
	}
	let tmpUrl = extraparams.gnids['VS_URL'];

	console.log(logText + "Checking for Speaker at: " + tmpUrl + "isSpeakerEnrolled " + vkey);

	request.post(tmpUrl + 'isSpeakerEnrolled', {
		'auth': {
			'user': extraparams.gnids['VS_USER'], 'pass': extraparams.gnids['VS_PASSWORD'], 'sendImmediately': false
		},
		headers: {
			"content-type": "application/json",
		},
		json: true,
		body: body,
	},
		function (error, response, body) {
			try {
				console.log(logText + "---------  V S - R E S P O N S E  ---------");
				console.log(logText + "Check Speaker Response Code: " + response.statusCode);

				if (response.body) {
					console.log(logText + "Check Speaker Response Body: " + JSON.stringify(response.body));
				}
				if (response.statusCode == 200) {
					if (body && body.outcome) {
						if (body.outcome == "KNOWN_USER_ACTIVE") {
							if (!extraparams.users[vmetric.phone]) {
								extraparams.users[vmetric.phone] = { phone: vmetric.phone }
							}
							extraparams.users[vmetric.phone].enrollment = vkey;

							if (callback) {
								callback('success');
								return;
							}
						} 
						else {
							if (!extraparams.users[vmetric.phone]) {
								extraparams.users[vmetric.phone] = { phone: vmetric.phone }
							}
							extraparams.users[vmetric.phone].enrollment = '';

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
				console.log(logText + "check Speaker error");

				if (response) {
					if (error1) { 
						console.log(logText + "Exception: Unhandled Error [ " + response.statusCode + " ]", error1); 
					}
				} 
				else {
					if (error1) { 
						console.log(logText + "Exception: Unhandled Error", error1); 
					}
				}
			}
		}
	);
}

// Public
async function vsDelete(vmetric, callback, extraparams) {
	var vkey = encodeURI('verimetric_' + vmetric.phone + '_' + extraparams.aConst); ////// ENROLMENT FORMAT!!!!
	
	console.log(logText + "Deleting ValidSoft user id: " + vkey)
	
	if (extraparams.users[vmetric.phone]) {
		delete extraparams.users[vmetric.phone];
	}
	let body = {
		serviceData: {
			loggingId: "VeriMetrics_logging_001_WhatsApp_" + extraparams.gnids['INSTANCE']
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
	}
	let tmpUrl = extraparams.gnids['VS_URL'];

	if (extraparams.gnids['DEBUG']) {
		console.log(logText + "Deleting Speaker at: " + tmpUrl + "deleteSpeaker");
	}
	request.post(tmpUrl + 'deleteSpeaker', {
		'auth': {
			'user': extraparams.gnids['VS_USER'], 'pass': extraparams.gnids['VS_PASSWORD'], 'sendImmediately': false
		},
		headers: {
			"content-type": "application/json",
		},
		json: true,
		body: body,
	},
		function (error, response, body) {
			try {
				console.log(logText + "---------  V S - R E S P O N S E  ---------");
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
					}
				}
			}
		}
	);
}

// Public
async function vsValidate(fn, b64, vmetric, extraparams) {
	let rkey = extraparams.basekey + vmetric.channel + ':' + vmetric.phone;
	var vkey = encodeURI('verimetric_' + vmetric.phone + '_' + extraparams.aConst); ////// ENROLMENT FORMAT!!!!
	
	console.log(logText + "Validation ValidSoft user id: " + vkey)
	
	let body = {
		serviceData: {
			loggingId: "VeriMetrics_logging_001_WhatsApp_" + extraparams.gnids['INSTANCE']
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
	}
	let tmpUrl = extraparams.gnids['VS_URL'];

	if (extraparams.gnids['DEBUG']) {
		console.log(logText + "Verifying Speaker at: " + tmpUrl + "verifySpeaker");
	}
	request.post(tmpUrl + 'verifySpeaker', {
		'auth': {
			'user': extraparams.gnids['VS_USER'], 'pass': extraparams.gnids['VS_PASSWORD'], 'sendImmediately': true
		},
		headers: {
			"content-type": "application/json",
		},
		json: true,
		body: body,
	},
		function (error, response, body) {
			try {				
				console.log(logText + "---------  V S - R E S P O N S E  ---------");
				console.log(logText + "Verify Speaker Response Code: " + response.statusCode);

				if (response.body) {
					console.log(logText + "Verify Speaker Response Body: " + JSON.stringify(response.body));
				}
				if (response.statusCode == 200) {
					if (body && body.result && body.result.metaInformation) {

						console.log(logText + "Meta Information: " + body.result.metaInformation);
					}
					return gotValidation(vmetric, 0, body, extraparams);
				} 
				else {
					if (error) {
						console.log(logText + "HTTP Error [ " + response.statusCode + " ]", error.body);

						gotValidation(vmetric, 1, error.body, extraparams);
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
					}
				}
				gotValidation(vmetric, 1, 'Unspecified Error', extraparams);
			}
		}
	);
}

// Public
async function vsRegister(fn, data, vmetric, extraparams) {
	let rkey = extraparams.basekey + vmetric.channel + ':' + vmetric.phone;
	var vkey = encodeURI('verimetric_' + vmetric.phone + '_' + extraparams.aConst); ////// ENROLMENT FORMAT!!!!

	console.log(logText + "Registration ValidSoft user id: " + vkey);

	let body = {
		serviceData: {
			loggingId: "VeriMetrics_logging_001_WhatsApp_" + extraparams.gnids['INSTANCE']
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
	}
	let tmpUrl = extraparams.gnids['VS_URL'];

	console.log(logText + "Validsoft Call Request Body: " + JSON.stringify(body));

	if (extraparams.gnids['DEBUG']) {
		console.log(logText + "File enroling Speaker at: " + tmpUrl + "enrolSpeaker");
	}
	request.post(tmpUrl + 'enrolSpeaker', {
		'auth': {
			'user': extraparams.gnids['VS_USER'], 'pass': extraparams.gnids['VS_PASSWORD'], 'sendImmediately': true
		},
		headers: {
			"content-type": "application/json",
		},
		json: true,
		body: body,
	},
		function (error, response, body) {
			try {
				console.log(logText + "---------  V S - R E S P O N S E  ---------");
				console.log(logText + "Enroll Speaker Response Code: " + response.statusCode);

				if (response.body) {
					console.log(logText + "Enroll Speaker Response Body: " + JSON.stringify(response.body));
				}
				if (response.statusCode == 200) {
					extraparams.users[vmetric.phone].enrollment = vkey;
					
					oDatabase.setRedis(extraparams, 'biometrics', 1, vmetric, 0);

					if (body && body.result && body.result.metaInformation) {
						console.log(logText + "Meta Information: " + JSON.stringify(body.result.metaInformation));
					}
					return;
				} 
				else {
					oDatabase.setRedis(extraparams, 'biometrics', 0, vmetric, 1);

					if (error) {
						console.error(logText + "HTTP Error Response: " + response.statusCode);
						console.error(logText + "HTTP Error Body: " + error.body)
					}
				}
			} 
			catch (error1) {
				oDatabase.setRedis(extraparams, 'biometrics', 0, vmetric, 1);

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
					}
				}
			}
		}
	);
}

module.exports = { vsCheck, vsDelete, vsRegister, vsValidate }