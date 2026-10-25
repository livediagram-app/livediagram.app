// liveplanner's own settings as liveworkspace.app shows them: generated from its Settings catalogue by
// deriveCatalogue (../catalogue.ts). Don't edit by hand: run its settings-site-catalogue test with
// UPDATE_SITE_CATALOGUE=1.
import type { AppCatalogue } from '../catalogue';

export const CATALOGUE: AppCatalogue = {
  shared: [
    {
      key: 'dockButtonNames',
      on: true,
      off: false,
      fallback: true,
      event: {
        category: 'UI',
        on: 'DockButtonNamesOn',
        off: 'DockButtonNamesOff',
      },
    },
    {
      key: 'minimalChrome',
      on: true,
      off: false,
      fallback: true,
      event: {
        category: 'UI',
        on: 'MinimalChromeOn',
        off: 'MinimalChromeOff',
      },
    },
    {
      key: 'notificationsEnabled',
      on: true,
      off: false,
      fallback: true,
      event: {
        category: 'UI',
        on: 'NotificationsOn',
        off: 'NotificationsOff',
      },
    },
    {
      key: 'notifyActionAssigned',
      on: true,
      off: false,
      fallback: true,
      event: {
        category: 'UI',
        on: 'NotifyActionAssignedOn',
        off: 'NotifyActionAssignedOff',
      },
    },
    {
      key: 'notifyComments',
      on: true,
      off: false,
      fallback: true,
      event: {
        category: 'UI',
        on: 'NotifyCommentsOn',
        off: 'NotifyCommentsOff',
      },
    },
    {
      key: 'notifyInviteResponse',
      on: true,
      off: false,
      fallback: true,
      event: {
        category: 'UI',
        on: 'NotifyInviteResponseOn',
        off: 'NotifyInviteResponseOff',
      },
    },
    {
      key: 'notifyMentions',
      on: true,
      off: false,
      fallback: true,
      event: {
        category: 'UI',
        on: 'NotifyMentionsOn',
        off: 'NotifyMentionsOff',
      },
    },
    {
      key: 'notifyMilestones',
      on: true,
      off: false,
      fallback: true,
      event: {
        category: 'UI',
        on: 'NotifyMilestonesOn',
        off: 'NotifyMilestonesOff',
      },
    },
    {
      key: 'notifyTips',
      on: true,
      off: false,
      fallback: true,
      event: {
        category: 'UI',
        on: 'NotifyTipsOn',
        off: 'NotifyTipsOff',
      },
    },
    {
      key: 'reduceMotion',
      on: true,
      off: false,
      fallback: false,
      event: {
        category: 'UI',
        on: 'ReduceMotionOn',
        off: 'ReduceMotionOff',
      },
    },
    {
      key: 'telemetryEnabled',
      on: true,
      off: false,
      fallback: true,
      event: {
        category: 'UI',
        on: 'TelemetryOn',
        off: 'TelemetryOff',
      },
    },
  ],
  categories: [
    {
      id: 'collaborate',
      label: 'Panels › Collaborate',
      tile: 'panels',
      rows: [
        {
          kind: 'toggle',
          id: 'collaboratePanelEnabled',
          label: 'Enable Collaborate Panel',
          description:
            "Lists the tab's comments and actions, behind a corner button that shows once there are some. Off, they still work on the elements.",
          keywords: 'collaborate comments threads actions tasks panel enable hide show turn off',
          key: 'collaboratePanelEnabled',
          on: true,
          off: false,
          fallback: true,
          event: {
            category: 'UI',
            on: 'CollaboratePanelOn',
            off: 'CollaboratePanelOff',
          },
        },
      ],
    },
    {
      id: 'tours',
      label: 'Tours',
      tile: 'tours',
      sectionNotes: {
        'Offer Again':
          'Start a tour from the Start Tour button in the bottom bar, left of Settings: it offers the tour for what you are working on. A switch is on until you have taken its tour; switch one back on and close Settings to take it again now.',
      },
      rows: [
        {
          kind: 'toggle',
          id: 'formTourSeen',
          label: 'Forms Tour',
          description: 'On a Form tab.',
          keywords: 'tour walkthrough onboarding tutorial form survey questions responses replay',
          section: 'Offer Again',
          key: 'formTourSeen',
          on: false,
          off: true,
          fallback: true,
          event: {
            category: 'UI',
            on: 'FormTourSeenOff',
            off: 'FormTourSeenOn',
          },
        },
      ],
    },
    {
      id: 'projects',
      label: 'Plans',
      tile: 'folder',
      rows: [
        {
          kind: 'toggle',
          id: 'homeBanner',
          label: 'Show Home Banner',
          description:
            "The greeting, status pills and large search at the top of Explorer Home. When it's hidden, Home's search sits in the header, as on every other Explorer page.",
          keywords: 'home banner hero greeting welcome header top search explorer hide show close',
          section: 'Explorer',
          key: 'homeBanner',
          on: true,
          off: false,
          fallback: true,
          event: {
            category: 'UI',
            on: 'HomeBannerOn',
            off: 'HomeBannerOff',
          },
        },
      ],
    },
    {
      id: 'notifications',
      label: 'Account › Notifications',
      tile: 'account',
      rows: [
        {
          kind: 'toggle',
          id: 'notifyProjectJoin',
          label: 'Someone Joins My Plan',
          description: 'A new person opens one of your shared plans.',
          keywords: 'email join collaborator opened',
          section: 'Email',
          key: 'notifyProjectJoin',
          on: true,
          off: false,
          fallback: true,
          event: {
            category: 'UI',
            on: 'NotifyProjectJoinOn',
            off: 'NotifyProjectJoinOff',
          },
        },
        {
          kind: 'toggle',
          id: 'notifyFormResponses',
          label: 'Someone Fills In My Form',
          description:
            'Someone responds to a form in a plan you own (at most one email every 15 minutes per form).',
          keywords: 'email form response survey submission answer',
          section: 'Email',
          key: 'notifyFormResponses',
          on: true,
          off: false,
          fallback: true,
          event: {
            category: 'UI',
            on: 'NotifyFormResponsesOn',
            off: 'NotifyFormResponsesOff',
          },
        },
      ],
    },
  ],
};
