// @vitest-environment jsdom

// Insights' topics and their address (docs/specs/030-knowledgebase/insights.md "A topic's page"): read from the
// query both ways, unknown ones left out, the history entries a topic makes, and the steps back past it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attentionShowOf,
  backToInsightsDashboard,
  insightsStepsBack,
  insightsTopicLabel,
  insightsTopicOf,
  insightsTopicQuery,
  INSIGHTS_TOPICS,
  resetInsightsTopic,
  showInsightsTopic,
} from './insights-topic';
import {
  backFromKnowledgeView,
  knowledgeViewHref,
  resetKnowledgeViewTrail,
  showKnowledgeView,
  subscribeKnowledgeView,
} from './knowledge-view';

let off = () => {};
beforeEach(() => {
  window.history.replaceState(null, '', '/document/d1');
  off = subscribeKnowledgeView(() => {});
});
afterEach(() => {
  off();
  resetInsightsTopic();
  resetKnowledgeViewTrail();
  vi.restoreAllMocks();
});

describe('the address', () => {
  it('names a topic and a filter, and nothing it does not know', () => {
    expect(INSIGHTS_TOPICS.map((t) => t.topic)).toEqual(['attention', 'health', 'reads', 'agents']);
    expect(insightsTopicLabel('reads')).toBe('Reading');
    expect(insightsTopicOf('?view=insights&topic=health')).toBe('health');
    expect(insightsTopicOf('?view=insights')).toBeNull();
    expect(insightsTopicOf('?topic=elsewhere')).toBeNull();
    expect(attentionShowOf('?show=conflicts')).toBe('conflicts');
    expect(attentionShowOf('?show=all')).toBe('all');
    expect(attentionShowOf('?show=nothing')).toBe('all');
    expect(attentionShowOf('')).toBe('all');
  });

  it('adds a topic and its filter, the filter only for Needs Attention and only when not All', () => {
    expect(insightsTopicQuery(null)).toEqual({});
    expect(insightsTopicQuery('health', 'questions')).toEqual({ topic: 'health' });
    expect(insightsTopicQuery('attention')).toEqual({ topic: 'attention' });
    expect(insightsTopicQuery('attention', 'suggestions')).toEqual({
      topic: 'attention',
      show: 'suggestions',
    });
  });

  it('is dropped by another view’s address, so the footer never carries it', () => {
    expect(
      knowledgeViewHref('/document/d1?view=insights&topic=attention&show=conflicts#t=p1', 'ask'),
    ).toBe('/document/d1?view=ask#t=p1');
    expect(knowledgeViewHref('/document/d1?s=abc&view=insights&topic=reads', 'pages')).toBe(
      '/document/d1?s=abc',
    );
    expect(knowledgeViewHref('/document/d1', 'insights', { topic: 'agents' })).toBe(
      '/document/d1?view=insights&topic=agents',
    );
  });
});

describe('moving between them', () => {
  it('opens a topic from the dashboard as a new entry, and the BackBar is the browser’s Back', async () => {
    showKnowledgeView('insights');
    const push = vi.spyOn(window.history, 'pushState');
    showInsightsTopic('health');
    expect(window.location.search).toBe('?view=insights&topic=health');
    expect(push).toHaveBeenCalledTimes(1);
    expect(insightsStepsBack()).toBe(1);
    const back = vi.spyOn(window.history, 'back');
    backToInsightsDashboard();
    expect(back).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(window.location.search).toBe('?view=insights'));
    expect(insightsStepsBack()).toBe(0);
  });

  it('replaces the entry for a filter, and for a topic opened by its address', () => {
    window.history.replaceState(null, '', '/document/d1?view=insights&topic=attention');
    const push = vi.spyOn(window.history, 'pushState');
    showInsightsTopic('attention', { show: 'questions', replace: true });
    expect(window.location.search).toBe('?view=insights&topic=attention&show=questions');
    expect(push).not.toHaveBeenCalled();
    // Opened by its address: no dashboard behind it, so going back replaces it with the dashboard.
    expect(insightsStepsBack()).toBe(0);
    const back = vi.spyOn(window.history, 'back');
    backToInsightsDashboard();
    expect(back).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?view=insights');
  });

  it('opens a topic straight from Pages with Pages, not the dashboard, behind it', () => {
    showInsightsTopic('attention', { show: 'suggestions' });
    expect(window.location.search).toBe('?view=insights&topic=attention&show=suggestions');
    expect(insightsStepsBack()).toBe(0);
  });

  it('takes the header’s chevron past the topic to the view before', async () => {
    showKnowledgeView('ask');
    showKnowledgeView('insights');
    showInsightsTopic('reads');
    const go = vi.spyOn(window.history, 'go');
    backFromKnowledgeView(insightsStepsBack());
    expect(go).toHaveBeenCalledWith(-2);
    await vi.waitFor(() => expect(window.location.search).toBe('?view=ask'));
  });

  it('leaves a topic for its dashboard from the same view, and does nothing on the dashboard', () => {
    window.history.replaceState(null, '', '/document/d1?view=insights&topic=agents');
    const push = vi.spyOn(window.history, 'pushState');
    showKnowledgeView('insights');
    expect(window.location.search).toBe('?view=insights');
    expect(push).toHaveBeenCalledTimes(1);
    showKnowledgeView('insights');
    expect(push).toHaveBeenCalledTimes(1);
  });
});
