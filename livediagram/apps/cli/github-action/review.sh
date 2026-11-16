#!/usr/bin/env bash
# The livediagram review Action's step (docs/specs/027-repositories/blueprints/link-review.md "The Action"):
# `link review` over the pull request, its pictures committed to a branch of this repository, and one comment
# edited in place on every push. Needs only the workflow's GITHUB_TOKEN (contents: write, pull-requests: write).
set -euo pipefail

: "${REVIEW_PR:?run this Action on pull_request events}"
: "${REVIEW_BASE:?no base commit}" "${REVIEW_HEAD:?no head commit}"
repo="${GITHUB_REPOSITORY:?}"
server="${GITHUB_SERVER_URL:-https://github.com}"
branch="${REVIEW_BRANCH:-livediagram-previews}"
out="${RUNNER_TEMP:-/tmp}/livediagram-review"
marker='<!-- livediagram-review -->'
bot='github-actions[bot]'
attempts=3
cli=(npx --yes "@livediagram/cli@${REVIEW_CLI_VERSION:-0.3.0}")
[[ -n "${REVIEW_CLI:-}" ]] && read -r -a cli <<<"$REVIEW_CLI"

# The merge base must be here: a shallow checkout gets the base commit and enough history to reach it.
if [[ "$(git rev-parse --is-shallow-repository)" == true ]]; then
  git fetch --no-tags --quiet --unshallow origin || true
fi
git cat-file -e "${REVIEW_BASE}^{commit}" 2>/dev/null || git fetch --no-tags --quiet origin "$REVIEW_BASE"

# A fork's token is read-only: the pictures and comment go to an artifact instead.
if [[ "${REVIEW_FORK:-false}" == true ]]; then
  "${cli[@]}" link review "$REVIEW_BASE" "$REVIEW_HEAD" --out "$out" >/dev/null
  echo "fork=true" >>"${GITHUB_OUTPUT:-/dev/null}"
  echo "This pull request comes from a fork, whose token cannot comment: the diagram pictures and comment.md are in the livediagram-review artifact." >>"${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi

image_url="${server}/${repo}/blob/${branch}/pr-${REVIEW_PR}/{file}?raw=true"
result="$("${cli[@]}" --json link review "$REVIEW_BASE" "$REVIEW_HEAD" --out "$out" --image-url "$image_url")"
tabs="$(jq -r '.tabs' <<<"$result")"
pictures="$(jq -r '.pictures | length' <<<"$result")"
echo "tabs=${tabs}" >>"${GITHUB_OUTPUT:-/dev/null}"

# The pictures, committed to the previews branch under pr-<n>/. A push that loses a race starts again from the
# branch's new tip, so no history beyond that tip is ever needed. Every step returns on failure (errexit is off
# inside a function called as a condition).
commit_pictures() {
  local tree="$1" try="$2"
  if git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
    git -C "$tree" fetch --no-tags --quiet --depth=1 origin "$branch" || return 1
    git -C "$tree" checkout --quiet --force --detach FETCH_HEAD || return 1
  else
    git -C "$tree" switch --quiet --force --orphan "livediagram-previews-$$-${try}" || return 1
  fi
  git -C "$tree" clean -fdxq || return 1
  mkdir -p "$tree/pr-${REVIEW_PR}" || return 1
  cp "$out"/*.png "$tree/pr-${REVIEW_PR}/" || return 1
  git -C "$tree" add "pr-${REVIEW_PR}" || return 1
  git -C "$tree" diff --cached --quiet && return 0
  git -C "$tree" -c user.name="$bot" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit --quiet -m "livediagram: pictures for #${REVIEW_PR}" || return 1
  git -C "$tree" push --quiet origin "HEAD:refs/heads/${branch}"
}

if ((pictures > 0)); then
  tree="$(mktemp -d)"
  git worktree add --quiet --detach "$tree" HEAD
  for ((try = 1; ; try++)); do
    commit_pictures "$tree" "$try" && break
    if ((try >= attempts)); then
      echo "::error::could not push the pictures to ${branch} after ${attempts} attempts"
      exit 1
    fi
  done
  git worktree remove --force "$tree"
fi

# One comment: the bot's own that opens with the marker, edited in place; posted only once there is a change.
existing="$(gh api --paginate "repos/${repo}/issues/${REVIEW_PR}/comments" \
  --jq ".[] | select(.user.login == \"${bot}\" and (.body | startswith(\"${marker}\"))) | .id" | head -n 1)"
if [[ -n "$existing" ]]; then
  gh api --method PATCH "repos/${repo}/issues/comments/${existing}" -F "body=@${out}/comment.md" >/dev/null
  echo "Edited the diagram comment (${tabs} changed tabs)."
elif ((tabs > 0)); then
  gh api --method POST "repos/${repo}/issues/${REVIEW_PR}/comments" -F "body=@${out}/comment.md" >/dev/null
  echo "Posted the diagram comment (${tabs} changed tabs)."
else
  echo "No diagram changes; no comment."
fi
