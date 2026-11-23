import { describe, expect, it } from 'vitest';
import type { AiSourceLine } from '@liveworkspace/settings-ui/ai-source';
import { answeredBy, askAiView, builtInDetail, itemWords, nothingToReadWords } from './ask-words';

const key: AiSourceLine = {
  kind: 'key',
  owner: 'you',
  provider: 'anthropic',
  model: 'Claude Fable 5.2',
  canChange: true,
};
const failed: AiSourceLine = {
  kind: 'failed',
  owner: 'team',
  provider: 'openai',
  words: 'OpenAI did not accept the API key.',
  canChange: false,
};

describe("Ask AI's words", () => {
  it("use the app's own noun", () => {
    expect(itemWords('liveplanner')).toEqual({ noun: 'Plan', lower: 'plan' });
    expect(builtInDetail('livedesign')).toBe('Included with livedesign, with daily limits');
    expect(nothingToReadWords('livehuddle')).toBe(
      'This space has no text to answer from yet. Add some and ask again.',
    );
  });

  it('say which AI the next question runs on', () => {
    expect(askAiView({ kind: 'loading' }, 'key')).toEqual({
      using: 'loading',
      label: '',
      key: null,
    });
    expect(askAiView({ kind: 'built-in', canChange: true }, 'key')).toEqual({
      using: 'built-in',
      label: 'Built-In AI',
      key: null,
    });
    expect(askAiView(null, 'built-in')).toEqual({
      using: 'built-in',
      label: 'Built-In AI',
      key: null,
    });
    const row = { label: 'Your Key', detail: 'Anthropic · Claude Fable 5.2 · No daily limits' };
    expect(askAiView(key, 'key')).toEqual({
      using: 'key',
      label: 'Claude Fable 5.2 (Your Key)',
      key: row,
    });
    expect(askAiView(key, 'built-in')).toEqual({
      using: 'built-in',
      label: 'Built-In AI',
      key: row,
    });
    const broken = {
      label: 'Your Team’s Key Needs Attention',
      detail: 'OpenAI did not accept the API key.',
    };
    expect(askAiView(failed, 'key')).toEqual({
      using: 'failed',
      label: 'Key Needs Attention',
      key: broken,
    });
    expect(askAiView(failed, 'built-in')).toEqual({
      using: 'built-in',
      label: 'Built-In AI',
      key: broken,
    });
  });

  it('name which AI answered a turn', () => {
    expect(answeredBy(undefined, undefined, key)).toBeNull();
    expect(answeredBy('built-in', 'm', key)).toBe('Built-In AI');
    expect(answeredBy('anthropic', 'claude-fable-5-2', key)).toBe('Claude Fable 5.2');
    expect(answeredBy('openai', 'gpt-x', null)).toBe('gpt-x');
    expect(answeredBy('openai', undefined, { kind: 'built-in', canChange: true })).toBe('OpenAI');
  });
});
