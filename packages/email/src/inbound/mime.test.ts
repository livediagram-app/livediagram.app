import { describe, expect, it } from 'vitest';
import {
  INBOUND_DEPTH_MAX,
  INBOUND_PARTS_MAX,
  byteString,
  bytesOf,
  decodeBody,
  decodeCharset,
  headerParams,
  hexByte,
  leavesOf,
  parseMime,
  readHeaders,
} from './mime';

describe('byteString and bytesOf', () => {
  it('round-trip every byte, past one chunk', () => {
    const bytes = new Uint8Array(20_000).map((_, i) => i % 256);
    const s = byteString(bytes);
    expect(s.length).toBe(20_000);
    expect(bytesOf(s)).toEqual(bytes);
  });
});

describe('readHeaders', () => {
  it('unfolds, lower-cases names and keeps the first of each', () => {
    const s = 'Subject: one\r\n two\r\nX-A: 1\r\nx-a: 2\r\nnot a header\r\n\r\nbody';
    const { headers, bodyStart } = readHeaders(s);
    expect(headers.get('subject')).toBe('one two');
    expect(headers.get('x-a')).toBe('1');
    expect(s.slice(bodyStart)).toBe('body');
  });

  it('takes LF line ends and a block with no empty line as all headers', () => {
    expect(readHeaders('A: 1\n\nB').bodyStart).toBe(6);
    const all = readHeaders('A: 1\nB: 2');
    expect(all.headers.get('b')).toBe('2');
    expect(all.bodyStart).toBe(9);
  });

  it('ignores a fold with nothing before it', () => {
    expect(readHeaders(' stray\nA: 1\n\n').headers.get('a')).toBe('1');
  });
});

describe('headerParams', () => {
  it('reads the main token and plain and quoted parameters', () => {
    expect(headerParams('Multipart/Mixed; boundary="a b\\"c"; charset=UTF-8')).toEqual({
      main: 'multipart/mixed',
      params: { boundary: 'a b"c', charset: 'UTF-8' },
    });
  });

  it('skips a parameter with no value and an empty name', () => {
    expect(headerParams('text/plain; junk; =x; a=1').params).toEqual({ a: '1' });
    expect(headerParams('text/plain; junk').params).toEqual({});
  });

  it('keeps the first of a repeated name', () => {
    expect(headerParams('a/b; x=1; x=2').params['x']).toBe('1');
  });

  it('puts RFC 2231 pieces back together and decodes them', () => {
    const v = "attachment; filename*0*=utf-8''caf%C3%A9; filename*1*=%20menu; filename*2=.txt";
    expect(headerParams(v).params['filename']).toBe('café menu.txt');
    expect(headerParams("a; name*=iso-8859-1'en'%E9t%E9").params['name']).toBe('été');
    expect(headerParams("a; name*=''plain%zz").params['name']).toBe('plain%zz');
    expect(headerParams('a; name*x=1').params['name']).toBeUndefined();
  });
});

describe('hexByte and decodeCharset', () => {
  it('reads two hex digits or answers -1', () => {
    expect(hexByte('=3D', 1)).toBe(61);
    expect(hexByte('=af', 1)).toBe(175);
    expect(hexByte('=G1', 1)).toBe(-1);
    expect(hexByte('=1', 1)).toBe(-1);
  });

  it('falls back to UTF-8 for an unknown or missing charset', () => {
    expect(decodeCharset('caf\xc3\xa9', 'no-such-charset')).toBe('café');
    expect(decodeCharset('caf\xc3\xa9', undefined)).toBe('café');
    expect(decodeCharset('caf\xe9', 'ISO-8859-1')).toBe('café');
  });
});

describe('decodeBody', () => {
  it('decodes base64, skipping junk and mending padding', () => {
    expect(decodeBody('aGVs\r\nbG8=', 'base64')).toBe('hello');
    expect(decodeBody('aGVsbG8', 'BASE64')).toBe('hello');
    expect(decodeBody('aGVsbG8hX', 'base64')).toBe('hello!');
  });

  it('decodes quoted-printable with soft breaks and keeps a broken =', () => {
    expect(decodeBody('caf=C3=A9 =\r\nmenu =3D=\nok =ZZ end=', 'quoted-printable')).toBe(
      'caf\xc3\xa9 menu =ok =ZZ end=',
    );
  });

  it('leaves any other body as it stands', () => {
    expect(decodeBody('plain', '7bit')).toBe('plain');
    expect(decodeBody('plain', undefined)).toBe('plain');
  });
});

const mixed = [
  'From: A <a@example.com>',
  'Content-Type: multipart/mixed; boundary="outer"',
  '',
  'preamble',
  '--outer',
  'Content-Type: multipart/alternative; boundary=inner',
  '',
  '--inner',
  'Content-Type: text/plain',
  '',
  'Hello',
  '--inner',
  'Content-Type: text/html',
  '',
  '<p>Hello</p>',
  '--inner--',
  '--outer',
  'Content-Type: image/png; name=a.png',
  'Content-Transfer-Encoding: base64',
  '',
  'iVBORw==',
  '--outer--',
  'epilogue',
].join('\r\n');

describe('parseMime', () => {
  it('splits nested multiparts and drops the preamble and epilogue', () => {
    const root = parseMime(mixed);
    expect(root.type).toBe('multipart/mixed');
    const leaves = leavesOf(root);
    expect(leaves.map((p) => p.type)).toEqual(['text/plain', 'text/html', 'image/png']);
    expect(leaves[0]!.raw).toBe('Hello');
    expect(leaves[2]!.raw).toBe('iVBORw==');
  });

  it('keeps the parts up to the end when the closing boundary is missing', () => {
    const root = parseMime('Content-Type: multipart/mixed; boundary=b\n\n--b\n\none\n--b\n\ntwo\n');
    expect(leavesOf(root).map((p) => p.raw)).toEqual(['one', 'two\n']);
  });

  it('reads a multipart with no boundary, or no type, as text', () => {
    expect(parseMime('Content-Type: multipart/mixed\n\nbody').children).toEqual([]);
    expect(leavesOf(parseMime('Content-Type: multipart/mixed\n\nbody'))).toEqual([]);
    expect(parseMime('Content-Type: nonsense\n\nbody').type).toBe('text/plain');
    expect(parseMime('\nbody').type).toBe('text/plain');
  });

  it('ignores lines that only start like a boundary', () => {
    const root = parseMime('Content-Type: multipart/mixed; boundary=b\n\n--b\n\n--bx\n--b--\n');
    expect(leavesOf(root).map((p) => p.raw)).toEqual(['--bx']);
  });

  it('stops at the parts and depth caps', () => {
    const many = Array.from({ length: INBOUND_PARTS_MAX + 20 }, (_, i) => `--b\n\npart ${i}`);
    const wide = parseMime(
      `Content-Type: multipart/mixed; boundary=b\n\n${many.join('\n')}\n--b--`,
    );
    expect(wide.children.length).toBe(INBOUND_PARTS_MAX - 1);
    let deep = 'leaf';
    for (let d = 0; d < INBOUND_DEPTH_MAX + 3; d++)
      deep = `Content-Type: multipart/mixed; boundary=d${d}\n\n--d${d}\n${deep}\n--d${d}--`;
    let node = parseMime(deep);
    let depth = 0;
    while (node.children[0]) {
      node = node.children[0];
      depth++;
    }
    expect(depth).toBe(INBOUND_DEPTH_MAX);
  });
});
