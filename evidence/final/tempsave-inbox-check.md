# 「처리할 문서함에 임시저장으로 들어갔다」 규명 (2026-09-11, 읽기 전용 조사)

## 판정 — H1

**키오스크 경로가 아니다.** 사용자가 준 URL 의 문서 `feb1718f…` 는 **로그인 멤버(rayben@forcs.com)가
직접 만든 임시저장 문서**이고, 템플릿 `6365dcf1…` 은 방명록이 아니라 **「타사전환_딜_플레이북 (3)」**
(영업 자료용 OZW 템플릿)이다. 키오스크 방명록 템플릿 `e1fef806…` 의 문서는 **17건 전부 「완료」**다.

결정 증거 한 줄:

| 문서 | creator.recipient_type | status_type | 단계 |
|---|---|---|---|
| `feb1718f…` (사용자가 본 것) | **`01` = 멤버**, id `rayben@forcs.com` | `001` (진행/임시저장) | 1 `시작(발송인)` |
| 방명록 키오스크 문서 (예 `f0724d30…`) | **`02` = 외부 작성자**, id 빈 값 | `003` (완료) | 완료 |

외부 URL 작성자가 만든 문서는 `recipient_type: "02"` 에 id 가 비어 있다. 이 문서는 `01` 이고 멤버 계정이
박혀 있으므로 **임베딩/공개 URL 경로로 만들어진 문서가 아니다.**

## 원문 증거

### 문서 `feb1718ff827453f82f5c6d0b617cf17` (`documents.list type:"04"` 원문)

```json
{
 "id": "feb1718ff827453f82f5c6d0b617cf17",
 "template": { "id": "6365dcf14e7b4265b4cbb98e7c7c4b8f", "name": "타사전환_딜_플레이북 (3)" },
 "document_name": "타사전환_딜_플레이북 (3)",
 "creator":     { "recipient_type": "01", "id": "rayben@forcs.com", "name": "test" },
 "created_date": 1789112137608,                      // 2026-09-11 07:35:37 UTC = 16:35 KST
 "last_editor": { "recipient_type": "01", "id": "rayben@forcs.com", "name": "test" },
 "updated_date": 1789112231399,                      // 07:37:11 UTC — 생성 94초 뒤 재저장
 "current_status": {
  "status_type": "001", "status_doc_type": "00", "status_doc_detail": "001",
  "step_type": "00", "step_index": "1", "step_name": "시작(발송인)",
  "step_recipients": [ { "recipient_type": "01", "id": "rayben@forcs.com", "name": "test" } ],
  "step_group": 1, "expired_date": 0, "_expired": false
 },
 "fields": [], "next_status": [], "previous_status": [], "histories": [], "recipients": []
}
```

⚠️ `histories` 는 목록 API 에서 **빈 배열로 온다**(상세 이벤트 로그 아님). 대신 `created_date` /
`updated_date` / `last_editor` / `current_status.step_recipients` 로 주체·시각을 확정했다.
`SDK documents.get({documentId})` 는 이 문서에 대해 **HTTP 400(Tomcat 기본 에러 페이지)** 을 돌려주어
쓰지 못했다 — 진행 중(임시저장) 문서에는 맞지 않는 엔드포인트로 보인다(미확인).

### 템플릿 `6365dcf14e7b4265b4cbb98e7c7c4b8f`

| 항목 | 값 |
|---|---|
| 이름 | 타사전환_딜_플레이북 (3) |
| 생성 / 수정 | 2026-09-11 07:33:31 UTC (둘 다 동일 = 생성 후 무수정) |
| 생성자 / 소유자 | test (rayben@forcs.com) |
| 양식 파일 | **OZW** `149f2d6f…` (`alias: 타사전환_딜_플레이북 (3).ozw`) |
| 단계 | `1:write(시작(발송인))` → `2:complete(완료)` — **2단계** |
| `auth.form_external_user.use_external_users` | **true** (URL로 문서 생성 허용 ON) |
| `use_recaptcha` | **false** |
| `config.notification` | 채워져 있음(정상) |
| `display_settings` | 12행 |
| step1 `doc_default_title` | **빈 값** |
| `input_control_option` (step1) | 3개 |
| `is_release` | true |

문서는 템플릿 생성 **2분 6초 뒤**에 만들어졌다(07:33:31 → 07:35:37). 즉 이 템플릿을 만든 직후
콘솔에서 바로 열어 본 흐름과 일치한다.

### 방명록 템플릿 `e1fef806750248d5993c2ecee84e9502` 대비 diff

| 항목 | `6365dcf1` 딜플레이북 | `e1fef806` 방명록 v2 |
|---|---|---|
| 양식 파일 | OZW | OZR (`guestbook.ozr`) |
| 생성 / 수정 | 07:33:31 / 07:33:31 | 05:21:46 / 06:18:21 |
| 단계 이름 | 시작(**발송인**) → 완료 | 시작 → 완료 |
| 단계 수 | 2 | 2 (동일) |
| `use_external_users` | true | true (동일) |
| `use_recaptcha` | false | false (동일) |
| `use_overlap_check` / `use_domains` / `use_auth_number_at_link` | 전부 false | 전부 false (동일) |
| `config.notification` | 있음 | 있음 (동일, 둘 다 건강) |
| `display_settings` | 12행 | 17행 |
| step1 `doc_default_title` | `""` | `방문자 기록부(방명록)__{{방문일시}}__{{방문자성명}}__{{소속}}` |
| step1 입력 컨트롤 | 3 | 8 |
| step2 `alert_option.mail.sending_points` | `complete_document` 1건(있음) | **0건(비어 있음)** |
| `pdf_send` | null | null (동일) |
| `is_release` | true | true (동일) |

→ **키오스크 제출 가능 조건(URL 생성 허용·notification·release)은 두 템플릿 모두 충족**한다.
문제는 설정이 아니라 **어떤 템플릿을 어떤 신분으로 열었는가**였다.

## 가설별 판정

| 가설 | 판정 | 근거 |
|---|---|---|
| **H1 멤버가 로그인 브라우저에서 열어 임시저장** | ✅ **채택** | `creator`/`last_editor` 모두 `recipient_type:"01"` + `rayben@forcs.com`. URL 이 `view_service.html`(멤버용)이고 `request_type=doc_tempsave`. 템플릿 생성 2분 뒤 생성 |
| H2 3단계 워크플로의 참여자 단계에 걸림 | ❌ 기각 | `6365dcf1` 은 `write>complete` **2단계**. 참여자 단계 자체가 없다 |
| H3 키오스크로 이 템플릿을 열었는데 임시저장으로 끝남 | ❌ 기각 | 키오스크 `config.js` 의 `templateId` 는 `e1fef806…`. 그 템플릿 문서 17건은 **전부 완료**이고, 문제의 07:35 이후에도 07:47·07:50 에 정상 완료 2건이 더 생성됐다. 외부 작성자 문서라면 `recipient_type:"02"` 여야 하는데 `01` 이다 → **재현 시도 불필요·미실시**(문서 1건을 더 만들 이유가 없어 생략) |
| H4 방문자 화면의 「임시저장」 버튼 | ❌ 이 건의 원인 아님 | 이 문서는 방문자 화면에서 만들어지지 않았다. 외부 작성자 화면에 임시저장 계열 버튼이 있는지 자체는 **이번에 확인하지 않음**(불필요) |

## 이 템플릿으로 만들어진 문서 전수

`node tools/list-docs.mjs 6365dcf1… --type 01|02|04`

| type | 건수 | 내용 |
|---|---|---|
| `01` (내 문서함) | 0건 | — |
| `02` (회사 전체) | 1건 | `2026-09-11 07:35:37 UTC` / 상태 `시작(발송인)` / `feb1718f…` / 「타사전환_딜_플레이북 (3)」 |
| `04` (템플릿별) | 1건 | 동일 1건 |

즉 **이 템플릿의 문서는 그 한 건뿐**이다.

참고 — 방명록 템플릿 `e1fef806…` (`--type 04`) 은 17건 **전부 「완료」**:
05:29:49 / 05:31:20 / 05:31:58 / 05:32:45 / 05:33:26 / 05:45:51 / 05:46:23 / 05:47:12 / 06:06:10 /
06:18:52 / 06:22:31 / 06:50:03 / 06:54:26 / 07:01:14 / 07:14:18 / **07:47:22** / **07:50:18** (UTC).
뒤 2건은 문제의 07:35 임시저장보다 **나중**이라, 그 시점 이후에도 키오스크 제출이 정상이었음을 보인다.

## 사용자가 취할 조치

1. **아무것도 고칠 필요가 없다.** 키오스크(`e1fef806…`)는 정상이고, 문제의 문서는 다른 템플릿의
   개인 임시저장본이다. 「처리할 문서함」의 그 항목은 **직접 삭제하거나 이어서 작성**하면 된다
   (이번 조사에서는 삭제하지 않았다).
2. 「타사전환_딜_플레이북 (3)」 템플릿을 **키오스크로 쓸 생각이었다면** `config.js` 의
   `templateId` 를 그 id 로 바꾸고, 방문자는 **반드시 로그인하지 않은 브라우저**(또는 키오스크
   래퍼의 임베딩 화면)로 열어야 한다. 로그인된 브라우저로 공개 URL 을 열면 멤버 작성으로 잡힌다.
3. 🔴 **두 템플릿 모두 `use_recaptcha: false`** 다. 공개 URL 이 새면 봇이 문서를 대량 생성해
   요금이 청구된다(README 제약 3). 운영 전에 켜라: `tools/set-recaptcha.mjs --form <id> --on --ext on`.
4. 방명록 템플릿의 **완료 단계 메일 알림(`step2.alert_option.mail.sending_points`)이 0건**이다.
   완료 PDF 메일을 받고 싶으면 콘솔에서 완료 단계 알림을 켜라(이번 조사는 읽기 전용이라 손대지 않음).

## 미확인

- 문서 `histories` 상세(누가 언제 임시저장을 눌렀는지의 이벤트 로그)는 목록 API 로 회수되지 않았다.
  `documents.get` 은 이 진행 중 문서에 400 을 준다. 콘솔 문서 상세의 「처리 이력」으로만 볼 수 있을 것으로 보인다(미검증).
- 외부 작성자 화면에 임시저장 계열 버튼이 존재하는지(H4 자체)는 확인하지 않았다.
- 「타사전환_딜_플레이북 (3)」 의 복제 출처(clone lineage)는 config 에 lineage 필드가 없어 확인 불가.
  이름의 `(3)` 접미로 콘솔 복사본임을 추정할 뿐이다.

---
조사 방법: `tools/dump-form.mjs`(템플릿 config 전문), `tools/list-docs.mjs --type 01|02|04`,
`documents.list({type:'04', templateIds})` 원문. **설정 변경·문서 삭제 없음. 문서 신규 생성 없음.**
