// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/030-knowledgebase/search-and-ask.md "AI Settings": the knowledgebase menu opens AI Settings over Pages,
// with or without Describe to Add Pages open.
const state = vi.hoisted(() => ({
  settings: false,
  view: 'pages',
  mode: null as string | null,
  offered: true,
}));

vi.mock('next/dynamic', () => ({
  default: (load: () => Promise<unknown>) => {
    const name = load.toString().includes('AiSettingsDialog') ? 'ai-settings' : 'setup-dialog';
    return () => <div data-testid={name} />;
  },
}));
vi.mock('@/lib/knowledge-ask/ai-settings-open', () => ({
  useAiSettingsOpen: () => state.settings,
}));
vi.mock('@/lib/knowledge-ask/useKnowledgeView', () => ({ useKnowledgeView: () => state.view }));
vi.mock('@/lib/knowledge-setup/setup-open', () => ({
  closeSetup: vi.fn(),
  openSetup: vi.fn(),
  publishSetupOffered: vi.fn(),
  useSetupOpen: () => state.mode,
}));
vi.mock('./useSetupOffered', () => ({ useSetupOffered: () => state.offered }));

import { SetupWhenOpen } from './SetupHost';

beforeEach(() => {
  Object.assign(state, { settings: false, view: 'pages', mode: null, offered: true });
});

describe('SetupWhenOpen', () => {
  it('draws nothing while neither is open', () => {
    const { container } = render(<SetupWhenOpen />);
    expect(container.innerHTML).toBe('');
  });

  it('draws AI Settings over Pages without Describe open (the knowledgebase menu)', () => {
    state.settings = true;
    render(<SetupWhenOpen />);
    expect(screen.getByTestId('ai-settings')).toBeTruthy();
    expect(screen.queryByTestId('setup-dialog')).toBeNull();
  });

  it('leaves AI Settings to the views over Ask', () => {
    Object.assign(state, { settings: true, view: 'ask' });
    const { container } = render(<SetupWhenOpen />);
    expect(container.innerHTML).toBe('');
  });

  it('draws Describe and AI Settings together', () => {
    Object.assign(state, { settings: true, mode: 'describe' });
    render(<SetupWhenOpen />);
    expect(screen.getByTestId('setup-dialog')).toBeTruthy();
    expect(screen.getByTestId('ai-settings')).toBeTruthy();
  });
});
