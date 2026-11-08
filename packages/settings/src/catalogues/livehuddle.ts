// livehuddle's own settings as liveworkspace.app shows them: generated from its Settings catalogue by
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
      key: 'middleMousePan',
      on: true,
      off: false,
      fallback: true,
      event: {
        category: 'UI',
        on: 'MiddleMousePanOn',
        off: 'MiddleMousePanOff',
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
      id: 'editor',
      label: 'Editor',
      tile: 'editor',
      rows: [
        {
          kind: 'toggle',
          id: 'alignmentGuides',
          label: 'Alignment Guides',
          description:
            'Snap lines while you move or resize, so elements line up with their neighbours.',
          keywords: 'snap lines smart guides align',
          section: 'Canvas',
          key: 'alignmentGuides',
          on: true,
          off: false,
          fallback: true,
          event: {
            category: 'UI',
            on: 'AlignmentGuidesOn',
            off: 'AlignmentGuidesOff',
          },
        },
        {
          kind: 'choice',
          id: 'elementIndicatorStyle',
          label: 'Element Indicators',
          description:
            'How an element shows it has comments, an action or other markers: quiet icons at its top, a labelled footer, or nothing.',
          keywords:
            'badges icons note action comment link markers indicators top corner footer metadata chip hide off',
          section: 'Canvas',
          key: 'elementIndicatorStyle',
          options: [
            {
              id: 'top',
              label: 'Top',
              value: 'top',
            },
            {
              id: 'footer',
              label: 'Footer',
              value: 'footer',
            },
            {
              id: 'off',
              label: 'Off',
              value: 'off',
            },
          ],
          fallback: 'top',
          event: {
            category: 'UI',
            changed: 'ElementIndicators',
          },
        },
      ],
    },
    {
      id: 'panels',
      label: 'Panels',
      aliases: ['map', 'collaborate'],
      tile: 'panels',
      rows: [
        {
          kind: 'toggle',
          id: 'showMinimap',
          label: 'Enable Map',
          description:
            'An overview of the whole canvas in the bottom-left corner, once a tab has a few elements. Drag it to move around.',
          keywords: 'minimap overview thumbnail navigator birds eye hide show turn off enable',
          section: 'Map',
          key: 'showMinimap',
          on: true,
          off: false,
          fallback: true,
          event: {
            category: 'UI',
            on: 'MinimapOn',
            off: 'MinimapOff',
          },
        },
        {
          kind: 'toggle',
          id: 'mapDimOutside',
          label: 'Dim Outside the View',
          description: 'Shades what is off screen, so the part you are looking at stands out.',
          keywords: 'shade minimap viewport dim',
          section: 'Map',
          when: {
            key: 'showMinimap',
            on: true,
            off: false,
            fallback: true,
          },
          key: 'mapDimOutside',
          on: true,
          off: false,
          fallback: true,
          event: {
            category: 'UI',
            on: 'MapDimOn',
            off: 'MapDimOff',
          },
          parent: 'showMinimap',
        },
        {
          kind: 'choice',
          id: 'mapSize',
          label: 'Map Size',
          description: 'How much of the corner the Map takes up.',
          keywords: 'minimap height short medium tall',
          section: 'Map',
          when: {
            key: 'showMinimap',
            on: true,
            off: false,
            fallback: true,
          },
          key: 'mapSize',
          options: [
            {
              id: 'short',
              label: 'Short',
              value: 'short',
            },
            {
              id: 'medium',
              label: 'Medium',
              value: 'medium',
            },
            {
              id: 'tall',
              label: 'Tall',
              value: 'tall',
            },
          ],
          fallback: 'medium',
          event: {
            category: 'UI',
            changed: 'MapSize',
          },
          parent: 'showMinimap',
        },
        {
          kind: 'toggle',
          id: 'collaboratePanelEnabled',
          label: 'Enable Collaborate Panel',
          description:
            "Lists the tab's comments and actions, behind a corner button that shows once there are some. Off, they still work on the elements.",
          keywords: 'collaborate comments threads actions tasks panel enable hide show turn off',
          section: 'Collaborate',
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
        {
          kind: 'toggle',
          id: 'hearingRing',
          label: 'Audio Proximity Ring',
          description:
            'While you talk, a ring round your character shows where people can hear you. Off, nothing else about your microphone or the call changes.',
          keywords:
            'audio proximity ring hearing range call voice microphone talking who can hear me circle zone show hide',
          section: 'Collaborate',
          key: 'hearingRing',
          on: true,
          off: false,
          fallback: true,
          event: {
            category: 'UI',
            on: 'HearingRingOn',
            off: 'HearingRingOff',
          },
        },
      ],
    },
    {
      id: 'tours',
      label: 'Getting Started',
      aliases: ['/tours'],
      tile: 'tours',
      sectionNotes: {
        'Offer Again':
          'Start a tour from the Start Tour button in the bottom bar, left of Search: it offers the tour for what you are working on. A switch is on until you have taken its tour; switch one back on and close Settings to take it again now.',
      },
      rows: [
        {
          kind: 'toggle',
          id: 'avatarTourSeen',
          label: "Receptionist's Welcome",
          description: 'The Receptionist greets you on the Avatar Pad with what to try first.',
          keywords:
            'receptionist receptionist welcome tour walkthrough onboarding tutorial avatar character walk pad topics ask replay',
          section: 'Offer Again',
          key: 'avatarTourSeen',
          on: false,
          off: true,
          fallback: true,
          event: {
            category: 'UI',
            on: 'AvatarTourSeenOff',
            off: 'AvatarTourSeenOn',
          },
        },
      ],
    },
    {
      id: 'documents',
      label: 'Explorer',
      aliases: ['/spaces'],
      tile: 'folder',
      rows: [
        {
          kind: 'toggle',
          id: 'autoOpenExplorer',
          label: 'Automatically Open Explorer',
          description:
            'Opening the homepage while signed in takes you straight to your Explorer. A link to the homepage from inside the app still shows it.',
          keywords: 'automatically open explorer redirect home homepage start landing skip straight',
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
          label: 'Someone Joins My Space',
          description: 'A new person opens one of your shared spaces.',
          keywords: 'email join collaborator opened document',
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
      ],
    },
  ],
};
