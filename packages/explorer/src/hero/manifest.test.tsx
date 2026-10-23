import { describe, expect, it } from 'vitest';
import { heroArtManifest, heroArtNodeOf } from './manifest';

describe('the hero manifest', () => {
  it("draws a picture's markup as data, with React's prop names", () => {
    expect(
      heroArtNodeOf(
        <div
          className="a b"
          style={{ backgroundColor: '#fff', ['--x' as string]: '1' }}
          aria-hidden
        >
          <svg viewBox="0 0 10 10" strokeWidth={2}>
            <rect data-k="r" width="4" />
          </svg>
          text
        </div>,
      ),
    ).toEqual([
      'div',
      { className: 'a b', style: { backgroundColor: '#fff', '--x': '1' }, 'aria-hidden': 'true' },
      ['svg', { viewBox: '0 0 10 10', strokeWidth: '2' }, ['rect', { 'data-k': 'r', width: '4' }]],
      'text',
    ]);
  });

  it('takes one element per picture', () => {
    expect(() =>
      heroArtNodeOf(
        <>
          <i />
          <b />
        </>,
      ),
    ).toThrow('a picture is one element');
    expect(() => heroArtNodeOf(null)).toThrow('a picture is one element');
  });

  it('names the app, its label and each sheet in both looks', () => {
    const m = heroArtManifest('liveplanner', 'What a plan can hold', [
      { id: 'board', label: 'Board', light: <span className="l" />, dark: <span className="d" /> },
    ]);
    expect(m).toEqual({
      app: 'liveplanner',
      label: 'What a plan can hold',
      sheets: [
        {
          id: 'board',
          label: 'Board',
          light: ['span', { className: 'l' }],
          dark: ['span', { className: 'd' }],
        },
      ],
    });
  });
});
