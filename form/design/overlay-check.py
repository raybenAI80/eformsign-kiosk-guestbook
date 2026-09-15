# -*- coding: utf-8 -*-
"""layout.design.json 의 좌표를 guestbook-design.pdf 위에 덮어 그려 육안 검수용 PNG 를 만든다.

추출 좌표가 실제로 그려진 박스/밑줄 자리와 맞는지 눈으로 확인하는 게이트다.
좌표가 어긋나면 OZR 입력 컴포넌트가 배경 서식에서 밀려 보인다.

사용: python form/design/overlay-check.py
산출: form/design/overlay-check.png
"""
import json
import os

import fitz  # PyMuPDF

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = os.path.join(HERE, "guestbook-design.pdf")
JSON_PATH = os.path.join(HERE, "layout.design.json")
OUT = os.path.join(HERE, "overlay-check.png")
DPI = 140

KIND_COLOR = {
    "date": (0.05, 0.55, 0.95),
    "text": (0.05, 0.55, 0.95),
    "phone": (0.05, 0.55, 0.95),
    "radio-option": (0.95, 0.35, 0.10),
    "checkbox": (0.60, 0.20, 0.80),
    "signature": (0.10, 0.70, 0.35),
}

# PyMuPDF 기본 폰트(helv)는 한글 글리프가 없어 점으로 찍힌다.
# 검수 이미지의 라벨만 ASCII 로 바꾼다(좌표는 그대로).
ASCII_TAG = {
    "방문일시": "visit_datetime",
    "방문자성명": "visitor_name",
    "소속": "visitor_org",
    "연락처": "visitor_phone",
    "담당자": "host_name",
    "개인정보동의": "agree_privacy",
    "방문자서명": "visitor_sign",
    "방문목적/회의": "purpose#1",
    "방문목적/납품": "purpose#2",
    "방문목적/면접": "purpose#3",
    "방문목적/견학": "purpose#4",
    "방문목적/기타": "purpose#5",
}

spec = json.load(open(JSON_PATH, encoding="utf-8"))
doc = fitz.open(PDF)
assert doc.page_count == 1, f"1페이지가 아니다: {doc.page_count}"
page = doc[0]

for f in spec["fields"]:
    x0, y0, x1, y1 = f["box"]
    color = KIND_COLOR.get(f["kind"], (0.5, 0.5, 0.5))
    rect = fitz.Rect(x0, y0, x1, y1)
    page.draw_rect(rect, color=color, fill=color, fill_opacity=0.22, width=0.8)
    page.insert_text(
        (x0, max(y0 - 2.0, 8.0)),
        ASCII_TAG.get(f["formId"], f["formId"]),
        fontname="helv",
        fontsize=5.5,
        color=color,
    )

pix = page.get_pixmap(dpi=DPI)
pix.save(OUT)
print(json.dumps({"out": OUT, "fields": len(spec["fields"]), "dpi": DPI,
                  "page_rect": [page.rect.x1, page.rect.y1]}, ensure_ascii=False))
