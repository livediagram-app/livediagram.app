import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP_SITES } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { metadata as root } from './layout';
import manifest from './manifest';
import { metadata as privacy } from './privacy/page';
import { metadata as terms } from './terms/page';

// Every place the site names all the apps names every listed app (liveworkspace/docs/specs/010-site/site.md "Privacy
// and terms" and "Help"), so launching one can't leave the privacy policy, the terms, the site's description, its
// install manifest or the Drive help a name short, as happened when livehuddle launched.

const NAMES = APP_SITES.map((site) => site.name);

// A page's source as the words it shows: JSX spacers, tags and entities out, whitespace collapsed.
function words(path: string): string {
  return readFileSync(resolve(__dirname, path), 'utf8')
    .replace(/\{' '\}/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&rsquo;/g, '’')
    .replace(/&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ');
}

function namesEvery(text: string | null | undefined, form: (name: string) => string = (n) => n) {
  for (const name of NAMES) expect(text ?? '', name).toContain(form(name));
}

describe('lists of the apps', () => {
  it('covers five apps today', () => {
    expect(NAMES).toEqual([
      'livediagram',
      'liveplanner',
      'livedocuments',
      'livedesign',
      'livehuddle',
    ]);
  });

  it('the site’s description and its install manifest name every app', () => {
    namesEvery(root.description);
    namesEvery(manifest().description);
  });

  it('the privacy policy’s and the terms’ descriptions name every app, in each card', () => {
    for (const meta of [privacy, terms]) {
      namesEvery(meta.description);
      namesEvery((meta.openGraph as { description?: string }).description);
      namesEvery((meta.twitter as { description?: string }).description);
    }
  });

  it('the terms name every hosted app and every app’s source', () => {
    const text = words('terms/page.tsx');
    namesEvery(/the hosted apps (.*?) \(together/.exec(text)?.[1], (n) => `${n}.app`);
    namesEvery(/source code \((.*?)\) is public/.exec(text)?.[1]);
  });

  it('the privacy policy has a part for every app under App by app', () => {
    const source = readFileSync(resolve(__dirname, 'privacy/page.tsx'), 'utf8');
    for (const site of APP_SITES) expect(source, site.id).toContain(`app: '${site.id}'`);
  });

  it('the Drive help names every app’s file extension', () => {
    const text = words('help/google-drive/page.tsx');
    namesEvery(/its app's extension \((.*?)\) and a/.exec(text)?.[1], (n) => `.${n}`);
  });
});
