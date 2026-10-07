import { describe, expect, it } from 'vitest';
import { CliError, type CliFailure } from '../output/cli-error';
import { linkFileText, parseLinkFile } from './link-file';

// livediagram.toml (docs/specs/027-repositories/blueprints/repository-link.md "The link file"): every key, its
// defaults and every rejection, with its exit and final copy.

const PATH = '/repo/livediagram.toml';

function failureOf(text: string): CliFailure {
  try {
    parseLinkFile(text, PATH);
  } catch (err) {
    if (err instanceof CliError) return err.failure;
    throw err;
  }
  throw new Error('expected a CliError');
}

describe('parseLinkFile', () => {
  it('reads every key of a full link file', () => {
    const text = [
      'host = "https://www.example.org/"',
      '[covers]',
      'folder = "fld_8k2m4q"',
      'documents = ["doc_3h9x2a", "doc_7"]',
      '[mirror]',
      'level = "files"',
      'dir = "./docs\\\\diagrams/"',
      '[hooks]',
      'block = true',
      '[[sources]]',
      'path = "docs/arch.excalidraw"',
      'anything = 1',
    ].join('\n');
    expect(parseLinkFile(text, PATH)).toEqual({
      path: PATH,
      root: '/repo',
      host: 'https://www.example.org',
      covers: { folder: 'fld_8k2m4q', documents: ['doc_3h9x2a', 'doc_7'] },
      mirror: { level: 'files', dir: 'docs/diagrams' },
      hooks: { block: true },
      sources: [{ path: 'docs/arch.excalidraw', anything: 1 }],
    });
  });

  it('applies the defaults: the profile’s host, level index, dir diagrams, no hooks or sources', () => {
    expect(parseLinkFile('[covers]\ndocuments = ["d1"]\n', PATH)).toEqual({
      path: PATH,
      root: '/repo',
      host: null,
      covers: { folder: null, documents: ['d1'] },
      mirror: { level: 'index', dir: 'diagrams' },
      hooks: { block: false },
      sources: [],
    });
    expect(parseLinkFile('[covers]\nfolder = "f"\n[mirror]\ndir = "."\n', PATH).mirror).toEqual({
      level: 'index',
      dir: '.',
    });
  });

  it('names the line and column of a syntax error', () => {
    expect(failureOf('[covers]\nfolder = = "x"\n')).toEqual({
      exit: 2,
      code: 'link_syntax',
      message: `${PATH} line 2, column 10: invalid value`,
      hint: 'fix the line; livediagram.toml is TOML',
    });
  });

  it('refuses an unknown key by name at every level, with the nearest when there is one', () => {
    expect(failureOf('hots = "x"\n[covers]\nfolder = "f"\n')).toEqual({
      exit: 2,
      code: 'unknown_key',
      message: `${PATH}: unknown key "hots"`,
      lines: ['did you mean: host'],
      hint: 'the top-level keys: host, covers, mirror, hooks, sources',
    });
    expect(failureOf('[covers]\nfolders = "f"\n')).toMatchObject({
      message: `${PATH}: unknown key "covers.folders"`,
      lines: ['did you mean: folder'],
      hint: 'the keys of [covers]: folder, documents',
    });
    expect(failureOf('[covers]\nfolder = "f"\n[mirror]\nwhere = "x"\n')).toEqual({
      exit: 2,
      code: 'unknown_key',
      message: `${PATH}: unknown key "mirror.where"`,
      hint: 'the keys of [mirror]: level, dir',
    });
    expect(failureOf('[covers]\nfolder = "f"\n[hooks]\nblok = true\n')).toMatchObject({
      message: `${PATH}: unknown key "hooks.blok"`,
      hint: 'the keys of [hooks]: block',
    });
  });

  it('refuses a key of the wrong type', () => {
    const wrong = (text: string, what: string) =>
      expect(failureOf(text)).toEqual({
        exit: 2,
        code: 'wrong_type',
        message: `${PATH}: ${what}`,
        hint: 'livediagram link init --help',
      });
    wrong('host = 1\n[covers]\nfolder = "f"\n', 'host must be a string');
    wrong('covers = "f"\n', 'covers must be a table');
    wrong('[covers]\nfolder = 3\n', 'covers.folder must be a string');
    wrong('[covers]\ndocuments = "d"\n', 'covers.documents must be an array of strings');
    wrong('[covers]\ndocuments = [1]\n', 'covers.documents must be an array of strings');
    wrong('mirror = 1\n[covers]\nfolder = "f"\n', 'mirror must be a table');
    wrong('[covers]\nfolder = "f"\n[mirror]\nlevel = 1\n', 'mirror.level must be a string');
    wrong('[covers]\nfolder = "f"\n[mirror]\ndir = true\n', 'mirror.dir must be a string');
    wrong('hooks = 1\n[covers]\nfolder = "f"\n', 'hooks must be a table');
    wrong('[covers]\nfolder = "f"\n[hooks]\nblock = "no"\n', 'hooks.block must be a boolean');
    wrong('sources = 1\n[covers]\nfolder = "f"\n', 'sources must be an array of tables');
    wrong('sources = [1]\n[covers]\nfolder = "f"\n', 'sources must be an array of tables');
    wrong('host = 1979-05-27\n[covers]\nfolder = "f"\n', 'host must be a string');
    wrong('covers = 1979-05-27\n', 'covers must be a table');
  });

  it('refuses every value the rejection table names', () => {
    const refused = (text: string, failure: Partial<CliFailure>) =>
      expect(failureOf(text)).toEqual({ exit: 1, ...failure });
    refused('host = "ftp://x.org"\n[covers]\nfolder = "f"\n', {
      code: 'invalid_host',
      message: `${PATH}: host must be an origin such as https://livediagram.app, not ftp://x.org`,
    });
    for (const host of ['https://x.org/app', 'https://x.org/?a=1', 'https://x.org/#a', 'nope'])
      expect(failureOf(`host = "${host}"\n[covers]\nfolder = "f"\n`).code).toBe('invalid_host');
    refused('host = "https://x.org"\n', {
      code: 'no_coverage',
      message: `${PATH}: [covers] needs a folder, documents, or both`,
      hint: 'livediagram link init --folder <folder>',
    });
    refused('[covers]\ndocuments = []\n', {
      code: 'no_coverage',
      message: `${PATH}: [covers] needs a folder, documents, or both`,
      hint: 'livediagram link init --folder <folder>',
    });
    refused('[covers]\nfolder = ""\n', {
      code: 'empty_id',
      message: `${PATH}: covers.folder holds an empty or spaced id`,
      hint: 'livediagram link ls',
    });
    refused('[covers]\ndocuments = ["a b"]\n', {
      code: 'empty_id',
      message: `${PATH}: covers.documents holds an empty or spaced id`,
      hint: 'livediagram link ls',
    });
    expect(failureOf(`[covers]\nfolder = "${'x'.repeat(129)}"\n`).code).toBe('empty_id');
    expect(
      parseLinkFile(`[covers]\nfolder = "${'x'.repeat(128)}"\n`, PATH).covers.folder,
    ).toHaveLength(128);
    refused('[covers]\ndocuments = ["d1", "d1"]\n', {
      code: 'duplicate_document',
      message: `${PATH}: covers.documents lists d1 twice`,
    });
    refused('[covers]\nfolder = "f"\n[mirror]\nlevel = "all"\n', {
      code: 'invalid_level',
      message: `${PATH}: mirror.level must be none, index or files, not "all"`,
    });
    for (const dir of ['/etc', '../up', 'a/../../b', 'a/../b', '', '  '])
      expect(failureOf(`[covers]\nfolder = "f"\n[mirror]\ndir = "${dir}"\n`)).toEqual({
        exit: 1,
        code: 'invalid_dir',
        message: `${PATH}: mirror.dir must stay inside /repo, not "${dir}"`,
      });
  });
});

describe('linkFileText', () => {
  it('writes the keys in order, host always, the rest only when given', () => {
    expect(
      linkFileText({
        host: 'https://livediagram.app',
        folder: 'fld_1',
        documents: ['d1', 'd"2'],
        level: 'files',
      }),
    ).toBe(
      [
        "# This repository's diagrams live in livediagram; see https://livediagram.app/help/developers/repositories/",
        'host = "https://livediagram.app"',
        '',
        '[covers]',
        'folder = "fld_1"',
        'documents = ["d1", "d\\"2"]',
        '',
        '[mirror]',
        'level = "files"',
        '',
      ].join('\n'),
    );
    const bare = linkFileText({ host: 'https://self.example', folder: 'f', documents: [] });
    expect(bare).toBe(
      '# This repository\'s diagrams live in livediagram; see https://self.example/help/developers/repositories/\nhost = "https://self.example"\n\n[covers]\nfolder = "f"\n',
    );
    expect(parseLinkFile(bare, PATH).covers).toEqual({ folder: 'f', documents: [] });
  });
});
