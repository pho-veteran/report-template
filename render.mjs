/**
 * Kết xuất report.html -> PDF, giữ đúng lề và chân trang của bản gốc.
 *
 *   node render.mjs [input.html] [output.pdf] ["Chân trang bên trái"]
 *
 * Bản gốc do wkhtmltopdf 0.12.6 sinh ra. Máy này không có wkhtmltopdf nên
 * script dùng Microsoft Edge ở chế độ headless qua CDP, vì chỉ đường này mới
 * điều khiển được chân trang lặp lại "Tiêu đề ... n / N".
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const input = resolve(process.argv[2] ?? 'report.html');
const output = resolve(process.argv[3] ?? 'build/report.pdf');
const footerLeft = process.argv[4] ?? 'Báo cáo hệ thống ứng dụng Yody Order Service';

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];

const browserPath = EDGE_CANDIDATES.find((p) => existsSync(p));
if (!browserPath) {
  console.error('Không tìm thấy Edge hoặc Chrome. Sửa EDGE_CANDIDATES trong render.mjs.');
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`Không thấy tệp đầu vào: ${input}`);
  process.exit(1);
}

const PT = (pt) => pt / 72; // CDP nhận đơn vị inch

// Lề đo được từ bản gốc: nội dung nằm trong x 62.2 -> 537.8, tức lề trái và
// lề phải không bằng nhau. Giữ đúng con số này để kẻ ngang trùng bản gốc.
const MARGIN = { top: 63.8, bottom: 62.4, left: 62.2, right: 57.2 }; // pt

// Chân trang: tiêu đề bên trái, "n / N" bên phải, Times 9.6pt như bản gốc.
const footerTemplate = `
<div style="
  -webkit-print-color-adjust:exact;
  width:100%;
  margin:0;
  padding:0 ${MARGIN.right}pt 12pt ${MARGIN.left}pt;
  box-sizing:border-box;
  font-family:'Times New Roman',Times,serif;
  font-size:9.6pt;
  color:#000;
  display:flex;
  justify-content:space-between;
">
  <span>${footerLeft.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</div>`;

const profile = mkdtempSync(join(tmpdir(), 'edge-pdf-'));
const port = 9200 + Math.floor(Math.random() * 400);

const child = spawn(browserPath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-gpu',
  '--run-all-compositor-stages-before-draw',
  pathToFileURL(input).href,
], { stdio: 'ignore' });

const cleanup = () => {
  try { child.kill(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
};
process.on('exit', cleanup);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Nối thẳng vào target của trang, khỏi phải attach session.
async function pageWsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find(
        (t) => t.type === 'page' && t.webSocketDebuggerUrl && !t.url.startsWith('devtools://'),
      );
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Edge không mở được cổng debug.');
}

// CDP tối giản trên WebSocket có sẵn của Node 22+.
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.sessionId = null;
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve: ok, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : ok(msg.result);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((ok, bad) => {
      ws.addEventListener('open', ok, { once: true });
      ws.addEventListener('error', () => bad(new Error('WebSocket lỗi')), { once: true });
    });
    return new Cdp(ws);
  }
  send(method, params = {}, sessionId = this.sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((ok, bad) => {
      this.pending.set(id, { resolve: ok, reject: bad });
      this.ws.send(JSON.stringify(payload));
    });
  }
}

const cdp = await Cdp.connect(await pageWsUrl());
await cdp.send('Page.enable');

// Chờ tài liệu và phông chữ sẵn sàng.
for (let i = 0; i < 80; i++) {
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: 'document.readyState',
    returnByValue: true,
  });
  if (result.value === 'complete') break;
  await sleep(150);
}
await cdp.send('Runtime.evaluate', {
  expression: 'document.fonts ? document.fonts.ready.then(()=>1) : 1',
  awaitPromise: true,
  returnByValue: true,
});

const printOpts = {
  paperWidth: 595 / 72,        // A4 đúng 595 x 842 pt như bản gốc
  paperHeight: 842 / 72,
  marginTop: PT(MARGIN.top),
  marginBottom: PT(MARGIN.bottom),
  marginLeft: PT(MARGIN.left),
  marginRight: PT(MARGIN.right),
  printBackground: true,
  preferCSSPageSize: false,
  headerTemplate: '<div></div>',
};

// Bản gốc không có chân trang ở bìa, nhưng Chrome không cho lọc chân trang
// theo số trang. Nên in hai lượt rồi ghép: bìa lấy từ lượt không chân trang.
const withFooter = await cdp.send('Page.printToPDF', {
  ...printOpts,
  displayHeaderFooter: true,
  footerTemplate,
});
const noFooter = await cdp.send('Page.printToPDF', {
  ...printOpts,
  displayHeaderFooter: false,
});

writeFileSync(output, Buffer.from(withFooter.data, 'base64'));
const bare = output.replace(/\.pdf$/i, '.nofooter.pdf');
writeFileSync(bare, Buffer.from(noFooter.data, 'base64'));
console.log(`Đã ghi ${output}`);
console.log(`Đã ghi ${bare} (dùng để ghép bìa)`);
process.exit(0);
