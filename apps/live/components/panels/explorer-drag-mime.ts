// Custom MIME type for the document-to-folder drag flow. A custom type means
// dropping a document outside any registered target (the page background, the
// URL bar, an unrelated app) is a no-op rather than triggering a browser
// navigation to "the dragged URL". Shared by the Explorer panel's FolderNode,
// UnsortedNode, and DocumentRow so the drag source + drop targets agree.
export const DOCUMENT_DRAG_MIME = 'application/x-livediagram-id';
