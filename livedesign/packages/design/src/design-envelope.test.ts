import { describe, expect, it } from 'vitest';
import {
  DESIGN_ENVELOPE_KIND,
  designToEnvelopeText,
  parseDesignEnvelope,
  type EnvelopeTab,
} from './design-envelope';

// The `.livedesign` file's contents.

const tab: EnvelopeTab = { id: 't1', name: 'Tab 1', elements: [], folder: 'Ideas' };

describe('designToEnvelopeText', () => {
  it('wraps the design and its tabs with folders in a livedesign.design envelope', () => {
    const text = designToEnvelopeText({ id: 'd1', name: 'Plan' }, [tab], 42);
    expect(JSON.parse(text)).toEqual({
      kind: DESIGN_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 42,
      design: { id: 'd1', name: 'Plan', tabs: [tab] },
    });
  });

  it('is byte-identical for identical input, so md5 only moves when content does', () => {
    const a = designToEnvelopeText({ id: 'd', name: 'n' }, [tab], 1);
    const b = designToEnvelopeText({ id: 'd', name: 'n' }, [tab], 1);
    expect(a).toBe(b);
  });
});

describe('parseDesignEnvelope', () => {
  it('round-trips', () => {
    const text = designToEnvelopeText({ id: 'd1', name: 'Plan' }, [tab], 7);
    const parsed = parseDesignEnvelope(text);
    expect(parsed).toEqual({ ok: true, envelope: JSON.parse(text) as unknown });
  });

  it('names each failure', () => {
    expect(parseDesignEnvelope('nope')).toEqual({ ok: false, failure: 'not_json' });
    expect(parseDesignEnvelope('{"kind":"livedesign.tab","schemaVersion":1}')).toEqual({
      ok: false,
      failure: 'wrong_kind',
    });
    expect(parseDesignEnvelope('{"kind":"livedesign.design","schemaVersion":2}')).toEqual({
      ok: false,
      failure: 'unsupported_version',
    });
    expect(
      parseDesignEnvelope(
        '{"kind":"livedesign.design","schemaVersion":1,"design":{"id":"d","name":"n","tabs":[{"id":1}]}}',
      ),
    ).toEqual({ ok: false, failure: 'malformed' });
    expect(parseDesignEnvelope('null')).toEqual({ ok: false, failure: 'malformed' });
  });

  // docs/specs/012-collaboration/presentation-mode.md "Saved data": a file written while livedesign had slide
  // decks still reads, its deck left behind.
  it('reads an older file that carries a slide deck, without the deck', () => {
    const older = {
      kind: DESIGN_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 1,
      design: { id: 'd', name: 'n', presentation: '{"decks":[{"slides":[]}]}', tabs: [tab] },
    };
    expect(parseDesignEnvelope(JSON.stringify(older))).toEqual({
      ok: true,
      envelope: { ...older, design: { id: 'd', name: 'n', tabs: [tab] } },
    });
  });
});
