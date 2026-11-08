import { describe, expect, it } from 'vitest';
import { capLabel, LABEL_CAP_MAX } from './label-cap';

// docs/specs/024-agents/blueprints/edit-operations.md EO18: a label is a heading, capped, its overflow kept elsewhere.

describe('label cap', () => {
  it('keeps a short label as it is', () => {
    expect(capLabel('Checkout service')).toEqual({ label: 'Checkout service', cut: false });
    // Line breaks written into a label that fits are kept; other runs of space become one.
    expect(capLabel('App tasks \n  ECS   Fargate\n')).toEqual({
      label: 'App tasks\nECS Fargate',
      cut: false,
    });
  });

  it('counts an emoji as one character and never cuts one in half', () => {
    const rockets = '🚀'.repeat(25);
    expect(capLabel(rockets)).toEqual({ label: rockets, cut: false });
    const { label } = capLabel('🚀'.repeat(60));
    expect(label).toBe(`${'🚀'.repeat(39)}…`);
    expect(label).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('keeps the noun phrase before a clause as the heading', () => {
    expect(capLabel('Orders service which creates and tracks customer orders').label).toBe(
      'Orders service',
    );
    expect(capLabel('Message queue for asynchronous events between services').label).toBe(
      'Message queue',
    );
    expect(capLabel('PostgreSQL primary database holding orders and customers').label).toBe(
      'PostgreSQL primary database',
    );
  });

  it('cuts a long one with no clause at a word boundary with an ellipsis', () => {
    const { label, cut } = capLabel(
      'Payment card validation and settlement reconciliation pipeline stage',
    );
    expect(cut).toBe(true);
    expect(label.length).toBeLessThanOrEqual(LABEL_CAP_MAX);
    expect(label.endsWith('…')).toBe(true);
    expect(label).not.toMatch(/\s…$/);
  });

  it('drops a bracketed aside before anything else', () => {
    expect(capLabel('Web client (React single page application served from the CDN)')).toEqual({
      label: 'Web client',
      cut: true,
    });
  });
});
