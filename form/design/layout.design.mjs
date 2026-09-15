/** 방문자 기록부 — 디자인 HTML(guestbook.html)에서 **자동 추출**한 좌표.
 *  🔴 손으로 고치지 말 것. guestbook.html 을 고친 뒤
 *     `node form/design/render-pdf.mjs && node form/design/extract-layout.mjs` 로 다시 만든다.
 *  좌표 단위 = PDF 포인트(pt), 원점 = 페이지 좌상단. A4 세로 1장.
 *  스키마는 form/layout.mjs 와 호환된다(build-ozr.mjs 가 쓰는 표면 그대로).
 *  생성 시각: 2026-09-15T05:50:26.568Z
 */
export const SOURCE = 'form/design/guestbook.html';
export const PAGE = { w: 595.28, h: 841.89 };
export const M = { left: 52, right: 543.28 };
export const LABEL_X = 52;
export const LABEL_W = 96;
export const VALUE_X = 160.75;

export const rows = [
  { id: 'visit_datetime', label: '방문 일시', formId: '방문일시', type: 'date', required: true, todayDefault: true, box: [160.75, 172.75, 359.24, 203.24] },
  { id: 'visitor_name', label: '방문자 성명', formId: '방문자성명', type: 'text', required: true, box: [160.75, 218.74, 419.24, 249.23] },
  { id: 'visitor_org', label: '소속', formId: '소속', type: 'text', required: true, box: [160.75, 264.75, 542.52, 295.24] },
  { id: 'visitor_phone', label: '연락처', formId: '연락처', type: 'phone', required: true, box: [160.75, 310.75, 419.24, 341.24] },
];

export const purpose = {
  id: 'visit_purpose', label: '방문 목적', formId: '방문목적', required: true,
  boxTop: 364.99, size: 15,
  options: [
    { label: '회의', x: 160, box: [160, 364.99, 175, 379.99] },
    { label: '납품', x: 235.99, box: [235.99, 364.99, 250.99, 379.99] },
    { label: '면접', x: 312, box: [312, 364.99, 327, 379.99] },
    { label: '견학', x: 388, box: [388, 364.99, 403, 379.99] },
    { label: '기타', x: 463.99, box: [463.99, 364.99, 478.99, 379.99] },
  ],
};

export const host = { id: 'host_name', label: '만나는 담당자', formId: '담당자', type: 'text', required: true, box: [160.75, 402.75, 419.24, 433.24] };

export const consent = {
  heading: '개인정보 수집·이용 동의',
  checkId: 'agree_privacy',
  checkFormId: '개인정보동의',
  checkLabel: '위 내용을 확인하였으며 개인정보 수집·이용에 동의합니다. (필수)',
  checkBox: [72, 580, 87, 595],
};

export const sign = { id: 'visitor_sign', label: '방문자 서명', formId: '방문자서명', box: [160.75, 674.74, 419.24, 753.23] };

export const footer = { text: '작성해 주셔서 감사합니다. 전송을 누르면 다음 방문자용 화면이 다시 열립니다.' };

/** 입력 컴포넌트 bbox. 디자인에서 실측한 값이므로 그대로 돌려준다.
 *  (form/layout.mjs 의 inputBox(r) 와 같은 호출 규약) */
export const inputBox = (r) => r.box;
