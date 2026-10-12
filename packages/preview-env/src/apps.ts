// Which apps each tier deploys, in deploy order (docs/specs/016-platform/pr-previews.md "Two tiers").
// mcp is never one: a preview has no MCP of its own.
export type PreviewTier = 'preview' | 'full';

export type PreviewApp =
  'marketing' | 'live' | 'telemetry' | 'help' | 'community' | 'api' | 'router';

export const TIER_APPS: Record<PreviewTier, readonly PreviewApp[]> = {
  preview: ['marketing', 'live', 'telemetry', 'help', 'community', 'router'],
  full: ['marketing', 'live', 'telemetry', 'help', 'api', 'community', 'router'],
};

export function inTier(app: string, tier: PreviewTier): app is PreviewApp {
  return (TIER_APPS[tier] as readonly string[]).includes(app);
}

export function parseTier(value: unknown): PreviewTier {
  if (value === 'preview' || value === 'full') return value;
  throw new Error(`unknown preview tier ${String(value)}`);
}
