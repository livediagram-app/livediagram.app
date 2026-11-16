// A public roadmap's address, /roadmap/<plan id>/<code> (docs/specs/026-plan/public-roadmap.md "Domain language"). One
// static page backs every roadmap: the editor worker rewrites /roadmap/<anything> onto /roadmap/placeholder, and the
// page reads the plan and the code from the address.
import { ROADMAP_CODE_PATTERN } from '@liveplanner/api-schema';

export const ROADMAP_PLACEHOLDER_PATH = '/roadmap/placeholder';

const PLAN_ID = /^[A-Za-z0-9_-]{1,200}$/;

export function isRoadmapPath(pathname: string): boolean {
  return pathname === '/roadmap' || pathname.startsWith('/roadmap/');
}

/** The plan and code in the address, or null when there are none that could be one. */
export function roadmapFromPath(pathname: string): { planId: string; code: string } | null {
  const match = /^\/roadmap\/([^/?#]+)\/([^/?#]+)\/?$/.exec(pathname);
  const planId = match?.[1];
  const code = match?.[2];
  if (!planId || !code || !PLAN_ID.test(planId) || !ROADMAP_CODE_PATTERN.test(code)) return null;
  return { planId, code };
}
