// A connected tab's connection as every app's wire shapes carry it (liveworkspace/docs/specs/004-index/connected-tabs.md):
// which connection, and which app and item the tab stands for. The same fields as @liveworkspace/index-client's
// `TabConnection`, which every app's api reads and writes it with; nothing in it is secret, and it opens nothing
// without the index.
export type TabConnectionApp =
  'livediagram' | 'liveplanner' | 'livedocuments' | 'livedesign' | 'livehuddle';

export type TabConnectionWire = {
  id: string;
  app: TabConnectionApp;
  itemId: string;
};
