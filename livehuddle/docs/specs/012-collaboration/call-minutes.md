# Call minutes

Status: being built, local only, with the rest of Pro
([Subscription](../../../../liveworkspace/docs/specs/019-subscription/subscription.md)).

## What

A Space's calls ([Proximity audio](proximity-audio.md)) count against its owner's **Call Minutes**: one call minute is
one person in a call for one minute, counted only while two or more people are in it. Someone alone in a Space, or
alone in a call, counts nothing (owner, 2026-11-22: say so wherever the limit is explained). Free has 1,000 a month, Pro 5,000, Pro for Teams 2,500 a member, pooled. Nobody
limits how many people join a call.

With Pro off (`PRO_ENABLED` unset, the default) none of this exists: nothing is counted, nothing is stored, no alarm
is set, the subscription service is never asked, the mint route answers exactly as before and the editor draws
nothing new.

## Who pays

The Space's **owner**: the person whose library holds it, or its team for a team's Space. Never the person in the
call.

- A guest's minutes, a link visitor's and a collaborator's all count against the Space's owner.
- A team's Space counts against the team, also when the person in the call has Pro of their own.
- Every Space of one owner draws on the same month. The subscription service holds the count, so two Spaces spending
  at once can never pass the limit between them.
- **A guest's Space** (its owner has no account) has nobody to charge, by the one rule every app follows
  ([Subscription](../../../../liveworkspace/docs/specs/019-subscription/subscription.md) "A guest's item"). Its room
  counts its own minutes, in its own storage, against Free's 1,000 a month for that one Space, and the subscription
  service is never asked about it. Signing in makes the Space the person's: the count starts again with their month.

The owner is read on the server, from the grant the index signed for the request. No request from a browser carries
a tier, a limit or an owner, and a field of that name in a request body is never read.

## What counts

- **In a call** is a connection to the Space's room that holds a call session it has proven (`call-session`,
  [Proximity audio](proximity-audio.md#the-wire)). The room already keeps this for the hearing check: a session the
  room does not hold can subscribe to nobody, and nobody past the room's first minute awake can subscribe to it.
- **A person** signed in to an account is counted once, by their collab key, which the api derives from the account
  (the same across their tabs, devices and reconnects). Someone in the Space in two tabs is one person.
- **Someone without an account** is counted too, but is never a person the room can count on: a guest is counted
  once by the collab key the api derives from their guest id, and a link visitor once for **each connection**,
  never by the key their browser's own secret gives (two visitors sharing one secret would be one person and never
  charged; one visitor with many would be many).
- **At most 10 people without an account are counted in a Space in any one minute**
  (`CALL_UNVERIFIED_PEOPLE_MAX`), however many connect, leave and come back inside it. A room takes 100
  connections, and anyone can be all of them, so without a cap one signed-out visitor could spend a hundred of the
  owner's minutes a minute. Ten is more signed-out people than a Space's call usually holds, and a tenth of what
  the connections allow. People with an account are always all counted. The owner stops a visitor outright by
  changing the Space's link.
- **A call is two or more people.** Walking into a Space joins its call by itself, so someone alone in a Space holds
  a session and hears nobody. A minute counts for each person only while two or more people are in a call in the
  Space. Alone, nothing is counted.

## The meter

The Space's room (its Durable Object) is the meter. No browser reports time.

- **A minute is paid at its start.** When a call becomes a call (a second person is about to join, or proves their
  session), the room spends one minute for each person in it who has not paid for the current minute, in ONE spend.
  It then sets its alarm a minute ahead.
- **Every minute** the alarm spends one minute for each person still in the call, in one spend, and sets itself
  again. With fewer than two people left it spends nothing and stops: the room's alarm never runs for calls while
  nobody is in one.
- **Partial minutes round up.** Joining pays for a minute at once, and the room's next tick pays for the next, so a
  first minute may be short. A person is never charged twice inside one tick: leaving and coming back, a renewed
  session and a second tab inside the same minute cost nothing more.
- **A join is admitted first.** The mint route asks the room before it mints a session. A Space known to be out of
  minutes refuses. A join that would start a call pays the minute of the people already there before the session is
  minted, so a join when nothing is left is refused, never minted. The joiner's own minute is paid when their
  connection proves the session: asking for sessions without connecting spends nothing of the owner's month.
- **The last minutes are shared.** When fewer minutes are left than there are people, the room spends what is left,
  the call runs that minute, and it ends at the next tick.

### Edge cases

| Case                                         | What happens                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A person in two tabs                         | One person, one minute a minute. Alone in two tabs is not a call.                                                                                                                                                                                                                                                                                                                                                                      |
| A socket that reconnects                     | The dropped connection stops counting at once. The browser proves its session again on the new connection and counts again; inside the same minute that costs nothing.                                                                                                                                                                                                                                                                 |
| A renewed session                            | The new session replaces the old on the same connection: still one person, already paid for this minute.                                                                                                                                                                                                                                                                                                                               |
| A client that never proves its session       | It is in no call: it can hear nobody and be heard by nobody, and it is charged nothing.                                                                                                                                                                                                                                                                                                                                                |
| A client that goes silent, or says it left   | A session that said it left is closed at Cloudflare Realtime by the server at once; one whose connection dropped or that a renewal replaced, 30 seconds later, unless a connection holds it again. Media cannot outlive the count.                                                                                                                                                                                                     |
| The room hibernates                          | The meter's state is in the room's storage, and the alarm wakes the room. Who is in a call is read from the connections, which survive hibernation.                                                                                                                                                                                                                                                                                    |
| The month rolls over mid-call                | The next tick is counted in the new month by the service. The room forgets "low" and "used" when it sees a new UTC month.                                                                                                                                                                                                                                                                                                              |
| The subscription service cannot be reached   | The spend is allowed (the client's rule). Calls never drop because the service is down, and that minute is not counted.                                                                                                                                                                                                                                                                                                                |
| The subscription service refuses the room    | Its key is wrong, or the request is one the service will not take: the minutes cannot be checked. A join that needs a minute paid is refused as calls being unavailable (503 `calls_off`, `unconfigured`: Audio Unavailable, with Retry), never as minutes used. A call already running keeps going and its minute is asked for again each minute. Nothing is remembered as used, so calls start again the moment the service answers. |
| A very large call                            | A spend is at most 1,000 minutes, so the minute of more people than that is spent in parts. Everyone is paid for; with fewer minutes left than a part needs, what is left is spent and the call runs its last minute.                                                                                                                                                                                                                  |
| Several Spaces of one owner                  | Each room spends from the same count. A Space that has not spent lately learns the month is used at its next spend.                                                                                                                                                                                                                                                                                                                    |
| The Space moves to a team, or the owner pays | The next join names the owner afresh. A Space out of minutes asks for the owner's entitlement at each join (the client asks the service at most once a minute) and starts calls again when its limit is higher.                                                                                                                                                                                                                        |
| The calls kill switch                        | Unchanged, and checked first. A paused deployment counts nothing.                                                                                                                                                                                                                                                                                                                                                                      |

## When the minutes are used

- **New joins are refused**: `429 calls_minutes_used`.
- **Calls in progress end within a minute.** At the tick that cannot be paid, the room tells every connection
  (`call-minutes` with `state: 'used'`), each browser ends its call as Leave does, and the server closes every call
  session of the Space at Cloudflare Realtime.
- **Media stays off for a browser that ignores the word.** A session's token never lapses, so the server holds it
  off itself: every connection lets go of its call session (the hearing check then knows no subscriber, so nobody
  hears anybody), a `call-session` proof is not taken while the month is used, and a publish, a subscribe, a
  renegotiation and a layer switch are each refused `429 calls_minutes_used`, asking Cloudflare Realtime for
  nothing. Closing tracks is still allowed. A join admitted later (the owner's tier allows more) or a new month
  lifts it.
- **Everything else carries on**: the Space, walking, speech bubbles, the chat and what is on the walls. A local
  preview of your own camera or microphone still works.
- **Calls start again** next month, or as soon as the owner's tier allows. The room then tells every connection
  (`state: 'ok'`) and each browser in the mode joins again by itself.

## Running low

At **80 minutes left** the room tells its connections once a month (`state: 'low'`, no numbers). Only someone who may
do something about it is shown anything.

## What people see

All of it only with Pro on, and each number as the api answered it. Dates are the first day of next month (UTC), as
the reader's locale writes it.

- **Call Minutes, in Collaborators.** The Space's people dialog ends with the Space's Call Minutes, for the owner
  and the owning team's members: "Counted while two or more people are in a call: each of them, every minute. Being here alone counts nothing.", the count ("240 of 1,000
  used") on a meter, and "Resets on 1 December." For someone who may upgrade on Free it adds "Pro has 5,000." and
  **See Pro**; a team's member on Free gets **Ask an Admin**. Nobody else sees the section. livehuddle has no
  per-Space settings dialog; Collaborators is the Space's own dialog about the people in it. The limit is the subscription service's own answer
  as the page holds it (the reader's own or their team's subscription, else the owner's view), and the count the
  larger of the api's and the subscription's: an upgrade from the dialog shows "5 of 10,000" at once, not after the
  api's minute of cached entitlement.
- **In a call, running low.** Above the Call dock, once a month, only for the owner or a team admin: "80 call
  minutes left this month. Pro has 10,000." with **See Pro** and a close. An owner already on a paid tier reads "80
  call minutes left this month. They start again on 1 December." with no offer.
- **Used.** The Call dock's first button reads **Calls Paused**, and its hover card says until when. A call that was
  running when the minutes ran out opens a dialog, and a press of Calls Paused opens it again. That press also asks
  to join once more, quietly: refused while the month is used, admitted the moment it is not, which closes the
  dialog and starts the call. The dialog:
  - the owner, or a team admin: **This Month's Call Minutes Are Used**, "Calls start again on 1 December. The Space,
    its chat and everything on its walls still work.", the meter at "1,000 of 1,000", **Upgrade to Pro** (Upgrade
    Team for a team) and **Back to the Space**;
  - a team's member: the same, with "A team admin can move this team to Pro for Teams." and **Ask an Admin**;
  - everyone else, guests included: "Calls are paused in this Space until 1 December." and **Back to the Space**. No
    offer, no meter, and nothing about the owner's tier;
  - in a guest's Space, everyone: the same, ending "Sign in to keep this Space as your own." with **Sign In**
    beside Back to the Space. Nobody is offered an upgrade there.

## Share roles

Counting makes no difference between an Editor, a Participant and a Viewer: each is a person in the call. The offer
follows who may pay, not the share role: the owner or a team admin (Upgrade), a team's member (Ask an Admin),
everyone else nothing. The Call Minutes section in Collaborators follows the same rule.

## The wire

**Who is told what.** The owner's scope is their account id, and their numbers are their usage: neither goes to
someone who has no use for it.

| Caller                                    | `owner`                   | `used` and `limit` |
| ----------------------------------------- | ------------------------- | ------------------ |
| The owner, or a member of the owning team | yes                       | yes                |
| Anyone else signed in                     | yes                       | no                 |
| A guest or a link visitor                 | no                        | no                 |
| Anyone, in a guest's Space                | no, `guest: true` instead | no                 |

A signed-in caller is told the owner so their browser can ask the subscription service which action they may take
(Upgrade, Ask an Admin, or nothing). Everyone is told the state: that the Space is metered, low or paused.

- `POST /api/documents/:id/calls/session` adds `minutes: { owner?, guest?, low }` to its answer while the Space is
  metered. Refused with `429 { error: 'calls_minutes_used', owner?, guest?, used?, limit? }`.
- `POST calls/tracks`, `PUT calls/renegotiate` and `PUT calls/layer` answer `429 { error: 'calls_minutes_used' }`
  while the month is used.
- `GET /api/documents/:id/calls/minutes`: `{ metered: false }` with Pro off; otherwise `{ metered: true, owner?,
guest?, used, limit, low, paused }`. `used` and `limit` are numbers for the owner and the owning team's members
  alone, also once the limit is met; null for anyone else. `used` is what the room last heard from the service,
  null when it has spent nothing this month.
- `call-minutes`, a system op from the room alone: `{ kind: 'call-minutes', state: 'low' | 'used' | 'ok' }`. The
  state alone: it goes to every connection, so it names no owner and no number. The used-up dialog reads the
  owner's numbers from the minutes route.
- `call-session` may carry `left: true`: the session, proven by its token, has left the call. Sent only by a call
  whose session answer carried `minutes`.

## Cost

Stated in the [blueprint](blueprints/call-minutes.md#performance-and-limits).

## Out of scope

- A per-Space breakdown of the owner's minutes: Subscription in Settings shows the owner's month.
- Counting what a call uses (audio only against video): a minute is a minute.
- Asking Cloudflare Realtime who is connected every minute: the room's own connections are the count.
