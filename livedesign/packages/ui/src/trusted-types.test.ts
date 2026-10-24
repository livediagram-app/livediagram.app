import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRUSTED_TYPES_CSP } from './trusted-types';

// docs/specs/016-platform/trusted-types.md: the header livedesign's pages send. The policies themselves, the default
// policy and the boot script are @liveworkspace/trusted-types', tested there.

describe('TRUSTED_TYPES_CSP', () => {
  it('enforces Trusted Types and names every policy the pages may create', () => {
    expect(TRUSTED_TYPES_CSP).toBe(
      "require-trusted-types-for 'script'; trusted-types liveworkspace-markup nextjs default",
    );
  });
});

// The header names no ProseMirrorClipboard policy because nothing in livedesign runs ProseMirror (the article editor
// stayed with livedocuments). A package that brings it in fails here, so its policy name joins the header with it.
describe('policies the header leaves out', () => {
  it('has no ProseMirror to make ProseMirrorClipboard', () => {
    const root = new URL('../../../', import.meta.url);
    const manifests = ['apps', 'packages'].flatMap((dir) =>
      readdirSync(new URL(`${dir}/`, root)).map(
        (name) => new URL(`${dir}/${name}/package.json`, root),
      ),
    );
    const prosemirror = manifests.flatMap((manifest) => {
      let json: { name?: string; dependencies?: object; devDependencies?: object };
      try {
        json = JSON.parse(readFileSync(manifest, 'utf8'));
      } catch {
        return [];
      }
      const deps = Object.keys({ ...json.dependencies, ...json.devDependencies });
      return deps
        .filter((d) => /^(prosemirror-|@tiptap\/)/.test(d))
        .map((d) => `${json.name}: ${d}`);
    });
    expect(manifests.length).toBeGreaterThan(5);
    expect(prosemirror).toEqual([]);
    expect(TRUSTED_TYPES_CSP).not.toContain('ProseMirrorClipboard');
  });
});
