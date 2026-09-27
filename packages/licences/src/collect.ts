import { createHash } from 'node:crypto';

import type { AppId, WorkKind } from './contract.ts';
import type { EmbeddedWork } from './embedded-works.ts';
import { LicencesError } from './errors.ts';
import { homepageFromManifest } from './homepage.ts';
import { isLicenceFile, normaliseText } from './licence-files.ts';
import { detectLicenceId, isLicenceAllowed, licenceFromManifest } from './licence-id.ts';
import type { Override } from './overrides.ts';
import { locatePackage, vendoredCandidates } from './package-path.ts';
import type { TextRef, TextSource } from './texts.ts';

// Files the bundler cannot see into; each must match an embedded work.
export const BINARY_ASSET_EXTENSIONS: ReadonlySet<string> = new Set([
  'wasm',
  'ttf',
  'otf',
  'woff',
  'woff2',
]);

export type AppBundle = { app: AppId; sources: string[]; assets: string[] };

// Reads absolute paths: undefined for no such file, [] for no such directory.
export type FileReader = {
  readText(path: string): string | undefined;
  listFiles(dir: string): string[];
};

export type CollectContext = {
  repoRoot: string;
  textsDir: string;
  reader: FileReader;
  overrides: readonly Override[];
  embedded: readonly EmbeddedWork[];
  textSources: readonly TextSource[];
};

export type LicenceText = { label: string; text: string };

export type WorkRecord = {
  key: string;
  kind: WorkKind;
  name: string;
  version: string;
  licence: string;
  carrier?: string;
  homepage?: string;
  texts: LicenceText[];
};

export type Collected = {
  app: AppId;
  works: WorkRecord[];
  usedOverrides: string[];
  usedEmbedded: string[];
};

type Manifest = Record<string, unknown>;
type Package = { name: string; version: string; root: string; manifest: Manifest };

// One app's bundle to the works it ships (blueprint "Behaviour and state", step 3).
export function collectWorks(bundle: AppBundle, ctx: CollectContext): Collected {
  const { reader } = ctx;
  const abs = (rel: string) => `${ctx.repoRoot}/${rel}`;

  const readManifest = (dir: string): Manifest | undefined => {
    const raw = reader.readText(`${abs(dir)}/package.json`);
    if (raw === undefined) return undefined;
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Manifest) : undefined;
    } catch {
      return undefined;
    }
  };

  const licenceTexts = (dir: string): LicenceText[] =>
    reader
      .listFiles(abs(dir))
      .filter(isLicenceFile)
      .sort()
      .map((label) => ({
        label,
        text: normaliseText(reader.readText(`${abs(dir)}/${label}`) ?? ''),
      }))
      .filter((t) => t.text !== '');

  const packages = new Map<string, Package>();
  const loadPackage = (path: string): Package | undefined => {
    const location = locatePackage(path);
    if (!location) return undefined;
    const known = packages.get(location.root);
    if (known) return known;
    const manifest = readManifest(location.root);
    if (manifest?.name !== location.name || typeof manifest.version !== 'string') {
      throw new LicencesError(
        'PackageManifestInvalid',
        `${location.root}/package.json does not name ${location.name} with a version`,
      );
    }
    if (manifest.version !== location.storeVersion) {
      throw new LicencesError(
        'VersionMismatch',
        `${location.name} is ${manifest.version} but the lockfile resolved ${location.storeVersion}`,
      );
    }
    const pkg = { name: location.name, version: manifest.version, root: location.root, manifest };
    packages.set(location.root, pkg);
    return pkg;
  };

  const readRef = (ref: TextRef, owner: string): LicenceText => {
    if ('file' in ref) {
      const listed = ctx.textSources.find((s) => s.file === ref.file);
      if (!listed) throw new LicencesError('TextSourceIntegrity', `${ref.file} is not listed`);
      const text = reader.readText(`${ctx.textsDir}${ref.file}`);
      if (text === undefined || createHash('sha256').update(text).digest('hex') !== listed.sha256) {
        throw new LicencesError('TextSourceIntegrity', `${ref.file} is missing or was edited`);
      }
      return { label: ref.label, text: normaliseText(text) };
    }
    const pkg = [...packages.values()].find((p) => p.name === ref.package);
    if (!pkg) {
      throw new LicencesError(
        'EmbeddedPackageNotShipped',
        `${owner} reads ${ref.package}, which ${bundle.app} does not ship`,
      );
    }
    const text = normaliseText(reader.readText(`${abs(pkg.root)}/${ref.path}`) ?? '');
    if (!text)
      throw new LicencesError('LicenceTextMissing', `${owner}: ${ref.package}/${ref.path}`);
    return { label: ref.label, text };
  };

  const allowed = (licence: string, who: string): string => {
    if (!isLicenceAllowed(licence)) {
      throw new LicencesError('LicenceNotAllowed', `${who} is ${licence}`);
    }
    return licence;
  };
  const licenceOf = (manifest: Manifest, texts: LicenceText[], who: string, preset?: string) => {
    const licence = preset ?? licenceFromManifest(manifest) ?? detectLicenceId(texts[0]!.text);
    if (!licence) throw new LicencesError('LicenceIdUnknown', who);
    return allowed(licence, who);
  };

  // Pass 1: every package and every vendored boundary the sources touch.
  const firstParty = new Set<string>();
  const vendoredDirs = new Map<string, Package>();
  const checkedDirs = new Set<string>();
  for (const source of bundle.sources) {
    const pkg = loadPackage(source);
    if (!pkg) {
      firstParty.add(source);
      continue;
    }
    for (const dir of vendoredCandidates(pkg.root, source)) {
      if (checkedDirs.has(dir)) continue;
      checkedDirs.add(dir);
      if (typeof readManifest(dir)?.name === 'string' && licenceTexts(dir).length > 0) {
        vendoredDirs.set(dir, pkg);
      }
    }
  }

  const works: WorkRecord[] = [];
  const usedOverrides: string[] = [];

  for (const pkg of packages.values()) {
    const id = `${pkg.name}@${pkg.version}`;
    const override = ctx.overrides.find((o) => o.package === pkg.name && o.version === pkg.version);
    const own = licenceTexts(pkg.root);
    const applied = own.length === 0 ? override : undefined;
    if (own.length === 0 && !applied) {
      throw new LicencesError('LicenceTextMissing', `${id} ships no licence file`);
    }
    const texts = applied ? applied.texts.map((ref) => readRef(ref, id)) : own;
    if (applied) usedOverrides.push(id);
    const homepage = homepageFromManifest(pkg.manifest);
    works.push({
      key: `package:${id}`,
      kind: 'package',
      name: pkg.name,
      version: pkg.version,
      licence: licenceOf(pkg.manifest, texts, id, applied?.licence),
      ...(homepage ? { homepage } : {}),
      texts,
    });
  }

  for (const [dir, parent] of vendoredDirs) {
    const manifest = readManifest(dir)!;
    const segments = dir.split('/');
    const base = segments.at(-1)!;
    const scope = segments.at(-2)!;
    const name = scope.startsWith('@') ? `${scope}/${base}` : base;
    const carrier = `${parent.name} ${parent.version}`;
    const version =
      typeof manifest.version === 'string' ? manifest.version : `bundled in ${carrier}`;
    const texts = licenceTexts(dir);
    const homepage = homepageFromManifest(manifest);
    works.push({
      key: `vendored:${dir}`,
      kind: 'vendored',
      name,
      version,
      licence: licenceOf(manifest, texts, `${name} (${version})`),
      carrier,
      ...(homepage ? { homepage } : {}),
      texts,
    });
  }

  const usedEmbedded = new Set<string>();
  for (const asset of bundle.assets) {
    const extension = asset.split('.').at(-1)!.toLowerCase();
    if (!BINARY_ASSET_EXTENSIONS.has(extension)) continue;
    const hits = ctx.embedded.filter((w) => 'assets' in w.trigger && w.trigger.assets.test(asset));
    if (hits.length === 0) {
      throw new LicencesError('UnreviewedBinaryAsset', `${bundle.app} emits ${asset}`);
    }
    for (const hit of hits) usedEmbedded.add(hit.id);
  }
  for (const work of ctx.embedded) {
    if ('sources' in work.trigger && work.trigger.sources.some((s) => firstParty.has(s))) {
      usedEmbedded.add(work.id);
    }
  }
  for (const work of ctx.embedded.filter((w) => usedEmbedded.has(w.id))) {
    works.push({
      key: `embedded:${work.id}`,
      kind: 'embedded',
      name: work.name,
      version: work.version,
      licence: allowed(work.licence, work.name),
      carrier: work.carrier,
      homepage: work.homepage,
      texts: work.texts.map((ref) => readRef(ref, work.name)),
    });
  }

  return {
    app: bundle.app,
    works: works.sort((a, b) => (a.key < b.key ? -1 : 1)),
    usedOverrides,
    usedEmbedded: [...usedEmbedded].sort(),
  };
}
