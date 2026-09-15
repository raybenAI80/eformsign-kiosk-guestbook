# digest: cleanup-2026-09-16 (문서4+템플릿3 삭제)
- WORKER-PREAMBLE.md: digest/progress 갱신, 예산 200K/150콜, 수신함 .work/inbox/
- .work/del-docs-v8.mjs: 삭제 스크립트 패턴(EformsignClient, documents.delete{documentIds,memberId}, PROTECT set)
- evidence/final/cleanup-2026-09-15.md: 승인정책=테스트서명 삭제/실명·운영 보존, 판정=삭제후 fresh 재조회(500이어도 재조회로만 판정)
- tools/list-docs.mjs: type04 전수(--all), limit/skip 이름 주의
- 명령: node --env-file=D:/pjt/eformsign/eformsign-core/.env <script>
