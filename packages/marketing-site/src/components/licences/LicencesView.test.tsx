import type { LicencesManifest } from '@liveworkspace/licences';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LicencesView } from './LicencesView';

const manifest: LicencesManifest = {
  schemaVersion: 1,
  sections: [
    {
      side: 'browser',
      apps: [
        { id: 'editor', label: 'Editor' },
        { id: 'marketing', label: 'Website' },
      ],
      works: [
        {
          anchor: 'browser-next-16-3-6',
          kind: 'package',
          name: 'next',
          version: '16.3.6',
          licence: 'MIT',
          homepage: 'https://nextjs.org/',
          apps: ['editor', 'marketing'],
          texts: [{ label: 'license.md', hash: 'aaaaaaaaaaaaaaaa' }],
        },
        {
          anchor: 'browser-xnnpack-5e8033a',
          kind: 'embedded',
          name: 'XNNPACK',
          version: '5e8033a',
          licence: 'BSD-3-Clause',
          carrier: '@tensorflow/tfjs-backend-wasm (WebAssembly)',
          apps: ['editor'],
          texts: [{ label: 'LICENSE', hash: 'bbbbbbbbbbbbbbbb' }],
        },
      ],
    },
    { side: 'server', apps: [{ id: 'api', label: 'API' }], works: [] },
  ],
  texts: {
    aaaaaaaaaaaaaaaa: { lines: 4, bytes: 100 },
    bbbbbbbbbbbbbbbb: { lines: 300, bytes: 9000 },
  },
};

const html = renderToStaticMarkup(
  <LicencesView
    manifest={manifest}
    title="Open-source licences"
    lede="livediagram is built on the work of many open-source projects."
    browserIntro="Sent to your browser by the editor, this website and the help centre."
  />,
);

describe('LicencesView', () => {
  it('titles the page and names both sections with their counts', () => {
    expect(html).toContain('<h1');
    expect(html).toContain('Open-source licences');
    expect(html).toMatch(/<h2[^>]*>In your browser<\/h2>/);
    expect(html).toMatch(/<h2[^>]*>On our servers<\/h2>/);
    expect(html).toContain('Sent to your browser by the editor, this website and the help centre.');
    expect(html).toContain('2 works');
    expect(html).toContain('0 works');
  });

  it('says what runs the server side, the product’s services unless the site names its own', () => {
    expect(html).toContain('Bundled into the API, MCP server and router');
    const own = renderToStaticMarkup(
      <LicencesView
        manifest={manifest}
        title="Third-party licences"
        lede="liveworkspace.app"
        browserIntro="Sent to your browser by this website."
        serverIntro="Bundled into the accounts service."
      />,
    );
    expect(own).toContain('Bundled into the accounts service.');
    expect(own).not.toContain('MCP server');
  });

  it('renders each work as a collapsed disclosure anchored for deep links', () => {
    expect(html).toContain('<details id="browser-next-16-3-6"');
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(html).toMatch(/<summary[^>]*><h3[^>]*>next<\/h3>/);
    expect(html).toContain('16.3.6');
    expect(html).toContain('BSD-3-Clause');
  });

  it('names the apps that ship each work', () => {
    expect(html).toMatch(/Ships in <\/span>[\s\S]*Editor[\s\S]*Website/);
  });

  it('says what carries a vendored or embedded work and links a safe source', () => {
    expect(html).toContain('Inside @tensorflow/tfjs-backend-wasm (WebAssembly).');
    expect(html).toContain('href="https://nextjs.org/"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('links every text as plain text and holds none inline', () => {
    expect(html).toContain('href="/licences/texts/aaaaaaaaaaaaaaaa.txt"');
    expect(html).toContain('href="/licences/texts/bbbbbbbbbbbbbbbb.txt"');
    expect(html).not.toContain('Permission is hereby granted');
  });

  it('sizes each text box from its line count, capped, before anything loads', () => {
    expect(html).toContain('height:calc(5rem + 1.5rem + 2px)');
    expect(html).toContain('height:calc(30rem + 1.5rem + 2px)');
  });

  it('says so when a section has nothing', () => {
    expect(html).toContain('Nothing third-party ships here.');
  });
});
