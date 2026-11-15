# Infrastructure code import

An architecture diagram drawn by hand drifts from what is deployed, while the source of truth already sits in the
repository. The **infrastructure import** reads that source and draws it: a **one-shot** import that turns a
`wrangler.toml` or a Docker Compose file into a laid-out architecture tab, each Worker, binding and service a box
with its technology icon, each binding, dependency and network a line or a group.

It is one-shot: the tab it makes is an ordinary tab, edited like any other, and running the import again makes a new
tab. Re-reading a changed file into a tab already drawn, keeping what people drew on it, is the job of
[diagram sources](../027-repositories/diagram-sources.md), which will take this import as one of its `in` bridges
once that machinery is built.

## Formats

Version one reads two formats, and only these two: format sprawl is the risk, so Terraform, Kubernetes manifests,
Pulumi and OpenAPI wait for their own decision.

| Format         | Recognised by                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Wrangler       | a file named `wrangler.toml`, or TOML whose top level holds `name`, `main` or a binding table     |
| Docker Compose | `docker-compose.yml` / `.yaml`, `compose.yml` / `.yaml`, or YAML whose top level holds `services` |

Pasted text has no name, so its content decides: YAML with a `services` mapping is Compose, anything else is read as
TOML. Each is read with a real parser (`smol-toml`, `js-yaml`), never by hand, so comments, inline tables, anchors and
merge keys read as the formats define them.

## What is drawn

The import builds a node/edge graph and lays it out through the [graph builder](../015-api/mcp-server.md) (the MCP
`graph` argument's layout): the flow style, its direction chosen as the graph builder chooses it, angled lines, the
template look. A node's id is a slug of the resource it names, so two files naming one resource draw it once.

### Wrangler

The Worker is a box named by `name` (the file's folder when it has none), with the Workers icon. Each binding is a box
joined to it by an arrow from the Worker:

| Key                                                | Box                                         | Icon              |
| -------------------------------------------------- | ------------------------------------------- | ----------------- |
| `kv_namespaces`                                    | the binding name                            | KV                |
| `r2_buckets`                                       | the bucket name                             | R2                |
| `d1_databases`                                     | the database name                           | D1                |
| `queues.producers`                                 | the queue (arrow Worker to queue)           | Queues            |
| `queues.consumers`                                 | the queue (arrow queue to Worker)           | Queues            |
| `durable_objects.bindings`                         | the class name, with the Worker hosting it  | Durable Objects   |
| `services`                                         | the bound Worker, a Worker box of its own   | Workers           |
| `ai`                                               | Workers AI                                  | Workers AI        |
| `images`                                           | Images                                      | Images            |
| `assets`                                           | Static assets                               | Pages             |
| `vectorize`, `hyperdrive`, `analytics_engine_datasets` | the index, binding or dataset, a cylinder | none (no icon exists) |
| `workflows`, `browser`                             | the workflow name, Browser Rendering        | none              |
| `routes` / `route`                                 | the first route, an arrow into the Worker   | DNS               |
| `triggers.crons`                                   | Cron and its first schedule, a dashed arrow into the Worker | none |

- A service binding names another Worker, so several `wrangler.toml` files read together draw one system: the bound
  Worker's box is the same box its own file draws.
- `[env.<name>]` tables are not merged in: the top level is drawn, and the summary names the environments left out.
  The CLI's `--env <name>` draws that environment instead, its keys taking the place of the top level's, as
  Wrangler's own non-inheritable keys do.

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

## Large systems

A big system must still read. Two rules hold, in order:

- **Group.** Past `INFRA_GROUP_FROM` boxes, with no network groups, services sharing a name prefix (the part before
  the first `-`, `_` or `.`) are framed together when two or more share it.
- **Cap.** At most `INFRA_MAX_NODES` boxes are drawn, in file order. The rest fold into one last box, "N more", whose
  note lists them, and their lines are dropped. The report says how many were left out.

A 200-service Compose file therefore draws as about a dozen framed families and one "more" box, laid out within the
graph builder's budget.

## What is skipped

Keys the import does not draw are ignored, never an error, and always said. Each format has a short list of settings
that are never architecture (`name`, `main`, `compatibility_date`, `compatibility_flags`, `account_id`, `$schema`,
`workers_dev` for Wrangler; `version`, `name` and `x-` extension keys for Compose, and a service's runtime settings
such as `environment`, `command` or `restart`), which are skipped silently. Every other key not drawn is named in the
**summary**: each key once with how often it appeared (`vars`, `observability (2)`, `services.*.develop`).

- The CLI prints the summary to stderr, one line per file read and one line of skipped keys.
- The editor shows it in the import's report, one short line.

## Where it runs

### The CLI

`livediagram link from-code [<file>...] [--doc <d>] [--name <n>] [--env <e>] [--dry-run]`

- With no files it reads, from the working directory, whichever of `wrangler.toml`, `docker-compose.yml`,
  `docker-compose.yaml`, `compose.yml` and `compose.yaml` exist; none is a usage error (exit 2) naming them.
- Several files draw one tab (a monorepo's Workers, or a Compose file beside them).
- Without `--doc` it creates a document with one tab, named `--name` or the drawing's title, and prints the
  document's line as `document create` does. With `--doc` it adds the tab to that document, as `tab add` does.
- `--dry-run` reads and prints the graph as JSON on stdout, which `graph render -f -` or `document create -f -` take,
  and needs no sign-in.
- It lives under `link` because it is the repository's side of livediagram: the same files a
  [repository link](../027-repositories/repository-link.md) mirrors beside.

### The editor

The Import dialog offers **Infrastructure** beside Mermaid: paste a `wrangler.toml` or Compose file, or pick one. It
replaces the tab, as every import does, in one undo step.

- **Empty.** Import stays disabled until something is pasted; an empty file says "That file is empty."
- **Parse error.** The parser's message and line, under the box: "Couldn't read the TOML: … (line 4)". The paste stays
  so it can be fixed.
- **Nothing to draw.** A file that parses but names no Worker binding or service says so, naming what it looked for.
- **Skipped keys or a cap.** The tab lands and the dialog shows its report: what landed, then one line naming the
  skipped keys, and one line for the boxes left out.
- The parsers load only when the import runs, so none of their code reaches the editor's first load.

## Limits

- A file is read up to `INFRA_MAX_FILE_BYTES` (1 MB); a larger one is refused before parsing.
- The CLI reads up to `INFRA_MAX_FILES` files in one run.
- Labels go through the graph builder's cap (40 characters, the rest in the note).

## Observability and telemetry

- CLI fingerprints on `--debug`: `[from-code] read <file> <format>`, `[from-code] skipped <count>`, `[from-code]
  capped <count>`.
- Editor: `[infra-import]` with the format, node, edge and skipped counts.
- Telemetry: `Cli·Used·LinkFromCode`; `Tab·Imported·Wrangler` or `Tab·Imported·Compose` from the editor.

## Share roles

Importing replaces the tab, an edit: an Editor may import; a Participant and a Viewer never see the Import dialog, as
for every other import ([Share roles](../013-workspace/share-roles.md)).
