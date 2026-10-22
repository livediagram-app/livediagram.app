'use client';

// The first run's field (docs/specs/013-workspace/explorer-home.md "First run"): the hero's large field, searching
// templates rather than documents (there are none). Enter opens the New document wizard with the words in its search;
// Start Blank inside its end asks which mode, then makes that mode's blank.

import { useState } from 'react';
import { PlusIcon } from '@/components/primitives/explorer-icons';
import { SearchIcon } from '@livedesign/ui';
import { track } from '@/lib/telemetry';
import { HERO_FIELD_LOOK } from '@/app/explorer/lens/LensField';
import {
  WELCOME_COPY,
  WELCOME_START_BLANK_HREF,
  welcomeSearchHref,
} from '@/app/explorer/home/first-run';
import { FOCUS_RING } from './home-styles';
import { assignAppLocation } from '@/lib/app-location';

export function WelcomeSearch() {
  const [words, setWords] = useState('');
  return (
    <form
      role="search"
      className={HERO_FIELD_LOOK.wrap}
      onSubmit={(e) => {
        e.preventDefault();
        track('Home', 'Selected', 'Welcome.Search');
        assignAppLocation(welcomeSearchHref(words));
      }}
    >
      <div className={`flex items-center ${HERO_FIELD_LOOK.box}`}>
        <span aria-hidden className="shrink-0 text-slate-500 dark:text-slate-400">
          <SearchIcon size={HERO_FIELD_LOOK.glyph} />
        </span>
        <input
          type="search"
          aria-label={WELCOME_COPY.searchLabel}
          value={words}
          onChange={(e) => setWords(e.target.value)}
          placeholder={WELCOME_COPY.searchPlaceholder}
          autoComplete="off"
          className={`h-full min-w-[8rem] flex-1 bg-transparent ${HERO_FIELD_LOOK.input} text-slate-900 placeholder:text-slate-500 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-400`}
        />
        <a
          href={WELCOME_START_BLANK_HREF}
          aria-label={WELCOME_COPY.startBlank}
          onClick={() => track('Home', 'Selected', 'Welcome.StartBlank')}
          className={`flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-[18px] text-[15px] font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 ${FOCUS_RING}`}
        >
          <PlusIcon />
          {/* The label folds to the plus on a phone; the link keeps its name. */}
          <span className="hidden sm:inline">{WELCOME_COPY.startBlank}</span>
        </a>
      </div>
    </form>
  );
}
