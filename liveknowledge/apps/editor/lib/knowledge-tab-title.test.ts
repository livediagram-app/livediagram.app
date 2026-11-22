// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { clearLivePageTitle, noteLivePageTitle } from './article/live-page-title';
import { LivePageTabTitle, knowledgeTabTitle } from './knowledge-tab-title';

describe('the browser tab title', () => {
  it('names the page, then the knowledgebase, then the app', () => {
    expect(knowledgeTabTitle('Onboarding', 'Team Wiki')).toBe(
      'Onboarding | Team Wiki | liveknowledge',
    );
  });
  it('leaves the page out while it has no name', () => {
    expect(knowledgeTabTitle('  ', 'Team Wiki')).toBe('Team Wiki | liveknowledge');
    expect(knowledgeTabTitle(undefined, 'Team Wiki')).toBe('Team Wiki | liveknowledge');
  });
});

describe('the browser tab title while the Title is typed', () => {
  afterEach(() => {
    cleanup();
    clearLivePageTitle();
  });
  it('follows the Title as it is typed, and gives the tab back once the page closes', () => {
    document.title = 'Start Here | Team Wiki | liveknowledge';
    render(createElement(LivePageTabTitle, { knowledgebase: 'Team Wiki' }));
    expect(document.title).toBe('Start Here | Team Wiki | liveknowledge');
    act(() => noteLivePageTitle('Release Process'));
    expect(document.title).toBe('Release Process | Team Wiki | liveknowledge');
    act(() => noteLivePageTitle(''));
    expect(document.title).toBe('Team Wiki | liveknowledge');
    act(() => clearLivePageTitle());
    expect(document.title).toBe('Team Wiki | liveknowledge');
  });
});
