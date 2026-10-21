import { describe, expect, it } from 'vitest';
import { createShape } from './factories';
import type { Element } from './index';
import { migrateLegacySessionButtons } from './legacy-session-buttons';
import { elementValidationIssue } from './validate';

describe('migrateLegacySessionButtons', () => {
  it('drops a retired tool so the button reads as the default timer and the tab still loads', () => {
    const stored = {
      ...createShape('session-button', 0, 0),
      session: { tool: 'poll', question: 'Ready?', options: ['Yes', 'No'] },
    } as unknown as Element;
    const [migrated] = migrateLegacySessionButtons([stored]);
    expect(migrated).not.toHaveProperty('session');
    expect(elementValidationIssue(migrated)).toBeNull();
  });

  it('leaves a known tool, and an unchanged list, alone', () => {
    const vote = { ...createShape('session-button', 0, 0), session: { tool: 'vote', dots: 3 } } as Element;
    const list = [vote];
    expect(migrateLegacySessionButtons(list)).toBe(list);
  });
});
