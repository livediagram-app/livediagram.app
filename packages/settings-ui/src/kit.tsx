'use client';

import { createContext, useContext, type ComponentType, type ReactNode } from 'react';

// What the view borrows from the app it is drawn in: the app's own primitives, so the dialog reads as
// part of that app (its glyph weight, its search box, its help centre), while the view itself stays
// app-agnostic. Every product's UI package has these with the same shape.
export type SettingsUiKit = {
  // The chrome-icon base: a square, stroke-currentColor, decorative SVG (each product's `Glyph`).
  Glyph: ComponentType<{
    size?: number;
    units?: number;
    className?: string;
    children?: ReactNode;
  }>;
  SearchInput: ComponentType<{
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    ariaLabel: string;
    clearAriaLabel: string;
    clearDescription: string;
  }>;
  // The header's close button.
  CloseButton: ComponentType<{ onClick: () => void }>;
  NoMatches: ComponentType<{
    size: 'regular';
    className?: string;
    things: string;
    query: string;
    onClear: () => void;
  }>;
  // A row's or a section note's "Learn more" link. Absent: no link.
  HelpLink?: ComponentType<{ article: string }>;
  // The Sign In link a note row ends with. Absent: no link.
  SignInLink?: ComponentType;
  // A row's drawing. Absent: none.
  Illustration?: ComponentType<SettingsIllustrationProps>;
};

export type SettingsIllustrationProps = {
  id: string;
  // Toggle drawings: which half is in force.
  active?: boolean;
  // Choice drawings: the option in force.
  value?: string;
  onToggle?: (on: boolean) => void;
  onChoose?: (value: string) => void;
  disabledValues?: readonly string[];
};

// Without a provider (a row rendered on its own, in a test say): plain stand-ins, and no help links,
// Sign In link or drawings. Every app's Settings provides its own kit.
const PLAIN_KIT: SettingsUiKit = {
  Glyph: ({ size = 16, units = 16, className, children }) => (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${units} ${units}`}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  ),
  SearchInput: ({ value, onChange, placeholder, ariaLabel }) => (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-200 bg-white py-1 pr-7 pl-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
    />
  ),
  CloseButton: ({ onClick }) => (
    <button type="button" aria-label="Close" onClick={onClick}>
      ×
    </button>
  ),
  NoMatches: ({ things, query, className }) => (
    <p className={className}>
      No {things} match “{query}”.
    </p>
  ),
};

const Kit = createContext<SettingsUiKit>(PLAIN_KIT);

export function SettingsUiKitProvider({
  kit,
  children,
}: {
  kit: SettingsUiKit;
  children: ReactNode;
}) {
  return <Kit.Provider value={kit}>{children}</Kit.Provider>;
}

export function useSettingsUiKit(): SettingsUiKit {
  return useContext(Kit);
}
