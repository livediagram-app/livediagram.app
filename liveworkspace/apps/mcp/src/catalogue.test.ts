// The naming guard (liveworkspace/docs/specs/021-mcp/mcp.md "Names by what they make"): the catalogue built from
// each app's recorded tool list (eval/tools, refreshed by `pnpm eval:snapshot`) has no clash, no bare "document"
// and no name without a subject, and every old name inside it is rewritten.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APPS, appById } from './apps';
import {
  buildAppCatalogue,
  nameRewriter,
  namingProblems,
  renameTool,
  rewriteJson,
  type ListedTool,
} from './catalogue';
import { CORE_TOOLS } from './core';

function recorded(app: string): ListedTool[] {
  return JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'eval', 'tools', `${app}.json`), 'utf8'),
  ) as ListedTool[];
}

const catalogues = APPS.map((spec) => buildAppCatalogue(spec, recorded(spec.app)));
const allNames = [
  ...CORE_TOOLS.map((t) => t.name),
  ...catalogues.flatMap((c) => c.tools.map((t) => t.name)),
];

describe('the one catalogue', () => {
  it('has no clash, no bare "document" and no name without a subject', () => {
    expect(namingProblems(allNames)).toEqual([]);
  });

  it('keeps every app tool but the deprecated aliases', () => {
    for (const c of catalogues) {
      const listed = recorded(c.spec.app).filter((t) => !/\(deprecated\)/i.test(t.title ?? ''));
      expect(c.tools.length, c.spec.app).toBe(listed.length);
    }
    expect(catalogues[0]!.toApp.has('find_diagrams')).toBe(true);
    expect(catalogues[0]!.toApp.get('find_diagrams')).toBe('find_documents');
  });

  it('opens every description with its noun and app', () => {
    for (const c of catalogues)
      for (const t of c.tools)
        expect(t.description, t.name).toMatch(new RegExp(`^For [^.]+ \\(${c.spec.app}\\)\\.`));
  });

  it('leaves no old tool name in any description or schema', () => {
    for (const c of catalogues) {
      const renamed = [...c.toApp].filter(([to, from]) => to !== from).map(([, from]) => from);
      const text = JSON.stringify(c.tools.map(({ name: _name, ...rest }) => rest));
      for (const old of renamed)
        expect(text, `${c.spec.app} still says ${old}`).not.toMatch(
          new RegExp(`(?<![A-Za-z0-9_])${old}(?![A-Za-z0-9_])`),
        );
    }
  });
});

describe('renameTool', () => {
  const by = (app: string) => appById(app)!;
  it.each([
    ['livediagram', 'update_document', 'update_diagram'],
    ['livediagram', 'find_documents', 'find_diagrams'],
    ['livediagram', 'add_tab', 'add_diagram_tab'],
    ['livediagram', 'list_trash', 'list_diagram_trash'],
    ['livedocuments', 'create_document', 'create_doc'],
    ['livedocuments', 'change_pages', 'change_doc_pages'],
    ['livedocuments', 'write_article', 'write_article'],
    ['liveplanner', 'create_project', 'create_plan'],
    ['liveplanner', 'change_items', 'change_cards'],
    ['liveplanner', 'change_sheet', 'change_sheet'],
    ['livedesign', 'change_pages', 'change_design_pages'],
    ['livedesign', 'update_design', 'update_design'],
    ['liveknowledge', 'find_documents', 'find_knowledgebases'],
    ['liveknowledge', 'create_page', 'create_knowledge_page'],
    ['liveknowledge', 'list_page_comments', 'list_knowledge_page_comments'],
    ['liveknowledge', 'get_context', 'get_knowledge_context'],
    ['liveknowledge', 'upload_image', 'upload_knowledge_image'],
  ])('%s %s is %s', (app, from, to) => {
    expect(renameTool(by(app), from)).toBe(to);
  });
});

describe('nameRewriter', () => {
  const rewrite = nameRewriter(
    new Map([
      ['read_document', 'read_diagram'],
      ['find_documents', 'find_diagrams'],
      ['view_tab', 'view_diagram_tab'],
    ]),
  );
  it('rewrites whole names only', () => {
    expect(rewrite('call read_document next, or find_documents.')).toBe(
      'call read_diagram next, or find_diagrams.',
    );
    expect(rewrite('reread_document and read_documents stay')).toBe(
      'reread_document and read_documents stay',
    );
    expect(rewrite('view_tab(view_tab)')).toBe('view_diagram_tab(view_diagram_tab)');
  });
  it('rewrites strings in JSON, never keys', () => {
    expect(rewriteJson({ read_document: 'read_document', n: [1, 'view_tab'] }, rewrite)).toEqual({
      read_document: 'read_diagram',
      n: [1, 'view_diagram_tab'],
    });
  });
  it('is the identity with nothing renamed', () => {
    expect(nameRewriter(new Map([['a_b', 'a_b']]))('a_b')).toBe('a_b');
  });
});

// Claude's connector review reads a tool's hints against what it does (liveworkspace/docs/specs/021-mcp/mcp.md "Fit
// for Claude's connector directory"): every tool listed, the core verbs and with ?tools=all every app's, says it only
// reads when its name says so, and never claims to be harmless when it deletes, trashes, archives, overwrites or shares.
describe('every listed tool’s hints', () => {
  const listed = [...CORE_TOOLS, ...catalogues.flatMap((c) => c.tools)];
  const verb = (name: string) => name.split('_')[0]!;
  const READS = new Set(['find', 'read', 'list', 'search', 'get']);
  const DESTROYS = new Set(['delete', 'trash', 'archive', 'update', 'write', 'overwrite', 'share']);

  it('marks every tool named for reading read-only', () => {
    const wrong = listed
      .filter((t) => READS.has(verb(t.name)) && t.annotations?.readOnlyHint !== true)
      .map((t) => t.name);
    expect(wrong).toEqual([]);
  });

  it('marks every delete, trash, archive, overwrite and share tool destructive', () => {
    const wrong = listed
      .filter(
        (t) =>
          DESTROYS.has(verb(t.name)) &&
          (t.annotations?.readOnlyHint !== false || t.annotations?.destructiveHint !== true),
      )
      .map((t) => t.name);
    expect(wrong).toEqual([]);
  });

  it('gives every tool a title, and a description under 2,000 characters', () => {
    for (const t of listed) {
      expect(t.title?.trim(), t.name).toBeTruthy();
      expect((t.description ?? '').length, t.name).toBeLessThan(2000);
    }
  });
});
