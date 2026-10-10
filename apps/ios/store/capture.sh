#!/usr/bin/env bash
# Raw store screenshots from the simulators, one per app state, at the exact sizes App
# Store Connect accepts: iPhone 17 Pro Max → 1320×2868 (6.9"), iPad Pro 13" → 2064×2752.
#
#   bash capture.sh            build, install, capture both devices
#   SKIP_BUILD=1 bash capture.sh
#   DEVICES=iphone STATES="login aim" bash capture.sh
#
# Plain bash 3 (what macOS ships), hence the case statements instead of arrays.
set -euo pipefail

cd "$(dirname "$0")/.."
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
BUNDLE=co.volvia.biz
APP=build/DerivedData/Build/Products/Debug-iphonesimulator/VolviaBiz.app
STATES="${STATES:-login aim stamped reward queued account}"
RAW=store/raw

device_name() { case "$1" in iphone) echo "iPhone 17 Pro Max";; ipad) echo "iPad Pro 13-inch (M5)";; esac; }
device_size() { case "$1" in iphone) echo "1320x2868";; ipad) echo "2064x2752";; esac; }
png_size() { echo "$(sips -g pixelWidth "$1" | awk '/pixelWidth/{print $2}')x$(sips -g pixelHeight "$1" | awk '/pixelHeight/{print $2}')"; }

udid_for() {
  xcrun simctl list devices available -j \
    | python3 -I -c "import json,sys; d=json.load(sys.stdin)['devices']; print(next(x['udid'] for r in d.values() for x in r if x['name']==sys.argv[1]))" "$1"
}

if [[ "${SKIP_BUILD:-}" != "1" ]]; then
  [[ -d VolviaBiz.xcodeproj ]] || xcodegen generate
  xcodebuild -project VolviaBiz.xcodeproj -scheme VolviaBiz -configuration Debug \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath build/DerivedData build \
    | grep -E "error:|BUILD" || true
fi
[[ -d "$APP" ]] || { echo "no app at $APP"; exit 1; }

for device in ${DEVICES:-iphone ipad}; do
  name=$(device_name "$device"); expected=$(device_size "$device")
  udid=$(udid_for "$name")
  echo "== $name ($udid)"
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b >/dev/null
  xcrun simctl ui "$udid" appearance light
  # The status bar Apple uses in its own marketing.
  xcrun simctl status_bar "$udid" override --time 9:41 --dataNetwork wifi --wifiMode active \
    --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
  xcrun simctl install "$udid" "$APP"
  mkdir -p "$RAW/$device"

  for state in $STATES; do
    # VOLVIA_API_URL points at a closed port so nothing can reach a real server even if
    # the fixture guard were bypassed. SIMCTL_CHILD_ passes variables to the app.
    SIMCTL_CHILD_VOLVIA_SIM_STATE="$state" SIMCTL_CHILD_VOLVIA_API_URL="http://127.0.0.1:9" \
      xcrun simctl launch --terminate-running-process "$udid" "$BUNDLE" >/dev/null
    if [[ "$state" == "account" ]]; then sleep 4; else sleep 2.5; fi
    out="$RAW/$device/$state.png"
    xcrun simctl io "$udid" screenshot --type=png "$out" >/dev/null
    actual=$(png_size "$out")
    [[ "$actual" == "$expected" ]] || { echo "$out is $actual, expected $expected"; exit 1; }
    echo "  $state → $out ($actual)"
  done

  # Leave the simulator signed out and the status bar normal.
  SIMCTL_CHILD_VOLVIA_SIM_STATE=login xcrun simctl launch --terminate-running-process "$udid" "$BUNDLE" >/dev/null
  sleep 1
  xcrun simctl terminate "$udid" "$BUNDLE" 2>/dev/null || true
  xcrun simctl status_bar "$udid" clear
done
echo "raw screenshots in $RAW"
