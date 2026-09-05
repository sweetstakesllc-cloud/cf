"""Render a Circular Fash authenticity certificate from a JSON payload."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


NAVY = HexColor("#0E1B4D")
BLUE = HexColor("#4770DB")
INK = HexColor("#10141F")
MUTED = HexColor("#6B7280")
PAPER = HexColor("#F7F7F4")
LINE = HexColor("#D9DCE5")


def fit_text(c: canvas.Canvas, text: str, max_width: float, size: float, font: str) -> float:
    while size > 8 and stringWidth(text, font, size) > max_width:
        size -= 0.5
    c.setFont(font, size)
    return size


def draw_contained_image(c: canvas.Canvas, path: str, x: float, y: float, width: float, height: float) -> None:
    try:
        image = ImageReader(path)
        iw, ih = image.getSize()
        scale = min(width / iw, height / ih)
        dw, dh = iw * scale, ih * scale
        c.drawImage(image, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh, mask="auto")
    except Exception:
        c.setFillColor(HexColor("#ECEEF3"))
        c.rect(x, y, width, height, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 8)
        c.drawCentredString(x + width / 2, y + height / 2, "IMAGE UNAVAILABLE")


def draw_qr(c: canvas.Canvas, value: str, x: float, y: float, size: float) -> None:
    widget = qr.QrCodeWidget(value)
    x1, y1, x2, y2 = widget.getBounds()
    drawing = Drawing(size, size, transform=[size / (x2 - x1), 0, 0, size / (y2 - y1), 0, 0])
    drawing.add(widget)
    renderPDF.draw(drawing, c, x, y)


def render(data: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    width, height = A4
    c = canvas.Canvas(str(output_path), pagesize=A4, pageCompression=1)
    c.setTitle(f"Certificate {data['certificateNumber']}")
    c.setAuthor("Circular Fash AB")

    c.setFillColor(PAPER)
    c.rect(0, 0, width, height, fill=1, stroke=0)
    c.setStrokeColor(NAVY)
    c.setLineWidth(1.2)
    c.rect(24, 24, width - 48, height - 48, fill=0, stroke=1)

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(48, height - 70, "CIRCULAR FASH")
    c.setFillColor(BLUE)
    c.rect(48, height - 81, 56, 3, fill=1, stroke=0)

    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 27)
    c.drawString(48, height - 127, "CERTIFICATE OF AUTHENTICITY")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(48, height - 146, f"CERTIFICATE {data['certificateNumber']}")

    image_paths = data.get("imagePaths", [])[:3]
    gap = 10
    image_y = height - 355
    image_h = 175
    image_w = (width - 96 - gap * 2) / 3
    for index in range(3):
        x = 48 + index * (image_w + gap)
        c.setStrokeColor(LINE)
        c.rect(x, image_y, image_w, image_h, fill=0, stroke=1)
        if index < len(image_paths):
            draw_contained_image(c, image_paths[index], x + 1, image_y + 1, image_w - 2, image_h - 2)
        else:
            c.setFillColor(HexColor("#ECEEF3"))
            c.rect(x + 1, image_y + 1, image_w - 2, image_h - 2, fill=1, stroke=0)

    info_top = image_y - 35
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, info_top, "AUTHENTICATED ITEM")
    title = data.get("productTitle", "")
    c.setFillColor(INK)
    fit_text(c, title, 340, 19, "Helvetica-Bold")
    c.drawString(48, info_top - 25, title)

    rows = [
        ("BRAND", data.get("brand") or "Not specified"),
        ("SKU", data.get("sku") or "Not specified"),
        ("ORDER", data.get("orderName") or ""),
        ("ISSUED", data.get("issuedDate") or ""),
    ]
    row_y = info_top - 62
    for index, (label, value) in enumerate(rows):
        x = 48 if index % 2 == 0 else 230
        y = row_y - (index // 2) * 41
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(x, y, label)
        c.setFillColor(INK)
        c.setFont("Helvetica", 10)
        c.drawString(x, y - 14, str(value))

    partner = data.get("authenticationPartner")
    report_number = data.get("authenticationReportNumber")
    if partner or report_number:
        y = row_y - 88
        c.setFillColor(MUTED)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(48, y, "AUTHENTICATION RECORD")
        c.setFillColor(INK)
        c.setFont("Helvetica", 9)
        value = " / ".join(part for part in [partner, report_number] if part)
        c.drawString(48, y - 14, value)

    statement_y = 225
    c.setStrokeColor(LINE)
    c.line(48, statement_y + 35, width - 48, statement_y + 35)
    c.setFillColor(INK)
    c.setFont("Helvetica", 9.3)
    statement = data.get("statement") or (
        "Circular Fash certifies that this item was inspected and authenticated "
        "before sale. Authenticity is guaranteed or your money back."
    )
    words = statement.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if stringWidth(candidate, "Helvetica", 9.3) <= 365:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    for index, line in enumerate(lines[:4]):
        c.drawString(48, statement_y - index * 14, line)

    verification_url = data["verificationUrl"]
    draw_qr(c, verification_url, width - 142, 158, 86)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(width - 99, 146, "SCAN TO VERIFY")

    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(48, 104, "CIRCULAR FASH AB")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(48, 90, "Authenticated pre-owned luxury fashion")
    c.drawString(48, 77, "circularfash.com")

    c.setStrokeColor(LINE)
    c.line(48, 55, width - 48, 55)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 6.8)
    c.drawString(48, 42, "Verify this certificate online. This document is valid only while its status is ACTIVE.")

    c.showPage()
    c.save()


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: render_certificate.py INPUT.json OUTPUT.pdf")
    with Path(sys.argv[1]).open("r", encoding="utf-8") as stream:
        payload = json.load(stream)
    render(payload, Path(sys.argv[2]))


if __name__ == "__main__":
    main()
