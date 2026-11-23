// Publish to the Web on the wire (docs/specs/030-knowledgebase/publishing.md, blueprint "Interfaces and contracts"):
// what an Editor reads and sends at /api/documents/<id>/publishing.
import type { KnowledgeTierOwner, KnowledgeTierRefusal } from './knowledge-tier';

/** Why a page in scope stays private. */
export type PublishingLeftOutReason = 'pending' | 'rejected' | 'empty';

/** What a publish of `root` would put on the web, and what it would leave out. */
export type PublishingPreview = {
  /** The section's first page, or null for the whole knowledgebase. */
  root: string | null;
  pages: { id: string; title: string }[];
  leftOut: { id: string; title: string; reason: PublishingLeftOutReason }[];
};

/** The site as it is published. */
export type PublishedSiteWire = {
  address: string;
  /** The site's front page, `https://<host>/kb/<address>`. */
  url: string;
  root: string | null;
  noindex: boolean;
  showWriters: boolean;
  publishedAt: number;
};

/** With Pro on (publishing.md "Tiers"): the knowledgebases the owner has published, over all of theirs, against
 *  their tier's Public Knowledgebases (`used` only when the api has just counted, `limit` null for unlimited), and
 *  that owner. A guest's knowledgebase names no owner and says `guest`: Free's 1, counted in it alone. All absent with
 *  Pro off. */
export type PublishingTierSaid = {
  usage?: { used?: number; limit: number | null };
  owner?: KnowledgeTierOwner;
  guest?: true;
};

/** GET, PUT and DELETE /api/documents/<id>/publishing. */
export type PublishingState = PublishingTierSaid & {
  /** Whether this knowledgebase may be published at all (the capability check). */
  offered: boolean;
  published: boolean;
  site: PublishedSiteWire | null;
  /** The address a first publish is offered. */
  defaultAddress: string;
  preview: PublishingPreview;
};

/** PUT /api/documents/<id>/publishing: every field required. */
export type PublishingRequest = {
  address: string;
  root: string | null;
  noindex: boolean;
  showWriters: boolean;
};

/** A publish refused at the owner's tier's Public Knowledgebases (Pro on only): 409, with the limit's numbers. */
export const PUBLISH_LIMIT_REACHED = 'publish_limit_reached';

/** That refusal's body. */
export type PublishLimitBody = {
  error: typeof PUBLISH_LIMIT_REACHED;
  message: string;
} & KnowledgeTierRefusal;
