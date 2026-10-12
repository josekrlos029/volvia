#!/usr/bin/env bash
# Raw Play Store captures from the emulator, against the isolated e2e stack (never prod):
#   1. API on :8081 with apps/ios/.env.local (docs/APPS-NATIVAS.md), emulator running.
#   2. ./gradlew :app:installDebug -Pvolvia.apiUrl=http://10.0.2.2:8081
#   3. bash apps/android/store/capture.sh   → apps/android/store/raw/*.png, then node frame.mjs
#
# Card tokens come from the seeded "Café Raíces" business in volvia_e2e; override with
# STAMP_TOKEN / REWARD_TOKEN / QUEUED_TOKEN (a card at 9 of 10 stamps for the reward).
set -euo pipefail
ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"
OUT="$(cd "$(dirname "$0")" && pwd)/raw"
mkdir -p "$OUT"
PKG=co.volvia.biz
CARD=https://tarjeta.somosvolvia.com/c
EMAIL="${EMAIL:-hola@cafe-raices.test}"
PASSWORD="${PASSWORD:-volvia-local-2026}"

shot() { sleep "${2:-2}"; "$ADB" exec-out screencap -p > "$OUT/$1.png"; echo "  $1"; }

# Taps the centre of the first node whose text matches, from the accessibility tree.
tap_text() {
  "$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null
  local bounds
  bounds=$("$ADB" exec-out cat /sdcard/ui.xml | python3 -c "
import re,sys
xml=sys.stdin.read()
for m in re.finditer(r'<node [^>]*>', xml):
    n=m.group(0)
    t=re.search(r' text=\"([^\"]*)\"', n); d=re.search(r'content-desc=\"([^\"]*)\"', n)
    if (t and t.group(1)==sys.argv[1]) or (d and d.group(1)==sys.argv[1]):
        b=list(map(int,re.findall(r'\d+', re.search(r'bounds=\"([^\"]*)\"', n).group(1))))
        print((b[0]+b[2])//2, (b[1]+b[3])//2); break
" "$1")
  [ -n "$bounds" ] || { echo "no node '$1'" >&2; exit 1; }
  "$ADB" shell input tap $bounds
}

# Tap the n-th EditText (login fields carry no text of their own).
tap_field() {
  "$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null
  local bounds
  bounds=$("$ADB" exec-out cat /sdcard/ui.xml | python3 -c "
import re,sys
nodes=[n for n in re.findall(r'<node [^>]*>', sys.stdin.read()) if 'android.widget.EditText' in n]
b=list(map(int,re.findall(r'\d+', re.search(r'bounds=\"([^\"]*)\"', nodes[int(sys.argv[1])]).group(1))))
print((b[0]+b[2])//2, (b[1]+b[3])//2)" "$1")
  "$ADB" shell input tap $bounds
}

scan() { "$ADB" shell am start --activity-single-top -n $PKG/.MainActivity --es scan "$CARD/$1" >/dev/null; }

# Clean status bar: 9:41, full battery and signal, no notifications.
"$ADB" shell settings put global sysui_demo_allowed 1
demo() { "$ADB" shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }
demo enter
demo clock -e hhmm 0941
demo battery -e level 100 -e plugged false
demo network -e wifi show -e level 4
demo network -e mobile hide
demo notifications -e visible false
"$ADB" shell cmd uimode night "${NIGHT:-no}" >/dev/null

"$ADB" shell pm clear $PKG >/dev/null
"$ADB" shell pm grant $PKG android.permission.CAMERA
"$ADB" shell am start -n $PKG/.MainActivity --ez simCamera true >/dev/null
shot login 4

tap_field 0; "$ADB" shell input text "$EMAIL"
tap_field 1; "$ADB" shell input text "$PASSWORD"
"$ADB" shell input keyevent KEYCODE_BACK
tap_text Entrar
shot aim 5

scan "${STAMP_TOKEN:-XmN_V1aULcvx0MlOkJwz7vp2TZEmCEWg}"; shot stamped 4
scan "${REWARD_TOKEN:-lqg0YbmEWvA10HQHOwQJ3iDvvG8XQXWW}"; shot reward 4

# Offline: the stamp is saved and the header counts it.
"$ADB" shell svc wifi disable; "$ADB" shell svc data disable; sleep 3
scan "${QUEUED_TOKEN:-jVfuG1lB6s9sTkSxUc3dggyyXS0JKglq}"; shot queued 6
"$ADB" shell svc wifi enable; "$ADB" shell svc data enable; sleep 6

tap_text "Siguiente cliente"; sleep 1
# Back to the foreground flushes the queue, so the sheet reads "Todo enviado".
"$ADB" shell input keyevent KEYCODE_HOME; sleep 1
"$ADB" shell am start -n $PKG/.MainActivity >/dev/null; sleep 4
tap_text Cuenta
shot account 3

demo exit
echo "raw captures in $OUT"
