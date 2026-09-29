import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_POLL_STYLE,
  DEFAULT_SESSION_TOOL,
  DEFAULT_TIMER_MINUTES,
  DEFAULT_VOTE_DOTS,
  defaultSessionConfig,
  isPickerSource,
  isSessionTool,
  sessionButtonPlan,
  TIMER_MINUTES_RANGE,
  VOTE_DOTS_RANGE,
  isFixedSizeShape,
  isFixedSizeElement,
} from './selection-mode';
import { POLL_OPTIONS_MAX } from './poll-style';

describe('fixed-size shapes', () => {
  it('names the controls that never take resize handles', () => {
    // The Done check (docs/specs/012-collaboration/done-check.md) joined the two buttons (docs/specs/009-elements/mode-button.md): a roster
    // and a button laid out for their own content, so a bigger box only
    // spreads them over empty card.
    for (const kind of ['mode-button', 'session-button', 'done-check']) {
      expect(isFixedSizeShape(kind)).toBe(true);
    }
    expect(isFixedSizeShape('rectangle')).toBe(false);
    expect(isFixedSizeElement({ type: 'shape', shape: 'done-check' })).toBe(true);
    expect(isFixedSizeElement({ type: 'shape', shape: 'rectangle' })).toBe(false);
  });
});

describe('isSessionTool / isPickerSource', () => {
  it('accepts the known tokens and nothing else', () => {
    expect(isSessionTool('timer')).toBe(true);
    expect(isSessionTool('vote')).toBe(true);
    expect(isSessionTool('poll')).toBe(true);
    expect(isSessionTool('launch-missiles')).toBe(false);
    expect(isSessionTool(undefined)).toBe(false);
    expect(isPickerSource('participants')).toBe(true);
    expect(isPickerSource('options')).toBe(true);
    expect(isPickerSource('everyone')).toBe(false);
  });
});

describe('sessionButtonPlan', () => {
  it('falls back to a default timer for a button with no configuration', () => {
    // An older client, an API write, or a half-built button still presses to
    // something sensible rather than doing nothing.
    expect(sessionButtonPlan(undefined)).toEqual({
      tool: DEFAULT_SESSION_TOOL,
      minutes: DEFAULT_TIMER_MINUTES,
    });
  });

  it('clamps a duration instead of rejecting the element', () => {
    expect(sessionButtonPlan({ tool: 'timer', minutes: 0 })).toEqual({
      tool: 'timer',
      minutes: TIMER_MINUTES_RANGE.min,
    });
    expect(sessionButtonPlan({ tool: 'timer', minutes: 10_000 })).toEqual({
      tool: 'timer',
      minutes: TIMER_MINUTES_RANGE.max,
    });
    // Not a number at all (a string from an import, say) takes the default.
    expect(sessionButtonPlan({ tool: 'timer', minutes: Number.NaN })).toEqual({
      tool: 'timer',
      minutes: DEFAULT_TIMER_MINUTES,
    });
  });

  it('rounds and clamps the dot count the same way', () => {
    expect(sessionButtonPlan({ tool: 'vote', dots: 2.6 })).toEqual({ tool: 'vote', dots: 3 });
    expect(sessionButtonPlan({ tool: 'vote', dots: 99 })).toEqual({
      tool: 'vote',
      dots: VOTE_DOTS_RANGE.max,
    });
    expect(sessionButtonPlan({ tool: 'vote' })).toEqual({ tool: 'vote', dots: DEFAULT_VOTE_DOTS });
  });

  it('builds a poll from the written question and answers', () => {
    expect(
      sessionButtonPlan({ tool: 'poll', question: '  Ship it?  ', options: [' Yes', 'No '] }),
    ).toEqual({
      tool: 'poll',
      style: DEFAULT_SESSION_POLL_STYLE,
      question: 'Ship it?',
      options: ['Yes', 'No'],
    });
  });

  it('carries the configured answer style through to the plan', () => {
    // The bug this pins: the press used to hard-code a free-text poll, so a
    // button with two written answers asked the room to type instead.
    expect(
      sessionButtonPlan({
        tool: 'poll',
        style: 'choice',
        question: 'Tea or coffee?',
        options: ['Tea', 'Coffee'],
      }),
    ).toEqual({
      tool: 'poll',
      style: 'choice',
      question: 'Tea or coffee?',
      options: ['Tea', 'Coffee'],
    });
  });

  it('drops a written list for a style that does not read one', () => {
    // The fixed-set styles answer with Yes / No or 1-5. Shipping a stale
    // list beside them would give the poll two disagreeing answer sets.
    for (const style of ['yesNo', 'yesNoAbstain', 'rating', 'text'] as const) {
      expect(
        sessionButtonPlan({ tool: 'poll', style, question: 'Ready?', options: ['Left', 'Right'] }),
      ).toEqual({ tool: 'poll', style, question: 'Ready?', options: [] });
    }
  });

  it('needs no written answers for a fixed-answer poll', () => {
    // Only Choices can be half-written. A Yes / No button is startable the
    // moment it has a question.
    expect(sessionButtonPlan({ tool: 'poll', style: 'yesNo', question: 'Ready?' })).toEqual({
      tool: 'poll',
      style: 'yesNo',
      question: 'Ready?',
      options: [],
    });
  });

  it('falls back to the default style rather than going inert', () => {
    // A style from a newer client (or a hand-written API payload) still
    // presses to something the author can then fix from the menu.
    const plan = sessionButtonPlan({
      tool: 'poll',
      style: 'ranked-ballot' as never,
      question: 'Which?',
      options: ['A', 'B'],
    });
    expect(plan && 'style' in plan && plan.style).toBe(DEFAULT_SESSION_POLL_STYLE);
  });

  it('refuses a poll that cannot be answered', () => {
    // Fewer than two real answers is a half-written CHOICES button: the face
    // goes inert and says why, rather than opening a poll nobody can respond
    // to.
    expect(sessionButtonPlan({ tool: 'poll', options: ['Only one'] })).toBeNull();
    expect(sessionButtonPlan({ tool: 'poll', options: ['  ', ''] })).toBeNull();
    expect(sessionButtonPlan({ tool: 'poll' })).toBeNull();
  });

  it('caps the answers and names an unnamed poll', () => {
    const plan = sessionButtonPlan({
      tool: 'poll',
      options: Array.from({ length: 20 }, (_, i) => `Option ${i}`),
    });
    expect(plan?.tool).toBe('poll');
    expect(plan && 'options' in plan && plan.options).toHaveLength(POLL_OPTIONS_MAX);
    expect(plan && 'question' in plan && plan.question).toBe('Quick question');
  });
});

describe('defaultSessionConfig', () => {
  it('drops a poll button that reads the answers it ships with', () => {
    // The palette places a working poll (docs/specs/012-collaboration/session-button.md). It carries two answers,
    // so its style has to be the one that reads them.
    const config = defaultSessionConfig('poll');
    expect(config.style).toBe('choice');
    expect(config.options).toHaveLength(2);
    expect(sessionButtonPlan(config)).toMatchObject({ style: 'choice', options: config.options });
  });
});
