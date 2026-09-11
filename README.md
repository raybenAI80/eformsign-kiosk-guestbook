# 방명록 키오스크 (이폼사인 임베딩 래퍼)

태블릿 한 대에 문서 작성 화면을 띄워 두고, **로그인하지 않은 방문자**가 작성·제출하면
사람이 손대지 않아도 **같은 템플릿의 새 작성 화면**이 다시 열린다.

- (A) `mode: "immediate"` — 제출 즉시 새 작성 화면
- (B) `mode: "thanks"` — "감사합니다" 안내를 N초(기본 5초) 보여 준 뒤 새 작성 화면

OZR 은 쓰지 않는다. 이폼사인 **표준 기능 + 정적 HTML 한 장**이다.

---

## 🔴 먼저 읽을 제약 (실기로 확인, 2026-09-11)

### 1. 템플릿 `config.notification` 이 비어 있으면 제출이 400 으로 죽는다

작성자가 전송을 누르면
`POST /v1.0/companies/{cid}/forms/{fid}/documents/external_user_complete` 가
**HTTP 400 `{"code":"5000004","ErrorMessage":"Failed to create the document."}`** 로 떨어지고
화면이 "이미 작성한 문서입니다." 로 바뀌며 **문서가 생성되지 않는다.**

원인은 워크플로 단계 수가 아니라 **템플릿 config 의 `notification` 이 빈 것**이다.
OZR 복사 재배포(`redeployOzr`) 로 API 에서 만든 템플릿은 `notification` / `display_settings` /
`pdf_send` 가 복사되지 않아 빈 채로 배포된다. 콘솔에서 만든 템플릿은 서버가 채워 준다.

> ⚠️ 2026-09-11 정정. 이 문서는 한때 "시작→완료 2단계 워크플로가 원인"이라고 적고 있었으나
> **틀렸다.** 2단계 템플릿도 정상 동작한다(사내 ROI 분석리포트 템플릿 `ba4b17d0…` 이 2단계로
> 운영 중). 실패한 2단계 템플릿들이 전부 API 로 만들어진 것이었을 뿐이다.

**고치는 법** — `config.notification` 을 SDK 상수 `EFORMSIGN_DEFAULT_NOTIFICATION` 으로 채우고
저장·release 한다. `tools/repair-config.mjs --form <id> --notification` 이 그 일을 한다.
배포 직후에는 `node D:\pjt\eformsign\form-factory\scripts\config-health.mjs --form <id>` 로
확인한다(이 게이트가 같은 결함을 이미 잡고 있었다).

→ 방명록은 **시작(방문자) → 완료** 2단계로 만들어도 되고, 담당자 확인 단계가 필요하면
  **시작(방문자) → 참여자(담당자) → 완료** 로 만든다. 어느 쪽이든 config 건강 검사를 통과시켜라.

### 2. 템플릿 설정 「URL로 문서 생성 허용」이 **반드시 켜져 있어야 한다**
꺼져 있으면 임베딩 화면이 뜨긴 해도 OZR 을 받아오는 요청이 **403** 이 나고
"리포트 로드: 보고서를 로딩하면서 예외가 발생했습니다"(에러코드 1020030013) 만 보인다.

- 콘솔: 템플릿 설정 > 워크플로우 > 시작 단계 속성 > **URL로 문서 생성 허용**
- API(kr-service): `form.auth.external_users.use_external_users = true` 로 저장 후 재배포
  (`tools/set-recaptcha.mjs --form <id> --on --ext on`)

### 3. reCAPTCHA — 현재 운영본은 **끔**(사용자 결정)
「로봇에 의한 문서 자동 제출 방지」를 끄면 공개 URL 이 새어 나갔을 때 봇이 문서를 대량 생성해
**문서 요금이 그대로 청구된다.** 켜 두면 전송 확인 팝업에 "로봇이 아닙니다" 체크가 하나 붙어
방문자가 한 번 더 탭한다 — 키오스크 체감을 위해 **사용자가 의도적으로 껐다**(v2·v3 모두 OFF).
이 항목은 게이트가 판정하지 않는다(운영 판단). 유출 위험은 문서 생성 수 제한·도메인/IP 지정으로 막는다.

### 4. 인증서 기반 전자서명은 함께 쓸 수 없다
「URL로 문서 생성 허용」과 병용 불가(제품 제약, 매뉴얼 chapter5).

### 5. 전송 확인 팝업은 숨길 수 없었다
임베딩 옵션 `layout.hide_request_popup: true` 를 줘도 「문서 전송」 팝업(메시지 입력 + 전송)이 그대로 떴다.
방문자가 **전송 → 팝업의 전송** 으로 두 번 누른다고 보고 안내 문구를 쓴다.

---

### 6. 🔴 작성 프레임 안의 활동은 부모 페이지가 볼 수 없다 (무응답 리셋 오작동의 원인)

작성 화면은 `https://www.eformsign.com` 의 **cross-origin iframe** 이다. 방문자가 그 안에서
글자를 입력하거나 서명을 그려도 `touchstart` / `keydown` 같은 이벤트는 **부모 document 로 올라오지 않는다.**
부모의 이벤트만 보고 무응답을 판단하면 **열심히 작성 중인 방문자를 무응답으로 오인해 화면을 리셋한다**
(2026-09-11 사용자 보고 "왜 자꾸 새로고침이 되는 거지?" — 콘솔에 `idle timeout -> restart` 가 반복 기록).

부모가 볼 수 있는 신호는 다음 셋뿐이라 이 셋을 함께 쓴다.

1. **포커스 폴링** — `document.activeElement === <iframe>` 이면 방문자가 프레임 안에 있다. 1초마다 확인해 타이머를 갱신한다.
   `window` 의 `blur` 시점에 activeElement 가 iframe 이면 "프레임 안으로 들어갔다"로 확정한다.
2. **이폼사인 콜백** — `action_callback` / 프레임이 보내는 postMessage 수신 = 살아 있는 세션.
3. **부모 영역의 pointer / touch / key / wheel**.

그리고 리셋 기준을 둘로 나눈다. 아직 프레임을 건드리지 않은 세션은 `idleResetSeconds`(기본 120초),
한 번이라도 포커스가 갔던 세션은 `abandonResetSeconds`(기본 180초)를 쓰고 **포커스가 프레임 밖에 있는 시간만** 센다.
리셋 5초 전에는 "계속 작성하시겠습니까?" 경고가 뜨고 아무 곳이나 터치하면 취소된다.
리셋이 실제로 일어나면 콘솔에 사유·한도·경과·마지막 활동 출처가 남는다
(`무응답 리셋 실행 — 사유=abandon 한도=180s 경과=181s 마지막 활동 출처=frame-focus`).

---


## 설치·실행

정적 파일 3개뿐이다. `file://` 로 열면 임베딩 스크립트가 동작하지 않으므로 **HTTP 로 서빙**한다.

```bash
# 아무 정적 서버나 무방
npx serve -l 8099 .
# 또는
python -m http.server 8099 --bind 127.0.0.1
```

브라우저에서 `http://localhost:8099/` 를 연다.
(이 저장소에서는 `.claude/launch.json` 의 `kiosk-guestbook` 항목으로도 띄운다.)

운영 배포는 사내 웹서버나 정적 호스팅에 `index.html` / `config.js` 두 파일을 올리면 된다.

## 설정 — `config.js`

| 키 | 뜻 |
|---|---|
| `companyId` | 이폼사인 회사 ID (회사 관리 > 회사 정보 > 기본 정보) |
| `countryCode` | 국가 코드. 국내는 `kr` |
| `templateId` | 템플릿 ID (템플릿 설정 화면 URL 의 `form_id`) |
| `title` / `subtitle` | 키오스크 헤더 문구 |
| `visitorName` | 외부 작성자 표시 이름(예: `방문자`) |
| `mode` | `immediate` 또는 `thanks` |
| `thanksSeconds` / `thanksMessage` / `thanksSubMessage` | 감사 화면 |
| `idleResetSeconds` | 작성 프레임을 아직 건드리지 않은 세션의 무응답 리셋(초, 기본 120). `0` 이면 리셋 전체를 끔 |
| `abandonResetSeconds` | 작성 프레임에 포커스가 갔던 세션(= 입력 중)의 이탈 리셋(초, 기본 180). 포커스가 프레임 밖일 때만 카운트 |
| `langCode` | 이폼사인 화면 언어 |
| `showHeader` | 이폼사인 기본 헤더(전송 버튼 포함). `false` 면 전송 버튼이 사라지므로 직접 만들어야 한다 |
| `hideRequestPopup` | 전송 확인 팝업 숨김 시도(현재 효과 없음, 제약 5) |
| `debug` | 우하단 로그 패널 |

URL 쿼리로 덮어쓸 수 있다: `?mode=thanks&sec=5&idle=120&abandon=180&template=<id>&company=<id>&debug=1`

## 태블릿 키오스크 모드

- **Android(Chrome)**: 설정 > 앱 > Chrome 을 기본 브라우저로 두고, 화면 고정(앱 고정) 사용.
  전용 단말이면 *Fully Kiosk Browser* 같은 키오스크 런처로 시작 URL 을 지정하는 쪽이 안정적이다.
- **iPad(Safari)**: 설정 > 손쉬운 사용 > **가이드 접근** 을 켜고, Safari 로 페이지를 연 뒤
  홈 버튼(또는 측면 버튼) 세 번 눌러 가이드 접근 시작.
- **Windows 태블릿(Edge)**: `msedge.exe --kiosk http://<주소> --edge-kiosk-type=fullscreen`
- 페이지 자체도 뒤로가기를 무효화하고, 우클릭·확대 제스처를 막고, 무응답 시 처음 화면으로 돌아간다.

## 운영 주의

- 공용 단말이므로 **직전 방문자의 입력이 남지 않는 것**이 중요하다. 이 페이지는 세션마다
  `<iframe>` 을 통째로 새로 만들어 새 URL(`&v=<타임스탬프>`)로 다시 연다.
- 공개 URL 이 외부에 노출되면 누구나 문서를 만들 수 있다. reCAPTCHA 를 켜고,
  필요하면 템플릿 시작 단계의 **문서 생성 수 제한** / **도메인·IP 지정** 을 함께 건다.
- 방문자가 남긴 개인정보를 다루므로, 템플릿에 수집·이용 동의 항목을 반드시 둔다.

## 동작 원리

`efs_embedded_v2.js` 의 `EformSignDocument` 로 `mode.type:"01"`(새 문서 작성),
`user.type:"02"`(외부 작성자)를 iframe 에 띄우고, 제출이 끝나면 다시 연다.

제출 감지는 두 경로를 함께 쓴다.

1. `success_callback` — 정상 제출 시 `{fn:"saveSuccess", code:"-1", message:"완료되었습니다.", document_id:...}` 가 온다. **이게 기본 경로다.**
2. iframe 이동 — `action_callback`(작성 화면 로드) 이후 iframe 이 스스로 다른 페이지로 옮겨 가면 제출로 본다.
   콜백이 오지 않는 상황(제약 1의 실패 화면 등)에서도 키오스크가 멈추지 않게 하는 보조 경로다.

🔴 `efs_embedded_v2.js` 의 `open()` 은 `$('#eformsign_iframe').attr('src', url)` 을 한다.
**그 id 를 가진 요소는 반드시 `<iframe>` 이어야 한다.** `<div>` 로 두면 아무 일도 일어나지 않고
에러도 나지 않는다(가이드 예제만 보고 `<div>` 로 만들면 빈 화면이 된다).

🔴 같은 스크립트는 iframe 이 `completeWriteDocument` 메시지를 보내면 **전역 함수**
`completeWriteDocument(data, iframe)` 을 호출한다. 부모 페이지가 정의해 두지 않으면
ReferenceError 로 메시지 처리가 통째로 죽는다. `index.html` 에 정의해 두었다.

## 서식(템플릿) — 항목별 컴포넌트

운영 템플릿 `e86be31eb2e3485184b94d3d58540095` **「방문자 기록부(방명록) v3 OZW」**(2026-09-11 전환).
서식은 **OZW**라서 다른 작업자가 **콘솔 웹폼 디자이너에서 열어 필드를 옮기고 추가**할 수 있다.

소스는 `form/`(좌표 단일 진실원천 `layout.mjs` → `build-pdf.mjs` → `build-ozr.mjs` → `build-ozw.mjs`)이다.
`build-ozw.mjs` 는 SDK `buildOzwFromPdfBacked(...)` 를 부르는 얇은 스크립트다 — OZR 봉투 뒤에
`ozw1` 편집기 tail 을 붙여 `.ozw` 를 방출한다(API 키만 필요, 콘솔 로그인 불필요).

구 운영본 `e1fef806750248d5993c2ecee84e9502` 는 **「방문자 기록부(방명록) v2 OZR 구본」** 으로
개명해 롤백본으로 남겼다(삭제하지 않았고, 재release 해 두어 그대로 되돌릴 수 있다).
그쪽은 PDF-backed **OZR** 이라 웹폼 디자이너에서 열어 고칠 수 없다.

| 항목 | 컴포넌트 | 스키마 `input_type` | 비고 |
|---|---|---|---|
| 방문 일시 | 날짜(달력) | `DateTimePicker` | 🔴 **기본값 = 오늘**(자동 입력), 클릭하면 달력 팝업 |
| 방문자 성명 | 텍스트 | `InputTextEx` | 필수 |
| 소속 | 텍스트 | `InputTextEx` | 필수 |
| 연락처 | 텍스트 | `InputTextEx` | 필수 |
| 방문 목적 | 라디오 5지(회의/납품/면접/견학/기타) | `InputRadioGroup` | 필수 |
| 만나는 담당자 | 텍스트 | `InputTextEx` | 필수 |
| 개인정보 수집·이용 동의 | 체크박스 | `InputRadioGroup` | 값 `Y`/`N` |
| 방문자 서명 | 서명 패드 | `SignPad` | 「서명」 모달(그리기/모바일) |

🔵 **OZW 로 방출해도 이 스크립트는 그대로 동작한다**(2026-09-11 실기). `ozw1` tail 은 OZR 봉투
**뒤에** 붙을 뿐이라 이벤트 스크립트가 손상되지 않는다 — v3 OZW 로 제출한 문서
`018742556f094c0cb1e9ee3b8cdcffee` 의 완료 PDF 에 오늘 날짜가 인쇄됐고 문서 제목의
`{{방문일시}}` 도 `2026-09-11` 로 치환됐다.

🔴 **날짜 기본값은 플랫폼 설정이 아니라 OZR 스크립트다.** 템플릿 설정에는 기본값 항목 자체가 없다.
DateTimePicker 의 `OnInitialize` 가 `if (This.GetText() == "") { This.SetDateTime(new Date().getTime()); }` 를 돈다
(SDK `buildPdfBackedOzr` 의 `field.todayDefault: true`). 값이 이미 있는 문서는 덮어쓰지 않는다.
래퍼의 `prefill` 로 날짜 문자열을 넣는 방법은 **쓰지 않는다** — 공개 URL 직접 접속에서는 빈칸이 된다.

🔴 **`input_type` 만으로는 체크박스와 라디오가 구별되지 않는다**(둘 다 `InputRadioGroup`). 컴포넌트 감사는
스키마와 `form/guestbook.report.xml` 을 함께 본다.

### 서식을 고칠 때

고치는 길은 두 갈래다.

**(가) 웹폼 디자이너에서 직접** — 필드를 옮기거나 하나 더 놓는 정도면 콘솔에서 템플릿을 열어
고치고 저장·재배포하면 끝이다. **OZW 로 전환한 이유가 이것이다.**

**(나) 소스에서 재방출** — 좌표·문구·PDF 배경 자체가 바뀌면 빌드 체인을 다시 돌린다.
양식 파일만 바꾸는 API 는 없으므로(`POST /forms/{fid}` multipart 는 `ozr_id` 만 회전하고 바이트는
그대로) **새 템플릿을 만든다.**

```bash
node form/build-pdf.mjs && node form/build-ozr.mjs && node form/build-ozw.mjs   # 좌표 수정 후
node --env-file=D:/pjt/eformsign/eformsign-core/.env   tools/deploy-guestbook.mjs --name "방문자 기록부(방명록) v4 OZW" --ozr form/guestbook.ozw --recaptcha off
node --env-file=D:/pjt/eformsign/eformsign-core/.env   D:/pjt/eformsign/eformsign-cli/dist/cli.js kiosk verify-template <새 id>
node --env-file=D:/pjt/eformsign/eformsign-core/.env   D:/pjt/eformsign/form-factory/scripts/config-health.mjs --form <새 id> --ozr form/guestbook.ozr --expect form/config-health.expect.json
```

`build-ozw.mjs` 대신 SDK 를 직접 부를 수도 있다(같은 구현, 4표면).

```bash
node D:/pjt/eformsign/eformsign-cli/dist/cli.js ozw build-from-pdf form/guestbook.ozr -o form/guestbook.ozw   --required 방문일시 --required 방문자성명 --required 소속 --required 연락처   --required 방문목적 --required 담당자 --required 개인정보동의
```

같은 입력이면 산출 바이트가 항상 같다(고정점 sha256 `9346a5cb5577f350…`) — 재방출본이 배포본과
byte-identical 인지로 회귀를 잡는다.
그리고 `config.js` 의 `templateId` 를 갱신한다. 구본은 **삭제하지 말고 개명**해 둔다.
⚠️ `createFromFile` 은 같은 이름이면 `400 [4000048] The connection name already exists` 로 거부한다.
⚠️ 이름만 바꿔 저장해도 `is_release` 가 내려가므로, 운영본을 개명했으면 재배포한다.

## 운영 체크리스트 (템플릿 조건)

새 태블릿을 놓거나 템플릿을 바꿀 때 아래를 순서대로 확인한다.

- [ ] **URL로 문서 생성 허용 ON** — 꺼져 있으면 OZR 로딩이 403 (제약 2)
- [ ] **`config.notification` 이 비어 있지 않다** — 비면 제출이 400 (제약 1). `config-health.mjs` exit 0 으로 확인
- [ ] **release 된 상태**(`is_release: true`)
- [ ] **reCAPTCHA** — 현재 운영본은 사용자 결정으로 OFF. 켜고 끄는 판단 근거는 제약 3
- [ ] 워크플로 **시작(방문자) → 완료** 2단계로 충분하다. 담당자 확인이 필요하면 3단계
- [ ] 필수 항목이 write 단계 `input_control_option` 에서 `required: true`
- [ ] `config.js` 의 `templateId` / `companyId` 가 그 템플릿을 가리킨다

한 줄 점검(키오스크 조건 전용 — 결함이면 exit 1):
```bash
node D:/pjt/eformsign/eformsign-cli/dist/cli.js kiosk verify-template <formId>
```
워크플로·URL 생성 허용·`config.notification`·`display_settings`·`is_release` 를 판정하고,
문서 관리자 지정과 문서 제목 규칙은 경고·정보로 알려 준다. 같은 판정을 SDK
`templates.verifyKioskTemplateReadiness(formId)` / MCP `eformsign_verify_kiosk_template` 로도 부를 수 있다.

전수 정밀 점검(산출물 OZR 을 기준선으로 쓴다):
```bash
node D:/pjt/eformsign/form-factory/scripts/config-health.mjs   --form <id> --ozr form/guestbook.ozr --expect form/config-health.expect.json
```

## 담당자가 방문 기록을 보는 곳

방문자는 **로그인하지 않은 외부 작성자**라, 이 문서에는 **회사 멤버가 작성자·처리자·수신자로
한 명도 들어 있지 않다**(`creator.recipient_type: "02"`, `id: ""`, `step_recipients: []`).
그래서 담당자의 개인 문서함(처리할 / 진행 중 / 완료) **어디에도 뜨지 않는다.**
매뉴얼 chapter8 「기본 문서함」이 세 문서함을 사람 기준으로 정의하기 때문이다 —
「완료 문서함: **내가 작성한 문서** 중 완료된 문서」.

🔴 **결함이 아니라 제품의 문서함 분류 규칙대로 동작하는 것이다.** 실측 판정과 근거는
`evidence/final/inbox-classification-check.md` 에 있다(2026-09-11, 실제 제출 문서
`49965ace58394fbbb45a1005be8e3c99` 로 확인).

- **지금 문서를 볼 수 있는 곳**: 이폼사인 콘솔 > **문서 관리**(문서 관리자·대표 관리자 전용).
  현재 이 템플릿의 `auth.form_manager.members` 가 비어 있어 **대표 관리자만** 보인다.
  담당자가 보게 하려면 대표 관리자가 회사 관리 > 권한 관리에서 그 멤버를 이 템플릿의
  **문서 관리자**로 지정해야 한다.
- 목록 컬럼에 방문일시·성명·소속·방문 목적·담당자가 나오도록 `display_settings` 를 잡아 두었다
  (연락처·동의·서명은 개인정보라 목록에서 숨김 — 문서를 열면 보인다).

### API 의 `type` 코드 ↔ 문서함 (2026-09-11 전수 스캔으로 확정)

| `type` | 문서함 | 방명록 문서 |
|---|---|---|
| `01` | 진행 중 문서함 | ✗ |
| `02` | 처리할 문서함 | ✗ |
| `03` | 완료 문서함 | ✗ |
| `04` | **문서 관리**(관리자용 전체 목록. `template_ids` 로 템플릿 필터 가능) | **✓** |

🔴 이 문서는 한때 「`02`=회사 전체 문서 / `04`=템플릿별 문서」라고 적고 있었으나 **틀렸다.**
`02` 는 개인의 처리할 문서함이다. 출처는 API 가이드의 Box type 표이고, 실기로도 재확인했다.

🔴 SDK `documents.list` 가 읽는 페이징 인자는 `limit`/`skip` 뿐이다. `pageSize`/`page` 로 넘기면
**조용히 무시되고 첫 20건만** 돌아온다(`수신 20건` 이 그 증상). `tools/list-docs.mjs` 가 이 버그를
갖고 있었고 2026-09-11 고쳤다 — 이제 `limit`/`skip` 을 쓰고 `--all` 로 전수 조회한다
(`--type 03 --all` 이 152건을 돌려주어 별도 전수 스캔 결과와 일치).

### 완료 알림 메일은 현재 아무에게도 가지 않는다

`config.notification` 의 `complete_document` 가 `is_first_writer: true` / `is_step_recipients: false` 인데,
최초 작성자는 **메일 주소를 남기지 않는 외부 방문자**이고 단계별 처리자도 없다.
매뉴얼의 상태 알림 수신자 선택지는 「최초 작성자」와 「단계별 처리자」뿐이라
**워크플로에 멤버 단계를 넣지 않으면 지정할 수신자 자체가 생기지 않는다.**
(이 문서에 한때 있던 "실제 수신자는 템플릿 소유자다"는 근거 없는 서술이라 삭제했다.)

담당자에게 개인 문서함/메일로 보이게 만드는 선택지와 각각의 근거·부작용은
`evidence/final/inbox-classification-check.md` §5 에 정리해 두었다(적용은 사용자 결정).

## 서식을 OZW 로 만드는 이유와 방법 (재사용 가능한 지식)

🔴 **API 로 서식을 만들 때의 기본 산출물은 `.ozw` 다.** "콘솔 로그인이 없으면 웹폼 디자이너용
OZW 를 못 만든다"는 2026-09-11 에 반증된 오판이다 — OZW 는 **PDF-backed OZR 봉투 그대로 +
`"ozw1"` + u32(tail 길이) + tail(UTF-8·CRLF)** 이고, 그 tail 을 우리가 직접 방출하면 된다.
전말과 경로 비교표: `D:\pjt\eformsign\docsesearch\ozw-template-api-creation-feasibility-2026-09-11.md`.

방출 로직은 SDK 한 곳에 있고 나머지는 얇은 어댑터다.

| 표면 | 호출 |
|---|---|
| SDK | `buildOzwFromPdfBacked({ ozrBuffer, requiredFieldIds?, participantMask? })` / `client.ozw.buildFromPdfBacked(...)` |
| CLI | `eformsign-cli ozw build-from-pdf <ozr> -o <out.ozw> [--required <FORMID>…]` |
| MCP | `eformsign_build_ozw_from_pdf` |
| HTTP | `POST /v1/ozw/build-from-pdf` (`eformsign-api`, `X-API-Key`) |

## 절차·사실 정본 (이 저장소 밖)

| 축 | 위치 |
|---|---|
| 절차(스킬) | `C:\\Users\\FORCS\\.claude\\skills\\eformsign-kiosk\\SKILL.md` — 요건 판별·체크리스트·검증 절차·함정 15종 |
| 사실(볼트 팩) | `eformsign-api-support-pack/claims.md` 「2026-09-11 키오스크 반복 작성 조사」 절 |
| 기계 게이트 | 라우터 규칙 `R16-eformsign-kiosk` (`kiosk-template-readiness` · `kiosk-repeat-loop` · `korean-linebreak` · `closeout-three-axis`) |

## 검증 도구 (`tools/`)

| 파일 | 하는 일 |
|---|---|
| `verify-kiosk.mjs` | (A)/(B) 모드를 연속 N회 돌리며 각 단계 스크린샷을 `evidence/` 에 남긴다 |
| `make-kiosk-template.mjs` | 소스 템플릿의 OZR 로 새 템플릿을 만들고 「URL로 문서 생성 허용」을 켠 뒤 배포 |
| `set-recaptcha.mjs` | 템플릿의 reCAPTCHA / URL 생성 허용 스위치 토글 |
| `probe-submit.mjs` | 제출 직후 네트워크·콘솔을 관찰(400 원인 규명용) |
| `cdp.mjs` | CDP 헬퍼(이동·클릭·입력·스크린샷) |
| `probe2.mjs` | 제출 응답 **본문까지** 회수하는 프로브(`--script <파일>` 로 조작 시나리오 주입) |
| `repair-config.mjs` | 템플릿 config 의 `notification`/`display_settings` 를 기본값으로 채우고 재배포(제약 1 수리) |
| `survey-templates.mjs` | 전 템플릿의 워크플로 단계·「URL로 문서 생성 허용」 일람 |
| `dump-form.mjs` | 템플릿 config 전문을 JSON 으로 덤프(설정 diff 용) |
| `list-docs.mjs` | 템플릿별 생성 문서 확인(`type:"04"`). `--type 01/02/03/04` · `--limit` · `--all`(전수) |
| `deploy-guestbook.mjs` | `form/guestbook.ozr` → 새 템플릿 배포 + 키오스크 조건(2단계·notification·필수·URL 허용·reCAPTCHA) 일괄 세팅 + release |
| `promote-template.mjs` | 시험 템플릿을 운영본으로 승격(이름·설명·제목 규칙 적용 + 기준 템플릿 설정 복사 + **release 재요청**) |
| `fetch-pdf.mjs` | 완료 문서 PDF 다운로드(렌더 검증용) |
| `probe-full-submit.mjs` | 전 항목(날짜·텍스트·라디오·체크·서명)을 채워 1건 제출 — 완료 PDF 렌더 증거용 |
| `probe-date.mjs` | 새 작성 화면에서 방문 일시가 오늘로 자동 입력되는지 캡처 |
| `probe-components.mjs` | 달력 팝업·텍스트·라디오·체크 어포던스를 순서대로 캡처 |
| `probe-sign-send.mjs` / `probe-sign2.mjs` | 서명 패드 열기 → 그리기 → 확인 → 전송 |
| `probe-recaptcha.mjs` | reCAPTCHA ON 상태의 전송 팝업 캡처(체크하지 않는다) |
| `probe-idle-reset.mjs` | 무응답 리셋 3케이스 실기 검증(프레임 포커스 유지 40초 무리셋 / 카운트다운→리셋 / 터치 취소). `evidence/final/idle-*.png` + `idle-cases-report.json` 생성, 전부 PASS 면 exit 0 |

검증용 헤드리스 크롬 띄우기:

```bash
chrome --headless=new --remote-debugging-port=9233 --remote-allow-origins=* \
  --user-data-dir=<임시 프로필> --window-size=768,1024 about:blank
node tools/verify-kiosk.mjs --port 9233 --mode immediate --rounds 2 --notype
node tools/verify-kiosk.mjs --port 9233 --mode thanks    --rounds 2 --notype
```

무응답 리셋 회귀(같은 헤드리스 크롬, 약 2분):

```bash
CDP_PORT=9233 node tools/probe-idle-reset.mjs   # ALL_PASS=true / exit 0
```

좌표는 768×1024 태블릿 뷰포트 기준이라 템플릿이 바뀌면 다시 잡아야 한다.

## 배포

| 항목 | 값 |
|---|---|
| 라이브 URL | **https://eformsign-kiosk-guestbook.vercel.app** |
| 저장소 | https://github.com/raybenAI80/eformsign-kiosk-guestbook (public) |
| 호스팅 | Vercel 정적 배포 (`vercel.json`, 빌드 없음) |
| Vercel 스코프 | `raybens-projects` (개인 스코프. 영업 도구들과 같은 곳) |
| Vercel 프로젝트 | `eformsign-kiosk-guestbook` |
| Git 자동 배포 | **연결됨.** `main` 에 push 하면 Vercel 이 다시 배포한다 |

최초 배포 검증(2026-09-11, 768×1024): 작성 프레임 정상 로드 · 방문 일시 자동 입력 확인 ·
콘솔 에러 0 · `?mode=immediate&debug=1` 로 모드 덮어쓰기 반영 확인.
증거는 `evidence/final/vercel-01-loaded.png`, `evidence/final/vercel-02-immediate-debug.png`.

### 재배포

`main` 에 push 하면 Vercel 이 자동으로 다시 배포한다.

```bash
git add -A && git commit -m "<변경 요약>" && git push
```

CLI 로 즉시 올리려면 이 폴더에서 `vercel --prod --yes` 를 쓴다.

### 설정을 바꿀 때

키오스크 동작(모드·감사 화면 시간·무응답 리셋·템플릿 ID 등)은 `config.js` **한 파일**만
고치면 된다. 고친 뒤 위와 같이 push 하면 반영된다. `vercel.json` 이 `config.js` 와
`index.html` 에 `Cache-Control: no-store` 를 걸어 두어 태블릿이 옛 설정을 물고 있지 않는다.

현장에서 한 대만 다르게 쓰고 싶으면 파일을 고치지 말고 URL 쿼리로 덮어쓴다.

```
https://eformsign-kiosk-guestbook.vercel.app/?mode=immediate
https://eformsign-kiosk-guestbook.vercel.app/?mode=thanks&sec=4&idle=30
```

`?debug=1` 을 붙이면 화면 우하단에 동작 로그 패널이 뜬다(현장 점검용).

### 배포 환경 주의

- **Vercel 계정은 rayben@forcs.com** 이다(개인 gmail 아님). 커밋 작성자도 저장소 로컬
  설정으로 `rayben@forcs.com` 을 쓴다 — 전역 git identity 는 개인 gmail 이라 그대로 두면
  전역 pre-push 게이트에 걸린다.
- `vercel link` 가 GitHub 저장소를 **자동으로 연결**한다(같은 이름의 원격이 있을 때).
  대시보드에서 따로 Git 연결을 할 필요가 없었다.
- `vercel link` 는 `.env.local` 을 만들고 `.gitignore` 에 `.vercel` / `.env*` 를 덧붙인다.
  둘 다 저장소에 올리지 않는다.
- vercel CLI 를 `npm i vercel` 로 설치하면 상위 디렉터리(`C:\Users\FORCS\package.json`)에
  의존성이 딸려 들어갈 수 있다. 전역 설치(`npm i -g vercel`)를 쓴다.
- 첫 배포가 "Deploying outputs" 에서 몇 분 멈추면 배포 상세에서 **Cancel → Redeploy** 한다
  (Hobby 티어 일시 현상). 2026-09-11 최초 배포에서는 3초에 끝나 겪지 않았다.

### 배포에 포함하지 않는 것

`.gitignore` 로 `evidence/`(검증 스크린샷), `.work/`, `form/` 의 PDF·OZR·XML 산출물을
제외한다. 저장소에는 소스(`index.html`, `config.js`), 서식 빌드 스크립트(`form/*.mjs`),
검증 도구(`tools/`)만 올라간다. 자격 증명은 전부 환경 변수(`process.env.*`)로만 읽으므로
저장소에 들어 있는 하드코딩된 키는 없다.
