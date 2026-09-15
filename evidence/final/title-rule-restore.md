# 문서 제목 규칙 복원 — v3 운영본 (2026-09-15)

## 무엇을 고쳤나
운영 템플릿 `e86be31eb2e3485184b94d3d58540095`(방문자 기록부(방명록) v3 OZW)의
`config.step_settings[0].option.doc_default_title` 이 승격 과정에서 옛 값으로 설정돼 있었다.
사용자가 콘솔에서 정한 최신 값(구본 `e1fef806750248d5993c2ecee84e9502` 에 남아 있던 값)으로 되돌렸다.

| | 값 |
|---|---|
| 변경 전(v3) | `방문자 기록부(방명록)__{{방문일시}}__{{방문자성명}}__{{소속}}` |
| 변경 후(v3, 구본과 동일) | `$$current_datetime$$_방문자 기록부(방명록)__{{방문자성명}}__{{소속}}` |

앞머리가 입력 필드(`{{방문일시}}`)가 아니라 **플랫폼 변수 `$$current_datetime$$`**(문서 생성 시각)다.

## 절차
`tools/promote-template.mjs` 와 같은 저장 경로(`POST /v1.0/companies/{cid}/members/{member}/forms/{fid}` multipart,
`toCreateShapeAuth` 적용)를 쓰되 `doc_default_title` 한 필드만 바꿨다(`.work/set-title.mjs`).
저장 전후 스냅샷 전수 diff 결과 달라진 항목은 5개뿐이고, 의도한 변경 1개 외에는 저장이 만드는 메타데이터다.

```
form.config.step_settings.0.option.doc_default_title  (의도한 변경)
form.version 3 → 4 · form.update_date · form.start_write_date · form.id(리비전 id)
```

reCAPTCHA(OFF, 사용자 의도) · `use_external_users`(true) · `config.notification`(6) ·
`display_settings`(17)는 전부 불변. 구본은 손대지 않았고 문서도 삭제하지 않았다.

🔴 **저장하면 `is_release` 가 내려간다**(알려진 함정) — 실제로 `true → false` 로 떨어져 release 를
재요청했고 최종 `is_release: true` 를 확인했다.

## 검증 (2026-09-15, fresh)

1. `kiosk verify-template e86be31eb2e3485184b94d3d58540095` → **exit 0**, fail 0건.
   `[OK] 문서 제목 규칙 — $$current_datetime$$_방문자 기록부(방명록)__{{방문자성명}}__{{소속}}`
   (WARN 1건은 기존과 동일한 "문서 관리자 지정 없음")
2. 실기 1건 — 헤드리스 Chrome(9233, 768×1024) + `verify-kiosk` 즉시 모드 1회,
   배포 페이지 https://eformsign-kiosk-guestbook.vercel.app 에서 성명 `제목복원테스트` · 소속 `포시에스` 제출.

| 문서 ID | 제목(원문) |
|---|---|
| `e721fef8a9714871b832107fc5a41f68` | `2026-09-15 오전 09:07_방문자 기록부(방명록)__제목복원테스트__포시에스` |

   `tools/list-docs.mjs --type 04 --all` 목록에서 같은 제목으로 확인했다.
   같은 회차 앞서 좌표를 잘못 잡아 빈 값으로 제출된 문서 `0d0a431ce4c0481c95d0f36cac4f2496`
   (`2026-09-15 오전 09:06_방문자 기록부(방명록)____`)도 목록에 남아 있다 — 삭제 금지라 그대로 둔다.

## 함정 (다음 세션용)

🔴 `tools/verify-kiosk.mjs` 의 성명 입력칸 좌표 `(480, 723)` 은 **현행 렌더와 맞지 않는다**
(그 좌표로 타이핑하면 아무 데도 안 들어가고, 제목이 `____` 로 비어 제출된다 — 위 실증).
현행 768×1024 렌더 기준 좌표는 `probe-components.mjs` 쪽이 맞다:
성명 `(480, 464)` · 소속 `(520, 518)` · 연락처 `(470, 571)` · 담당자 `(500, 678)`.
README 의 예시가 `--notype` 를 쓰는 이유이기도 하다. 값이 실제로 들어갔는지는
`window.__kioskLog` 의 `saveSuccess.title` 로 확인한다(제목이 비면 입력이 안 들어간 것).
