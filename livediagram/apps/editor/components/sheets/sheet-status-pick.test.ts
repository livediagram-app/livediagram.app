// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { resetStatusPick, statusPick, toggleStatusPick } from './sheet-status-pick';

describe('the totals pick', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStatusPick();
  });

  it('starts with Sum, Average and Count, and keeps a change in the browser', () => {
    expect(statusPick()).toEqual(['Sum', 'Average', 'Count']);
    toggleStatusPick('Min');
    expect(statusPick()).toEqual(['Sum', 'Average', 'Count', 'Min']);
    resetStatusPick();
    expect(statusPick()).toEqual(['Sum', 'Average', 'Count', 'Min']);
  });

  it('reads past a broken or empty stored pick', () => {
    localStorage.setItem('livediagram:sheet-status-stats', '{oops');
    expect(statusPick()).toEqual(['Sum', 'Average', 'Count']);
    resetStatusPick();
    localStorage.setItem('livediagram:sheet-status-stats', '[]');
    expect(statusPick()).toEqual(['Sum', 'Average', 'Count']);
  });
});
