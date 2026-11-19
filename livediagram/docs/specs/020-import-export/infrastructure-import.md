# Infrastructure code import

An architecture diagram drawn by hand drifts from what is deployed, while the source of truth already sits in the
repository. The **infrastructure import** reads that source and draws it: `wrangler.toml`, Docker Compose, Terraform
and Kubernetes files, one or several together, turned into a laid-out architecture tab, each Worker, service,
resource or workload a box with its technology icon, each binding, dependency, reference and network a line or a
group.

The tab remembers the files it came from (its [diagram sources](../027-repositories/diagram-sources.md)), so running
the import again **updates** it: what the files add is added, what they no longer name is removed, and what people
drew on it (positions, colours, labels they changed, boxes and lines they added) stays.

## Formats

Four formats, every one behind the lazy `infra-code` chunk. Pulumi, CloudFormation and OpenAPI wait for their own
decision: format sprawl is the risk, and each format is a parser to keep.

| Format         | Recognised by                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Wrangler       | a file named `wrangler.toml`, or TOML whose top level holds `name`, `main` or a binding table        |
| Docker Compose | `docker-compose.yml` / `.yaml`, `compose.yml` / `.yaml`, or YAML whose top level holds `services`    |
| Terraform      | a `.tf` file, or text with a top-level `resource`, `module`, `provider`, `data` or `terraform` block |
| Kubernetes     | YAML whose documents hold `apiVersion` and `kind` at their top level (one file may hold many)        |

Pasted text has no name, so its content decides: a `services:` line is Compose, an `apiVersion:` line with a `kind:`
line is Kubernetes, a top-level `resource "`, `module "`, `provider "`, `data "` or `terraform {` is Terraform, and
anything else is read as TOML. A `.yml` or `.yaml` file that is not named as Compose is decided the same way, Compose
when nothing says Kubernetes.

TOML and YAML are read with real parsers (`smol-toml`, `js-yaml`), never by hand, so comments, inline tables, anchors
and merge keys read as the formats define them. Terraform's HCL has no small parser to borrow: it is read by a
tokenizer of its own that walks the text once, left to right, so a long or hostile file costs no more than its length.

## What is drawn

The import builds a node/edge graph and lays it out through the [graph builder](../015-api/mcp-server.md) (the MCP
`graph` argument's layout): the flow style, its direction chosen as the graph builder chooses it, angled lines, the
template look. A node's id is a slug of the resource it names, so two files naming one resource draw it once, and a
re-run finds the box it drew before.

### Wrangler

The Worker is a box named by `name` (the file's folder when it has none), with the Workers icon. Each binding is a box
joined to it by an arrow from the Worker:

| Key                                                    | Box                                                         | Icon                  |
| ------------------------------------------------------ | ----------------------------------------------------------- | --------------------- |
| `kv_namespaces`                                        | the binding name                                            | KV                    |
| `r2_buckets`                                           | the bucket name                                             | R2                    |
| `d1_databases`                                         | the database name                                           | D1                    |
| `queues.producers`                                     | the queue (arrow Worker to queue)                           | Queues                |
| `queues.consumers`                                     | the queue (arrow queue to Worker)                           | Queues                |
| `durable_objects.bindings`                             | the class name, with the Worker hosting it                  | Durable Objects       |
| `services`                                             | the bound Worker, a Worker box of its own                   | Workers               |
| `ai`                                                   | Workers AI                                                  | Workers AI            |
| `images`                                               | Images                                                      | Images                |
| `assets`                                               | Static assets                                               | Pages                 |
| `vectorize`, `hyperdrive`, `analytics_engine_datasets` | the index, binding or dataset, a cylinder                   | none (no icon exists) |
| `workflows`, `browser`                                 | the workflow name, Browser Rendering                        | none                  |
| `routes` / `route`                                     | the first route, an arrow into the Worker                   | DNS                   |
| `triggers.crons`                                       | Cron and its first schedule, a dashed arrow into the Worker | none                  |

- A service binding names another Worker, so several `wrangler.toml` files read together draw one system: the bound
  Worker's box is the same box its own file draws.
- **Environments.** `[env.<name>]` tables are not merged in by default: the top level is drawn, and the summary names
  the environments left out. Choosing an environment (the editor's **Wrangler environment** choice, the CLI's
  `--env <name>`) draws that environment instead, as Wrangler deploys it: the top level's inheritable keys (`name`,
  `main`, routes, cron triggers, assets and settings) carry in unless the environment sets its own, and bindings and
  `vars` never do, so a binding drawn is one the environment declares. An environment without a `name` is the Worker
  `<name>-<env>`, as Wrangler names it. With several files, each file that has the environment draws it and the rest draw their
  top level, said in the summary (`env.staging not in web`); an environment no file has is an error naming the ones
  there are.

### Docker Compose

- Each service is a box named by its key. Its icon follows its `image`: Postgres, MySQL (and MariaDB), Redis, MongoDB,
  Kafka, NGINX, RabbitMQ, Elasticsearch (and OpenSearch), Cassandra, Prometheus and Node.js have their own; every
  other service has the Docker icon. Its note holds its image and published ports.
- `depends_on` (list or mapping) and the older `links` draw an arrow from the service to what it depends on.
- A named volume (a top-level `volumes` key a service mounts) is a cylinder, joined by a dashed line. Bind mounts are
  not drawn.
- **Networks.** When every service is on at most one named network, each network is a group framing its services.
  When any service is on two or more, each network is a hexagon instead, joined to its services by headless dashed
  lines, since a box cannot sit in two frames. The `default` network draws nothing.

### Terraform

- Each `resource "<type>" "<name>"` is a box named by its name, its note the type (and `count` or `for_each` when it
  has one). Its icon follows its type: the AWS, Azure, Cloudflare, Kubernetes and Docker resources with an icon of
  their own (an `aws_lambda_function` is Lambda, an `azurerm_kubernetes_cluster` AKS, a `cloudflare_r2_bucket` R2);
  every other resource has the Terraform icon.
- Each `module "<name>"` is a box named by its name, with the Terraform icon, its note its `source`.
- **References are the lines.** Wherever a block's attributes (at any depth, inside `${}` interpolation and heredocs
  too) name another resource as `<type>.<name>`, or a module as `module.<name>`, an arrow runs from the block to what
  it names; `depends_on` reads the same. A name no file declares draws nothing, nor do `var.`, `local.`, `data.`,
  `each.`, `count.`, `self.`, `path.` and `terraform.`.
- **Joining resources.** A resource whose type ends `_attachment` or `_association` (a policy attached to a role, a
  route table to a subnet) is a relation, not a thing: it draws no box but a dashed line between the first two
  resources it names, and is skipped and said when it names fewer.
- Several `.tf` files of one module read together draw one system, as Terraform reads a folder.

### Kubernetes

- Each workload (`Deployment`, `StatefulSet`, `DaemonSet`, `ReplicaSet`, `Job`, `CronJob`, `Pod`) is a box named by
  its `metadata.name`, wearing the icon its first container's image would wear in Compose (Postgres, Redis, NGINX,
  ...), else the Kubernetes icon. Its note holds its kind, its replicas and its images.
- Each `Service` is a box with the Kubernetes icon, and an arrow to each workload in its namespace whose pod labels
  hold every pair its `selector` names.
- Each `Ingress` is a rounded box named by its name, its note its hosts, with an arrow to each Service its rules and
  default backend name.
- A `PersistentVolumeClaim` is a cylinder, joined by a dashed line from each workload that mounts it; a StatefulSet's
  `volumeClaimTemplates` each draw one too.
- **Namespaces.** When the objects sit in two or more namespaces, each namespace is a group framing its objects. One
  namespace (or none, which is `default`) draws no frame.

## Large systems

A big system must still read. Two rules hold, in order:

- **Group.** Past `INFRA_GROUP_FROM` boxes, with no network or namespace groups, boxes sharing a name prefix (the part
  before the first `-`, `_` or `.`) are framed together when two or more share it.
- **Cap.** At most `INFRA_MAX_NODES` boxes are drawn, in file order. The rest fold into one last box, "N more", whose
  note lists them, and their lines are dropped. The report says how many were left out.
- **Lines.** Past the graph builder's 1,000 lines the rest are dropped and counted the same way.

A 200-service Compose file therefore draws as about a dozen framed families and one "more" box: read and drawn in about
4 ms, laid out in about 40 ms (measured on an Apple-silicon laptop).

## Naming the drawing

- A Worker with no `name` is named after the folder its file sits in (`apps/api/wrangler.toml` is `api`), else
  "Worker"; a Compose file with no `name` after its folder, else "Compose"; Terraform and Kubernetes files after their
  folder, else "Terraform" and "Kubernetes".
- The drawing's title is its parts' names, up to three, then "and N more"; its subtitle names the files read
  (`From apps/api/wrangler.toml, compose.yml`). A paste is named for its format.
- A file that parses but holds nothing of its format (TOML with no Worker or binding, HCL with no resource or module,
  YAML with no Kubernetes object) says there is nothing to draw.

## What is skipped

Keys the import does not draw are ignored, never an error, and always said. Each format has a short list of settings
that are never architecture, skipped silently:

- Wrangler: `name`, `main`, `compatibility_date`, `compatibility_flags`, `account_id`, `$schema`, `workers_dev`.
- Compose: `version`, `name` and `x-` extension keys, and a service's runtime settings such as `environment`,
  `command` or `restart`.
- Terraform: the `terraform`, `provider`, `variable`, `output`, `locals`, `moved`, `import`, `removed` and `check`
  blocks.
- Kubernetes: `Namespace` (drawn as the groups), `ConfigMap`, `Secret`, `ServiceAccount`, `Role`, `RoleBinding`,
  `ClusterRole` and `ClusterRoleBinding` objects.

Every other key not drawn is named in the **summary**: each key once with how often it appeared (`vars`,
`observability (2)`, `services.*.develop`, `data.aws_ami`, `HorizontalPodAutoscaler (2)`).

- The CLI prints the summary to stderr, one line per file read and one line of skipped keys.
- The editor shows it in the import's report, one short line.

## Where it runs

### The CLI

`livediagram link from-code [<file>...] [--doc <d>] [--name <n>] [--env <e>] [--dry-run]`

- With no files it reads, from the working directory, whichever of `wrangler.toml`, `docker-compose.yml`,
  `docker-compose.yaml`, `compose.yml` and `compose.yaml` exist, and every `.tf` file there; none is a usage error
  (exit 2) naming them. Kubernetes manifests have no standard name, so they are named on the command line.
- Several files draw one tab (a monorepo's Workers, a Terraform module's files, a Compose file beside them).
- Without `--doc` it creates a document with one tab, named `--name` or the drawing's title, and prints the
  document's line as `document create` does. With `--doc` it adds the tab to that document, as `tab add` does.
- `--dry-run` reads and prints the graph as JSON on stdout, which `graph render -f -` or `document create -f -` take,
  and needs no sign-in.
- Each run makes a new tab: the CLI does not yet update a tab from its files (that waits for the repository binding,
  [diagram sources](../027-repositories/diagram-sources.md) "Binding").
- It lives under `link` because it is the repository's side of livediagram: the same files a
  [repository link](../027-repositories/repository-link.md) mirrors beside.

### The editor

The Import dialog offers **Infrastructure** beside Mermaid. Its panel takes several files at once:

- **Files.** A drop target that opens the picker (several files at a time) and takes files dropped on it. Each file
  added is a row: its format, its name and a way to remove it. Up to `INFRA_MAX_FILES`; a file past
  `INFRA_MAX_FILE_BYTES` is refused unread, named in the error.
- **Paste.** A text box under the files, for one file's text; it is read with them.
- **Wrangler environment.** Shown only when a `wrangler.toml` read holds `[env.*]` tables: a choice of "Top level"
  (the default) or each environment the files name.
- **Import** stays disabled until there is a file or text to read. It replaces the tab, as every import does, in one
  undo step, and the tab remembers its files.

The dialog's states:

- **Empty.** An empty file says "That file is empty." naming it.
- **Parse error.** The parser's message and line, naming the file: "compose.yml: Couldn't read the YAML: … (line 4)".
  The files and the paste stay so one can be fixed.
- **Nothing to draw.** A file that parses but holds nothing of its format says so, naming what it looked for.
- **Skipped keys or a cap.** The tab lands and the dialog shows its report: what landed, then one line naming the
  skipped keys, and one line for the boxes left out.
- The parsers load only when the Infrastructure panel opens, so none of their code reaches the editor's first load.

### Updating a tab from its files

A tab drawn by the import remembers its files: each one's name, format and a fingerprint of its text, the text itself
while the files together fit in `INFRA_SOURCES_MAX_STORED_CHARS`, the environment chosen, and what each box and line
was drawn as.

- **Where.** On such a tab the Import dialog opens with a **From Its Files** card above the formats, naming the files
  and when they were read, with **Update From Files**. The dialog opens as it always does (the tab menu's Import…,
  the command palette's Import…), so the update sits where a person already looks to bring files in.
- **The update panel** lists the remembered files, each a row with its state and its actions:
  - **Kept**: its text is remembered and used again as it was.
  - **Replaced**: a new version was chosen or pasted for it (the row says "No changes" when the text is the same).
  - **Needed**: its text was too large to remember, so it must be chosen again (or removed) before the update runs.
  - **Removed**: taken out of the sources; what only it drew goes on update. Removing is undone from the same row.
  - Each row offers **Choose File** and **Paste** (an inline text box) to replace it, and **Remove** (or **Keep**).
  - **Add Files** adds files the tab did not come from; a file dropped on the panel replaces the row of the same name,
    else is added.
  - The **Wrangler environment** choice, starting at the one remembered.
  - **Update Diagram** runs it; disabled while a row is Needed or no file is left.
- **What an update keeps.** Each box and line is matched to what it was drawn from by its id (the resource's slug):
  - A box the files still name stays where it is, at its size, in its colours and style. Its label, note and icon
    follow the files, unless someone changed that one on the tab since it was drawn: then theirs stays.
  - A box new in the files is added beside the first box already on the tab that it joins, at the offset the fresh
    layout gives the two; joining none, it goes to the right of the drawing, the new boxes keeping their layout among
    themselves. Either way it is moved down until it overlaps nothing, and a frame it belongs to grows to hold it.
  - A box gone from the files is removed, with the lines pinned to it, as the edit operation `rm` removes them.
  - A box someone deleted from the tab stays deleted while the files still name it: the deletion is the newer edit. A
    fresh Import (which replaces the tab) brings everything back.
  - Lines follow the same rules by their two ends; a kept line keeps its route.
  - Anything people added to the tab (boxes, notes, lines, stickies) is never touched.
- **One undo step.** The update is one commit; undo brings back the tab and its remembered files as they were.
- **The report.** It always shows: "Updated from 3 files", then how many boxes and lines were added, removed and
  kept, how many of people's edits were kept, and the skipped keys, as an import's report does.
- A fresh Import from the Infrastructure card replaces the tab and starts its sources again from the files given.
  Any other import onto the tab (Mermaid, JSON, ...) replaces it with something no file drew, so it forgets them.

## Limits

- A file is read up to `INFRA_MAX_FILE_BYTES` (1 MB); a larger one is refused before parsing.
- Up to `INFRA_MAX_FILES` files are read in one run, in the CLI and the editor alike.
- HCL blocks nest up to `HCL_MAX_DEPTH` deep; deeper is a parse error naming the line.
- A tab remembers its files' texts only while together they fit in `INFRA_SOURCES_MAX_STORED_CHARS` (200,000
  characters, far past any real set of these files, and a tenth of a tab's size cap); past it, the files that do not
  fit are remembered by name and fingerprint only, and an update asks for them.
- Labels go through the graph builder's cap (40 characters, the rest in the note).

## Observability and telemetry

- CLI fingerprints on `--debug`: `[from-code] read <file> <format>`, `[from-code] skipped <count>`, `[from-code]
capped <count>`.
- Editor: `[infra-import]` with the formats, file, node, edge and skipped counts; `[infra-update]` with the files and
  the added, removed, kept and edits-kept counts.
- Telemetry: `Cli·Used·LinkFromCode`; `Tab·Imported·Wrangler`, `Tab·Imported·Compose`, `Tab·Imported·Terraform` or
  `Tab·Imported·Kubernetes` from the editor, by the first file's format; `Tab·Imported·InfraUpdate` for an update (the existing pair, so no new action).

## Share roles

Importing and updating replace or change the tab, an edit: an Editor may import and update; a Participant and a
Viewer never see the Import dialog or its From Its Files card, as for every other
import ([Share roles](../013-workspace/share-roles.md)). A locked tab refuses both until it is unlocked.
