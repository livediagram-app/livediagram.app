#!/bin/bash
# Usage: watch-prs.sh <pr>...  Emits one line per PR as soon as a check fails, when its checks all pass, or when it conflicts, then exits.
# bash 3.2-safe (macOS has no associative arrays). Uses gh from PATH, else Homebrew's.
GH=$(command -v gh || echo /opt/homebrew/bin/gh)
REPO=$($GH repo view --json nameWithOwner -q .nameWithOwner) || exit 1
finished=" "
remaining=$#
while [ $remaining -gt 0 ]; do
  for n in "$@"; do
    [[ "$finished" == *" $n "* ]] && continue
    checks=$($GH pr checks $n -R "$REPO" --json name,bucket 2>/dev/null) || continue
    m=$($GH pr view $n -R "$REPO" --json state,mergeable,mergeStateStatus --jq '"\(.state) \(.mergeable) \(.mergeStateStatus)"' 2>/dev/null) || continue
    if [[ "$m" == MERGED* || "$m" == CLOSED* ]]; then echo "PR $n: $m"; finished="$finished$n "; remaining=$((remaining-1)); continue; fi
    if [[ "$m" == *CONFLICTING* ]]; then echo "PR $n: CONFLICTING ($m)"; finished="$finished$n "; remaining=$((remaining-1)); continue; fi
    # A failure is reported the moment it lands, not once the whole run has finished.
    failed=$(echo "$checks" | python3 -c 'import json,sys;print(", ".join(c["name"] for c in json.load(sys.stdin) if c["bucket"] in ("fail","cancel")))')
    pending=$(echo "$checks" | python3 -c 'import json,sys;print(sum(c["bucket"]=="pending" for c in json.load(sys.stdin)))')
    [ -z "$failed" ] && [ "$pending" != "0" ] && continue
    if [ -n "$failed" ]; then echo "PR $n: RED [$failed] ($m, $pending still running)"; else
      [[ "$m" == *UNKNOWN* ]] && continue
      echo "PR $n: GREEN ($m)"; fi
    finished="$finished$n "; remaining=$((remaining-1))
  done
  [ $remaining -gt 0 ] && sleep 60
done
exit 0
