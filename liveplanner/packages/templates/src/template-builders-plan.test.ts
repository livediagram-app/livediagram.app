import {
  READY_MADE_CARD_TYPES,
  TEMPLATE_CARD_TYPES,
  catalogueWithBoardTypes,
  PLAN_BOARD_PRESET_IDS,
  isPlanViewId,
  doneColumnsOf,
  normaliseBoardSetup,
  presetSetup,
} from '@liveplanner/items';
import { isValidElement, type Element } from '@liveplanner/project';
import { describe, expect, it } from 'vitest';
import {
  PLAN_TEMPLATE_KINDS,
  PLAN_TEMPLATE_TABS,
  boardSetup,
  buildPlanTemplate,
  isPlanTemplateKind,
  planTemplateTabs,
} from './template-builders-plan';
import { templateTabs } from './build-template';
import { buildTemplateTabs } from './template-tab';
import { planTemplateTabCount } from './plan-template-catalogue';

// The Plan templates (docs/specs/026-plan/plan-templates.md): ways of working across tabs, no cards.

// apps/editor PlanBoardView: PLAN_COLUMN_MIN_PX, the grid's gap-3 and the body's px-3.
const COLUMN_MIN_PX = 220;
const GAP_PX = 12;
const SIDE_PADDING_PX = 12;

// Every tab with something on it: Blank Plan's one tab is empty by design (its own test below).
const everyTab = () =>
  PLAN_TEMPLATE_KINDS.filter((kind) => kind !== 'blank-plan').flatMap((kind) =>
    PLAN_TEMPLATE_TABS[kind].map((spec) => ({ kind, spec, label: `${kind} › ${spec.name}` })),
  );

const boardsOf = (els: Element[]) =>
  els.flatMap((el) =>
    el.type === 'shape' && el.shape === 'plan-board' && el.planBoard ? [el.planBoard] : [],
  );

// A template's Dashboard elements: its plan views.
const viewsOf = (kind: (typeof PLAN_TEMPLATE_KINDS)[number]) =>
  planTemplateTabs(kind).flatMap((d) => d.build(0, 0));

describe('plan templates', () => {
  it('pins each template’s tabs, in order', () => {
    const names = Object.fromEntries(
      PLAN_TEMPLATE_KINDS.map((k) => [k, PLAN_TEMPLATE_TABS[k].map((t) => t.name)]),
    );
    expect(names).toEqual({
      'blank-plan': ['Board'],
      'blank-spreadsheet': ['Sheet'],
      'project-planner': ['Roadmap', 'Backlog', 'Sprint', 'Daily Standup'],
      kanban: ['Board', 'Requests', 'Request Form', 'Flow'],
      'bug-triage': ['Triage', 'Bug Report', 'Fixing', 'Health'],
      'team-retro': ['Retro', 'Actions', 'Archive'],
      'weekly-planner': ['This Week', 'Inbox', 'Calendar'],
      'content-calendar': ['Ideas', 'Production', 'Calendar'],
      'hiring-pipeline': ['Roles', 'Pipeline', 'Application', 'Onboarding'],
      okrs: ['Objectives', 'Key Results'],
      'product-launch': ['Timeline', 'Checklist', 'Launch Day'],
      'feedback-board': ['Feedback', 'Request Form', 'Delivery'],
      'budget-planner': ['Budget'],
      timesheet: ['Timesheet'],
      'contact-list': ['Contacts'],
      'task-tracker': ['Tracker'],
      invoice: ['Invoice'],
      'expense-report': ['Expense Report'],
      'loan-calculator': ['Loan Calculator'],
      'sales-pipeline': ['Sales Pipeline'],
      inventory: ['Inventory'],
      'guest-list': ['Guest List'],
      'grade-book': ['Grade Book'],
      'habit-tracker': ['Habit Tracker'],
      'event-planner': ['Timeline', 'Tasks', 'Guest List', 'RSVP', 'RSVP Responses'],
      'sales-crm': ['Deals', 'Contacts'],
      'help-desk': ['Tickets', 'Contact Form', 'Knowledge Base'],
      'meeting-agenda': ['Agenda', 'Actions', 'Archive'],
      'personal-goals': ['Goals', 'Milestones', 'Habits'],
      'study-planner': ['Assignments', 'Revision', 'Calendar'],
      'sprint-board': ['Sprint', 'Backlog', 'Flow'],
      'client-onboarding': ['Clients', 'Tasks'],
      'editorial-pipeline': ['Pitches', 'Production'],
      'trip-planner': ['Itinerary', 'Bookings', 'Packing'],
    });
  });

  // docs/specs/026-plan/plan-templates.md "How a template with tabs is made": a Sheet tab among the boards.
  it('makes the use-case templates’ tabs in their kinds, a Sheet tab among the boards and the Overview last', () => {
    const kinds = (kind: (typeof PLAN_TEMPLATE_KINDS)[number]) => {
      const ids = planTemplateTabs(kind).map((_, i) => `t${i}`);
      return planTemplateTabs(kind).map((d) => [d.name, d.tab?.(ids).kind]);
    };
    expect(kinds('event-planner')).toEqual([
      ['Timeline', 'board'],
      ['Tasks', 'board'],
      ['Guest List', 'sheet'],
      ['RSVP', 'form'],
      ['RSVP Responses', 'sheet'],
      ['Overview', 'dashboard'],
    ]);
    expect(kinds('help-desk')).toEqual([
      ['Tickets', 'board'],
      ['Contact Form', 'form'],
      ['Knowledge Base', 'board'],
      ['Overview', 'dashboard'],
    ]);
    expect(kinds('sales-crm')).toEqual([
      ['Deals', 'board'],
      ['Contacts', 'sheet'],
      ['Overview', 'dashboard'],
    ]);
    expect(kinds('personal-goals').map(([, k]) => k)).toEqual([
      'board',
      'board',
      'sheet',
      'dashboard',
    ]);
    expect(kinds('study-planner').map(([, k]) => k)).toEqual(['board', 'board', 'dashboard']);
    expect(kinds('meeting-agenda').at(-1)).toEqual(['Overview', 'dashboard']);
    expect(kinds('help-desk').at(-1)).toEqual(['Overview', 'dashboard']);
    for (const kind of ['event-planner', 'sales-crm', 'personal-goals'] as const)
      expect(planTemplateTabCount(kind), kind).toBe(planTemplateTabs(kind).length);
  });

  it('make a set-up that survives normaliseBoardSetup unchanged', () => {
    for (const { spec, label } of everyTab()) {
      if (!spec.board) continue;
      const setup = boardSetup(spec.board);
      // A Detailed card size is stored as absent: absent is Detailed.
      const { cardSize, ...rest } = setup;
      const expected = cardSize === 'detailed' ? rest : setup;
      expect(normaliseBoardSetup(setup), label).toEqual(expected);
    }
  });

  it('fit every column at its narrowest without scrolling sideways', () => {
    for (const { spec, label } of everyTab()) {
      if (!spec.board) continue;
      const slots = boardSetup(spec.board).columns.reduce((n, c) => n + (c.width ?? 1), 0);
      const need = slots * COLUMN_MIN_PX + Math.max(0, slots - 1) * GAP_PX + 2 * SIDE_PADDING_PX;
      expect(spec.board.width, label).toBeGreaterThanOrEqual(need);
    }
  });

  it('give each column a unique id and status, and a done column that is one of them', () => {
    for (const { spec, label } of everyTab()) {
      if (!spec.board) continue;
      const setup = boardSetup(spec.board);
      expect(new Set(setup.columns.map((c) => c.id)).size, label).toBe(setup.columns.length);
      expect(new Set(setup.columns.map((c) => c.status)).size, label).toBe(setup.columns.length);
      if (setup.doneColumnId)
        expect(
          setup.columns.map((c) => c.id),
          label,
        ).toContain(setup.doneColumnId);
    }
  });

  // docs/specs/026-plan/plan-board.md "Done columns": a template's done column and every one after it are flagged
  // done, as they read before columns were flagged, and nothing else is, whatever its name.
  it('flag the done columns their spec names, and only those', () => {
    for (const { spec, label } of everyTab()) {
      if (!spec.board) continue;
      const merged = { ...presetSetup(spec.board.preset), ...spec.board.setup };
      const at = merged.columns.findIndex((c) => c.id === merged.doneColumnId);
      const setup = boardSetup(spec.board);
      expect(
        doneColumnsOf(setup).map((c) => c.id),
        label,
      ).toEqual(at < 0 ? [] : merged.columns.slice(at).map((c) => c.id));
      expect(setup.doneColumnId, label).toBe(doneColumnsOf(setup)[0]?.id);
    }
  });

  it('name a status the same on every board of a template that shares it', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const names = new Map<string, string>();
      for (const spec of PLAN_TEMPLATE_TABS[kind]) {
        if (!spec.board) continue;
        const setup = boardSetup(spec.board);
        if (setup.archive || setup.allCards) continue;
        for (const c of setup.columns) {
          expect(names.get(c.status) ?? c.name, `${kind} ${c.status}`).toBe(c.name);
          names.set(c.status, c.name);
        }
      }
    }
  });

  it('hand cards from one tab to the next through a shared status', () => {
    const statuses = (kind: (typeof PLAN_TEMPLATE_KINDS)[number], tab: string) => {
      const spec = PLAN_TEMPLATE_TABS[kind].find((t) => t.name === tab)!;
      return boardSetup(spec.board!).columns.map((c) => c.status);
    };
    // Backlog's This Sprint is the Sprint board's first column; Daily Standup walks the Sprint's.
    expect(statuses('project-planner', 'Backlog')).toContain('sprint');
    expect(statuses('project-planner', 'Sprint')[0]).toBe('sprint');
    for (const s of statuses('project-planner', 'Daily Standup'))
      expect(statuses('project-planner', 'Sprint')).toContain(s);
    expect(statuses('kanban', 'Requests')).toContain('backlog');
    expect(statuses('kanban', 'Board')[0]).toBe('backlog');
    expect(statuses('bug-triage', 'Fixing')[0]).toBe('confirmed');
    expect(statuses('bug-triage', 'Triage')).toContain('confirmed');
    expect(statuses('content-calendar', 'Production')[0]).toBe('approved');
    expect(statuses('content-calendar', 'Ideas')).toContain('approved');
    expect(statuses('feedback-board', 'Delivery')[0]).toBe('fb-planned');
    expect(statuses('feedback-board', 'Feedback')).toContain('fb-planned');
  });

  it('keeps the Retro to notes and ideas, with its actions on a board of their own', () => {
    const [retro, actions, archive] = PLAN_TEMPLATE_TABS['team-retro'];
    const setup = boardSetup(retro!.board!);
    expect(setup.columns.map((c) => c.name)).toEqual(['Went Well', 'To Improve', 'Ideas']);
    expect(setup.addTypes).toEqual(['rt-note', 'rt-idea']);
    expect(setup.hideWriting).toBe(true);
    expect(boardSetup(actions!.board!).addTypes).toEqual(['rt-action']);
    expect(boardSetup(archive!.board!).archive).toBe(true);
  });

  it('puts a Gantt of the board’s cards under every board of dated cards', () => {
    const dated = new Set([
      'pp-initiative',
      'hp-role',
      'okr-objective',
      'pl-workstream',
      'ev-workstream',
      'pg-goal',
      'co-client',
    ]);
    for (const { kind, spec, label } of everyTab()) {
      if (!spec.board) continue;
      const types = boardSetup(spec.board).addTypes ?? [];
      const ofDated = types.length === 1 && dated.has(types[0]!);
      expect(spec.charts?.includes('gantt') ?? false, label).toBe(ofDated);
      if (!ofDated) continue;
      const gantt = viewsOf(kind).find(
        (el) => el.type === 'shape' && el.shape === 'plan-view' && el.planView?.view === 'gantt',
      );
      // Named, never the chart's own default of Projects.
      expect(gantt?.type === 'shape' ? gantt.planView?.types : undefined, label).toEqual(types);
    }
  });

  it('names the card types of every board, each the template’s own', () => {
    const known = new Set(TEMPLATE_CARD_TYPES.map((t) => t.id));
    for (const { spec, label } of everyTab()) {
      if (!spec.board) continue;
      const setup = boardSetup(spec.board);
      if (setup.archive) continue;
      expect(setup.addTypes?.length, label).toBeGreaterThan(0);
      for (const t of setup.addTypes!) expect(known.has(t), `${label} ${t}`).toBe(true);
    }
  });

  it('lays rows by a field only every type the board takes has', () => {
    const types = TEMPLATE_CARD_TYPES;
    for (const { spec, label } of everyTab()) {
      if (!spec.board) continue;
      const setup = boardSetup(spec.board);
      if (setup.swimlaneBy !== 'field') continue;
      for (const id of setup.addTypes ?? [])
        expect(types.find((t) => t.id === id)!.fields, `${label} ${id}`).toContain(
          setup.swimlaneField,
        );
    }
  });

  it('carries every card handed off onto the board it lands on', () => {
    const takes = (kind: (typeof PLAN_TEMPLATE_KINDS)[number], tab: string) =>
      boardSetup(PLAN_TEMPLATE_TABS[kind].find((t) => t.name === tab)!.board!).addTypes ?? [];
    const handOffs: [(typeof PLAN_TEMPLATE_KINDS)[number], string, string][] = [
      ['project-planner', 'Backlog', 'Sprint'],
      ['project-planner', 'Sprint', 'Daily Standup'],
      ['project-planner', 'Daily Standup', 'Sprint'],
      ['kanban', 'Requests', 'Board'],
      ['bug-triage', 'Triage', 'Fixing'],
      ['content-calendar', 'Ideas', 'Production'],
      ['feedback-board', 'Feedback', 'Delivery'],
    ];
    for (const [kind, from, to] of handOffs)
      for (const t of takes(kind, from))
        expect(takes(kind, to), `${kind} ${from}›${to}`).toContain(t);
  });

  it('gives each template the card types its work is made of', () => {
    const takes = (kind: (typeof PLAN_TEMPLATE_KINDS)[number]) =>
      PLAN_TEMPLATE_TABS[kind].flatMap((t) => (t.board ? [boardSetup(t.board).addTypes] : []));
    expect(takes('project-planner')).toEqual([
      ['pp-initiative'],
      ['pp-story', 'pp-task', 'pp-bug'],
      ['pp-story', 'pp-task', 'pp-bug'],
      ['pp-story', 'pp-task', 'pp-bug'],
    ]);
    expect(takes('hiring-pipeline')).toEqual([['hp-role'], ['hp-candidate'], ['hp-onboarding']]);
    expect(takes('okrs')).toEqual([['okr-objective'], ['okr-key-result']]);
    expect(takes('bug-triage')).toEqual([['bt-bug'], ['bt-bug']]);
    expect(takes('kanban')).toEqual([['kb-work-item', 'kb-request'], ['kb-request']]);
    expect(takes('team-retro')).toEqual([['rt-note', 'rt-idea'], ['rt-action'], undefined]);
    expect(takes('weekly-planner')).toEqual([
      ['wk-todo', 'wk-errand', 'wk-note'],
      ['wk-todo', 'wk-errand', 'wk-note'],
    ]);
    expect(takes('feedback-board')).toEqual([['fb-feedback'], ['fb-feedback', 'fb-task']]);
    expect(takes('content-calendar')).toEqual([['cc-post'], ['cc-post', 'cc-task']]);
    expect(takes('product-launch')).toEqual([['pl-workstream'], ['pl-task'], ['pl-check']]);
    expect(takes('event-planner')).toEqual([['ev-workstream'], ['ev-task']]);
    expect(takes('sales-crm')).toEqual([['crm-deal']]);
    expect(takes('help-desk')).toEqual([['hd-ticket'], ['hd-article']]);
    expect(takes('meeting-agenda')).toEqual([['ma-topic'], ['ma-action'], undefined]);
    expect(takes('personal-goals')).toEqual([['pg-goal'], ['pg-milestone']]);
    expect(takes('study-planner')).toEqual([['sp-assignment'], ['sp-topic']]);
    expect(takes('sprint-board')).toEqual([
      ['sb-story', 'sb-task', 'sb-bug'],
      ['sb-story', 'sb-task', 'sb-bug'],
    ]);
    expect(takes('client-onboarding')).toEqual([['co-client'], ['co-task']]);
    expect(takes('editorial-pipeline')).toEqual([['ed-article'], ['ed-article', 'ed-task']]);
    expect(takes('trip-planner')).toEqual([['tr-idea', 'tr-note'], ['tr-booking'], ['tr-item']]);
  });

  // docs/specs/026-plan/plan-templates.md "Card types a template makes": no default type, no ready-made type.
  it('brings only its own card types, never a default or a ready-made one', () => {
    const shared = new Set(READY_MADE_CARD_TYPES.map((t) => t.id));
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const tabs = buildTemplateTabs({ id: 't', name: 'T' }, kind, () => 'x');
      const brought = catalogueWithBoardTypes(
        null,
        tabs.flatMap((t) => t.elements),
      );
      for (const t of brought?.types ?? []) {
        expect(shared.has(t.id), `${kind} ${t.id}`).toBe(false);
        expect(
          TEMPLATE_CARD_TYPES.some((own) => own.id === t.id),
          `${kind} ${t.id}`,
        ).toBe(true);
      }
    }
  });

  // docs/specs/026-plan/plan-tabs.md "Templates": a Board tab per board, a Sheet tab per Sheet, and a Dashboard.
  it('makes a Board tab of each board alone and a Sheet tab of each Sheet alone', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const defs = planTemplateTabs(kind);
      const ids = defs.map((_, i) => `id${i}`);
      defs.forEach((def) => {
        const els = def.build(100, -50);
        const fields = def.tab?.(ids) ?? {};
        const label = `${kind} › ${def.name}`;
        if (fields.kind === 'board') {
          expect(boardsOf(els), label).toHaveLength(1);
          expect(els, label).toHaveLength(1);
          // Centred on the point.
          const el = els[0]!;
          if ('width' in el)
            expect(Math.abs(el.x + el.width / 2 - 100), label).toBeLessThanOrEqual(1);
        } else if (fields.kind === 'sheet') {
          expect(
            els.map((e) => (e.type === 'shape' ? e.shape : e.type)),
            label,
          ).toEqual(['plan-sheet']);
        } else if (fields.kind === 'dashboard') {
          for (const el of els)
            expect(el.type === 'shape' && isPlanViewId(el.planView?.view), label).toBe(true);
        } else {
          expect(els, label).toEqual([]);
        }
      });
    }
  });

  // plan-tabs.md "Form Metrics": a template's form brings its Responses figure to the Overview.
  it('puts every template form’s Responses figure on its Dashboard, naming the form tab', () => {
    for (const [kind, form] of [
      ['help-desk', 'Contact Form'],
      ['event-planner', 'RSVP'],
      ['kanban', 'Request Form'],
      ['bug-triage', 'Bug Report'],
      ['hiring-pipeline', 'Application'],
      ['feedback-board', 'Request Form'],
    ] as const) {
      const defs = planTemplateTabs(kind);
      const ids = defs.map((_, i) => `id${i}`);
      const dash = defs.findIndex((d) => d.tab?.(ids).kind === 'dashboard');
      const slots = defs[dash]!.tab!(ids).dashboard!.rows.flatMap((r) => r.slots);
      const figures = slots.flatMap((s) => (s.content?.type === 'form-metric' ? [s.content] : []));
      expect(figures, kind).toEqual([
        {
          type: 'form-metric',
          metric: 'responses',
          formTabId: ids[defs.findIndex((d) => d.name === form)],
        },
      ]);
    }
  });

  // docs/specs/026-plan/plan-templates.md "What a template shows off".
  it('shows flow charts on every delivery template’s Dashboard', () => {
    const delivery = PLAN_TEMPLATE_KINDS.filter((kind) =>
      ['cumulative-flow', 'cycle-time', 'throughput'].every((v) =>
        viewsOf(kind).some((el) => el.type === 'shape' && el.planView?.view === v),
      ),
    );
    expect(delivery).toEqual(['project-planner', 'kanban', 'sprint-board', 'editorial-pipeline']);
    // Bug Tracker, Feedback Board and Help Desk read how fast work finishes, without the cumulative flow.
    for (const kind of ['bug-triage', 'feedback-board', 'help-desk'] as const)
      for (const v of ['cycle-time', 'throughput'])
        expect(
          viewsOf(kind).some((el) => el.type === 'shape' && el.planView?.view === v),
          `${kind} ${v}`,
        ).toBe(true);
  });

  it('tells every date-heavy template’s reader about the calendar feed', () => {
    const says = PLAN_TEMPLATE_KINDS.filter((kind) =>
      PLAN_TEMPLATE_TABS[kind].some((t) =>
        (t.rail ?? []).some((r) => r.kind === 'sticky' && /Subscribe to Calendar/.test(r.text)),
      ),
    );
    expect(says).toEqual([
      'project-planner',
      'weekly-planner',
      'content-calendar',
      'event-planner',
      'study-planner',
      'client-onboarding',
      'editorial-pipeline',
      'trip-planner',
    ]);
  });

  it('gathers every view and note on the Dashboard, which shows each Board and Sheet tab', () => {
    for (const kind of PLAN_TEMPLATE_KINDS) {
      const defs = planTemplateTabs(kind);
      const ids = defs.map((_, i) => `id${i}`);
      const dash = defs.findIndex((d) => d.tab?.(ids).kind === 'dashboard');
      const specs = PLAN_TEMPLATE_TABS[kind];
      const viewCount = specs.reduce(
        (n, s) => n + (s.metrics?.length ?? 0) + (s.charts?.length ?? 0),
        0,
      );
      const notes = specs.flatMap((s) => (s.rail ?? []).filter((r) => r.kind === 'sticky'));
      if (viewCount + notes.length === 0) {
        expect(dash, kind).toBe(-1);
        continue;
      }
      const layout = defs[dash]!.tab!(ids).dashboard!;
      const slots = layout.rows.flatMap((r) => r.slots);
      const els = defs[dash]!.build(0, 0);
      expect(els, kind).toHaveLength(viewCount);
      // Every element is in a slot, every tab slot a Board or Sheet tab of the template.
      for (const el of els)
        expect(
          slots.some((s) => s.content?.type === 'element' && s.content.elementId === el.id),
          kind,
        ).toBe(true);
      const shown = slots.flatMap((s) => (s.content?.type === 'tab' ? [s.content.tabId] : []));
      const work = defs.flatMap((d, i) =>
        ['board', 'sheet'].includes(d.tab?.(ids).kind ?? '') ? [ids[i]!] : [],
      );
      expect(shown, kind).toEqual(work);
      expect(
        slots.filter((s) => s.content?.type === 'note'),
        kind,
      ).toHaveLength(notes.length);
    }
  });

  it('leaves Blank Plan’s one tab empty, so the tab shows Start Planning', () => {
    expect(PLAN_TEMPLATE_TABS['blank-plan']).toHaveLength(1);
    expect(planTemplateTabs('blank-plan')[0]!.build(100, -50)).toEqual([]);
  });

  // plan-templates.md "Spreadsheet templates": a Sheet naming its start.
  it('builds each spreadsheet template’s Sheet, naming its start', () => {
    const sheetOf = (kind: Parameters<typeof buildPlanTemplate>[0]) => {
      const els = buildPlanTemplate(kind, 0, 0);
      const sheets = els.filter((el) => el.type === 'shape' && el.shape === 'plan-sheet');
      expect(sheets, kind).toHaveLength(1);
      return sheets[0] as Extract<Element, { type: 'shape' }>;
    };
    expect(sheetOf('budget-planner').planSheet?.start).toBe('budget-planner');
    expect(sheetOf('timesheet').planSheet?.start).toBe('timesheet');
    expect(sheetOf('contact-list').planSheet?.start).toBe('contact-list');
    expect(sheetOf('task-tracker').planSheet?.start).toBe('task-tracker');
    // The tracker's how-to is a note on its Overview.
    expect(planTemplateTabs('task-tracker').map((t) => t.name)).toEqual([null, 'Overview']);
    // Every build is a fresh sheet.
    expect(sheetOf('timesheet').planSheet?.sheetId).not.toBe(
      sheetOf('timesheet').planSheet?.sheetId,
    );
    for (const el of buildPlanTemplate('contact-list', 0, 0)) expect(isValidElement(el)).toBe(true);
  });

  it('names the tabs of a template with several, and leaves a one-tab template’s name to the caller', () => {
    expect(planTemplateTabs('blank-plan').map((t) => t.name)).toEqual([null]);
    expect(planTemplateTabs('okrs').map((t) => t.name)).toEqual([
      'Objectives',
      'Key Results',
      'Overview',
    ]);
    expect(templateTabs('blank').map((t) => t.name)).toEqual([null]);
    // The first tab is what buildTemplate makes.
    expect(boardsOf(templateTabs('kanban')[0]!.build(0, 0))).toEqual(
      boardsOf(buildPlanTemplate('kanban', 0, 0)),
    );
  });

  it('hands out a fresh set-up each time', () => {
    const spec = PLAN_TEMPLATE_TABS['hiring-pipeline'][1]!.board!;
    boardSetup(spec).columns.pop();
    expect(boardSetup(spec).columns).toHaveLength(6);
    expect(isPlanTemplateKind('okrs')).toBe(true);
    expect(isPlanTemplateKind('daily-standup')).toBe(false);
  });
});

// A board's default widgets read true from the start (docs/specs/026-plan/board-widgets.md "Defaults").
describe('default widgets', () => {
  const setups = [
    ...PLAN_BOARD_PRESET_IDS.map((id) => ({ label: `preset ${id}`, setup: presetSetup(id) })),
    ...everyTab().flatMap(({ spec, label }) =>
      spec.board ? [{ label, setup: boardSetup(spec.board) }] : [],
    ),
  ];

  it('put Completion only on a board with a done column', () => {
    for (const { label, setup } of setups)
      if (setup.widgets?.includes('progress')) expect(setup.doneColumnId, label).toBeTruthy();
  });

  it('put WIP Alerts only on a board with a WIP limit', () => {
    for (const { label, setup } of setups)
      if (setup.widgets?.includes('wip'))
        expect(
          setup.columns.some((c) => c.wipLimit),
          label,
        ).toBe(true);
  });

  it('never repeat the rows or default Only Mine, and stay few', () => {
    for (const { label, setup } of setups) {
      const widgets = setup.widgets ?? [];
      if (setup.swimlaneBy === 'assignee') expect(widgets, label).not.toContain('people');
      if (setup.swimlaneBy === 'priority') expect(widgets, label).not.toContain('priorities');
      expect(widgets, label).not.toContain('mine');
      expect(widgets.length, label).toBeLessThanOrEqual(3);
    }
  });
});

describe('counting a Plan template’s tabs without building them', () => {
  it('matches the tabs it makes, for every Plan template', () => {
    for (const kind of PLAN_TEMPLATE_KINDS)
      expect(planTemplateTabCount(kind), kind).toBe(planTemplateTabs(kind).length);
  });
});

describe('a template board fills its tab', () => {
  it('draws its cards Detailed, whatever its preset uses on a canvas', () => {
    for (const kind of PLAN_TEMPLATE_KINDS)
      for (const def of planTemplateTabs(kind))
        for (const el of def.build(0, 0))
          if (el.type === 'shape' && el.shape === 'plan-board')
            expect(el.planBoard?.cardSize, kind).toBeUndefined();
  });
});
