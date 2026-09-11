# 방명록 문서가 어느 문서함에 들어가는가 — 실기 판정 (2026-09-11)

대상 템플릿: **`e1fef806750248d5993c2ecee84e9502`** 「방문자 기록부(방명록) v2」 (`write > complete` 2단계, `is_release: true`)
대상 문서: **`49965ace58394fbbb45a1005be8e3c99`** 「방문자 기록부(방명록)__2026-09-11__버셀제출테스트__포시에스」

## 1. 배포 페이지에서 실제 제출

`https://eformsign-kiosk-guestbook.vercel.app/?idle=0&mode=immediate` 를 헤드리스 Chrome 768×1024 으로 열어
성명 `버셀제출테스트` · 소속 `포시에스` · 연락처 `010-0000-0000` · 방문 목적 `회의` · 담당자 `김담당` ·
개인정보 동의 체크 · 서명 패드 그리기까지 마치고 전송했다. reCAPTCHA 는 현재 OFF(`use_recaptcha: false`)라
전송 확인 팝업에 체크 항목이 없었고, 제출 성공 콜백이 `document_id`를 돌려주었다.

```
DOCS=["49965ace58394fbbb45a1005be8e3c99"]
```

증거: `evidence/final/vercel-submit-00-loaded.png` … `vercel-submit-06-after.png`,
`evidence/final/vercel-submit-docs.json`. 실행 스크립트는 `.work/submit-vercel.mjs`.

🔴 **함정** — URL 에 `debug=1` 을 붙이면 우하단 디버그 로그 패널이 작성 프레임 위를 덮어
「만나는 담당자」·서명 영역 클릭을 가로챈다. 1차 시도가 이것 때문에 전송까지 가지 못했다.
좌표 기반 자동 제출 검증에는 `debug=1` 을 쓰지 않는다.

## 2. type 코드 ↔ 문서함 대응 (실측으로 확정)

`documents.list` 의 `type` 을 01~04 로 바꿔 가며 **전수 스캔**(`limit=100` + `skip` 증가)하고
이 문서가 잡히는지 확인했다. 스크립트 `.work/scan-types.mjs`.

```
type=01 | total_rows=36  | 방명록 템플릿 0건 | TARGET NOT FOUND
type=02 | total_rows=87  | 방명록 템플릿 0건 | TARGET NOT FOUND
type=03 | total_rows=152 | 방명록 템플릿 0건 | TARGET NOT FOUND
type=04 | total_rows=280 | 방명록 템플릿 19건 | TARGET FOUND (완료)
```

| `type` | API 명세의 이름 | 콘솔 화면 | 이 문서 | 근거 |
|---|---|---|---|---|
| `01` | 진행 중 | **진행 중 문서함** | ✗ | API 가이드 Box type 표 (`api-webhook-sections.md:846`) |
| `02` | 처리 할 | **처리할 문서함** | ✗ | 〃 |
| `03` | 완료 | **완료 문서함** | ✗ | 〃 |
| `04` | 문서 목록 | **문서 관리**(문서 관리자·대표 관리자 전용) | **✓ 완료** | 〃 + 실측 |

🔴 **README 와 API 팩 claims 에 적혀 있던 「`02`=회사 전체 문서 / `04`=템플릿별 문서」는 틀렸다.**
`02` 는 회사 전체가 아니라 개인의 **처리할 문서함**이고, `04` 가 관리자용 **문서 관리**다.
`04` 에 `template_ids` 필터를 걸 수 있어서 "템플릿별"처럼 보였을 뿐이다.

🔴 **`tools/list-docs.mjs` 페이징 버그** — SDK 는 `limit`/`skip` 을 받는데 스크립트는 `pageSize`/`page` 를 넘겨
둘 다 무시되고 **항상 기본값(limit 20, skip 0)** 으로만 조회된다. `수신 20건` 이 그 증상이다.
문서가 20건을 넘으면 판정이 틀어지므로 `.work/scan-types.mjs` 처럼 `limit`/`skip` 을 써야 한다.

### 문서 상세 (`documents.get`)

```json
"creator":      { "recipient_type": "02", "id": "" },
"last_editor":  { "recipient_type": "02", "id": "" },
"current_status": { "status_type": "003", "step_type": "01", "step_index": "2",
                    "step_name": "완료", "step_recipients": [], "step_group": 2 },
"previous_status": [ { "step_type": "00", "step_name": "시작", "action_type": "002",
                       "executor": { "id": "" } } ],
"histories": [], "recipients": []
```

`recipient_type: "02"` = 외부 수신자(멤버는 `"01"`). **작성자·처리자·수신자에 회사 멤버가 한 명도 없다.**

## 3. 완료 문서함에 안 보이는 원인

매뉴얼 chapter8 「기본 문서함」이 세 문서함을 **사람 기준**으로 정의한다.

> - 처리할 문서함: 임시 저장한 문서(초안), **내가 처리해야 할 문서**(다른 멤버가 나에게 작성 요청한 문서), 또는 멤버가 아닌 수신자에게 보낸 문서 중 문서 기한이 지나 재요청이 필요한 문서 목록을 확인할 수 있습니다.
> - 진행 중 문서함: **내가 작성 또는 처리한 문서** 중 완료되지 않은 문서 목록을 확인할 수 있습니다.
> - **완료 문서함: 내가 작성한 문서 중 완료된 문서** 목록을 확인할 수 있습니다.

세 문서함 모두 **"나"(로그인한 멤버)가 작성했거나 처리한 문서**만 담는다.
방명록 문서의 작성자는 로그인하지 않은 외부 방문자(`recipient_type: "02"`, `id: ""`)이고
워크플로가 `시작(외부 방문자) → 완료` 2단계라 **중간에 멤버가 개입하는 단계가 아예 없다.**
그래서 어떤 멤버 계정으로 봐도 개인 문서함 세 개 중 어디에도 잡히지 않는다.

반대로 관리자용 문서함은 **권한 기준**이다.

> - 문서 관리: 문서 관리자 권한이 있는 멤버만 접근 가능한 메뉴입니다. 해당 멤버는 **문서 관리 권한이 있는 템플릿으로 작성된 모든 문서**를 조회할 수 있습니다.
> (Note) 대표 관리자는 모든 문서를 조회하고 관리할 수 있습니다.

"내가 작성한" 이 아니라 "이 템플릿으로 작성된 모든 문서"이므로 여기에는 잡힌다 — 실측 `type: "04"` 결과와 일치한다.

**판정: 결함이 아니라 제품의 문서함 분류 규칙대로 동작한 것이다.** 외부 URL 작성자 문서를 담당자의
개인 완료 문서함에서 보려면 워크플로나 공유 설정을 바꿔야 하고, 그대로 둘 거면 문서 관리 화면을 봐야 한다.

### 완료 알림도 지금은 아무에게도 가지 않는다

템플릿 `config.notification.processing_status.mail.sending_points` 의 `complete_document`:

```json
{ "sending_point": "complete_document", "mail_template": "96ce8774a986afe2b8aeadd4fcbae05d",
  "is_first_writer": true, "is_step_recipients": false, "is_attach_pdf": true }
```

매뉴얼 chapter5 「알림 설정」:

> 최초 작성자 옵션에 체크, 단계별 처리자 옵션 체크 해제 시, **문서를 최초 작성한 사람에게** 상태 알림을 전송합니다.

이 템플릿의 최초 작성자는 **메일 주소를 남기지 않는 외부 방문자**다(시작 단계에 「작성자 정보 입력」
`use_external_creators_info: false`). 단계별 처리자도 없다(`step_recipients: []`).
따라서 완료 메일의 수신자 후보가 비어 있다.
🔴 README 의 "실제 수신자는 템플릿 소유자다"는 **근거 없는 서술이다** — 매뉴얼의 상태 알림 수신자 선택지는
「최초 작성자」와 「단계별 처리자」뿐이고 "소유자"라는 선택지가 없다.
(메일함을 직접 확인한 것은 아니므로 "설정상 수신자가 없다"까지가 확정 범위다.)

## 4. 템플릿 완료 단계 현재 설정

`.work/dump/e1fef806750248d5993c2ecee84e9502.json` 에서 발췌.

| 항목 | 현재 값 |
|---|---|
| 워크플로 | `1:write(시작)` → `2:complete(완료)` — 2단계, 중간 멤버 단계 없음 |
| 완료 단계 `option` | `use_tsa:false`, `use_dropbox:false`, `use_cloud_storages:[]`, `use_hana_ceda:false`, `use_attach_link:true` |
| 완료 단계 열람자/수신자 | **없음** (완료 단계는 수신자를 갖지 않는 단계다) |
| 완료 단계 `alert_option` | `mail.use:false`, `sms.use:false` |
| `notification.complete_document` | `is_first_writer:true`, `is_step_recipients:false`, `is_attach_pdf:true` |
| `notification.complete_outsider_document` | `is_first_writer:false`, `is_step_recipients:true`, `is_attach_pdf:true` |
| 시작 단계 외부 설정 | `use_external_users:true`, `use_recaptcha:false`, `use_external_creators_info:false`, `use_overlap_check:false` |
| 템플릿 소유자 | `rayben@forcs.com` |
| 문서 관리자 (`auth.form_manager.members`) | **`[]` — 지정된 사람 없음** |
| 템플릿 사용 멤버 (`auth.form_member`) | `members:[]`, `groups:[]`, `allow_all_members:false` |

즉 지금은 **대표 관리자만** 문서 관리 화면에서 이 문서를 볼 수 있다.

## 5. 해법 후보 (적용하지 않음 — 사용자 결정 사항)

### (a) 완료 전에 담당자를 **열람자** 단계로 넣는다
- 매뉴얼 chapter5 「열람자」: 멤버를 수신자로 지정할 수 있고, 「문서 전송 옵션」으로
  *열람해야 다음 단계로 전송* / *열람 여부와 무관하게 바로 전송* 중 고를 수 있다.
- **완료 문서함 노출은 매뉴얼 근거로 보장되지 않는다.** 완료 문서함의 정의가
  「내가 **작성한** 문서 중 완료된 문서」이고 열람자는 작성자가 아니기 때문이다.
  열람자 단계에 있는 동안은 「처리할 문서함」에 잡히는 것이 자연스럽지만,
  완료된 뒤에도 그 멤버의 완료 문서함에 남는지는 **실기로 확인해야 하는 미검증 항목**이다.
- 부작용: 워크플로가 3단계가 되고, *열람해야 전송* 옵션을 고르면 담당자가 열 때까지 문서가 완료되지 않는다.
  담당자에게 건마다 열람 요청 메일이 간다.

### (b) 완료 알림 메일 수신자를 지정한다
- 매뉴얼상 선택지는 「최초 작성자」와 「단계별 처리자」뿐이다.
  최초 작성자 = 메일 없는 외부 방문자이므로 (a)처럼 **멤버 단계를 워크플로에 넣지 않으면
  지정할 수신자 자체가 생기지 않는다.** 단독으로는 성립하지 않고 (a)에 딸린 설정이다.
- 매뉴얼 chapter5: 「❗외부 수신자에게는 문서 최종 완료 알림만 전송됩니다. … 단계별 처리자를
  멤버 외 수신자 또는 모두로 설정해 주세요.」 — 이 문장도 *수신자가 존재할 때* 의 이야기다.
- 알림은 "문서가 왔다"를 알릴 뿐 문서함 노출을 만들지는 않는다.

### (c) 운영 안내를 **문서 관리 화면** 기준으로 바꾼다
- **유일하게 매뉴얼 근거가 확정적이고 실측으로도 확인된 경로다**(`type: "04"` = 문서 관리).
- 담당자가 볼 수 있게 하려면 **그 멤버를 이 템플릿의 문서 관리자로 지정**해야 한다
  (지금 `auth.form_manager.members` 가 비어 있어 대표 관리자만 보인다).
  매뉴얼: 「문서 관리자 설정은 대표 관리자가 회사 관리 > 권한 관리 메뉴에서」.
- 워크플로를 건드리지 않으므로 키오스크 동작(제출 즉시 완료 → 새 작성 화면)이 그대로 유지된다.

### (d) 공유 문서함 **자동 공유 규칙** (추가 후보)
- 매뉴얼 chapter8 「공유 문서함」: 「문서 종류: 공유하고자 하는 템플릿 이름을 선택하면
  **해당 템플릿으로 문서 작성 시 공유 문서함에 자동으로 공유됩니다.**」
- 담당자들이 접근 권한을 가진 공유 문서함 하나를 만들고 방명록 템플릿을 자동 공유 대상으로 걸면
  워크플로를 바꾸지 않고도 담당자의 **개인 사이드바(공유 문서함)** 에서 목록을 볼 수 있다.
- 🔴 **미검증**: 매뉴얼의 자동 공유 설명은 멤버가 소유한 문서를 전제로 읽히는데,
  이 문서는 소유자가 외부 작성자다. 외부 URL 작성 문서에도 규칙이 걸리는지는 실기 확인이 필요하다.

### 권장
**(c) 를 확정 경로로 삼고, (d) 를 실기 검증해 성공하면 (d) 로 승격한다.**
(a)+(b) 는 담당자가 건마다 메일을 받고 확인해야 하는 운영을 원할 때만 쓴다 —
키오스크의 "제출하면 곧바로 다음 방문자 화면" 흐름과 3단계 워크플로가 잘 맞지 않는다.

## 검증 재현

```bash
chrome --headless=new --remote-debugging-port=9241 --remote-allow-origins=* \
  --user-data-dir=<임시 프로필> --window-size=768,1024 about:blank
node .work/submit-vercel.mjs --port 9241          # 실제 1건 제출 (debug=1 금지)
node --env-file=D:/pjt/eformsign/eformsign-core/.env .work/scan-types.mjs <document_id>
node --env-file=D:/pjt/eformsign/eformsign-core/.env tools/dump-form.mjs \
  e1fef806750248d5993c2ecee84e9502 --out .work/dump
```
