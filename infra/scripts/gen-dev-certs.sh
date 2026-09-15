#!/usr/bin/env bash
#
# Generates self-signed development certificates for wallet passes.
#
# These produce a structurally correct .pkpass — the same manifest, the same detached
# PKCS#7 signature — which is what the test suite verifies. A real iPhone will still
# refuse to install it: only a certificate issued by Apple against your Pass Type ID
# chains to their root. Drop those in and flip WALLET_MODE=real when you have them.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CERTS="$ROOT/infra/certs"
PASS_TYPE_ID="${APPLE_PASS_TYPE_ID:-pass.co.volvia.loyalty}"

mkdir -p "$CERTS"

if [[ -f "$CERTS/pass-cert.pem" && "${FORCE:-}" != "1" ]]; then
  echo "✓ dev certificates already exist (FORCE=1 to regenerate)"
  exit 0
fi

echo "→ generating development pass certificate for $PASS_TYPE_ID"

# The UID field carries the pass type identifier, exactly as Apple issues it.
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$CERTS/pass-key.pem" \
  -out "$CERTS/pass-cert.pem" \
  -days 825 \
  -subj "/UID=$PASS_TYPE_ID/CN=Volvia Pass Development/OU=DEV0000000/O=Volvia/C=CO" \
  2>/dev/null

# Stand-in for the Apple WWDR intermediate so the signing path exercises the same code.
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$CERTS/wwdr-key.pem" \
  -out "$CERTS/wwdr.pem" \
  -days 825 \
  -subj "/CN=Volvia Development Intermediate/O=Volvia/C=CO" \
  2>/dev/null

# Google Wallet service account placeholder: real key, fake identity, so JWT signing
# is exercised end to end without contacting Google.
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$CERTS/google-wallet-key.pem" 2>/dev/null

python3 - "$CERTS" <<'PY'
import json, pathlib, sys
certs = pathlib.Path(sys.argv[1])
key = (certs / 'google-wallet-key.pem').read_text()
(certs / 'google-wallet-sa.json').write_text(json.dumps({
    'type': 'service_account',
    'project_id': 'volvia-dev',
    'private_key_id': 'dev',
    'private_key': key,
    'client_email': 'volvia-dev@example.iam.gserviceaccount.com',
    'client_id': '000000000000000000000',
    'token_uri': 'https://oauth2.googleapis.com/token',
}, indent=2))
PY

chmod 600 "$CERTS"/*.pem "$CERTS"/*.json
echo "✓ development certificates written to infra/certs/"
echo "  These are for local development only and are git-ignored."
