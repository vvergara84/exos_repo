// Paths
const NODE_MODULES = "../../node_modules/";

// Libraries
const redis = require('redis');
const { promisify } = require('util');
const request = require('request');

// Log
const path = require(NODE_MODULES + "path");

var logText = "[" + path.basename(__filename) + "]    ";

var rClient;

function checkDone(vmetric, extraparams) {
	let rkey = extraparams.basekey + vmetric.channel + ':' + vmetric.phone;

	console.log(logText + "In checkDone for: " + rkey);

	rClient.hgetall(rkey, function (err, obj) {
		if (!err && obj) {
			console.log(logText + "In checkDone with results: " + JSON.stringify(obj));

			if (parseInt(obj.done) > 0 || (parseInt(obj.biometrics) >= 0 && parseInt(obj.pinmatch) >= 0)) { // We are done!
				// First, delete the key (open up for new requests)
				if ((parseInt(obj.biometrics) > 0 && parseInt(obj.pinmatch) > 0)) { // Only delete on success, so they can retry on failure
					rClient.del(rkey);
				}
				//Then, move it to the completed queue, based on uuid
				let dkey = extraparams.basekey + obj.uuid;
				rClient.hmset(dkey, obj);

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

// Public
function getClient(redis_host, redis_port) {
    console.log(logText + "Creating Redis Client");
    console.log(logText + "Redis Host: " + redis_host);
    console.log(logText + "Redis Port: " + redis_port);

    rClient = redis.createClient({
        host: redis_host,
        port: redis_port
    });
    const getAsync = promisify(rClient.get).bind(rClient);          // now getAsync is a promisified version of client.get:
    const hgetAsync = promisify(rClient.hgetall).bind(rClient);     // now hgetAsync is a promisified version of client.hgetall:
    
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
    }
    return { rClient, getAsync, hgetAsync };
}

// Public
function setRedis(extraparams, rkey, key, val, vmetric, done = 0) {
	if (extraparams.gnids['DEBUG']) {
		console.log(logText + "In setRedis: " + rkey + " " + key + " " + val + " " + done);
	}
	if (done == 1) {
		rClient.exists(rkey, (err, res) => {
			if (!err && res === 1) {
				rClient.hset(rkey, 'done', 1, (err, res) => {
					if (extraparams.gnids['DEBUG']) {
						console.log(logText + "In setRedis DONE " + key + " " + val);
					}
					rClient.hset(rkey, key, val, (err, res) => {
						checkDone(vmetric, extraparams)
					})
				})
			}
		});
	} 
	else {
		rClient.exists(rkey, (err, res) => {
			if (!err && res === 1) {
				if (extraparams.gnids['DEBUG']) {
					console.log(logText + "In setRedis " + key + " " + val);
				}
				rClient.hset(rkey, key, val, (err, res) => {
					checkDone(vmetric, extraparams)
				})
			}
		});
	}
}

module.exports = { getClient, setRedis }