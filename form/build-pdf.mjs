/** layout.mjs → 배경 HTML → A4 PDF(헤드리스 Chrome). 인쇄 글리프만 담고 입력칸은 비워 둔다. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as L from './layout.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const pt = (n) => `${n}pt`;
const abs = (x, y, extra = '') => `position:absolute;left:${pt(x)};top:${pt(y)};${extra}`;

const parts = [];
parts.push(`<div style="${abs(0, 56)};width:${pt(L.PAGE.w)};text-align:center;font-size:22pt;font-weight:700;letter-spacing:2pt">방문자 기록부</div>`);
parts.push(`<div style="${abs(0, 92)};width:${pt(L.PAGE.w)};text-align:center;font-size:10.5pt;color:#555">방문 정보를 입력하고 서명해 주세요.</div>`);
parts.push(`<div style="${abs(L.LABEL_X, 124)};width:${pt(L.M.right - L.LABEL_X)};border-top:1.2pt solid #222"></div>`);

const label = (x, y, t) => `<div style="${abs(x, y)};width:${pt(L.LABEL_W)};font-size:11pt;font-weight:600">${t}</div>`;
const field = (b) => `<div style="${abs(b[0], b[1])};width:${pt(b[2] - b[0])};height:${pt(b[3] - b[1])};border-bottom:0.8pt solid #9aa4ae"></div>`;
const rule = (y) => `<div style="${abs(L.LABEL_X, y)};width:${pt(L.M.right - L.LABEL_X)};border-top:0.5pt solid #dfe3e8"></div>`;

for (const r of [...L.rows, L.host]) {
  parts.push(label(L.LABEL_X, r.top + 12, r.label));
  parts.push(field(L.inputBox(r)));
  parts.push(rule(r.top + 40));
}
parts.push(label(L.LABEL_X, L.purpose.top + 12, L.purpose.label));
for (const o of L.purpose.options) {
  parts.push(`<div style="${abs(o.x, L.purpose.boxTop)};width:${pt(L.purpose.size)};height:${pt(L.purpose.size)};border:0.9pt solid #6b7680;border-radius:50%"></div>`);
  parts.push(`<div style="${abs(o.x + L.purpose.size + 5, L.purpose.boxTop - 2)};font-size:10.5pt;white-space:nowrap">${o.label}</div>`);
}
parts.push(rule(L.purpose.top + 40));

const c = L.consent;
parts.push(`<div style="${abs(L.LABEL_X, c.top)};font-size:11.5pt;font-weight:700">${c.heading}</div>`);
c.body.forEach((line, i) => {
  parts.push(`<div style="${abs(L.LABEL_X, c.top + 24 + i * 20)};width:${pt(L.M.right - L.LABEL_X)};font-size:10pt;color:#333;word-break:keep-all;overflow-wrap:break-word">${line}</div>`);
});
parts.push(`<div style="${abs(c.checkBox[0], c.checkBox[1])};width:${pt(c.checkBox[2] - c.checkBox[0])};height:${pt(c.checkBox[3] - c.checkBox[1])};border:1pt solid #333"></div>`);
parts.push(`<div style="${abs(c.checkBox[2] + 5, c.checkBox[1] - 1)};font-size:10.5pt;font-weight:600;white-space:nowrap">${c.checkLabel}</div>`);

parts.push(`<div style="${abs(L.LABEL_X, L.sign.top + 44)};font-size:11pt;font-weight:600">${L.sign.label}</div>`);
parts.push(`<div style="${abs(L.sign.box[0], L.sign.box[1])};width:${pt(L.sign.box[2] - L.sign.box[0])};height:${pt(L.sign.box[3] - L.sign.box[1])};border:0.9pt solid #9aa4ae;border-radius:3pt"></div>`);

parts.push(`<div style="${abs(0, L.footer.top)};width:${pt(L.PAGE.w)};text-align:center;font-size:9pt;color:#8a929a;word-break:keep-all">${L.footer.text}</div>`);

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>
@page { size: A4; margin: 0 }
html,body { margin:0; padding:0 }
body { width:${pt(L.PAGE.w)}; height:${pt(L.PAGE.h)}; position:relative;
  font-family:"Malgun Gothic","맑은 고딕",sans-serif; color:#111;
  word-break:keep-all; overflow-wrap:break-word; line-break:strict; }
-webkit-print-color-adjust: exact;
</style></head><body>${parts.join('\n')}</body></html>`;

mkdirSync(here, { recursive: true });
const htmlPath = join(here, 'guestbook.html');
writeFileSync(htmlPath, html, 'utf8');
const profile = mkdtempSync(join(tmpdir(), 'gbpdf-'));
const pdfPath = join(here, 'guestbook.pdf');
execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profile}`,
  '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, 'file:///' + htmlPath.split(String.fromCharCode(92)).join('/'),
], { stdio: 'inherit', timeout: 120000 });
rmSync(profile, { recursive: true, force: true });
console.log('wrote', htmlPath, '\nwrote', pdfPath);
