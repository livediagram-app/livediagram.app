import { describe, expect, it } from 'vitest';
import {
  copyDesignEnvelope,
  DESIGN_ENVELOPE_KIND,
  designToEnvelopeText,
  parseDesignEnvelope,
  type EnvelopeTab,
} from './design-envelope';

// The `.livedesign` file's contents.

const tab: EnvelopeTab = { id: 't1', name: 'Tab 1', elements: [], folder: 'Ideas' };

describe('designToEnvelopeText', () => {
  it('wraps the design, its tabs with folders, and the deck in a livedesign.design envelope', () => {
    const text = designToEnvelopeText(
      { id: 'd1', name: 'Plan', presentation: '{"slides":[]}' },
      [tab],
      42,
    );
    expect(JSON.parse(text)).toEqual({
      kind: DESIGN_ENVELOPE_KIND,
      schemaVersion: 1,
      exportedAt: 42,
      design: { id: 'd1', name: 'Plan', presentation: '{"slides":[]}', tabs: [tab] },
    });
  });

  it('is byte-identical for identical input, so md5 only moves when content does', () => {
    const a = designToEnvelopeText({ id: 'd', name: 'n', presentation: null }, [tab], 1);
    const b = designToEnvelopeText({ id: 'd', name: 'n', presentation: null }, [tab], 1);
    expect(a).toBe(b);
  });
});

describe('parseDesignEnvelope', () => {
  it('round-trips', () => {
    const text = designToEnvelopeText({ id: 'd1', name: 'Plan', presentation: null }, [tab], 7);
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

  it('reads a missing deck as none', () => {
    const parsed = parseDesignEnvelope(
      '{"kind":"livedesign.design","schemaVersion":1,"exportedAt":1,"design":{"id":"d","name":"n","tabs":[]}}',
    );
    expect(parsed.ok && parsed.envelope.design.presentation).toBeNull();
  });
});

describe('copyDesignEnvelope', () => {
  it('mints fresh tab ids and re-points tab links and the deck at them', () => {
    const text = designToEnvelopeText(
      {
        id: 'D',
        name: 'Logo',
        presentation: JSON.stringify({ decks: [{ slides: [{ id: 's', tabId: 't2', elementIds: [] }] }] }),
      },
      [
        {
          id: 't1',
          name: 'One',
          elements: [
            { id: 'b', type: 'shape', shape: 'square', x: 0, y: 0, width: 1, height: 1, link: { kind: 'tab', tabId: 't2' } },
          ] as EnvelopeTab['elements'],
        },
        { id: 't2', name: 'Two', elements: [] },
      ],
      1,
    );
    const parsed = parseDesignEnvelope(text);
    if (!parsed.ok) throw new Error(parsed.failure);
    const { tabs, presentation } = copyDesignEnvelope(parsed.envelope);
    expect(tabs.map((t) => t.id)).not.toContain('t1');
    const second = tabs[1]!.id;
    expect((tabs[0]!.elements[0] as { link?: { tabId: string } }).link?.tabId).toBe(second);
    expect(presentation).toContain(`"tabId":"${second}"`);
  });

  it('drops an unreadable deck', () => {
    const parsed = parseDesignEnvelope(
      designToEnvelopeText({ id: 'D', name: 'L', presentation: '{nope' }, [tab], 1),
    );
    if (!parsed.ok) throw new Error(parsed.failure);
    expect(copyDesignEnvelope(parsed.envelope).presentation).toBeNull();
  });
});
