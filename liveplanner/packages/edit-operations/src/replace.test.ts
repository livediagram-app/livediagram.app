import { describe, expect, it } from 'vitest';
import {
  applyElementOps,
  getBuiltInTheme,
  type Tab,
  type ThemeDefinition,
} from '@liveplanner/project';
import { formatResultLines } from './format-results';
import { fixedIds, newView, sprintDashboard } from './fixtures/sprint-dashboard';
import { applied, refused } from './fixtures/outcomes';
import { applyReplace } from './replace';
import type { EditLog, ReplaceBody, ReplaceOptions } from './types';

const options: ReplaceOptions = { tabId: 'new-tab', name: 'Fresh', makeId: fixedIds() };
// Two views: the smallest whole tab a replace writes.
const simple: ReplaceBody = {
  elements: [newView('g1', 'gantt'), { ...newView('s1', 'search'), x: 520 }],
};
const themed = (theme: string): Tab => ({ ...sprintDashboard(), theme, font: 'serif' });

const recording = () => {
  const calls: [string, Record<string, unknown>][] = [];
  const log: EditLog = (fingerprint, fields) => calls.push([fingerprint, { ...fields }]);
  return { calls, log };
};

describe('applyReplace on an existing tab', () => {
  it('swaps the elements, keeping every tab field', () => {
    const tab = themed('ocean');
    const outcome = applyReplace(tab, simple, options);
    const { tab: next, targets, createdIds, results } = applied(outcome);
    expect(next).toMatchObject({ id: 'main', name: 'Sprint 14', theme: 'ocean', font: 'serif' });
    expect(next.elements.map((el) => el.id)).toEqual(['g1', 's1']);
    expect(targets).toEqual([]);
    expect(createdIds).toEqual(['g1', 's1']);
    expect(results.filter((line) => line.mark === '+')).toHaveLength(2);
    expect(formatResultLines(results)).toContain('- w1  plan-view "Workload"');
    expect(results.filter((line) => line.mark === '-')).toHaveLength(tab.elements.length);
  });

  it('keeps the elements where they are given', () => {
    const { tab } = applied(applyReplace(sprintDashboard(), simple, options));
    expect(tab.elements.map((el) => (el.type === 'arrow' ? null : [el.x, el.y]))).toEqual([
      [0, 840],
      [520, 840],
    ]);
  });

  it('round trips through its element ops and their inverse', () => {
    const tab = sprintDashboard();
    const { tab: next, elementOps, inverse } = applied(applyReplace(tab, simple, options));
    expect(applyElementOps(tab.elements, elementOps)).toEqual(next.elements);
    expect(applyElementOps(next.elements, inverse)).toEqual(tab.elements);
  });

  it('builds a template with the tab theme', () => {
    const { tab } = applied(applyReplace(themed('ocean'), { template: 'kanban' }, options));
    expect(tab.elements.length).toBeGreaterThan(0);
    expect(tab.name).toBe('Sprint 14');
  });

  it('refuses a locked tab', () => {
    const { calls, log } = recording();
    expect(
      refused(applyReplace({ ...sprintDashboard(), locked: true }, simple, { ...options, log }))
        .code,
    ).toBe('element_locked');
    expect(calls[0]).toEqual(['[edit-ops] locked', { operation: 0, op: 'replace', scope: 'tab' }]);
  });
});

describe('applyReplace for a new tab', () => {
  it('gives the new tab the finish asked for (docs/specs/008-canvas/finish.md)', () => {
    expect(applied(applyReplace(null, simple, { ...options, finish: 'sketch' })).tab.finish).toBe(
      'sketch',
    );
    expect(applied(applyReplace(null, simple, options)).tab.finish).toBeUndefined();
  });

  it('builds a tab with the given id, name and theme', () => {
    const { tab, createdIds } = applied(
      applyReplace(null, simple, { ...options, theme: getBuiltInTheme('ocean') }),
    );
    expect(tab).toMatchObject({ id: 'new-tab', name: 'Fresh', theme: 'ocean' });
    expect(createdIds).toEqual(tab.elements.map((el) => el.id));
  });

  it('names the theme by id, as the MCP passes the project theme to add_tab', () => {
    const { tab } = applied(
      applyReplace(null, simple, { ...options, themeId: 'ocean', theme: getBuiltInTheme('brand') }),
    );
    expect(tab.theme).toBe('ocean');
  });

  it('builds a template tab whole, with its canvas and kind', () => {
    // Kanban's first tab is a Board tab (docs/specs/026-plan/plan-tabs.md "Templates").
    const { tab } = applied(applyReplace(null, { template: 'kanban' }, options));
    expect(tab).toMatchObject({ id: 'new-tab', templateChosen: true, kind: 'board' });
  });

  it('logs the source and the element count, and a custom theme it could not paint', () => {
    const { calls, log } = recording();
    applyReplace(null, simple, {
      ...options,
      log,
      theme: { ...getBuiltInTheme('ocean'), id: 'mine' } as unknown as ThemeDefinition,
    });
    expect(calls).toEqual([
      ['[edit-ops] theme-fallback', {}],
      ['[edit-ops] replace', { source: 'elements', elements: 2 }],
    ]);
  });
});

describe('applyReplace refusals', () => {
  const refusal = (body: unknown) => refused(applyReplace(null, body as ReplaceBody, options));

  it('needs exactly one source', () => {
    expect(refusal({}).details).toEqual([
      'replace takes exactly one of template, dashboard, form, elements',
    ]);
    expect(refusal({ ...simple, template: 'kanban' }).code).toBe('invalid_value');
  });

  it('names the templates for an unknown one', () => {
    const rejection = refusal({ template: 'nope' });
    expect(rejection.details).toEqual(['template="nope": not a template']);
    expect(rejection.hint).toContain('kanban');
    expect(refusal({ template: 7 }).code).toBe('invalid_value');
  });

  // docs/specs/030-forms/forms.md "As templates": a form template starts a form, which only the editor makes.
  it('refuses a form template as made in the editor only, saying how its form is made', () => {
    const rejection = refusal({ template: 'contact-form' });
    expect(rejection.details).toEqual(['template="contact-form": made in the editor only']);
    expect(rejection.hint).toContain('make it with add_form (starter "contact")');
  });

  it('refuses elements no liveplanner tab holds', () => {
    const square = { id: 'q', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 };
    const rejection = refusal({ elements: [newView('g1', 'gantt'), square] });
    expect(rejection.details).toEqual([
      'elements: shape "square" is not an element a liveplanner tab holds',
    ]);
    expect(rejection.hint).toContain('plan-view');
    expect(refusal({ elements: [{ id: 'x', type: 'sticky' }] }).code).toBe('invalid_value');
  });

  it('refuses elements that are not a list, or an element the format does not allow', () => {
    expect(refusal({ elements: 'x' }).details).toEqual(['elements: expected an array of elements']);
    const { x: _x, ...noX } = newView('g1', 'gantt');
    expect(refusal({ elements: [noX] }).details).toEqual(['g1 x: a finite number']);
  });

  it('refuses two elements with one id', () => {
    const el = newView('g1', 'gantt');
    expect(refusal({ elements: [el, el] }).details).toEqual(['the tab elements: every id once']);
  });

  it('logs a refusal', () => {
    const { calls, log } = recording();
    applyReplace(null, {} as ReplaceBody, { ...options, log });
    expect(calls).toEqual([
      ['[edit-ops] rejected', { code: 'invalid_value', operation: 0, op: 'replace' }],
    ]);
  });
});
