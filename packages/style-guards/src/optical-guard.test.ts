import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkOpticalAlignment } from './optical-guard';

function scan(source: string, dir = 'components') {
  const root = mkdtempSync(join(tmpdir(), 'optical-guard-'));
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, 'Shape.tsx'), source);
  return checkOpticalAlignment({ root });
}

const DISC = 'flex h-5 w-5 items-center justify-center rounded-full';
const CHIP = 'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px]';

describe('optical guard', () => {
  it('flags bare text in a fixed-height centring circle', () => {
    const v = scan(`export const A = () => <span className="${DISC}">W</span>;`);
    expect(v).toEqual([{ file: 'components/Shape.tsx', line: 1, snippet: 'W' }]);
  });

  it('flags an expression that may be text, in a template className', () => {
    const v = scan(`export const A = ({ n }: { n: string }) => (
  <span className={\`${DISC} \${n}\`}>
    {n.slice(0, 1)}
  </span>
);`);
    expect(v.map((x) => x.line)).toEqual([3]);
  });

  it('accepts text wrapped in the optical utility', () => {
    expect(
      scan(
        `export const A = () => <span className="${DISC}"><span className="text-optical-centre">W</span></span>;`,
      ),
    ).toEqual([]);
  });

  it('accepts a truncated label wrapped in the line utility', () => {
    expect(
      scan(
        `export const A = () => <span className="${DISC}"><span className="text-optical-line truncate">Wg</span></span>;`,
      ),
    ).toEqual([]);
  });

  it('accepts icons, null branches and icon-named identifiers', () => {
    expect(
      scan(`export const A = ({ on, icon }: { on: boolean; icon: unknown }) => (
  <span className="${DISC}">{on ? <svg /> : null}{icon}{on && <b />}</span>
);`),
    ).toEqual([]);
  });

  it('counts a shape sized by its style as fixed-height', () => {
    const v = scan(`export const A = ({ s }: { s: number }) => (
  <div style={{ width: s, height: s }} className="flex items-center justify-center rounded-full">
    {s}
  </div>
);`);
    expect(v.map((x) => x.line)).toEqual([3]);
  });

  it('looks through a plain wrapper that does not trim', () => {
    const v = scan(`export const A = () => (
  <span className="${DISC}">
    <span style={{ fontSize: 11 }}>{'AB'}</span>
  </span>
);`);
    expect(v.map((x) => x.snippet)).toEqual(["{'AB'}"]);
  });

  it('exempts the primitives own implementation', () => {
    const src = `export const A = ({ children }: { children: string }) => <span className="${DISC}">{children}</span>;`;
    expect(scan(src, 'src/optical')).toEqual([]);
    expect(scan(src)).toHaveLength(1);
  });

  it('leaves the primitives, unrounded shapes and unpadded pills alone', () => {
    expect(
      scan(
        `export const A = () => <><GlyphDisc className="${DISC}">W</GlyphDisc><Chip className="${CHIP}">W</Chip><span className="flex h-5 items-center rounded-md px-2">W</span><span className="rounded-full items-center">W</span></>;`,
      ),
    ).toEqual([]);
  });

  it('flags a hand-rolled chip of any height: a padded pill span, button or link', () => {
    const v = scan(`export const A = ({ n }: { n: number }) => (
  <>
    <span className="${CHIP}">Live</span>
    <button type="button" className="${CHIP}">{n}</button>
    <a href="/" className="${CHIP}">Open</a>
    <Link href="/" className="rounded-full pl-2 pr-3">Open</Link>
  </>
);`);
    expect(v.map((x) => `${x.line} ${x.snippet}`)).toEqual(['3 Live', '4 {n}', '5 Open', '6 Open']);
  });

  it('accepts a chip whose label goes through the line utility or ButtonContent', () => {
    expect(
      scan(`export const A = () => (
  <>
    <span className="${CHIP}"><span className="text-optical-line">Live</span></span>
    <button type="button" className="${CHIP}"><ButtonContent>Stop</ButtonContent></button>
  </>
);`),
    ).toEqual([]);
  });

  it('leaves a padded pill layout box (a div banner) to the audit', () => {
    expect(scan(`export const A = () => <div className="${CHIP}">Saved</div>;`)).toEqual([]);
  });
});
