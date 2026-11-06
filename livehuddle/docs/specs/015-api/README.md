# API

Follow the references below only as needed; never upfront.

- ./api.md - when working on API app: REST + WebSocket API: Durable Object storage and realtime room, liveworkspace's index for where documents are and who may open them
- ./api-documentation.md - when working on API documentation (OpenAPI): Generated OpenAPI 3.1 doc served at `/api/openapi.json`, drift-tested against the schema package
- ./public-api-and-tokens.md - when working on Public API and API tokens: Shipped: signed-in-only API tokens (gated like teams) for external callers, the verified guest token that closed an owner-impersonation escalation (history in §2), and input hardening
- ./blueprints/README.md - when implementing an API spec from its blueprint (the room's element ops)
