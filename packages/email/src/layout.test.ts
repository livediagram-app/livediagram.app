import { describe, expect, it } from 'vitest';
import {
  createEmailLayout,
  MENTION_QUOTE_CHARS,
  mentionQuote,
  notificationSettingsUrl,
  subjectText,
} from './layout';

const layout = createEmailLayout({
  brand: '#111111',
  wordmarkAccent: '#222222',
  bandGradient: 'linear-gradient(90deg,#333 0%,#444 100%)',
  canvas: '#555555',
  logoPath: '/email/test-mark-64.png',
  wordmarkTail: 'test',
  tagline: 'Test together, live.',
  accountFooter: 'Default footer.',
});

describe('the shared email layout', () => {
  it('draws the brand, both lockups, the tagline and the default footer', () => {
    const html = layout.shell('https://www.example.app', { heading: 'Hi', intro: 'Intro' });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('background:#555555');
    expect(html).toContain('background-color:#111111;background-image:linear-gradient');
    expect(html.match(/<span style="color:#222222">live<\/span>test/g)).toHaveLength(2);
    expect(html).toContain('src="https://www.example.app/email/test-mark-64.png" width="28"');
    expect(html).toContain('width="22" height="22"');
    expect(html).toContain('Test together, live. <a href="https://www.example.app"');
    expect(html).toContain('>www.example.app</a>');
    expect(html).toContain('Default footer.');
    expect(html).toContain('overflow:hidden">Intro</span>');
    expect(html).not.toContain('<ul');
    expect(html).not.toContain('border-radius:8px;background');
  });

  it('draws the points, outro, button, preheader and a footer of its own', () => {
    const html = layout.shell('https://x.app', {
      heading: 'H',
      intro: 'I',
      preheader: 'Pre',
      points: ['one', 'two'],
      outro: 'Out',
      ctaText: 'Go',
      ctaHref: 'https://x.app/go',
      footer: 'Own footer.',
    });
    expect(html).toContain('overflow:hidden">Pre</span>');
    expect(html.match(/<li /g)).toHaveLength(2);
    expect(html).toContain('line-height:1.6">Out</p>');
    expect(html).toContain('<a href="https://x.app/go"');
    expect(html).toContain('Own footer.');
    expect(html).not.toContain('Default footer.');
  });

  it('links the notification settings from the footer', () => {
    expect(notificationSettingsUrl('https://x.app')).toBe(
      'https://x.app/explorer?settings=notifications',
    );
    expect(layout.manageNotificationsFooter('https://x.app', 'Because.')).toBe(
      'Because. <a href="https://x.app/explorer?settings=notifications" style="color:#111111;text-decoration:underline">Manage your notifications</a> to turn these off.',
    );
  });

  it('flattens a subject name to one short line', () => {
    expect(subjectText('a\r\nb')).toBe('a b');
    expect(subjectText('x'.repeat(100))).toHaveLength(80);
    // Never half an emoji at the cut.
    expect(subjectText(`x${'😀'.repeat(50)}`)).toBe(`x${'😀'.repeat(39)}`);
  });

  it('cuts a mention quote at a word', () => {
    expect(mentionQuote('  a   b  ')).toBe('a b');
    const words = mentionQuote('word '.repeat(100));
    expect(words.endsWith('word…')).toBe(true);
    expect(words.length).toBeLessThanOrEqual(MENTION_QUOTE_CHARS + 1);
    expect(mentionQuote('x'.repeat(400))).toBe(`${'x'.repeat(MENTION_QUOTE_CHARS)}…`);
    expect(mentionQuote(`x${'😀'.repeat(200)}`)).toBe(`x${'😀'.repeat(139)}…`);
  });
});
