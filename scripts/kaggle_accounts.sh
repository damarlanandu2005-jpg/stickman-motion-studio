# source this file.  Two Kaggle accounts: 1 = KAGGLE_USERNAME/KAGGLE_KEY (owns the dataset), 2 = KAGGLE_USERNAME_2/KAGGLE_KEY_2 (collaborator on it).
# ka_init   : decide the active account (KAGGLE_FIRST, default 1; a file remembers a switch made earlier in this run)
# ka_swap   : switch to the other account (only if it is configured); used when a Kaggle step failed (for example the weekly GPU hours are used up)
# ka_user   : name of the active account (owner of the kernel)
# DATASET_OWNER stays account 1 for every run, so the pictures drawn so far are shared by both accounts.
KA_STATE="${KA_STATE:-$HOME/.kaggle_active}"
export DATASET_OWNER="${DATASET_OWNER:-$(echo "${KA_U1:-${KAGGLE_USERNAME:-}}" | tr -d '[:space:]')}"
[ -z "${KA_U1:-}" ] && export KA_U1="$(echo "${KAGGLE_USERNAME:-}" | tr -d '[:space:]')" KA_K1="${KAGGLE_KEY:-}" KA_U2="$(echo "${KAGGLE_USERNAME_2:-}" | tr -d '[:space:]')" KA_K2="${KAGGLE_KEY_2:-}"
ka_have2() { [ -n "$KA_U2" ] && [ -n "$KA_K2" ]; }
ka_use() {
  local n="$1" u k
  if [ "$n" = "2" ] && ka_have2; then u="$KA_U2"; k="$KA_K2"; else n=1; u="$KA_U1"; k="$KA_K1"; fi
  export KAGGLE_USERNAME="$u" KAGGLE_KEY="$k"; echo "$n" > "$KA_STATE"
  mkdir -p "$HOME/.kaggle"; python3 -c "import json,sys;json.dump({'username':sys.argv[1],'key':sys.argv[2]},open(sys.argv[3],'w'))" "$u" "$k" "$HOME/.kaggle/kaggle.json"; chmod 600 "$HOME/.kaggle/kaggle.json"
  echo "[kaggle] using account $n ($u), dataset owner $DATASET_OWNER"
}
ka_init() { local n; n=$(cat "$KA_STATE" 2>/dev/null || echo "${KAGGLE_FIRST:-1}"); ka_use "$n"; }
ka_swap() { local n; n=$(cat "$KA_STATE" 2>/dev/null || echo 1); if ka_have2; then if [ "$n" = "1" ]; then ka_use 2; else ka_use 1; fi; else echo "[kaggle] no second account configured"; fi; }
ka_user() { echo "$KAGGLE_USERNAME" | tr -d '[:space:]'; }

# ka_preflight: can each configured account see the shared dataset?  Chooses the first usable account (KAGGLE_FIRST order). Prints one line per account.
ka_preflight() {
  local order ok="" n out
  if [ "${KAGGLE_FIRST:-1}" = "2" ]; then order="2 1"; else order="1 2"; fi
  for n in $order; do
    if [ "$n" = "2" ] && ! ka_have2; then echo "[kaggle] account 2: not configured (secrets KAGGLE_USERNAME_2 / KAGGLE_KEY_2 are empty)"; continue; fi
    ka_use "$n" >/dev/null
    out=$(kaggle datasets status "$DATASET_OWNER/stickman-assets" 2>&1)
    if echo "$out" | grep -qi ready; then echo "[kaggle] account $n ($(ka_user)): dataset visible"; [ -z "$ok" ] && ok="$n"
    else echo "[kaggle] account $n ($(ka_user)): dataset NOT visible: $(echo "$out" | tail -2 | tr '\n' ' ')"; fi
  done
  if [ -n "$ok" ]; then ka_use "$ok"; else echo "[kaggle] NO account can see the dataset"; ka_use "${KAGGLE_FIRST:-1}"; fi
}
