'use client';

import type { ReactNode } from 'react';
import { BrandMark } from '@livediagram/ui';
import { PlacementCard } from '@/components/placement/PlacementCard';
import { SAVE_LOCATIONS, type SaveLocationId } from '@/lib/save-locations';

// The Save location row of the New Diagram wizard (spec/141): one tile per
// catalogue entry, radio semantics. Built on the Save In row's PlacementCard
// so the two rows below the name field read as one family. The host step
// owns the field label; this is just the group.

export function SaveLocationPicker({
  value,
  onChange,
}: {
  value: SaveLocationId;
  onChange: (v: SaveLocationId) => void;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      role="radiogroup"
      aria-label="Save location"
    >
      {SAVE_LOCATIONS.map((loc) => (
        <PlacementCard
          key={loc.id}
          label={loc.label}
          sub={loc.description}
          icon={LOCATION_ICONS[loc.id]}
          selected={value === loc.id}
          onSelect={() => onChange(loc.id)}
        />
      ))}
    </div>
  );
}

// Tile glyphs, keyed on the id so a new location without one is a compile
// error rather than a blank tile. livediagram is the brand mark the site
// header uses (same component, not a redraw); Local Browser is a browser
// window. Both sized to the PlacementCard icon slot.
const LOCATION_ICONS: Record<SaveLocationId, ReactNode> = {
  livediagram: <BrandMark className="h-5 w-5" />,
  browser: <BrowserWindowIcon />,
};

function BrowserWindowIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="4" width="15" height="12" rx="2" />
      <path d="M2.5 7.5h15" />
      <path d="M5 5.8h.01M7.2 5.8h.01" />
    </svg>
  );
}
