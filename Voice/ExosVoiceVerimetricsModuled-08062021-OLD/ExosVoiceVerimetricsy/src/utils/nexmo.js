// Paths
const NODE_MODULES = "../../node_modules/";

// Libraries
const Nexmo = require('nexmo');
const request = require('request');

// Log
const path = require(NODE_MODULES + "path");

var logText = "[" + path.basename(__filename) + "]    ";

var wnexmo;

// Public
function initialize(extraparams) {
    try {
        console.log(logText + "Creating NEXMO WA Object");

        wnexmo = new Nexmo({
            apiKey: extraparams.gnids['MASTER_KEY'], 			//NEXMO_API_KEY,
            apiSecret: extraparams.gnids['MASTER_SECRET'], 		//NEXMO_API_SECRET,
            applicationId: extraparams.gnids['MASTER_APP'], 	    //NEXMO_APPLICATION_ID,
            privateKey: extraparams.gnids['MASTER_KEY_FILE'], 	//NEXMO_APPLICATION_PRIVATE_KEY_PATH
        },
        {	
//            apiHost: extraparams.gnids['API_HOST_PROD'],		        //SANBOX API HOST
			apiHost: extraparams.gnids['API_HOST_SANDBOX'],		        //SANBOX API HOST
        }
        );
        console.log(logText + "WA Object initialized");

        gjwt = wnexmo.generateJwt();

        if (extraparams.gnids['DEBUG']) {
            console.log(logText + "JWT: " + gjwt);
        }
    }
    catch (err) {
        console.log(logText + "Exception: WA Object init error: ", err);
    }
    return wnexmo;
}

// Public
async function registerWA(number, url, type = 'incoming', extraparams) {
	console.log(logText + "Registering WA");

	if (!extraparams.gnids['VIDS']) { // This uses the common WA Redirector if in VIDS.  Otherwise, we assume the WA webhook will point directly here.
		return;
	}
	// NOTE: Special Case scenario for MX (+52) numbers using "1" (mobile) addition...
	if (type == 'incoming' && number.startsWith('52') && number.charAt(2) != '1') {
		number = number.substring(0, 2) + '1' + number.substring(2);
	}
	request.post('https://nids.nexmo.com/wa/register', {
		headers: {
			"content-type": "application/json",
		},
		json: true,
		body: {
			phone: number,
			url: url,
			type: type,
			service: "wa"
		},
	},
		function (error, response, body) {
			if (error) {
				console.log(logText + "Error posting to WA redirector ", error);
			}
		}
	);
}

// Public
async function sendWA(number, obj, extraparams) {
	console.log(logText + "Sending WA");
	console.log(logText + "To Number: " + number);
	console.log(logText + "From Number: " + extraparams.gnids['WA_NUMBER']);
	console.log(logText + "Object: " + JSON.stringify(obj));

	var date = new Date().toLocaleString();

	console.log(logText + "Sending WA text to: " + number + " at " + date);

	try {
		wnexmo.channel.send(
			{ "type": "whatsapp", "number": number },
			{ "type": "whatsapp", "number": extraparams.gnids['WA_NUMBER'] },
			obj,
			(err, data) => {
				if (err) {
					console.log(logText + "Error sending WA Object: " + JSON.stringify(err));

					if (err.body && err.body.invalid_parameters) {
						if (extraparams.gnids['DEBUG']) {
							console.log(logText + "Invalid object: ", err.body.invalid_parameters)
							console.log(logText + "Offending object: ", obj)
						}
					}
				} 
				else {
					console.log(logText + "WA Object sent successfully");
				}
			}
		);
	} 
	catch (err) {
		console.log(logText + "Exception: Error sending WA object: ", err);
	}
}

module.exports = { initialize, registerWA, sendWA }