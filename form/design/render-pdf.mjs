/** guestbook.html → guestbook-design.pdf (헤드리스 Chrome, A4 1장).
 *
 *  - @page size:A4; margin:0 을 그대로 쓰기 위해 --no-pdf-header-footer 를 준다.
 *  - 기본 프로필을 쓰면 "액세스 거부 0x5" 가 나므로 임시 프로필을 만들어 쓴다.
 *  - 상대 경로도 같은 이유로 금지 — file:/// 절대 URL 로 넘긴다.
 *
 *  사용: node form/design/render-pdf.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const htmlPath = join(here, 'guestbook.html');
const pdfPath = join(here, 'guestbook-design.pdf');
if (!existsSync(htmlPath)) throw new Error(`no such file: ${htmlPath}`);

const fileUrl = 'file:///' + htmlPath.split(String.fromCharCode(92)).join('/');
const profile = mkdtempSync(join(tmpdir(), 'gbdesign-'));
try {
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--user-data-dir=${profile}`,
    '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=4000',
    `--print-to-pdf=${pdfPath}`,
    fileUrl,
  ], { stdio: 'inherit', timeout: 120000 });
} finally {
  rmSync(profile, { recursive: true, force: true });
}

if (!existsSync(pdfPath)) throw new Error('PDF not produced: ' + pdfPath);
console.log(JSON.stringify({ html: htmlPath, pdf: pdfPath, bytes: statSync(pdfPath).size }, null, 1));
