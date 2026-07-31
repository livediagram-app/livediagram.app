import { describe, expect, it } from 'vitest';
import {
  AGENDA_DEFAULT_MINUTES,
  AGENDA_MAX_MINUTES,
  ESTIMATE_SCALE_VALUES,
  agendaTotalMinutes,
  chairSeatPoint,
  clampAgendaMinutes,
  estimateValues,
  isChairFacing,
  isCollabPanelShape,
  isDecisionDate,
  isDecisionStatus,
  isEstimateScale,
} from './collab-shapes';
import { createShape } from './factories';
import { isValidElement } from './validate';

describe('estimate scales', () => {
  it('every scale offers "?" as a real answer (spec/123)', () => {
    for (const values of Object.values(ESTIMATE_SCALE_VALUES)) {
      expect(values.at(-1)).toBe('?');
    }
  });

  it('defaults an absent scale to fibonacci', () => {
    expect(estimateValues(undefined)).toEqual(ESTIMATE_SCALE_VALUES.fibonacci);
  });

  it('rejects an off-vocabulary scale', () => {
    expect(isEstimateScale('fibonacci')).toBe(true);
    expect(isEstimateScale('t-shirt')).toBe(false);
    expect(isEstimateScale(undefined)).toBe(false);
  });
});

describe('agenda minutes', () => {
  it('clamps into range and rounds', () => {
    expect(clampAgendaMinutes(0)).toBe(1);
    expect(clampAgendaMinutes(7.4)).toBe(7);
    expect(clampAgendaMinutes(10_000)).toBe(AGENDA_MAX_MINUTES);
  });

  it('falls back for a non-number rather than producing NaN', () => {
    expect(clampAgendaMinutes(undefined)).toBe(AGENDA_DEFAULT_MINUTES);
    expect(clampAgendaMinutes(Number.NaN)).toBe(AGENDA_DEFAULT_MINUTES);
  });

  it('totals a plan through the same clamp', () => {
    expect(
      agendaTotalMinutes([
        { label: 'a', minutes: 5 },
        { label: 'b', minutes: 10 },
        // Out of range on the element clamps on read rather than failing load.
        { label: 'c', minutes: 0 },
      ]),
    ).toBe(16);
    expect(agendaTotalMinutes(undefined)).toBe(0);
  });
});

describe('decision record', () => {
  it('accepts only the four statuses', () => {
    expect(isDecisionStatus('superseded')).toBe(true);
    expect(isDecisionStatus('draft')).toBe(false);
  });

  it('accepts a date and refuses a timestamp (spec/128)', () => {
    expect(isDecisionDate('2026-07-31')).toBe(true);
    expect(isDecisionDate('2026-07-31T12:00:00Z')).toBe(false);
    expect(isDecisionDate('31/07/2026')).toBe(false);
  });
});

describe('chair', () => {
  it('accepts only the four facings', () => {
    expect(isChairFacing('n')).toBe(true);
    expect(isChairFacing('ne')).toBe(false);
  });

  it('seats the sitter below the box centre so they sit ON the seat', () => {
    const seat = chairSeatPoint({ x: 100, y: 200, width: 80, height: 100 });
    expect(seat.x).toBe(140);
    expect(seat.y).toBeGreaterThan(250);
    expect(seat.y).toBeLessThan(300);
  });
});

describe('isCollabPanelShape', () => {
  it('covers every kind that draws its own card', () => {
    for (const kind of [
      'estimate',
      'temperature',
      'idea-box',
      'agenda',
      'roll-call',
      // The decision has nothing to press, but it owns its layout for the
      // same reason: its label is a sentence, and letting the generic label
      // flow over the whole box put it under the status chip (spec/128).
      'decision',
    ] as const) {
      expect(isCollabPanelShape(kind)).toBe(true);
    }
  });

  it('excludes the chair, which keeps a plain label (spec/130)', () => {
    expect(isCollabPanelShape('chair')).toBe(false);
  });
});

describe('the new kinds create and validate', () => {
  const kinds = [
    'estimate',
    'temperature',
    'idea-box',
    'agenda',
    'decision',
    'roll-call',
    'chair',
  ] as const;

  it.each(kinds)('%s creates a valid element', (kind) => {
    const el = createShape(kind, 10, 20);
    expect(el.shape).toBe(kind);
    expect(el.width).toBeGreaterThan(0);
    expect(isValidElement(el)).toBe(true);
  });

  it('seeds an estimate card with a scale and no answers yet', () => {
    const el = createShape('estimate', 0, 0);
    expect(el.estimateScale).toBe('fibonacci');
    expect(el.responses).toBeUndefined();
    expect(el.responsesRevealed).toBeUndefined();
  });

  it('seeds an agenda with a demonstrable plan', () => {
    const el = createShape('agenda', 0, 0);
    expect(el.agendaItems?.length).toBeGreaterThan(0);
    expect(agendaTotalMinutes(el.agendaItems)).toBeGreaterThan(0);
    // Not started: nobody has pressed a segment yet.
    expect(el.agendaCurrent).toBeUndefined();
  });

  it('seeds a decision as proposed, not accepted', () => {
    expect(createShape('decision', 0, 0).decisionStatus).toBe('proposed');
  });
});

describe('validation bounds', () => {
  const withFields = (fields: Record<string, unknown>) => ({
    ...createShape('estimate', 0, 0),
    ...fields,
  });

  it('rejects a response missing its participant', () => {
    expect(isValidElement(withFields({ responses: [{ value: '5', at: 1 }] }))).toBe(false);
  });

  it('rejects a response whose value is not a string', () => {
    expect(
      isValidElement(withFields({ responses: [{ participantId: 'a', value: 5, at: 1 }] })),
    ).toBe(false);
  });

  it('accepts a well-formed response', () => {
    expect(
      isValidElement(withFields({ responses: [{ participantId: 'a', value: '5', at: 1 }] })),
    ).toBe(true);
  });

  it('rejects an over-long idea card', () => {
    expect(isValidElement(withFields({ ideaCards: ['x'.repeat(10_000)] }))).toBe(false);
    expect(isValidElement(withFields({ ideaCards: ['a real idea'] }))).toBe(true);
  });

  it('rejects a bad decision date but keeps an absent one', () => {
    expect(isValidElement(withFields({ decisionDate: 'yesterday' }))).toBe(false);
    expect(isValidElement(withFields({ decisionDate: '2026-01-05' }))).toBe(true);
  });

  it('rejects an off-vocabulary chair facing', () => {
    expect(isValidElement(withFields({ chairFacing: 'up' }))).toBe(false);
  });

  it('accepts an out-of-range agenda duration, because it clamps on read', () => {
    expect(isValidElement(withFields({ agendaItems: [{ label: 'x', minutes: 9_999 }] }))).toBe(
      true,
    );
  });

  it('rejects a roll-call entry with no name', () => {
    expect(isValidElement(withFields({ rollCall: [{ color: '#fff', at: 1 }] }))).toBe(false);
    expect(isValidElement(withFields({ rollCall: [{ name: 'Sam', color: '#fff', at: 1 }] }))).toBe(
      true,
    );
  });
});
