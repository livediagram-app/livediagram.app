# Vote integrity

A REST upvote counts one person once (a dot on a Plan card is a session vote's dot, keyed and budgeted as any dot
is: [Session tools](session-tools.md) "Voting on Plan cards"). This spec says who "one person" is, and what stops one
browser from posing as many people or changing somebody else's vote.

## What it protects against

- **Stuffing:** one person casting many votes by presenting a new identity for each one.
- **Overwriting:** one person changing a vote somebody else cast.

Overwriting is closed outright. Stuffing is bounded rather than impossible: a guest is a browser, and many real
browsers are many votes. The bound makes a scripted flood from one network buy nothing.

## Who a voter is

The server uses the strongest identity it holds for the caller, in this order:

1. **A verified account** (a Clerk session or an API token over REST). One account is one voter, whatever browser or device it votes from.
2. **A guest.** A guest id costs nothing to make (`POST /api/guest-id`), so it is never trusted to be one person.
   Guests are counted against their **network**: the caller's IPv4 address, or IPv6 /64 (`clientRateKey`). At most
   `GUEST_VOTERS_PER_NETWORK` (100) distinct guest voters per network take part in one target (below). The 101st is
   refused; one who has already taken part can always change or withdraw their vote.

The network is never stored raw. It is a SHA-256 of the target's scope and the network key (`networkTagFor`), so it
cannot be read back or matched across documents.

100 is far above a household or office on one address and well below what a flood needs. A large room behind one
address (a conference on venue wi-fi) can exceed it; past that, the extra guests cannot vote until they sign in.

## Upvotes over REST

The voter is the authenticated caller (a Plan card's `+1`). A verified account
votes freely. A guest's vote that **adds** a vote is admitted
only if the guest has already voted in this document from this network, or the network has fewer than
`GUEST_VOTERS_PER_NETWORK` guest voters in it. Withdrawing is never refused.

The ledger is `guest_voters (document_id, network_tag, person_tag)`, migration 0076, one row per guest voter per
network per document, removed with the document. `person_tag` is `personTagFor(documentId, ownerId)`; no owner id is
stored. Admission is one D1 batch: a conditional insert, then a read of the caller's row.

A refused vote answers `429 { error: 'vote_limit' }` and logs `[vote-integrity] guest voter refused`.

## Not covered

- **Dot votes, estimates, done checks and temperature checks** are document state written by editors
  ([Per-participant responses](participant-responses.md), [Session tools](session-tools.md)). An editor can already
  rewrite the whole document, so these stay keyed on the claimed collab key.
- **Many real browsers on many networks** are many voters. Only signing in, or a facilitator who knows the room, can
  tell them apart.
- **A Plan card's per-person count** is bounded by the board's vote budget in the editor, not by the server: one
  person's dots on one card are a facilitation rule, not an identity question.
