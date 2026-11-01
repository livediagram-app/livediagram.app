# Phone notifications

A signed-in person who turned phone notifications on (Settings > Account > Notifications > Phone) hears on their
phone when someone mentions them, assigns them an action, replies in a thread they commented in, or comments on a
diagram they own. The platform keeps the devices and sends ([push.md](../../../../liveworkspace/docs/specs/003-accounts/push.md));
livediagram decides who hears of what, with the rules every app shares (`createPusher` in `@liveworkspace/index-app`), and
gives each notification its link. The install that iPhone and iPad need first is [Installable app](../016-platform/installable-app.md).

## When livediagram notifies

- **A comment** in a tab save, a changeset or the REST comment routes: each new comment the writer wrote (at most 5 a
  save) tells the people it @mentions (a team diagram, from one of its joined people), who wrote earlier in its
  thread, and the diagram's owner, one notification each, the strongest kind first. Beside the comment and
  mention emails, but not behind them: a deployment without email still notifies, and the switches are the person's
  own (`pushComments`, `pushMentions`, `pushThreadReplies`).
- **An assigned action** (`POST /api/<items>/<id>/notify-action`): the assignee, when they have an account and can
  open the diagram, whether or not the dialog's Email box is ticked (`email: false` sends the notification alone).
  The editor asks on every new teammate assignee, with the action's tab and element.
- **Never** for an API token's comment or changeset, a guest's, or the person's own; never to someone already in the
  diagram's room (the room's `ROOM_PEOPLE`); never to someone who can't read the diagram (owner, joined team
  people, or the index's grant, a password link included). Editors, Participants and Viewers can all read, so all
  can be told.

Everything runs after the answer (`waitUntil`, or the changeset's after-work), and a failure is logged, never seen.

## Links

Every link is on livediagram's own address (`APP_BASE_URL`), in the editor's deep-link grammar (`lib/collab-deep-link.ts`):

- **A thread on an element** (a Sheet cell's thread opens its element's): `/document/<id>#t=<tab>&el=<element>&open=comments`.
  Tag `<id>:<element>`, so a burst of replies on one thread is one notification.
- **An assigned action**: `/document/<id>#t=<tab>&el=<element>&open=action`, or `/document/<id>` from an older editor
  that sends no place. Tag `<id>:<element>`.

A title names who and the diagram, never what they wrote: `Ada commented on Roadmap`.

## Code

- `apps/api/src/liveworkspace/push.ts`: the pusher, the links and tags; `liveworkspace/action-notices.ts`: an
  assignment's push and email, sent from the document room so an assignee already in it is skipped.
- The triggers: the tab save route, `changesets/after.ts`, the comment routes and the
  team notify routes' action notice.
- The room's `ROOM_PEOPLE` on its env facade.
- The editor: `hooks/collab/useEditorActions.ts` asks `notify-action` with `email`, `tabId` and `elementId`.
