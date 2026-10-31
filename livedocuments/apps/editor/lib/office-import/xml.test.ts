import { describe, expect, it } from 'vitest';
import { OfficeImportError } from './errors';
import { child, decodeEntities, find, findAll, intAttr, kids, parseXml, path, textOf } from './xml';

function failureOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof OfficeImportError ? error.failure : 'other';
  }
  return undefined;
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

describe('parseXml', () => {
  it('reads elements, attributes, text, CDATA and entities, skipping declarations and comments', () => {
    const root = parseXml(
      `<?xml version="1.0"?><!-- a comment --><root a="1" b='two &amp; three'><x>&lt;hi&gt; &#65;&#x42; &bogus;</x><![CDATA[<raw>]]><y/>  </root>`,
    );
    expect(root.name).toBe('root');
    expect(root.attrs).toEqual({ a: '1', b: 'two & three' });
    expect(textOf(child(root, 'x'))).toBe('<hi> AB &bogus;');
    expect(root.children).toContain('<raw>');
    expect(child(root, 'y')?.children).toEqual([]);
    // Whitespace between elements is noise.
    expect(root.children.filter((c) => typeof c === 'string')).toEqual(['<raw>']);
  });

  it('folds known namespaces to their canonical prefix, whatever the file chose', () => {
    const root = parseXml(
      `<ns0:document xmlns:ns0="${W}" xmlns:rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><ns0:body><ns0:p rel:id="r1"><ns0:t xml:space="preserve">  </ns0:t></ns0:p><other:x xmlns:other="urn:x"/></ns0:body></ns0:document>`,
    );
    expect(root.name).toBe('w:document');
    const para = path(root, 'w:body', 'w:p');
    expect(para?.attrs['r:id']).toBe('r1');
    // Whitespace is content inside w:t.
    expect(textOf(child(para, 'w:t'))).toBe('  ');
    expect(find(root, 'other:x')).toBeDefined();
  });

  it('reads strict OOXML and default namespaces as transitional', () => {
    const root = parseXml(
      `<document xmlns="http://purl.oclc.org/ooxml/wordprocessingml/main"><body/></document>`,
    );
    expect(root.name).toBe('w:document');
    expect(kids(root)[0]!.name).toBe('w:body');
    const rels = parseXml(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="a"/></Relationships>`,
    );
    expect(kids(rels)[0]!.name).toBe('pr:Relationship');
    expect(kids(rels)[0]!.attrs.Id).toBe('a');
  });

  it('refuses a document type declaration before expanding anything', () => {
    const laughs = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><lolz>&lol2;</lolz>`;
    expect(failureOf(() => parseXml(laughs))).toBe('not-a-package');
    expect(failureOf(() => parseXml('<a><!ELEMENT x ANY></a>'))).toBe('not-a-package');
  });

  it('refuses malformed XML', () => {
    for (const bad of [
      '<a><b></a>',
      '<a>',
      '</a>',
      '<a',
      '<a x="1></a>',
      '<!-- open',
      '<?pi',
      '<a><![CDATA[x</a>',
      'text only',
      '<a></a b>',
    ]) {
      expect(
        failureOf(() => parseXml(bad)),
        bad,
      ).toBe('not-a-package');
    }
  });

  it('refuses a part nested too deep', () => {
    const deep = `${'<a>'.repeat(300)}${'</a>'.repeat(300)}`;
    expect(failureOf(() => parseXml(deep))).toBe('unpacks-too-large');
  });

  it('refuses a part with too many elements', () => {
    const many = `<r>${'<a/>'.repeat(1_000_001)}</r>`;
    expect(failureOf(() => parseXml(many))).toBe('unpacks-too-large');
  });
});

describe('the walking helpers', () => {
  const root = parseXml('<r><a n="5" bad="x"><b><c>1</c></b></a><a><c>2</c></a></r>');
  it('find children, paths and descendants', () => {
    expect(kids(root)).toHaveLength(2);
    expect(kids(undefined)).toEqual([]);
    expect(child(undefined, 'a')).toBeUndefined();
    expect(textOf(path(root, 'a', 'b', 'c'))).toBe('1');
    expect(findAll(root, 'c').map(textOf)).toEqual(['1', '2']);
    expect(findAll(undefined, 'c')).toEqual([]);
    expect(find(undefined, 'c')).toBeUndefined();
    expect(find(root, 'z')).toBeUndefined();
    expect(textOf(undefined)).toBe('');
    expect(intAttr(child(root, 'a'), 'n')).toBe(5);
    expect(intAttr(child(root, 'a'), 'bad')).toBeUndefined();
    expect(intAttr(child(root, 'a'), 'none')).toBeUndefined();
  });

  it('decodes out-of-range character references as written', () => {
    expect(decodeEntities('&#0; &#x110000; plain')).toBe('&#0; &#x110000; plain');
  });
});
