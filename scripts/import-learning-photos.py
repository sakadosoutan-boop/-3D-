"""Acquire the two verified reference photographs and regenerate the offline media array.

This script changes photo assets and codex-media.js only. It never builds the application HTML.
Sources and permissions were checked on 2026-10-08; see docs/selected-learning.md.
"""
import base64
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ADDITIONS = [
    {
        "id": "byoubu", "items": ["byoubu"], "src": "assets/codex/byoubu.jpg",
        "caption": "六曲屏風の部分 · 芥子図屏風の右端二面",
        "note": "メトロポリタン美術館所蔵、17世紀初頭の六曲屏風（62.36.1）の右端二面を撮影した資料。縁・面の継ぎ目・画面の質感を比べる後世の資料です。平安期の絵柄の復元例ではありません。",
        "kind": "photo",
        "source": "https://commons.wikimedia.org/wiki/File:%E8%8A%A5%E5%AD%90%E5%9B%B3%E5%B1%8F%E9%A2%A8-Red_and_White_Poppies_MET_ASA236.jpg",
        "collectionSource": "https://www.metmuseum.org/art/collection/search/44914",
        "author": "The Metropolitan Museum of Art（作品: 伝土佐光茂筆・帰属は未確定）",
        "license": "CC0", "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "original": "https://upload.wikimedia.org/wikipedia/commons/8/87/%E8%8A%A5%E5%AD%90%E5%9B%B3%E5%B1%8F%E9%A2%A8-Red_and_White_Poppies_MET_ASA236.jpg",
        "changes": "長辺1200pxへ縮小・JPEG再圧縮。色調・内容・トリミングの変更なし。",
        "verifiedOn": "2026-10-08",
    },
    {
        "id": "ryuteki", "items": ["ryuteki"], "src": "assets/codex/ryuteki.jpg",
        "caption": "下段が龍笛、上段が高麗笛 · 実物の比較資料",
        "note": "メトロポリタン美術館所蔵の19世紀の楽器。写真下段のケースにある長い管が龍笛（48.126.1）、上段は高麗笛です。平安期の個体ではなく、管・漆塗りのケースを比べる参考写真です。",
        "kind": "photo",
        "source": "https://commons.wikimedia.org/wiki/File:Komabue_and_Ryuteki_fue.jpg",
        "collectionSource": "https://www.metmuseum.org/art/collection/search/503033",
        "author": "unforth / Claire H.", "license": "CC BY-SA 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0/",
        "original": "https://upload.wikimedia.org/wikipedia/commons/a/ab/Komabue_and_Ryuteki_fue.jpg",
        "changes": "長辺1200pxへ縮小・JPEG再圧縮。色調・内容・トリミングの変更なし。写真の再利用にはCC BY-SA 2.0が適用されます。",
        "verifiedOn": "2026-10-08",
    },
]


def main():
    credits_path = ROOT / "assets/codex/credits.json"
    credits = json.loads(credits_path.read_text(encoding="utf-8"))
    for entry in ADDITIONS:
        request = Request(entry["original"], headers={"User-Agent": "ShindenLearningReference/1.0 (educational offline asset import)"})
        with urlopen(request, timeout=60) as response:
            photo = Image.open(io.BytesIO(response.read()))
            photo.load()
        photo = photo.convert("RGB")
        photo.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        target = ROOT / entry["src"]
        photo.save(target, "JPEG", quality=88, optimize=True)
        entry.update(width=photo.width, height=photo.height, bytes=target.stat().st_size)
        credits = [old for old in credits if old["id"] != entry["id"]] + [entry]
        print(f'{entry["id"]}: {photo.width} x {photo.height}, {entry["bytes"]} bytes')
    credits_path.write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    inline = [dict(entry, dataUrl="data:image/jpeg;base64," + base64.b64encode((ROOT / entry["src"]).read_bytes()).decode("ascii")) for entry in credits]
    (ROOT / "src/app/codex-media.js").write_text("/* Licensed local photographs, also embedded for single-file offline use. */\nconst CODEX_MEDIA=" + json.dumps(inline, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")


if __name__ == "__main__":
    main()
