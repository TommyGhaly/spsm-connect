#!/bin/zsh
# Renders every custom product page asset from shots.html, the way Taksis does
# (Taksis/screenshots/custom-product-pages/src/render.sh), into one folder per
# App Store Connect slot, numbered in upload order:
#   <page>/1-iPhone-6.9/              1320 x 2868  (rendered)
#   <page>/2-iPhone-6.3/              1206 x 2622  (downscaled from 6.9 -- same aspect ratio)
#   <page>/3-iPad-13/                 2064 x 2752  (rendered, portrait)
#   <page>/4-Header-Asset/            3840 x 1646
#   <page>/5-Search-Results-Asset/    3840 x 2560
#   <page>/alternate-5244x2950/       accepted by both the header and search slots
# then writes each page's promotional-text.txt, deep-link.txt and README.md.
#
# The screens inside the frames are real captures, from store/raw/. Take them
# first with `npm run screenshots:ios` (or PAGES_ONLY=1 for just the ones only
# these pages use) and look at them before rendering.
cd "${0:A:h}/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="file://${PWD}/src/shots.html"

[[ -x $CHROME ]] || { echo "Needs Google Chrome at $CHROME" >&2; exit 1; }
for f in ../raw/ios/6.9/{1-belief,3-forms,4-bookstore,5-giving}.png \
         ../raw/pages/ios/6.9/{calendar,welcome,plans,livestream}.png \
         ../raw/ios/13/{1-belief,3-forms,4-bookstore,5-giving}.png \
         ../raw/pages/ios/13/{calendar,welcome,plans,livestream}.png; do
  [[ -s $f ]] || { echo "Missing capture $f. Run scripts/capture-screenshots.sh." >&2; exit 1; }
done

# shot <query> <WxH> <out.png>
# Chrome hangs on exit after writing its screenshot (and exits non-zero when it does finish),
# so each job waits for its file rather than the process, then kills that Chrome. At most
# MAX_JOBS run at once; launching them all together starves some past any fixed timeout.
# --virtual-time-budget holds the screenshot until the captures and EB Garamond have loaded.
MAX_JOBS=8
shot() {
  mkdir -p "${3:h}"
  rm -f "$3"
  while (( $(jobs -r | wc -l) >= MAX_JOBS )); do sleep 0.3; done
  (
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
      --virtual-time-budget=4000 --allow-file-access-from-files \
      --window-size=${2/x/,} --user-data-dir="$(mktemp -d)" \
      --screenshot="${PWD}/$3" "${SRC}?$1" >/dev/null 2>&1 &
    pid=$!
    for _ in {1..300}; do [[ -s $3 ]] && break; sleep 0.2; done
    sleep 0.5  # let the PNG finish flushing
    kill $pid 2>/dev/null
  ) &
  outputs+=("$3")
}

# Folders are rebuilt from scratch so a shot removed from SHOTS leaves no stale file behind.
pages=(give bookstore week newcomers forms plans listing)
for page in $pages; do
  rm -rf "$page"/{1-iPhone-6.9,2-iPhone-6.3,3-iPad-13,4-Header-Asset,5-Search-Results-Asset,alternate-5244x2950}
done

outputs=()
ids=(${(f)"$(grep -oE "^  '[a-z]+-[0-9]+'" src/shots.html | tr -d " '")"})
for id in $ids; do
  shot "shot=$id" 1320x2868 "${id%-*}/1-iPhone-6.9/$id.png"
  shot "ipad=$id" 2064x2752 "${id%-*}/3-iPad-13/$id.png"
done
for page in $pages; do
  shot "banner=$page&size=3840x1646" 3840x1646 "$page/4-Header-Asset/$page-header.png"
  shot "banner=$page&size=3840x2560" 3840x2560 "$page/5-Search-Results-Asset/$page-search.png"
  shot "banner=$page&size=5244x2950" 5244x2950 "$page/alternate-5244x2950/$page-5244x2950.png"
done

wait

for f in $outputs; do
  [[ -s $f ]] && echo "rendered $f" || { echo "MISSING $f"; exit 1; }
done

for f in */1-iPhone-6.9/*.png; do
  out="${f/1-iPhone-6.9/2-iPhone-6.3}"
  mkdir -p "${out:h}"
  sips -z 2622 1206 "$f" --out "$out" >/dev/null && echo "scaled   $out"
done

python3 src/page_readmes.py
