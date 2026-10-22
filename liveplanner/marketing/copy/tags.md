# Tags & keywords

One-word tags for directory listings, app stores and Product Hunt. Ranked by how tightly they fit the product, then split by platform so you
can paste the right set into each field.

Built from [`facts.md`](facts.md). No tag may imply an unshipped feature (CRDT /
conflict-free editing, native apps): that means no `crdt`, `offline-first`,
`ios` or `android`.

## Ranked by fit

**Tier 1, core identity (use these first, almost everywhere)**

`planning` · `kanban` · `project-management` · `task-management` ·
`collaboration` · `realtime` · `boards` · `spreadsheets`

**Tier 2, strong supporting**

`forms` · `dashboards` · `productivity` · `teamwork` · `free`

**Tier 3, context-dependent (when a directory wants more, or is dev-focused)**

`gantt` · `okrs` · `mcp` · `ai-agents`

## Judgment calls

- **`project-management`** pulls search traffic, but liveplanner is a light,
  shared planner, not an enterprise PM suite. Fine as a tag for reach; don't
  promise portfolio or resource-management features in prose.
- **`mcp`** and **`ai-agents`** are true (agents can read and change boards,
  cards, sheets and forms) but mean little to a general audience. Use them on
  developer and AI-tool directories.
- **Skip** `crdt`, `offline-first`, `ios`, `android`. They imply features that
  aren't shipped.
- **Skip** any tag about the source code or running your own copy: the source is not public.
- **Skip** tech-stack tags (`nextjs`, `cloudflare`, `typescript`): they mean
  nothing to a general audience.

## By platform

**Product Hunt topics** (pick from their fixed taxonomy; closest matches):

```
Productivity · Task Management · Project Management · SaaS
```

**Generic directory keywords** (general audience; no tech jargon):

```
planning kanban boards project management task management spreadsheets
forms dashboards collaboration realtime teamwork free
```

**App store / short keyword field** (tightest, highest-fit only):

```
planner, kanban, boards, spreadsheets, collaboration
```
