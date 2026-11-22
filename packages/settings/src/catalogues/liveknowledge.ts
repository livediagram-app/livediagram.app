// liveknowledge's own settings as liveworkspace.app shows them: generated from its Settings catalogue by
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
      id: 'documents',
      label: 'Explorer',
      aliases: ['/documents'],
      tile: 'folder',
      rows: [
        {
          kind: 'toggle',
          id: 'autoOpenExplorer',
          label: 'Automatically Open Explorer',
          description:
            'Opening the homepage while signed in takes you straight to your Explorer. A link to the homepage from inside the app still shows it.',
          keywords:
            'automatically open explorer redirect home homepage start landing skip straight',
          key: 'autoOpenExplorer',
          on: true,
          off: false,
          fallback: false,
          event: {
            category: 'UI',
            on: 'AutoOpenExplorerOn',
            off: 'AutoOpenExplorerOff',
          },
        },
        {
          kind: 'toggle',
          id: 'homeBanner',
          label: 'Show Home Banner',
          description:
            "The greeting, status pills and large search at the top of Explorer Home. When it's hidden, Home's search sits in the header, as on every other Explorer page.",
          keywords: 'home banner hero greeting welcome header top search explorer hide show close',
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
          id: 'notifyDocumentJoin',
          label: 'Someone Joins My Knowledgebase',
          description: 'A new person opens one of your shared knowledgebases.',
          keywords: 'email join collaborator opened',
          section: 'Email',
          key: 'notifyDocumentJoin',
          on: true,
          off: false,
          fallback: true,
          event: {
            category: 'UI',
            on: 'NotifyDocumentJoinOn',
            off: 'NotifyDocumentJoinOff',
          },
        },
        {
          kind: 'toggle',
          id: 'notifyKnowledgeReviews',
          label: 'Knowledgebase Reviews',
          description:
            'A page you own is due for review, disagrees with another page, or an Editor reminds its owners.',
          keywords: 'email review due verify owner remind reminder pages disagree conflict',
          section: 'Email',
          key: 'notifyKnowledgeReviews',
          on: true,
          off: false,
          fallback: true,
          event: {
            category: 'UI',
            on: 'NotifyKnowledgeReviewsOn',
            off: 'NotifyKnowledgeReviewsOff',
          },
        },
        {
          kind: 'toggle',
          id: 'notifyWatchDigest',
          label: 'Daily Digest of Watched Pages',
          description:
            'One email a day listing what changed on the pages you watch. Off until you turn it on.',
          keywords: 'email watch watching follow digest daily changes updates',
          section: 'Email',
          key: 'notifyWatchDigest',
          on: true,
          off: false,
          // Off by default (docs/specs/030-knowledgebase/watching.md "The daily digest email").
          fallback: false,
          event: {
            category: 'UI',
            on: 'NotifyWatchDigestOn',
            off: 'NotifyWatchDigestOff',
          },
        },
      ],
    },
  ],
};
