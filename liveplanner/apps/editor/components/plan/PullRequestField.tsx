'use client';

// A Pull Request field in the card panel (docs/specs/026-plan/github-pull-requests.md "The Pull Request field"): an
// address box that keeps any address of a pull request as its canonical one, and an Open on GitHub button for anyone
// who can see the card. An address that names no pull request goes back to the saved value. Under it, once the plan has
// heard of the pull request from GitHub, its state as a chip and its title ("Pull request state on cards").
import { TextInput, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideExternalLink } from '@liveworkspace/icons/lucide';
import {
  PULL_REQUEST_TEXT_MAX,
  parsePullRequestUrl,
  pullRequestText,
  pullRequestUrl,
  pullRequestValueOf,
} from '@liveplanner/items';
import { usePullRequestStatus } from './pull-request-store';
import { PullRequestChip } from './PullRequestPill';

const OpenIcon = lucideGlyph(lucideExternalLink, 14);

// The link goes out only when it is an https address on github.com, checked on the parsed URL right here (the address is built from a parsed pull request, so it always parses).
export function githubHref(address: string): string | undefined {
  const url = new URL(address);
  return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : undefined;
}

export function PullRequestField({
  id,
  value,
  disabled,
  onSave,
}: {
  id: string;
  value: string;
  disabled: boolean;
  onSave: (value: string | undefined) => void;
}) {
  const ref = parsePullRequestUrl(value);
  const href = ref ? githubHref(pullRequestUrl(ref)) : undefined;
  const status = usePullRequestStatus(ref);
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <TextInput
          id={id}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://github.com/owner/repo/pull/123"
          maxLength={PULL_REQUEST_TEXT_MAX}
          disabled={disabled}
          compact
          defaultValue={value}
          key={value}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            if (raw === value) return;
            if (raw === '') return onSave(undefined);
            const url = pullRequestValueOf(raw);
            if (url === undefined) e.target.value = value;
            else if (url === value) e.target.value = value;
            else onSave(url);
          }}
        />
        {ref && href ? (
          <Tooltip label="Open on GitHub">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${pullRequestText(ref)} on GitHub (opens in a new tab)`}
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
            >
              <OpenIcon />
            </a>
          </Tooltip>
        ) : null}
      </div>
      {status ? (
        <div data-pull-request-state="" className="mt-1.5 flex min-w-0 items-start gap-2">
          <PullRequestChip status={status} />
          {status.title ? (
            <span className="line-clamp-2 min-w-0 text-[12px] text-slate-600 [overflow-wrap:anywhere] dark:text-slate-300">
              {status.title}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
