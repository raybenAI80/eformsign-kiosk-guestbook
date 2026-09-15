# 사용자 승인분 3건 적용 — 2026-09-15

`cleanup-2026-09-15.md` §7 의 후속 결정 요청에 사용자가 "추천안대로 해줘"로 답한 3건을 적용한 기록이다.
불변 조건(변경 금지): reCAPTCHA OFF · 문서 제목 규칙
`$$current_datetime$$_방문자 기록부(방명록)__{{방문자성명}}__{{소속}}` · URL로 문서 생성 허용 ON · 감사화면 5초.

조회·저장 시각은 UTC. KST = +9h.

---

## 1. 운영본 v6 를 목록 맨 위로

`31de7ab146d14f2bb923d7a94d7122e5` 「방문자 기록부(방명록) v6 OZW」를 **내용 변경 없이** 재저장해
`update_date` 만 갱신했다. 저장 경로는 `tools/promote-template.mjs` · `.work/set-title.mjs` 와 동일하다
(`POST /v1.0/companies/{cid}/members/{member}/forms/{formId}` multipart + `auth` 를 create-shape 로 재적재).

### 전후 순위 (`.work/tpl-rank.mjs`, 전체 165개 템플릿)

| | update_date 1위 | 2위 | 3위 | v6 순위 |
|---|---|---|---|---|
| **전** | e86be31e v3 구본 `01:13:58` | **31de7ab1 v6** `01:09:55` | e1fef806 v2 구본 `09-11 08:42:51` | **2 / 165** |
| **후** | **31de7ab1 v6** `02:18:35` | e86be31e `[구본] v3` `02:16:52` | e1fef806 `[구본] v2` `02:16:44` | **1 / 165** |

🔴 순서 주의 — 구본 2종을 먼저 개명(§2)하고 v6 를 **마지막에** 저장했다. 반대로 하면 구본 개명이
v6 보다 나중 `update_date` 를 받아 목록에서 도로 위로 올라간다.

### 무변경 증명 (저장 전후 GET 스냅샷 깊은 비교, `.work/resave-v6.mjs`)

```
diff_total 3 | 무시 2 | 실질 1
  무시: version "2" -> "3"
  무시: update_date 1789434595802 -> 1789438649049
  실질: id "06a3bd6a…" -> "3aac4b53…"   ← 폼 리비전 id (form_id 는 그대로)
```

`is_release` 는 `true → (저장) false → (재release) true`. 🔴 **저장만으로 release 가 내려간다**는
기존 함정이 이번에도 그대로 재현됐다 — 개명·설정 변경 어느 쪽이든 저장 후 release 재요청은 필수다.

작업 전체(§1~§3, 프로브 포함)가 끝난 뒤 최초 스냅샷 `.work/dump2/v6-before.json` 과 다시 비교했을 때도
실질 차이는 §3 의 문서 관리자 지정 1건뿐이었다 — reCAPTCHA·제목 규칙·URL 허용·notification·
display_settings·워크플로 전부 무변경.

---

## 2. 보류 문서 6건과 구본 템플릿 2종

### 2.1 삭제 — 자음 나열 4건

`documents.delete({documentIds:[id], memberId})` 개별 호출. 보존·보류 5건을 `PROTECT` 집합에 넣어
대상에 섞이면 실행 전 `exit 1` 하도록 방어했다(충돌 0건). 스크립트 `.work/del-docs-decisions.mjs`.

| 문서 ID | 문서명 | 결과 |
|---|---|---|
| `22946acad9b04167a4e31a57c9ca32cd` | …__ㅌㅊㅍ__ㅌㅊㅍ | OK |
| `a9daa80862904793b3e0f89e3fd9ca4d` | …__ㄴㄴ__ㄴ | OK |
| `b324f2b29ab54452bac6ca1e33b4ab8d` | …__ㄴㅇㄹ__ㄴㅇㄹ | OK |
| `7b6f619b60c8424b897dbc72a94b5c5a` | 2026-09-11 오후 05:16_…__ㄴㅇㄹ__ㄴㅇㄹ | OK |

🔴 첫 시도는 `This API requires a member-scoped token` 으로 4건 전부 실패했다 —
`documents.delete` 는 `memberId` 를 **명시로 받아야** 하고 `.env` 의 `EFORMSIGN_DEFAULT_MEMBER_ID` 를
자동으로 쓰지 않는다(`templates` 쪽과 다르다).

### 2.2 재조회 판정 (fresh, `.work/doc-map.mjs` — 500 함정 대비)

```
삭제 전 9건  →  삭제 후 5건
삭제 대상 4건 grep  →  0  (잔존 0)
```

보존 5건 전부 생존:

| 템플릿 | 문서 ID | 문서명 | 구분 |
|---|---|---|---|
| e1fef806 | `3797248806c8464f8e09cb07f4822ccd` | …__이재혁__클본 | 승인 보존 |
| e1fef806 | `d1cc210f0b94416bb8cf90a28426041c` | …__2332__2323 | 승인 보존 |
| e1fef806 | `29439d7b5e244f6d8a7d1dc805bb29ad` | …__노은우__ㅇㅇ | 승인 보존 |
| e1fef806 | `9fffd6a2c6594f3f8690ae9f4fa0fbca` | …__백혁준__CB | 실명 보존 |
| e86be31e | `0dec68d3de634032b51af29cbbccdfb5` | …__2026-09-14__최현__포시에스 | 실명 보존 |

### 2.3 구본 템플릿 — 둘 다 삭제하지 않고 접두어만

삭제 직전 재조회로 소속 문서를 확정했다.

| 구본 템플릿 | 삭제 후 소속 문서 | 판정 | 조치 |
|---|---|---|---|
| `e1fef806750248d5993c2ecee84e9502` v2 OZR 구본 | **4건**(승인 보존 3 + 백혁준) | 0건 아님 → **삭제 금지** | `[구본] ` 접두어 |
| `e86be31eb2e3485184b94d3d58540095` v3 OZW 구본(VT 결함) | **1건**(최현) | 0건 아님 → **삭제 금지** | `[구본] ` 접두어 |

소속 문서가 0건이 되는 구본은 **하나도 없었다** — 따라서 이번 작업에서 삭제한 템플릿은 0건이다.
(0건짜리 구본 4종은 이미 `cleanup-2026-09-15.md` §4 에서 삭제했다.)

개명은 `name` 과 `abbreviation` 둘 다 앞에 `[구본] ` 을 붙였다(둘이 같은 값이던 기존 관례 유지).
스크립트 `.work/rename-tpl.mjs` — 이미 접두어가 붙어 있으면 저장하지 않는 멱등 처리.

| 템플릿 | 개명 후 이름 | is_release 전 → 저장 후 → 최종 |
|---|---|---|
| e1fef806 | `[구본] 방문자 기록부(방명록) v2 OZR 구본` | true → false → **true** (재release) |
| e86be31e | `[구본] 방문자 기록부(방명록) v3 OZW 구본(VT 결함)` | true → false → **true** (재release) |

둘 다 개명 후 GET 에서 `use_recaptcha:false` · `use_external_users:true` · 제목 규칙 불변을 확인했다.

---

## 3. 문서 관리자 지정 — 성공, 단 저장 위치가 `auth` 가 아니다

v6 의 문서 관리자로 소유자 **`rayben@forcs.com`** 을 지정했다(멤버 id 는 `members.list` 로 확인 —
이 회사의 멤버는 1명, `role: admin/document_manager/company_manager/template_manager/member`).

### 3.1 🔴 엔트리 형태 = **계정 id 문자열**. 객체를 실으면 저장이 500 이다

`auth.managers.members` 에 객체를 실은 저장은 예외 없이 `HTTP 500 [5000001] Internal server error` 였다.
5가지 형태를 시도했고 전부 같은 결과다(모두 저장 실패이므로 서버 상태는 변하지 않았다).

```
{id,name} · {id,name,department,position} · {account_id,id,name} · {id} · {member_id}   → 500 (5종 전부)
"rayben@forcs.com"  (계정 id 문자열)                                                     → 200, 반영됨
```

### 3.2 🔴 반영은 `permissionAuth` 로 들어가고 `auth.form_manager` 는 `[]` 로 남는다

문자열로 저장한 직후 GET 을 보고 **처음에는 "조용히 무시됐다"고 잘못 판단했다.** `auth.form_manager.members`
가 여전히 `[]` 였기 때문이다. 작업 전 스냅샷과 폼 전체를 깊은 비교하고 나서야 실제 반영 위치가 드러났다.

```
auth.form_manager.members  = []                                            ← 이 GET 이 채우지 않는 파생 뷰
permissionAuth.managers    = {"groups":[],"members":["rayben@forcs.com"],"roles":[]}   ← 실제 권한 레코드
```

`permissionAuth` 는 폼 응답에 JSON 문자열로 실려 오는 `type:"form_permission"` 레코드다
(`_id` · `owner_id` · `form_id` · `last_form_id` · `release_form_id` + `managers`/`members`/
`external_users`/`modify_members`). create-shape 의 `managers` → 여기의 `managers` 로 들어간다.
**`auth` 만 보면 지정이 끝난 템플릿도 "없음"으로 오판한다.**

### 3.3 게이트 수정 (시스템화)

SDK `verifyKioskTemplateReadiness` 가 `form.auth.form_manager.members` 만 읽고 있어서 지정 후에도
WARN 이 그대로였다. `permissionAuth.managers.members` 를 **우선** 읽고 없을 때만 `auth` 로 폴백하도록 고쳤다
(`eformsign-core/src/resources/templates.ts`, 파싱 실패는 "지정 없음"과 같게 처리). CLI·MCP 는 이 SDK 를
그대로 쓰므로 세 표면이 한 번에 고쳐진다.

### 3.4 검증 (fresh)

```
$ node --env-file=.../.env D:/pjt/eformsign/eformsign-cli/dist/cli.js kiosk verify-template 31de7ab146d14f2bb923d7a94d7122e5
  [OK  ] 워크플로 write → complete — 단계 2개 [write > complete]
  [OK  ] URL로 문서 생성 허용 — ON
  [OK  ] config.notification 채워짐 — 키 4종 · mail sending_points 7건
  [OK  ] display_settings 필드 행 — 필드 8행 · 시스템 9행
  [OK  ] 릴리스 상태 — is_release: true
  [OK  ] 문서 관리자 지정 — 1명            ← 수정 전에는 [WARN] 없음
  [OK  ] 문서 제목 규칙 — $$current_datetime$$_방문자 기록부(방명록)__{{방문자성명}}__{{소속}}
판정: 키오스크 운영 가능 (fail 0건)
EXIT=0
```

**WARN 0건 · exit 0.** (수정 전에도 exit 는 0 이었다 — 문서 관리자 항목은 `warn` 등급이라 종료 코드를
좌우하지 않는다. 바뀐 것은 WARN 소멸이다.)

### 3.5 문서 관리 화면에서 보인다는 근거

매뉴얼 chapter8 「문서 관리/일괄 작성 문서 관리」:

> - 문서 관리: 문서 관리자 권한이 있는 멤버만 접근 가능한 메뉴입니다. 해당 멤버는 **문서 관리 권한이 있는
>   템플릿으로 작성된 모든 문서**를 조회할 수 있습니다.
> (Note) 대표 관리자는 모든 문서를 조회하고 관리할 수 있습니다.

개인 문서함 3종(처리할·진행 중·완료)은 「내가 작성 또는 처리한 문서」 기준이라 외부 URL 작성자 문서는
어디에도 안 잡힌다(실측·근거는 `inbox-classification-check.md`). 문서 관리만 권한 기준이라 잡힌다.

🔴 **부연 — 이번 지정의 실효 범위**: `rayben@forcs.com` 은 이미 `admin`(대표 관리자)이라
지정 전에도 모든 문서를 볼 수 있었다. 이번 지정으로 새로 보이게 된 문서는 없다.
의미가 생기는 것은 **대표 관리자가 아닌 담당자를 추가할 때**이고, 그때는 매뉴얼 chapter2 「문서 관리자」의
회사 관리 > 권한 관리 경로에서 **관리 문서 조건(작성자 + 문서 종류/템플릿)** 까지 설정해야 한다 —
API 로 `managers.members` 에 계정 id 를 넣는 것은 템플릿 쪽 지정이고, 멤버에게 문서 관리자 **역할**을
주는 것은 별개다(`PATCH /v2.0/api/members/{id}` 의 `account.role` 에 `document_manager` 는 없다).

### 3.6 부정 결과 — `PATCH /v2.0/api/forms/{id}/permissions` 로는 안 된다

문서화된 권한 API 로 `{"use_all_members":false,"modify":{"managers":{"add":["DOCUMENT_MANAGER"]}}}` 를
보냈더니 **HTTP 200 + 부분 실패**였다.

```
error.details: [["DOCUMENT_MANAGER"]]
message: "The member, group, or manager either does not exist or does not have template creation permission."
→ auth.form_member / form_manager / form_modify_member 전부 무변경
```

이 API 의 `modify.managers` 는 **수정 권한**에 붙는 관리자 역할이지 문서 관리자(`form_manager`)가 아니다.
문서 관리자 지정 경로로 다시 시도할 것 없다.

---

## 4. 적용 순서 (재현용)

```bash
E=D:/pjt/eformsign/eformsign-core/.env
cd D:/pjt/eformsign/kiosk-guestbook

node --env-file=$E .work/tpl-rank.mjs                       # 전 상태
node --env-file=$E .work/doc-map.mjs <v6> <e1fef806> <e86be31e>

node --env-file=$E .work/del-docs-decisions.mjs             # ② 문서 4건
node --env-file=$E .work/doc-map.mjs <…>                    #    재조회 잔존 0

node --env-file=$E .work/rename-tpl.mjs --form e1fef806… --prefix "[구본] "
node --env-file=$E .work/rename-tpl.mjs --form e86be31e… --prefix "[구본] "

node --env-file=$E .work/resave-v6.mjs 31de7ab1…            # ① 무변경 재저장 (구본 개명 뒤에)
node --env-file=$E .work/set-manager.mjs --form 31de7ab1… --shape string   # ③ 문자열 엔트리

node --env-file=$E D:/pjt/eformsign/eformsign-cli/dist/cli.js kiosk verify-template 31de7ab1…
node --env-file=$E .work/tpl-rank.mjs                       # 후 상태
```

## 5. 남은 것

- 보류 문서 **2건은 실명이라 그대로 보존**(`9fffd6a2` 백혁준 · `0dec68d3` 최현). 이 둘이 실제 방문 기록이
  아니라고 확인되면 그때 지우고, 그러면 `e1fef806`·`e86be31e` 도 소속 0건이 되어 삭제 대상이 된다.
- v6 소속 문서는 여전히 **0건**이다. 다음 방문자 제출이 첫 실기록이 된다.
- 로컬: 이번에 쓴 조회·적용 스크립트는 `.work/` 에 남겼다(`.gitignore` 대상). 재현 절차는 §4.
