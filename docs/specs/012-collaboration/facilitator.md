# Facilitator

Status: shipped

## What

One person in a live session holds the **facilitator** baton, and the tools that
run the room answer to them: the timer, the votes, the polls, the reveals. The
owner hands it out, anybody can be given it, and the owner can always take it
back.

Nobody holds it by default, and a session where nobody takes it behaves exactly
as it does today.

## Why

A board full of workshop tools has no idea who is running the workshop. Two
people start countdown timers over each other; somebody reveals the estimates
while a third is still typing one; a poll ends mid-answer because a second
person pressed End. Every one of those is a collision between people who all
have edit rights and all mean well.

The missing idea is not a permission, it is a **role**: who is driving. The
diagram already knows who owns it and who may edit it, and neither answers the
question. The owner is frequently the wrong answer on purpose: somebody builds
the board on Monday and asks a colleague to run the session on Tuesday.

## The constraint that shapes this

**The room does not know who anybody is, deliberately.** At the WebSocket
upgrade the api resolves the visitor's role and forwards only
`X-Verified-Role: edit | view`
([`diagram-room-routes.ts`](../../../apps/api/src/routes/diagram-room-routes.ts)):

> Presence identity is no longer forwarded: the DO assigns each session a fresh
> ephemeral id for its broadcast presence / cursor ([Public API and API tokens](../015-api/public-api-and-tokens.md) §6), so the real
> owner id never reaches the room and a joiner can't spoof another peer's
> presence (there's no real id to claim).

So the two obvious ways to name a facilitator both fail. A **presence id** is
minted per socket, so it dies on every refresh. The **participant key**
([Per-participant responses](participant-responses.md)) is client-claimed and relayed unchanged — the room's own comment
says holding it grants nothing, which stops being true the moment it grants the
baton.

The answer is not to give the room an identity. It is to give the baton one.

## The model: a baton with a token

The room mints a **facilitation token** when it grants the baton and sends it to
the holder alone. The holder keeps it in `sessionStorage` and presents it in
their `hello`.

- **Unspoofable** without the room learning who anyone is: the token never
  reaches another peer, so [Public API and API tokens](../015-api/public-api-and-tokens.md) §6 stands untouched.
- **A refresh is invisible.** New socket, new presence id, same token, baton
  reclaimed before the page has finished painting.
- **Leaving is a real event**, because the room sees the socket close.
- No D1 migration and no identity plumbing.

For "the owner can always take it back", the api forwards one more
server-verified bit at upgrade — `X-Verified-Owner`, which the route already
computes as `isOwnerUpgrade`. A boolean, carrying no identifier, so nothing
about the anti-spoofing property changes.

**Server-verified means the route must overwrite it, not just set it.** The room
holds no identities, so it believes this header outright — which makes stamping
it on **every** path, not only the owner's, part of the contract. It first
shipped as a conditional `set`, and since the upgrade forwards the client's own
request (`new Request(request)`), a copy the client sent survived on every
non-owner path: browsers can't put headers on a WebSocket upgrade, but
`websocat` / `curl` can, so any edit-role share-link holder could send
`X-Verified-Owner: 1` and be seated as the owner — enough to seize the baton off
its holder and end someone else's turn. Both trust headers are now written
unconditionally (`X-Verified-Owner: '1' | '0'`), which is also why the room reads
`=== '1'`. `diagram-room-routes.test.ts` asserts the forwarded headers rather
than the route's intent, with a hostile pre-set pair as the input.

### Who may take it

| Baton                  | Who can take it                               |
| ---------------------- | --------------------------------------------- |
| Free (nobody holds it) | Anyone with edit rights, by taking it         |
| Free                   | The owner, same as anyone                     |
| Held by somebody else  | The owner only                                |
| Held by me             | I can pass it to a named person, or step down |

That table is the whole permission model. Delegation needs no dialog: the owner
hands it over from the Collaborators modal, or simply lets the person who is
running the session take it. "The diagram can always take back control" falls
out of one row.

**View-role visitors cannot hold it.** The tools it governs write to the
document, so a baton a view-only person cannot use would be a trap. The action
is shown greyed with the reason rather than hidden, so the rule is learnable.

### What happens when they leave

| Event                           | What happens                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Facilitator refreshes           | Token re-presented on `hello`, baton reclaimed, nothing is announced                  |
| Network blip, closed laptop lid | The same, as long as it is inside the grace period                                    |
| Facilitator leaves for good     | 90 seconds after their last socket closes, the baton is released and the room is told |
| Owner wants it back             | Taken at any moment, held or free                                                     |
| Everyone leaves                 | The baton dies with the room                                                          |

**90 seconds** is chosen to cover a refresh and a dropped connection without
leaving a workshop stuck behind somebody who has gone to lunch.

**The baton does not outlive the session.** A facilitator appointed last Tuesday
silently governing this morning's stand-up is worse than being asked again, and
the room's own storage is the natural home for something that means "right now".

## What the facilitator runs

When somebody holds the baton, these answer to them alone. When nobody does,
every one of them behaves exactly as it does today.

| Gated                                                                 | Where it lives today      |
| --------------------------------------------------------------------- | ------------------------- |
| Timer: start, pause, resume, set duration, reset, clear               | `useTabSession.ts`        |
| Dot vote: start, end, reveal, clear, and stepping through the results | `useTabSession.ts`        |
| Poll: start, end                                                      | `useLivePoll.ts`          |
| Session button: pressing it **and configuring it**                    | `useBehaviourElements.ts` |
| Agenda item press (it starts that item's countdown)                   | `useCollabElements.ts`    |
| Estimate / Temperature: reveal responses, clear for a new round       | `useCollabElements.ts`    |
| Idea box: reveal, clear, scatter to the canvas                        | `useCollabElements.ts`    |
| Done check: "Reset everyone"                                          | `DoneCheckFace.tsx`       |
| Picker: the roll everyone watches                                     | `useBehaviourElements.ts` |
| Roll call: take the roll                                              | `useCollabElements.ts`    |
| Reveal zone: lifting a cover                                          | `useBehaviourElements.ts` |
| Bring Focus: pressing it                                              | `useEditorState.ts`       |

The session button is the one that reads oddly against "authoring is not
running", and it earns its place: its configuration IS the timer's length and
the poll's question, so changing it mid-session changes what the next press does
to everybody. The owner who wants to edit it can take the baton back, which is
one click.

### What stays everyone's

| Open                                                                                                                                                     | Why                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Every personal response: casting and retracting a dot, answering a poll, responding to an estimate or temperature, adding an idea, marking yourself done | This is what the room is FOR. A tool only the facilitator can answer is not a tool                             |
| Mode button press                                                                                                                                        | It switches YOUR canvas tool and touches nothing shared                                                        |
| Follow Me, the laser, the spotlight, reactions, cursors                                                                                                  | Pointing at things is everybody's job                                                                          |
| Running a slide deck                                                                                                                                     | `presentingAt` is local state: it is your own screen                                                           |
| Comments, assigned actions                                                                                                                               | They are a conversation, not a pace                                                                            |
| All ordinary editing, import, export, themes, layout cleanup                                                                                             | Nothing to collide over that the selection lock ([Live app](../007-editor/live-app.md)) doesn't already handle |

### Two elements this changes

**Reveal zone ([Reveal zone](../009-elements/reveal-zone.md))** is per-viewer today: `revealedIds` is local state,
"a property of having looked", lost on reload. Gating a purely local act would
be meaningless, so with a facilitator present the lift becomes **a room-wide
act**: the facilitator lifts the cover and everybody sees behind it, which is
what "now let's look at the answers" means in a session. With no facilitator it
stays exactly as it is, per-viewer. That is a real change to [Reveal zone](../009-elements/reveal-zone.md) and needs
its spec amended alongside this one.

**Bring Focus ([Bring Focus](bring-focus.md))** currently says, in as many words, that anyone in the
room can press it including view-role visitors, because "the person who spots
the thing worth looking at is often not the owner". Under a facilitator that
tightens: it is the facilitator's to press, because "everybody look here" is the
same act as "everybody stop and listen". With no facilitator, [Bring Focus](bring-focus.md)'s rule is
unchanged. [Bring Focus](bring-focus.md) gets the amendment.

## How it is enforced, honestly

This is **who is driving, not who is allowed**. Everybody in the room already
has edit rights or does not, and the baton is not defending the diagram from
them — it is stopping two well-meaning people from starting timers at once.

Enforcement is therefore uneven, and deliberately so:

- **Client-side for everything.** The gated controls disable, with the reason on
  them.
- **Room-side for the ops that are already distinct.** `poll-start` /
  `poll-end` are their own mutation kinds, so refusing them from a non-holder
  costs a few lines and closes the one case where a second client could end
  somebody's poll.
- **Not room-side for the timer and the vote.** They are plain tab state riding
  the same `tab` / `tab-meta` ops that carry every shape move, so the room
  cannot tell "started a timer" from "dragged a box" without inspecting
  payloads. Adding that inspection would buy nothing against an actor who can
  already save the whole document over REST.

- **Room-side for freeing a lock**, which is arbitrated for the same reason the
  baton is: see below.

If the role ever needs to be a real permission, that is a different feature:
verified identity inside the room, and field-level guards on the save path.

## Freeing somebody's lock

The concurrent-selection lock ([Live app](../007-editor/live-app.md)) makes an element
somebody else has selected un-editable for everyone else. Usually that resolves
itself — they click away, or they leave and their presence goes with them. What
does not resolve is the person who is still connected and has wandered off with
something selected, and the session stops on an element nobody can touch.

So the facilitator can free it: right-click the locked element, and the one
thing there is to do is offered. Right-clicking a locked element used to open
nothing at all, and it still opens nothing for everybody else — the element is
still locked, and a full element menu would be a menu of dead rows with one
live one, so this is a small menu of its own (`LockedElementMenu`).

**Who may.** The same rule as the session tools (`mayReleaseLock` is
`mayRunSession`): yours while somebody is facilitating, everybody's while the
baton is free. A stricter "must hold the baton" would hide the affordance in
the ordinary room — most sessions never claim a baton, and the moment you need
this is precisely a moment nobody was thinking about facilitation. It is also
the least invasive session verb: it drops a selection. The holder loses no
work, because an edit in flight is their own local state and the element itself
is not touched.

**Why it is arbitrated rather than relayed.** Exactly the argument that makes
the baton a message and not an op. A relayed "let go of that" would be a command
any peer could issue against any other, and the whole point is that only the
person running the session can.

**How the target is addressed.** The room sends `selection-released` to the
holder's socket ALONE, and being sent it is the entire addressing: a client is
never told which presence id is its own ([Public API and API tokens](../015-api/public-api-and-tokens.md)
§6), so a broadcast naming a target would arrive at nobody able to recognise
itself in it. The same trick as the baton token. The holder then clears its
selection and re-broadcasts its ordinary `select` op, so every other peer's
lock falls away through the path that already existed and the room tells nobody
else anything.

Refusals are silent — a caller without the baton, a target who has already
left, an unlock aimed at yourself. Answering any of them would tell a peer
which presence ids are live.

## The wire

Three presence ops, ephemeral like the rest (never logged, never replayed):

```ts
{
  kind: 'facilitator-claim';
} // take a free baton
{
  kind: 'facilitator-grant';
  to: string;
} // pass it to a presence id
{
  kind: 'facilitator-release';
} // step down
```

The room answers with the state everybody needs, and the token only to the
holder:

```ts
{
  kind: 'facilitator';
  holder: string | null;
} // broadcast: whose presence id
{
  kind: 'facilitator-token';
  token: string;
} // to the new holder alone
```

`hello` gains one optional claimed field, `facilitatorToken`, clamped like every
other string on that frame. It grants the baton only if it matches the token the
room issued and the baton is still free or still theirs.

## UX

### Handing it over

Everything happens on the person's row in the **Collaborators modal**
([Collaborator enhancements](collaborator-enhancements.md)), which already carries an avatar, a name with badges, a status line
and one trailing **Follow** button. The baton adds a second verb to that row,
beside Follow, because "make this person the facilitator" is a thing you do
_to a person_ and the list of people is where you are already looking.

```
On this tab — Board
  (LD) Live Diagram   You  Editor  Facilitating
       Online                                    [ Step Down ]
  (BW) Bright Wolf    Editor
       Online · Active 54 secs ago   [ Make Facilitator ]  [ Follow ]
  (SP) Sam Patel      Viewer
       Active 5 mins ago             [ Make Facilitator ]  [ Follow ]
                                       ^ disabled: viewers cannot run a session
```

| Row                          | Button                            | When                                                                                                        |
| ---------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Somebody else                | **Make Facilitator**              | I may grant: the baton is free and I have edit rights, or I am the owner, or I hold it and am passing it on |
| Somebody else, a viewer      | **Make Facilitator**, disabled    | Always. The tooltip says why, rather than hiding the button and leaving the rule unlearnable                |
| Somebody else, holding it    | no button, **Facilitating** badge | Taking it back is done from my own row, so the baton has one home per person                                |
| Mine, baton free             | **Take Facilitation**             | I have edit rights. This is also how a solo facilitator starts                                              |
| Mine, somebody else holds it | **Take Over**                     | Owner only — the one row that makes "the diagram can always take back control" true                         |
| Mine, I hold it              | **Step Down**                     | Always                                                                                                      |

Self rows carry no button today; this is the first thing that gives them one,
which is what makes claiming and stepping down possible without a second
surface.

The holder also wears the **Facilitating** badge in the presence stack, so the
room can see who is driving without opening anything.

### Telling the room

Every change broadcasts, and every client raises a toast:

| Who sees it                               | Wording                                |
| ----------------------------------------- | -------------------------------------- |
| The new holder                            | "Alex made you the facilitator"        |
| Everybody else                            | "Alex is now facilitating"             |
| Everybody, on a step-down or a release    | "Nobody is facilitating now"           |
| The room, when an absent holder times out | "Alex left, so nobody is facilitating" |

These go through the existing toast system, which means the **Show
notifications** preference ([User preferences](../007-editor/user-preferences.md), `notificationsEnabled`) already governs
them: somebody who has turned toasts off gets none of this, exactly as they
asked. They are `info` tone, never `error`, so the gate applies (errors are
deliberately ungated, see `hooks/ui/useToast.tsx`).

The badge and the disabled controls are the permanent record; the toast is the
announcement. Somebody with notifications off still sees who is facilitating
everywhere it matters.

### Being told you cannot

A gated control that is not yours is **disabled with the reason on it** where
the control has a home of its own: the Session Studio names the facilitator at
the top ("Alex is facilitating this session. Ask them to start the timer, the
vote or a poll.") and wraps its panes in a disabled `fieldset`, which disables
every control inside it natively, including ones added later. Hiding the panel
would teach a different editor to every participant, and somebody who had never
seen the timer would not know there was one.

The **card-level** verbs — an idea box's Reveal, an estimate's Clear, a done
check's Reset everyone, the roll call, the picker's spin, a reveal zone's cover
and a Bring Focus press — go the other way: while somebody else facilitates the
control is simply **absent**, exactly as it is for a view-only visitor today.
That is the shape those faces already have (each verb is drawn only when its
handler is passed), and a card is small enough that a row of disabled buttons
reads as breakage rather than as a rule. The Studio's line is what explains the
board, and it names the person to ask.

## Edges

- **Offline diagrams** ([Offline Mode](../006-diagram/offline-mode.md)) have no room, so no baton and no badge.
- **Two browser tabs, one person**: each is a separate socket, but the token is
  in `sessionStorage`, so the tab that was granted it keeps it. Their other tab
  is an ordinary participant.
- **Two people claiming a free baton at once**: the room decides, first frame
  wins, and both learn the answer from the same broadcast.
- **The owner is absent for the whole session**: the baton is claimable by any
  edit-role participant, so a facilitated session never depends on the owner
  turning up.
- **The room restarts** (Durable Object eviction): the baton is free again, and
  the next claim takes it.

## Telemetry

`track('Collab', 'Changed', …)` on claim / grant / release, with a preset type
token. No user content, no names — [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)'s rule is unchanged.

## Out of scope

- **Request facilitation** (raise a hand and let the holder accept). Worth
  having; not worth blocking this on.
- **Per-tab facilitators.** One per diagram: a session has one pace.
- **Facilitator in the activity log.** It changes nothing in the document.
- **Making it a real permission.** See "How it is enforced, honestly".
