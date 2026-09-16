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
한 번이라도 포커스가 갔던 세션은 `abandonResetSeconds`(기본 180초)를 쓴다.
리셋 `countdownSeconds` 초 전(기본 5초)에는 "계속 작성하시겠습니까?" 복귀 카운트다운이 뜨고, 그동안 뒤의 작성 내용은 흐리게 가려진다. 아무 곳이나 터치하면 취소된다.
리셋이 실제로 일어나면 콘솔에 사유·한도·경과·마지막 활동 출처가 남는다
(`무응답 리셋 실행 — 사유=abandon 한도=180s 경과=181s 마지막 활동 출처=frame-focus`).

🔴 **2026-09-16 수정 — 포커스가 프레임 안에 "머무는" 동안도 abandon 타이머는 흐른다.**
이전 판은 "포커스가 프레임 안에 있으면 매초 타이머를 되감는다"로 짜여 있어서, 칸에 글을 쓰다
그대로 자리를 뜬 방문자는 **영원히 리셋되지 않는** 결함이 있었다(포커스가 프레임 밖으로 안 나갔으므로).
지금은 포커스가 프레임 안으로 **"들어간 순간"만** 활동 1회로 치고(`idle.inFrame` 플래그,
`noteFrameFocus()`), 그 뒤로 프레임 안에 머무는 동안에도 `abandonResetSeconds` 가 그대로 흘러
시간이 되면 리셋된다. 회귀 테스트는 `probe-idle-reset.mjs` CASE 4(포커스 유지한 채 이탈)/
CASE 5(카운트다운 취소 후 재시작) 참조.

---

### 7. 🔴 작성 화면이 뜨는 도중의 `iframe load` 를 제출로 오판하던 레이스 (2026-09-16 수정)

외부 작성자(`user.type` `"02"`) 신규 작성에서는 제출해도 `success_callback` 이 오지 않는 경우가 있어,
「작성 화면이 뜬 뒤(`action_callback`)의 iframe 이동」을 제출 보조 신호로 쓴다. 그런데 이폼사인이 보내는
`func_onload` `action_callback`(postMessage)과 **같은 문서의 `load` 이벤트 사이에는 도착 순서 보장이 없다.**
순서가 뒤집히면 `formReady` 가 켜진 채 그 문서 자신의 `load` 가 들어와 **아무도 제출하지 않았는데
「제출 감지」** 가 찍히고 세션이 리셋된다. 문서는 만들어지지 않았으므로 방문 기록이 통째로 사라질 수 있다.

실측(헤드리스, 2026-09-16, 운영 서식 `8844aae6…`):

| 관측 항목 | 값 |
|---|---|
| `load`(작성 화면) ↔ `action_callback` 간격 | 0.5 ~ 1.3초 |
| 두 신호의 순서 | 고정되지 않는다. `load` 가 먼저인 라운드와 `action_callback` 이 먼저인 라운드가 섞였다(먼저인 경우 +689ms · +924ms · +1,315ms 관측) |
| 작성 프레임의 이동 주소 | 초기 로드 내내 `external_user_view_service.html?…` 하나 |
| 세션당 `load` 횟수 | 2회 — #1 은 iframe 을 만든 직후의 `about:blank`(+5ms), #2 가 작성 화면 문서 |

마지막 두 줄이 중요하다. **프레임이 이동한 주소로는 구분할 수 없다.** 다른 도메인이라 읽을 수 없을 뿐
아니라, 초기 로드 동안 주소가 바뀌지도 않는다. 그래서 시간과 접촉 여부로 두 겹을 두었다.

1. **작성 화면이 뜬 뒤 5초(`SUBMIT_GRACE_MS`) 안에 온 `load` 는 무시한다.** 방문자가 칸을 채우고
   전송을 눌러 완료 화면까지 가는 데 5초 미만일 수는 없다. 관측된 레이스 폭(최대 1.3초)의 약 4배다.
2. **작성 프레임을 한 번도 건드리지 않은 세션은 제출일 수 없다.** 전송 버튼이 그 프레임 안에 있기
   때문이다. 다만 포커스 감지가 듣지 않는 환경에서 제출을 영영 못 잡는 일이 없도록
   60초(`ENGAGE_FALLBACK_MS`)가 지나면 이 조건은 푼다.

회귀 테스트는 `tools/probe-load-race.mjs` 다. `--inject <ms>` 가 결함 조건(작성 화면의 `load` 보다
`action_callback` 이 먼저 도착한 상태)을 결정적으로 재현하므로, 네트워크 운에 기대지 않고 확인할 수 있다.

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
| `thanksSeconds` / `thanksMessage` / `thanksSubMessage` | 감사 화면 (대기시간은 아래 「고객 설정 항목」 표 참조) |
| `idleResetSeconds` / `abandonResetSeconds` / `countdownSeconds` | 대기시간 4종 — 아래 「고객 설정 항목」 표 참조 |
| `langCode` | 이폼사인 화면 언어 |
| `showHeader` | 이폼사인 기본 헤더(전송 버튼 포함). `false` 면 전송 버튼이 사라지므로 직접 만들어야 한다 |
| `hideRequestPopup` | 전송 확인 팝업 숨김 시도(현재 효과 없음, 제약 5) |
| `debug` | 우하단 로그 패널 |

URL 쿼리로 덮어쓸 수 있다: `?mode=thanks&sec=5&idle=120&abandon=180&countdown=5&template=<id>&company=<id>&debug=1`

### 고객 설정 항목 — 대기시간 4종

대기시간은 전부 `config.js` 에서 고객이 직접 정한다. 현장에서 한 대만 다르게 쓸 때는 URL 쿼리로 덮어쓴다.

| 설정 키 | 뜻 | 기본값 | URL 쿼리 |
|---|---|---|---|
| `idleResetSeconds` | 아직 아무도 작성 프레임을 건드리지 않은 빈 화면을 처음 화면으로 되돌리기까지의 시간(초). `0` 이면 리셋 전체를 끔 | `120` | `?idle=` |
| `abandonResetSeconds` | 방문자가 작성을 시작한 뒤 자리를 뜬 경우의 리셋 시간(초). 프레임 안에 포커스가 머무는 동안에도 흐른다(2026-09-16 수정 — 위 「6.」 참조) | `180` | `?abandon=` |
| `thanksSeconds` | 제출 후 감사 화면을 보여 주는 시간(초). `mode: 'thanks'` 일 때만 쓰인다 | `5` | `?sec=` |
| `countdownSeconds` | 리셋 직전 「계속 작성하시겠습니까?」 복귀 카운트다운 시간(초) | `5` | `?countdown=` |

권장값: 사람이 계속 지나다니는 **로비·전시 부스는 60~90초**(idle), 차분히 적는 **사무실 접수대는 180초** 정도로 두고, `abandonResetSeconds` 는 `idleResetSeconds` 보다 길게, `countdownSeconds` 는 5~10초를 쓴다.

### 헤더 「처음부터 다시」 버튼

헤더 오른쪽에 「처음부터 다시」 버튼이 있다. 방문자가 잘못 적었을 때 무응답 리셋을 기다리지 않고 바로
빈 서식으로 되돌린다. 실수 터치를 막으려고 **「입력한 내용이 지워집니다. 처음부터 다시 시작할까요?」 확인 화면**을
한 번 거치고, 확인하면 작성 프레임을 통째로 새로 만든다(무응답 리셋과 같은 경로, 로그 사유 `reason=manual`).
감사 화면에서는 되돌릴 것이 없으므로 버튼이 숨겨진다.

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
- 🔴 **SDK(`eformsign-core`)를 고친 뒤에는 MCP 서버를 재연결한다.** MCP 는 빌드된 `dist` 를 기동 시
  1회만 읽으므로, 재연결 전에는 새로 추가한 검사·필드(예: 관리자 보존 `toCreateShapeAuthFromForm`,
  라디오 `label` 게이트, 삭제 memberId 메시지)가 MCP 툴에 **반영되지 않는다** — 옛 빌드로 검증하고
  통과했다고 오판하기 쉽다. 순서: `cd eformsign-core && npm run build` → MCP 재연결 → 재검증.
- 삭제·정리는 member-scoped 토큰이 필요하다(`.env` 의 `EFORMSIGN_DEFAULT_MEMBER_ID`). 성공 판정은
  응답 코드가 아니라 **목록 재조회**, 순서는 **문서 → 템플릿**.

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

운영 템플릿 `8844aae609b84078a59ef3118c64dab2` **「방문자 기록부(방명록) v9 OZW」**(2026-09-16 전환).
v8(`bf35f6c2…`)은 **라디오 그룹 tail `label` 결함**으로 구본이 되었다 — 아래 「라디오 label」 절 참조.

🔴 **v8 부터 배경은 스크립트가 그리지 않는다 — 디자인 HTML 이 단일 진실 원천이다.**
`form/design/guestbook.html` → `render-pdf.mjs` → `guestbook-design.pdf`(배경) · `extract-layout.mjs` →
`layout.design.mjs`(좌표 실측). 빌드는 두 산출물을 인자로 받는다:

```bash
node form/design/render-pdf.mjs && node form/design/extract-layout.mjs   # 디자인을 고쳤을 때만
node form/build-ozr.mjs --layout form/design/layout.design.mjs \n                        --pdf    form/design/guestbook-design.pdf
node form/build-ozw.mjs
```
인자를 생략하면 예전 경로(`form/layout.mjs` + `form/guestbook.pdf`, 스크립트가 그린 배경 = v7)로
떨어진다. `build-ozr.mjs` 에 **FORMID 매핑 하드 게이트**가 있어 layout 의 id 8개가 `FORM_IDS`
키와 어긋나면 던진다(제목 규칙이 `{{방문자성명}}`·`{{소속}}` 한글 FORMID 에 묶여 있다).
자세한 파이프라인은 `form/design/README.md`.

**서식을 고치는 절차** = ① `form/design/guestbook.html` 을 고친다 ② `render-pdf` → `extract-layout`
③ `build-ozr --layout/--pdf` → `build-ozw` ④ `ozw inspect` + `gate-verify --task "OZW 손수 방출"`
⑤ **새 템플릿으로 배포**(기존 템플릿 파일 교체가 아니라 신규 배포 + 설정 복사 + 개명·전환).
구본은 `[구본] ` 접두어를 붙이고 **구본을 먼저 저장, 운영본을 마지막에 저장**한다.

🔴 **v6 는 방문자가 글자를 못 넣었다 — 입력 읽기전용 결함.** v6 빌드에서 report 입력요소에 심은
`P_ENABLES`/`P_REQUIREDS`(참여자 비트마스크) 때문이다. 공개 URL 작성 화면에서 입력칸 강조가
사라지고, 칸을 눌러 편집박스가 떠도 **타이핑이 전혀 들어가지 않는다**. 같은 세션 실기 A/B —
속성이 없는 v2 OZR·v3 OZW 는 정상 입력, v6 만 불가, 속성만 제거해 다시 방출한 v7 정상.
정품 콘솔 OZW 도 이 속성을 갖지만 그건 콘솔이 **참여자 배정과 함께** 심는 값이라 복제하면 안 된다.
이제 SDK 가 기본 미방출이고(`participantMask` 는 opt-in), `buildOzwFromPdfBacked` 가 이 속성을
발견하면 **던진다**. `inspectTemplateOzw` 는 `report_input_participant_mask` 경고를 낸다.
서식은 **OZW**라서 다른 작업자가 **콘솔 웹폼 디자이너에서 열어 필드를 옮기고 추가**할 수 있다 —
2026-09-15 소유 계정 콘솔에서 **배경 PDF 전면 렌더 + 「추가된 입력 항목 8」** 로 열리는 것을 실기 확인했다.

🔴 **v3~v5 는 디자이너에서 빈 캔버스로 열렸다**(서버·작성·제출은 전부 정상이라 조용했다). 원인 3종:
① tail 라디오 구분자 VT(U+000B) = XML 1.0 불법문자 ② `OZPAGE/@PDFDOC_NAME` 이 섹션명(리터럴 `PDFDocument` 여야 함)
③ 🔴 `ozw1` 앞 **12바이트 리소스 컨테이너 헤더** `0D 0A 00 00 03 E9 00 00 00 01 00 04` 누락.
셋 다 `eformsign-core` 방출·검증 게이트로 막았다. 전말 = `D:\pjt\eformsign\docs
esearch\ozw-designer-open-failure-2026-09-15.md`.
구본은 삭제하지 않고 `v3 OZW 구본(VT 결함)` / `v4·v5 중간본` 으로 개명해 남겼다.
v7 은 **`[구본] 방문자 기록부(방명록) v7 OZW(스크립트 배경)`**(`9ee8126b…`)로 개명하고 release 를 유지했다 —
배경만 다르고 동작은 동일하므로 즉시 롤백본으로 쓸 수 있다.

소스는 `form/`(v8 = `design/guestbook.html` → `render-pdf`·`extract-layout` → `build-ozr --layout/--pdf` → `build-ozw`;
v7 이전 = `layout.mjs` → `build-pdf.mjs` → `build-ozr.mjs` → `build-ozw.mjs`)이다.
`build-ozw.mjs` 는 SDK `buildOzwFromPdfBacked(...)` 를 부르는 얇은 스크립트다 — OZR 봉투 뒤에
`ozw1` 편집기 tail 을 붙여 `.ozw` 를 방출한다(API 키만 필요, 콘솔 로그인 불필요).

구 운영본 `e1fef806750248d5993c2ecee84e9502` 는 **「[구본] 방문자 기록부(방명록) v2 OZR 구본」** 으로
개명해 롤백본으로 남겼다(삭제하지 않았고, 재release 해 두어 그대로 되돌릴 수 있다).
그쪽은 PDF-backed **OZR** 이라 웹폼 디자이너에서 열어 고칠 수 없다.

🔴 **남은 구본은 이름 앞에 `[구본] ` 접두어를 붙인다**(2026-09-15). 콘솔 템플릿 목록에서 운영본과
육안으로 갈라내기 위한 규칙이다 — 현재 `[구본] … v2 OZR 구본`(`e1fef806…`) ·
`[구본] … v3 OZW 구본(VT 결함)`(`e86be31e…`) 둘이고, 접두어 없는 「방문자 기록부(방명록) v6 OZW」
하나만 운영본이다. 개명도 저장이므로 **개명 뒤 release 재요청**을 반드시 한다.
🔴 개명은 `update_date` 를 갱신해 **목록 정렬을 뒤집는다.** 운영본을 맨 위에 두려면 구본을 먼저 개명하고
운영본을 **마지막에** 저장한다(무변경 재저장으로 `update_date` 만 올릴 수 있다 —
`.work/resave-v6.mjs`, 전후 GET 깊은 비교로 실질 변경 0건을 확인한다).
🔴 **그 「무변경 재저장」이 문서 관리자를 지웠다**(2026-09-15 v8 실측). `auth.form_manager` 는 **비어 있는 파생 뷰**이고
실제 저장소는 `permissionAuth.managers.members` 인데, 저장 경로가 `toCreateShapeAuth(f.auth)` 만 쓰면
`["rayben@forcs.com"]` 이 `[]` 로 덮였다. **2026-09-16 도구 수정으로 해소** — SDK 에 `toCreateShapeAuthFromForm(form)`
(폼 전체를 받아 `permissionAuth` 를 먼저 읽는다)을 두고 저장하는 도구 전부를 그것으로 바꿨다
(`tools/{deploy-guestbook,promote-template,replace-form-file,repair-config,set-recaptcha,make-kiosk-template}.mjs`,
`.work/{resave-v6,rename-tpl,set-manager,set-title}.mjs`).
고정점 = `eformsign-core/tests/create-shape-auth-managers.test.ts`(결함 주입 포함) + v9 실기(관리자 지정 → 무변경
재저장 → `permissionAuth.managers.members` 유지 확인). 규율(재저장 뒤 set-manager 재실행)은 더 이상 필수가 아니지만,
**저장 순서**(구본 먼저 → 운영본 마지막) 규칙은 그대로다.

### 라디오 label — 항목 수는 맞추고 글자는 비운다 (2026-09-16 실기 A/B 3판)

배경 PDF 가 항목명("회의 납품 면접 견학 기타")을 이미 인쇄하는 서식에서 라디오 그룹 tail 의 `label` 을 어떻게 쓰느냐로
웹폼 디자이너의 거동이 갈린다. `label` = 컴포넌트가 **캔버스에 직접 그리는 항목 텍스트 목록**, `text_multivalue` = 항목 데이터.

| 방출 | 디자이너 | 결과 |
|---|---|---|
| `label="<첫 옵션>"` (v8) | 렌더 OK | 첫 항목만 **"회의회의" 이중 인쇄** |
| `label=""` (v9 초판) | 🔴 **백지** | `mxLabel.getCheckBounds` → `TypeError: …reading 'node'` 로 `Execute_AddPage` 중단 = 배경·전 컴포넌트 미렌더 |
| `label="빈 항목 n개"`(개행 n-1개) | 렌더 OK | 항목 텍스트 **1회만** ✅ 채택 |

즉 **항목 수(`label`)와 데이터 수(`text_multivalue`)가 같아야** 한다 — 콘솔 제작본의 `label === text_multivalue` 는
배경에 글자가 없어 스스로 그려야 하는 경우의 같은 규칙이다. 기계 게이트 = `eformsign-core/tests/ozw-radio-label.test.ts`(결함 주입 2종).
파일은 정상인데 디자이너만 백지면 **콘솔 예외부터** 본다(공개 URL 은 멀쩡히 렌더된다 — 파일 탓으로 오판하기 쉽다).

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
**뒤에** 붙을 뿐이라 이벤트 스크립트가 손상되지 않는다 — v3 OZW 로 제출한 검증 문서의 완료 PDF 에
오늘 날짜가 인쇄됐다(그 문서는 2026-09-15 정리 때 삭제했다. 근거는 `evidence/final/cleanup-2026-09-15.md`).

🔴 **문서 제목 규칙(현행)** — `$$current_datetime$$_방문자 기록부(방명록)__{{방문자성명}}__{{소속}}`.
제목 앞머리는 필드 `{{방문일시}}` 가 아니라 **플랫폼 변수 `$$current_datetime$$`**(생성 시각, `2026-09-15 오전 09:07`)
를 쓴다 — 사용자가 콘솔에서 정한 값이며 구본 `e1fef806750248d5993c2ecee84e9502` 와 동일하다.
2026-09-15 운영본 v3 에 되돌려 반영했고, 실기 제출 문서의 제목이
`2026-09-15 오전 09:07_방문자 기록부(방명록)__제목복원테스트__포시에스` 로 생성되는 것을 확인했다
(그 검증 문서도 2026-09-15 정리 때 삭제했다).

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
node form/design/render-pdf.mjs && node form/design/extract-layout.mjs        # 디자인(HTML) 수정 후
node form/build-ozr.mjs --layout form/design/layout.design.mjs --pdf form/design/guestbook-design.pdf && node form/build-ozw.mjs
node --env-file=D:/pjt/eformsign/eformsign-core/.env   tools/deploy-guestbook.mjs --name "방문자 기록부(방명록) v4 OZW" --ozr form/guestbook.ozw --recaptcha off
node --env-file=D:/pjt/eformsign/eformsign-core/.env   D:/pjt/eformsign/eformsign-cli/dist/cli.js kiosk verify-template <새 id>
node --env-file=D:/pjt/eformsign/eformsign-core/.env   D:/pjt/eformsign/form-factory/scripts/config-health.mjs --form <새 id> --ozr form/guestbook.ozr --expect form/config-health.expect.json
```

`build-ozw.mjs` 대신 SDK 를 직접 부를 수도 있다(같은 구현, 4표면).

```bash
node D:/pjt/eformsign/eformsign-cli/dist/cli.js ozw build-from-pdf form/guestbook.ozr -o form/guestbook.ozw   --required 방문일시 --required 방문자성명 --required 소속 --required 연락처   --required 방문목적 --required 담당자 --required 개인정보동의
```

### 재빌드 결정성 — 🔴 byte-identical 이 **아니다**(타임스탬프 9바이트)

`build-ozr.mjs` 는 OZR 본문에 빌드 시각을 `<VERSION VERSION="7.0" DATE="<epoch ms>"/>` 로 찍는다.
그래서 같은 입력으로 다시 돌려도 **OZR·OZW 모두 sha256 이 달라진다** — OZR→OZW 방출 자체는
결정적이라 그 13자리 epoch 가 OZW 로 그대로 흘러들 뿐이다.

2026-09-16 실측(정본 `form/` 에서 위 체인 재실행): 배포본 대비 **정확히 9바이트만** 다르고
위치는 둘 다 오프셋 734–742(= `DATE` 값 13자리 중 바뀐 자리)였다.

```
cmp -l <배포본>.ozr <재빌드>.ozr | wc -l   # 9
cmp -l <배포본>.ozw <재빌드>.ozw | wc -l   # 9
# 734..742  "1789456343242" -> "1789545527823"
```

따라서 회귀 판정은 **sha 동일**이 아니라 **`cmp -l` 차이가 오프셋 734–742 의 9바이트뿐인가**로 한다.
그 밖의 바이트가 하나라도 다르면 실제 회귀다.

배포본 고정점(운영 템플릿 `8844aae6…` = OZW v9. 2026-09-15 게이트 리시트 3종이 이 sha 에 묶여 있다):

| 파일 | sha256 | 크기 |
|---|---|---|
| `form/guestbook.ozr` | `15053f90f2319593a9928a7ea52c022daf0abbc1a4d30a88b10f8156492a225f` | 75,491B |
| `form/guestbook.ozw` | `f4d6d08233a79fb2c2b591a556889d9391a7136b7a642b94d1c6cfc55ba53cca` | 80,982B |

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
- [ ] **문서 제목 규칙** = `$$current_datetime$$_방문자 기록부(방명록)__{{방문자성명}}__{{소속}}` (`kiosk verify-template` 가 정보로 출력)
- [ ] **문서 관리자 지정** — 운영본 v6 는 `rayben@forcs.com`. 값은 `permissionAuth.managers.members` 에 있다(`auth.form_manager` 아님)
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
  매뉴얼 chapter8 「문서 관리/일괄 작성 문서 관리」: 「문서 관리: 문서 관리자 권한이 있는 멤버만 접근
  가능한 메뉴입니다. 해당 멤버는 **문서 관리 권한이 있는 템플릿으로 작성된 모든 문서**를 조회할 수
  있습니다. (Note) 대표 관리자는 모든 문서를 조회하고 관리할 수 있습니다.」
  개인 문서함 3종은 「내가 작성 또는 처리한 문서」 기준이라 외부 URL 작성자 문서를 담지 못하지만,
  문서 관리만 **권한 기준**이라 담는다.
- **운영본 v6 의 문서 관리자 = `rayben@forcs.com`**(2026-09-15 지정, 소유자 겸 대표 관리자).
  🔴 엔트리 형태는 객체가 아니라 **계정 id 문자열**이다 — `auth.managers.members: ["rayben@forcs.com"]`.
  객체(`{id,name}` 등)를 실으면 저장이 `500 [5000001]` 로 죽는다.
  🔴 저장은 폼의 **`permissionAuth`**(JSON 문자열, `type:"form_permission"`)의 `managers.members` 에
  반영되고 **`auth.form_manager.members` 는 `[]` 로 남는다**(이 GET 이 채우지 않는 파생 뷰).
  `auth` 만 보고 "지정 없음"으로 판정하면 오판이다 — `kiosk verify-template` 게이트도 이 때문에
  지정 후에도 WARN 을 띄우고 있었고, 2026-09-15 `permissionAuth` 우선 읽기로 고쳤다.
  🔴 문서화된 `PATCH /v2.0/api/forms/{id}/permissions` 의 `modify.managers` 는 **수정 권한**에 붙는
  관리자 역할이라 문서 관리자 지정에 쓸 수 없다(`DOCUMENT_MANAGER` 추가는 200 + 부분 실패로 무시된다).
- **대표 관리자가 아닌 담당자**를 추가하려면 템플릿 쪽 지정만으로는 부족하다. 대표 관리자가
  회사 관리 > 권한 관리 > 문서 관리자에서 그 멤버를 추가하고 **관리 문서 조건**(작성자 + 문서 종류/템플릿)
  까지 설정해야 한다(매뉴얼 chapter2 「문서 관리자」). 상세는
  `evidence/final/decisions-applied-2026-09-15.md` §3.
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
전말과 경로 비교표: `D:\pjt\eformsign\docs
esearch\ozw-template-api-creation-feasibility-2026-09-11.md`.

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
| `designer-observe.mjs` | 🔴 **웹폼 디자이너 로드 관찰기**(CDP, 로그인된 실제 Chrome). `create_form.html?form_id=<id>&type=modify` 를 열어 네트워크 전수·콘솔·예외·전역 프로브를 JSON 으로 저장한다. 판정은 화면이 아니라 수치로: `__DesignerView__.m_pViewPageArray.length>=1` · `__DesignerFrame__.m_pCompManager.m_nCompCount==필드수`. 게이트 `ozw-designer-open` 의 증거 수집기 |
| `probe-load-race.mjs` | 🔴 「작성 화면이 뜨는 도중의 `iframe load` 를 제출로 오판」 회귀. 아무 입력 없이 열어 두고 `onSubmitted` 가 한 번이라도 찍히면 실패. `--inject <ms>` 로 결함 조건을 결정적으로 재현한다(수정 전 판 3/3 FAIL · 수정판 3/3 PASS 로 대조 확인). 정적 서버를 스스로 띄운다 |
| `probe-idle-reset.mjs` | 무응답 리셋 5케이스 실기 검증(프레임 포커스 유지 40초 무리셋 / 카운트다운→리셋 / 터치 취소 / 🔴 포커스 유지한 채 이탈해도 abandon 리셋이 오는지[2026-09-16] / 카운트다운 취소 후 타이머 재시작). `evidence/final/idle-*.png` + `idle-cases-report.json` 생성, 전부 PASS 면 exit 0 |

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

제출 오탐 레이스 회귀(같은 헤드리스 크롬, 대조군 10회 약 4분):

```bash
Q="company=<회사 ID>&template=<서식 ID>"
node tools/probe-load-race.mjs --root . --port 8112 --cdp 9233 --query "$Q" --rounds 10   # 대조군: FALSE_POSITIVE=0
node tools/probe-load-race.mjs --root . --port 8112 --cdp 9233 --query "$Q" --rounds 3 --inject 400   # 결함 조건 재현
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

## 계정 정리 이력 (2026-09-15)

키오스크 제작 과정에서 만든 구본·중간본 템플릿과 검증 문서를 사용자 승인으로 정리했다.
**운영 템플릿 v6 `31de7ab146d14f2bb923d7a94d7122e5` 와 실제 방문자 제출 문서는 그대로 두었다.**

- 삭제: 문서 33건 · 템플릿 6건(`380345bf`·`1ded2177`·`0c05c014`·`766a92a3`·`8a245fe9`·`9fb26e09`)
- 보류: 테스트 서명으로 단정할 수 없는 문서 6건과 그 소속 템플릿 2건(`e1fef806` v2 구본 · `e86be31e` v3 구본)
- 전수 목록·판정 근거·삭제 후 재조회 결과: `evidence/final/cleanup-2026-09-15.md`
  (`evidence/` 는 `.gitignore` 대상이라 이 파일 하나만 예외로 커밋해 감사 흔적을 남긴다)

🔴 `templates.delete` 는 500 을 돌려주고도 실제로는 삭제된 경우가 있다. 삭제 판정은
**삭제 후 fresh 재조회**로만 한다(이번에는 템플릿 목록 171 → 165, 대상 6종 잔존 0건으로 확인).

### 후속 결정 적용 (2026-09-15, 사용자 승인 "추천안대로")

- 보류 6건 중 **자음 나열 4건 삭제**(`22946aca`·`a9daa808`·`b324f2b2`·`7b6f619b`), 재조회 잔존 0.
- **실명 2건 보존**(`9fffd6a2` 백혁준 · `0dec68d3` 최현) + 승인 보존 3건 생존 확인.
- 구본 2종은 **소속 문서가 남아 삭제하지 않고** `[구본] ` 접두어만 붙였다(둘 다 재release 해 `is_release: true`).
  소속 문서 0건이 되는 구본은 이번에 없었다.
- 운영본 v6 를 **무변경 재저장**해 `update_date` 갱신 — 템플릿 165개 중 순위 2위 → **1위**.
- 운영본 v6 에 **문서 관리자 `rayben@forcs.com` 지정** → `kiosk verify-template` WARN 0건 · exit 0.
- 전후 상태·재조회 결과·부정 결과(객체 엔트리 500, permissions API 불가):
  `evidence/final/decisions-applied-2026-09-15.md`

🔴 `documents.delete` 는 `memberId` 를 **명시로 받아야** 한다 — 생략하면
`This API requires a member-scoped token` 으로 전건 실패한다(`templates` 쪽과 다르다).
