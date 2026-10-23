// What a host lends the Explorer beyond the index (livediagram's Library and imports): the person's images from its
// media source, their shape libraries, the tools it imports from, and verbs of its own on an item's menu. Each is
// optional: an app without one simply doesn't show it. The Explorer never stores any of it; the host reads and writes
// its own source (the media service through the app, a Durable Object behind the app's API).

import type { ReactNode } from 'react';
import type { Item } from '@liveworkspace/index-client';
import type { Placement } from '../types';

// ---------- The Image Gallery ----------------------------------------------------------------------------------

/** One of the person's images. */
export type GalleryImage = {
  id: string;
  name?: string | null;
  contentType?: string;
  byteSize: number;
  width: number;
  height: number;
  createdAt?: number;
};

/** An item that places an image. */
export type GalleryUse = { id: string; title: string; href?: string };

export type GalleryHost = {
  /** The person's images, newest first; null when images are off where the host keeps them. */
  list: (signal?: AbortSignal) => Promise<GalleryImage[] | null>;
  /** Which items place each image, by image id; an image placed nowhere is absent. */
  usage?: (signal?: AbortSignal) => Promise<Record<string, GalleryUse[]>>;
  /** An image's bytes, for its tile (a browser can't send the person's credentials from an <img>). */
  imageBlob: (image: GalleryImage, signal?: AbortSignal) => Promise<Blob | null>;
  /** Delete one. Items that place it show a broken picture. */
  remove: (image: GalleryImage) => Promise<void>;
  /** Add one. A refusal throws an Error whose message is said as it is. Without it there is no upload. */
  upload?: (file: File) => Promise<void>;
  /** The gallery's help article. */
  helpHref?: string;
};

// ---------- Shape libraries ------------------------------------------------------------------------------------

/** One reusable shape. A host may keep more on it (its drawing), which `renderShape` reads. */
export type LibraryShape = { id: string; title: string; width?: number; height?: number };

export type ShapeLibrary = { id: string; name: string; items: LibraryShape[]; updatedAt?: number };

export type RenameResult = { ok: true } | { ok: false; error: string };

export type ShapeLibrariesHost = {
  /** The person's libraries, newest first. */
  list: (signal?: AbortSignal) => Promise<ShapeLibrary[]>;
  rename: (library: ShapeLibrary, name: string) => Promise<RenameResult>;
  remove: (library: ShapeLibrary) => Promise<void>;
  /** Take one shape out of a library. */
  removeShape: (library: ShapeLibrary, shape: LibraryShape) => Promise<void>;
  /** A shape drawn small. Drawing one takes the app's editor, so a host without it shows a plain tile. */
  renderShape?: (shape: LibraryShape) => ReactNode;
  /** The longest name a library may have. */
  nameMax?: number;
  helpHref?: string;
};

// ---------- Import from ----------------------------------------------------------------------------------------

/** A tool the host imports from. `libraries`: it also brings in shape libraries (draw.io's). */
export type ImportSource = { id: string; name: string; icon?: ReactNode; libraries?: boolean };

export type ImportHost = {
  sources: readonly ImportSource[];
  /** Import from `source`: `items` land at `placement`, as New's do; `libraries` go to Shape Libraries. */
  onImport: (
    source: ImportSource,
    target: { what: 'items' | 'libraries'; placement: Placement },
  ) => void;
};

// ---------- The host's verbs on an item's menu -----------------------------------------------------------------

/** A verb the host adds to an item's menu (Take Offline, say), after the Explorer's own. */
export type ItemMenuVerb = { id: string; label: string; icon?: ReactNode; onSelect: () => void };

export type ItemMenuHost = (item: Item) => readonly ItemMenuVerb[];

/** Everything above, as the Explorer and the panel take it. */
export type LibraryHostProps = {
  /** The Image Gallery: a Library row and its view, `/explorer/images`. */
  gallery?: GalleryHost;
  /** Shape Libraries: a Library row and its view, `/explorer/shape-libraries`. */
  shapeLibraries?: ShapeLibrariesHost;
  /** Import from: a toolbar wherever New files an item, and on Shape Libraries for the sources that bring libraries. */
  imports?: ImportHost;
  /** The host's own verbs on an item's menu. */
  itemMenu?: ItemMenuHost;
  /** History on an item's menu: the item's own Timeline. On by default. */
  history?: boolean;
  /** New Team in an item's Move dialog: makes a team for the person (on liveworkspace, so the same team in every
   *  app) and answers it, or null when refused; the item then files into it. Omitted where the person has no teams
   *  (a guest). */
  onCreateTeam?: CreateTeam;
};

export type CreateTeam = (name: string) => Promise<{ id: string; name: string } | null>;
