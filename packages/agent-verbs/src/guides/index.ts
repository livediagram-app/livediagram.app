// How-tos (docs/specs/015-api/cli.md "Help"): the depth top-level help leaves out, paid for only when asked.

export const GUIDE_TOPICS = {
  build: {
    summary: 'build a diagram from scratch',
    text: `Build a diagram

Write the structure, not the coordinates: a graph of nodes and edges, or Mermaid.

  {"nodes": [{"id": "web", "label": "Web app"}, {"id": "api", "label": "API"}],
   "edges": [{"from": "web", "to": "api"}], "direction": "right"}

Labels are headings (40 characters); longer text moves into the node's note.
Group nodes with "group" and a "groups" list only when the groups own their arrows:
tier groups (all databases together) route arrows through other groups.

Create a document from it, then check how it is drawn:

  livediagram document create "Shop" -f arch.json
  livediagram tab lint Shop

Each finding ends with a fix you can send as edit operations (livediagram guide edit).`,
  },
  edit: {
    summary: 'change a tab with edit operations',
    text: `Edit a tab

Read it first; refs in the view name elements in edits:

  livediagram tab view "Auth flow"

Send edit operations, one a line, as one changeset (all or nothing):

  livediagram edit "Auth flow" -f - <<'OPS'
  set n3 label="Sign in" shape=stadium
  insert square id=verify label="Verify email" between n3 n4
  connect verify -> n7 label=retry
  OPS

Operations: add set rm move connect rewire insert wrap unwrap order layout test.
Select by ref (n3), "label", type:sticky, in:f2, n3->n4, downstream:n3.
Values with spaces are quoted: label="Sign in". key= unsets a field.

In a shell, -> unquoted redirects output: quote the line, or use
livediagram element connect <doc> <a> <b>, which takes the two ends as words.

Every write prints what changed, the revision, the lint verdict and the revert command.
Add --dry-run to see the plan without writing.`,
  },
  views: {
    summary: 'read a tab as text, cheaply',
    text: `Views

A view answers one question about a tab at the lowest token cost:

  outline   what is there, nested by frame, arrows on the line   (default)
  graph     what connects to what
  layout    where things sit; --coarse for rows
  comments  open threads; --all adds resolved ones
  show      one element in full: --ref n3
  find      elements whose text matches: --text api
  lint      what is wrong with how it is drawn: livediagram tab lint

  livediagram tab view "Auth flow" --view graph --budget 2000

--budget fits a view to about that many tokens; its last line says what it left out.
--json gives the same view as JSON. A document's overview: livediagram document view <doc>.`,
  },
  comments: {
    summary: 'read and answer comment threads',
    text: `Comments

Threads sit on elements. Read the open ones as a view:

  livediagram tab view "Auth flow" --view comments

Answering and resolving threads from the CLI arrives with agent presence; until then, reply in the editor.`,
  },
  collaborate: {
    summary: 'work beside people on the same document',
    text: `Collaborate

Your changesets reach everyone with the tab open, live, credited to you, and can be undone as one unit.
An element a person has selected is left alone: the changeset is refused as held; retry later.
Something changed since you read? The changeset is refused as a conflict: read again, then retry.

  livediagram changeset ls "Auth flow"
  livediagram changeset show "Auth flow" cs_8k2m4q7d1x`,
  },
} as const;

export type GuideTopic = keyof typeof GUIDE_TOPICS;

export const GUIDE_TOPIC_NAMES = Object.keys(GUIDE_TOPICS) as GuideTopic[];

export function isGuideTopic(value: string): value is GuideTopic {
  return GUIDE_TOPIC_NAMES.some((topic) => topic === value);
}
