// How-tos (docs/specs/015-api/cli.md "Help"): the depth top-level help leaves out, paid for only when asked.

export const GUIDE_TOPICS = {
  build: {
    summary: 'build a diagram from scratch',
    text: `Build a diagram

Create a document with one empty tab through the api escape hatch; you choose its id:

  printf '{"id":"%s","name":"Shop","tabs":[{"id":"main","name":"Main","elements":[]}]}' \\
    "$(node -p 'crypto.randomUUID()')" | livediagram api POST /documents --body -

Then add to the tab with edit operations (livediagram guide edit):
boxes by label, placed beside each other, and the arrows between them. Write the structure,
not the coordinates: add places a box clear of the others.

  add square id=web label="Web app"
  add square id=api label=API right-of:web
  connect web -> api

Check how it is drawn; each finding ends with a fix written as edit operations:

  livediagram tab lint Shop`,
  },
  edit: {
    summary: 'change a tab with edit operations',
    text: `Edit a tab

Read it first; the refs in a view (n3, f2) name elements in edits:

  livediagram tab view "Auth flow"
  livediagram tab ls "Auth flow" --json       the document and tab ids

Send edit operations as one changeset, all or nothing, as the "operations" string:

  printf %s '{"operations":"set n3 label=\\"Sign in\\"\\nconnect n3 -> n7"}' \\
    | livediagram api POST /documents/<id>/tabs/<tab-id>/changesets --body -

Operations: add set rm move connect rewire insert wrap unwrap order layout test.
Select by ref (n3), "label", type:sticky, in:f2, n3->n4, downstream:n3.
Values with spaces are quoted: label="Sign in". key= unsets a field.
"dryRun": true plans without writing. The answer says what changed, the new revision, the
lint verdict, and how to revert it.`,
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

Reply to and resolve threads in the editor.`,
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
