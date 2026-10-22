import { describe, expect, it } from 'vitest';
import { HERO_FEATURES, heroGreeting, heroPills } from './hero-model';

// Home's hero (docs/specs/013-workspace/explorer-home.md "The hero"): the greeting by hour, the pills' words and
// when they show, and the fanned previews' features.

describe('heroGreeting', () => {
  it('says good morning from 5 to 11, good afternoon from 12 to 17, good evening otherwise', () => {
    expect(heroGreeting(4)).toBe('Good evening,');
    expect(heroGreeting(5)).toBe('Good morning,');
    expect(heroGreeting(11)).toBe('Good morning,');
    expect(heroGreeting(12)).toBe('Good afternoon,');
    expect(heroGreeting(17)).toBe('Good afternoon,');
    expect(heroGreeting(18)).toBe('Good evening,');
    expect(heroGreeting(0)).toBe('Good evening,');
  });
});

describe('heroPills', () => {
  it('counts the projects and says how the Inbox stands', () => {
    expect(heroPills({ projects: 1, inbox: 0 })).toEqual([
      { id: 'projects', label: '1 project', tone: 'emerald' },
      { id: 'inbox', label: 'Inbox is clear', tone: 'sky' },
    ]);
    expect(heroPills({ projects: 9, inbox: 3 }).map((p) => p.label)).toEqual([
      '9 projects',
      '3 open in your Inbox',
    ]);
    expect(heroPills({ projects: 0, inbox: 1 })[0]!.label).toBe('0 projects');
  });

  it('draws a pill only once its count is known', () => {
    expect(heroPills({ projects: undefined, inbox: undefined })).toEqual([]);
    expect(heroPills({ projects: undefined, inbox: 0 }).map((p) => p.id)).toEqual(['inbox']);
    expect(heroPills({ projects: 2, inbox: undefined }).map((p) => p.id)).toEqual(['projects']);
  });
});

describe('HERO_FEATURES', () => {
  it('fans one preview per tab a project holds, the same for everyone', () => {
    expect(HERO_FEATURES.map((f) => f.label)).toEqual(['Board', 'Sheet', 'Dashboard', 'Form']);
  });
});
