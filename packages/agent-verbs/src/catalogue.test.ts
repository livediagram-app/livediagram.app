import { describe, expect, it } from 'vitest';
import { parseEditOperations } from '@livediagram/edit-operations';
import {
  COMMAND_ALIASES,
  countedVerbs,
  RESOURCE_ALIASES,
  RESOURCES,
  TOP_LEVEL,
  VERBS,
  verbById,
  verbsOf,
} from './catalogue';
import { GUIDE_TOPIC_NAMES, GUIDE_TOPICS, isGuideTopic } from './guides';
import { renderSkill, SKILL_NAME } from './skill';
import {
  authLogin,
  authLogout,
  authStatus,
  guide,
  skillInstall,
  skillPrint,
  apiCall,
  telemetryOn,
  exportAll,
  pull,
  push,
  waitFor,
  watch,
} from './verbs/local';

// The command a `livediagram …` line names: a top-level verb, or a resource (or alias) and a verb.
function routes(line: string): boolean {
  const words = line.split(/\s+/);
  // Global flags may come first; --host and --profile take a value.
  const [first, second] = words
    .slice(words.indexOf('livediagram') + 1)
    .filter((w, i, all) => !w.startsWith('-') && !['--host', '--profile'].includes(all[i - 1]!));
  if (TOP_LEVEL.some((t) => t === first) || first! in COMMAND_ALIASES) return true;
  const resource = RESOURCE_ALIASES[first!] ?? first!;
  return verbById(`${resource}.${second}`) !== undefined;
}

// Commands as written to be run: on their own line, in backticks, in parentheses, or after a pipe.
const commandsIn = (text: string) =>
  [...text.matchAll(/(?:^\s*|[`(|]\s*)(livediagram [a-z]+(?: [a-z]+)?)/gm)].map((m) => m[1]!);
describe('the catalogue', () => {
  it('gives every verb a unique id, a resource or a top-level place, and a CLI projection', () => {
    expect(new Set(VERBS.map((v) => v.id)).size).toBe(VERBS.length);
    for (const verb of VERBS) {
      const [resource] = verb.id.split('.');
      expect(
        verb.id.includes('.')
          ? RESOURCES.some((r) => r.name === resource) ||
              Object.values(COMMAND_ALIASES).includes(verb.id)
          : TOP_LEVEL.some((t) => t === verb.id),
      ).toBe(true);
      expect(verb.cli?.examples.every((e) => routes(e))).toBe(true);
    }
  });

  // The CLI hands a verb its words and flag values as strings, and a trailing `...name` positional as a list of
  // words: a field that takes a number must take its digits as text, and a rest field must take the list.
  it('takes every value as the CLI hands it over', () => {
    const wrong: string[] = [];
    for (const verb of VERBS) {
      const shape = verb.input.shape as Record<
        string,
        { safeParse: (v: unknown) => { success: boolean } }
      >;
      const rest = verb.cli?.positionals.find((p) => p.startsWith('...'))?.slice(3);
      for (const [key, field] of Object.entries(shape)) {
        if (key === rest) {
          if (!field.safeParse(['two', 'words']).success) wrong.push(`${verb.id} ${key} as words`);
        } else if (field.safeParse(5).success && !field.safeParse('5').success) {
          wrong.push(`${verb.id} ${key} as digits`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('describes each verb as facts, never as instructions to the caller (MCP §4.15)', () => {
    const directive = /\b(you must|you should|do not|don't|never use|always use|make sure)\b/i;
    expect(
      VERBS.filter((v) => directive.test(`${v.summary} ${v.description}`)).map((v) => v.id),
    ).toEqual([]);
  });

  it('counts every verb that reaches a host, except the count itself', () => {
    const counted = countedVerbs().map((v) => v.id);
    expect(counted).not.toContain('guide');
    expect(counted).not.toContain('telemetry.off');
    expect(counted).toContain('tab.view');
    expect(VERBS.filter((v) => v.offline).map((v) => v.id)).toEqual([
      'graph.lint',
      'guide',
      'skill.print',
      'skill.install',
    ]);
  });

  it('groups verbs under their resource and finds them by id', () => {
    expect(verbsOf('tab').map((v) => v.id)).toEqual([
      'tab.ls',
      'tab.view',
      'tab.lint',
      'tab.diff',
      'tab.add',
      'tab.rename',
      'tab.rm',
    ]);
    expect(Object.values(COMMAND_ALIASES).every((id) => verbById(id))).toBe(true);
    expect(verbById('nope')).toBeUndefined();
    expect(Object.values(RESOURCE_ALIASES).every((r) => RESOURCES.some((x) => x.name === r))).toBe(
      true,
    );
  });
});

describe('the guides and the skill', () => {
  it('name only commands that exist', () => {
    const texts = [renderSkill(), ...GUIDE_TOPIC_NAMES.map((t) => GUIDE_TOPICS[t].text)];
    const missing = texts.flatMap(commandsIn).filter((line) => !routes(line));
    expect(missing).toEqual([]);
  });

  it('teach edit operations that parse', () => {
    const lines = GUIDE_TOPICS.build.text.split('\n').filter((l) => /^ {2}(add|connect) /.test(l));
    expect(lines).toHaveLength(3);
    expect(parseEditOperations(lines.map((l) => l.trim()).join('\n'))).toHaveProperty('operations');
  });

  it('tells a topic from a stranger', () => {
    expect(isGuideTopic('edit')).toBe(true);
    expect(isGuideTopic('nope')).toBe(false);
  });

  it('open the skill with its name in the frontmatter', () => {
    expect(renderSkill()).toMatch(
      new RegExp(`^---\\nname: ${SKILL_NAME}\\ndescription: .+\\n---\\n`),
    );
  });
});

describe('the verbs the CLI handles', () => {
  it('print their output as lines', () => {
    expect(guide.text!({ text: 'g' })).toEqual(['g']);
    expect(skillPrint.text!({ text: 's' })).toEqual(['s']);
    expect(skillInstall.text!({ path: '/p' })).toEqual(['/p']);
    expect(apiCall.text!({ text: '{}', status: 200 })).toEqual(['{}']);
    expect(authLogin.text!({ host: 'https://h', account: 'Ada' })).toEqual([
      'signed in to https://h as Ada',
    ]);
    expect(authLogout.text!({ host: 'https://h' })).toEqual(['signed out of https://h']);
    expect(telemetryOn.text!({ telemetry: 'on' })).toEqual(['telemetry on']);
    // The room stream: wait prints its lines (JSON keeps them) and exits as it ended; watch printed as it went.
    const ended = { lines: ['nothing new in 5 s'], exit: 1 };
    expect([waitFor.text!(ended), waitFor.json!(ended), waitFor.exitCode!(ended)]).toEqual([
      ended.lines,
      { lines: ended.lines },
      1,
    ]);
    expect([watch.text!(ended), watch.json!(ended), watch.exitCode!(ended)]).toEqual([
      ended.lines,
      undefined,
      1,
    ]);
    expect([push.text!(ended), push.json!(ended), push.exitCode!(ended)]).toEqual([
      ended.lines,
      { lines: ended.lines },
      1,
    ]);
    expect([pull.text!({ paths: ['a'] }), pull.quiet!({ paths: ['a'] })]).toEqual([['a'], ['a']]);
    expect(exportAll.text!({ paths: ['a'], documents: 1, exit: 0 })).toEqual([
      'a',
      '1 document · 1 file',
    ]);
    expect(exportAll.text!({ paths: ['a', 'b'], documents: 2, exit: 0 })).toEqual([
      'a',
      'b',
      '2 documents · 2 files',
    ]);
    expect([
      exportAll.quiet!({ paths: ['a'], documents: 1, exit: 0 }),
      exportAll.exitCode!({ paths: [], documents: 0, exit: 6 }),
    ]).toEqual([['a'], 6]);
    expect(
      authStatus.text!({
        host: 'https://h',
        account: 'Ada',
        token: 'cli',
        role: 'full',
        expires: 'never',
        source: 'env',
      }),
    ).toEqual([
      'host     https://h',
      'account  Ada',
      'token    cli',
      'role     full',
      'expires  never',
      'source   env',
    ]);
  });
});
