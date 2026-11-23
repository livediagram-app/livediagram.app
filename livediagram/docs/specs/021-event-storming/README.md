# Event storming

Follow the references below only as needed; never upfront.

- ./event-storming.md - when working on Event storming: the workshop tab kind, its note notation, stationery, Alt insertion, timeline lanes (every workshop note always on a lane), next-note buttons and the photo import (sticky-vision detector, sticky-model boundary model, handwriting readers)
- ./note-reader.md - when working on the photo import's server reader: `POST /api/ai/read-notes`, the model keys and provider, the admission gate (origin allow-list, sign-in-only, rate limiter), `GET /api/capabilities` `aiEnabled`, its env vars and telemetry; with Pro on, what a read costs in AI credits (one for every 24 notes), who pays, the choice before the read and what the review shows ("AI credits (Pro)")
- ./blueprints/README.md - when implementing an event-storming spec that has a blueprint (always on a lane)
