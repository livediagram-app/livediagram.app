// @vitest-environment jsdom
// docs/specs/026-plan/automations.md "The Automations screen": an Audit Trail run whose step failed on something the
// plan lost says what is gone in words, never by its id, in its reason and its lines; a run kept from before, with no
// `gone` beside its text, reads as stored.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AutomationGone } from '@liveplanner/items';
import { RunRow } from './RunRow';
import { NOW, run } from './test-fixtures';

afterEach(cleanup);

const gone: AutomationGone = { kind: 'field', id: 'estimate_goneqa' };

describe('a run that failed on something gone', () => {
  it('words its reason and its failed line without the id', () => {
    render(
      <ul>
        <RunRow
          run={run({
            result: 'failed',
            reason: 'Field estimate_goneqa is gone',
            gone,
            steps: [
              { kind: 'trigger', text: 'Sam moved it from To Do to Done' },
              {
                kind: 'condition',
                ok: false,
                text: 'Column is Done or qa (qa is gone)',
                gone: { kind: 'column', id: 'qa' },
              },
              { kind: 'action', ok: false, text: 'Field estimate_goneqa is gone', gone },
            ],
          })}
          now={NOW}
          phone={false}
          defaultOpen
        />
      </ul>,
    );
    const row = document.querySelector('[data-run-row]')!;
    expect(row.querySelector('[data-run-reason]')!.textContent).toBe('A field is gone');
    const lines = row.querySelectorAll('[data-run-steps] li');
    expect(lines[1]!.textContent).toContain(
      'Column is Done or a column no longer here (a column is gone)',
    );
    expect(lines[2]!.textContent).toContain('A field is gone');
    expect(row.textContent).not.toMatch(/estimate_goneqa|\bqa\b/);
  });

  it('reads a run kept from before as stored', () => {
    render(
      <ul>
        <RunRow
          run={run({ result: 'failed', reason: 'Field f-old is gone' })}
          now={NOW}
          phone={false}
        />
      </ul>,
    );
    expect(document.querySelector('[data-run-reason]')!.textContent).toBe('Field f-old is gone');
  });
});
