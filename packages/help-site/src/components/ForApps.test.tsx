import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ForApps, NotFor, showsFor } from './ForApps';

describe('ForApps and NotFor', () => {
  it('shows ForApps text only in the named apps, and everywhere under All Apps', () => {
    const html = (scope: Parameters<typeof ForApps>[0]['scope']) =>
      renderToStaticMarkup(
        <p>
          A{' '}
          <ForApps scope={scope} app="livediagram,livehuddle">
            tab
          </ForApps>{' '}
          word
        </p>,
      );
    expect(html('livediagram')).toBe('<p>A tab word</p>');
    expect(html('liveknowledge')).toBe('<p>A  word</p>');
    expect(html('all')).toBe('<p>A tab word</p>');
    expect(html(undefined)).toBe('<p>A tab word</p>');
  });

  it('hides NotFor text only from the named apps, with no wrapper element', () => {
    const html = (scope: Parameters<typeof NotFor>[0]['scope']) =>
      renderToStaticMarkup(
        <p>
          Move it
          <NotFor scope={scope} app="liveknowledge">
            {' to another one'}
          </NotFor>
          .
        </p>,
      );
    expect(html('liveknowledge')).toBe('<p>Move it.</p>');
    expect(html('livediagram')).toBe('<p>Move it to another one.</p>');
    expect(html('all')).toBe('<p>Move it to another one.</p>');
  });

  it('refuses a name that is not an app', () => {
    expect(() =>
      renderToStaticMarkup(
        <ForApps scope="livediagram" app="livetypo">
          x
        </ForApps>,
      ),
    ).toThrow();
    expect(showsFor(['livedesign'], 'livedesign')).toBe(true);
  });
});
