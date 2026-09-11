/** 방문자 기록부 — 배경 PDF 와 OZR 필드 스펙의 **단일 진실 원천**.
 *  좌표 단위 = PDF 포인트(pt), 원점 = 페이지 좌상단. A4 세로 1장.
 */
export const PAGE = { w: 595.28, h: 841.89 };
export const M = { left: 48, right: 547.28 };
export const LABEL_X = 48;
export const LABEL_W = 110;
export const VALUE_X = 168;

const rowTop = (i) => 150 + i * 40;

export const rows = [
  { id: 'visit_datetime', label: '방문 일시',  type: 'date',  top: rowTop(0), w: 160, required: true, todayDefault: true },
  { id: 'visitor_name',   label: '방문자 성명', type: 'text',  top: rowTop(1), w: 240, required: true },
  { id: 'visitor_org',    label: '소속',       type: 'text',  top: rowTop(2), w: 300, required: true },
  { id: 'visitor_phone',  label: '연락처',     type: 'phone', top: rowTop(3), w: 220, required: true },
];

export const purpose = {
  id: 'visit_purpose', label: '방문 목적', top: rowTop(4), boxTop: rowTop(4) + 14, size: 13,
  options: [
    { label: '회의', x: 168 },
    { label: '납품', x: 244 },
    { label: '면접', x: 320 },
    { label: '견학', x: 396 },
    { label: '기타', x: 472 },
  ],
};

export const host = { id: 'host_name', label: '만나는 담당자', type: 'text', top: rowTop(5), w: 260, required: true };

export const consent = {
  top: 404,
  heading: '개인정보 수집·이용 동의',
  body: [
    '수집 항목: 방문 일시, 성명, 소속, 연락처, 방문 목적, 만나는 담당자, 서명',
    '수집 목적: 방문자 확인과 시설 출입 관리, 안전 사고 발생 시 연락',
    '보유 기간: 수집일로부터 1년. 기간이 지나면 지체 없이 파기합니다.',
    '동의를 거부할 수 있으나, 동의하지 않으면 시설 출입이 제한될 수 있습니다.',
  ],
  checkId: 'agree_privacy',
  checkLabel: '위 내용을 확인하였으며 개인정보 수집·이용에 동의합니다. (필수)',
  checkBox: [56, 508, 69, 521],
};

export const sign = {
  id: 'visitor_sign', label: '방문자 서명', top: 546,
  box: [252, 556, 476, 630],
};

export const footer = { top: 690, text: '작성해 주셔서 감사합니다. 전송을 누르면 다음 방문자용 화면이 다시 열립니다.' };

/** 입력 컴포넌트 bbox 계산(행 기준 상단 여백 8pt, 높이 26pt). */
export const inputBox = (r) => [VALUE_X, r.top + 8, VALUE_X + r.w, r.top + 34];
