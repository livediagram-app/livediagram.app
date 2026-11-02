# Open decisions for the owner

Status: **open**, for the owner's answer on this PR (Work Tracker #99).

Each decision has lettered options and a recommendation. Where the card or its thread already decided, the decision is
recorded as settled rather than asked again.

## Settled by the card and its thread

- **Spec first, then fork livediagram** (thread, 2026-10-31: "write the livehuddle product spec first ... then build
  by forking livediagram"). This PR is the spec.
- **livediagram keeps avatar mode, the Navigate elements and the Spaces templates** (card: "Don't remove these
  capabilities from livediagram"). livehuddle gets its own copy, and what can be shared moves to `packages/`.
- **Documents are Durable Objects, not D1** (card). One Durable Object per space, no D1
  ([Apps and storage](../003-system-architecture/apps-and-storage.md)).
- **Platform capabilities are reused** (card). No new platform service
  ([Platform registration](../016-platform/platform-registration.md)).
- **The focus is collaboration, workshops and meetings** (card) ([Purpose](../001-project-vision/purpose.md)).

## D1. How the fork is shaped

- (a) In-tree fork of livediagram (`livehuddle/` beside the others, `.forked-from`), cut down to Workshop, as
  livedocuments and livedesign were made.
- (b) A new, small editor on `@liveworkspace/workbench`, taking only Avatar mode, the Navigate elements and the
  Spaces.
- (c) A mode inside livediagram on a second domain.

**Recommendation: (a).** The thread chose the fork. (b) would rebuild realtime, the room, sharing and the session
tools for a smaller product; (c) is not a product of its own and fights "livediagram keeps its features" from the other
side.

## D2. Does all of Workshop mode go to livehuddle?

- (a) All of Workshop: the Session strip, every Collaborate element, facilitation, the session templates.
- (b) Only Avatar mode, the Navigate elements, Bring Focus and the Spaces.
- (c) (b) plus the Session strip (Timer, Vote, Poll), without the rest of the Collaborate elements.

**Recommendation: (a).** The card names workshops and meetings, the All-Hands Hall needs Bring Focus, a stand-up
wants a timer, and a retrospective needs the whole kit. livediagram keeps its copy too, which is why the drift rules
in the [Build plan](build-plan.md#keeping-the-two-products-from-drifting) matter.

## D3. Which apps does v1 ship?

- (a) editor, api, router, marketing, help; MCP and CLI in v1.1; Community later.
- (b) Everything livediagram has: editor, api, router, marketing, help, MCP, CLI, Community.
- (c) editor, api and router only; marketing and help after launch.

**Recommendation: (a).** A meeting is people in a room, which is the part to get right first; the MCP and CLI are
cheap to keep later because they fork with the rest. (a) needs the status service's MCP check made optional per app
(a platform spec change, [Platform registration](../016-platform/platform-registration.md#the-platform-specs-that-change));
if that is unwelcome, (b) without the Community is the alternative.

## D4. Audio, video and screen sharing

- (a) Out of v1. Specify them next, after v1 ships, with TURN and Cloudflare Realtime's SFU, once the owner has set a
  spend limit.
- (b) Audio only in v1 (proximity voice), video and screen sharing next.
- (c) All three in v1.

**Recommendation: (a).** They need media infrastructure the stack does not have, secrets only the owner can create,
and usage billing; v1 is built to leave room for them ([Future work](future-work.md)).

## D5. Domain and branding

- **Domain:** (a) `livehuddle.app`, canonical on `www.livehuddle.app`, as every product; (b) another name.
  **Recommendation: (a)**, the name the card uses. Registering it and adding the zone to the liveworkspace Cloudflare
  account is the owner's (D8).
- **Colour:** each product owns a hue (livediagram sky, liveplanner violet, livedocuments amber, livedesign rose, the
  platform slate). (a) **emerald** (accent `#10b981`, deep `#047857`, light `#34d399`); (b) teal; (c) another.
  **Recommendation: (a)**, the clearest gap on the wheel and a calm, "go ahead and talk" colour.
- **Pitch** (the site switcher's line): (a) "Meet and run workshops together"; (b) "Huddle up together".
  **Recommendation: (a)**, in the shape of the others' ("Diagram and draw together", "Plan the work together").

## D6. What a person calls the thing they make

- (a) **Space** ("New Space", "Open Space", "Untitled Space"), with the API keeping `document`.
- (b) **Huddle**.
- (c) **Document**, as livediagram says.

**Recommendation: (a).** It is the word a team already uses for where it meets, it matches the Spaces templates that
make one, and keeping `document` underneath needs no change to the platform's `apiNoun` type.

## D7. Avatar mode first-class

- (a) The Selection Mode picker offers Avatar, and a board made from a Spaces template opens walking; the Selection
  Mode button keeps working.
- (b) As in livediagram: Avatar only through a Selection Mode button on the board.

**Recommendation: (a).** In a diagram tool a character in the way is a cost; in a meeting app walking is the point.
livediagram keeps (b).

## D8. Things only the owner can do

These are not choices so much as actions, listed so they can run while steps 1 to 7 of the
[Build plan](build-plan.md) are built.

1. **Domain and DNS:** register `livehuddle.app` (if not already held) and add the zone to the liveworkspace
   Cloudflare account, so the router's custom domains can attach.
2. **Accounts client:** run `register-client.ts` for staging and production, and set the client secret on
   livehuddle's api Worker.
3. **Telemetry key:** create `TELEMETRY_KEY_LIVEHUDDLE` and set it on the telemetry Worker and livehuddle's.
4. **Third-party origins:** add the new domain wherever the fork's sign-in or bot checks need it (Turnstile, Google
   sign-in), as was done for www.
5. **Billing:** accept a fifth product's Durable Object usage on the account's Workers plan; later, decide TURN and SFU
   spend (D4).
6. **Approve this spec.** Building starts only after.
