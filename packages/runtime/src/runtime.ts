import type { Db } from './db';
import type { Limiters } from './limiters';
import type { ObjectStore } from './objects';
import type { Scheduler } from './scheduler';

/**
 * The per-document realtime room, reached over HTTP exactly as the api worker
 * reaches a Durable Object today
 * (apps/api/src/room-client.ts: `env.DOCUMENT_ROOM.get(idFromName(id)).fetch(...)`).
 * Keeping that shape is what lets the Node runtime host rooms in-process
 * without touching the call sites.
 */
export type RoomHandle = {
  // Like the global fetch, because that is how the call sites already use a
  // Durable Object stub: `stub.fetch('https://room/broadcast', init)`.
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export type RoomHost = {
  for(documentId: string): RoomHandle;
};

/**
 * The one platform-specific hole the seam does not try to close: link unfurling
 * parses HTML with `HTMLRewriter` (apps/api/src/routes/unfurl.ts). The shape
 * below is the subset of that API the route uses, so the Cloudflare runtime
 * hands back `HTMLRewriter` itself and the Node runtime substitutes a parser.
 */
export type HtmlHandlers = {
  element?(element: {
    getAttribute(name: string): string | null;
    setAttribute(name: string, value: string): void;
    remove(): void;
    text(): string;
  }): void;
  text?(chunk: { text: string; remove(): void }): void;
  comments?(comment: { text: string; remove(): void }): void;
};

export type HtmlTransformer = {
  on(selector: string, handlers: HtmlHandlers): HtmlTransformer;
  transform(response: Response): Response;
};

/**
 * A factory, not an instance: `HTMLRewriter` is a class, and a runtime that
 * supplies a parser supplies something to call per response.
 */
export type HtmlTransformerFactory = () => HtmlTransformer;

/**
 * How the deployment verifies a caller's JWT. Clerk on the hosted deployment,
 * Better Auth on a self-hosted one — the application only depends on the shape
 * (apps/api/src/auth/clerk.ts).
 */
export type IdentityConfig = {
  jwksUrl?: string;
  issuer?: string;
  audience?: string;
  /** Claim names, so a provider that spells them differently needs no code. */
  subjectClaim?: string;
  emailClaim?: string;
};

export type Runtime = {
  db: Db;
  /** Absent means "no uploads": the image endpoints answer 503, as today. */
  objects?: ObjectStore;
  rooms: RoomHost;
  limiters: Limiters;
  scheduler: Scheduler;
  html: HtmlTransformerFactory;
  identity: IdentityConfig;
  /** The deploy's commit, for the stale-build signal (docs/specs/016-platform/stale-builds.md). */
  buildId?: string;
};
