'use client';

// The first run's fanned sheets (docs/specs/013-workspace/explorer-home.md "First run"): three template previews in
// the places the newest documents take, so a person with nothing yet sees what can be made. Loaded only for a first
// run, with the previews it draws.

import { TemplatePicture } from '@/components/start/template-card';
import { WELCOME_FAN } from '@/app/explorer/home/first-run-starts';
import { SHEET_FRAME, SHEET_PLACES } from './home-styles';

export function HeroTemplateFan() {
  return (
    <>
      {WELCOME_FAN.map((kind, i) => (
        <span key={kind} data-hero-sheet={kind} className={`${SHEET_FRAME} ${SHEET_PLACES[i]}`}>
          <TemplatePicture kind={kind} />
        </span>
      ))}
    </>
  );
}
