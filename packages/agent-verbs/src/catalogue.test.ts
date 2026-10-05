import { describe, expect, it } from 'vitest';
import { parseEditOperations } from '@livediagram/edit-operations';
import { RESOURCE_ALIASES, RESOURCES, TOP_LEVEL, VERBS, verbById, verbsOf } from './catalogue';
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
} from './verbs/local';

// The command a `livediagram …` line names: a top-level verb, or a resource (or alias) and a verb.
function routes(line: string): boolean {
  const words = line.split(/\s+/);
  // Global flags may come first; --host and --profile take a value.
  const [first, second] = words
    .slice(words.indexOf('livediagram') + 1)
    .filter((w, i, all) => !w.startsWith('-') && !['--host', '--profile'].includes(all[i - 1]!));
  if (TOP_LEVEL.some((t) => t === first)) return true;
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
          ? RESOURCES.some((r) => r.name === resource)
          : TOP_LEVEL.some((t) => t === verb.id),
      ).toBe(true);
      expect(verb.cli?.examples.every((e) => routes(e))).toBe(true);
    }
  });

  it('groups verbs under their resource and finds them by id', () => {
    expect(verbsOf('tab').map((v) => v.id)).toEqual(['tab.ls', 'tab.view', 'tab.lint']);
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
