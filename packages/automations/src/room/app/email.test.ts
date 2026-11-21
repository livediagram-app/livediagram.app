import { describe, expect, it } from 'vitest';
import { itemAutomationAddressEmail, itemAutomationEmail, type ItemEmailLook } from './email';

const look = (noun = 'canvas'): ItemEmailLook => ({
  shell: (s) => JSON.stringify(s),
  manageNotificationsFooter: (reason) => `[${reason}]`,
  profileUrl: 'https://app.example/profile',
  noun,
  product: 'liveexample',
  linkColour: '#0ea5e9',
});
const input = {
  subject: 'Weekly <update>',
  body: 'Line one\r\nLine <two>',
  rule: 'Friday & co',
  itemName: 'Launch <Plan>',
  url: 'https://app.example/d/1',
};

describe('a rule’s email to a person', () => {
  it('is the rule’s own words, escaped, in the app’s shell', () => {
    const mail = itemAutomationEmail(look(), input);
    expect(mail.kind).toBe('AutomationEmail');
    expect(mail.subject).toBe('Weekly <update>');
    expect(mail.unsubscribeUrl).toBe('https://app.example/profile');
    const section = JSON.parse(mail.html) as Record<string, string>;
    expect(section['heading']).toBe('Weekly &lt;update&gt;');
    expect(section['intro']).toBe('Line one<br>Line &lt;two&gt;');
    expect(section['outro']).toBe(
      'Sent by the rule <strong>Friday &amp; co</strong> in <strong>Launch &lt;Plan&gt;</strong>.',
    );
    expect(section['ctaText']).toBe('Open the canvas');
    expect(section['ctaHref']).toBe(input.url);
    expect(section['footer']).toBe(
      '[You’re receiving this because a rule in a canvas you work on sends it.]',
    );
  });

  it('falls back to the rule’s name for no subject or body, and to the noun for no name', () => {
    const mail = itemAutomationEmail(look('item'), {
      ...input,
      subject: ' ',
      body: '',
      itemName: ' ',
    });
    expect(mail.subject).toBe('Friday & co');
    const section = JSON.parse(mail.html) as Record<string, string>;
    expect(section['intro']).toBe('Friday &amp; co');
    expect(section['outro']).toContain('<strong>an item</strong>');
    expect(section['footer']).toContain('a rule in an item you work on');
  });
});

describe('a rule’s email to a typed-in address', () => {
  it('says which rule, which item and why, with its own unsubscribe', () => {
    const mail = itemAutomationAddressEmail(look('document'), {
      ...input,
      unsubscribeUrl: 'https://app.example/api/email-optout/d1/tok',
      unsubscribePage: 'https://app.example/email-optout?d=d1&t=tok',
    });
    expect(mail.oneClick).toBe(true);
    expect(mail.unsubscribeUrl).toBe('https://app.example/api/email-optout/d1/tok');
    const section = JSON.parse(mail.html) as Record<string, string>;
    expect(section['outro']).toBe(
      'Sent by the rule <strong>Friday &amp; co</strong> in the document <strong>Launch &lt;Plan&gt;</strong> on liveexample. You got this because an Editor of the document added your address to the rule.',
    );
    expect(section['footer']).toBe(
      'Don’t want these? <a href="https://app.example/email-optout?d=d1&amp;t=tok" style="color:#0ea5e9;text-decoration:underline">Stop emails from this document’s rules</a>.',
    );
    const bare = itemAutomationAddressEmail(look(), {
      ...input,
      subject: '',
      body: '',
      unsubscribeUrl: 'u',
      unsubscribePage: 'p',
    });
    expect(bare.subject).toBe('Friday & co');
    expect((JSON.parse(bare.html) as Record<string, string>)['intro']).toBe('Friday &amp; co');
  });
});
