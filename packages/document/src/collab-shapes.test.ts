import { describe, expect, it } from 'vitest';
import {
  temperaturePosition,
  supportsMarkers,
  supportsTextAlign,
  isCollabPanelShape,
  isDecisionDate,
  isDecisionStatus,
} from './collab-shapes';
import { carriesSharedSettingsMenu } from './behaviour-shapes';
import { createShape } from './factories';
import { isValidElement } from './validate';

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

describe('isCollabPanelShape', () => {
  it('covers every kind that draws its own card', () => {
    for (const kind of [
      'temperature',
      // The decision has nothing to press, but it owns its layout for the
      // same reason: its label is a sentence, and letting the generic label
      // flow over the whole box put it under the status chip (docs/specs/012-collaboration/decision-record.md).
      'decision',
    ] as const) {
      expect(isCollabPanelShape(kind)).toBe(true);
    }
  });

  it('excludes a plain shape', () => {
    expect(isCollabPanelShape('square')).toBe(false);
  });
});

describe('the collaboration kinds create and validate', () => {
  const kinds = ['temperature', 'decision'] as const;

  it.each(kinds)('%s creates a valid element', (kind) => {
    const el = createShape(kind, 10, 20);
    expect(el.shape).toBe(kind);
    expect(el.width).toBeGreaterThan(0);
    expect(isValidElement(el)).toBe(true);
  });

  it('seeds a temperature check with no answers yet', () => {
    expect(createShape('temperature', 0, 0).responses).toBeUndefined();
  });

  it('seeds a decision as proposed, not accepted', () => {
    expect(createShape('decision', 0, 0).decisionStatus).toBe('proposed');
  });
});

describe('validation bounds', () => {
  const withFields = (fields: Record<string, unknown>) => ({
    ...createShape('temperature', 0, 0),
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

  it('rejects a bad decision date but keeps an absent one', () => {
    expect(isValidElement(withFields({ decisionDate: 'yesterday' }))).toBe(false);
    expect(isValidElement(withFields({ decisionDate: '2026-01-05' }))).toBe(true);
  });
});

describe('the shared settings ellipsis (docs/specs/008-canvas/canvas-and-palette.md)', () => {
  it('is on every Behaviours card except the ones with their own or none', () => {
    expect(carriesSharedSettingsMenu('session-button')).toBe(false);
    expect(carriesSharedSettingsMenu('comment-pin')).toBe(false);
    expect(carriesSharedSettingsMenu('action-card')).toBe(false);
    expect(carriesSharedSettingsMenu('picker')).toBe(true);
    expect(carriesSharedSettingsMenu('square')).toBe(false);
  });
});

// One text-align gate for the context menu and the quick style panel: a kind
// whose face shows its label as a fixed title has nothing to align.
describe('supportsTextAlign', () => {
  it('is off for kinds with their own face and for self-drawing kinds', () => {
    for (const kind of [
      'temperature',
      'decision',
      'session-button',
      'picker',
      'comment-pin',
      'action-card',
      'portal',
      'stat-row',
      'sticker',
    ] as const) {
      expect(supportsTextAlign(kind), kind).toBe(false);
    }
  });

  it('is on for plain shapes and for kinds that render the aligned label', () => {
    // An icon's alignment places its caption around the glyph (docs/specs/010-palette/technology-icons.md).
    for (const kind of ['square', 'circle', 'banner', 'callout', 'page', 'icon'] as const) {
      expect(supportsTextAlign(kind), kind).toBe(true);
    }
  });
});

// Markers decorate a label, so they share the text-align gate's reasoning.
describe('supportsMarkers', () => {
  it('is off for kinds with their own face and for self-drawing kinds', () => {
    for (const kind of ['temperature', 'session-button', 'progress-bar', 'stat-row'] as const) {
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
