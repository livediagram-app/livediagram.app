import { describe, expect, it } from 'vitest';
import { pageToMarkdown } from './convert';

// liveworkspace/docs/specs/010-site/markdown-for-agents.md "What the Markdown holds".

const page = (body: string, head = '<title>FAQ · livediagram</title>') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const md = (html: string, url = 'https://www.livediagram.app/faq') =>
  pageToMarkdown(html, url)?.markdown ?? null;

describe('pageToMarkdown', () => {
  it('writes the head as front matter and the main as Markdown', () => {
    const result = pageToMarkdown(
      page(
        '<header><nav><a href="/">Home</a></nav></header><main><h1>Questions</h1><p>Read <a href="/help/">the help</a>.</p></main><footer>©</footer>',
        '<title>FAQ · livediagram</title><meta name="description" content="Answers, &quot;quoted&quot;."><link rel="canonical" href="/faq">',
      ),
      'https://www.livediagram.app/faq/',
    );
    expect(result).toEqual({
      title: 'FAQ · livediagram',
      description: 'Answers, "quoted".',
      url: 'https://www.livediagram.app/faq',
      markdown:
        '---\ntitle: "FAQ · livediagram"\ndescription: "Answers, \\"quoted\\"."\nurl: "https://www.livediagram.app/faq"\n---\n\n# Questions\n\nRead [the help](/help/).\n',
    });
  });

  it('reads the body when there is no main, and heads it with the title when it has no h1', () => {
    expect(md(page('<p>Just words.</p>'))).toBe(
      '---\ntitle: "FAQ · livediagram"\nurl: "https://www.livediagram.app/faq"\n---\n\n# FAQ · livediagram\n\nJust words.\n',
    );
  });

  it('adds no heading for a page with no title', () => {
    expect(md(page('<main><p>Words.</p></main>', ''))).toContain('---\n\nWords.\n');
  });

  it('leaves out what only a browser needs', () => {
    const out = md(
      page(
        `<main><h1>T</h1>
          <script>alert(1)</script><style>p{}</style><svg><text>chart</text></svg>
          <button>Copy</button><form><input value="x"></form><nav>Crumbs</nav><dialog>Modal</dialog>
          <div hidden>Hidden</div><div aria-hidden="true">Decor</div><div data-agent-skip>Chrome</div>
          <noscript>Enable JS</noscript><iframe src="/x"></iframe>
          <p>Kept.</p></main>`,
      ),
    );
    expect(out).toContain('# T\n\nKept.\n');
    for (const gone of [
      'alert',
      'chart',
      'Copy',
      'Crumbs',
      'Modal',
      'Hidden',
      'Decor',
      'Chrome',
      'Enable JS',
    ])
      expect(out).not.toContain(gone);
  });

  it('keeps a picture with words, and drops a decorative or inlined one', () => {
    const out = md(
      page(
        '<main><h1>T</h1><figure><img src="/f.png" alt="Figure"></figure><img src="/a.png" alt="The canvas"><img src="/b.png" alt=""><img src="data:image/png;base64,AAAA" alt="Inline"><img alt="No source"></main>',
      ),
    );
    expect(out).toContain('![Figure](/f.png)');
    expect(out).toContain('![The canvas](/a.png)');
    expect(out).not.toContain('b.png');
    expect(out).not.toContain('Inline');
    expect(out).not.toContain('No source');
  });

  it('drops what is left empty, and keeps cards’ words apart', () => {
    const out = md(
      page(
        '<main><h1>T</h1><ul><li><button>Only a control</button></li><li><a href="/x"><span>Blank Diagram</span><span>An empty canvas</span></a></li></ul><p><br><span>a</span></p><h2><img src="/i.png" alt=""></h2></main>',
      ),
    );
    expect(out).toBe(
      '---\ntitle: "FAQ · livediagram"\nurl: "https://www.livediagram.app/faq"\n---\n\n# T\n\n- [Blank Diagram An empty canvas](/x)\n\na\n',
    );
  });

  it('writes a question’s summary in bold, and a table as a table', () => {
    const out = md(
      page(
        '<main><h1>T</h1><details><summary><span>Is it free?</span></summary><p>Yes.</p></details><table><thead><tr><th>Plan</th><th>Price</th></tr></thead><tbody><tr><td>Free</td><td>0</td></tr></tbody></table></main>',
      ),
    );
    expect(out).toContain('**Is it free?**\n\nYes.');
    expect(out).toContain('| Plan | Price |\n| ---- | ----- |\n| Free | 0     |');
  });

  it('puts a streamed Suspense boundary’s content in place of its fallback', () => {
    const out = md(
      page(
        '<main><h1>T</h1><!--$?--><template id="B:0"></template><p>Loading…</p><!--/$--><p>After.</p></main><div hidden id="S:0"><p>Streamed.</p></div>',
      ),
    );
    expect(out).toContain('# T\n\nStreamed.\n\nAfter.\n');
    expect(out).not.toContain('Loading');
  });

  it('runs an unclosed boundary’s fallback to the end, and leaves an unknown placeholder out', () => {
    expect(
      md(
        page(
          '<main><h1>T</h1><template id="B:1"></template><p>Fallback</p></main><div hidden id="S:1"><p>Done.</p></div>',
        ),
      ),
    ).toContain('# T\n\nDone.\n');
    expect(
      md(page('<main><h1>T</h1><template id="B:9"></template><p>Fallback.</p></main>')),
    ).toContain('# T\n\nFallback.\n');
  });

  it('gives nothing for a redirect stub, a noindex page or an empty one', () => {
    expect(
      md(page('<main><p>Moved.</p></main>', '<meta http-equiv="refresh" content="0;url=/x">')),
    ).toBeNull();
    expect(
      md(page('<main><p>Tool.</p></main>', '<meta name="robots" content="noindex, nofollow">')),
    ).toBeNull();
    expect(md(page('<main><button>Only</button></main>', ''))).toBeNull();
    expect(md('<!doctype html><html><head></head></html>')).toBeNull();
  });

  it('keeps an indexable page whose robots meta allows it', () => {
    expect(
      md(page('<main><h1>T</h1></main>', '<meta name="robots" content="index, follow">')),
    ).toContain('# T');
  });
});
