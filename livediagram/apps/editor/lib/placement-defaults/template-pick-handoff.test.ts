// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { handTemplatePick, readTemplatePick, takeTemplatePick } from './template-pick-handoff';

// docs/specs/013-workspace/default-folders.md "A template picked after creation"
afterEach(() => sessionStorage.clear());

describe('the template pick handoff', () => {
  const handoff = { documentId: 'd', tabId: 't', placementChosen: false };

  it('is read back as written, and cleared by null', () => {
    handTemplatePick(handoff);
    expect(readTemplatePick()).toEqual(handoff);
    handTemplatePick(null);
    expect(readTemplatePick()).toBeNull();
  });

  it('is taken once, for its own document and first tab', () => {
    handTemplatePick(handoff);
    expect(takeTemplatePick('other', 't')).toBeNull();
    expect(readTemplatePick()).toEqual(handoff);
    expect(takeTemplatePick('d', 't')).toEqual(handoff);
    expect(takeTemplatePick('d', 't')).toBeNull();
  });

  it('is spent by a pick on another tab of its document', () => {
    handTemplatePick(handoff);
    expect(takeTemplatePick('d', 'second-tab')).toBeNull();
    expect(readTemplatePick()).toBeNull();
  });

  it('reads junk as none', () => {
    sessionStorage.setItem('livediagram:v2:template-pick-handoff', '{"documentId":3}');
    expect(readTemplatePick()).toBeNull();
    sessionStorage.setItem('livediagram:v2:template-pick-handoff', 'nope');
    expect(readTemplatePick()).toBeNull();
  });
});
