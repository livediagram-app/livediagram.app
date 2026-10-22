// The tabs a Dashboard can show (docs/specs/026-plan/plan-agents.md "Making a dashboard"): what a tab holds, and every
// tab of a project read for add_tab, up to PLAN_PREVIEW_TABS_MAX.
import type { ProjectResponse, TabResponse } from '@liveplanner/api-schema';
import {
  readPlanState,
  resolveDashboardInput,
  type DashboardInput,
  type DashboardTabRef,
} from '@liveplanner/agent-verbs';
import { ITEM_TYPES } from '@liveplanner/items';
import { tabKindOf, type Tab } from '@liveplanner/project';
import { apiJson, clientFor } from './api';
import type { Env } from './env';
import { PLAN_PREVIEW_TABS_MAX } from './plan-preview';

// A Board tab shows its board, a Sheet tab its Sheet. A tab of another kind holding a board or a Sheet (a Blank Plan
// tab given a board by add_board) shows too, drawn as its canvas is; any other tab nothing.
export function dashboardTabKind(
  tab: Pick<Tab, 'kind'> & { elements?: Tab['elements'] },
): 'board' | 'sheet' | null {
  const kind = tabKindOf(tab);
  if (kind === 'board' || kind === 'sheet') return kind;
  const holds = (shape: string) =>
    (tab.elements ?? []).some((el) => el.type === 'shape' && el.shape === shape);
  return holds('plan-board') ? 'board' : holds('plan-sheet') ? 'sheet' : null;
}

async function projectTabRefs(
  env: Env,
  token: string,
  projectId: string,
): Promise<DashboardTabRef[]> {
  const path = `/projects/${encodeURIComponent(projectId)}`;
  const { project } = await apiJson<ProjectResponse>(env, token, path);
  const listed = [...project.tabs]
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

// A dashboard named as an agent names it, resolved against the project's tabs and card types.
export async function projectDashboard(
  env: Env,
  token: string,
  projectId: string,
  input: DashboardInput,
): Promise<ReturnType<typeof resolveDashboardInput>> {
  const [refs, types] = await Promise.all([
    projectTabRefs(env, token, projectId),
    readPlanState(clientFor(env, token), projectId)
      .then((s) => s.plan.types)
      .catch(() => ITEM_TYPES),
  ]);
  return resolveDashboardInput(input, refs, types);
}
