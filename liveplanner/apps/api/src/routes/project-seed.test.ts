import { describe, expect, it } from 'vitest';
import { templateTabs } from '@liveplanner/templates';
import { compileSeededTabs, seededTabName } from './project-seed';

// A seeded template's first tab name (docs/specs/026-plan/plan-templates.md "How a template with tabs is made").

describe('seededTabName', () => {
  const names = templateTabs('hiring-pipeline').map((d) => d.name);

  it('takes the name given', () => {
    expect(seededTabName('Hiring', 'hiring-pipeline')).toBe('Hiring');
    expect(seededTabName('Anything', 'not-a-template')).toBe('Anything');
    expect(seededTabName('Anything', undefined)).toBe('Anything');
  });

  it('keeps the template’s own first name when the name given is a later tab’s', () => {
    expect(names.length).toBeGreaterThan(1);
    expect(seededTabName(` ${names[1]!.toUpperCase()} `, 'hiring-pipeline')).toBe(names[0]);
  });

  it('so a seeded create never makes two tabs of one name', () => {
    const compiled = compileSeededTabs(
      [{ id: 't1', name: names[1], template: 'hiring-pipeline' }],
      'd1',
    );
    if ('refusal' in compiled) throw new Error('refused');
    const made = (compiled.tabs as { name: string }[]).map((t) => t.name);
    expect(new Set(made).size).toBe(made.length);
    expect(made).toEqual(names);
  });
});
