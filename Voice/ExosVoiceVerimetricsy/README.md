# VeriMetrics

# Installation

Install required softwares: `nodejs`, `npm`, `redis`

Clone the repo, or unzip into a directory

Install required dependencies:

```
npm install
```

Setup `.env` according to `.env-empty`

```
instance= # A one-word instance name, such as 'mybank'
urltag= # If using nginx to route to the correct port, the nginx tag... eg, https://www.myserver.com/myurltag/ could route to local port 8017
user= # Username for the REST calls
password= #Password for the REST calls
port=8017 #Port that the REST will be listening on
vonage=0 # Leave as 0
debug=0 # Turns on or off extended debug logs.  Requires restart of service after changing.

masterkey= # Vonage API key
mastersecret= # Vonage API Secret
masterapp= # Vonage API App ID
masterkeyfile= # Path to Vonage API Keyfile
wanumber= # WhatsApp WABA account number (phone)
wanamespace= # WhatsApp Namespace for the account and templates
nserver= # Server URL, such as: https://vids.nexmo.com/
pintemplate= # WABA Template for Verification with PIN
enrolltemplate= # WABA Template for Biometric Enrollment
smurl= # SpeechMatics Websocket URL, such as: wss://ec2-3-100-200-123.compute-1.amazonaws.com:9000/v2
vsurl= # ValidSoft URL, such as: https://blah.vsblah.es/blah/stdBiometric/
vsuser= # ValidSoft Username
vspassword= # ValidSoft Password
vsthreshold=0.95 # Adjustable biometrics acceptance threshold
```

Your WABA account webhook for inbound messages should be pointing to (nserver)/wa_inbound and the account webhook for WABA events should be (nserver)/wa_status.
