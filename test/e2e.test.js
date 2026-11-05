/* End-to-end test: drives the real page via Chrome DevTools Protocol. */
const { spawn } = require('child_process');

const CHROME = '/usr/bin/google-chrome';
const PORT = 9333;
const URL = process.argv[2] || 'http://localhost:8765/';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=' + PORT,
    '--user-data-dir=/tmp/chrome-test-profile', 'about:blank'
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find(t => t.type === 'page');
      if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch (e) { /* not up yet */ }
  }
  if (!wsUrl) { console.error('could not reach chrome'); chrome.kill(); process.exit(1); }

  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));

  const send = (method, params = {}) => new Promise(resolve => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (res.result && res.result.exceptionDetails) {
      throw new Error(JSON.stringify(res.result.exceptionDetails));
    }
    return res.result.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(2500);

  const test = async (text, mode) => {
    await evaluate(`(() => {
      const i = document.querySelector('#input');
      i.value = ${JSON.stringify(text)};
      i.dispatchEvent(new Event('input', { bubbles: true }));
      ${mode ? `document.querySelector('.mode[data-mode="${mode}"]').click();` : ''}
      return true;
    })()`);
    await sleep(2200);
    return evaluate(`(() => ({
      out: document.querySelector('#output').textContent.trim(),
      engine: document.querySelector('#engine').textContent.trim(),
      hint: document.querySelector('#detect-hint').textContent.trim(),
      pron: document.querySelector('#pron').hidden ? '' : document.querySelector('#pron-text').textContent.trim()
    }))()`);
  };

  const cases = [
    ['aap kaise ho', null],
    ['aap kaise ho?', null],
    ['main theek hoon, tum kaise ho?', null],
    ['aaj mausam bahut achha hai', null],
    ['dhanyavaad bhai', null],
    ['How are you?', null],
    ['My name is Rahul and I live in Delhi.', null],
    ['Good morning, have a nice day!', null],
    ['मेरा नाम राहुल है', null],
    ['आज मौसम बहुत अच्छा है', null],
    ['kal meeting hai 5 baje', null],
    ['aap kaise ho', 'hinglish'],
    ['How are you?', 'en2hi'],
    ['मेरा नाम राहुल है', 'hi2en']
  ];

  console.log('--- end-to-end ---');
  for (const [text, mode] of cases) {
    const r = await test(text, mode);
    console.log(`\nIN   : ${text}${mode ? '   [' + mode + ']' : ''}`);
    console.log(`OUT  : ${r.out}`);
    console.log(`META : ${r.engine} | ${r.hint}${r.pron ? ' | pron=' + r.pron : ''}`);
  }

  // swap button
  await evaluate(`document.querySelector('#input').value='How are you?';document.querySelector('#input').dispatchEvent(new Event('input',{bubbles:true}));`);
  await sleep(2000);
  const before = await evaluate(`document.querySelector('#input').value`);
  await evaluate(`document.querySelector('#swap').click()`);
  await sleep(2000);
  const after = await evaluate(`document.querySelector('#input').value`);
  console.log(`\nSWAP : "${before}" -> "${after}"`);

  // copy button present & enabled
  const copyState = await evaluate(`({disabled: document.querySelector('#copy').disabled, label: document.querySelector('#copy-label').textContent})`);
  console.log('COPY :', JSON.stringify(copyState));

  // no JS console errors
  const errs = await evaluate(`window.__errs ? window.__errs.join(' | ') : 'none-tracked'`);
  console.log('ERRORS:', errs);

  ws.close();
  chrome.kill();
}

main().catch(e => { console.error('FAILED', e); process.exit(1); });
