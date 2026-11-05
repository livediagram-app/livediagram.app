# Open decisions for the owner

Status: **settled**. Every decision below was answered and built (Work Tracker #99 to #190); only D8's last owner steps
(Work Tracker #395) are still open.

Each decision has lettered options and a recommendation. Where the card or its thread already decided, the decision is
recorded as settled rather than asked again.

## Settled by the card and its thread

- **Spec first, then fork livediagram** (thread, 2026-10-31: "write the livehuddle product spec first ... then build
  by forking livediagram"). The spec came first (Work Tracker #99), then the [Build plan](build-plan.md)'s steps.
- **livediagram keeps avatar mode, the Navigate elements and the Spaces templates** (card: "Don't remove these
  capabilities from livediagram"). livehuddle gets its own copy, and what can be shared moves to `packages/`.
- **Documents are Durable Objects, not D1** (card). One Durable Object per space, no D1
  ([Apps and storage](../003-system-architecture/apps-and-storage.md)).
- **Platform capabilities are reused** (card). No new platform service
  ([Platform registration](../016-platform/platform-registration.md)).
- **The focus is collaboration, workshops and meetings** (card) ([Purpose](../001-project-vision/purpose.md)).

## D1. How the fork is shaped

**Settled: (a)** (built; `livehuddle/.forked-from` names the commit).

- (a) In-tree fork of livediagram (`livehuddle/` beside the others, `.forked-from`), cut down to Workshop, as
  livedocuments and livedesign were made.
- (b) A new, small editor on `@liveworkspace/workbench`, taking only Avatar mode, the Navigate elements and the
  Spaces.
- (c) A mode inside livediagram on a second domain.

**Recommendation: (a).** The thread chose the fork. (b) would rebuild realtime, the room, sharing and the session
tools for a smaller product; (c) is not a product of its own and fights "livediagram keeps its features" from the other
side.

## D2. Does all of Workshop mode go to livehuddle?

**Settled: (a), then moved to (c) without Poll** (owner, 2026-11-04, Work Tracker #423). (a) was built: livehuddle
carried all of Workshop. The refocus on meeting in Spaces takes livehuddle to Avatar mode, the Navigate elements, Bring
Focus and the Spaces, plus the Session strip's Timer and Vote; Poll and every other Collaborate element leave
([Not in livehuddle](../002-project-scope/not-in-livehuddle.md)). The Vote left later (owner, 2026-11-05,
[Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-vote)).

- (a) All of Workshop: the Session strip, every Collaborate element, facilitation, the session templates.
- (b) Only Avatar mode, the Navigate elements, Bring Focus and the Spaces.
- (c) (b) plus the Session strip (Timer, Vote, Poll), without the rest of the Collaborate elements.

**Recommendation: (a).** The card names workshops and meetings, the All-Hands Hall needs Bring Focus, a stand-up
wants a timer, and a retrospective needs the whole kit. livediagram keeps its copy too, which is why the drift rules
in the [Build plan](build-plan.md#keeping-the-two-products-from-drifting) matter.

## D3. Which apps does v1 ship?

**Settled: (b)** (owner, 2026-11-02; Work Tracker #184). livehuddle keeps every platform-wide feature (Offline Mode,
Google Drive, the Community, the MCP server and the CLI) and cuts only what is livediagram's own (Event Storming,
repositories).

- (a) editor, api, router, marketing, help; MCP and CLI in v1.1; Community later.
- (b) Everything livediagram has: editor, api, router, marketing, help, MCP, CLI, Community.
- (c) editor, api and router only; marketing and help after launch.

(b) needs no change to the status service: livehuddle ships an MCP server, so its status group checks it as every
other app's does ([Platform registration](../016-platform/platform-registration.md)).

## D4. Audio, video and screen sharing

**Settled: calls are in, audio first** (owner, 2026-11-03; Work Tracker #315). v1 shipped without them; proximity
audio is built ([Proximity audio](../012-collaboration/proximity-audio.md)), under the calls kill switch (Work Tracker
#316), and runs in production once its secrets are set (owner, 2026-11-05); video and screen sharing stay
[Future work](future-work.md).

- (a) Out of v1. Specify them next, after v1 ships, with TURN and Cloudflare Realtime's SFU, once the owner has set a
  spend limit.
- (b) Audio only in v1 (proximity voice), video and screen sharing next.
- (c) All three in v1.

**Recommendation: (a).** They need media infrastructure the stack does not have, secrets only the owner can create,
and usage billing; v1 is built to leave room for them ([Future work](future-work.md)).

## D5. Domain and branding

**Settled: (a), (a) and (a)** (built as recommended; Work Tracker #187). The editor, the marketing site, the help centre,
the Community and the emails wear emerald through `@livehuddle/tailwind-config` and `@liveworkspace/brand`
([Theme](../004-interface-design/color-scheme.md), [Brand mark](../004-interface-design/brand-mark.md)), and the
landing page says "Meet and run workshops together" ([Marketing site](../019-marketing/marketing-site.md)). The domain
waits on the owner (D8).

- **Domain:** (a) `livehuddle.app`, canonical on `www.livehuddle.app`, as every product; (b) another name.
  **Recommendation: (a)**, the name the card uses. Registering it and adding the zone to the liveworkspace Cloudflare
  account is the owner's (D8).
- **Colour:** each product owns a hue (livediagram sky, liveplanner violet, livedocuments amber, livedesign rose, the
  platform slate). (a) **emerald** (accent `#10b981`, deep `#047857`, light `#34d399`); (b) teal; (c) another.
  **Recommendation: (a)**, the clearest gap on the wheel and a calm, "go ahead and talk" colour.
- **Pitch** (the site switcher's line): (a) "Meet and run workshops together"; (b) "Huddle up together".
  **Recommendation: (a)**, in the shape of the others' ("Diagram and draw together", "Plan the work together").

## D6. What a person calls the thing they make

**Settled: (a)** (built as recommended; Work Tracker #186). People read **Space** everywhere
([Domain language](../003-system-architecture/domain-language.md#space)); code, routes, the API and storage keep
`document`.

- (a) **Space** ("New Space", "Open Space", "Untitled Space"), with the API keeping `document`.
- (b) **Huddle**.
- (c) **Document**, as livediagram says.

**Recommendation: (a).** It is the word a team already uses for where it meets, it matches the Spaces templates that
make one, and keeping `document` underneath needs no change to the platform's `apiNoun` type.

## D7. Avatar mode first-class

**Settled: (a)** (built as recommended; Work Tracker #186). The picker lists Avatar beside Select and Hand, a space
whose tab offers the walk opens walking, and the Selection Mode button keeps working
([Avatar mode](../008-canvas/avatar-mode.md#where-it-lives)).

- (a) The Selection Mode picker offers Avatar, and a board made from a Spaces template opens walking; the Selection
  Mode button keeps working.
- (b) As in livediagram: Avatar only through a Selection Mode button on the board.

**Recommendation: (a).** In a diagram tool a character in the way is a cost; in a meeting app walking is the point.
livediagram keeps (b).

## D8. Things only the owner can do

These are not choices so much as actions, listed so they can run while steps 1 to 7 of the
[Build plan](build-plan.md) are built. Done as of 2026-11-03: the domain and zone, the accounts client (staging and
production, with `ACCOUNTS_CLIENT_ID` and `ACCOUNTS_CLIENT_SECRET` on the api), the platform keys
(`INDEX`, `MEDIA`, `TELEMETRY`, `DRIVE` and `COMMUNITY_KEY_LIVEHUDDLE` and their twins on livehuddle's Workers),
Turnstile and Google sign-in, and the MCP KV namespaces. Left (Work Tracker #395): the Drive UI MIME type
(`application/vnd.livehuddle+json`) in Google Cloud, and accepting the Durable Object usage.

1. **Domain and DNS:** register `livehuddle.app` (if not already held) and add the zone to the liveworkspace
   Cloudflare account, so the router's custom domains can attach.
2. **Accounts client:** run `register-client.ts` for staging and production, and set the client secret on
   livehuddle's api Worker.
3. **Telemetry key:** create `TELEMETRY_KEY_LIVEHUDDLE` and set it on the telemetry Worker and livehuddle's.
4. **Third-party origins:** add the new domain wherever the fork's sign-in or bot checks need it (Turnstile, Google
   sign-in), as was done for www.
5. **Billing:** accept a fifth product's Durable Object usage on the account's Workers plan; later, decide TURN and SFU
   spend (D4).
6. **Approve this spec.** Done: the owner approved it on Work Tracker #99 and the build followed.
