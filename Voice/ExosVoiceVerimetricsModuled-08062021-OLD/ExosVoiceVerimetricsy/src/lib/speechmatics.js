// Paths
const NODE_MODULES = "../../node_modules/";
const DB_PATH = "../db/";

// Classes
const oDatabase = require(DB_PATH + "database");

// Log
const path = require(NODE_MODULES + "path");

var fs = require('fs');

var logText = "[" + path.basename(__filename) + "]    ";

function smSocket(vmetric, extraparams) {
	var W3CWebSocket = require('websocket').w3cwebsocket;

	let smurl = extraparams.gnids['S_MURL'];
//	let smurl = 'wss://rt10.speechmatics.cloud:9000/v2';
	let rkey = extraparams.basekey + vmetric.channel + ':' + vmetric.phone;

	console.log(logText + "RCLIENT: " + JSON.stringify(extraparams.rClient));
	console.log(logText + "SMURL: " + smurl);
	console.log(logText + "RKEY: " + rkey);

	var client = new W3CWebSocket(smurl, {
		protocolVersion: 8,
		rejectUnauthorized: false,
		origin: smurl
	});

	console.log(logText + "SM CLIENT: " + JSON.stringify(client));

	client.binaryType = "arraybuffer";
	client.onopen = function (event) {
		let key = extraparams.basekey + 'smclient:' + vmetric.uuid;

		console.log(logText + " KEY" + key);
		console.log(logText + "Speechmatics onOpen for " + vmetric.phone);

		extraparams.rClient.set(key, 1, function (err) {
			if (err) {
				console.log(logText + "Redis error verimetrics:smclient: ", err)
			} 
			else {
				extraparams.rClient.expire(key, 60); // Expires in 60 seconds
			}
		});
	} //onopen
	client.onmessage = function (event) {
		var data = JSON.parse(event.data);
		var date = new Date().toLocaleString();
		let payload;

		switch (data.message) {
			case "RecognitionStarted":
				console.log(logText + "Speechmatics RecognitionStarted for " + vmetric.phone + " at " + date);

				let key = extraparams.basekey + 'smstarted:' + vmetric.uuid;

				extraparams.rClient.set(key, 1, function (err) {
					if (err) {
						console.log(logText + "Redis error verimetrics:smstarted: ", err)
					} else {
						extraparams.rClient.expire(key, 60); // Expires in 60 seconds
					}
				});
				extraparams.users[vmetric.phone].payload = '';
				break;
			case "AudioAdded":
				break;
			case "AddPartialTranscript":
				break;
			case "AddTranscript":
				payload = extraparams.users[vmetric.phone].payload;
				payload = payload + (data.metadata.transcript).trim() + ' ';
				
				extraparams.users[vmetric.phone].payload = payload;
				
				break;
			case "EndOfTranscript":
				console.log("Received SM EndOfTranscript message at " + date + " - " + data.metadata);

				payload = extraparams.users[vmetric.phone].payload;
				
				if (payload.length > 0) {
					processText(vmetric, payload, extraparams);
					
					extraparams.users[vmetric.phone].payload = null;

					smClose(client);
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
		}
	}
	client.onclose = function (event) {
		console.log(logText + "Speechmatics smSocket client WS close " + vmetric.phone);
		console.log(logText + "CLOSE Event: " + JSON.stringify(event));
	}
	client.onerror = function (event) {
		oDatabase.setRedis(extraparams, rkey, 'pinmatch', 0, vmetric, 1);

		console.log(logText + "Speechmatics smSocket client WS error: " + "connection error");
		console.log(logText + "Event: " + JSON.stringify(event));
		console.log(logText + "EVENT DATA: " + JSON.stringify(event.data));
	}
	return client;
}

function smClose(smSock) {
	var msg = {
		"message": "EndOfStream",
	}
	if (smSock.readyState === smSock.OPEN) {
		smSock.send(JSON.stringify(msg));
	}
	console.log(logText + "Speechmatics smSocket Vonage-side WS close");

	smSock.close();
	smSock = null;
}

async function smStart(smSock, vmetric, extraparams) {
	let rkey = extraparams.basekey + vmetric.channel + ':' + vmetric.phone;
	var msg = {
		"message": "StartRecognition",
		"transcription_config": {
			"language": vmetric.language,
			"max_delay": 8,
		},
		"audio_format": {
			"type": "file",
		},
	}
	try {
		smSock.send(JSON.stringify(msg));
	} 
	catch (err) {
		console.log(logText + "smClient websocket closed unexpectedly...");

		oDatabase.setRedis(extraparams, rkey, 'pinmatch', 0, vmetric, 1);
	}
}

async function smFile(smSock, fn, data, vmetric, extraparams) {
	let key = extraparams.basekey + 'smstarted:' + vmetric.uuid;
	let rkey = extraparams.basekey + vmetric.channel + ':' + vmetric.phone;
	var contents = fs.readFileSync('/tmp/' + fn + '.ogg');
	let cnt = 0;

	const interval = setInterval(function () {
		extraparams.rClient.get(key, function (err, reply) {
			// reply is null when the key is missing
			if (err || !reply) {
				cnt++;
				if (cnt > 50) {
					clearInterval(interval);
					extraparams.rClient.del(key);

					console.log(logText + "smStarted timed out waiting for the sm connection");

					oDatabase.setRedis(extraparams, rkey, 'pinmatch', 0, vmetric, 1);
				}
			} 
			else {
				clearInterval(interval);
				extraparams.rClient.del(key);

				console.log(logText + "smFile got smStarted");
				
				let splitSize = 1024;
				
				if (extraparams.gnids['DEBUG']) {
					console.log(logText + "Starting send of bytes: " + contents.length);
				}
				let seqNo = 0;

				for (var start = 0; start < contents.length; start += splitSize) {
					smSock.send(contents.slice(start, start + splitSize));
					seqNo++;
				}
				if (extraparams.gnids['DEBUG']) {
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

async function processText(vmetric, payload, extraparams) {
	var date = new Date().toLocaleString();

	console.log(logText + "Speechmatics smSocket transcription at " + date + ": " + payload);
	
	let rkey = extraparams.basekey + vmetric.channel + ':' + vmetric.phone;

	// Does the transcript match the random key???
	if (payload) {
		var validation = vmetric.pin;

		if (extraparams.gnids['DEBUG']) {
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

			console.log(logText + "Did we match it??? ");
			
			if (ok) {
				console.log(logText + "Yes! for " + rkey);

				oDatabase.setRedis(extraparams, rkey, 'pinmatch', 1, vmetric);
			} 
			else {
				console.log(logText + "Sorry! Transcription mismatch... for " + rkey);

				oDatabase.setRedis(extraparams, rkey, 'pinmatch', 0, vmetric, 0); // Setting done=0, to give another chance
			}
		}
	}
}

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

// Public
async function smTranscribe(fn, data, vmetric, extraparams) {
	var smsock = smSocket(vmetric, extraparams);
	let cnt = 0;
	let rkey = extraparams.basekey + vmetric.channel + ':' + vmetric.phone;
	
	const interval = setInterval(function () {
		extraparams.rClient.get(extraparams.basekey + 'smclient:' + vmetric.uuid, function (err, reply) {
			// reply is null when the key is missing
			if (err || !reply) {
				cnt++;
				
				if (cnt > 50) {
					clearInterval(interval);
					oDatabase.setRedis(extraparams, rkey, 'pinmatch', 0, vmetric, 1);
					
					extraparams.rClient.del(extraparams.basekey + 'smclient:' + vmetric.uuid);
					
					var date = new Date().toLocaleString();
					
					console.log(logText + "smTranscribe timed out waiting for the sm connection at " + date);
				}
			} 
			else {
				extraparams.rClient.del(extraparams.basekey + 'smclient:' + vmetric.uuid);

				clearInterval(interval);
				
				var date = new Date().toLocaleString();
				
				console.log(logText + "smTranscribe got sm connection at " + date)
				
				smStart(smsock, vmetric, extraparams);
				smFile(smsock, fn, data, vmetric, extraparams);
			}
		})
	}, 100);
}

module.exports = { smTranscribe }