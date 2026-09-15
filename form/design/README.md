# 방문자 기록부 배경 서식 — 디자인 HTML → PDF → 좌표

기존 `form/build-pdf.mjs` 는 `form/layout.mjs` 의 숫자로 배경 PDF 를 **스크립트가 그렸다**.
여기서는 순서를 뒤집는다 — **디자인한 HTML 이 단일 진실 원천**이고, 좌표는 그 HTML 을
실제로 렌더해서 **읽어낸다**.

```
guestbook.html  ──(헤드리스 Chrome)──►  guestbook-design.pdf     ← 배경 PDF
      │
      └────────(헤드리스 Chrome + CDP 실측)────►  layout.design.mjs   ← OZR 컴포넌트 좌표
                                                  layout.design.json  ← 검수·게이트용
```

디자인을 고치면 좌표가 **자동으로** 따라온다. 숫자를 두 군데 맞춰 넣을 일이 없다.

---

## 파일

| 파일 | 역할 |
|---|---|
| `guestbook.html` | 서식 디자인. **여기만 손으로 고친다.** 입력칸은 빈 박스로 그리고 `data-field="<FORMID>"` 로 표시 |
| `assets/eformsign-logo-blue.png` | 제공 로고 원본(무변경 사용). 다른 로고로 바꾸려면 이 파일만 교체 |
| `render-pdf.mjs` | HTML → `guestbook-design.pdf` (A4 1장) |
| `extract-layout.mjs` | 렌더 실측 → `layout.design.mjs` + `layout.design.json` |
| `overlay-check.py` | 추출 좌표를 PDF 위에 덮어 그린 검수 이미지 `overlay-check.png` |
| `layout.design.mjs` | **자동 생성물. 손으로 고치지 말 것.** |

## 재생성 절차

```bash
cd D:/pjt/eformsign/kiosk-guestbook

# 1) 디자인 수정 후 PDF 재생성
node form/design/render-pdf.mjs

# 2) 좌표 재추출 (layout.design.mjs / .json)
node form/design/extract-layout.mjs

# 3) 좌표가 그려진 박스와 맞는지 육안 검수
python form/design/overlay-check.py     # → form/design/overlay-check.png

# 4) 한국어 줄바꿈 게이트 (exit 0 이어야 한다)
node C:/Users/FORCS/.agent-harness/tools/korean-linebreak/cli.mjs \
  --file form/design/guestbook.html --widths 794 --fail-on fail
```

`794px` 는 A4 폭 595.28pt 를 96dpi 로 환산한 값이다(= 인쇄 폭 그대로 검사).

## 빌드 체인에 연결하기 (다음 단계, v8)

`form/build-ozr.mjs` 는 지금 `./layout.mjs` 와 `guestbook.pdf` 를 **하드코딩**으로 읽는다.
`layout.design.mjs` 는 **`form/layout.mjs` 와 호환되는 표면**(`PAGE`, `rows`, `purpose`,
`host`, `consent`, `sign`, `inputBox(r)`)을 그대로 내보내므로, 입력 두 개만 바꿔 끼우면 된다.

권장 인자화:

```bash
node form/build-ozr.mjs --layout form/design/layout.design.mjs \
                        --pdf    form/design/guestbook-design.pdf
node form/build-ozw.mjs
```

구현은 `build-ozr.mjs` 상단 두 줄을 인자로 받게 바꾸는 정도다.

```js
// 현재                                   // 바꿀 모양
import * as L from './layout.mjs';        const L = await import(argv.layout ?? './layout.mjs');
const pdf = readFileSync('guestbook.pdf');const pdf = readFileSync(argv.pdf ?? 'guestbook.pdf');
```

🔴 `build-ozr.mjs` 의 `FORM_IDS` 와 `required` 목록은 그대로 쓴다 — `data-field` 값이
그 FORMID 와 **같은 문자열**이라 이름이 어긋날 일이 없다.

## 좌표 규약

- 단위 = **PDF 포인트(pt)**, 원점 = 페이지 **좌상단**. CSS px → pt 는 96dpi 기준 `× 0.75`.
- 텍스트·서명 박스의 bbox 는 **테두리 안쪽**(inner box)이다. 컴포넌트가 인쇄된 테두리를
  덮어 두 겹으로 보이는 것을 막는다.
- 라디오·체크박스는 글리프가 작아 **테두리 포함 박스**를 그대로 쓴다.
- 라디오 5개는 `top` 과 크기가 모두 같아야 한다(`extract-layout.mjs` 가 단언으로 막는다).
  `build-ozr.mjs` 가 `boxTop` + `size` + 각 옵션의 `x` 로 bbox 를 재구성하기 때문이다.
- Chrome 이 찍는 A4 는 594.96 × 841.92pt 로 A4 정의(595.28 × 841.89)와 0.32pt 차이가 난다.
  `build-ozr.mjs` 는 `pageWidth: 595 / pageHeight: 842` 로 넘기므로 영향 없다.

## 디자인 규칙 (지키고 고칠 것)

- **색**: 메인 컬러는 eformsign Blue `#0E73C3` 하나. 배경은 White / Light Blue `#F2F9FF` /
  Light Gray `#F4F4F4` 만. 서브 컬러를 메인처럼 쓰지 않는다.
- **폰트**: 한국어 헤드라인 **페이퍼로지**(8 ExtraBold / 6 SemiBold), 본문 **Pretendard**.
  둘 다 **로컬 설치본**을 쓴다 — 외부 웹폰트를 로드하면 렌더 환경에 따라 PDF 가 달라진다.
  Paperlogy 는 굵기마다 별도 패밀리로 등록되므로 `"페이퍼로지 6 SemiBold"` 처럼 패밀리명으로
  고르고 `font-weight` 로 굵히지 않는다(가짜 굵기 방지).
- **로고**: 제공 PNG 원본만 쓴다. 타이포로 다시 그리지 않는다.
- **줄바꿈**: `word-break: keep-all` + `overflow-wrap: break-word`.
  🔴 `overflow-wrap: anywhere` 금지 — 어절 분리 기회를 min-content 에 반영해 `keep-all` 을
  무력화한다. 제목·짧은 안내문은 `text-wrap: balance`.
  갈라지면 안 되는 덩어리(`1년`, `(필수)`)는 `.nb`(nowrap)로 묶는다.
- **입력칸 크기**: 높이 32pt(≈43px) — 태블릿 터치 타깃 하한을 고려한 값. 더 줄이지 않는다.
- **인쇄 색 보존**: `print-color-adjust: exact` 를 `html, body` 에 건다. 헤더 밴드와
  포인트 바가 흰색으로 날아가는 것을 막는다.
