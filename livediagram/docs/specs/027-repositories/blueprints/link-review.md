# Pull request review: blueprint

Derived from [Repository link](../repository-link.md) "Pull request review", with the mirror file of the
[repository link blueprint](repository-link.md), and the pictures (`graph render`, CLI30, CLI31) and output rules of
the [CLI blueprint](../../015-api/blueprints/cli.md). The spec decides; this file only adds engineering precision.
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) as `RLn`.

| File                                             | Role                                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `packages/agent-verbs/src/verbs/link.ts`         | `linkReview` (new): the `link.review` verb, local and offline; its input, output, text and JSON      |
| `packages/agent-verbs/src/catalogue.ts`          | `VERBS` gains `linkReview`                                                                           |
| `../packages/cli-kit/src/png.ts`                 | `writePicture` takes an optional `PictureSize` (`scale`, `maxSide`), passed to `renderPng` (new)     |
| `../packages/cli-kit/src/bin.ts`                 | `runBin` sends `console.log`/`info` to stderr and drops `console.debug`, so stdout carries data only |
| `apps/cli/src/render/png.ts`                     | Passes the size through                                                                              |
| `apps/cli/src/link/constants.ts`                 | The `REVIEW_*` constants (new)                                                                       |
| `apps/cli/src/link/review-git.ts`                | `reviewRange`, `changedMirrorPaths`, `fileAt` (new): the git `link review` asks                      |
| `apps/cli/src/link/review-diff.ts`               | `reviewDocuments` (new, pure): the files at both commits into documents, tabs and element changes    |
| `apps/cli/src/link/review-picture.ts`            | `reviewSvg` (new, pure): a tab drawn with its changed elements outlined                              |
| `apps/cli/src/link/review-comment.ts`            | `reviewCommentText` (new, pure): the comment, capped                                                 |
| `apps/cli/src/commands/review.ts`                | `linkReview` (new): the handler                                                                      |
| `apps/cli/src/main.ts`                           | `runOffline` routes `link.review`                                                                    |
| `apps/cli/github-action/action.yml`, `review.sh` | The composite Action and its script (new)                                                            |

## Domain and naming

| Term            | Identifier                                | Meaning                                                                     |
| --------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| Review          | command `link review`, verb `link.review` | Drawing what a change did to the mirror files                               |
| Range           | `ReviewRange` `{ base, head }`            | The merge base and the head, as full commit ids                             |
| Review file     | `ReviewFile` `{ path, file }`             | A mirror file read at one commit                                            |
| Document review | `DocumentReview`                          | One document's changed tabs, its host, id, name and path                    |
| Tab review      | `TabReview`                               | One changed tab: `status`, `before`, `after`, `added`, `changed`, `removed` |
| Tab status      | `'added' \| 'removed' \| 'changed'`       | Only at head, only at the base, or at both and different                    |
| Mark            | `ReviewMark` `{ id, kind }`               | One outlined element; `kind` is `added`, `changed` or `removed`             |
| Picture         | `ReviewPicture` `{ file, width, height }` | A written PNG, named `<hash>.png`                                           |
| Marker          | `REVIEW_MARKER`                           | `<!-- livediagram-review -->`, the comment's first line                     |
| Previews branch | `livediagram-previews`                    | The repository branch the Action commits pictures to                        |

Banned: "snapshot" for a picture, "diff" for the comment (the comment shows pictures; git owns the diff), "preview"
in CLI output (the pictures are before and after).

## Behaviour and state

### `link review` (`linkReview`)

1. `reviewRange(io, base, head)`: `git rev-parse --is-inside-work-tree`, then
   `git rev-parse --verify --quiet --end-of-options <ref>^{commit}` for each, then
   `git merge-base --end-of-options <base> <head>`. A ref git cannot resolve exits 2 `bad_revision` naming it; no merge base exits 2
   `no_merge_base` with the hint `fetch the full history (actions/checkout fetch-depth: 0)`; no git or no work tree
   (the first rev-parse answering null, non-zero or not `true`) exits 2 `not_a_repository`. A failing `diff` exits 1
   `git_failed`.
2. `changedMirrorPaths(io, range)`: `git diff --name-only -z --no-renames <base> <head> -- *.livediagram.json`,
   paths relative to the repository root, at or below the working directory (git's pathspec scope).
3. For each path, `fileAt(io, rev, path)` reads `git show <rev>:<path>` at the base and at head; null when the file is
   absent there. Each text read goes through `parsePullFile`. A head copy that fails is a skipped file
   `{ path, reason }` (`hasConflictMarkers` first, so it reads "has conflict markers") and its base copy is unused,
   so the document never reads as removed; a base copy that fails reads as absent, so a repaired file is drawn as
   new.
4. `reviewDocuments(before, after)` pairs files by `document.id` (RL45), then per document compares tabs by id:
   a tab whose `canonicalJson` is equal at both is skipped; otherwise the element ids split into `added` (head
   only), `removed` (base only) and `changed` (both, `canonicalJson` differs), in each tab's stored order. A document
   with no changed tab is dropped. Documents are in head's path order, removed documents after, by path.
5. The first `REVIEW_MAX_TABS` tabs, document by document, are drawn: `reviewSvg(tab, marks)` per side present,
   written with `writePicture(..., 'png', { scale: REVIEW_PNG_SCALE, maxSide: REVIEW_PNG_MAX_SIDE })` to
   `<out>/<first REVIEW_FILE_HEX of sha256(svg)>.png`; a drawing already written this run is not drawn again. The
   rest are listed.
6. `reviewCommentText` builds the comment; it is written to `<out>/comment.md`.
7. Output `{ lines, documents, tabs, drawn, listed, skipped, pictures }`: `lines` are `comment.md`'s path, then
   one `pictureLine` per picture.

### Marks (`reviewSvg`)

- After picture: `added` and `changed` ids. Before picture: `removed` and `changed` ids. Only ids drawn
  (`visibleLayerElements`) are marked.
- Each mark is a rounded rectangle around `contentBounds([el], undefined, tab.elements)` grown by
  `REVIEW_MARK_OFFSET` px, stroke `REVIEW_MARK_STROKE` px, no fill, inserted after every element before `</svg>`
  so nothing covers it. Styles (RL47): added `#1a7f37` solid; changed `#9a6700` dashed `8 5`; removed `#cf222e`
  dotted `2 5` with round caps.

### The comment (`reviewCommentText`)

```markdown
<!-- livediagram-review -->

### Diagram changes

<n> tab(s) changed in <m> document(s). Outlined: green solid is added, amber dashed is changed, red dotted is removed.

#### <document name>

[Open in livediagram](<host>/document/<id>) · `<path>`

**<tab name>** · <a> added, <c> changed, <r> removed[ · new tab| · tab removed]

| Before                    | After                    |
| ------------------------- | ------------------------ |
| ![<tab name> before](url) | ![<tab name> after](url) |

<details><summary><k> more tab(s) not drawn</summary>

- <document name> · <tab name> · <a> added, <c> changed, <r> removed

</details>

Not drawn: `<path>` (<reason>)
```

- No changed tab: the marker, the heading, then `No diagram changes in this pull request.`
- A side that is absent prints `(none)` in its cell. A tab holding an `image` element adds the line
  `Pictures on this tab are drawn as placeholders.`
- Names go through `markdownText`, paths through `codeSpan`; alt text is the name with `[`, `]` and line breaks
  removed.
- The link is printed only when the mirror file's `livediagramSync.host` parses as an `https:` URL (RL48);
  otherwise the document line holds the path alone.
- **Cap.** Sections are appended while the total stays under `REVIEW_COMMENT_MAX_CHARS` less the room the
  listing needs; a tab whose section would pass it moves to the listing, as do tabs past `REVIEW_MAX_TABS`.

### The Action (`review.sh`)

Inputs `token` (default `github.token`), `cli-version` (default the CLI version that ships the command), `base`
and `head` (default the event's pull request shas), `branch` (default `livediagram-previews`).

1. Same repository, or a fork (`head.repo.full_name` differs): a fork runs the review without `--image-url`,
   uploads `<out>` as the artifact `livediagram-review` (`actions/upload-artifact`) and writes one job summary line.
2. `npx --yes @livediagram/cli@<cli-version> --json link review <base> <head> --out <out> --image-url
https://github.com/<repo>/blob/<branch>/pr-<n>/{file}?raw=true`; the JSON's `drawn` and `tabs` decide the rest.
3. Pictures, when any: a worktree checked out at the previews branch's tip (fetched at depth 1, or an orphan when
   the branch does not exist), the pictures copied into `pr-<n>/`, one commit `livediagram: pictures for #<n>` as
   `github-actions[bot]` when anything is new, push. A rejected push starts again from the branch's new tip (never a
   rebase, which a depth-1 history cannot do), `REVIEW_PUSH_ATTEMPTS` in all, then fails the step.
4. Comment: `gh api --paginate repos/<repo>/issues/<n>/comments` filtered to `user.login == "github-actions[bot]"`
   and a body starting with the marker; the first found is edited (`PATCH`), else, when `tabs > 0`, one is posted.

## Interfaces and contracts

- **Verb.** `link.review`: `local`, `offline`, behaviour `read`. Input `base` (string, min 1), `head` (string,
  default `HEAD`), `out` (string, default `REVIEW_OUT_DIR`), `imageUrl` (string containing `{file}`, else exit 2
  `usage`: `--image-url needs {file} where the picture's name goes`). Positionals `base`, `head`.
- **JSON** (`--json`): `{ comment, documents, tabs, drawn, listed, skipped, pictures: [{ file, width, height }] }`.
- **Quiet**: the comment's path.
- Refs are passed after `--end-of-options`, so a ref starting with `-` is never read as a git option.

## Data and persistence

Nothing is stored beyond `<out>`. Re-running over the same range writes the same files byte for byte (pictures are
deterministic; their names are hashes). The previews branch only grows: a picture is never removed, so an edited
comment's earlier pictures stay reachable; deleting the branch is safe at any time and only blanks old pictures.

## Errors and edge cases

| Case                                     | Handling                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| Unknown ref                              | Exit 2 `bad_revision`, naming the ref                                                      |
| Shallow clone without the merge base     | Exit 2 `no_merge_base`, hint names `fetch-depth: 0`                                        |
| Not in a git work tree, or no git        | Exit 2 `not_a_repository`                                                                  |
| No changed mirror file                   | Exit 0, the one-line comment, no pictures                                                  |
| A changed file that is not a mirror file | Listed under "Not drawn", with its reason                                                  |
| A file added or removed whole            | Its tabs are `added` or `removed`; one picture each                                        |
| A file moved with its document           | Paired by document id; only changed tabs drawn                                             |
| Two files at head claiming one document  | The first by path is paired; the second is listed as not drawn (`same document as <path>`) |
| A tab whose settings alone changed       | Drawn, with no marks                                                                       |
| An image element                         | Drawn as the export's placeholder; the tab says so                                         |
| A huge tab                               | Bounded by `REVIEW_PNG_MAX_SIDE` on its longer side                                        |
| Comment past the cap                     | Remaining tabs listed; the listing itself trimmed to the cap with a closing count          |
| Fork pull request                        | Artifact and summary, step passes                                                          |
| Previews push races                      | From the new tip again, then the step fails naming the branch                              |

## Security and trust

- No credential is read: `link review` never resolves a profile. The Action holds only `GITHUB_TOKEN`.
- Every git call is `runTool('git', ['-C', cwd, ...])`, no shell, refs after `--end-of-options`; the repository
  variables a hook exports are stripped as for every git the CLI runs.
- The Action runs on `pull_request`, never `pull_request_target`: a fork's code never meets a write token. The CLI
  reads the pull request's files as data and runs none of them.
- Names, paths and hosts from the files are escaped for Markdown; a host that is not `https:` is never linked.
- Pictures are as public as the repository: they live in it.

## Performance and limits

- Git: two `rev-parse`, one `merge-base`, one `diff`, and two `show` per changed file.
- Rendering: at most `REVIEW_MAX_TABS` × 2 pictures, each at most `REVIEW_PNG_MAX_SIDE` px on its longer side, so
  the worst run allocates about 2400 × 2400 × 4 bytes per picture, one at a time.
- The comment is bounded by `REVIEW_COMMENT_MAX_CHARS`.

## Observability

`debugLog(io, 'review')` under `LIVEDIAGRAM_DEBUG=1`:

| Fingerprint                                                 | Where                  |
| ----------------------------------------------------------- | ---------------------- |
| `[review] range <base> <head> files <n>`                    | after step 2           |
| `[review] file <documentId> <added\|removed\|changed>`      | each paired document   |
| `[review] skipped <conflicted\|invalid\|duplicate>`         | each file not drawn    |
| `[review] tab <documentId> <tabId> <status> +<a> ~<c> -<r>` | each changed tab       |
| `[review] capped <n>`                                       | tabs listed, not drawn |

## Testing

| Spec rule                                                               | Test                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Range from the merge base; bad ref, no merge base, no repository        | `apps/cli/src/link/review-git.test.ts` (scripted `tool`)                       |
| Files paired by document id; tabs skipped when equal; element splits    | `apps/cli/src/link/review-diff.test.ts`                                        |
| Marks per side, styles, hidden layers unmarked                          | `apps/cli/src/link/review-picture.test.ts`                                     |
| Comment shape, marker, link, caps, listing, not drawn, no changes       | `apps/cli/src/link/review-comment.test.ts`                                     |
| No token, no request; pictures written and named by hash; `--image-url` | `apps/cli/src/commands/review.test.ts` (real PNGs, empty fetch log)            |
| `writePicture` scale and max side                                       | `review.test.ts` (a 224×124 drawing written 448×248)                           |
| Console lines kept off stdout                                           | `../packages/cli-kit/src/bin.test.ts`                                          |
| The Action: post once, edit in place, nothing changed, fork artifact    | Run by hand against a fixture repository and a recording `gh` (PR description) |
| Verb input, `{file}` refusal, text, JSON, quiet                         | `packages/agent-verbs/src/verbs/link.test.ts`                                  |
| The command in the spec's table; help budgets                           | `commands-table.test.ts`, `help.test.ts`                                       |

## Constants and configuration

| Constant                   | Value                         | Provenance | Safe range     |
| -------------------------- | ----------------------------- | ---------- | -------------- |
| `REVIEW_MAX_TABS`          | 10                            | Spec       | 4 to 20        |
| `REVIEW_COMMENT_MAX_CHARS` | 60000                         | Spec       | 30000 to 64000 |
| `REVIEW_PUSH_ATTEMPTS`     | 3                             | Spec       | 2 to 5         |
| `REVIEW_OUT_DIR`           | `livediagram-review`          | RL46       | any            |
| `REVIEW_PNG_SCALE`         | 2                             | RL46       | 1 to 3         |
| `REVIEW_PNG_MAX_SIDE`      | 2400                          | RL46       | 1200 to 4000   |
| `REVIEW_FILE_HEX`          | 16                            | RL46       | 12 to 64       |
| `REVIEW_MARK_OFFSET`       | 6                             | RL47       | 2 to 12        |
| `REVIEW_MARK_STROKE`       | 3                             | RL47       | 2 to 6         |
| `REVIEW_MARKER`            | `<!-- livediagram-review -->` | Spec       | fixed          |

## Assets and external resources

| Asset                        | Source           | Licence | Path                                  |
| ---------------------------- | ---------------- | ------- | ------------------------------------- |
| `actions/upload-artifact` v7 | GitHub           | MIT     | referenced by `action.yml`, fork path |
| `gh`, `git`, `npx`           | GitHub's runners | various | preinstalled on `ubuntu-latest`       |

## Defaults ledger

RL45 to RL49 in [DEFAULTS.md](DEFAULTS.md).
