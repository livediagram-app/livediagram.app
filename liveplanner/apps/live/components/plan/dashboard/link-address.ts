// What a Links card's address field means (docs/specs/026-plan/plan-tabs.md "Cards", Links): a tab of this document
// (picked from its list, or its name typed in full), else a web or mail address (safeLinkUrl), else a problem to show.
// Pure, so the form (AddLinkForm) only draws.
import { safeLinkUrl, type DashboardLink } from '@liveplanner/document';

export const LINK_ADDRESS_PROBLEM = 'Enter a web address, an email (mailto:) or a tab’s name';

type TabLike = { id: string; name: string };

export type LinkTarget = { tabId: string } | { url: string } | { problem: string };

// The link `address` names: the tab picked from the list (`pickedTabId`, while the field still shows its name), a tab
// whose name it is (any case), else the site.
export function resolveLinkAddress(
  address: string,
  pickedTabId: string | null,
  tabs: readonly TabLike[],
): LinkTarget {
  const typed = address.trim();
  const picked = pickedTabId ? tabs.find((t) => t.id === pickedTabId) : undefined;
  if (picked && picked.name.trim() === typed) return { tabId: picked.id };
  const named = tabs.find((t) => t.name.trim().toLowerCase() === typed.toLowerCase());
  if (typed && named) return { tabId: named.id };
  const url = safeLinkUrl(typed);
  return url ? { url } : { problem: LINK_ADDRESS_PROBLEM };
}

// The tabs the address field lists for what is typed: every tab while it is empty (or shows a picked tab's name),
// else those whose name holds the text, those starting with it first; tab-bar order otherwise.
export function matchingTabs<T extends TabLike>(tabs: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...tabs];
  const hits = tabs.filter((t) => t.name.toLowerCase().includes(q));
  return [
    ...hits.filter((t) => t.name.toLowerCase().startsWith(q)),
    ...hits.filter((t) => !t.name.toLowerCase().startsWith(q)),
  ];
}

// The muted line under a link's label: a site's host (an email's address), or where a tab link goes.
export function linkDetail(link: DashboardLink): string {
  if (link.tabId) return 'Tab in this document';
  const url = link.url ?? '';
  // An email: its address, unless that is already the label (an unlabelled one shows it), then just "Email".
  if (url.startsWith('mailto:')) return link.label ? url.slice(7) : 'Email';
  try {
    const u = new URL(url);
    return u.host + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return url;
  }
}
