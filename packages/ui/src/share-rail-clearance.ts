// How a wide page column keeps clear of the share rail (./ShareRail). The rail sits in the gutter
// beside a max-w-6xl page from xl (1280px) up, about 47px wide. A max-w-7xl column on such a surface
// (the marketing landing beats and feature heroes) fills the whole window at xl, so its usual 24px
// padding put text under the rail. 64px clears it across xl; from 2xl (1536px) the window's own
// margin around the 1280px column does, and the usual padding returns.

/** Side padding for a max-w-7xl column on a surface whose share rail shows from xl. */
export const RAIL_CLEAR_PADDING = 'px-6 xl:px-16 2xl:px-6';
