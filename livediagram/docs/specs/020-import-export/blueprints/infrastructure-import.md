# Infrastructure code import: blueprint

Derived from [Infrastructure code import](../infrastructure-import.md) and, for the sources record and the update
merge, [Diagram sources](../../027-repositories/diagram-sources.md) "The tab's sources" and "Re-reading a source".
The spec decides; this file only adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) as `I1` onward.

## Files

| File                                                        | Role                                                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/diagram-sources.ts`                  | `DiagramSources` and its parts, `tabSourcesOf(tab)` (the defensive reader), `remapSourceIds(sources, ids)`       |
| `packages/document/src/tab-type.ts`                         | `Tab.sources?: DiagramSources`                                                                                   |
| `packages/document/src/infra-code/limits.ts`                | The named constants below                                                                                        |
| `packages/document/src/infra-code/types.ts`                 | `InfraFormat`, `InfraFile`, `InfraPart`, `InfraSkipped`, `InfraResult`                                           |
| `packages/document/src/infra-code/detect.ts`                | `detectInfraFormat(name, text)`: the format a file or paste holds                                                |
| `packages/document/src/infra-code/parse.ts`                 | `checkInfraText`, `parseInfraText(format, text)`, `parseKubernetesText(text)`: text to plain values, or an error |
| `packages/document/src/infra-code/hcl.ts`                   | `parseHcl(text)`: the HCL tokenizer and block parser, `HclBlock`, `hclReferences(block)`                         |
| `packages/document/src/infra-code/part.ts`                  | `PartBuilder`: nodes and edges by slug id, the skipped-key tally                                                 |
| `packages/document/src/infra-code/file-part.ts`             | `filePart(file, options)`: one file detected, parsed and drawn as its part                                       |
| `packages/document/src/infra-code/wrangler.ts`              | `wranglerPart(config, fallbackName, env?)`: the Wrangler mapping table                                           |
| `packages/document/src/infra-code/compose.ts`               | `composePart(config, fallbackName)`: services, dependencies, volumes, networks                                   |
| `packages/document/src/infra-code/compose-icons.ts`         | `composeIcon(image)`: pure data, image name to technology icon id                                                |
| `packages/document/src/infra-code/terraform.ts`             | `terraformPart(body, fallbackName)`: resources, modules, references, joining resources                           |
| `packages/document/src/infra-code/terraform-icons.ts`       | `terraformIcon(type)`: pure data, resource type to technology icon id                                            |
| `packages/document/src/infra-code/kubernetes.ts`            | `kubernetesPart(docs, fallbackName)`: workloads, Services, Ingresses, claims, namespaces                         |
| `packages/document/src/infra-code/large.ts`                 | `groupByPrefix`, `capNodes`: the large-system rules                                                              |
| `packages/document/src/infra-code/graph.ts`                 | `infraGraph(files, options)`: every file read, merged, grouped, capped, as a `GraphInput`                        |
| `packages/document/src/infra-code/facts.ts`                 | `infraFileFacts(file)`: a file's format and Wrangler environments, for the panel                                 |
| `packages/document/src/infra-code/summary.ts`               | `skippedLine(skipped)`: the one summary line                                                                     |
| `packages/document/src/infra-code/sources.ts`               | `fingerprint(text)`, `sourceFiles(files)`, `drawnRecord(elements, graph)`: the record's parts                    |
| `packages/document/src/infra-code/merge.ts`                 | `mergeSourceGraph(input)`: the three-way re-read of a tab                                                        |
| `packages/document/src/infra-code/placement.ts`             | `placeAdded(...)`: where a new box goes, clear of the rest; frames grown                                         |
| `packages/document/src/infra-code/index.ts`                 | The subpath `@livediagram/document/infra-code` (kept out of the package root so no other app loads the parsers)  |
| `packages/agent-verbs/src/verbs/link.ts`                    | The `link.from-code` verb: input, output, text, CLI projection                                                   |
| `apps/cli/src/commands/from-code.ts`                        | `linkFromCode`: finds and reads the files, prints the summary, creates the document or adds the tab              |
| `apps/editor/hooks/persistence/useInfraImport.ts`           | `importInfraFiles(files, env)` and `updateFromSources(files, env)`: lazy parsers, layout, merge, one commit      |
| `apps/editor/hooks/persistence/useTabImport.ts`             | Routes the `infra` format to `useInfraImport`; other imports clear `sources`; Duplicate remaps them              |
| `apps/editor/lib/infra-import.ts`                           | File types and cap, `infraImportOutcome`, `infraUpdateOutcome`, `infraUpdateOffered(tab, level)`                 |
| `apps/editor/lib/infra-files.ts`                            | `InfraEntry` (a row), `entriesToFiles`, `matchDropped`, `updateBlocked`: the panels' pure rules                  |
| `apps/editor/lib/import-tab.ts`                             | `pickTabFiles(accept, opts)`: several files at once, each refused unread past the cap                            |
| `apps/editor/components/dialogs/infra/InfraImportPanel.tsx` | The Infrastructure card's panel: drop target, file rows, paste, environment, Import                              |
| `apps/editor/components/dialogs/infra/InfraUpdatePanel.tsx` | The update panel: the remembered files' rows, Add Files, environment, Update Diagram                             |
| `apps/editor/components/dialogs/infra/InfraFileRow.tsx`     | One file's row: format badge, name, state, actions, the inline paste                                             |
| `apps/editor/components/dialogs/infra/InfraEnvSelect.tsx`   | The Wrangler environment choice                                                                                  |
| `apps/editor/components/dialogs/infra/InfraSourcesCard.tsx` | The From Its Files card above the formats                                                                        |
| `apps/editor/components/dialogs/infra/useInfraFacts.ts`     | Loads the parsers lazily and reads each entry's format and environments                                          |
| `apps/editor/components/dialogs/ImportTabDialog.tsx`        | Offers the card, the infra panels and the update view                                                            |

## Constants

| Name                             | Value     | Provenance and safe range                                                                                                      |
| -------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `INFRA_MAX_FILE_BYTES`           | 1,000,000 | Real infrastructure files are a few KB; 1 MB bounds the parse. Raise only with a parse-time measurement                        |
| `INFRA_MAX_FILES`                | 20        | A monorepo's Workers (this one has about 15), a Terraform module's files; each adds its boxes to one layout                    |
| `INFRA_MAX_NODES`                | 150       | The graph builder's auto direction lays out twice up to 150 nodes; past it a diagram stops reading. 60 to 300                  |
| `INFRA_GROUP_FROM`               | 40        | Past about 40 boxes an ungrouped flow loses its families. 20 to 100                                                            |
| `HCL_MAX_DEPTH`                  | 64        | Real Terraform nests blocks 3 or 4 deep (`resource`, `dynamic`, `content`); 64 bounds the parser's stack. 16 to 256            |
| `INFRA_SOURCES_MAX_STORED_CHARS` | 200,000   | A tenth of `MAX_TAB_BYTES` (about 2 MB), so the record never crowds the tab's elements; real sets are under 20 KB. 50k to 400k |
| `PLACE_GAP`                      | 48        | The gap kept between a placed box and the drawing (the template look's rank gap). 24 to 96                                     |
| `FRAME_GROW_PAD`                 | 24        | The padding a frame keeps round a box it grows to hold (the clustered layout's `FRAME_PAD`)                                    |

## Domain and naming

- **Infra file** (`InfraFile`): `{ name?: string; text: string }`, a file's name as given (absent for a paste) and text.
- **Format** (`InfraFormat`): `'wrangler' | 'compose' | 'terraform' | 'kubernetes'`.
- **Part** (`InfraPart`): one file's nodes (`GraphInputNode[]`), edges (`GraphEdge[]`), groups, skipped keys and title.
- **Skipped key** (`InfraSkipped`): `{ key: string; count: number }`, a key path as the summary prints it
  (`vars`, `env.staging`, `services.*.develop`, `data.aws_ami`, `HorizontalPodAutoscaler`).
- **Node id**: `<kind>-<slug>` where `slug` lowercases, keeps `[a-z0-9]` and turns every other run into `-`
  (`worker-api`, `kv-cache`, `d1-shop-db`, `svc-web`, `vol-dbdata`, `net-backend`, `tf-aws-s3-bucket-assets`,
  `tf-module-vpc`, `k8s-deployment-default-web`). A slug that empties is `x`. The node id is the **source key**.
- **Sources record** (`DiagramSources`): `{ bridge: 'infra'; files: DiagramSourceFile[]; env?: string; readAt: number;
nodes: Record<string, DiagramSourceNode>; edges: Record<string, string> }`.
  - `DiagramSourceFile`: `{ name: string; format: string; hash: string; text?: string }`.
  - `DiagramSourceNode`: `{ el: string; label?: string; note?: string; iconId?: string }`, the element a key became
    and the values the source gave it.
  - `edges`: the edge key `from>to` (source keys) to the arrow's element id.
  - Header keys: `#title` and `#caption` for the drawing's title and subtitle texts.
- **Entry** (`InfraEntry`, editor): a panel row, `{ id; name?; text?; state: 'new' | 'kept' | 'replaced' | 'needed' |
'removed'; was?: DiagramSourceFile; tooBig?: true }`.

## Behaviour

### `detectInfraFormat(name, text)`

1. A name (lowercased base name) `wrangler.toml` or any other `.toml` is `wrangler`; `.tf` is `terraform`; matching
   `^(docker-)?compose(\.[\w-]+)*\.ya?ml$` is `compose`; any other `.yml` / `.yaml` is `kubernetes` when the text
   has a line starting `apiVersion:` and one starting `kind:` (column 0) and no `services:` line, else `compose`.
2. No name or another extension: `compose` when a line starts `services:` (column 0); else `kubernetes` as above; else
   `terraform` when a line starts with `resource "`, `module "`, `provider "`, `data "` or `terraform {` (spaces
   between the word and its `"` or `{` allowed); else `wrangler` (I1). Every check is a line-by-line scan, no regex
   over the whole text.

### `checkInfraText`, `parseInfraText(format, text)`, `parseKubernetesText(text)`

- `checkInfraText`: text over `INFRA_MAX_FILE_BYTES` (UTF-16 length, I2) is `{ ok: false, error: 'too-large' }`;
  blank text is `empty`. Every format goes through it first.
- TOML through `smol-toml` `parse`; Compose YAML through `js-yaml` `load` with its default (safe) schema and
  `json: true` (later keys win over duplicates, I3). A thrown error is `parse` with the message's first line and the
  line number when the parser gives one (`TomlError.line`, `YAMLException.mark.line + 1`).
- A result that is not a plain object (a YAML scalar or list) is `not-a-table`.
- Kubernetes YAML through `js-yaml` `loadAll` with the same options; its documents are returned as given (`null`
  for an empty one), a thrown error is `parse` as above.

### `parseHcl(text)`

- **Tokens**, one left-to-right pass with an explicit mode stack (`code`, `string`, `interp`), never a regex with
  repeats: identifiers (`[A-Za-z_][A-Za-z0-9_-]*`), numbers, quoted strings (escapes skipped; `$${` and `%%{` are
  literal), heredocs (`<<MARK` and `<<-MARK`, ended by a line that is the marker, trimmed), single-character
  punctuation, and newlines; `#`, `//` and `/* */` comments are skipped. Inside a string, `${` and `%{` open an
  interpolation whose tokens are emitted marked `inner`, and whose own `{` and `}` are counted so its `}` closes it.
  A heredoc's body is scanned for `${` the same way, one level (an interpolation inside it opens no heredoc).
- **Blocks.** A body is a sequence of attributes (`name = expression`, ended by a newline, or by the block's `}`, at
  bracket depth 0, counting only tokens not `inner`) and blocks (`type label* {`, labels quoted strings or
  identifiers). Parsed with an explicit stack: deeper than `HCL_MAX_DEPTH` is `parse` "Blocks nest too deep".
- **Errors**, each `parse` with its line: an unclosed string, heredoc or block, a `}` with no block open, and a
  statement that is neither (`Expected "=" or "{" after "<word>"`). Copy: `Couldn't read the HCL: <message> (line n).`
- **Result**: `HclBlock = { type, labels, line, attrs: Map<string, Token[]>, blocks: HclBlock[] }`, the file a root
  block.
- **`hclReferences(block)`**: every `a.b` chain (an identifier, `.`, an identifier) across the block's attributes and
  nested blocks, `inner` tokens included, in order, without repeats: `module.<b>` as a module, `<a>.<b>` as a resource
  when `a` holds a `_`, others dropped (`var`, `local`, `data`, `each`, `count`, `self`, `path`, `terraform`).

### `terraformPart(body, fallbackName)`

- Top-level `resource` blocks with two labels: a type ending `_attachment` or `_association` is a joining resource
  (below); every other is node `tf-<slug(type)>-<slug(name)>` labelled `name`, icon `terraformIcon(type)`, note
  `type` plus `count: <expr text>` / `for_each` when set.
- `module` blocks with one label: node `tf-module-<slug(name)>`, icon `terraform`, note `module: <source>` when its
  `source` is a plain string.
- Edges, once every node is known: for each node block, `hclReferences` to a declared resource or module draws an
  edge from it to the referenced node (self references dropped).
- A joining resource's references to declared nodes: the first two draw a dashed edge first to second; fewer is a
  skip `resource.<type>`.
- Silent: `terraform`, `provider`, `variable`, `output`, `locals`, `moved`, `import`, `removed`, `check`. `data`
  blocks skip as `data.<type>`; a `resource` or `module` with the wrong label count skips as its type; other blocks
  and top-level attributes skip by name.
- No node: `nothing-to-draw` with the Terraform copy below. Title: the fallback name (the folder, else `Terraform`).

### `kubernetesPart(docs, fallbackName)`

- Documents: each mapping with a string `kind`; `kind: List` contributes its `items`. A document that is not a
  mapping or lacks a `kind` skips as `(document without kind)`; `null` documents are ignored.
- Namespace of an object: `metadata.namespace`, else `default`. Ids: `k8s-<slug(kind)>-<slug(ns)>-<slug(name)>`; an
  object without `metadata.name` skips as its kind.
- Workloads (`Deployment`, `StatefulSet`, `DaemonSet`, `ReplicaSet`, `Job`, `CronJob`, `Pod`): pod template
  `spec.template` (a CronJob's `spec.jobTemplate.spec.template`, a Pod is its own), its `metadata.labels` and
  `spec.containers[].image`. Icon `composeIcon(first image)` unless that is `docker`, then `k8s`. Note lines:
  `<kind>`, `replicas: <n>` when set, `image: <a, b>`.
- `Service`: node, icon `k8s`, note `Service` and its `type` when set; an edge to every workload of its namespace whose
  pod labels hold each `spec.selector` pair (a Service with no selector draws no edges).
- `Ingress`: node shape `stadium`, note `hosts: <a, b>`; edges to the Services named by
  `spec.rules[].http.paths[].backend.service.name` (and `serviceName`, the older form) and `spec.defaultBackend`, in
  its namespace.
- `PersistentVolumeClaim`: node shape `cylinder`; each workload volume `persistentVolumeClaim.claimName` naming one
  draws a dashed edge workload to claim. A StatefulSet's `spec.volumeClaimTemplates[].metadata.name` draws a claim
  node `k8s-pvc-<ns>-<template>-<sts>` labelled `<template>` and the same dashed edge.
- Two or more namespaces among the nodes: a group `ns-<slug(ns)>` labelled `<ns> namespace` per namespace.
- Silent kinds: `Namespace`, `ConfigMap`, `Secret`, `ServiceAccount`, `Role`, `RoleBinding`, `ClusterRole`,
  `ClusterRoleBinding`. Others skip by kind.
- No node: `nothing-to-draw` (Kubernetes copy). Title: the fallback name (the folder, else `Kubernetes`).

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

Unchanged: services as `svc-<slug>` with `composeIcon(image)` and their image and ports in the note; `depends_on` and
`links` as edges (a dependency naming no service is dropped, I4); named volumes as `vol-<slug>` cylinders with dashed
edges; networks as groups `net-<slug>` when every service is on at most one, else hexagons with dashed headless
edges. Silent top-level keys `version`, `name`, `services`, `volumes`, `networks` and `x-` keys; silent service keys
the runtime list in `compose.ts`; other keys skip by name or as `services.*.<key>`.

### `filePart(file, { env? })` and `infraGraph(files, { env? })`

1. More than `INFRA_MAX_FILES` files: error `too-many-files`.
2. Each file (`filePart`): `checkInfraText`, detect, parse, build its part; the first error stops the import and names
   the file. The fallback name is the file's folder, else the format's word (`Worker`, `Compose`, `Terraform`,
   `Kubernetes`).
3. **Environment across files.** With `env`, a Wrangler file whose `env` table lacks it draws its top level and adds
   the skipped key `env.<env> not in <title>`; when no Wrangler file has it, the first file's `unknown-env` error
   stands.
4. Parts merge by node id (the first label, icon and note win), edges deduplicated by `from>to`, groups merged by id.
5. No nodes: error `nothing-to-draw`.
6. Past `INFRA_GROUP_FROM` nodes and no groups: `groupByPrefix`.
7. Past `INFRA_MAX_NODES`: `capNodes` keeps the first `INFRA_MAX_NODES - 1` nodes and adds `more` labelled
   `<n> more` with a note listing the rest, one per line; edges and group members naming a dropped node are dropped.
8. Lines past `GRAPH_LAYOUT_MAX_EDGES` are dropped and counted (`linesLeftOut`).
9. The graph: `title` the parts' titles, up to three joined by `, `, else two and `and <n> more`; `subtitle`
   `From <file names as given>` (a paste is `wrangler.toml`, `docker-compose.yml`, `main.tf` or `manifest.yaml`),
   both cut to 120 characters; `style: 'flow'`. Returns `{ ok: true, graph, files, skipped, leftOut, linesLeftOut }`,
   `files` each file's name, format and box count.

### `infraFileFacts(file)`

`{ format, envs }`: the detected format and, for a Wrangler file that parses, the keys of its `env` table (else `[]`).
Never throws; a file that does not parse has no environments (its error comes at Import).

### The sources record (`sources.ts`)

- `fingerprint(text)`: FNV-1a 32-bit over the UTF-16 code units, eight lowercase hex digits.
- `sourceFiles(files, results)`: each file `{ name: name ?? <paste name>, format, hash }`, and `text` while the
  running total of texts stays within `INFRA_SOURCES_MAX_STORED_CHARS`, in order; a file past it has none (I6).
- `drawnRecord(elements, graph)`: for each element whose id is a graph node or group id, `nodes[id] = { el: id, label,
note, iconId }` (each only when set); for the title and caption texts (type `text`, label equal to the graph's
  title / subtitle), `#title` / `#caption`; for each arrow pinned at both ends to node ids, `edges[from>to] = arrow id`.
- `tabSourcesOf(tab)`: the record when `sources` is a plain object with `bridge: 'infra'`, `files` an array of
  objects each with string `name`, `format` and `hash`, `nodes` and `edges` plain objects; else `null`. Entries of
  `nodes` without a string `el`, and `edges` values that are not strings, are dropped.
- `remapSourceIds(sources, ids)`: every `el` and edge value through `ids` (a missing id is kept).

### `mergeSourceGraph({ tab, record, fresh, graph })`

Input: the tab's elements, the record (`null` is an empty base), the fresh layout of the new graph (`layoutGraph`, ids
as the graph's), the graph. Output: `{ elements, nodes, edges, counts }`, counts `{ added, removed, kept, editsKept,
linesAdded, linesRemoved }`.

1. **Fresh keys.** `drawnRecord(fresh, graph)` names each fresh element's key; the fresh element by key.
2. **Each key in the fresh record**, in fresh element order:
   - Base has it and its `el` is on the tab: **kept**. Each tracked field (`label`, `note`, `iconId`) whose tab value
     equals the base's takes the fresh value (or is removed when fresh has none); a differing one is kept and counts
     one `editsKept`. Position, size and every other field stay.
   - Base has it, its element gone: **stays deleted**; nothing is added; the record keeps the key with that `el`.
   - Base lacks it: **added**, its id the key unless the tab already holds that id (then a new UUID).
3. **Each base key not in the fresh record**: its element is removed when on the tab (**removed**), with every arrow
   pinned to it at either end.
4. **Edges.** Each fresh edge key: base has it and its arrow is on the tab: kept. Base has it, arrow gone: stays
   deleted. Base lacks it: added when both ends' elements are on the result, its pins renamed to those elements, its
   anchors `bestAnchorTowards` each other's centre, its route fields (`curveOffset`, `curvePoints`, `elbowOffset`,
   `labelOffset`, `exactStart`, `exactEnd`) dropped. Each base edge key not fresh: its arrow removed when there.
5. **Placement** (`placeAdded`), for added boxes in order, header texts excluded (a new title or caption keeps its fresh
   offset from the first kept box):
   - The anchor: the first neighbour by a fresh edge (either way) that is on the result already (kept or placed),
     else the first fellow member of a group that is. Placed at the anchor's position plus the fresh offset between
     the two.
   - No anchor: the new boxes without one keep their fresh layout among themselves, the block's left edge `PLACE_GAP`
     right of the tab's boxes and its top level with theirs.
   - Then, while it overlaps any box on the result (kept, placed or the person's own, frames excluded, with
     `PLACE_GAP / 2` margin), it moves down below the lowest box it overlaps. At most as many steps as there are
     boxes, so the pass is bounded by n².
   - A new frame takes the bounds of its placed members plus the fresh frame's insets. A kept frame whose group gains
     members grows to their bounds plus `FRAME_GROW_PAD` (its header band kept on top).
6. The result: the tab's elements with removals dropped and kept fields applied, in their order, then added frames,
   boxes and arrows; the record's `nodes` and `edges` rewritten from it (each key: its element now, the fresh values).

### The editor

- `ImportFormat` keeps `infra`. File accept `.toml,.yml,.yaml,.tf,application/toml,application/yaml,text/yaml,text/plain`.
  `pickTabFiles` (input `multiple`) resolves every chosen file, each past `INFRA_FILE_MAX_BYTES` marked `tooBig`
  unread; cancel resolves `null` as `pickTabFile` does.
- **Import** (`importInfraFiles(files, env)`): the locked-tab refusal; `infraGraph`; `layoutGraph(graph)` with the
  shape presets rederived for the theme; the record (`sourceFiles`, `drawnRecord`, `env`, `readAt: Date.now()`); one
  `replaceActiveTabContent` with `sources`; `track('Tab', 'Imported', <first file's format word>)`; the report.
- **Update** (`updateFromSources(files, env)`): the locked-tab refusal; `infraGraph`; fresh layout; `mergeSourceGraph`
  over the active tab and its record; one `commitTabs` replacing the tab's elements and `sources`;
  `track('Tab', 'Imported', 'InfraUpdate')`; `infraUpdateOutcome`.
- Every other import's tab lands without `sources` (`mergeImportedTab` takes the imported tab's `sources`, absent for
  them); Duplicate (`remintTabElements`) remaps them through the new ids.
- `infraUpdateOffered(tab, level)`: `level === 'edit'` and `tabSourcesOf(tab) !== null` and the tab is not locked.
- `infraImportOutcome`: `{ status: 'done' }` when nothing was skipped or left out, else a `scene` report: `landed`
  `{ shape, connector, frame }`, `skipped` rules `Keys not drawn: <line>` (count: distinct keys) and `Boxes left out
past the first 149, listed in the last box` (count: left out) and `Lines left out past the first 1,000` (count: lines
  dropped), with the subtitle "Here's how your infrastructure came across."
- `infraUpdateOutcome`: always a report, title `Update complete`, subtitle `Updated from <n> file(s).`, `landed` as
  above for the whole tab, `degraded` rules (each only when its count is above 0): `Boxes added from the files`,
  `Boxes removed, gone from the files`, `Lines added`, `Lines removed`, `Boxes kept where they were`, `Edits kept
(labels, notes or icons changed on the tab)`; `skipped` as the import's.
- **The panels' rules** (`infra-files.ts`): `entriesToFiles(entries)` gives the files an Import or Update reads: the
  non-removed entries' texts (`kept` from the record, `replaced` and `new` from what was given); `updateBlocked`
  is true while an entry is `needed`, or none is left; `matchDropped(entries, files)` replaces the first `kept`,
  `needed` or `replaced` entry of the same base name, else adds a `new` one.

## Errors and copy

| Error             | Copy (editor names the file first; the CLI prefixes it the same way)                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `empty`           | That file is empty.                                                                                                           |
| `too-large`       | That file is over 1 MB, larger than any infrastructure file. Pick the file itself.                                            |
| `parse`           | Couldn't read the TOML: `<message>` (line `<n>`). / … the YAML: … / … the HCL: …                                              |
| `not-a-table`     | That isn't a wrangler.toml or Compose file: its top level holds no keys.                                                      |
| `no-services`     | That Compose file has no services to draw.                                                                                    |
| `unknown-env`     | No environment "`<e>`" in this wrangler.toml; it has: `<names>`.                                                              |
| `nothing-to-draw` | Wrangler and Compose: Found no Worker or bindings to draw. A wrangler.toml needs a name or a binding; Compose needs services. |
|                   | Terraform: Found no resource or module to draw.                                                                               |
|                   | Kubernetes: Found no Kubernetes objects to draw: no Deployment, Service, Ingress or other workload.                           |
| `too-many-files`  | Up to 20 files can be drawn at once.                                                                                          |
| (editor) needed   | Choose `<name>` again, or remove it: it was too large to remember.                                                            |
| (editor) locked   | This tab is locked. Unlock it before importing.                                                                               |

## Security and trust

- The text is untrusted. `js-yaml` 4's default schema builds no functions or classes; aliases are shared references,
  and the import walks only known paths, so an alias bomb costs nothing. Every parser is bounded by the byte cap.
- The HCL tokenizer is one pass over the text with constant work per character, its parser an explicit stack capped
  at `HCL_MAX_DEPTH`; no regular expression runs over the text (CodeQL ReDoS), so its cost is linear in the file.
- The sources record is read defensively (`tabSourcesOf`): a malformed record from a peer or an api write is none.
- Labels and notes are text, rendered by the canvas as text. Nothing is fetched, nothing executed.
- The CLI reads only the files named, the five standard names and the `.tf` files in the working directory.

## Performance and limits

- The parsers, the merge and the placement live behind the `infra-code` subpath, imported dynamically by the editor
  only once the Infrastructure panel or the update opens, so the first load is unchanged; the editor's first-load JS
  is measured before and after in the PR.
- Worst cases, each under a CPU-time budget (`cpuBudgetMs`): a 200-service Compose file read and laid out
  (`graph.test.ts`); a 1 MB HCL file of 10,000 resources each referencing the one before, and 1 MB of pathological
  HCL (unclosed interpolations, a long run of `{`, a heredoc that never ends) (`hcl.test.ts`); a manifest of 2,000
  Kubernetes objects (`kubernetes.test.ts`); a merge of 150 boxes and 1,000 lines over an edited tab with 300 extra
  boxes (`merge.test.ts`).
- The record is at most `INFRA_SOURCES_MAX_STORED_CHARS` of text plus 150 node entries and 1,000 edge entries.

## Accessibility and presentation

- The panels use the dialog's shared parts: `BackBar`, `ImportDropZone`, `Button`, `Select`, the report list, the
  alert and status roles.
- A file row is a list item: a format badge (text, not colour alone), the name (truncated with its full text as the
  `title`), the state in words, and icon buttons with `aria-label`s and tooltips (Choose File, Paste, Remove or
  Keep). Rows reflow on a phone: actions wrap under the name below 400px.
- The inline paste is a labelled textarea with Use This Text and Cancel; Escape inside it cancels it, not the dialog.
- The environment `Select` has a visible label, "Wrangler environment".
- Every control has hover, focus-visible and disabled states in light and dark; touch targets are at least 32px.

## Observability

- CLI debug: `[from-code] read <file> <format>`, `[from-code] skipped <n>`, `[from-code] capped <n>`.
- Editor: `debugLog('[infra-import]', { formats, files, nodes, edges, skipped, leftOut })`;
  `debugLog('[infra-update]', { files, added, removed, kept, editsKept, linesAdded, linesRemoved })`.

## Testing

| Rule                                                       | Test                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| Detection by name and content, all four formats            | `packages/document/src/infra-code/detect.test.ts`           |
| Parse errors with lines, size, empty, Kubernetes documents | `packages/document/src/infra-code/parse.test.ts`            |
| HCL tokens, blocks, references, errors, depth, CPU budget  | `packages/document/src/infra-code/hcl.test.ts`              |
| Terraform resources, modules, references, joins, icons     | `packages/document/src/infra-code/terraform.test.ts`        |
| Kubernetes workloads, selectors, ingress, claims, CPU      | `packages/document/src/infra-code/kubernetes.test.ts`       |
| Every Wrangler row, env, skipped keys                      | `packages/document/src/infra-code/wrangler.test.ts`         |
| Compose services, deps, volumes, networks                  | `packages/document/src/infra-code/compose.test.ts`          |
| Grouping, cap, merge, title, env across files, CPU budget  | `packages/document/src/infra-code/graph.test.ts`            |
| Facts, fingerprint, stored-text cap, drawn record          | `packages/document/src/infra-code/sources.test.ts`          |
| Re-run merge over an edited tab, every row of the table    | `packages/document/src/infra-code/merge.test.ts`            |
| The record's reader and id remap                           | `packages/document/src/diagram-sources.test.ts`             |
| CLI discovery (`.tf` too), dry run, create, add, errors    | `apps/cli/src/commands/from-code.test.ts`                   |
| Editor outcomes, reports, roles                            | `apps/editor/lib/infra-import.test.ts`                      |
| Panel rules (entries, drop matching, blocked)              | `apps/editor/lib/infra-files.test.ts`                       |
| Import and update commits, one undo, locked                | `apps/editor/hooks/persistence/useTabImport.infra.test.ts`  |
| Dialog card, panels, rows, environment, update             | `apps/editor/components/dialogs/infra/InfraPanels.test.tsx` |
