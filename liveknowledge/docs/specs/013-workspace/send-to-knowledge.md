# Send to Knowledge Base

What liveknowledge does when another app sends with
[Send to Knowledge Base](../../../../liveworkspace/docs/specs/004-index/send-to-knowledge.md) (Work Tracker 1425): the
door that writes the section, how the section reads on the page, its Sent From chip, and what agents may do. The
picker, the summary and the limits are the platform's.

## The door

`POST /api/internal/items/<id>/knowledge-send`, opened by the index alone, with the person's grant
(`X-Index-Grant`, an Editor's on the whole knowledgebase, out of the Trash; anything else is `403 grant_refused`):

- `op: 'outline'`, `{page}`: the page's headings, `{headings: [{id, level, text}]}`, levels 1 to 3, in order.
- `op: 'write'`, `{person, page | newPage {title, parent}, after?, heading?, markdown, picture?, sentFrom}`: the
  section written as the person, through the page's own write (the Pages route an Editor's article write takes: its
  gate, its relay to open editors, Updated, the page's watchers), answering `{ok: true, page: {id, title}, link}`
  or `{ok: false, code, reason}` (`page_gone`, `page_locked`, `pages_full`, `picture_refused`, `failed`).
  - `after`: a heading block's id: the section goes at the end of that heading's part, before the next heading of
    the same or a higher level. Absent: after the page's last block.
  - `newPage`: a page made first (as `create_page` makes one, under `parent` or at the top level), its Owner the person.
  - `picture`: `{png (base64), width, height}`, stored in the person's Library through the media service and placed
    as an object zone, aligned left, after the summary.

## The section on the page

A level 2 heading (when given), the summary's Markdown, the picture, and the Sent From line, an ordinary paragraph:
"Sent from <source title> in <app>", its last words a link to the place. Everything in it is the page's own writing,
edited, moved, verified and exported as any other.

**The Sent From chip.** When a page opens, the editor reads the knowledgebase's received sends
(`GET /api/index/items/<id>/knowledge-sends?received=1`, the reader's own access to each source) and, in the writing,
draws a chip after any paragraph that links to a send's place: the source app's logo and the source's name as it is
now ("livediagram · Payments flow"), pressed to open the place in a new browser tab. A reader who cannot open the
source sees the line's words alone. The chip is never written into the text, typed over or exported.

## Agents

- `write_page` takes `after` (a heading of the page, by its words; the first match) with `mode: 'append'`, to write
  under it, and `create_page` and `write_page` take `sentFrom` (`{app, itemId, tabId?, elementIds?}`): the write ends
  with the Sent From line, and liveknowledge asks the index to record the send for the token's person
  (`POST /app/items/<id>/knowledge-sends`), recorded only when that person can read the source. A source the index
  will not record still writes the page; the answer says `sentFrom: 'not recorded'`.
- The write is bounded by AI Editing as every agent write is.

## Who

| Role                     | Written to by a send | Sees the Sent From chip            |
| ------------------------ | -------------------- | ---------------------------------- |
| Editor (whole item)      | Yes                  | When they can open the source      |
| Participant, Viewer      | No (not listed)      | When they can open the source      |
| Guest, embed, Community  | No                   | No (the line's words and its link) |
