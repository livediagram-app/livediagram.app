// A world for the public roadmap's tests (docs/specs/026-plan/public-roadmap.md): the automation world's real worker
// and room with a kanban board on tab t1, the default card types, a suggestion form on tab t2 with a live link, and
// helpers to publish, read and vote through the real doors. Not a `.test.ts` file, so vitest does not collect it.
import type { RoadmapResponse, RoadmapSettings } from '@liveplanner/api-schema';
import type { FormDefinition } from '@liveplanner/forms';
import { defaultCatalogue } from '@liveplanner/items';
import { createFormLink } from '../db';
import {
  automationWorld,
  type AutomationWorld,
} from '../plan-room/automations/test-automation-world';
import { setPlanItemTypes } from '../plan-room/plan-content';
import type { PlanEnv } from '../types';

export const suggestionForm = (status = 'backlog'): FormDefinition => ({
  v: 1,
  heading: 'Suggest an idea',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [
        {
          id: 'q-sum',
          type: 'short',
          prompt: 'Your idea',
          required: true,
          goesTo: { to: 'title' },
        },
      ],
    },
  ],
  destination: { tabId: 't1', typeId: 'task', status },
});

export type RoadmapWorld = AutomationWorld & {
  planEnv: () => PlanEnv;
  formCode: string;
  // Writes the suggestion form again (another destination column).
  setForm: (f: FormDefinition) => Promise<void>;
  publish: (s?: Partial<RoadmapSettings>) => Promise<RoadmapResponse['roadmap']>;
  read: (code: string, query?: string) => Promise<Response>;
  vote: (code: string, body: Record<string, unknown>) => Promise<Response>;
};

export const settingsOf = (s: Partial<RoadmapSettings> = {}): RoadmapSettings => ({
  title: 'Acme Roadmap',
  columns: ['todo', 'doing', 'done'],
  types: ['task'],
  fields: ['description'],
  voting: true,
  formCode: null,
  ...s,
});

// `opts.pro`: Pro on against a stand-in subscription service (plan-room/tier/test-tier.ts).
export async function roadmapWorld(
  opts: Parameters<typeof automationWorld>[1] = {},
): Promise<RoadmapWorld> {
  const w = await automationWorld('A', opts);
  const planEnv = () => w.plans.get('A')!.room.requireEnv();
  await setPlanItemTypes(planEnv(), 'A', defaultCatalogue());
  const setForm = async (form: FormDefinition) => {
    const put = await w.send('PUT', '/api/projects/A/tabs/t2', {
      id: 't2',
      name: 'Ideas',
      kind: 'form',
      elements: [],
      form,
    });
    if (put.status >= 300) throw new Error(`form tab put answered ${put.status}`);
  };
  await setForm(suggestionForm());
  const link = await createFormLink(planEnv(), 'A', 't2', Date.now());
  const publish = async (s: Partial<RoadmapSettings> = {}) => {
    const res = await w.as('owner', 'PUT', '/roadmaps/b1', settingsOf(s));
    if (res.status >= 300) throw new Error(`publish answered ${res.status}: ${await res.text()}`);
    return (await res.json<RoadmapResponse>()).roadmap;
  };
  const read = (code: string, query = '') =>
    w.raw(new Request(`https://api.test/api/roadmaps/A/${code}${query}`));
  const vote = (code: string, body: Record<string, unknown>) =>
    w.raw(
      new Request(`https://api.test/api/roadmaps/A/${code}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  return { ...w, planEnv, formCode: link!.code, setForm, publish, read, vote };
}
