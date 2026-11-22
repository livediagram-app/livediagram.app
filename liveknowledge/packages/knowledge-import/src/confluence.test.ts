// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { archiveOf } from './__fixtures__/archive';
import { titleOfConfluenceFile } from './confluence';
import { planImport } from './plan';

const page = (body: string, extra = '') =>
  `<!DOCTYPE html><html><head><title>ENG : Page</title></head><body>${extra}<div id="main-content">${body}</div></body></html>`;

const INDEX = `<html><body><h1>Space Details</h1><div class="pageSection"><ul>
  <li><a href="Home_1.html">Home</a>
    <ul>
      <li><a href="Release-Process_98765.html">Release  Process</a></li>
      <li><span>No link here</span><ol><li><span><a href="Deep_3.html">Deep</a></span></li></ol></li>
      <li>Plain words</li>
      <li><a href="../../outside.html">Out of the archive</a></li>
      <li><a href="Home_1.html">Home again</a></li>
    </ul>
  </li>
</ul></div></body></html>`;

const HOME = page(
  `<h1>Welcome</h1><h2></h2>
  <p>Read the <a href="Release-Process_98765.html">release <b>process</b></a>, ask
    <a class="confluence-userlink user-mention" href="/people/42">Ada Lovelace</a>, or see
    <a href="https://example.com/a b">the site</a>, <a href="#top">the top</a>, <a>nothing</a> and <a href="x.html"></a>.<br>
    <strong>Bold</strong> <em>soft</em> <code>npm  run</code> <del>old</del> <b> </b> <span>plain [text]</span><!-- a comment --></p>
  <p></p>
  <ul><li>One<ol><li>First</li><li><p>Second</p></li></ol></li><li>Two</li><div>stray</div></ul>
  <table><tbody><tr><th>Name</th><th>Owner</th></tr><tr><td>A | B</td><td><p>Ada</p><p>Bob</p></td></tr><tr><td>Short</td></tr></tbody></table>
  <table></table>
  <div class="code panel pdl"><div class="codeContent panelContent pdl"><pre class="syntaxhighlighter-pre" data-syntaxhighlighter-params="brush: bash; gutter: false">pnpm install
pnpm test
</pre></div></div>
  <pre><code class="language-ts">const a = 1;</code></pre>
  <pre>fence \`\`\` inside</pre>
  <div class="confluence-information-macro confluence-information-macro-information"><span class="aui-icon"></span><div class="confluence-information-macro-body"><p>Deploys run on Tuesdays.</p><p>Not Fridays.</p></div></div>
  <div class="confluence-information-macro confluence-information-macro-warning"><div class="confluence-information-macro-body"><ul><li>Back up first</li></ul></div></div>
  <div class="confluence-information-macro confluence-information-macro-note"><p>Mind the gap.</p></div>
  <div class="confluence-information-macro confluence-information-macro-tip"><p>Use the script.</p></div>
  <div class="confluence-information-macro confluence-information-macro-custom"></div>
  <blockquote><p>Quoted</p><p>Twice</p></blockquote><blockquote></blockquote>
  <hr>
  <p><img src="attachments/1/diagram one.png" alt="The [diagram]"> <img class="emoticon" src="images/icons/smile.png" alt="(smile)"> <img alt="no source"> <img src="attachments/1/gone.png"></p>
  Loose text <i>here</i>
  <section><p>In a section</p></section>`,
  `<div id="breadcrumb-section"><ol id="breadcrumbs"><li class="first"><a href="index.html">Engineering</a></li></ol></div>
   <h1 id="title-heading"><span id="title-text">Engineering : Home Page</span></h1>`,
);

const exported = () =>
  archiveOf({
    'index.html': INDEX,
    'Home_1.html': HOME.replace(
      '</body>',
      `<div class="pageSection"><h2 id="attachments">Attachments:</h2><div class="greybox">
          <a href="attachments/1/spec.pdf">spec.pdf</a> <a href="attachments/1/diagram%20one.png">diagram one.png</a>
          <a href="attachments/1/missing.pdf">missing.pdf</a> <a href="https://example.com/attachments/x.pdf">far</a></div></div></body>`,
    ),
    'Release-Process_98765.html': page('<p>Back <a href="Home_1.html">home</a>.</p>'),
    'Deep_3.html': page('<p>Deep.</p>'),
    'Orphan_4.html': page(
      '<p>Orphan.</p>',
      `<ol id="breadcrumbs"><li><a href="index.html">Engineering</a></li><li><a href="Home_1.html">Home</a></li><li><a href="Orphan_4.html">Self</a></li><li><a href="https://example.com">Out</a></li></ol>
       <h1 id="title-heading"><span id="title-text">Engineering : Orphan Page</span></h1>`,
    ),
    'Loose-Notes_5.html': '<html><body><p>No main content.</p></body></html>',
    'attachments/1/diagram one.png': 6,
    'attachments/1/spec.pdf': 7,
    'styles/site.css': 'body{}',
    'archive/old/index.html': '<ul><li><a href="../../Deep_3.html">Wrong Tree</a></li></ul>',
  });

afterEach(() => {
  delete (globalThis as { pwned?: boolean }).pwned;
});

describe('Confluence', () => {
  it('names a page after its file, the numeric id gone', () => {
    expect(titleOfConfluenceFile('Release-Process_98765.html')).toBe('Release Process');
    expect(titleOfConfluenceFile('98765.html')).toBe('98765');
    expect(titleOfConfluenceFile('_1.html')).toBe('_1');
  });

  it('makes the tree from the index, then from breadcrumbs for pages it leaves out', async () => {
    const plan = await planImport('confluence', exported());
    expect(plan.pages.map((p) => [p.key, p.title, p.parentKey])).toEqual([
      ['p1', 'Home', null],
      ['p2', 'Release Process', 'p1'],
      ['p3', 'Deep', 'p1'],
      ['p4', 'Orphan Page', 'p1'],
      ['p5', 'Loose Notes', null],
    ]);
    expect(plan.summary).toMatchObject({ pages: 5, pictures: 1, attachments: 1, ignoredFiles: 2 });
  });

  it('reads the tree from breadcrumbs alone when there is no index', async () => {
    const archive = exported().filter((entry) => !entry.path.endsWith('index.html'));
    const plan = await planImport('confluence', archive);
    expect(plan.pages.map((p) => [p.title, p.parentKey])).toEqual([
      ['Deep', null],
      ['Home Page', null],
      ['Orphan Page', 'p2'],
      ['Loose Notes', null],
      ['Release Process', null],
    ]);
  });

  it('converts the writing: headings, marks, lists, tables, code, macros, mentions and pictures', async () => {
    const plan = await planImport('confluence', exported());
    expect(plan.pages[0]!.markdown).toBe(
      [
        '# Welcome',
        'Read the [release **process**](knowledgebase-page:p2), ask Ada Lovelace, or see [the site](https://example.com/a%20b), [the top](#top), nothing and . **Bold** *soft* `npm run` ~~old~~ plain [text]',
        ['- One', '    1. First', '    2. Second', '- Two'].join('\n'),
        ['| Name | Owner |', '| --- | --- |', '| A \\| B | Ada Bob |', '| Short |  |'].join('\n'),
        '```bash\npnpm install\npnpm test\n```',
        '```ts\nconst a = 1;\n```',
        '````\nfence ``` inside\n````',
        '> **Info** Deploys run on Tuesdays.\n>\n> Not Fridays.',
        '> **Warning**\n>\n> - Back up first',
        '> **Note** Mind the gap.',
        '> **Tip** Use the script.',
        '> **Note**',
        '> Quoted\n>\n> Twice',
        '---',
        // The picture the archive does not hold leaves its (empty) alt text.
        '![The diagram](knowledgebase-picture:0) (smile) no source ',
        'Loose text *here*',
        'In a section',
        '**Attachments**',
        '- spec.pdf',
      ].join('\n\n'),
    );
    expect(plan.pages[0]!.pictures).toMatchObject([
      { path: 'attachments/1/diagram one.png', alt: 'The diagram', size: 6 },
    ]);
    expect(plan.pages[0]!.warnings).toEqual([
      { kind: 'missing-picture', detail: 'attachments/1/gone.png' },
    ]);
    expect(plan.pages[1]!.markdown).toBe('Back [home](knowledgebase-page:p1).');
    expect(plan.pages[4]!.markdown).toBe('No main content.');
  });

  it('runs nothing from a hostile page, and keeps none of its script or handlers', async () => {
    const plan = await planImport(
      'confluence',
      archiveOf({
        '../../outside.html': page('<p>Escaped</p>'),
        'Evil_9.html': page(
          `<script>globalThis.pwned = true</script><style>p{}</style>
           <img src="x" onerror="globalThis.pwned = true" alt="pic">
           <iframe src="javascript:globalThis.pwned = true"></iframe>
           <p onclick="globalThis.pwned = true">Hello <a href="javascript:globalThis.pwned=true">click</a>
           <a href="../../../etc/passwd">up</a></p>`,
        ),
      }),
    );
    expect((globalThis as { pwned?: boolean }).pwned).toBeUndefined();
    expect(plan.pages).toHaveLength(1);
    expect(plan.pages[0]!.markdown).toBe('pic\n\nHello click [up](../../../etc/passwd)');
    expect(plan.pages[0]!.warnings.map((w) => w.kind)).toEqual(['missing-picture', 'unsafe-link']);
    expect(plan.summary.skipped).toMatchObject([
      { path: '../../outside.html', reason: 'outside-archive' },
    ]);
  });

  it('reports an index it cannot read and falls back to breadcrumbs', async () => {
    const archive = exported();
    archive[0]!.read = async () => {
      throw new Error('broken');
    };
    archive.find((entry) => entry.path === 'Deep_3.html')!.read = archive[0]!.read;
    const plan = await planImport('confluence', archive);
    expect(plan.summary.skipped).toMatchObject([
      { path: 'index.html', reason: 'page-failed' },
      { path: 'Deep_3.html', reason: 'page-failed' },
    ]);
    expect(plan.pages).toHaveLength(4);
  });
});
