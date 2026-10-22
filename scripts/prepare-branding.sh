#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v magick >/dev/null || command -v convert >/dev/null || { echo 'ImageMagick (magick oder convert) wird benötigt.' >&2; exit 1; }
mkdir -p public/branding build

IM="magick"
if ! command -v magick >/dev/null; then
  IM="convert"
fi

# Extract the large app icon from the supplied sheet, keeping its proportions.
$IM docs/branding/brand-sheet.png -crop 407x396+53+37 +repage \
  -resize 464x464 -gravity center -background none -extent 512x512 public/branding/icon-512.png
for size in 16 32 48 64 128 192 256; do
  $IM public/branding/icon-512.png -resize "${size}x${size}" "public/branding/icon-${size}.png"
done
$IM docs/branding/brand-sheet.png -crop 407x396+53+37 +repage \
  -resize 416x416 -gravity center -background '#12161f' -extent 512x512 \
  -alpha remove public/branding/icon-maskable-512.png
$IM public/branding/icon-maskable-512.png -resize 192x192 public/branding/icon-maskable-192.png
$IM public/branding/icon-512.png -background '#12161f' -alpha remove \
  -resize 180x180 public/branding/apple-touch-icon.png
$IM public/branding/icon-512.png -define icon:auto-resize=256,128,64,48,32,24,16 build/icon.ico
cp build/icon.ico public/favicon.ico

$IM docs/branding/brand-sheet.png -crop 1672x450+500+0 +repage \
  -trim +repage -resize '1200x>' public/branding/logo.png
$IM docs/branding/logo-dark-source.png -trim +repage \
  -resize '1200x>' public/branding/logo-dark.png
echo 'Schematico: Logos sowie Web-, App- und Windows-Icons erzeugt.'
