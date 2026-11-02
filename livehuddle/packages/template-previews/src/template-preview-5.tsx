import type { ReactElement } from 'react';
import type { TemplateKind } from '@livehuddle/templates';
import { pv } from '@liveworkspace/template-previews/motion';
import { FILL_BOX } from '@liveworkspace/template-previews/story-parts';

// Group 5 (event storming), split out of template-preview-4.tsx when the hover
// stories pushed it past the ~1000-line budget. Static SVG preview tiles, one
// branch per TemplateKind; TemplatePreview chains the groups with ??.
export function templatePreviewGroup5(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'event-storming':
      // The starter itself (docs/specs/021-event-storming/event-storming.md Phase 1): one orange domain event on a
      // faint timeline, the first thing that happened.
      return (
        <svg width="76" height="40" viewBox="0 0 80 40" aria-hidden>
          <line
            x1="4"
            y1="34"
            x2="76"
            y2="34"
            stroke="rgb(148 163 184)"
            strokeWidth="0.9"
            strokeDasharray="3 2"
          />
          <polygon points="78,34 74,32.2 74,35.8" fill="rgb(148 163 184)" />
          <rect
            x="31"
            y="7"
            width="18"
            height="18"
            rx="1.5"
            fill="rgb(253 186 116)"
            stroke="rgb(249 115 22)"
            strokeWidth="0.9"
            transform="rotate(-3 40 16)"
          />
          {/* "Board Created", scribbled on the note. */}
          <line x1="35" y1="14" x2="45" y2="14" stroke="rgb(154 52 18)" strokeWidth="1" />
          <line x1="35" y1="18" x2="42" y2="18" stroke="rgb(154 52 18)" strokeWidth="1" />
          {/* Hover story: the next domain events are slapped onto the
              timeline, one after the first, one before it. */}
          {[
            [55, 1000],
            [8, 1600],
          ].map(([x, at]) => (
            <g
              key={x}
              className="pv-arrive"
              opacity="0"
              style={{ ...pv({ '--pv-from-y': '-9px', '--pv-at': `${at}ms` }), ...FILL_BOX }}
            >
              <rect
                x={x}
                y="8"
                width="17"
                height="17"
                rx="1.5"
                fill="rgb(253 186 116)"
                stroke="rgb(249 115 22)"
                strokeWidth="0.9"
              />
              <line
                x1={x! + 4}
                y1="14"
                x2={x! + 13}
                y2="14"
                stroke="rgb(154 52 18)"
                strokeWidth="1"
              />
              <line
                x1={x! + 4}
                y1="18"
                x2={x! + 10}
                y2="18"
                stroke="rgb(154 52 18)"
                strokeWidth="1"
              />
            </g>
          ))}
        </svg>
      );
    default:
      return null;
  }
}
