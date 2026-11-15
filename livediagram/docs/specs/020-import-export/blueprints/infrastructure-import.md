# Infrastructure code import: blueprint

Derived from [Infrastructure code import](../infrastructure-import.md). The spec decides; this file only adds
engineering precision. Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) as `I1`
onward.

## Files

| File                                                 | Role                                                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/infra-code/limits.ts`         | The named constants below                                                                                       |
| `packages/document/src/infra-code/types.ts`          | `InfraFormat`, `InfraFile`, `InfraPart`, `InfraSkipped`, `InfraResult`                                          |
| `packages/document/src/infra-code/detect.ts`         | `detectInfraFormat(name, text)`: the format a file or paste holds                                               |
| `packages/document/src/infra-code/parse.ts`          | `parseInfraText(format, text)`: TOML or YAML to a plain object, or a named error with its line                  |
| `packages/document/src/infra-code/part.ts`           | `PartBuilder`: nodes and edges by slug id, the skipped-key tally                                                |
| `packages/document/src/infra-code/wrangler.ts`       | `wranglerPart(config, fallbackName, env?)`: the Wrangler mapping table                                          |
| `packages/document/src/infra-code/compose.ts`        | `composePart(config, fallbackName)`: services, dependencies, volumes, networks                                  |
| `packages/document/src/infra-code/compose-icons.ts`  | `composeIcon(image)`: pure data, image name to technology icon id                                               |
| `packages/document/src/infra-code/large.ts`          | `groupByPrefix`, `capNodes`: the large-system rules                                                             |
| `packages/document/src/infra-code/graph.ts`          | `infraGraph(files, options)`: every file read, merged, grouped, capped, as a `GraphInput`                       |
| `packages/document/src/infra-code/summary.ts`        | `skippedLine(skipped)`: the one summary line                                                                    |
| `packages/document/src/infra-code/index.ts`          | The subpath `@livediagram/document/infra-code` (kept out of the package root so no other app loads the parsers) |
| `packages/agent-verbs/src/verbs/link.ts`             | The `link.from-code` verb: input, output, text, CLI projection                                                  |
| `apps/cli/src/commands/from-code.ts`                 | `linkFromCode`: finds and reads the files, prints the summary, creates the document or adds the tab             |
| `apps/cli/src/main.ts`                               | Routes `link.from-code` (offline under `--dry-run`)                                                             |
| `apps/editor/hooks/persistence/useTabImport.ts`      | The `infra` format: the lazy import, layout, one replace, telemetry, the report                                 |
| `apps/editor/lib/infra-import.ts`                    | `infraImportOutcome(result)`: the import report for the dialog                                                  |
| `apps/editor/components/dialogs/ImportTabDialog.tsx` | The Infrastructure card, its placeholder and file types                                                         |

## Constants

| Name                   | Value     | Provenance and safe range                                                                                     |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| `INFRA_MAX_FILE_BYTES` | 1,000,000 | Real Compose and Wrangler files are a few KB; 1 MB bounds the parse. Raise only with a parse-time measurement |
| `INFRA_MAX_FILES`      | 20        | A monorepo's Workers (this one has about 15); each file adds its boxes to one layout                          |
| `INFRA_MAX_NODES`      | 150       | The graph builder's auto direction lays out twice up to 150 nodes; past it a diagram stops reading. 60 to 300 |
| `INFRA_GROUP_FROM`     | 40        | Past about 40 boxes an ungrouped flow loses its families. 20 to 100                                           |

## Domain and naming

- **Infra file** (`InfraFile`): `{ name?: string; text: string }`, a file's base name (absent for a paste) and text.
- **Format** (`InfraFormat`): `'wrangler' | 'compose'`.
- **Part** (`InfraPart`): one file's nodes (`GraphInputNode[]`), edges (`GraphEdge[]`), groups and skipped keys.
- **Skipped key** (`InfraSkipped`): `{ key: string; count: number }`, a key path as the summary prints it
  (`vars`, `env.staging`, `services.*.develop`).
- **Node id**: `<kind>-<slug>` where `slug` lowercases, keeps `[a-z0-9]` and turns every other run into `-`
  (`worker-api`, `kv-cache`, `d1-shop-db`, `svc-web`, `vol-dbdata`, `net-backend`). A slug that empties is `x`.

## Behaviour

### `detectInfraFormat(name, text)`

1. A name (lowercased base name) `wrangler.toml` is `wrangler`; matching `^(docker-)?compose(\.[\w-]+)*\.ya?ml$`
   is `compose`; any other `.toml` is `wrangler`, `.yml` / `.yaml` is `compose`.
2. No name or another extension: `compose` when a line starts `services:` (column 0), else `wrangler` (I1).

### `parseInfraText(format, text)`

- Text over `INFRA_MAX_FILE_BYTES` (UTF-16 length, I2) is `{ ok: false, error: 'too-large' }`; blank text is
  `empty`.
- TOML through `smol-toml` `parse`; YAML through `js-yaml` `load` with its default (safe) schema and `json: true`
  (later keys win over duplicates, I3). A thrown error is `parse` with the message's first line and the line number
  when the parser gives one (`TomlError.line`, `YAMLException.mark.line + 1`).
- A result that is not a plain object (a YAML scalar or list) is `not-a-table`.

### `wranglerPart(config, fallbackName, env?)`

- With `env`, `config.env[env]` must be an object, else the error `unknown-env` naming the environments there are;
  its keys replace the top level's, key by key.
- The Worker node `worker-<slug(name)>` labelled `name`, icon `cf-workers`.
- Each row of the spec's table adds its node (icon as listed; a node without an icon is shape `cylinder` for
  storage, `square` otherwise) and an edge from the Worker, except a consumer (queue to Worker), a route (route
  to Worker) and a cron (dashed, cron to Worker). Ids: `kv-<id ?? binding>`, `r2-<bucket_name ?? binding>`,
  `d1-<database_name ?? binding>`, `queue-<queue>`, `do-<script_name ?? worker>-<class_name>`,
  `worker-<service>`, `ai`, `images`, `assets-<worker>`, `vectorize-<index_name>`, `hyperdrive-<binding>`,
  `ae-<dataset ?? binding>`, `workflow-<name ?? binding>`, `browser`, `route-<worker>`, `cron-<worker>`.
- A binding entry that is not an object, or lacks the key its id needs, is skipped and counted under its key.
- A route's note lists every pattern; a cron's lists every schedule.
- No `name` and no node beyond the Worker's: `nothing-to-draw` (the TOML holds nothing of a Worker).
- The fallback name is the file's parent folder, else `Worker` (Compose: else `Compose`).
- Silent keys: `name`, `main`, `compatibility_date`, `compatibility_flags`, `account_id`, `$schema`, `workers_dev`,
  `preview_urls`. `env` adds one skipped key per environment (`env.staging`) unless `env` was chosen. Every other
  unread top-level key is skipped by its own name.

### `composePart(config, fallbackName)`

- `services` must be a mapping, else `no-services`.
- Each service: node `svc-<slug>`, label the key, icon `composeIcon(image)` (`docker` when none matches), note
  `image: <image>` and `ports: <a, b>` lines when present.
- `depends_on` as a list of names or a mapping's keys, `links` entries (`name` or `name:alias`): an edge service to
  dependency; a dependency naming no service is dropped (I4).
- `volumes` entries, short (`name:/path[:mode]`) or long (`{ type: volume, source }`): a source that is a key of the
  top-level `volumes` draws node `vol-<slug>` (cylinder) and a dashed edge, service to volume.
- Networks per service from a list or a mapping's keys; none means `default`. Every service on at most one named
  network: a group `net-<slug>` labelled `<name> network`, members its services. Otherwise a hexagon node per named
  network and a dashed, headless edge from each member service.
- Silent top-level keys: `version`, `name`, `services`, `volumes`, `networks`, and any `x-` key. Silent service keys:
  the runtime list in `compose.ts` (`image`, `build`, `command`, `entrypoint`, `environment`, `env_file`, `ports`,
  `expose`, `restart`, `healthcheck`, `container_name`, `hostname`, `labels`, `deploy`, `profiles`, `working_dir`,
  `user`, `logging`, ...). Other top-level keys skip by name; other service keys as `services.*.<key>`.

### `infraGraph(files, { env? })`

1. More than `INFRA_MAX_FILES` files: error `too-many-files`.
2. Each file: detect, parse, build its part. The first error stops the import and names the file.
3. Parts merge by node id (the first label, icon and note win), edges deduplicated by `from>to`, groups merged by id.
4. No nodes: error `nothing-to-draw`.
5. Past `INFRA_GROUP_FROM` nodes and no groups: `groupByPrefix`.
6. Past `INFRA_MAX_NODES`: `capNodes` keeps the first `INFRA_MAX_NODES - 1` nodes and adds `more` labelled
   `<n> more` with a note listing the rest, one per line; edges and group members naming a dropped node are dropped.
7. Lines past `GRAPH_LAYOUT_MAX_EDGES` are dropped and counted (`linesLeftOut`).
8. The graph: `title` the parts' titles, up to three joined by `, `, else two and `and <n> more`; `subtitle`
   `From <file names as given>` (a paste is `wrangler.toml` or `docker-compose.yml`), both cut to 120 characters;
   `style: 'flow'`. Returns `{ ok: true, graph, files, skipped, leftOut, linesLeftOut }`, `files` each file's name,
   format and box count.

### The CLI (`linkFromCode`)

- Files: the positionals, else the standard names found with `io.files.read` in `io.cwd`. Each read is refused past
  `INFRA_MAX_FILE_BYTES`; an unreadable or missing named file exits 3 (`not_found`), a file past the cap exits 1 (`too_large`).
- stderr: `read <file>: <format>, <n> boxes` per file, then `skipped keys: <line>` and `left out: <n> boxes past the
first <max>` when they apply.
- `--dry-run`: stdout is `JSON.stringify(graph, null, 2)`; no profile is read.
- Otherwise `document.create` (no `--doc`) or `tab.add` runs with a context whose `readInput` returns the graph's
  JSON, so the request, the refusals and the printed line are theirs. The verb's output is `{ text, graph }`.
- Errors map to exit 2 (`usage`: no files, too many, unknown env) or 1 (`invalid_value`: a parse error, nothing to
  draw), each naming the file.

### The editor

- `ImportFormat` gains `infra`. File accept `.toml,.yml,.yaml,text/plain,application/toml,application/yaml`; the
  picked file's name goes to `infraGraph`, a paste has none. A file over the limit is refused before reading
  (`pickTabFile`'s `maxBytes`).
- On success: `layoutGraph(graph)` (labels capped as the agents' are), the shape presets rederived for the theme,
  one `replaceActiveTabContent`, `track('Tab', 'Imported', 'Wrangler' | 'Compose')` by the first file's format.
- `infraImportOutcome`: `{ status: 'done' }` when nothing was skipped or left out, else a `scene` report: `landed`
  `{ shape, connector, frame }`, `skipped` rules `Keys not drawn: <line>` (count: distinct keys) and `Boxes left out
past the first 149, listed in the last box` (count: left out) and `Lines left out past the first 1,000` (count: lines dropped), with the subtitle "Here's how your infrastructure
  came across."

## Errors and copy

| Error             | Copy (editor; the CLI prefixes the file)                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| `empty`           | That file is empty.                                                                                     |
| `too-large`       | That file is over 1 MB, larger than any wrangler.toml or Compose file. Pick the file itself.            |
| `parse`           | Couldn't read the TOML: `<message>` (line `<n>`). / Couldn't read the YAML: ...                         |
| `not-a-table`     | That isn't a wrangler.toml or Compose file: its top level holds no keys.                                |
| `no-services`     | That Compose file has no services to draw.                                                              |
| `unknown-env`     | No environment "`<e>`" in this wrangler.toml; it has: `<names>` (CLI only).                             |
| `nothing-to-draw` | Found no Worker or bindings to draw. A wrangler.toml needs a name or a binding; Compose needs services. |
| `too-many-files`  | Up to 20 files can be drawn at once (CLI only).                                                         |

## Security and trust

- The text is untrusted. `js-yaml` 4's default schema builds no functions or classes; aliases are shared references,
  and the import walks only known paths, so an alias bomb costs nothing. Both parsers are bounded by the byte cap.
- Labels and notes are text, rendered by the canvas as text. Nothing is fetched, nothing executed.
- The CLI reads only the files named or the five standard names in the working directory.

## Performance and limits

- The parsers live behind the `infra-code` subpath, imported dynamically by the editor, so the first load is
  unchanged; the chunk is measured in the PR.
- Worst case: a 200-service Compose file with a dependency each, prefix-grouped and capped, read and laid out under a
  CPU-time budget in `packages/document/src/infra-code/graph.test.ts` (`cpuBudgetMs`).

## Accessibility and presentation

The card, panel, error and report are the dialog's shared parts (`FormatCard`, `TextImportPanel`, the report list),
with their focus, `role="alert"` and `role="status"` behaviour; the card adds only copy and its file-type label.

## Observability

- CLI debug: `[from-code] read <file> <format>`, `[from-code] skipped <n>`, `[from-code] capped <n>`.
- Editor: `debugLog('[infra-import]', { formats, nodes, edges, skipped, leftOut })`.

## Testing

| Rule                                        | Test                                                      |
| ------------------------------------------- | --------------------------------------------------------- |
| Detection by name and content               | `packages/document/src/infra-code/detect.test.ts`         |
| Parse errors with lines, size, empty        | `packages/document/src/infra-code/parse.test.ts`          |
| Every Wrangler row, env, skipped keys       | `packages/document/src/infra-code/wrangler.test.ts`       |
| Compose services, deps, volumes, networks   | `packages/document/src/infra-code/compose.test.ts`        |
| Grouping, cap, merge, title, CPU budget     | `packages/document/src/infra-code/graph.test.ts`          |
| CLI discovery, dry run, create, add, errors | `apps/cli/src/commands/from-code.test.ts`                 |
| Editor outcome and report                   | `apps/editor/lib/infra-import.test.ts`                    |
| Dialog card and errors                      | `apps/editor/components/dialogs/ImportTabDialog.test.tsx` |
