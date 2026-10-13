// The tabs a Dashboard can show (docs/specs/026-plan/plan-agents.md "Making a dashboard"): what a tab holds, and every
// tab of a document read for add_tab, up to PLAN_PREVIEW_TABS_MAX.
import type { DocumentResponse, TabResponse } from '@livediagram/api-schema';
import type { DashboardTabRef } from '@livediagram/agent-verbs';
import { tabKindOf, type Tab } from '@livediagram/document';
import { apiJson } from './api';
import type { Env } from './env';
import { PLAN_PREVIEW_TABS_MAX } from './plan-preview';

// A Board tab shows its board, a Sheet tab its Sheet; any other tab nothing.
export function dashboardTabKind(tab: Pick<Tab, 'kind'>): 'board' | 'sheet' | null {
  const kind = tabKindOf(tab);
  return kind === 'board' || kind === 'sheet' ? kind : null;
}

export async function documentTabRefs(
  env: Env,
  token: string,
  documentId: string,
): Promise<DashboardTabRef[]> {
  const path = `/documents/${encodeURIComponent(documentId)}`;
  const { document } = await apiJson<DocumentResponse>(env, token, path);
  const listed = [...document.tabs]
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .slice(0, PLAN_PREVIEW_TABS_MAX);
  return Promise.all(
    listed.map(async (t) => {
      const body = await apiJson<TabResponse>(
        env,
        token,
        `${path}/tabs/${encodeURIComponent(t.id)}`,
      )
        .then((r) => r.tab as unknown as Tab)
        .catch(() => null);
      return { id: t.id, name: t.name, of: body ? dashboardTabKind(body) : null };
    }),
  );
}
