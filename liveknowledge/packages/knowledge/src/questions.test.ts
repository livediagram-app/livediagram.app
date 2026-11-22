import { describe, expect, it } from 'vitest';
import {
  contentWords,
  groupQuestions,
  isStopWord,
  questionKey,
  stemWord,
  wordsOf,
} from './questions';

describe('like questions', () => {
  it('stems lightly', () => {
    expect(['deploys', 'deploying', 'deployed', 'deploy'].map(stemWord)).toEqual([
      'deploy',
      'deploy',
      'deploy',
      'deploy',
    ]);
    expect(['policies', 'policy'].map(stemWord)).toEqual(['policy', 'policy']);
    expect(['running', 'run'].map(stemWord)).toEqual(['run', 'run']);
    expect(['releases', 'release', 'releasing'].map(stemWord)).toEqual([
      'releas',
      'releas',
      'releas',
    ]);
    expect(['boxes', 'box'].map(stemWord)).toEqual(['box', 'box']);
    expect(['access', 'bus', 'is', 'red', 'bell', 'ring'].map(stemWord)).toEqual([
      'access',
      'bus',
      'is',
      'red',
      'bell',
      'ring',
    ]);
  });

  it('reads words without case or punctuation', () => {
    expect(wordsOf('How do WE deploy, exactly?!')).toEqual([
      'how',
      'do',
      'we',
      'deploy',
      'exactly',
    ]);
    expect(wordsOf('?!')).toEqual([]);
    expect(isStopWord('the')).toBe(true);
    expect(isStopWord('deploy')).toBe(false);
  });

  it('drops stop words, unless they are all there is', () => {
    expect(contentWords('How do we deploy the API?')).toEqual(['deploy', 'api']);
    expect(contentWords('Why?')).toEqual(['why']);
  });

  it('gives like questions one key', () => {
    const key = questionKey('How do we deploy the API?');
    expect(key).toBe('api deploy');
    expect(questionKey('how is the api deployed')).toBe(key);
    expect(questionKey('Deploying APIs: how?')).toBe(key);
    expect(questionKey('How do we deploy the app?')).not.toBe(key);
    expect(questionKey(' ?! ')).toBe('');
  });

  it('groups asks, counting people and each agent', () => {
    const groups = groupQuestions([
      { question: ' How do we deploy the API? ', asker: { kind: 'person' } },
      { question: 'how is the api deployed', asker: { kind: 'agent', name: 'Coding Agent' } },
      { question: 'Who owns billing?', asker: { kind: 'agent', name: 'CLI' } },
      { question: 'Deploying the API', asker: { kind: 'person' } },
      { question: 'deploy api', asker: { kind: 'agent', name: 'Coding Agent' } },
      { question: '...', asker: { kind: 'person' } },
    ]);
    expect(groups).toEqual([
      {
        key: 'api deploy',
        question: 'How do we deploy the API?',
        asked: 4,
        people: 2,
        agents: { 'Coding Agent': 2 },
      },
      { key: 'bill own', question: 'Who owns billing?', asked: 1, people: 0, agents: { CLI: 1 } },
    ]);
  });
});
