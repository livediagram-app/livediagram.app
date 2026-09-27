import { LicencesError } from './errors.ts';

export type PackageLocation = { name: string; root: string; storeVersion: string };

const NODE_MODULES = 'node_modules/';
// `.pnpm/<store key>/node_modules/`, right before the package directory.
const STORE_SEGMENT = /(?:^|\/)node_modules\/\.pnpm\/([^/]+)\/node_modules\/$/;

function fail(path: string, why: string): never {
  throw new LicencesError('StorePathUnrecognised', `${path}: ${why}`);
}

// The package a bundled file belongs to: the directory after its last
// `node_modules/`, and the version pnpm stored it under, which is the
// lockfile's resolution. null for first-party source.
export function locatePackage(path: string): PackageLocation | null {
  const at = path.lastIndexOf(NODE_MODULES);
  if (at === -1) return null;
  const before = path.slice(0, at + NODE_MODULES.length);
  const [first = '', second] = path.slice(before.length).split('/');
  const name = first.startsWith('@') ? (second ? `${first}/${second}` : '') : first;
  if (!name) fail(path, 'no package name after node_modules/');

  const store = STORE_SEGMENT.exec(before)?.[1];
  if (!store) fail(path, 'not inside the pnpm store');
  const prefix = `${name.replace('/', '+')}@`;
  if (!store.startsWith(prefix)) fail(path, `store key ${store} is not for ${name}`);
  // Peers follow an underscore, which semver never contains.
  const storeVersion = store.slice(prefix.length).split('_')[0]!;
  if (!storeVersion) fail(path, `store key ${store} carries no version`);

  return { name, root: before + name, storeVersion };
}

// The directories between a package root and one of its files, innermost
// first: where a vendored work (its own package.json name and licence file)
// could start.
export function vendoredCandidates(root: string, file: string): string[] {
  const dirs: string[] = [];
  for (let dir = file.slice(0, file.lastIndexOf('/')); dir.length > root.length;) {
    dirs.push(dir);
    dir = dir.slice(0, dir.lastIndexOf('/'));
  }
  return dirs;
}
