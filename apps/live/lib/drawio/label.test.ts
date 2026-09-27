// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readLabel } from './label';

describe('readLabel, plain', () => {
  it('keeps plain text and its newlines', () => {
    expect(readLabel('Line 1\r\nLine <2>', false)).toEqual({ plain: 'Line 1\nLine <2>' });
  });
});

describe('readLabel, html', () => {
  it('keeps unformatted HTML as plain text', () => {
    expect(readLabel('Payments settle within<br>two working days.', true)).toEqual({
      plain: 'Payments settle within\ntwo working days.',
    });
    expect(readLabel('A &amp; B', true)).toEqual({ plain: 'A & B' });
  });

  it('turns tags into formatted runs', () => {
    expect(readLabel('Validate <b>payment</b>', true)).toEqual({
      plain: 'Validate payment',
      runs: [{ text: 'Validate ' }, { text: 'payment', bold: true }],
    });
  });

  it('reads inline CSS formatting', () => {
    const r = readLabel(
      '<span style="font-weight: 700; font-style: italic">a</span><span style="text-decoration: underline line-through; color: rgb(255, 0, 0)">b</span><strike>c</strike>',
      true,
    );
    expect(r.runs).toEqual([
      { text: 'a', bold: true, italic: true },
      { text: 'b', underline: true, strikethrough: true, color: '#ff0000' },
      { text: 'c', strikethrough: true },
    ]);
  });

  it('breaks lines at blocks and collapses whitespace like a browser', () => {
    expect(readLabel('<div>  a \n  b </div><div>c</div>', true).plain).toBe('a b\nc');
    expect(readLabel('<p>a</p><br><br><br><p>b</p>', true).plain).toBe('a\n\nb');
    expect(readLabel('a&nbsp;&nbsp;b', true).plain).toBe('a  b');
    expect(readLabel('<br>top<br><br>', true).plain).toBe('top');
  });

  it('writes lists, headings and links', () => {
    const r = readLabel(
      '<h2>Release plan</h2><ul><li><b>Beta</b> in May</li><li><i>GA</i> in <font color="#b85450">June</font></li></ul><ol><li>one</li><li>two</li></ol><div>See <a href="https://example.com/plan">the plan</a></div>',
      true,
    );
    expect(r.plain).toBe('Release plan\n• Beta in May\n• GA in June\n1. one\n2. two\nSee the plan');
    expect(r.runs).toContainEqual({ text: 'Release plan', heading: 2 });
    expect(r.runs).toContainEqual({ text: 'Beta', bold: true });
    expect(r.runs).toContainEqual({ text: 'June', color: '#b85450' });
    expect(r.runs).toContainEqual({ text: 'the plan', link: 'https://example.com/plan' });
  });

  it('drops links with schemes livediagram does not follow', () => {
    expect(readLabel('<a href="javascript:alert(1)">x</a>', true)).toEqual({ plain: 'x' });
    expect(readLabel('<a href="mailto:a@b.test">m</a>', true).runs).toEqual([
      { text: 'm', link: 'mailto:a@b.test' },
    ]);
  });

  it('lays table cells out with tabs, one row per line', () => {
    expect(
      readLabel('<table><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>', true).plain,
    ).toBe('a\tb\nc');
  });

  it('never runs scripts or loads images', () => {
    const r = readLabel(
      '<img src="x" onerror="globalThis.hacked=1"><script>globalThis.hacked=1</script>ok',
      true,
    );
    expect(r.plain).toBe('ok');
    expect((globalThis as { hacked?: number }).hacked).toBeUndefined();
  });

  it('is empty for an empty label', () => {
    expect(readLabel('', true)).toEqual({ plain: '' });
  });
});
