import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AppNote,
  AppNotesFold,
  findAppNotes,
  notedApps,
  noteApps,
  noteOpenIn,
  SameIn,
} from './AppNote';
import { cardAppsLabel } from './CategoryCard';
import { AppName, appliesToLine, Noun, TabWord } from './ScopeWords';
import { rowOrder } from './AppMarks';

// liveworkspace/docs/specs/017-help/help-centre.md "Articles and the apps they apply to".

describe('app notes', () => {
  it('reads one app, a comma list or a list, each once', () => {
    expect(noteApps({ app: 'liveplanner' })).toEqual(['liveplanner']);
    expect(noteApps({ app: 'livediagram, liveplanner' })).toEqual(['livediagram', 'liveplanner']);
    expect(noteApps({ apps: ['livedesign', 'livedesign'] })).toEqual(['livedesign']);
    expect(() => noteApps({ app: 'liveworkspace' })).toThrow(/not an app id/);
    expect(() => noteApps({})).toThrow(/names no app/);
  });

  it("opens a note in its apps' helps and under All Apps, and hides it elsewhere", () => {
    expect(noteOpenIn(['livediagram', 'liveplanner'], 'liveplanner')).toBe(true);
    expect(noteOpenIn(['livediagram'], 'all')).toBe(true);
    expect(noteOpenIn(['livediagram'], 'livedesign')).toBe(false);
    const html = (scope: Parameters<typeof AppNote>[0]['scope']) =>
      renderToStaticMarkup(
        <AppNote app="livediagram,liveplanner" scope={scope}>
          <p>Only here.</p>
        </AppNote>,
      );
    expect(html('liveplanner')).toContain('In livediagram and liveplanner');
    expect(html('livedesign')).toBe('');
  });

  it('finds notes anywhere in the body, and folds the ones for other apps', () => {
    const body = (
      <>
        <p>Shared.</p>
        <ul>
          <li>
            <AppNote app="livedocuments">Docs.</AppNote>
          </li>
        </ul>
        <AppNote app="livediagram,livedesign">Both.</AppNote>
      </>
    );
    const notes = findAppNotes(body);
    expect(notes.map((n) => n.apps)).toEqual([['livedocuments'], ['livediagram', 'livedesign']]);
    expect(notedApps(notes)).toEqual(['livediagram', 'livedocuments', 'livedesign']);
    const fold = renderToStaticMarkup(<AppNotesFold notes={notes} scope="livediagram" />);
    expect(fold).toContain('How this works in livedocuments');
    expect(renderToStaticMarkup(<AppNotesFold notes={notes} scope="liveplanner" />)).toContain(
      'How this works in 3 other apps',
    );
    expect(renderToStaticMarkup(<SameIn apps={['liveplanner', 'livehuddle']} />)).toContain(
      'Works the same in liveplanner and livehuddle.',
    );
  });
});

describe('scope words', () => {
  it("names the scope's work and app", () => {
    expect(renderToStaticMarkup(<Noun scope="livedesign" plural capital />)).toBe('Designs');
    expect(renderToStaticMarkup(<Noun scope="all" />)).toBe('file');
    // A knowledgebase's tabs are pages (automations.md "Naming"); every other scope's are tabs.
    expect(renderToStaticMarkup(<TabWord scope="liveknowledge" plural capital />)).toBe('Pages');
    expect(renderToStaticMarkup(<TabWord scope="liveknowledge" />)).toBe('page');
    expect(renderToStaticMarkup(<TabWord scope="livedocuments" />)).toBe('tab');
    expect(renderToStaticMarkup(<TabWord scope="all" capital />)).toBe('Tab');
    expect(renderToStaticMarkup(<AppName scope="livehuddle" />)).toBe('livehuddle');
  });

  it('puts the current app first and says every app for all six', () => {
    expect(rowOrder(['livediagram', 'livedesign'], 'livedesign')).toEqual([
      'livedesign',
      'livediagram',
    ]);
    expect(appliesToLine(['livediagram', 'livedesign'], 'livedesign')).toBe(
      'livedesign and livediagram',
    );
    expect(
      appliesToLine(
        [
          'livediagram',
          'liveplanner',
          'livedocuments',
          'livedesign',
          'livehuddle',
          'liveknowledge',
        ],
        'all',
      ),
    ).toBe('Every liveworkspace app');
    expect(cardAppsLabel([1, 2])).toBe('2 apps');
    expect(cardAppsLabel([1, 2, 3, 4])).toBe('+1');
    expect(cardAppsLabel([1, 2, 3, 4, 5])).toBe('+2');
    expect(cardAppsLabel([1, 2, 3, 4, 5, 6])).toBe('All apps');
  });
});
