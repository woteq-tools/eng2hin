/*!
 * Woteq Eng->Hin — transliteration engine
 * Roman (Hinglish / English) <-> Devanagari. No dependencies, no network.
 *
 * Exposes:
 *   Translit.romanToDeva(text)  -> Devanagari
 *   Translit.devaToRoman(text)  -> Roman (pronunciation guide)
 *   Translit.hinglishHits(text) -> { hinglish, english } word counts
 *   Translit.hinglishDict      -> raw dictionary (for the UI)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Translit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. Devanagari tables
   * ------------------------------------------------------------------ */

  // Consonant clusters written as one letter (multi-char keys first).
  const CONS = {
    cch: 'छ', chh: 'छ', ch: 'च', ksh: 'क्ष',
    kh: 'ख', gh: 'घ', jh: 'ज़', zh: 'ज़', nh: 'ङ',
    th: 'थ', dh: 'ध', ph: 'फ', bh: 'भ', sh: 'श',
    ng: 'ंग', ts: 'त्स', tch: 'च',
    k: 'क', g: 'ग', j: 'ज', t: 'त', d: 'द', n: 'न',
    p: 'प', b: 'ब', m: 'म', y: 'य', r: 'र', l: 'ल',
    v: 'व', w: 'व', s: 'स', h: 'ह', f: 'फ', z: 'ज़',
    x: 'क्स', q: 'क', c: 'क'
  };

  // Vowel sounds: independent letter / matra.
  const VOWEL = {
    aa: { ind: 'आ', mat: 'ा' },
    ai: { ind: 'ऐ', mat: 'ै' },
    au: { ind: 'औ', mat: 'ौ' },
    ee: { ind: 'ई', mat: 'ी' },
    ii: { ind: 'ई', mat: 'ी' },
    oo: { ind: 'ऊ', mat: 'ू' },
    uu: { ind: 'ऊ', mat: 'ू' },
    a:  { ind: 'अ', mat: 'ा' },
    i:  { ind: 'इ', mat: 'ि' },
    u:  { ind: 'उ', mat: 'ु' },
    e:  { ind: 'ए', mat: 'े' },
    o:  { ind: 'ओ', mat: 'ो' }
  };
  const VOWEL_LONG = {
    a: 'आ', i: 'ई', u: 'ऊ', e: 'ए', o: 'ओ',
    aa: 'आ', ai: 'ऐ', au: 'औ', ee: 'ई', ii: 'ई', oo: 'ऊ', uu: 'ऊ'
  };

  // Consonant pairs that legitimately form one Hindi syllable (no virama).
  const JOINT = new Set([
    'ky', 'kv', 'kr', 'ks', 'kt', 'ky',
    'gy', 'gv', 'gr', 'gn', 'gd',
    'jy', 'jn', 'jr', 'jv', 'js',
    'ty', 'tv', 'tr', 'ts', 'tw', 'tn',
    'dy', 'dv', 'dr', 'd',
    'nk', 'ns', 'nt', 'nm', 'nv', 'nr', 'nl', 'ny',
    'py', 'pv', 'pr', 'ps', 'pt', 'pl',
    'by', 'bv', 'br', 'bs', 'bt', 'bl',
    'mk', 'mv', 'ml', 'my',
    'ly', 'lv', 'ld', 'ln', 'lm', 'lb',
    'ry', 'rv', 'rd', 'rb', 'rm', 'rk', 'rl',
    'vy', 'vr', 'vl',
    'sk', 'sm', 'sn', 'st', 'sv', 'sp', 'sd',
    'hm', 'hy', 'hj', 'hr', 'hv', 'hl', 'hs', 'hb',
    'fr', 'fy', 'zm',
    'zy', 'zv',
    'wa', 'wo', 'wi', 'we', 'wn', 'wr',
    'ya', 'yo', 'ye', 'yu', 'yb',
    'll', 'tt', 'dd', 'kk', 'pp', 'ss', 'bh', 'ch'
  ]);

  // Devanagari -> Roman (for pronunciation guides).
  const D2R_CONS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh',
    'स': 's', 'ह': 'h', 'ळ': 'l', 'ऴ': 'zh',
    'क़': 'q', 'ख़': 'kh', 'ग़': 'g', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f'
  };
  const D2R_MAT = {
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri', 'ॄ': 'ree',
    'ॅ': 'e', 'ॉ': 'o'
  };
  const D2R_IND = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऋ': 'ri', 'ॠ': 'ree',
    'ऌ': 'li', 'ॡ': 'li', 'ॢ': 'li'
  };
  // Independent vowel right after a matra is a diphthong: भ + ा + ई -> "bhai".
  const D2R_IND_SHORT = {
    'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u'
  };
  const DANDA = '।';
  const DOUBLE_DANDA = '॥';

  const VIRAMA = '्';
  const NUKTA = '़';
  const ANUSVARA = 'ं';
  const CHANDRABINDU = 'ँ';
  const VISARGA = 'ः';

  /* ------------------------------------------------------------------ *
   * 2. Hinglish dictionary  (Roman -> Devanagari)
   *    These are the words that break naive letter-by-letter rules.
   * ------------------------------------------------------------------ */

  const HINGLISH = {
    // pronouns & people
    aap: 'आप', aapko: 'आपको', aapki: 'आपकी', aapka: 'आपका', aapke: 'आपके',
    aapse: 'आपसे', aapas: 'आपस', aapko: 'आपको',
    main: 'मैं', mein: 'मैं', mai: 'मैं', hum: 'हम', humko: 'हमको',
    humara: 'हमारा', humari: 'हमारी', humare: 'हमारे', humse: 'हमसे',
    tu: 'तू', tuje: 'तुझे', tujhe: 'तुझे', tujhko: 'तुझको', tum: 'तुम',
    tumko: 'तुमको', tumhe: 'तुम्हें', tumhara: 'तुम्हारा', tumhari: 'तुम्हारी',
    tumhare: 'तुम्हारे', tumse: 'तुमसे',
    mujhe: 'मुझे', mujhko: 'मुझको', mujhein: 'मुझें', mujheko: 'मुझको',
    mera: 'मेरा', meri: 'मेरी', mere: 'मेरे', meray: 'मेरे',
    tera: 'तेरा', teri: 'तेरी', tere: 'तेरे',
    apna: 'अपना', apni: 'अपनी', apne: 'अपने',
    uska: 'उसका', uski: 'उसकी', uske: 'उसके', usko: 'उसको',
    unka: 'उनका', unki: 'उसकी', unke: 'उसके', unko: 'उनको',
    iska: 'इसका', iski: 'इसकी', iske: 'इसके', isko: 'इसको', is: 'यह', isme: 'इसमें',
    inka: 'इनका', inki: 'इनकी', inke: 'इनके', inko: 'इनको', in: 'इन',
    un: 'उन', wo: 'वो', woh: 'वो', wo_: 'वो', ye: 'ये', yeh: 'ये',
    koi: 'कोई', koi_: 'कोई', sab: 'सब', sabko: 'सबको', sabka: 'सबका',
    sabki: 'सबकी', sabke: 'सबके', sabme: 'सबमें', kuch: 'कुछ', kuchh: 'कुछ',
    kuchh_: 'कुछ', sabse: 'सबसे', koi: 'कोई', dono: 'दोनों',
    khud: 'खुद', khudko: 'खुदको', jisme: 'जिसमें', jis: 'जिस', jiski: 'जिसकी',
    jiska: 'जिसका', jise: 'जिसे', jin: 'जिन', jinka: 'जिनका', jinki: 'जिनकी',
    jinke: 'जिनके', jahaan: 'जहाँ', jahan: 'जहाँ', jab: 'जब', tab: 'तब',
    jabki: 'जबकि', lekin: 'लेकिन', magar: 'मगर', par: 'पर', aur: 'और',
    ya: 'या', to: 'तो', taki: 'ताकि', isliye: 'इसलिए', kyunki: 'क्योंकि',
    kyu: 'क्यूं', kyon: 'क्यों', liye: 'लिए', liye_: 'लिए', waqt: 'वक़्त',
    bhi: 'भी', hi: 'ही', toh: 'तो', bas: 'बस', sirf: 'सिर्फ', filhal: 'फ़िलहाल',

    // verbs
    hai: 'है', hain: 'हैं', ho: 'हो', hon: 'हो', hoon: 'हूँ', hun: 'हूँ', hu: 'हूँ',
    tha: 'था', thi: 'थी', the: 'थे', thay: 'थे', rah: 'रह',
    kar: 'कर', karta: 'करता', karti: 'करती', karte: 'करते', karna: 'करना',
    karo: 'करो', kro: 'करो', kare: 'करे', karega: 'करेगा', karegi: 'करेगी',
    karenge: 'करेंगे', karoon: 'करूँ', karenge_: 'करेंगे', kiya: 'किया',
    kiye: 'किये', kiy: 'किये', karna_: 'करना', karein: 'करें',
    do: 'दो', de: 'दे', deta: 'देता', deti: 'देती', dete: 'देते',
    dena: 'देना', diya: 'दिया', diye: 'दिये', dilo: 'दिलो',
    le: 'ले', lena: 'लेना', lo: 'लो', liye_: 'लिए', lekar: 'लेकर',
    lao: 'लाओ', laya: 'लाया', laye: 'लाए', lena_: 'लेना',
    aa: 'आ', aao: 'आओ', aaya: 'आया', aayi: 'आई', aaye: 'आए',
    aana: 'आना', aata: 'आता', aati: 'आती', aate: 'आते',
    ja: 'जा', jao: 'जाओ', jata: 'जाता', jati: 'जाती', jate: 'जाते',
    gaya: 'गया', gayi: 'गई', gaye: 'गए', jaana: 'जाना',
    jaayega: 'जाएगा', jayega: 'जाएगा', jayenge: 'जाएंगे',
    chalo: 'चलो', chala: 'चला', chali: 'चली', chale: 'चले',
    chalta: 'चलता', chalti: 'चलती', chalte: 'चलते', chalna: 'चलना',
    dekho: 'देखो', dekha: 'देखा', dekhi: 'देखी', dekhe: 'देखे',
    dekhta: 'देखता', dekhti: 'देखती', dekhna: 'देखना', dekhte: 'देखते',
    dekhiye: 'देखिए', dekhiye_: 'देखिए',
    suno: 'सुनो', sun: 'सुन', suna: 'सुना', suni: 'सुनी', sune: 'सुने',
    sunna: 'सुनना', sunta: 'सुंतता', banao: 'बनाओ', bana: 'बना',
    banaya: 'बनाया', banayi: 'बनाई', banate: 'बनाते', banana: 'बनाना',
    bolo: 'बोलो', bola: 'बोला', boli: 'बोली', bole: 'बोले', bolna: 'बोलना',
    bolta: 'बोलता', bolte: 'बोलते', boliye: 'बोलिए',
    pakdo: 'पकड़ो', pakadna: 'पकड़ना', pakda: 'पकड़ा', pakdi: 'पकड़ी',
    pakde: 'पकड़े', pakad: 'पकड़', pakadta: 'पकड़ता',
    rakh: 'रख', rakhna: 'रखना', rakho: 'रखो', rakha: 'रखा', rakhi: 'रखी',
    rakhe: 'रखे', rakhlo: 'रख लो', rakhlo_: 'रख लो',
    maango: 'माँगो', mangwa: 'माँगवा', mangli: 'माँगली', mangna: 'माँगना',
    mangte: 'माँगते', chahiye: 'चाहिए', chahie: 'चाहिए', 'chahiyे': 'चाहिए',
    chod: 'छोड़', chodo: 'छोड़ो', chhod: 'छोड़', chhodo: 'छोड़ो',
    chhodna: 'छोड़ना', chhodte: 'छोड़ते', chhodo_: 'छोड़ो',
    tod: 'तोड़', todo: 'तोड़ो', todna: 'तोड़ना', todta: 'तोड़ता',
    todte: 'तोड़ते', todd: 'तोड़',
    maar: 'मार', maaro: 'मारो', mara: 'मारा', mari: 'मारी', mare: 'मारे',
    marna: 'मारना', marta: 'मारता', marte: 'मारते',
    girna: 'गिरना', girta: 'गिरता', girte: 'गिरते', gire: 'गिरे',
    uda: 'उड़ा', udna: 'उड़ना', udta: 'उड़ता', udte: 'उड़ते', udna_: 'उड़ना',
    utha: 'उठा', uthi: 'उठी', uthe: 'उठे', uthna: 'उठना', uthо: 'उठो',
    baitha: 'बैठा', baithi: 'बैठी', baithe: 'बैठे', baitho: 'बैठो',
    baithna: 'बैठना', baith: 'बैठ', baithte: 'बैठते',
    kholo: 'खोलो', khola: 'खोला', kholi: 'खोली', khole: 'खोले',
    kholna: 'खोलना', kholte: 'खोलते',
    band: 'बंद', bandkaro: 'बंद करो', bandkar: 'बंद कर',
    bulao: 'बुलाओ', bulana: 'बुलाना', bulaya: 'बुलाया', bulati: 'बुलाती',
    bulate: 'बुलाते', bula: 'बुला',
    bhejo: 'भेजो', bhejna: 'भेजना', bheja: 'भेजा', bheji: 'भेजी', bheje: 'भेजे',
    padho: 'पढ़ो', padhna: 'पढ़ना', padha: 'पढ़ा', padhi: 'पढ़ी', padhe: 'पढ़े',
    padhta: 'पढ़ता', padhte: 'पढ़ते',
    likho: 'लिखो', likhna: 'लिखना', likha: 'लिखा', likhi: 'लिखी', likhe: 'लिखे',
    likhta: 'लिखता', likhte: 'लिखते',
    sambhalo: 'संभालो', sambhalna: 'संभालना', sambhala: 'संभाला', sambhal: 'संभाल',
    maano: 'मानो', maanna: 'मानना', maana: 'माना', maani: 'मानी', maane: 'माने',
    chuno: 'चुनो', chuna: 'चुना', chune: 'चुने', chunta: 'चुनता',
    mangwao: 'माँगवाओ', jodo: 'जोड़ो', jodna: 'जोड़ना', joda: 'जोड़ा',
    tod_: 'तोड़', uth_: 'उठ', phat: 'फट', phatna: 'फटना',
    rakh_: 'रख', samjho: 'समझो', samajhna: 'समझना', samjha: 'समझा',
    samjhi: 'समझी', samjhe: 'समझे', samajhte: 'समझते', samajhta: 'समझता',
    btana: 'बताना', batao: 'बताओ', bata: 'बता', bataya: 'बताया',
    batai: 'बताई', batate: 'बताते', batana_: 'बताना',
    manana: 'मनाना', mano: 'मानो', dilao: 'दिलाओ', dilana: 'दिलाना',
    khilona: 'खीलना', khelna: 'खेलना', khelo: 'खेलो', khela: 'खेला',
    kheli: 'खेली', khele: 'खेले', khelta: 'खेलता', khelte: 'खेलते',
    dekh_: 'देख', sun_: 'सुन', chalo_: 'चलो', jao_: 'जाओ',
    lagana: 'लगाना', lagao: 'लगाओ', lagna: 'लगना', lagta: 'लगता',
    lagti: 'लगती', lagte: 'लगते', laga: 'लगा',
    gir_: 'गिर', uda_: 'उड़', hath_: 'हाथ',

    // question & function words
    kya: 'क्या', kyu: 'क्यों', kyon: 'क्यों', kyuki: 'क्योंकि',
    kyunki_: 'क्योंकि', kahan: 'कहाँ', kaha: 'कहाँ', kahaan: 'कहाँ',
    kab: 'कब', kaun: 'कौन', konsa: 'कौनसा', konsi: 'कौनसी', konse: 'कौनसे',
    kaisa: 'कैसा', kaise: 'कैसे', kaisi: 'कैसी', kitna: 'कितना',
    kitni: 'कितनी', kitne: 'कितने', kitna_: 'कितना', kya_: 'क्या',
    haan: 'हाँ', ha: 'हाँ', nahi: 'नहीं', nahin: 'नहीं', na: 'ना', naa: 'ना',
    mat: 'मत', kabhi: 'कभी', aksar: 'अक्सर', shayad: 'शायद',
    zarur: 'ज़रूर', zaroor: 'ज़रूर', zaroori: 'ज़रूरी', jaruri: 'ज़रूरी',
    zaruri: 'ज़रूरी', pakka: 'पक्का', sach: 'सच', sachchi: 'सच्ची',
    sachmein: 'सचमुच', sachmuch: 'सचमुच', sachme: 'सच में',
    bilkul: 'बिल्कुल', thoda: 'थोड़ा', thodi: 'थोड़ी', thode: 'थोड़े',
    bahut: 'बहुत', bahot: 'बहुत', bohot: 'बहुत', zyada: 'ज़्यादा', zyada_: 'ज़्यादा',
    kam: 'कम', jaldi: 'जल्दी', abhi: 'अभी', ab: 'अब', tab_: 'तब',
    aaj: 'आज', kal: 'कल', parso: 'परसों', raat: 'रात', raat_: 'रात',
    subah: 'सुबह', sham: 'शाम', dopahar: 'दोपहर', samay: 'समय',
    waqt_: 'वक़्त', hafte: 'हफ्ते', mahine: 'महीने', mahina: 'महीना',
    saal: 'साल', saalon: 'सालों', saal_: 'साल', minute: 'मिनट',
    ghanta: 'घंटा', ghante: 'घंटे', second: 'सेकंड',

    // adjectives & adverbs
    achha: 'अच्छा', acha: 'अच्छा', accha: 'अच्छा', achhi: 'अच्छी',
    acche: 'अच्छे', achhi_: 'अच्छी', acchha: 'अच्छा', acchhi: 'अच्छी',
    acchhe: 'अच्छे', badiya: 'बढ़िया', badia: 'बढ़िया', mast: 'मस्त',
    shandar: 'शानदार', khoobsurat: 'खूबसूरत', sundar: 'सुंदर',
    sundari: 'सुंदरी', pyari: 'प्यारी', mehnga: 'महँगा', mehngi: 'महँगी',
    sasta: 'सस्ता', sasti: 'सस्ती', mazedaar: 'मज़ेदार', maza: 'मज़ा',
    funny: 'फनी', serious: 'सीरियस', important: 'ज़रूरी',
    mushkil: 'मुश्किल', mushkil_: 'मुश्किल', aasan: 'आसान', asaan: 'आसान',
    aasana: 'आसान', easy: 'आसान', hard: 'मुश्किल', slow: 'धीमा',
    tez: 'तेज़', tez_: 'तेज़', jaldi_: 'जल्दी', turant: 'तुरंत',
    foran: 'फौरन', naya: 'नया', nayi: 'नयी', naye: 'नए',
    purana: 'पुराना', purani: 'पुरानी', purane: 'पुराने', naya_: 'नया',
    bada: 'बड़ा', badi: 'बड़ी', bade: 'बड़े', chhota: 'छोटा', choti: 'छोटी',
    chhote: 'छोटे', lamba: 'लंबा', lambi: 'लंबी', lambe: 'लंबे',
    sundar_: 'सुंदर', ghar_: 'घर', acche_: 'अच्छे', theek: 'ठीक',
    galat: 'ग़लत', sahi: 'सही', asli: 'असली', naya_: 'नया',
    purana_: 'पुराना', thaka: 'थका', thaki: 'थकी', thake: 'थके',

    // nouns
    aadmi: 'आदमी', aadmiyon: 'आदमियों', aurat: 'औरत', auratein: 'औरतें',
    ladka: 'लड़का', ladki: 'लड़की', ladke: 'लड़के', ladkiyon: 'लड़कियों',
    ladkon: 'लड़कों', bachcha: 'बच्चा', bachche: 'बच्चे', bachchon: 'बच्चों',
    bachpan: 'बचपन', dost: 'दोस्त', dost_: 'दोस्त', dosto: 'दोस्तों',
    ghar: 'घर', ghar_: 'घर', gharo: 'घरों', kamra: 'कमरा', kamre: 'कमरे',
    sheher: 'शहर', shahar: 'शहर', gaon: 'गाँव', gaon_: 'गाँव', gaono: 'गाँवों',
    road: 'रोड', sadak: 'सड़क', rasta: 'रास्ता', gaadi: 'गाड़ी',
    gaadio: 'गाड़ियों', gaadiyon: 'गाड़ियों', bus: 'बस', train: 'ट्रेन',
    kaam: 'काम', kaamo: 'कामों', office: 'ऑफिस', school: 'स्कूल',
    college: 'कॉलेज', university: 'यूनिवर्सिटी', hospital: 'हॉस्पिटल',
    market: 'बाज़ार', bazaar: 'बाज़ार', dukan: 'दुकान', dukano: 'दुकानों',
    restaurant: 'रेस्टोरेंट', hotel: 'होटल', park: 'पार्क', temple: 'मंदिर',
    masjid: 'मस्जिद', gurudwara: 'गुरुद्वारा', mandir: 'मंदिर',
    airport: 'एयरपोर्ट', station: 'स्टेशन', bank: 'बैंक', police: 'पुलिस',
    court: 'कोर्ट', farm: 'फ़ार्म', nadi: 'नदी', dariya: 'दरिया',
    samundar: 'समुद्र', pahaad: 'पहाड़', pahad: 'पहाड़', pahaadon: 'पहाड़ों',
    jungle: 'जंगल', patta: 'पत्ता', patte: 'पत्ते', phool: 'फूल',
    phoolo: 'फूलों', tree: 'पेड़', ped: 'पेड़', pedo: 'पेड़ों',
    paudha: 'पौधा', paudhe: 'पौधे', mitti: 'मिट्टी', pani: 'पानी',
    paani: 'पानी', chai: 'चाय', doodh: 'दूध', khana: 'खाना',
    roti: 'रोटी', sabzi: 'सब्ज़ी', sabziyan: 'सब्ज़ियाँ', daal: 'दाल',
    chawal: 'चावल', ata: 'आटा', tel: 'तेल', namak: 'नमक',
    mirchi: 'मिर्च', cheeni: 'चीनी', gur: 'गुड़', lassi: 'लस्सी',
    juice: 'जूस', beer: 'बियर', maas: 'माँस', murgi: 'मुर्गी',
    anda: 'अंडा', anda_: 'अंडा', namkeen: 'नमकीन', mithai: 'मिठाई',
    meetha: 'मीठा', halwa: 'हलवा', laddu: 'लड्डू', jalebi: 'जलेबी',
    barfi: 'बर्फ़ी', pedha: 'पेड़ा', rasgulla: 'रसगुल्ला', kheer: 'खीर',
    sarson: 'सरसों', tamarind: 'खरबूरा',
    jagah: 'जगह', jagaho: 'जगहों', upar: 'ऊपर', neeche: 'नीचे',
    aage: 'आगे', piche: 'पीछे', andar: 'अंदर', bahar: 'बाहर',
    nazdik: 'नज़दीक', door: 'दूर', paas: 'पास', samne: 'सामने',
    bagal: 'बगल', kandhe: 'कंधे', sar: 'सर', matra: 'माथा',
    aankh: 'आँख', aankhen: 'आँखें', haath: 'हाथ', haathon: 'हाथों',
    pair: 'पैर', pairo: 'पैरों', dil: 'दिल', dimag: 'दिमाग',
    mooh: 'मुँह', muh: 'मुँह', baal: 'बाल', baalo: 'बालों',
    badan: 'बदन', khoon: 'खून', bukhar: 'बुखार', bimari: 'बीमारी',
    dawa: 'दवा', tabiyat: 'तबीयत', doctor: 'डॉक्टर', nurse: 'नर्स',
    ambulance: 'एम्बुलेंस', medicine: 'दवा', report: 'रिपोर्ट',
    baat: 'बात', baatein: 'बातें', kahani: 'कहानी', kahaniyan: 'कहानियाँ',
    film: 'फ़िल्म', movie: 'मूवी', song: 'गाना', gaana: 'गाना',
    music: 'संगीत', game: 'गेम', khel: 'खेल', jitna: 'जितना',
    haar: 'हार', jeet: 'जीत', yaar: 'यार', shauk: 'शौक',
    pasand: 'पसंद', pyar: 'प्यार', prem: 'प्रेम', mohabbat: 'मोहब्बत',
    rishta: 'रिश्ता', dostii: 'दोस्ती', jang: 'जंग', victory: 'जीत',
    sarp: 'साँप', haathi: 'हाथी', sher: 'शेर', bagh: 'बाघ',
    chidiya: 'चिड़िया', titli: 'तितली', machli: 'मछली', kela: 'केला',
    seb: 'सेब', amrood: 'आम', aam: 'आम', gaza: 'गाज़ा', tarbooz: 'तरबूज़',
    tamatar: 'टमाटर', pyaz: 'प्याज़', lau: 'लौ', gajar: 'गाजर',
    palak: 'पालक', methi: 'मेथी', bhindi: 'भिंडी', karela: 'करेला',
    shakarkandi: 'शकरकंदी', chaat: 'चाट', samosa: 'समोसा',
    pakoda: 'पकोड़ी', bhaji: 'भाजी', roti_: 'रोटी', sabzi_: 'सब्ज़ी',
    pyaaz: 'प्याज़', lehsun: 'लहसुन', adrak: 'अदरक', haldi: 'हल्दी',
    jeera: 'जीरा', dhaniya: 'धनिया', kali: 'काली', mirch: 'मिर्च',
    kurma: 'कुरमा', biryani: 'बिरयानी', pulao: 'पुलाव', roti_khaya: 'रोटी खाई',

    // more nouns
    computer: 'कंप्यूटर', laptop: 'लैपटॉप', mobile: 'मोबाइल', phone: 'फ़ोन',
    samay_: 'समय', khel_: 'खेल', kaam_: 'काम', dost__: 'दोस्त',
    naukri: 'नौकरी', job: 'नौकरी', business: 'व्यवसाय', office_: 'ऑफिस',
    teacher: 'शिक्षक', student: 'छात्र', professor: 'प्रोफेसर',
    book: 'किताब', kitaab: 'किताब', kitaabein: 'किताबें',
    kagaz: 'कागज़', pen: 'पेन', notebook: 'नोटबुक', diary: 'डायरी',
    letter: 'चिट्ठी', email: 'ईमेल', message: 'संदेश', password: 'पासवर्ड',
    picture: 'तस्वीर', photo: 'फ़ोटो', video: 'वीडियो', news: 'ख़बर',
    paper: 'कागज़', magazine: 'पत्रिका', newspaper: 'समाचार पत्र',
    idea: 'आइडिया', plan: 'योजना', problem: 'समस्या', solution: 'समाधान',
    question: 'सवाल', answer: 'जवाब', problem_: 'समस्या',
    money: 'पैसा', paise: 'पैसे', rupaiya: 'रुपया', rupaye: 'रुपये',
    price: 'कीमत', paisa: 'पैसा', salary: 'सैलरी', account: 'खाता',
    customer: 'ग्राहक', customer_: 'ग्राहक', boss: 'बॉस', team: 'टीम',
    company: 'कंपनी', office_: 'ऑफिस', system: 'सिस्टम', program: 'प्रोग्राम',
    country: 'देश', desh: 'देश', duniya: 'दुनिया', world: 'दुनिया',
    shahar_: 'शहर', gaon_: 'गाँव', road_: 'सड़क', nazar_: 'नज़र',
    insaan: 'इंसान', janta: 'जनता', samaj: 'समाज', culture: 'संस्कृति',
    language: 'भाषा', bhasha: 'भाषा', hindi: 'हिंदी', urdu: 'उर्दू',
    english: 'अंग्रेज़ी', sanskrit: 'संस्कृत', punjabi: 'पंजाबी',
    marathi: 'मराठी', bengali: 'बंगाली', tamil: 'तमिल', telugu: 'तेलुगु',
    friend: 'दोस्त', dosto_: 'दोस्त', family: 'परिवार', parivar: 'परिवार',
    mother: 'माँ', maa: 'माँ', father: 'पिता', papa: 'पापा',
    brother: 'भाई', bhai: 'भाई', behen: 'बहन', sister: 'बहन',
    beta: 'बेटा', beti: 'बेटी', pati: 'पति', patni: 'पत्नी',
    husband: 'पति', wife: 'पत्नी', dada: 'दादा', dadi: 'दादी',
    nana: 'नाना', nani: 'नानी', uncle: 'चाचा', chacha: 'चाचा',
    aunty: 'ऑंटी', tau: 'ताऊ', mama: 'मामा', mami: 'मामी',
    mummy: 'मम्मी', papa_: 'पापा', didi: 'दीदी', bhaiya: 'भैया',
    didi_: 'दीदी', akela: 'अकेला', akeli: 'अकेली', akele: 'अकेले',

    // numbers
    ek: 'एक', do_: 'दो', teen: 'तीन', char: 'चार', paanch: 'पांच',
    panch: 'पांच', chhe: 'छह', cheh: 'छह', chah: 'छह', saat: 'सात',
    aath: 'आठ', nau: 'नौ', das: 'दस', gyarah: 'ग्यारह', barah: 'बारह',
    teerah: 'तेरह', chaudah: 'चौदह', pandrah: 'पंद्रह', pandrah_: 'पंद्रह',
    solah: 'सोलह', satrah: 'सत्रह', atharah: 'अठारह', unnees: 'उन्नीस',
    bees: 'बीस', ekais: 'इक्कीस', baees: 'बाईस', tees: 'तीस',
    chaatis: 'चौंतीस', pachas: 'पचास', saath: 'साठ', ikkais: 'इक्यावन',
    dus: 'दस', gyaarah: 'ग्यारह',

    // misc
    raasta: 'रास्ता', nashta: 'नाश्ता', khana_: 'खाना', chai_: 'चाय',
    kitab: 'किताब', padosi: 'पड़ोसी', padosi_: 'पड़ोसी', ghar_: 'घर',
    darwaza: 'दरवाज़ा', khidki: 'खिड़की', chhat: 'छत', deewar: 'दीवार',
    aag: 'आग', dhoop: 'धूप', barish: 'बारिश', mausam: 'मौसम',
    hawa: 'हवा', dhund: 'धुंध', baadal: 'बादल', bijli: 'बिजली',
    bijlee: 'बिजली', computer_: 'कंप्यूटर', net: 'नेट', internet: 'इंटरनेट',
    password_: 'पासवर्ड', screen: 'स्क्रीन', mouse: 'माउस', keyboard: 'कीबोर्ड',
    charger: 'चार्जर', camera: 'कैमरा', photo_: 'फ़ोटो', video_: 'वीडियो',
    film_: 'फ़िल्म', song_: 'गाना', actor: 'अभिनेता', actress: 'अभिनेत्री',
    director: 'निर्देशक', producer: 'निर्माता', cinema: 'सिनेमा',
    song_: 'गाना', download: 'डाउनलोड', upload: 'अपलोड', install: 'इंस्टॉल',
    settings: 'सेटिंग्स', option: 'ऑप्शन', button: 'बटन', link: 'लिंक',
    folder: 'फ़ोल्डर', file: 'फ़ाइल', data: 'डेटा', server: 'सर्वर',
    browser: 'ब्राउज़र', website: 'वेबसाइट', app: 'ऐप', application: 'ऐप्लिकेशन',
    account_: 'खाता', profile: 'प्रोफ़ाइल', username: 'यूज़रनेम',
    password2: 'पासवर्ड', hello: 'हैलो', ok: 'ठीक', okay: 'ठीक',
    sorry: 'माफ़ करें', sorry_: 'माफ़ करें', please: 'कृपया',
    welcome: 'स्वागत है', thanks: 'धन्यवाद', thank: 'धन्यवाद',
    bye: 'बाय', goodbye: 'अलविदा', hiya: 'नमस्ते', namaste: 'नमस्ते',
    shubh: 'शुभ', prabhat: 'प्रभात', sandhya: 'संध्या', raatri: 'रात्रि',
    dosto_: 'दोस्तों', jaldi_: 'जल्दी', chai_: 'चाय',

    // postpositions & connectors
    ka: 'का', ki: 'की', ke: 'के', ko: 'को', se: 'से', tak: 'तक',
    wala: 'वाला', wali: 'वाली', wale: 'वाले', vala: 'वाला',
    har: 'हर', kuch_: 'कुछ', sab_: 'सब', jis_: 'जिस',
    jinka_: 'जिनका', yahan: 'यहाँ', wahan: 'वहाँ', yahin: 'यहीं',
    wahin: 'वहीं', yahaan: 'यहाँ', wahaan: 'वहाँ', idhar: 'इधर',
    udhar: 'उधर', yaha_: 'यहाँ', wahan_: 'वहाँ', so: 'सो', sone: 'सोना',
    sona: 'सोना', jagna: 'जागना', uthna: 'उठना', lagna: 'लगना',
    samajh: 'समझ', samjh: 'समझ', samajhte: 'समझते', samajhta: 'समझता',
    mahatra: 'महत्व', mahattv: 'महत्व', mahaat: 'महत्त्व',
    jana: 'जाना', jayega: 'जाएगा', jayenge: 'जाएंगे', jana_: 'जाना',
    aana: 'आना', laana: 'लाना', lena_: 'लेना', dena_: 'देना',
    karna_: 'करना', rakhna_: 'रखना', chalna: 'चलना', sunna_: 'सुनना',
    dekhna_: 'देखना', samajhna_: 'समझना', banana_: 'बनाना',
    dhanyavaad: 'धन्यवाद', shukriya: 'शुक्रिया', dhanyavad: 'धन्यवाद',
    vidaai: 'विदाई', namaste_: 'नमस्ते', swagat: 'स्वागत',
    kripya: 'कृपया', maafi: 'माफ़ी', tum_: 'तुम',

    // English loanwords people type in Hinglish
    meeting: 'मीटिंग', meetings: 'मीटिंग्स', sitting: 'सिटिंग',
    fitting: 'फिटिंग', getting: 'गेटिंग', booking: 'बुकिंग',
    cooking: 'कुकिंग', working: 'वर्किंग', parking: 'पार्किंग',
    training: 'ट्रेनिंग', morning: 'मॉर्निंग',
    feedback: 'फ़ीडबैक', weekend: 'वीकएंड', deadline: 'डेडलाइन',
    dashboard: 'डैशबोर्ड', software: 'सॉफ़्टवेयर',
    hardware: 'हार्डवेयर', network: 'नेटवर्क', website: 'वेबसाइट',
    online: 'ऑनलाइन', offline: 'ऑफ़लाइन', update: 'अपडेट',
    download: 'डाउनलोड', upload: 'अपलोड', login: 'लॉगिन', logout: 'लॉगआउट',
    email_: 'ईमेल', link_: 'लिंक', print: 'प्रिंट',
    scan: 'स्कैन', edit: 'एडिट', delete: 'डिलीट',
    save: 'सेव', cancel: 'कैंसिल', submit: 'सबमिट', search: 'सर्च',
    settings_: 'सेटिंग्स', support: 'सपोर्ट', report_: 'रिपोर्ट',

    // common Indian names (proper nouns keep their long vowels)
    rahul: 'राहुल', amit: 'अमित', amol: 'अमोल', anil: 'अनिल',
    arun: 'अरुण', ashok: 'अशोक', deepak: 'दीपक', vijay: 'विजय',
    ravi: 'रवि', sanjay: 'संजय', suresh: 'सुरेश', mahesh: 'महेश',
    rakesh: 'राकेश', manoj: 'मनोज', sohan: 'सोहन', rohan: 'रोहन',
    mohit: 'मोहित', nikhil: 'निखिल', akash: 'आकाश', ankit: 'अंकित',
    vikas: 'विकास', sandeep: 'संदीप', sandip: 'संदीप', sunil: 'सुनील',
    satish: 'सतीश', ramesh: 'रमेश', ganesh: 'गणेश', prakash: 'प्रकाश',
    vinod: 'विनोद', dinesh: 'दिनेश', kamal: 'कमल', gopal: 'गोपाल',
    krishan: 'कृष्ण', krishna: 'कृष्ण', surya: 'सूर्य', shiva: 'शिव',
    vishnu: 'विष्णु', hanuman: 'हनुमान', sita: 'सीता', radha: 'राधा',
    gita: 'गीता', savitri: 'सवित्री', meera: 'मीरा', seema: 'सीमा',
    pooja: 'पूजा', puja: 'पूजा', priya: 'प्रिया', priyanka: 'प्रियंका',
    neha: 'नेहा', neetu: 'नीतू', nita: 'नीता', anita: 'अनीता',
    sunita: 'सुनीता', rekha: 'रेखा', geeta: 'गीता', deepa: 'दीपा',
    shreya: 'श्रेया', aarti: 'आरती', arti: 'आरती', divya: 'दिव्या',
    sweta: 'स्वेता', anjali: 'अंजलि', manisha: 'मनीषा', vandana: 'वंदना',
    kavita: 'कविता', roopa: 'रूपा', hema: 'हेमा', isha: 'इशा',
    tanvi: 'तन्वी', rashi: 'राशि', ram: 'राम', shyam: 'श्याम',
    mohan: 'मोहन', naman: 'नमन', karan: 'करण', varun: 'वरुण',
    arjun: 'अर्जुन', ajay: 'अजय', sanjeev: 'संजीव', sanjay_: 'संजय',
    balram: 'बलराम', krishn: 'कृष्ण', raman: 'रमण', sudhir: 'सुधीर',
    murli: 'मुरली', krishna_: 'कृष्ण', hari: 'हरि', krishn_: 'कृष्ण',
    chandra: 'चंद्र', surendra: 'सुरेंद्र', naresh: 'नरेश', manish: 'मनीष',
    yash: 'यश', yash_: 'यश', dev: 'देव', devansh: 'देवांश', rehan: 'रेहान',
    kabir: 'कबीर', mira: 'मीरा', neel: 'नील', neeru: 'नीरू', ritu: 'रितु',
    sonu: 'सोनू', monu: 'मोनू',anu: 'अनु', tanu: 'तनु', ritu_: 'रितु'
  };

  /* ------------------------------------------------------------------ *
   * 3. Common English -> Hindi  (offline fallback + instant preview)
   * ------------------------------------------------------------------ */

  const ENGLISH = {
    hello: 'हैलो', hi: 'हाय', hey: 'हाय', greetings: 'नमस्ते',
    namaste: 'नमस्ते', bye: 'बाय', goodbye: 'अलविदा', farewell: 'अलविदा',
    yes: 'हाँ', yeah: 'हाँ', yup: 'हाँ', no: 'नहीं', nope: 'नहीं',
    maybe: 'शायद', okay: 'ठीक है', ok: 'ठीक', fine: 'ठीक', good: 'अच्छा',
    bad: 'बुरा', great: 'बहुत अच्छा', awesome: 'शानदार', nice: 'अच्छा',
    sorry: 'माफ़ करें', please: 'कृपया', thanks: 'धन्यवाद',
    thank: 'धन्यवाद', welcome: 'स्वागत है', goodbye_: 'अलविदा',
    good: 'अच्छा', bad: 'बुरा', new: 'नया', old: 'पुराना', big: 'बड़ा',
    small: 'छोटा', long: 'लंबा', short: 'छोटा', high: 'ऊँचा', low: 'नीचा',
    hot: 'गरम', cold: 'ठंडा', warm: 'गरम', cool: 'ठंडा', fast: 'तेज़',
    slow: 'धीमा', easy: 'आसान', difficult: 'मुश्किल', hard: 'मुश्किल',
    happy: 'खुश', sad: 'उदास', beautiful: 'सुंदर', ugly: 'बदसूरत',
    good: 'अच्छा', true: 'सच', false: 'झूठ', real: 'असली', same: 'वही',
    all: 'सब', some: 'कुछ', none: 'कोई नहीं', many: 'बहुत', much: 'बहुत',
    more: 'और', less: 'कम', best: 'सबसे अच्छा', worst: 'सबसे बुरा',
    every: 'हर', each: 'हर', other: 'दूसरा', another: 'एक और',
    and: 'और', or: 'या', but: 'लेकिन', if: 'अगर', then: 'तब',
    because: 'क्योंकि', so: 'इसलिए', but_: 'लेकिन', also: 'भी',
    very: 'बहुत', too: 'बहुत', only: 'केवल', just: 'सिर्फ', still: 'अभी',
    never: 'कभी नहीं', always: 'हमेशा', often: 'अक्सर', sometimes: 'कभी-कभी',
    i: 'मैं', me: 'मुझे', my: 'मेरा', mine: 'मेरा', myself: 'मैं',
    you: 'आप', your: 'आपका', yours: 'आपका', yourself: 'आप',
    he: 'वह', him: 'उसे', his: 'उसका', she: 'वह', her: 'उसकी', hers: 'उसकी',
    it: 'यह', its: 'इसका', we: 'हम', us: 'हमें', our: 'हमारा', ours: 'हमारा',
    they: 'वे', them: 'उन्हें', their: 'उनका', theirs: 'उनका',
    this: 'यह', that: 'वह', these: 'ये', those: 'वे', here: 'यहाँ', there: 'वहाँ',
    what: 'क्या', where: 'कहाँ', when: 'कब', why: 'क्यों', who: 'कौन',
    whom: 'किसे', whose: 'किसका', which: 'कौन सा', how: 'कैसे',
    is: 'है', am: 'हूँ', are: 'हैं', was: 'था', were: 'थे', been: 'रहे',
    being: 'होना', be: 'होना', do: 'करना', does: 'करता', did: 'किया',
    done: 'हो गया', have: 'है', has: 'है', had: 'था', having: 'रखना',
    will: 'वह करेगा', would: 'करेगा', shall: 'करूँगा', should: 'चाहिए',
    must: 'ज़रूरी है', may: 'शायद', might: 'शायद', can: 'सकता है',
    could: 'सकता था', cannot: 'नहीं सकता',
    not: 'नहीं', no_: 'नहीं', yes_: 'हाँ', don: 'मत', doesn: 'नहीं करता',
    didn: 'नहीं किया', can_: 'नहीं सकता', won: 'नहीं करेगा',
    go: 'जाना', come: 'आना', eat: 'खाना', drink: 'पीना', sleep: 'सोना',
    work: 'काम', play: 'खेलना', read: 'पढ़ना', write: 'लिखना',
    speak: 'बोलना', talk: 'बात करना', listen: 'सुनना', hear: 'सुनना',
    see: 'देखना', look: 'देखना', watch: 'देखना', give: 'देना',
    take: 'लेना', get: 'लेना', make: 'बनाना', want: 'चाहना',
    need: 'चाहिए', like: 'पसंद करना', love: 'प्यार करना', help: 'मदद करना',
    know: 'जानना', think: 'सोचना', understand: 'समझना', learn: 'सीखना',
    teach: 'सिखाना', say: 'कहना', tell: 'बताना', ask: 'पूछना',
    call: 'बुलाना', send: 'भेजना', buy: 'खरीदना', sell: 'बेचना',
    open: 'खोलना', close: 'बंद करना', start: 'शुरू करना', stop: 'रोकना',
    help_: 'मदद', hello_: 'हैलो',
    water: 'पानी', food: 'खाना', rice: 'चावल', bread: 'रोटी',
    tea: 'चाय', coffee: 'कॉफ़ी', fruit: 'फल', vegetables: 'सब्ज़ी',
    milk: 'दूध', sugar: 'चीनी', salt: 'नमक', oil: 'तेल',
    fruit_: 'फल', apple: 'सेब', banana: 'केला', mango: 'आम',
    friend: 'दोस्त', family: 'परिवार', mother: 'माँ', father: 'पिता',
    brother: 'भाई', sister: 'बहन', son: 'बेटा', daughter: 'बेटी',
    husband: 'पति', wife: 'पत्नी', child: 'बच्चा', children: 'बच्चे',
    man: 'आदमी', woman: 'औरत', people: 'लोग', person: 'व्यक्ति',
    home: 'घर', house: 'घर', room: 'कमरा', door: 'दरवाज़ा',
    school: 'स्कूल', college: 'कॉलेज', university: 'यूनिवर्सिटी',
    teacher: 'शिक्षक', student: 'छात्र', teacher_: 'शिक्षक',
    doctor: 'डॉक्टर', nurse: 'नर्स', hospital: 'हॉस्पिटल',
    book: 'किताब', books: 'किताबें', pen: 'पेन', paper: 'कागज़',
    computer: 'कंप्यूटर', phone: 'फ़ोन', mobile: 'मोबाइल', email: 'ईमेल',
    car: 'गाड़ी', bus: 'बस', train: 'ट्रेन', road: 'सड़क',
    city: 'शहर', village: 'गाँव', country: 'देश', world: 'दुनिया',
    India: 'भारत', Delhi: 'दिल्ली', Mumbai: 'मुंबई', name: 'नाम',
    time: 'समय', day: 'दिन', week: 'हफ्ता', month: 'महीना', year: 'साल',
    today: 'आज', tomorrow: 'कल', yesterday: 'कल', morning: 'सुबह',
    afternoon: 'दोपहर', evening: 'शाम', night: 'रात', monday: 'सोमवार',
    tuesday: 'मंगलवार', wednesday: 'बुधवार', thursday: 'गुरुवार',
    friday: 'शुक्रवार', saturday: 'शनिवार', sunday: 'रविवार',
    money: 'पैसा', price: 'कीमत', shop: 'दुकान', market: 'बाज़ार',
    job: 'नौकरी', work_: 'काम', office: 'ऑफिस', company: 'कंपनी',
    love_: 'प्यार', life: 'जीवन', death: 'मौत', god: 'ईश्वर',
    country_: 'देश', language: 'भाषा', question: 'सवाल', answer: 'जवाब',
    problem: 'समस्या', idea: 'आइडिया', plan: 'योजना', news: 'ख़बर',
    picture: 'तस्वीर', music: 'संगीत', song: 'गाना', movie: 'फ़िल्म',
    game: 'खेल', sport: 'खेल', football: 'फ़ुटबॉल', cricket: 'क्रिकेट',
    hello__greeting: 'नमस्ते'
  };

  // Multi-word phrases (checked before single words).
  const PHRASES = {
    'thank you': 'धन्यवाद',
    'thank you very much': 'बहुत बहुत धन्यवाद',
    'thanks a lot': 'बहुत धन्यवाद',
    'good morning': 'शुभ प्रभात',
    'good afternoon': 'शुभ दोपहर',
    'good evening': 'शुभ संध्या',
    'good night': 'शुभ रात्रि',
    'how are you': 'आप कैसे हैं',
    'how are you doing': 'आप कैसे हैं',
    'what is your name': 'आपका नाम क्या है',
    'my name is': 'मेरा नाम है',
    'nice to meet you': 'आपसे मिलकर खुशी हुई',
    'excuse me': 'माफ़ कीजिए',
    'i am sorry': 'मुझे माफ़ करें',
    'i love you': 'मैं तुमसे प्यार करता हूँ',
    'see you': 'फिर मिलेंगे',
    'no problem': 'कोई बात नहीं',
    'of course': 'बिल्कुल',
    'where are you from': 'आप कहाँ से हैं',
    'how old are you': 'आपकी उम्र कितनी है',
    'what do you do': 'आप क्या करते हैं',
    'good job': 'शाबाश',
    'well done': 'बहुत अच्छा',
    'take care': 'ख्याल रखिए',
    'have a nice day': 'आपका दिन अच्छा हो',
    'i am fine': 'मैं ठीक हूँ',
    'i am good': 'मैं ठीक हूँ',
    "let's go": 'चलो',
    'good job done': 'शाबाश'
  };

  // Words that are unmistakably English (used for language sniffing).
  const ENGLISH_ONLY = new Set([
    'the', 'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being', 'and', 'or',
    'but', 'if', 'then', 'because', 'so', 'very', 'too', 'not', 'no', 'yes',
    'you', 'your', 'i', 'me', 'my', 'we', 'our', 'he', 'him', 'his', 'she',
    'her', 'it', 'its', 'they', 'them', 'their', 'this', 'that', 'these',
    'those', 'here', 'there', 'what', 'where', 'when', 'why', 'who', 'which',
    'how', 'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'can',
    'could', 'should', 'may', 'might', 'must', 'shall', 'all', 'some', 'any',
    'every', 'each', 'other', 'more', 'most', 'less', 'than', 'with', 'from',
    'for', 'about', 'into', 'over', 'after', 'before', 'between', 'out', 'up',
    'down', 'off', 'on', 'in', 'at', 'to', 'of', 'as', 'by', 'off', 'under',
    'hello', 'goodbye', 'please', 'thanks', 'welcome', 'sorry', 'name',
    'time', 'day', 'year', 'water', 'food', 'friend', 'family', 'love',
    'work', 'home', 'house', 'school', 'book', 'phone', 'car', 'city',
    'morning', 'night', 'today', 'tomorrow', 'yesterday', 'how', 'are', 'you',
    'doing', 'fine', 'great', 'like', 'want', 'need', 'know', 'think',
    'help', 'good', 'bad', 'new', 'old', 'big', 'small', 'very', 'really',
    'always', 'never', 'sometimes', 'yes', 'nice', 'welcome', 'sure'
  ]);

  // Hinglish markers — unmistakably Hindi written in Latin script.
  const HINGLISH_ONLY = new Set([
    'aap', 'aapko', 'aapka', 'aapki', 'aapke', 'aapse', 'hai', 'hain', 'ho',
    'nahi', 'nahin', 'kya', 'kaise', 'kaisa', 'kyu', 'kyun', 'kyon', 'kyunki',
    'mujhe', 'mujhko', 'mera', 'meri', 'mere', 'tera', 'teri', 'tere',
    'tum', 'tumko', 'tumhe', 'tujhe', 'tu', 'hum', 'humko', 'humara', 'humari',
    'humare', 'bhai', 'yaar', 'karo', 'karna', 'kar', 'kiya', 'chalo',
    'abhi', 'sab', 'kuchh', 'kuch', 'koi', 'batao', 'bata', 'dekho', 'dekh',
    'suno', 'sun', 'bolo', 'bolo', 'jao', 'jaa', 'aao', 'lo', 'lena', 'dena',
    'karna', 'rah', 'raha', 'rahi', 'rahe', 'gaya', 'gayi', 'gaye', 'liye',
    'mera', 'apna', 'apni', 'khud', 'bhi', 'hi', 'to', 'par', 'tak', 'taki',
    'isliye', 'jab', 'tab', 'kyunki', 'accha', 'acha', 'acha', 'theek',
    'bahut', 'zyada', 'kam', 'mein', 'main', 'hai', 'rahe', 'laga', 'lagta',
    'lagti', 'lagte', 'gaya', 'diya', 'diye', 'kaha', 'kahan', 'kab', 'kaun',
    'kitna', 'kitni', 'kitne', 'batao', 'chahiye', 'waqt', 'samay', 'aaj',
    'kal', 'raat', 'dopahar', 'subah', 'sham', 'pakka', 'shayad', 'sach',
    'mat', 'na', 'nahi', 'haan', 'vaise', 'aise', 'waise', 'jaisa', 'jaise',
    'sabse', 'bahar', 'andar', 'upar', 'neeche', 'aage', 'piche', 'paas',
    'door', 'nazdik', 'paisa', 'paise', 'rupaya', 'khana', 'paani', 'chai',
    'doodh', 'roti', 'sabzi', 'ghar', 'kamra', 'school', 'office', 'kaam',
    'dost', 'yaar', 'baat', 'naam', 'haath', 'aankh', 'sar', 'dil', 'samajh',
    'samjho', 'bata', 'batao', 'dekho', 'dekha', 'dekhi', 'dekhe', 'bhejo',
    'bhejna', 'pakdo', 'pakad', 'pakadna', 'chodo', 'chhod', 'chhodna',
    'kholo', 'kholna', 'band', 'raakh', 'rakho', 'rakh', 'rakhna', 'lao',
    'laya', 'lo', 'liye', 'waqt', 'kya', 'kya', 'hai', 'nahi', 'haan'
  ]);

  /* ------------------------------------------------------------------ *
   * 4. Roman -> Devanagari engine
   * ------------------------------------------------------------------ */

  const CONS_KEYS3 = Object.keys(CONS).filter(k => k.length === 3);
  const CONS_KEYS2 = Object.keys(CONS).filter(k => k.length === 2);
  const VOWEL_KEYS2 = Object.keys(VOWEL).filter(k => k.length === 2);
  const VOWEL_KEYS1 = Object.keys(VOWEL).filter(k => k.length === 1);

  function scanUnits(word) {
    const units = [];
    let i = 0;
    const L = word.length;
    while (i < L) {
      let hit = null;
      for (const k of CONS_KEYS3) {
        if (word.startsWith(k, i)) { hit = { type: 'C', val: k }; break; }
      }
      if (hit) { units.push(hit); i += 3; continue; }
      for (const k of CONS_KEYS2) {
        if (word.startsWith(k, i)) { hit = { type: 'C', val: k }; break; }
      }
      if (hit) { units.push(hit); i += 2; continue; }
      const ch = word[i];
      if (CONS[ch]) { units.push({ type: 'C', val: ch }); i += 1; continue; }
      for (const k of VOWEL_KEYS2) {
        if (word.startsWith(k, i)) { hit = { type: 'V', val: k }; break; }
      }
      if (hit) { units.push(hit); i += 2; continue; }
      for (const k of VOWEL_KEYS1) {
        if (word.startsWith(k, i)) { hit = { type: 'V', val: k }; break; }
      }
      if (hit) { units.push(hit); i += 1; continue; }
      units.push({ type: 'X', val: ch });
      i += 1;
    }
    return units;
  }

  function syllabify(units) {
    const syllables = [];
    let cur = { cons: [], vowels: [] };
    const flush = () => {
      if (cur.cons.length || cur.vowels.length) syllables.push(cur);
      cur = { cons: [], vowels: [] };
    };
    for (let i = 0; i < units.length; i++) {
      const un = units[i];
      if (un.type === 'C') {
        const last = cur.cons[cur.cons.length - 1];
        if (last && !cur.vowels.length && JOINT.has(last + un.val)) {
          cur.cons.push(un.val);
        } else {
          flush();
          cur.cons.push(un.val);
        }
      } else if (un.type === 'V') {
        cur.vowels.push(un.val);
        const next = units[i + 1];
        if (!next || next.type !== 'V') flush();
      } else {
        flush();
        syllables.push({ text: un.val });
      }
    }
    flush();
    return syllables;
  }

  function renderSyllable(syl, isLast, wordVowelCount) {
    if (syl.text !== undefined) return syl.text;
    const { cons, vowels } = syl;
    if (!cons.length) {
      // pure vowel syllable
      let out = '';
      vowels.forEach((v, idx) => {
        out += idx === 0 ? VOWEL_LONG[v] : VOWEL[v].ind;
      });
      return out;
    }
    let out = '';
    for (let i = 0; i < cons.length - 1; i++) out += CONS[cons[i]] + VIRAMA;
    const lastCons = CONS[cons[cons.length - 1]];
    if (!vowels.length) return out + lastCons; // bare consonant (schwa)

    const v1 = vowels[0];
    let head;
    if (v1 === 'a') {
      // A short "a" is a real vowel only when the syllable closes the word and
      // carries more than one consonant ("kya" -> क्या) or is one of several
      // syllables ("apna" -> अपना). Otherwise it is the implicit schwa.
      const explicit = isLast && (cons.length > 1 || wordVowelCount > 1);
      head = explicit ? lastCons + VOWEL.a.mat : lastCons;
    } else {
      head = lastCons + VOWEL[v1].mat;
    }
    out += head;
    if (vowels[1]) out += VOWEL[vowels[1]].ind;
    return out;
  }

  /** Rule-based fallback for a single word. */
  function wordToDeva(word) {
    const units = scanUnits(String(word).toLowerCase());
    const syllables = syllabify(units);
    const vowelCount = syllables.reduce(
      (n, s) => n + (s.vowels ? s.vowels.length : 0), 0);
    let out = '';
    for (let i = 0; i < syllables.length; i++) {
      out += renderSyllable(syllables[i], i === syllables.length - 1, vowelCount);
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 5. Public API
   * ------------------------------------------------------------------ */

  const PUNCT = /[.,!?;:"'`()\[\]{}—–\-_/\\|@#$%^&*+=<>~`*]/;

  function lookupDictionary(token) {
    const key = token.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(HINGLISH, key)) return HINGLISH[key];
    if (Object.prototype.hasOwnProperty.call(ENGLISH, key)) return ENGLISH[key];
    // simple singular/plural and stem variants
    const alts = [];
    if (key.endsWith('o')) alts.push(key.slice(0, -1) + 'on');
    if (key.endsWith('on')) alts.push(key.slice(0, -2));
    if (key.endsWith('i')) alts.push(key.slice(0, -1) + 'ya');
    if (key.endsWith('i')) alts.push(key.slice(0, -1) + 'e');
    if (key.endsWith('e')) alts.push(key.slice(0, -1));
    if (key.endsWith('s')) alts.push(key.slice(0, -1));
    if (key.endsWith('en')) alts.push(key.slice(0, -2));
    for (const alt of alts) {
      if (Object.prototype.hasOwnProperty.call(HINGLISH, alt)) return HINGLISH[alt];
      if (Object.prototype.hasOwnProperty.call(ENGLISH, alt)) return ENGLISH[alt];
    }
    return null;
  }

  /**
   * Proper nouns are usually written with a long vowel that Latin script hides
   * ("Rahul" -> राहुल). Try doubling each vowel and look the variant up.
   */
  function lookupProperNoun(token) {
    if (!/^[A-Z]/.test(token)) return null;
    const lower = token.toLowerCase();
    for (let i = 0; i < lower.length; i++) {
      if (!'aeiou'.includes(lower[i])) continue;
      const variant = lower.slice(0, i + 1) + lower[i] + lower.slice(i + 1);
      if (Object.prototype.hasOwnProperty.call(HINGLISH, variant)) return HINGLISH[variant];
      if (Object.prototype.hasOwnProperty.call(ENGLISH, variant)) return ENGLISH[variant];
    }
    return null;
  }

  /**
   * Convert Latin text to Devanagari.
   * @param {string} text
   * @param {{offline?:boolean}} [opts]
   */
  function romanToDeva(text) {
    if (!text) return '';
    // Preserve whitespace layout by walking through with a tokenizer.
    const out = [];
    const parts = text.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { out.push(part); continue; }
      out.push(convertToken(part));
    }
    return out.join('');
  }

  function convertToken(token) {
    // Split trailing punctuation so "hello!" keeps its "!"
    let core = token;
    let suffix = '';
    while (core.length && PUNCT.test(core[core.length - 1])) {
      suffix = core[core.length - 1] + suffix;
      core = core.slice(0, -1);
    }
    let prefix = '';
    while (core.length && PUNCT.test(core[0])) {
      prefix += core[0];
      core = core.slice(1);
    }
    if (!core) return prefix + suffix;

    // 1) phrase lookup (up to 3 words) — handled by caller for multi-word tokens
    const dictHit = lookupDictionary(core);
    if (dictHit) return prefix + dictHit + suffix;
    const nameHit = lookupProperNoun(core);
    if (nameHit) return prefix + nameHit + suffix;
    return prefix + wordToDeva(core) + suffix;
  }

  /**
   * Convert a full sentence, trying multi-word phrases first.
   */
  function convertSentence(text) {
    if (!text) return '';
    const tokens = text.split(/(\s+)/);
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (!tok || /^\s+$/.test(tok)) { out.push(tok); continue; }
      // try 3-word, then 2-word phrase
      const w1 = stripPunct(tok);
      let handled = false;
      for (const span of [3, 2]) {
        if (i + span * 2 - 1 >= tokens.length) continue;
        const group = tokens.slice(i, i + span * 2 - 1).filter(t => t && !/^\s+$/.test(t));
        if (group.length !== span) continue;
        const phrase = group.map(stripPunct).join(' ').toLowerCase();
        if (PHRASES[phrase]) {
          // rebuild with original punctuation of the first token
          out.push(applyFirstPunct(tok, PHRASES[phrase]));
          // replace the consumed tokens with blanks
          for (let k = 1; k < group.length; k++) out.push(tokens[i + k * 2 - 1] || '');
          i += span * 2 - 2;
          handled = true;
          break;
        }
      }
      if (handled) continue;
      out.push(convertToken(tok));
    }
    return out.join('');
  }

  function stripPunct(tok) {
    let s = tok;
    while (s.length && PUNCT.test(s[0])) s = s.slice(1);
    while (s.length && PUNCT.test(s[s.length - 1])) s = s.slice(0, -1);
    return s;
  }

  function applyFirstPunct(tok, value) {
    let prefix = '';
    let rest = tok;
    while (rest.length && PUNCT.test(rest[0])) { prefix += rest[0]; rest = rest.slice(1); }
    let suffix = '';
    while (rest.length && PUNCT.test(rest[rest.length - 1])) {
      suffix = rest[rest.length - 1] + suffix;
      rest = rest.slice(0, -1);
    }
    return prefix + value + suffix;
  }

  /**
   * Devanagari -> Roman (pronunciation helper).
   */
  function devaToRoman(text) {
    if (!text) return '';
    const chunks = text.split(/(\s+)/);
    const out = chunks.map(chunk => {
      if (!chunk) return '';
      if (/^\s+$/.test(chunk)) return chunk;
      return convertDevaChunk(chunk);
    });
    return out.join('');
  }

  function convertDevaChunk(chunk) {
    let out = '';
    let i = 0;
    const L = chunk.length;
    let afterMatra = false;
    while (i < L) {
      const ch = chunk[i];
      if (D2R_IND[ch]) {
        out += (afterMatra && D2R_IND_SHORT[ch]) ? D2R_IND_SHORT[ch] : D2R_IND[ch];
        afterMatra = false;
        i++;
        continue;
      }
      if (D2R_MAT[ch]) { out += D2R_MAT[ch]; afterMatra = true; i++; continue; }
      if (ch === VIRAMA) { i++; continue; }
      if (ch === ANUSVARA) { out += 'n'; afterMatra = false; i++; continue; }
      if (ch === CHANDRABINDU) { out += 'n'; afterMatra = false; i++; continue; }
      if (ch === VISARGA) { out += 'h'; afterMatra = false; i++; continue; }
      if (ch === DANDA) { out += '.'; afterMatra = false; i++; continue; }
      if (ch === DOUBLE_DANDA) { out += '..'; afterMatra = false; i++; continue; }
      if (ch === NUKTA) { i++; continue; }
      if (D2R_CONS[ch]) {
        let cons = D2R_CONS[ch];
        i++;
        // consume virama chain
        while (i < L && chunk[i] === VIRAMA) {
          i++;
          if (i < L && D2R_CONS[chunk[i]]) { cons += D2R_CONS[chunk[i]]; i++; }
        }
        // matra?
        if (i < L && D2R_MAT[chunk[i]]) {
          out += cons + D2R_MAT[chunk[i]];
          i++;
          afterMatra = true;
        } else {
          // implicit schwa 'a' unless this is a bare (virama'd) cluster or word-final
          const nextIsCons = i < L && (D2R_CONS[chunk[i]] || chunk[i] === VIRAMA);
          const nextIsMatra = i < L && D2R_MAT[chunk[i]];
          const atEnd = i >= L;
          if (!atEnd && !nextIsCons && !nextIsMatra) {
            out += cons + 'a';               // followed by a vowel -> implicit a
          } else if (!atEnd && nextIsCons) {
            out += cons + 'a';               // new syllable starts -> implicit a
          } else {
            out += cons;                     // word-final -> schwa dropped
          }
          afterMatra = false;
        }
        continue;
      }
      out += ch;
      i++;
    }
    return out;
  }

  /**
   * Count Hinglish vs English markers — used to pick an engine.
   */
  function hinglishHits(text) {
    const words = String(text || '').toLowerCase().match(/[a-zA-Z']+/g) || [];
    let hinglish = 0, english = 0;
    for (const w of words) {
      if (HINGLISH_ONLY.has(w)) hinglish++;
      else if (ENGLISH_ONLY.has(w)) english++;
    }
    return { hinglish, english, words: words.length };
  }

  function isDevanagari(text) {
    return /[ऀ-ॿ]/.test(text || '');
  }

  return {
    romanToDeva: convertSentence,
    romanToDevaWord: wordToDeva,
    devaToRoman,
    hinglishHits,
    isDevanagari,
    dictionary: HINGLISH,
    englishDictionary: ENGLISH,
    phrases: PHRASES
  };
});
