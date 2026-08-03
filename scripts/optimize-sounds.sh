#!/usr/bin/env bash
# sounds/*.mp3 を配信向けに再エンコードする(スマホ回線での初回ロードを軽くするため)。
#   ボス戦BGM  : 96kbps ステレオ(音楽なので帯域を残す)
#   それ以外    : 64kbps モノラル(環境音・鳴き声・SEは定位をコード側で付けるためモノラルで足りる)
# 既に目標以下のビットレート かつ モノラルのファイルは再エンコードしない(世代劣化を避ける)。
# ffmpeg が PATH に無い場合は imageio-ffmpeg の同梱バイナリを探す。
set -euo pipefail
cd "$(dirname "$0")/.."

FF="${FFMPEG:-$(command -v ffmpeg || true)}"
if [ -z "$FF" ]; then
  FF=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())" 2>/dev/null || true)
fi
if [ -z "$FF" ]; then
  echo "ffmpeg が見つかりません。apt install ffmpeg か pip install imageio-ffmpeg を実行してください。" >&2
  exit 1
fi

is_boss() {
  case "$1" in
    九尾狐戦.mp3|提灯・河童戦.mp3|人魂・大鬼戦.mp3|雪女戦.mp3) return 0 ;;
    *) return 1 ;;
  esac
}

total_before=0; total_after=0
for f in sounds/*.mp3; do
  base=$(basename "$f")
  probe=$("$FF" -hide_banner -i "$f" 2>&1 | grep -m1 "Audio:" || true)
  br=$(printf '%s' "$probe" | sed -n 's/.*, \([0-9]\+\) kb\/s.*/\1/p')
  ch=$(printf '%s' "$probe" | grep -o -m1 "stereo\|mono" || echo mono)
  [ -z "$br" ] && br=999
  before=$(stat -c%s "$f")

  if is_boss "$base"; then
    target=96; opts=(-ac 2 -b:a 96k)
    [ "$br" -le 100 ] && { total_before=$((total_before+before)); total_after=$((total_after+before)); continue; }
  else
    target=64; opts=(-ac 1 -b:a 64k)
    if [ "$br" -le 72 ] && [ "$ch" = "mono" ]; then
      total_before=$((total_before+before)); total_after=$((total_after+before)); continue
    fi
  fi

  tmp="${f%.mp3}.opt.mp3"
  "$FF" -v error -y -i "$f" -vn -map_metadata -1 -codec:a libmp3lame "${opts[@]}" "$tmp"
  after=$(stat -c%s "$tmp")
  mv "$tmp" "$f"
  total_before=$((total_before+before)); total_after=$((total_after+after))
  printf '%-44s %6dKB -> %6dKB (%dkbps)\n' "$base" $((before/1024)) $((after/1024)) "$target"
done

printf '\n合計 %dKB -> %dKB\n' $((total_before/1024)) $((total_after/1024))
