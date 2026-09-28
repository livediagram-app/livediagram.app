import { describe, expect, it } from 'vitest';
import {
  estimateScalePending,
  estimateSpread,
  estimateSpreadLabel,
  estimateRank,
  temperaturePosition,
  supportsMarkers,
  supportsTextAlign,
  AGENDA_DEFAULT_MINUTES,
  AGENDA_MAX_MINUTES,
  ESTIMATE_SCALE_VALUES,
  agendaTotalMinutes,
  chairSeatPoint,
  CHAIR_FACINGS,
  CHAIR_FACING_LABELS,
  CHAIR_SITTER_FACING,
  clampAgendaMinutes,
  estimateValues,
  isChairFacing,
  isCollabPanelShape,
  isDecisionDate,
  isDecisionStatus,
  isEstimateScale,
} from './collab-shapes';
import { carriesSharedSettingsMenu } from './behaviour-shapes';
import { createShape } from './factories';
import { isValidElement } from './validate';

describe('estimate scales', () => {
  it('every scale offers "?" as a real answer (docs/specs/012-collaboration/estimate-card.md)', () => {
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

  it('accepts a date and refuses a timestamp (docs/specs/012-collaboration/decision-record.md)', () => {
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

  it('moves the seat away from the back as the chair turns', () => {
    const box = { x: 100, y: 200, width: 80, height: 100 };
    // Back on the right ('e'), so the seat is left of centre, and so on.
    expect(chairSeatPoint(box, 'e').x).toBeLessThan(140);
    expect(chairSeatPoint(box, 's').y).toBeLessThan(250);
    expect(chairSeatPoint(box, 'w').x).toBeGreaterThan(140);
    expect(chairSeatPoint(box, 'n')).toEqual(chairSeatPoint(box));
  });

  it('turns the sitter the way the seat points', () => {
    for (const facing of CHAIR_FACINGS) {
      // The menu label and the sitter's pose must say the same thing.
      expect(CHAIR_FACING_LABELS[facing]).toBe(`Facing ${CHAIR_SITTER_FACING[facing]}`);
    }
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
      // flow over the whole box put it under the status chip (docs/specs/012-collaboration/decision-record.md).
      'decision',
    ] as const) {
      expect(isCollabPanelShape(kind)).toBe(true);
    }
  });

  it('excludes the chair, which keeps a plain label (docs/specs/009-elements/chair.md)', () => {
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

  it('seeds an estimate card with no scale yet and no answers', () => {
    const el = createShape('estimate', 0, 0);
    // A new card asks for its scale on the canvas (estimate-card.md "Choosing a scale").
    expect(el.estimateScale).toBeUndefined();
    expect(estimateScalePending(el)).toBe(true);
    expect(estimateScalePending({ ...el, estimateScale: 'tshirt' })).toBe(false);
    // An older card with no scale but a round on it keeps meaning Fibonacci.
    expect(
      estimateScalePending({ ...el, responses: [{ participantId: 'a', value: '5', at: 1 }] }),
    ).toBe(false);
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

describe('the shared settings ellipsis (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/009-elements/chair.md)', () => {
  it('is on every Behaviours card except the chair and the ones with their own', () => {
    expect(carriesSharedSettingsMenu('chair')).toBe(false);
    expect(carriesSharedSettingsMenu('done-check')).toBe(false);
    expect(carriesSharedSettingsMenu('comment-pin')).toBe(true);
    expect(carriesSharedSettingsMenu('square')).toBe(false);
  });
});

// One text-align gate for the context menu and the quick style panel: a kind
// whose face shows its label as a fixed title has nothing to align.
describe('supportsTextAlign', () => {
  it('is off for kinds with their own face and for self-drawing kinds', () => {
    for (const kind of [
      'qa-board',
      'agenda',
      'decision',
      'roll-call',
      'chair',
      'session-button',
      'focus-button',
      'reveal',
      'picker',
      'comment-pin',
      'action-card',
      'reaction-pad',
      'portal',
      'mode-button',
      'quiz',
      'stat-row',
      'sticker',
      'icon',
    ] as const) {
      expect(supportsTextAlign(kind), kind).toBe(false);
    }
  });

  it('is on for plain shapes and for kinds that render the aligned label', () => {
    for (const kind of ['square', 'circle', 'banner', 'callout', 'page'] as const) {
      expect(supportsTextAlign(kind), kind).toBe(true);
    }
  });
});

// Markers decorate a label, so they share the text-align gate's reasoning.
describe('supportsMarkers', () => {
  it('is off for kinds with their own face and for self-drawing kinds', () => {
    for (const kind of [
      'temperature',
      'qa-board',
      'idea-box',
      'session-button',
      'progress-bar',
      'stat-row',
    ] as const) {
      expect(supportsMarkers(kind), kind).toBe(false);
    }
  });

  it('is on for plain shapes', () => {
    for (const kind of ['square', 'circle', 'banner'] as const) {
      expect(supportsMarkers(kind), kind).toBe(true);
    }
  });
});

describe('temperature mood', () => {
  it('places an average on the track', () => {
    expect(temperaturePosition(1)).toBe(0);
    expect(temperaturePosition(3)).toBe(0.5);
    expect(temperaturePosition(5)).toBe(1);
  });
});

// The estimate card's spread (docs/specs/012-collaboration/estimate-card.md "The two states").
describe('estimate spread', () => {
  it('orders by the scale, so a t-shirt round reads small to large', () => {
    expect(estimateRank('tshirt', 'XS')).toBeLessThan(estimateRank('tshirt', 'XL'));
    expect(estimateRank('fibonacci', '13')).toBeGreaterThan(estimateRank('fibonacci', '8'));
  });

  it('names nobody, agreement, and the ends of a spread', () => {
    expect(estimateSpread('fibonacci', [])).toEqual({ kind: 'none' });
    expect(estimateSpreadLabel(estimateSpread('fibonacci', ['5', '5']))).toBe('Unanimous · 5');
    expect(estimateSpread('fibonacci', ['13', '3', '5', '?'])).toEqual({
      kind: 'range',
      low: '3',
      high: '13',
    });
    expect(estimateSpreadLabel(estimateSpread('tshirt', ['L', 'S']))).toBe('Spread S → L');
    // A lone number beside a '?' is agreement on the one size anyone gave.
    expect(estimateSpread('fibonacci', ['8', '?'])).toEqual({ kind: 'unanimous', value: '8' });
  });
});
