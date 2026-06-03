# Tags & keywords

One-word tags for directory listings, app stores, GitHub topics, and Product
Hunt. Ranked by how tightly they fit the product, then split by platform so you
can paste the right set into each field.

Built from [`facts.md`](facts.md). No tag may imply an unshipped feature (team
workspaces, transactional email, CRDT / conflict-free editing): that means no
`teams`, `sync`, `crdt`, or `email`.

## Ranked by fit

**Tier 1, core identity (use these first, almost everywhere)**

`diagrams` · `diagramming` · `flowcharts` · `mindmaps` · `whiteboard` ·
`collaboration` · `multiplayer` · `realtime`

**Tier 2, strong supporting**

`canvas` · `visualization` · `brainstorming` · `opensource` · `selfhosted` ·
`free`

**Tier 3, context-dependent (when a directory wants more, or is dev-focused)**

`teamwork` · `collaborative` · `architecture` · `mit` · `nextjs` ·
`cloudflare` · `typescript`

## Judgment calls

- **`whiteboard`** matches the surface and pulls search traffic, but
  [spec/00](../../specs/00-purpose.md) positions livediagram _against_
  general-purpose whiteboards (Miro / FigJam). Fine as a tag for reach; don't
  lead with it in prose.
- **Skip** `teams`, `sync`, `crdt`, `email`. They imply features that aren't
  shipped yet.
- Reserve the tech tags (`nextjs`, `cloudflare`, `typescript`) for developer
  surfaces (GitHub, dev directories). They mean nothing to a general audience.

## By platform

**GitHub topics** (lowercase, hyphenated where multi-word; dev audience, so tech
tags belong here):

```
diagrams diagramming flowcharts mindmaps whiteboard collaboration
multiplayer realtime canvas open-source self-hosted nextjs cloudflare
typescript durable-objects
```

**Product Hunt topics** (pick from their fixed taxonomy; closest matches):

```
Design Tools · Productivity · Open Source · Developer Tools · SaaS
```

**Generic directory keywords** (general audience; no tech jargon):

```
diagrams diagramming flowcharts mindmaps whiteboard collaboration
multiplayer realtime brainstorming visualization free open source
self-hosted
```

**App store / short keyword field** (tightest, highest-fit only):

```
diagrams, flowcharts, mindmaps, collaboration, multiplayer
```
