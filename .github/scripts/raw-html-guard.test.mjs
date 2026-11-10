import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findRawSinks, HTML_MODULE, isScanned, rawSinks } from './raw-html-guard.mjs';

// The raw HTML guard (docs/ci.md "One path for markup").

describe('isScanned', () => {
  it('reads shipped source files in every product, the platform and packages', () => {
    for (const file of [
      'livediagram/apps/editor/components/canvas/StickerView.tsx',
      'liveworkspace/apps/site/app/layout.tsx',
      'packages/ui/src/JsonLd.tsx',
      'livedocuments/apps/editor/lib/print-frame.ts',
      'scripts/e2e-stack.mjs',
    ])
      assert.equal(isScanned(file), true, file);
  });

  it('leaves out the one module, tests, e2e specs, test helpers, CI scripts and non-source files', () => {
    for (const file of [
      HTML_MODULE,
      'livediagram/apps/editor/components/canvas/StickerView.test.tsx',
      'livediagram/apps/editor/e2e/smoke.spec.ts',
      'livediagram/apps/editor/e2e/helpers.ts',
      'livediagram/apps/editor/lib/drawio/test-support.ts',
      'packages/ui/src/__tests__/a.ts',
      '.github/scripts/raw-html-guard.mjs',
      'livediagram/docs/specs/016-platform/trusted-types.md',
      'livediagram/apps/editor/app/globals.css',
    ])
      assert.equal(isScanned(file), false, file);
  });
});

describe('rawSinks', () => {
  it('finds each kind of sink, with its line', () => {
    const text = [
      '<svg dangerouslySetInnerHTML={{ __html: x }} />',
      'const p = { dangerouslySetInnerHTML: { __html: x } };',
      'el.innerHTML = x;',
      'el.innerHTML += x;',
      'el.outerHTML = x;',
      'frame.srcdoc = x;',
      "el.insertAdjacentHTML('beforeend', x);",
      'range.createContextualFragment(x);',
      'el.setHTMLUnsafe(x); Document.parseHTMLUnsafe(x);',
      'document.write(x); document.writeln(x);',
    ].join('\n');
    assert.deepEqual(rawSinks('a.tsx', text), [
      'a.tsx:1: dangerouslySetInnerHTML',
      'a.tsx:2: dangerouslySetInnerHTML',
      'a.tsx:3: innerHTML assignment',
      'a.tsx:4: innerHTML assignment',
      'a.tsx:5: outerHTML assignment',
      'a.tsx:6: srcdoc assignment',
      'a.tsx:7: insertAdjacentHTML',
      'a.tsx:8: createContextualFragment',
      'a.tsx:9: setHTMLUnsafe',
      'a.tsx:9: setHTMLUnsafe',
      'a.tsx:10: document.write',
      'a.tsx:10: document.write',
    ]);
  });

  it('lets the one path, reads, comparisons and prose through', () => {
    const text = [
      '<svg {...htmlProps(builtMarkup(markup))} />',
      'setHtml(svg, builtMarkup(ink));',
      'setSrcdoc(frame, builtMarkup(html));',
      'const was = el.innerHTML;',
      'if (el.innerHTML === "") return;',
      'if (frame.srcdoc !== x) return;',
      '// React writes dangerouslySetInnerHTML through innerHTML on a client render.',
    ].join('\n');
    assert.deepEqual(rawSinks('a.tsx', text), []);
  });
});

describe('findRawSinks', () => {
  it('reads only the scanned files', () => {
    const files = {
      'a.tsx': 'el.innerHTML = x;',
      'a.test.tsx': 'el.innerHTML = x;',
      [HTML_MODULE]: 'el.innerHTML = x;',
    };
    const read = (/** @type {string} */ f) =>
      /** @type {Record<string, string>} */ (files)[f] ?? '';
    assert.deepEqual(findRawSinks(Object.keys(files), read), ['a.tsx:1: innerHTML assignment']);
  });
});
