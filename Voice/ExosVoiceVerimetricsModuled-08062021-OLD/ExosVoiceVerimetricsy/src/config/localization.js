// Paths
const NODE_MODULES = "../../node_modules/";

// Log
const path = require(NODE_MODULES + "path");

var logText = "[" + path.basename(__filename) + "]    ";

var localization;

function getLocalization() {
	localization = [{
		language: 'English',
		name: 'Kimberly',
		code: 'en',
		fields: {
			register: "To register, please repeat the following phrase 3 times or until you hear a beep: I approve this transaction for., followed by your phone number.",
			verify: "For verification, please say the following.  I approve this transaction for, followed by your phone number.",
			registered: "Your voice is now registered. You may hang up now.",
			success: "Your voice has been successfully validated. You may hang up now.",
			failed: "I'm sorry, but your voice does not match our records. Please wait while we transfer you to an agent who can help.",
			connecting: 'Connecting your call, please wait.',
			pin: "I approve this transaction with the authorization code ",
			wait: "Please wait while we validate your identity.",
			waitreg: "Please wait while we process your Voice Registration...",
			terms: "I agree with the terms and conditions of the service",
			cancellation: "I agree with the cancelation for, followed by your phone number.",
		}
	},
	{
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
	{
		language: 'French',
		name: 'Mathieu',
		code: 'fr',
		fields: {
			register: "Lisez la phrase suivante 3 fois de suite ou jusqu'à ce que vous entendiez un bip sonore : J'approuve cette transaction pour le, dîtes votre numéro de téléphone.",
			verify: "Pour valider votre empreinte vocale, J'approuve cette transaction pour le, dîtes votre numéro de téléphone.",
			registered: "Votre empreinte vocale a bien été enregistré. Vous pouvez raccrocher.",
			success: "Votre voix a été validé, vous pouvez raccrocher.",
			failed: "Désolé, mais votre voix ne correspond pas à nos empreintes vocales. Veuillez attendre pendant que nous vous transférons votre appel à un agent.",
			connecting: 'Veuillez patienter pendant que l’on connecte cet appel',
			pin: "J'approuve cette transaction avec le code d'autorisation ",
			wait: "Veuillez attendre pendant que l’on valide votre identité",
			waitreg: "Veuillez attendre pendant que l’on traite votre inscription de voix…",
		}
	},
	{
		language: 'Portugese',
		name: 'Luciana',
		code: 'pt',
		fields: {
			verify: "Para verificação, por favor diga o seguinte. Eu aprovo esta transferência para., seguido por seu número de telefone.",
			registered: "Sua voz está registrada. Você pode desconectar agora.",
			success: "Sua voz foi validada com sucesso. Você pode desconectar agora.",
			failed: "Desculpe, mas sua voz não é compatível com nossos registros. Por favor aguarde enquanto transferimos você para um agente que possa ajudar.",
			connecting: 'Conectando a ligação, por favor aguarde.',
			pin: "Eu aprovo esta transferência com o código de autorização ",
			wait: "Por favor aguarde enquanto validamos sua identidade.",
			waitreg: "Por favor aguarde enquanto processamos seu Registro de Voz...",
			wavery: "Verificação de Voz: mantenha segurado o ícone de microfone na tela do WhatsApp, e responda lendo os seguintes dígitos: ",
			wathanks: "Obrigado por usar o VeriMetrics™ by Vonage",
		},
	},
	{
		language: 'Japanese',
		name: 'Mizuki',
		code: 'ja',
		fields: {
			register: '次のフレーズを3回、またはビープ音が鳴るまで繰り返してください。 電話番号の後に、"このトランザクションを承認します" ',
			verify: "確認のため、次のフレーズをを言ってください：電話番号の後に、このトランザクションを承認します",
			registered: "あなたの声は、登録されました。 今、電話を切っても構いません。",
			success: "あなたの声は、正常に検証されました。今、電話を切っても構いません。",
			failed: "すみません、あなたの声は私たちの記録と一致しませんでした。 サポートできるエージェントに転送いたしますので、しばらくお待ちください。",
			connecting: '接続中です。しばらくお待ちください。',
			pin: "このトランザクションを承認コードで承認します ",
			wait: "本人確認を行っています。しばらくお待ちください。",
			waitreg: "音声登録を処理しています。しばらくお待ちください。",
		}
	},
	];
	return localization;
}

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

module.exports = { getLocalization, getFields }