// liveplanner's own settings as liveworkspace.app shows them: generated from its Settings catalogue by
// deriveCatalogue (../catalogue.ts). Don't edit by hand: run its settings-site-catalogue test with
// UPDATE_SITE_CATALOGUE=1.
import type { AppCatalogue } from '../catalogue';

export const CATALOGUE: AppCatalogue = {
  categories: [
    {
      id: 'collaborate',
      label: 'Panels › Collaborate',
      rows: [
        {
          kind: 'toggle',
          id: 'collaboratePanelEnabled',
          label: 'Enable Collaborate Panel',
          description:
            "Lists the tab's comments and actions, behind a corner button that shows once there are some. Off, they still work on the elements.",
          key: 'collaboratePanelEnabled',
          on: true,
          off: false,
          fallback: true,
        },
      ],
    },
    {
      id: 'tours',
      label: 'Tours',
      rows: [
        {
          kind: 'toggle',
          id: 'formTourSeen',
          label: 'Forms Tour',
          description: 'The first time you open a Form tab.',
          section: 'Offer Again',
          key: 'formTourSeen',
          on: false,
          off: true,
          fallback: true,
        },
      ],
    },
    {
      id: 'projects',
      label: 'Plans',
      rows: [
        {
          kind: 'toggle',
          id: 'homeBanner',
          label: 'Show Home Banner',
          description:
            "The greeting, status pills and large search at the top of Explorer Home. When it's hidden, Home's search sits in the header, as on every other Explorer page.",
          section: 'Explorer',
          key: 'homeBanner',
          on: true,
          off: false,
          fallback: true,
        },
      ],
    },
    {
      id: 'notifications',
      label: 'Account › Notifications',
      rows: [
        {
          kind: 'toggle',
          id: 'notifyProjectJoin',
          label: 'Someone Joins My Plan',
          description: 'A new person opens one of your shared plans.',
          section: 'Email',
          key: 'notifyProjectJoin',
          on: true,
          off: false,
          fallback: true,
        },
        {
          kind: 'toggle',
          id: 'notifyFormResponses',
          label: 'Someone Fills In My Form',
          description:
            'Someone responds to a form in a plan you own (at most one email every 15 minutes per form).',
          section: 'Email',
          key: 'notifyFormResponses',
          on: true,
          off: false,
          fallback: true,
        },
      ],
    },
  ],
};
