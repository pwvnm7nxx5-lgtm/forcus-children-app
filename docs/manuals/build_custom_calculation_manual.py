from pathlib import Path

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[2]
ASSET_DIR = ROOT / "docs" / "manuals" / "assets" / "calculation-guide"
TMP_DIR = ROOT / "tmp" / "pdfs" / "manual-crops"
OUTPUT = ROOT / "output" / "pdf" / "計算問題作成_使い方ガイド.pdf"
PAGE_W, PAGE_H = A4


NAVY = HexColor("#18324b")
TEAL = HexColor("#0f8278")
BLUE = HexColor("#2d6cdf")
PALE_BLUE = HexColor("#edf4ff")
PALE_TEAL = HexColor("#e9f7f4")
PALE_YELLOW = HexColor("#fff7d8")
PALE_RED = HexColor("#fff0ee")
INK = HexColor("#203040")
MUTED = HexColor("#5f6d7a")
LINE = HexColor("#cbd6df")
WHITE = colors.white


def register_fonts():
    pdfmetrics.registerFont(TTFont("GuideRegular", r"C:\Windows\Fonts\BIZ-UDGothicR.ttc"))
    pdfmetrics.registerFont(TTFont("GuideBold", r"C:\Windows\Fonts\BIZ-UDGothicB.ttc"))


def styles():
    return {
        "body": ParagraphStyle(
            "body", fontName="GuideRegular", fontSize=10.2, leading=16,
            textColor=INK, alignment=TA_LEFT, wordWrap="CJK",
        ),
        "small": ParagraphStyle(
            "small", fontName="GuideRegular", fontSize=8.7, leading=13,
            textColor=MUTED, alignment=TA_LEFT, wordWrap="CJK",
        ),
        "card": ParagraphStyle(
            "card", fontName="GuideRegular", fontSize=9.5, leading=14,
            textColor=INK, alignment=TA_LEFT, wordWrap="CJK",
        ),
        "card_title": ParagraphStyle(
            "card_title", fontName="GuideBold", fontSize=12, leading=16,
            textColor=NAVY, alignment=TA_LEFT, wordWrap="CJK",
        ),
        "title": ParagraphStyle(
            "title", fontName="GuideBold", fontSize=26, leading=34,
            textColor=NAVY, alignment=TA_LEFT, wordWrap="CJK",
        ),
        "subtitle": ParagraphStyle(
            "subtitle", fontName="GuideRegular", fontSize=12.5, leading=20,
            textColor=MUTED, alignment=TA_LEFT, wordWrap="CJK",
        ),
        "section": ParagraphStyle(
            "section", fontName="GuideBold", fontSize=17, leading=22,
            textColor=NAVY, alignment=TA_LEFT, wordWrap="CJK",
        ),
        "white_card": ParagraphStyle(
            "white_card", fontName="GuideRegular", fontSize=10, leading=15,
            textColor=WHITE, alignment=TA_LEFT, wordWrap="CJK",
        ),
    }


STYLE = styles()


def para(canvas, text, x, top, width, style="body"):
    paragraph = Paragraph(text, STYLE[style])
    _, height = paragraph.wrap(width, PAGE_H)
    paragraph.drawOn(canvas, x, top - height)
    return height


def box(canvas, x, y, width, height, fill=WHITE, stroke=LINE, radius=9, line_width=0.8):
    canvas.setFillColor(fill)
    canvas.setStrokeColor(stroke)
    canvas.setLineWidth(line_width)
    canvas.roundRect(x, y, width, height, radius, fill=1, stroke=1)


def label(canvas, text, x, y, fill=TEAL, width=None):
    if width is None:
        width = max(45, pdfmetrics.stringWidth(text, "GuideBold", 8.5) + 18)
    canvas.setFillColor(fill)
    canvas.roundRect(x, y, width, 21, 10, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("GuideBold", 8.5)
    canvas.drawCentredString(x + width / 2, y + 6.5, text)
    return width


def circle_number(canvas, number, x, y, fill=BLUE, text_color=WHITE, radius=13):
    canvas.setFillColor(fill)
    canvas.setStrokeColor(fill)
    canvas.circle(x, y, radius, fill=1, stroke=0)
    canvas.setFillColor(text_color)
    canvas.setFont("GuideBold", 11)
    canvas.drawCentredString(x, y - 4, str(number))


def arrow(canvas, x1, y1, x2, y2, color=TEAL):
    canvas.setStrokeColor(color)
    canvas.setFillColor(color)
    canvas.setLineWidth(2)
    canvas.line(x1, y1, x2, y2)
    canvas.line(x2, y2, x2 - 7, y2 + 4)
    canvas.line(x2, y2, x2 - 7, y2 - 4)


def fit_image(canvas, path, x, y, width, height, border=True):
    path = Path(path)
    if not path.exists():
        box(canvas, x, y, width, height, fill=PALE_RED, stroke=HexColor("#d96b5f"))
        para(canvas, "画像が見つかりません", x + 10, y + height - 16, width - 20, "small")
        return
    image = ImageReader(str(path))
    image_width, image_height = image.getSize()
    scale = min(width / image_width, height / image_height)
    draw_width = image_width * scale
    draw_height = image_height * scale
    draw_x = x + (width - draw_width) / 2
    draw_y = y + (height - draw_height) / 2
    if border:
        canvas.setFillColor(WHITE)
        canvas.setStrokeColor(LINE)
        canvas.roundRect(x, y, width, height, 7, fill=1, stroke=1)
    canvas.drawImage(image, draw_x, draw_y, draw_width, draw_height, preserveAspectRatio=True, mask="auto")


def crop_asset(name, left, top, right, bottom):
    source = ASSET_DIR / name
    target = TMP_DIR / f"{Path(name).stem}-{left}-{top}-{right}-{bottom}.png"
    if target.exists():
        return target
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.crop((left, top, right, bottom)).save(target)
    return target


def prepare_crops():
    return {
        "overview": ASSET_DIR / "S01-overview.png",
        "horizontal": crop_asset("S04-horizontal.png", 350, 0, 1265, 712),
        "workspace": crop_asset("S05-workspace.png", 350, 0, 1265, 712),
        "vertical": crop_asset("S06-vertical.png", 350, 0, 1265, 712),
        "decimal": ASSET_DIR / "S07-decimal-controls.png",
        "decimal_ui": crop_asset("S07-decimal-controls.png", 350, 0, 1265, 712),
        "decimal_off": crop_asset("S08-decimal-helper-off.png", 350, 0, 1265, 712),
        "dense": crop_asset("S09-multiplication-15.png", 350, 0, 1265, 620),
        "answers": crop_asset("S10-answer-page.png", 350, 0, 1265, 712),
    }


def page_header(canvas, number, title, tag_text="使い方ガイド"):
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 58, PAGE_W, 58, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("GuideBold", 9)
    canvas.drawString(38, PAGE_H - 35, f"計算問題作成  |  {number:02d} / 08")
    canvas.setFillColor(TEAL)
    canvas.roundRect(PAGE_W - 130, PAGE_H - 44, 92, 20, 10, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("GuideBold", 8)
    canvas.drawCentredString(PAGE_W - 84, PAGE_H - 37, tag_text)
    para(canvas, title, 38, PAGE_H - 86, PAGE_W - 76, "section")


def footer(canvas, number):
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(38, 28, PAGE_W - 38, 28)
    canvas.setFillColor(MUTED)
    canvas.setFont("GuideRegular", 7.5)
    canvas.drawString(38, 15, "計算問題作成 使い方ガイド")
    canvas.drawRightString(PAGE_W - 38, 15, f"{number} / 8")


def draw_step_card(canvas, number, title, body, x, y, width, height, fill=PALE_BLUE):
    box(canvas, x, y, width, height, fill=fill, stroke=LINE)
    circle_number(canvas, number, x + 24, y + height - 27)
    para(canvas, title, x + 47, y + height - 17, width - 60, "card_title")
    para(canvas, body, x + 16, y + height - 52, width - 32, "card")


def draw_flow_box(canvas, number, title, body, x, y, width, fill):
    box(canvas, x, y, width, 91, fill=fill, stroke=LINE)
    circle_number(canvas, number, x + width / 2, y + 67, fill=TEAL)
    canvas.setFillColor(NAVY)
    canvas.setFont("GuideBold", 11)
    canvas.drawCentredString(x + width / 2, y + 42, title)
    para(canvas, body, x + 10, y + 31, width - 20, "small")


def page_one(canvas, images):
    canvas.setFillColor(HexColor("#f6fbfb"))
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    label(canvas, "はじめての方向け", 38, PAGE_H - 92, fill=TEAL)
    para(canvas, "計算問題作成<br/>かんたん使い方ガイド", 38, PAGE_H - 123, 360, "title")
    para(canvas, "計算の種類・桁数・表示方法を選んで、必要なプリントをすぐ作れます。", 38, PAGE_H - 207, 400, "subtitle")
    para(canvas, "まずは下の3ステップだけで大丈夫です。", 38, PAGE_H - 263, 400, "body")
    flow_y = 470
    draw_flow_box(canvas, 1, "設定", "計算と数の大きさを選ぶ", 38, flow_y, 157, PALE_BLUE)
    arrow(canvas, 205, flow_y + 45, 230, flow_y + 45)
    draw_flow_box(canvas, 2, "確認", "右側のプレビューを見る", 244, flow_y, 157, PALE_TEAL)
    arrow(canvas, 411, flow_y + 45, 436, flow_y + 45)
    draw_flow_box(canvas, 3, "印刷", "印刷またはPDF保存を押す", 450, flow_y, 107, PALE_YELLOW)
    fit_image(canvas, images["overview"], 38, 70, 519, 360)
    para(canvas, "画面は左が設定、右がプレビューです。", 38, 53, 519, "small")
    footer(canvas, 1)


def page_two(canvas, images):
    page_header(canvas, 2, "画面は「設定」と「プレビュー」に分かれています")
    fit_image(canvas, images["overview"], 38, 448, 519, 285)
    box(canvas, 38, 278, 250, 128, fill=PALE_BLUE)
    circle_number(canvas, 1, 62, 371)
    para(canvas, "左側で問題の内容を決めます。", 87, 381, 180, "card")
    box(canvas, 307, 278, 250, 128, fill=PALE_TEAL)
    circle_number(canvas, 2, 331, 371, fill=TEAL)
    para(canvas, "右側に完成イメージが表示されます。", 356, 381, 180, "card")
    box(canvas, 38, 134, 250, 128, fill=PALE_YELLOW)
    circle_number(canvas, 3, 62, 227, fill=HexColor("#d18a00"))
    para(canvas, "設定を変えると、すぐプレビューに反映されます。", 87, 237, 180, "card")
    box(canvas, 307, 134, 250, 128, fill=PALE_RED, stroke=HexColor("#e1aaa1"))
    circle_number(canvas, 4, 331, 227, fill=HexColor("#d96b5f"))
    para(canvas, "もんだいページと、こたえページを確認できます。", 356, 237, 180, "card")
    box(canvas, 38, 73, 519, 45, fill=PALE_BLUE)
    para(canvas, "ポイント: 問題が多い場合は、A4に収まるよう自動で小さくなります。", 54, 106, 487, "small")
    footer(canvas, 2)


def page_three(canvas, images):
    page_header(canvas, 3, "6つの手順で作ってみましょう")
    draw_step_card(canvas, 1, "計算を選ぶ", "「計算」で、たし算・ひき算などを選びます。", 38, 604, 250, 104)
    draw_step_card(canvas, 2, "桁数を選ぶ", "「1つ目」と「2つ目」の数の大きさを決めます。", 307, 604, 250, 104, PALE_TEAL)
    draw_step_card(canvas, 3, "表示を選ぶ", "横式、横式＋計算スペース、筆算から選びます。", 38, 474, 250, 104, PALE_YELLOW)
    draw_step_card(canvas, 4, "用紙を整える", "問題数、用紙の向き、列数を確認します。", 307, 474, 250, 104)
    draw_step_card(canvas, 5, "プレビューを見る", "数字の大きさ、問題数、答えページを確認します。", 38, 344, 250, 104, PALE_TEAL)
    draw_step_card(canvas, 6, "印刷する", "「印刷 / PDF保存」を押し、印刷先を選びます。", 307, 344, 250, 104, PALE_YELLOW)
    box(canvas, 38, 84, 519, 210, fill=HexColor("#f7fafc"), stroke=LINE)
    label(canvas, "設定例", 54, 260, fill=BLUE)
    para(canvas, "たし算 / 2桁と1桁 / 筆算 / 12問 / 縦向き / 2列", 54, 240, 250, "card_title")
    para(canvas, "この設定なら、2つの数を縦にそろえて計算するプリントになります。右側のプレビューを確認してから印刷します。", 54, 194, 235, "card")
    fit_image(canvas, images["vertical"], 315, 98, 225, 170)
    footer(canvas, 3)


def page_four(canvas, images):
    page_header(canvas, 4, "作りたい計算と、2つの数の大きさを選びます")
    para(canvas, "計算", 38, 730, 110, "card_title")
    para(canvas, "たし算、ひき算、かけ算、わり算（あまりなし）に加えて、小数の計算も選べます。", 38, 704, 245, "body")
    para(canvas, "小数を選ぶと、整数部分の桁数と、「小数第1位まで」「小数第2位まで」「小数第3位まで」から使う位を、それぞれの数について選べます。", 38, 630, 245, "body")
    para(canvas, "「0（1未満）」を選ぶと、0.4や0.38のような数を作れます。", 38, 555, 245, "body")
    box(canvas, 38, 380, 245, 126, fill=PALE_BLUE)
    label(canvas, "小数の例", 54, 478, fill=BLUE)
    para(canvas, "整数部分1桁 + 小数第2位まで", 54, 450, 205, "card_title")
    para(canvas, "7.25 のような数", 54, 414, 205, "card")
    box(canvas, 38, 234, 245, 126, fill=PALE_TEAL)
    label(canvas, "0（1未満）の例", 54, 332, fill=TEAL)
    para(canvas, "0（1未満） + 小数第1位まで", 54, 304, 205, "card_title")
    para(canvas, "0.6 のような数", 54, 268, 205, "card")
    box(canvas, 38, 84, 245, 126, fill=PALE_YELLOW)
    para(canvas, "選んだ計算で使わない設定は、薄い色になって操作できないことがあります。故障ではありません。", 54, 185, 205, "card")
    box(canvas, 303, 420, 254, 313, fill=PALE_BLUE)
    label(canvas, "実際の設定画面", 319, 704, fill=BLUE)
    fit_image(canvas, images["decimal_ui"], 319, 516, 222, 166)
    para(canvas, "小数の種類を選ぶと、2つの数の設定欄が表示されます。", 319, 501, 222, "small")
    box(canvas, 303, 84, 254, 315, fill=PALE_TEAL)
    label(canvas, "小数の選び方", 319, 370, fill=TEAL)
    para(canvas, "1つ目と2つ目の数は、それぞれ別々に選べます。", 319, 340, 222, "card")
    para(canvas, "整数部分の桁数と、小数第1位・第2位・第3位までを組み合わせます。", 319, 284, 222, "card")
    para(canvas, "0（1未満）を選ぶと、0.4や0.38のような数も作れます。", 319, 214, 222, "card")
    para(canvas, "使わない設定は薄い色になり、操作できません。", 319, 144, 222, "small")
    footer(canvas, 4)


def display_card(canvas, image, title, body, x, y, width, height, fill):
    box(canvas, x, y, width, height, fill=fill, stroke=LINE)
    fit_image(canvas, image, x + 10, y + 202, width - 20, 105, border=True)
    para(canvas, title, x + 12, y + 184, width - 24, "card_title")
    para(canvas, body, x + 12, y + 145, width - 24, "small")


def page_five(canvas, images):
    page_header(canvas, 5, "学習の目的に合わせて表示を選びます")
    para(canvas, "同じ計算でも、表示方法を変えると練習のねらいを変えられます。", 38, 724, 519, "body")
    card_y = 300
    card_w = 163
    display_card(canvas, images["horizontal"], "横式", "暗算、式を見て答える練習", 38, card_y, card_w, 360, PALE_BLUE)
    display_card(canvas, images["workspace"], "横式＋計算スペース", "式を見て、自分で筆算を書く練習", 216, card_y, card_w, 360, PALE_TEAL)
    display_card(canvas, images["vertical"], "筆算", "桁をそろえて計算する練習", 394, card_y, card_w, 360, PALE_YELLOW)
    box(canvas, 38, 82, 519, 172, fill=WHITE, stroke=LINE)
    label(canvas, "選び方", 54, 225, fill=TEAL)
    para(canvas, "式だけで解く  ->  横式", 54, 195, 220, "card_title")
    para(canvas, "自分で筆算を書きたい  ->  横式＋計算スペース", 54, 164, 300, "card")
    para(canvas, "最初から桁をそろえて見せたい  ->  筆算", 54, 132, 300, "card")
    para(canvas, "「繰り上がり・繰り下がりのマスをつける」は、対応する筆算でだけ使えます。", 345, 195, 190, "small")
    para(canvas, "「計算スペースに記号を表示する」は、横式＋計算スペースでだけ使えます。", 345, 135, 190, "small")
    footer(canvas, 5)


def page_six(canvas, images):
    page_header(canvas, 6, "小数点の補助表示と、答えページを調整できます")
    box(canvas, 38, 347, 250, 385, fill=PALE_BLUE)
    label(canvas, "小数点", 54, 704, fill=BLUE)
    para(canvas, "「計算スペースに小数点をつける」は、下の計算マスにある補助用の小数点だけを表示・非表示にします。横に書かれた問題の小数点は消えません。", 54, 675, 218, "card")
    fit_image(canvas, images["decimal_off"], 54, 376, 218, 196)
    para(canvas, "左: 補助点をOFFにした例", 54, 360, 218, "small")
    box(canvas, 307, 347, 250, 385, fill=PALE_TEAL)
    label(canvas, "答えページ", 323, 704, fill=TEAL)
    para(canvas, "「答えページをつける」がONなら、問題プリントに対応する答えページを作ります。OFFなら、問題ページだけを印刷します。", 323, 675, 218, "card")
    fit_image(canvas, images["answers"], 323, 376, 218, 196)
    para(canvas, "答えページでは、正しい小数点も表示されます。", 323, 360, 218, "small")
    box(canvas, 38, 84, 519, 220, fill=PALE_YELLOW)
    label(canvas, "複数枚", 54, 275, fill=HexColor("#d18a00"))
    para(canvas, "「作成する枚数」を2以上にすると、同じ設定で別の問題プリントを作ります。単純なコピーではなく、数字の違う問題になります。", 54, 247, 487, "body")
    para(canvas, "ページ上部の「2枚」などの表示で、問題ページと答えページを含む合計枚数を確認できます。", 54, 187, 487, "card")
    footer(canvas, 6)


def draw_print_flow(canvas, x, y):
    steps = [
        ("1", "プレビュー", "A4に収まるか確認"),
        ("2", "印刷 / PDF保存", "ボタンを押す"),
        ("3", "印刷先", "プリンターかPDF"),
    ]
    width = 145
    for index, (number, title, body) in enumerate(steps):
        current_x = x + index * 166
        box(canvas, current_x, y, width, 76, fill=WHITE, stroke=LINE)
        circle_number(canvas, number, current_x + 22, y + 51, fill=TEAL)
        para(canvas, title, current_x + 42, y + 66, width - 50, "card_title")
        para(canvas, body, current_x + 14, y + 30, width - 28, "small")
        if index < len(steps) - 1:
            arrow(canvas, current_x + width + 7, y + 38, current_x + width + 21, y + 38)


def page_seven(canvas, images):
    page_header(canvas, 7, "仕上げて、印刷または保存します")
    box(canvas, 38, 420, 242, 315, fill=PALE_BLUE)
    label(canvas, "用紙設定", 54, 704, fill=BLUE)
    para(canvas, "用紙の向き: 縦向き / 横向き", 54, 674, 205, "card_title")
    para(canvas, "穴あけガイド: なし / 左の真ん中 ◀ / 上の真ん中 ▲", 54, 626, 205, "card")
    para(canvas, "列数: 1列あたりの横幅と、縦に並ぶ問題数を調整します。", 54, 574, 205, "card")
    para(canvas, "問題の大きさ上限（%）: 問題を大きくしすぎないための上限です。", 54, 514, 205, "card")
    para(canvas, "かけ算を15問にしたときは、A4に収まるよう列数と大きさが自動で調整されます。", 54, 458, 205, "small")
    fit_image(canvas, images["dense"], 307, 536, 250, 170)
    para(canvas, "15問・横向き・4列の例", 307, 522, 250, "small")
    para(canvas, "列数と問題の大きさを組み合わせて、A4に収まる状態を作ります。", 307, 478, 250, "card")
    draw_print_flow(canvas, 38, 287)
    box(canvas, 38, 84, 519, 157, fill=PALE_RED, stroke=HexColor("#e1aaa1"))
    label(canvas, "印刷の注意", 54, 212, fill=HexColor("#d96b5f"))
    para(canvas, "印刷画面では用紙サイズをA4にします。倍率は100%または既定のままにします。別の「用紙に合わせる」を重ねて使うと、意図せず小さくなることがあります。", 54, 184, 487, "body")
    para(canvas, "PDFにする場合は、印刷先で「PDFに保存」を選びます。", 54, 127, 487, "card")
    footer(canvas, 7)


def draw_table(canvas, rows, x, y_top, width, row_height=53):
    left_width = 145
    for index, (situation, check) in enumerate(rows):
        y = y_top - (index + 1) * row_height
        fill = PALE_BLUE if index % 2 == 0 else WHITE
        canvas.setFillColor(fill)
        canvas.setStrokeColor(LINE)
        canvas.rect(x, y, width, row_height, fill=1, stroke=1)
        canvas.setStrokeColor(LINE)
        canvas.line(x + left_width, y, x + left_width, y + row_height)
        para(canvas, f"<b>{situation}</b>", x + 10, y + row_height - 12, left_width - 20, "small")
        para(canvas, check, x + left_width + 10, y + row_height - 12, width - left_width - 20, "small")


def page_eight(canvas, images):
    page_header(canvas, 8, "困ったときの確認ポイント")
    rows = [
        ("設定が選べない", "その計算や表示方法では使わない項目は、自動で操作不可になります。"),
        ("別の数字にしたい", "「作り直す」を押します。設定はそのままで数字が変わります。"),
        ("問題が小さく見える", "問題数、列数、用紙の向き、問題の大きさ上限の順に確認します。"),
        ("印刷がA4にならない", "印刷画面の用紙サイズがA4か、向きがアプリと同じか確認します。"),
        ("古い画面のまま", "WindowsではCtrl+F5またはCtrl+Shift+Rで再読み込みします。URLは変わりません。"),
        ("共有URLをコピーできない", "アドレス欄の末尾に共有データが追加されるので、URL全体をコピーします。"),
    ]
    draw_table(canvas, rows, 38, 700, 519, 56)
    box(canvas, 38, 76, 519, 116, fill=PALE_TEAL)
    label(canvas, "印刷前チェック", 54, 169, fill=TEAL)
    checks = [
        "計算の種類と2つの数の桁数は合っている",
        "表示方法、問題数、列数、答えページは合っている",
        "名前などの個人情報とA4の向きを確認した",
    ]
    for index, check in enumerate(checks):
        canvas.setFillColor(TEAL)
        canvas.circle(61, 143 - index * 24, 4, fill=1, stroke=0)
        para(canvas, check, 73, 149 - index * 24, 460, "small")
    footer(canvas, 8)


def build_pdf():
    register_fonts()
    images = prepare_crops()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    canvas = Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    canvas.setTitle("計算問題作成 かんたん使い方ガイド")
    canvas.setAuthor("特別支援アプリ")
    page_one(canvas, images)
    canvas.showPage()
    page_two(canvas, images)
    canvas.showPage()
    page_three(canvas, images)
    canvas.showPage()
    page_four(canvas, images)
    canvas.showPage()
    page_five(canvas, images)
    canvas.showPage()
    page_six(canvas, images)
    canvas.showPage()
    page_seven(canvas, images)
    canvas.showPage()
    page_eight(canvas, images)
    canvas.save()
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()
