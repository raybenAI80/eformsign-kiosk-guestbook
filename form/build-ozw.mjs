/** guestbook.ozr (PDF-backed, from-scratch) → guestbook.ozw (웹폼 디자이너 편집 가능)
 *
 *  하는 일: OZR 봉투 뒤에 `ozw1` 편집기 tail(OZFORM/OZMXCOMP/OZPAGEINFO/OZPARTICIPANTS)을
 *  붙여 웹폼 디자이너가 "추가된 입력 항목"으로 인식하는 OZW 를 만든다.
 *  좌표는 report XML 의 LEFT/TOP/WIDTH/HEIGHT(pt) 를 그대로 읽어 px96(pt x 4/3)로 변환한다.
 *  근거: ozr-ontology-pack claim:ozr-envelope-always-plaintext-xml... + eformsign-core src/resources/ozw.ts (tail writer)
 *        선례: generated-templates/phone-number-consent/build_phone_consent_template.mjs (2026-05-21)
 *  실행: node form/build-ozw.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CRLF = '\r\n';
const here = dirname(fileURLToPath(import.meta.url));
const ozr = readFileSync(join(here, 'guestbook.ozr'));

const xmlStart = ozr.indexOf('<?xml');
const xmlEnd = ozr.lastIndexOf(Buffer.from('</OZREPORT>')) + '</OZREPORT>'.length;
if (xmlStart < 0 || xmlEnd < 11) throw new Error('report XML markers not found');
const xml = ozr.subarray(xmlStart, xmlEnd).toString('utf8');

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const els = (name) => [...xml.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'g'))].map((m) => attrs(m[0]));

const docName = els('OZPDFDOCUMENT')[0].NAME;
const participants = JSON.parse(xml.match(/PARTICIPANTS="([^"]*)"/)[1].replace(/&quot;/g, '"')).map((p) => p.name);

/** 참여자 비트마스크 — bit0=베이스, bit(n+1)=n번째 참여자. 1인 서식이면 3. */
const ENABLE = (1 << 1) | 1;
const REQUIRED_IDS = new Set(['방문일시', '방문자성명', '소속', '연락처', '방문목적', '담당자', '개인정보동의']);

const num = (v) => Number(v);
const px = (v) => Math.round(num(v) * 4 / 3 * 1000) / 1000;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** report XML 컴포넌트 → tail 항목 스펙 */
const spec = [];
for (const a of els('OZICDATETIMEPICKER')) spec.push({ tag: 'OZICDATETIMEPICKER', id: a.FORMID, label: '날짜', box: a });
for (const a of els('OZICTEXTBOX')) spec.push({ tag: 'OZICTEXTBOX', id: a.FORMID, label: '텍스트', box: a });
for (const a of els('OZICSIGNPAD')) spec.push({ tag: 'OZICSIGNPAD', id: a.FORMID, label: '서명', box: a });
for (const a of els('OZICCHECKBOX')) spec.push({ tag: 'OZICCHECKRADIOBOX', id: a.FORMID, label: '체크', box: a, style: 'check' });
for (const g of els('OZICRADIOBUTTONGROUP')) {
  const opts = els('OZICRADIOBUTTON').filter((r) => r.GROUPNAME === g.NAME);
  if (!opts.length) throw new Error('radio group ' + g.NAME + ' has no buttons');
  const left = Math.min(...opts.map((o) => num(o.LEFT)));
  const top = Math.min(...opts.map((o) => num(o.TOP)));
  const right = Math.max(...opts.map((o) => num(o.LEFT) + num(o.WIDTH)));
  const bottom = Math.max(...opts.map((o) => num(o.TOP) + num(o.HEIGHT)));
  spec.push({
    tag: 'OZICRADIOBUTTON', id: g.FORMID, label: '라디오', style: 'radio',
    values: opts.map((o) => o.CHECKVALUE),
    multi: g.MULTISELECTABLE === 'true',
    box: { LEFT: left, TOP: top, WIDTH: right - left, HEIGHT: bottom - top },
  });
}
spec.sort((a, b) => num(a.box.TOP) - num(b.box.TOP) || num(a.box.LEFT) - num(b.box.LEFT));

const styleOf = (s) => 'text;' + (s.style ? 'checkStyle=' + s.style + ';' : '')
  + 'overflow=hidden;fillColor=#FFFFFF;opacity=0;fontSize=12;fontStyle=0;verticalAlign=middle;align='
  + (s.tag === 'OZICSIGNPAD' ? 'center' : 'left')
  + ';rotatable=0;connectable=0;strokeColor=none;fontColor=#000000;shadow=1;fontFamily=본고딕;';

const typeAttrs = (s) => {
  const req = REQUIRED_IDS.has(s.id) ? ENABLE : 1;
  const common = 'participants_enables="' + ENABLE + '" participants_requireds="' + req + '"';
  switch (s.tag) {
    case 'OZICTEXTBOX':
      return 'defaultValue="" showPasswordChar="false" valueMeaningCode="0" maxLength="0" autoFontSize="true" '
        + 'filterFormat="" keyboardType="default" inputNotice="" tooltipText="" ' + common;
    case 'OZICDATETIMEPICKER':
      return 'defaultValue="" showTodayIfEmpty="false" format="date_yyyy-MM-dd" minDate="" maxDate="" '
        + 'inputNotice="" emptyAllowed="true" tooltipText="" ' + common;
    case 'OZICSIGNPAD':
      return 'valueMeaningCode="285279248" signPenThickness="1" signPenColor="#000000" showSignIcon="true" '
        + 'label="" signatureNotice_multivalue="" tooltipText="" inputNotice="" ' + common;
    case 'OZICCHECKRADIOBOX':
      return 'checked="false" label="" text_multivalue="" checkedValue="Y" radioStyle="check" '
        + 'multiSelectable="true" horizontalCheckAlignment="left" tooltipText="" ' + common;
    case 'OZICRADIOBUTTON':
      return 'checked="false" label="' + esc(s.values[0]) + '" text_multivalue="' + esc(s.values.join('')) + '" '
        + 'checkedValue="Y" radioStyle="radio"' + (s.multi ? ' multiSelectable="true"' : '')
        + ' horizontalCheckAlignment="left" tooltipText="" ' + common;
    default:
      throw new Error('unknown tag ' + s.tag);
  }
};

let nextId = 2;
const nodes = spec.map((s) => {
  const b = s.box;
  return [
    '<' + s.tag + ' tooltip="' + esc(s.label) + '" formID="' + esc(s.id) + '" ' + typeAttrs(s) + ' id="' + (nextId++) + '">',
    '<mxCell style="' + styleOf(s) + '" vertex="1" parent="1">',
    '<mxGeometry x="' + px(b.LEFT) + '" y="' + px(b.TOP) + '" width="' + px(b.WIDTH) + '" height="' + px(b.HEIGHT) + '" as="geometry"/>',
    '</mxCell>',
    '</' + s.tag + '>',
  ].join(CRLF);
});

const pages = els('OZPDFPAGE');
const pageW = Math.round(num(pages[0].WIDTH));
const pageH = Math.round(num(pages[0].HEIGHT));
const stack = Math.round(pageH * 4 / 3) + 50;
const pageNodes = pages.map((p, i) => '<OZPAGE POS_Y="' + (30 + i * stack) + '" X="0" Y="0" W="' + pageW + '" H="' + pageH + '"'
  + ' PDFDOC_IDX="0" PDFDOC_UID="1" PDFPAGE_IDX="' + i + '" PDFDOC_NAME="' + esc(docName) + '"/>');

const tw = Math.round(pageW * 4 / 3);
const th = 30 + pages.length * stack;
const tail = [
  '<OZFORM VERSION="1005">',
  '<OZINFO SCALE="1" SL="0" ST="0" SW="' + (tw + 60) + '" SH="' + (th + 60) + '"/>',
  '<OZMXCOMP>',
  '<root>',
  '<mxCell id="0"/>',
  '<mxCell id="1" parent="0"/>',
  ...nodes,
  '</root>',
  '</OZMXCOMP>',
  '<OZPAGEINFO TW="' + tw + '" TH="' + th + '">',
  ...pageNodes,
  '</OZPAGEINFO>',
  '<OZPARTICIPANTS>',
  ...participants.map((p) => '<OZPARTICIPANT NAME="' + esc(p) + '"/>'),
  '</OZPARTICIPANTS>',
  '</OZFORM>',
  '',
].join(CRLF);

if (/(?<!\r)\n/.test(tail)) throw new Error('bare LF in tail — web designer import breaks');

const payload = Buffer.from(tail, 'utf8');
const hdr = Buffer.alloc(8);
hdr.write('ozw1', 0, 'latin1');
hdr.writeUInt32BE(payload.length, 4);
const out = Buffer.concat([ozr, hdr, payload]);

const outPath = join(here, 'guestbook.ozw');
writeFileSync(outPath, out);
writeFileSync(join(here, 'guestbook.tail.xml'), tail, 'utf8');
console.log(JSON.stringify({
  outPath, ozrBytes: ozr.length, ozwBytes: out.length, tailBytes: payload.length,
  components: spec.map((s) => s.id + ':' + s.tag), pages: pages.length, participants,
  u32at28: out.readUInt32BE(28),
}, null, 1));
