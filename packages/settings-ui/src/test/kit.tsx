import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { SettingsUiKitProvider, type SettingsUiKit } from '../kit';

// A stand-in for an app's primitives, enough to drive the view in tests.
export const TEST_KIT: SettingsUiKit = {
  Glyph: ({ size = 16, units = 16, className, children }) => (
    <svg width={size} height={size} viewBox={`0 0 ${units} ${units}`} className={className}>
      {children}
    </svg>
  ),
  SearchInput: ({ value, onChange, placeholder, ariaLabel }) => (
    <input
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  CloseButton: ({ onClick }) => (
    <button type="button" aria-label="Close" onClick={onClick}>
      ×
    </button>
  ),
  NoMatches: ({ query, onClear }) => (
    <p>
      No settings match {query}
      <button type="button" onClick={onClear}>
        Clear
      </button>
    </p>
  ),
  HelpLink: ({ article }) => <a href={`/help/${article}`}>Learn more</a>,
  SignInLink: () => <a href="/sign-in">Sign In</a>,
};

export function renderWithKit(ui: ReactElement, kit: SettingsUiKit = TEST_KIT): RenderResult {
  const result = render(<SettingsUiKitProvider kit={kit}>{ui}</SettingsUiKitProvider>);
  return {
    ...result,
    rerender: (next: ReactNode) =>
      result.rerender(<SettingsUiKitProvider kit={kit}>{next}</SettingsUiKitProvider>),
  };
}
