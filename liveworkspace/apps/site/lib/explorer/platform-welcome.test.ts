import type { WelcomeManifest, WelcomeStart } from '@liveworkspace/explorer';
import type { AppName } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { platformWelcome } from './welcome';

const start = (id: string, name = id): WelcomeStart => ({ id, name, href: `/${id}` });
const manifest = (
  name: string,
  blanks: WelcomeStart[],
  popular: WelcomeStart[],
  fan: string[],
): WelcomeManifest => ({
  name,
  pillFree: `${name} pill`,
  blanks,
  popular,
  fan,
  startBlankHref: `/${name}/new`,
  allTemplatesHref: `/${name}/templates`,
  searchHref: (w) => `/${name}?q=${w}`,
});

const apps: { app: AppName; manifest: WelcomeManifest }[] = [
  {
    app: 'livediagram',
    manifest: manifest(
      'livediagram',
      [start('d', 'Blank Diagram')],
      [start('flow'), start('mind')],
      ['flow'],
    ),
  },
  {
    app: 'liveplanner',
    manifest: manifest('liveplanner', [start('p', 'Blank Plan')], [start('kanban')], ['kanban']),
  },
  {
    app: 'livedocuments',
    manifest: manifest(
      'livedocuments',
      [start('i', 'Blank Illustration'), start('s', 'Blank Slide Deck')],
      [start('deck'), start('poster'), start('year')],
      ['deck'],
    ),
  },
  {
    app: 'livedesign',
    manifest: manifest(
      'livedesign',
      [start('i', 'Blank Illustration'), start('l', 'Blank Logo')],
      [start('logo')],
      ['logo'],
    ),
  },
];

describe("liveworkspace.app's welcome in no app", () => {
  const home = apps[1]!.manifest;
  const shown = platformWelcome(apps, home);

  it('greets to liveworkspace, keeping the home app’s wizard and search', () => {
    expect(shown.name).toBe('liveworkspace');
    expect(shown.startBlankHref).toBe('/liveplanner/new');
    expect(shown.pillFree).toBe('liveplanner pill');
  });

  it('offers one blank per app, none whose name two apps share', () => {
    expect(shown.blanks.map((b) => b.name)).toEqual([
      'Blank Diagram',
      'Blank Plan',
      'Blank Slide Deck',
      'Blank Logo',
    ]);
  });

  it("takes the apps' popular starts in turn, each id carrying its app", () => {
    expect(shown.popular.map((p) => p.id)).toEqual([
      'livediagram:flow',
      'liveplanner:kanban',
      'livedocuments:deck',
      'livedesign:logo',
      'livediagram:mind',
      'livedocuments:poster',
      'livedocuments:year',
    ]);
  });

  it('fans the first three apps’ fronts', () => {
    expect(shown.fan).toEqual(['livediagram:flow', 'liveplanner:kanban', 'livedocuments:deck']);
  });
});
