#!/usr/bin/env bash
# Haalt alle Higgsfield-beelden en -video's binnen, verkleint ze en zet ze in assets/.
set -euo pipefail
CDN="https://d8j0ntlcm91z4.cloudfront.net/user_3H2FAjydQqLsAIRD9wpl2Hgvsnz"
mkdir -p assets
SMALL=" $(cat tools/small.txt | tr '\n' ' ') "
for id in $(grep -oh "hf_2026[0-9]\{4\}_[0-9]\{6\}_[0-9a-f-]\{36\}" index.html team.html | sort -u); do
  if curl -sfI "$CDN/$id.mp4" >/dev/null; then
    [ -f "assets/$id.mp4" ] || { curl -sf "$CDN/$id.mp4" -o /tmp/v.mp4; ffmpeg -loglevel error -y -i /tmp/v.mp4 -an -vf "scale=480:-2" -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -movflags +faststart "assets/$id.mp4"; }
  fi
  if curl -sfI "$CDN/$id.png" >/dev/null; then
    [ -f "assets/$id.webp" ] || { curl -sf "$CDN/$id.png" -o /tmp/i.png
      if [[ "$SMALL" == *" $id "* ]]; then S=320; else S=1100; fi
      cwebp -quiet -q 80 -alpha_q 90 -resize $(python3 -c "from PIL import Image;w,h=Image.open('/tmp/i.png').size;s=min(1,$S/max(w,h));print(round(w*s),round(h*s))") /tmp/i.png -o "assets/$id.webp"; }
  fi
done
ls -la assets | tail -n +2 | awk '{s+=$5} END {print NR" bestanden, "s/1e6" MB"}'
