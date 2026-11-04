// What each app makes, as Home's hero pictures it (liveworkspace/docs/specs/004-index/one-explorer.md "What you can make, on Home's
// hero"): four kinds of work per app, each its name, the template that starts one (the app's New route takes it as
// `/new?template=<template>`, the address its welcome uses) and its picture, drawn from the shared miniatures every
// help centre draws a product's work with. One table for every app, so every app's set is laid out alike.

import { type App } from '@liveworkspace/index-client';
import { APP_NAMES } from '@liveworkspace/sites';
import {
  MiniAllHands,
  MiniArticle,
  MiniBoard,
  MiniCoworking,
  MiniDashboard,
  MiniFlowchart,
  MiniForm,
  MiniInfographic,
  MiniLogo,
  MiniMindMap,
  MiniPhoto,
  MiniPoster,
  MiniSheet,
  MiniSlide,
  MiniTeamPod,
  MiniVirtualOffice,
  MiniWebsite,
  MiniWhiteboard,
  MiniWireframe,
  MiniWorkshop,
  fitBox,
  type WorkBox,
} from '@liveworkspace/ui/work-art';
import type { ReactNode } from 'react';
import { kindWords } from '../words';

export type WorkKind = {
  id: string;
  /** "Flowchart": the tile's name. */
  label: string;
  /** The app's template that starts one (`/new?template=`): an existing template, never a route of its own. */
  template: string;
  /** Its picture, drawn into the box a tile hands it. */
  draw: (box: WorkBox) => ReactNode;
};

/** How many kinds every app shows, so each app's set has the same layout. */
export const WORK_KINDS_PER_APP = 4;

export const WORK_KINDS: Record<App, readonly WorkKind[]> = {
  livediagram: [
    {
      id: 'flowchart',
      label: 'Flowchart',
      template: 'flowchart',
      draw: (b) => <MiniFlowchart {...b} />,
    },
    { id: 'mind-map', label: 'Mind Map', template: 'mindmap', draw: (b) => <MiniMindMap {...b} /> },
    {
      id: 'whiteboard',
      label: 'Whiteboard',
      template: 'whiteboard',
      draw: (b) => <MiniWhiteboard {...b} />,
    },
    {
      id: 'workshop',
      label: 'Workshop',
      template: 'blank-session',
      draw: (b) => <MiniWorkshop {...b} />,
    },
  ],
  liveplanner: [
    {
      id: 'board',
      label: 'Board',
      template: 'kanban',
      draw: (b) => <MiniBoard {...b} header={false} />,
    },
    {
      id: 'sheet',
      label: 'Sheet',
      template: 'blank-spreadsheet',
      draw: (b) => <MiniSheet {...b} />,
    },
    // No blank dashboard exists; the Project Planner's Overview tab is one.
    {
      id: 'dashboard',
      label: 'Dashboard',
      template: 'project-planner',
      draw: (b) => <MiniDashboard {...b} />,
    },
    {
      id: 'form',
      label: 'Form',
      template: 'blank-form',
      draw: (b) => <MiniForm {...fitBox(b, 1)} />,
    },
  ],
  livedocuments: [
    {
      id: 'article',
      label: 'Article',
      template: 'blank-article',
      draw: (b) => <MiniArticle {...fitBox(b, 0.78)} />,
    },
    {
      id: 'slide-deck',
      label: 'Slide Deck',
      template: 'blank-slide-deck',
      draw: (b) => <MiniSlide {...b} />,
    },
    {
      id: 'infographic',
      label: 'Infographic',
      template: 'blank-infographic',
      draw: (b) => <MiniInfographic {...b} />,
    },
    { id: 'poster', label: 'Poster', template: 'event-poster', draw: (b) => <MiniPoster {...b} /> },
  ],
  livedesign: [
    { id: 'logo', label: 'Logo', template: 'blank-logo', draw: (b) => <MiniLogo {...b} /> },
    {
      id: 'app-wireframe',
      label: 'App Wireframe',
      template: 'blank-wireframe-phone',
      draw: (b) => <MiniWireframe {...fitBox(b, 0.5)} />,
    },
    {
      id: 'web-wireframe',
      label: 'Web Wireframe',
      template: 'blank-wireframe-browser',
      draw: (b) => <MiniWebsite {...b} />,
    },
    { id: 'photo', label: 'Photo', template: 'photo-edit', draw: (b) => <MiniPhoto {...b} /> },
  ],
  // Its Spaces, in Popular's order: with Blank Space (the hero's New Space) they are its whole catalogue
  // (livehuddle/docs/specs/007-editor/templates-by-mode.md).
  livehuddle: [
    {
      id: 'virtual-office',
      label: 'Virtual Office',
      template: 'virtual-office',
      draw: (b) => <MiniVirtualOffice {...b} />,
    },
    {
      id: 'team-pod',
      label: 'Team Pod',
      template: 'team-pod',
      draw: (b) => <MiniTeamPod {...b} />,
    },
    {
      id: 'coworking-space',
      label: 'Coworking Space',
      template: 'coworking-space',
      draw: (b) => <MiniCoworking {...b} />,
    },
    {
      id: 'all-hands-hall',
      label: 'All-Hands Hall',
      template: 'all-hands-hall',
      draw: (b) => <MiniAllHands {...b} />,
    },
  ],
};

/** One tile of the hero's set: an app's kind of work. */
export type WorkTile = { app: App; kind: WorkKind; label: string };

/** The tiles the hero shows: the app's kinds, or under All one per listed app (its first kind, named by the app's kind:
 *  Canvas, Plan, Document, Design, Space). */
export function workTiles(app: App, all: boolean): WorkTile[] {
  if (!all) return WORK_KINDS[app].map((kind) => ({ app, kind, label: kind.label }));
  return APP_NAMES.flatMap((a) => {
    const kind = WORK_KINDS[a][0];
    return kind ? [{ app: a, kind, label: kindWords(a).one }] : [];
  });
}
