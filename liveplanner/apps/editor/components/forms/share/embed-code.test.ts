import { describe, expect, it } from 'vitest';
import { EMBED_HEIGHT_DEFAULT, embedCode } from './embed-code';

// Share Form's Embed (docs/specs/030-forms/forms.md "Publishing and the form link").

describe('embedCode', () => {
  it('frames the link at the height picked, Medium by default', () => {
    expect(EMBED_HEIGHT_DEFAULT).toBe('medium');
    expect(embedCode('https://x.test/form/abc', 'RSVP', 'short')).toBe(
      '<iframe src="https://x.test/form/abc" title="RSVP" width="100%" height="520" style="border:0;max-width:640px" loading="lazy"></iframe>',
    );
  });

  it('escapes the heading and link, and names an untitled form', () => {
    const code = embedCode('https://x.test/form/a?q.q-1=a&b', '"><script>', 'tall');
    expect(code).toContain('src="https://x.test/form/a?q.q-1=a&amp;b"');
    expect(code).toContain('title="&quot;&gt;&lt;script&gt;"');
    expect(code).not.toContain('<script>');
    expect(embedCode('https://x.test/form/a', '  ', 'medium')).toContain('title="Form"');
  });
});
