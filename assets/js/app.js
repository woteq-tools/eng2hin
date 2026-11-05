/*!
 * Woteq Eng->Hin — app logic
 * Two engines:
 *   1. Offline transliterator (assets/js/translit.js) — instant, no network.
 *   2. Public translation endpoints (Google / MyMemory) — real sentences.
 */
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const input = $('#input');
  const output = $('#output');
  const placeholder = $('#placeholder');
  const pron = $('#pron');
  const pronText = $('#pron-text');
  const engineBadge = $('#engine');
  const counter = $('#counter');
  const hint = $('#detect-hint');
  const copyBtn = $('#copy');
  const copyLabel = $('#copy-label');
  const speakBtn = $('#speak');
  const retryBtn = $('#retry');
  const swapBtn = $('#swap');
  const examplesEl = $('#examples');

  const state = {
    mode: 'auto',
    result: '',
    engine: '',
    pending: 0,
    offline: false
  };

  /* ------------------------------------------------------------------ *
   * Examples
   * ------------------------------------------------------------------ */
  const EXAMPLES = [
    { t: 'aap kaise ho', m: 'auto' },
    { t: 'main theek hoon, tum kaise ho?', m: 'auto' },
    { t: 'aaj mausam bahut achha hai', m: 'auto' },
    { t: 'dhanyavaad', m: 'auto' },
    { t: 'kal meeting hai, 5 baje', m: 'auto' },
    { t: 'How are you?', m: 'auto' },
    { t: 'My name is Rahul and I live in Delhi.', m: 'auto' },
    { t: 'Good morning, have a nice day!', m: 'auto' },
    { t: 'मेरा नाम राहुल है', m: 'auto' }
  ];

  EXAMPLES.forEach((ex) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = ex.t;
    b.addEventListener('click', () => {
      input.value = ex.t;
      setMode(ex.m);
      run();
      input.focus();
    });
    examplesEl.appendChild(b);
  });

  /* ------------------------------------------------------------------ *
   * Translation backends
   * ------------------------------------------------------------------ */
  const GOOGLE_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

  async function googleTranslate(text, sl, tl) {
    const url = `${GOOGLE_ENDPOINT}?client=dict-chrome-ex&sl=${encodeURIComponent(sl)}` +
      `&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error('Google HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Google: bad payload');
    const joined = data[0]
      .map((seg) => (seg && Array.isArray(seg) && seg[0]) || '')
      .join('');
    const detected = typeof data[2] === 'string' ? data[2] : sl;
    if (!joined) throw new Error('Google: empty result');
    return { text: joined, detected };
  }

  function decodeEntities(str) {
    return String(str)
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  async function myMemoryTranslate(text, sl, tl) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
      `&langpair=${encodeURIComponent(sl)}|${encodeURIComponent(tl)}`;
    const res = await fetch(url, { referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error('MyMemory HTTP ' + res.status);
    const data = await res.json();
    if (!data || !data.responseData) throw new Error('MyMemory: bad payload');
    if (data.responseStatus && data.responseStatus !== 200) {
      throw new Error(data.responseDetails || 'MyMemory: request failed');
    }
    const text2 = decodeEntities(data.responseData.translatedText || '');
    if (!text2) throw new Error('MyMemory: empty result');
    return { text: text2, detected: sl };
  }

  /* ------------------------------------------------------------------ *
   * Core logic
   * ------------------------------------------------------------------ */
  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode').forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function setBusy(busy) {
    output.classList.toggle('is-busy', busy);
    if (busy) {
      output.innerHTML = '<span class="loading">Translating…</span>';
    }
  }

  function setEngine(label, offline) {
    state.engine = label;
    state.offline = !!offline;
    if (!label) { engineBadge.hidden = true; return; }
    engineBadge.hidden = false;
    engineBadge.textContent = label;
    engineBadge.classList.toggle('is-offline', !!offline);
  }

  function showResult(text, engine, offline) {
    state.result = text;
    output.textContent = text;
    if (placeholder && placeholder.parentNode === output) output.removeChild(placeholder);
    setEngine(engine, offline);
    updatePron();
    copyBtn.disabled = !text;
    speakBtn.disabled = !text || !('speechSynthesis' in window);
    retryBtn.hidden = true;
    updateHint();
  }

  function clearResult() {
    state.result = '';
    output.innerHTML = '';
    output.appendChild(placeholder);
    setEngine('', false);
    pron.hidden = true;
    copyBtn.disabled = true;
    speakBtn.disabled = true;
    retryBtn.hidden = true;
    hint.textContent = 'Type something to begin.';
  }

  function updatePron() {
    const src = Translit.isDevanagari(state.result) ? state.result
      : (Translit.isDevanagari(input.value) ? input.value : '');
    if (!src) { pron.hidden = true; pronText.textContent = ''; return; }
    pronText.textContent = Translit.devaToRoman(src);
    pron.hidden = false;
  }

  function updateHint() {
    const raw = input.value.trim();
    if (!raw) { hint.textContent = 'Type something to begin.'; return; }
    if (state.mode === 'hinglish') { hint.textContent = 'Mode: Hinglish → Devanagari (offline)'; return; }
    if (state.mode === 'en2hi') { hint.textContent = 'Mode: English → हिन्दी'; return; }
    if (state.mode === 'hi2en') { hint.textContent = 'Mode: हिन्दी → English'; return; }
    if (Translit.isDevanagari(raw)) { hint.textContent = 'Detected: हिन्दी (Devanagari)'; return; }
    const hits = Translit.hinglishHits(raw);
    if (hits.hinglish > hits.english) {
      hint.textContent = 'Detected: Hinglish (Roman Hindi) — transliterating offline';
    } else {
      hint.textContent = 'Detected: English — translating';
    }
  }

  function updateCounter() {
    counter.textContent = String(input.value.length);
  }

  async function run() {
    const text = input.value.trim();
    const token = ++state.pending;
    updateCounter();
    updateHint();

    if (!text) { clearResult(); return; }

    /* --- explicit modes --- */
    if (state.mode === 'hinglish') {
      showResult(Translit.romanToDeva(text), 'Offline transliterator', true);
      return;
    }
    if (state.mode === 'en2hi') return online(text, 'en', 'hi', token);
    if (state.mode === 'hi2en') return online(text, 'hi', 'en', token);

    /* --- auto --- */
    if (Translit.isDevanagari(text)) return online(text, 'hi', 'en', token);

    const hits = Translit.hinglishHits(text);
    if (hits.hinglish > hits.english) {
      showResult(Translit.romanToDeva(text), 'Offline transliterator', true);
      return;
    }
    return online(text, 'auto', 'hi', token);
  }

  async function online(text, sl, tl, token) {
    setBusy(true);
    let engine = 'Google Translate';
    try {
      let res;
      try {
        res = await googleTranslate(text, sl, tl);
      } catch (err) {
        engine = 'MyMemory';
        res = await myMemoryTranslate(text, sl === 'auto' ? 'en' : sl, tl);
      }
      if (token !== state.pending) return;

      // Google recognises Hinglish as Hindi but leaves Latin script alone.
      // In that case fall back to our offline transliterator.
      if (sl === 'auto' && res.detected === 'hi' && res.text.trim() === text.trim()) {
        showResult(Translit.romanToDeva(text), 'Offline transliterator', true);
        return;
      }
      showResult(res.text, engine, false);
    } catch (err) {
      if (token !== state.pending) return;
      // Network trouble — still answer with the offline engine.
      showResult(Translit.romanToDeva(text), 'Offline (network unavailable)', true);
      retryBtn.hidden = false;
    } finally {
      if (token === state.pending) setBusy(false);
    }
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */
  let timer = null;
  input.addEventListener('input', () => {
    updateCounter();
    updateHint();
    clearTimeout(timer);
    timer = setTimeout(run, 350);
  });

  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      run();
    }
  });

  document.querySelectorAll('.mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      setMode(btn.dataset.mode);
      run();
    });
  });

  copyBtn.addEventListener('click', async () => {
    if (!state.result) return;
    const text = state.result;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      copyLabel.textContent = 'Copied';
      copyBtn.classList.add('is-ok');
      setTimeout(() => { copyLabel.textContent = 'Copy'; copyBtn.classList.remove('is-ok'); }, 1600);
    } catch (err) {
      copyLabel.textContent = 'Press Ctrl+C';
      setTimeout(() => { copyLabel.textContent = 'Copy'; }, 1600);
    }
  });

  speakBtn.addEventListener('click', () => {
    if (!state.result || !('speechSynthesis' in window)) return;
    const text = Translit.isDevanagari(state.result) ? state.result : input.value.trim();
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'hi-IN';
    const voices = window.speechSynthesis.getVoices() || [];
    const hi = voices.find((v) => /^hi(-|_)?/i.test(v.lang)) ||
      voices.find((v) => /^hi/i.test(v.name));
    if (hi) u.voice = hi;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });

  retryBtn.addEventListener('click', () => {
    retryBtn.hidden = true;
    const text = input.value.trim();
    if (!text) return;
    const token = ++state.pending;
    if (state.mode === 'auto') {
      if (Translit.isDevanagari(text)) return online(text, 'hi', 'en', token);
      const hits = Translit.hinglishHits(text);
      if (hits.hinglish > hits.english) {
        showResult(Translit.romanToDeva(text), 'Offline transliterator', true);
        return;
      }
      return online(text, 'auto', 'hi', token);
    }
    if (state.mode === 'hinglish') {
      showResult(Translit.romanToDeva(text), 'Offline transliterator', true);
      return;
    }
    if (state.mode === 'en2hi') return online(text, 'en', 'hi', token);
    return online(text, 'hi', 'en', token);
  });

  swapBtn.addEventListener('click', () => {
    const current = input.value;
    const result = state.result;
    if (result) {
      input.value = result;
      setMode(state.mode === 'hi2en' ? 'en2hi' : 'hi2en');
    } else {
      setMode(state.mode === 'hi2en' ? 'en2hi' : 'hi2en');
    }
    void current;
    swapBtn.classList.add('spin');
    setTimeout(() => swapBtn.classList.remove('spin'), 220);
    updateCounter();
    run();
  });

  window.addEventListener('beforeunload', () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  });

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  if (typeof Translit === 'undefined') {
    output.textContent = 'The transliteration engine failed to load. Please reload the page.';
    return;
  }

  setMode('auto');
  updateCounter();
  updateHint();
  clearResult();

  // Prefill with the canonical example so the page is never empty.
  input.value = 'aap kaise ho';
  updateCounter();
  run();
})();
