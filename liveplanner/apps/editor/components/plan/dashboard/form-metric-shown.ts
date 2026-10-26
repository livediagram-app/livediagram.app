// What a figure from a form shows (docs/specs/026-plan/plan-tabs.md "Form Metrics"), worked out from the form and its
// link as the Form tab's status bar reads them. Pure: DashboardFormMetric draws it.
import type { FormMetricKind } from '@liveplanner/project';
import { closedBySettings, type FormDefinition } from '@liveplanner/forms';
import type { FormLinkResponse } from '@liveplanner/api-schema';

export type FormMetricTone = 'green' | 'amber' | 'red' | 'slate';

type FormMetricShown = {
  // The figure, large ("142", "3 days", "Accepting"), or null for a card whose body is its link.
  hero: string | null;
  // The line under it.
  line: string;
  // A status's colour.
  tone?: FormMetricTone;
  // Responses against the limit, 0 to 1.
  share?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
// The local calendar day an instant falls on, as a whole number of days, so "days until" counts calendar days
// rather than 24-hour blocks (a form closing at 9am tomorrow is "1 day" away at 5pm today, never "Today").
const localDay = (at: number) => {
  const d = new Date(at);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const dayOf = (at: number) =>
  new Date(at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export function formMetricShown(
  metric: FormMetricKind,
  input: {
    form: Pick<FormDefinition, 'heading' | 'limit' | 'closesAt'>;
    // The link as read; null while it loads; `offline` for a project with no server.
    link: FormLinkResponse | null;
    offline: boolean;
    now: number;
  },
): FormMetricShown {
  const { form, link, offline, now } = input;
  const responses = link?.responses ?? 0;
  const live = link?.link ?? null;
  switch (metric) {
    case 'responses':
      return { hero: responses.toLocaleString('en-GB'), line: 'responses so far' };
    case 'new':
      return {
        hero: (link?.unseen ?? 0).toLocaleString('en-GB'),
        line: link?.unseen
          ? 'new to you since you last looked'
          : 'nothing new since you last looked',
      };
    case 'status':
      if (offline) return { hero: 'Draft', line: 'Kept on this device only', tone: 'slate' };
      if (link?.suspendedAt && !live)
        return { hero: 'Suspended', line: 'After reports from respondents', tone: 'red' };
      if (!live)
        return { hero: 'Not Published', line: 'Publish it from Share Form', tone: 'slate' };
      return live.open && !closedBySettings(form, { responses, now })
        ? { hero: 'Accepting', line: plural(responses, 'response', 'responses'), tone: 'green' }
        : { hero: 'Closed', line: 'Not taking responses', tone: 'amber' };
    case 'limit':
      if (!form.limit)
        return { hero: 'No limit', line: plural(responses, 'response', 'responses') };
      return {
        hero: `${responses.toLocaleString('en-GB')} / ${form.limit.toLocaleString('en-GB')}`,
        line: responses >= form.limit ? 'The limit is reached' : `${form.limit - responses} to go`,
        share: Math.min(1, responses / form.limit),
      };
    case 'closes': {
      if (!form.closesAt) return { hero: 'No date', line: 'Takes responses until you close it' };
      if (form.closesAt <= now) return { hero: 'Closed', line: `Closed ${dayOf(form.closesAt)}` };
      const days = localDay(form.closesAt) - localDay(now);
      return {
        hero: days <= 0 ? 'Today' : plural(days, 'day', 'days'),
        line: `Closes ${dayOf(form.closesAt)}`,
      };
    }
    case 'link':
      return {
        hero: null,
        line: live ? 'Anyone with the link can fill it in' : 'Publish it from Share Form',
      };
  }
}
