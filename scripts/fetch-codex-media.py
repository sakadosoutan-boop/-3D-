"""Download licensed Commons thumbnails and retain attribution alongside each image.
Run intentionally when refreshing assets; runtime never contacts Commons.
"""
import base64, json, html, re, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "codex"
CATALOG = [
    ("junihitoe", ["himegimi", "nyobo"], "Junihitoe.jpg", "衣装の復元例", "十二単を着用した現代の実演。平安時代の人物を撮影した写真ではありません。"),
    ("kichou", ["kichou"], "Kicho ,几帳.jpg", "几帳の展示例", "布を垂らした可動の間仕切り。ゲームでは布の動きを簡略化しています。"),
    ("shishinden", ["shinden"], "Kyoto, palazzo imperiale, padiglione shishinden, 03.jpg", "京都御所・紫宸殿", "現存する宮殿建築の比較例。貴族の寝殿と同一の建物ではなく、現在の建物は後世の再建です。"),
    ("koto", ["koto"], "Koto MET DP148476.jpg", "箏の実物資料", "The Metropolitan Museum of Art所蔵の箏。平安期そのものの個体としては扱わず、弦と柱の構造を比べる参考資料です。"),
    ("biwa", ["biwa"], "Heike Biwa MET MUS283B.jpg", "平家琵琶の実物資料", "The Metropolitan Museum of Art所蔵。ゲームの楽琵琶と種類が異なる比較例です。形や奏法の違いに注目してください。"),
    ("gissha", ["gissha"], "Jidai matsuri.JPG", "時代祭の牛車", "京都の時代祭で使われる復元の牛車。車体・車輪・轅と、牽く牛の配置を比べる現代の写真です。"),
    ("pine", ["matsu"], "Starr-110331-4559-Pinus thunbergii-needles-Shibuya Farm Kula-Maui (24786298230).jpg", "クロマツの針葉", "Pinus thunbergii。細長い針葉が束になる形の参考写真です。"),
    ("maple", ["kaede"], "Acer palmatum 005.JPG", "イロハモミジの園芸品種", "Acer palmatum Dissectum Group。葉が細く裂ける園芸品種の比較例で、ゲームの掌状葉と形に違いがあります。"),
    ("camellia", ["tsubaki"], "Camellia japonica NBG.jpg", "ヤブツバキの花の比較例", "Camellia japonica。植物園で撮影された花。園芸品種の花弁数とゲーム内の単純化した花を比較できます。"),
    ("mandarin-duck", ["oshidori"], "Mandarin.duck.arp.jpg", "オシドリの雄", "橙色の飾り羽と顔の白い縁取り。野鳥園で撮影され、片翼がクリッピングされた個体です。"),
    ("crane", ["tsuru"], "Grus japonensis -Hokkaido, Japan -several-8 (1).jpg", "北海道のタンチョウ", "黒い首と風切羽、白い体、頭頂の赤。ゲームの鶴はこの特徴をもとにした学習用の表現です。"),
]

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ShindenLearningGame/1.0 (educational image attribution)"})
    for attempt in range(4):
        try:
            return urllib.request.urlopen(req, timeout=35).read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))

def clean(text):
    return html.unescape(re.sub("<[^>]+>", "", text)).strip()

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    query = {"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": "900", "titles": "|".join("File:" + c[2] for c in CATALOG)}
    result = json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(query)))
    pages = {p["title"]: p for p in result["query"]["pages"].values()}
    records = []
    for slug, ids, title, caption, note in CATALOG:
        info = pages["File:" + title]["imageinfo"][0]
        metadata = info["extmetadata"]
        value = lambda key: clean(metadata.get(key, {}).get("value", ""))
        license_name = value("LicenseShortName")
        if not (license_name.startswith("CC BY") or license_name in ["CC0", "Public domain"]):
            raise ValueError("Unreviewed license: " + title + " " + license_name)
        url = info.get("thumburl", info["url"]).split("?")[0]
        image = fetch(url)
        if not image.startswith(b"\xff\xd8"):
            raise ValueError("Expected JPEG: " + title)
        target = DEST / (slug + ".jpg")
        target.write_bytes(image)
        record = {"id": slug, "items": ids, "src": "assets/codex/" + target.name,
                  "caption": caption, "note": note, "kind": "photo", "source": info["descriptionurl"],
                  "author": value("Artist") or "The Metropolitan Museum of Art", "license": license_name,
                  "licenseUrl": value("LicenseUrl") or info["descriptionurl"], "original": info["url"],
                  "width": info.get("thumbwidth", info["width"]), "height": info.get("thumbheight", info["height"]),
                  "changes": "Wikimedia Commonsの縮小表示用JPEGを同梱。色・内容・トリミングの変更なし。", "bytes": len(image)}
        records.append(record)
        print(slug, license_name, len(image), flush=True)
    (DEST / "credits.json").write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    inline = [{**record, "dataUrl": "data:image/jpeg;base64," + base64.b64encode((ROOT / record["src"]).read_bytes()).decode("ascii")} for record in records]
    (ROOT / "src/app/codex-media.js").write_text("const CODEX_MEDIA=" + json.dumps(inline, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8", newline="\n")

if __name__ == "__main__":
    main()
