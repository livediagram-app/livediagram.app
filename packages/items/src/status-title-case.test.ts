import { describe, expect, it } from 'vitest';
import { statusTitleCase } from './status-title-case';
import { PLAN_BOARD_PRESETS } from './presets';

// docs/specs/026-plan/plan-board.md "Column names".
describe('statusTitleCase', () => {
  it('capitalises every word', () => {
    expect(statusTitleCase('in progress')).toBe('In Progress');
    expect(statusTitleCase('to do')).toBe('To Do');
    expect(statusTitleCase('sprint backlog')).toBe('Sprint Backlog');
    expect(statusTitleCase('DONE')).toBe('DONE');
  });

  it('keeps short words lower case mid-name, never first or last', () => {
    expect(statusTitleCase('ready for review')).toBe('Ready for Review');
    expect(statusTitleCase('waiting on')).toBe('Waiting On');
    expect(statusTitleCase('Out Of Scope')).toBe('Out of Scope');
    expect(statusTitleCase('the backlog')).toBe('The Backlog');
  });

  it('keeps words cased on purpose, and anything not a letter', () => {
    expect(statusTitleCase('ready for QA')).toBe('Ready for QA');
    expect(statusTitleCase('iOS release')).toBe('iOS Release');
    expect(statusTitleCase('mvp scope')).toBe('Mvp Scope');
    expect(statusTitleCase('phase 2')).toBe('Phase 2');
    expect(statusTitleCase('#1 priority')).toBe('#1 Priority');
  });

  it('capitalises hyphenated parts, not a letter after an apostrophe', () => {
    expect(statusTitleCase('no-go')).toBe('No-Go');
    expect(statusTitleCase("won't fix")).toBe("Won't Fix");
    expect(statusTitleCase('won’t fix')).toBe('Won’t Fix');
  });

  it('trims and collapses spacing, and leaves an empty name empty', () => {
    expect(statusTitleCase('  in   review ')).toBe('In Review');
    expect(statusTitleCase('   ')).toBe('');
  });

  it('is what every preset column already reads', () => {
    for (const { setup } of Object.values(PLAN_BOARD_PRESETS))
      for (const c of setup.columns) expect(c.name).toBe(statusTitleCase(c.name));
  });
});
