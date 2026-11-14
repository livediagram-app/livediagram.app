import { defineProject } from '@liveworkspace/vitest-config';

// The image reference index's extractor and its SQL are held at 100%, as each product's api holds its own image-refs code: a gap
// here deletes a picture someone placed (each product's docs/specs/009-elements/images.md "Reference index"). The D1
// compound helpers are held there too: every service's test database leans on the guard to stand in for production.
// So is the write body's byte cap: a gap lets a chunked body of any size reach a route. So is the request-failure guard: every Worker that owns storage answers its throws through it. And the room's element
// gate: every product's room judges an Editor's element ops through it before relaying them. And the presence
// roster: a gap sends a guest someone's picture, or a socket its own entry. And sealing: a gap there
// leaks a refresh token or a webhook's URL. And typed text: a gap lets a name turn the words around it backwards. And CSV: a gap
// runs a typed name as a formula in an admin's spreadsheet. And the tab swap: a gap there loses a Participant's write or answers it wrongly.
// And the image embedder: a gap draws a picture past the preview's budget or out of document order.
// And the reader redactions: a gap hands a stranger the owner's id or an edit link.
// And the preferences route: a gap there stores a patch past the cap or loses a refusal.
// And the ledger store: a gap there cuts an entry a save still needs, or hands a save less than it merges.
// And the tab order: a gap there lands a new tab on a place another holds.
// And the delta door: a gap there stores a rebuilt tab no digest proved.
// And the public fetch and its address checks: a gap there lets a typed URL reach a private network.
// And the room client: a gap there drops a relay, or fails a save the room could not answer. And the access
// closer: a gap there leaves an ended pairing's sockets open.
export default defineProject({
  test: {
    coverage: {
      thresholds: {
        'src/agent-presence-stamps.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'src/csv.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/embed-images.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/image-refs.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/image-ref-index.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/d1-compound.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/d1-compound-guard.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/request-body.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/preferences-route.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/public-address.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/public-fetch.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/redact-item.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/request-failure.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/room-access-client.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/room-client.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/room-element-ops.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/tab-delta-door.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/tab-order.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/tab-swap.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/room-presence-relay.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'src/room-ledger-store.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/room-roster.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/sealed.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/typed-text.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
