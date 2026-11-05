const T = require('/tmp/eng2hin/assets/js/translit.js');

const cases = [
  ['aap kaise ho', 'आप कैसे हो'],
  ['aap kaise ho?', 'आप कैसे हो?'],
  ['main theek hoon', 'मैं ठीक हूँ'],
  ['mera naam Rahul hai', 'मेरा नाम राहुल है'],
  ['mujhe chai chahiye', 'मुझे चाय चाहिए'],
  ['tum kahan ho', 'तुम कहाँ हो'],
  ['kya aapko pata hai', 'क्या आपको पता है'],
  ['dhanyavaad bahut achha', 'धन्यवाद बहुत अच्छा'],
  ['kaise ho bhai', 'कैसे हो भाई'],
  ['main kal aata hoon', 'मैं कल आता हूँ'],
  ['raasta kahan hai', 'रास्ता कहाँ है'],
  ['apna ghar bada hai', 'अपना घर बड़ा है'],
  ['pyar ka mahatra', 'प्यार का महत्व'],
  ['kya kya baat hai', 'क्या क्या बात है'],
  ['Hello, how are you?', 'हैलो, कैसे हैं आप?'],
  ['namaste bhai', 'नमस्ते भाई'],
  ['accha laga', 'अच्छा लगा'],
  ['aaj mausam bahut achha hai', 'आज मौसम बहुत अच्छा है'],
  ['sab theek hai', 'सब ठीक है'],
  ['mujhe samajh nahi aaya', 'मुझे समझ नहीं आया'],
  ['yahan kya hai', 'यहाँ क्या है'],
  ['mera dost Rahul hai', 'मेरा दोस्त राहुल है'],
  ['kahaan jana hai', 'कहाँ जाना है'],
  ['main so raha hoon', 'मैं सो रहा हूँ'],
  ['tum kaise ho sab theek', 'तुम कैसे हो सब ठीक'],
  ['dhanyavaad', 'धन्यवाद'],
  ['kaise', 'कैसे'],
  ['ho', 'हो'],
  ['aap', 'आप'],
  ['hai', 'है'],
  ['kya', 'क्या'],
  ['nahi', 'नहीं'],
  ['main', 'मैं'],
  ['kal meeting hai 5 baje', 'कल मीटिंग है 5 बजे'],
  ['aaj bahut achha mausam hai', 'आज बहुत अच्छा मौसम है'],
  ['mera dost Rahul hai', 'मेरा दोस्त राहुल है'],
  ['main so raha hoon', 'मैं सो रहा हूँ'],
  ['kahaan jana hai', 'कहाँ जाना है'],
  ['mujhe samajh nahi aaya', 'मुझे समझ नहीं आया'],
  ['yahan kya hai', 'यहाँ क्या है'],
  ['dhanyavaad bahut achha', 'धन्यवाद बहुत अच्छा'],
  ['pyar ka mahatra', 'प्यार का महत्व'],
  ['accha laga', 'अच्छा लगा']
];

let pass = 0, fail = 0;
for (const [input, expected] of cases) {
  const got = T.romanToDeva(input);
  const ok = got === expected;
  ok ? pass++ : fail++;
  console.log((ok ? '  PASS  ' : '> FAIL  ') + JSON.stringify(input) + ' -> ' + JSON.stringify(got) + (ok ? '' : '   expected ' + JSON.stringify(expected)));
}
console.log('\npass ' + pass + ' / fail ' + fail);

// romanisation round trip
console.log('\n--- devaToRoman ---');
const rom = [
  ['आप कैसे हो', 'aap kaise ho'],
  ['भाई', 'bhai'],
  ['मैं ठीक हूँ।', 'main theek hoon.'],
  ['धन्यवाद', 'dhanyavad'],
  ['नमस्ते', 'namaste'],
  ['कल मीटिंग है 5 बजे', 'kal meeting hai 5 baje']
];
let rpass = 0, rfail = 0;
for (const [input, expected] of rom) {
  const got = T.devaToRoman(input);
  const ok = got === expected;
  ok ? rpass++ : rfail++;
  console.log((ok ? '  PASS  ' : '> FAIL  ') + input + ' -> ' + got + (ok ? '' : '   expected ' + expected));
}
console.log('\nroman pass ' + rpass + ' / fail ' + rfail);
if (fail || rfail) process.exitCode = 1;
