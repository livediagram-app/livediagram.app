import { describe, expect, it } from 'vitest';
import {
  agentCommentMarks,
  COMMENT_AGENT_MAX,
  commentAgentName,
  threadAiState,
} from './comment-ai';

const person = (at: number) => ({ createdAt: at });
const ai = (at: number, agent = 'Claude', needsResponse = false) => ({
  createdAt: at,
  ai: true,
  agent,
  ...(needsResponse ? { needsResponse: true } : {}),
});

describe('threadAiState', () => {
  it('says nothing of an empty thread or one people alone wrote in', () => {
    expect(threadAiState([])).toEqual({});
    expect(threadAiState([person(1), person(2)])).toEqual({});
  });

  it('is quiet when only agents wrote and none asked', () => {
    expect(threadAiState([ai(1), ai(2, 'Cursor')])).toEqual({
      latestAgent: 'Cursor',
      aiState: 'quiet',
    });
  });

  it('asks while an asking comment is newer than every person’s', () => {
    expect(threadAiState([ai(1, 'Claude', true)])).toEqual({
      latestAgent: 'Claude',
      aiState: 'ask',
    });
    expect(threadAiState([person(1), ai(2, 'Claude', true), ai(3)])).toEqual({
      latestAgent: 'Claude',
      aiState: 'ask',
    });
  });

  it('a person’s reply after the ask ends it', () => {
    expect(threadAiState([ai(1, 'Claude', true), person(2)])).toEqual({});
  });

  it('marks an agent’s latest comment in a thread people wrote in, and reads any order', () => {
    expect(threadAiState([ai(5), person(1)])).toEqual({ latestAgent: 'Claude' });
  });

  it('names an agent with no name AI', () => {
    expect(threadAiState([{ createdAt: 1, ai: true }])).toEqual({
      latestAgent: 'AI',
      aiState: 'quiet',
    });
  });
});

describe('commentAgentName', () => {
  it('trims, folds control characters and cuts', () => {
    expect(commentAgentName('  Claude\u0007 Code \n')).toBe('Claude Code');
    expect(commentAgentName('x'.repeat(500))).toHaveLength(COMMENT_AGENT_MAX);
    expect(commentAgentName('   ')).toBeNull();
    expect(commentAgentName(7)).toBeNull();
  });
});

describe('agentCommentMarks', () => {
  it('keeps the name and a true ask alone', () => {
    expect(agentCommentMarks('Claude', { needsResponse: true })).toEqual({
      agent: 'Claude',
      needsResponse: true,
    });
    expect(agentCommentMarks(null, { needsResponse: 'yes' })).toEqual({});
  });
});
