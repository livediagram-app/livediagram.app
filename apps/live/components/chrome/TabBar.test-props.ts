import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import type { TabBar } from './TabBar';

// Shared fixture for the TabBar component tests: every callback a no-op,
// only the data the bar renders is real.
export type TabBarProps = ComponentProps<typeof TabBar>;

export const TWO_TABS: Tab[] = [
  { id: 't1', name: 'First', elements: [] },
  { id: 't2', name: 'Second', elements: [] },
];

export function tabBarProps(over: Partial<TabBarProps>): TabBarProps {
  const base = {
    tabs: TWO_TABS,
    activeId: 't1',
    activeTabHasContent: false,
    otherDocuments: [],
    participantsByTab: new Map(),
    selfId: 'me',
    selfRole: 'edit' as const,
    ...over,
  };
  return new Proxy(base, {
    get: (target, key) => (key in target ? target[key as keyof typeof target] : vi.fn()),
    has: () => true,
  }) as unknown as TabBarProps;
}
