/* Offline behaviour test: emulate no network, check the tool still answers. */
const { spawn } = require('child_process');
const CHROME = '/usr/bin/google-chrome';
const PORT = 9335;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, ['--headless', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/chrome-offline-profile', 'about:blank'], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch (e) {}
  }
  const ws = new WebSocket(wsUrl);
  let id = 0; const pending = new Map();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise(r => ws.addEventListener('open', r));
  const send = (method, params = {}) => new Promise(res => {
    const mid = ++id; pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result.result.value;
  };

  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url: 'https://woteq-tools.github.io/eng2hin/' });
  await sleep(3000);

  // go offline
  await send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
  });
  console.log('network: OFFLINE');

  const type = async (text) => {
    await ev(`(()=>{const i=document.querySelector('#input');i.value=${JSON.stringify(text)};i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
    await sleep(3000);
    return ev(`({out:document.querySelector('#output').textContent.trim(),engine:document.querySelector('#engine').textContent.trim(),retry:!document.querySelector('#retry').hidden})`);
  };

  console.log('\nHinglish (must work offline):');
  console.log(JSON.stringify(await type('aap kaise ho')));

  console.log('\nEnglish (must fall back offline + offer retry):');
  console.log(JSON.stringify(await type('How are you?')));

  console.log('\nHindi->English (must fall back offline):');
  console.log(JSON.stringify(await type('मेरा नाम राहुल है')));

  ws.close(); chrome.kill();
}
main().catch(e => { console.error(e); process.exit(1); });
