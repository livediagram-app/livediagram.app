// The two import sources' own marks, for the hero's Import capsule (docs/specs/019-marketing/marketing-site.md
// "Hero", "Import"; owner, 2026-11-21: "only the Notion and Confluence logos, not the words"). Simple drawings of
// each brand's logo in its own colours, on a 24 by 24 board. Decorative here: the link around each carries its name.

/** Notion's mark: a white tile with a dark outline and its serifed N. */
export function NotionMark({ size = 22 }: { size?: number }) {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 24 24" width={size} height={size}>
      <rect
        x="3"
        y="2.6"
        width="18"
        height="18.8"
        rx="2.6"
        fill="#ffffff"
        stroke="#191919"
        strokeWidth="1.7"
      />
      <path
        d="M8.6 7.2v9.6M15.4 7.2v9.6M8.6 7.2l6.8 9.6M6.9 7.2h3.3M13.8 7.2h3.3M6.9 16.8h3.4"
        fill="none"
        stroke="#191919"
        strokeWidth="1.9"
        strokeLinecap="square"
      />
    </svg>
  );
}

/** Confluence's mark: two blue swooshes, one curling up from the left and one down from the right. */
export function ConfluenceMark({ size = 22 }: { size?: number }) {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 24 24" width={size} height={size}>
      <path
        className="fill-[#1868db] dark:fill-[#4c9aff]"
        d="M.87 18.257c-.248.382-.53.875-.763 1.245a.764.764 0 0 0 .255 1.04l4.965 3.054a.764.764 0 0 0 1.058-.26c.199-.332.454-.763.733-1.221 1.967-3.247 3.945-2.853 7.508-1.146l4.957 2.337a.764.764 0 0 0 1.028-.382l2.364-5.346a.764.764 0 0 0-.382-1c-1.039-.49-3.105-1.467-4.965-2.361C10.911 10.97 5.224 11.185.87 18.257z"
      />
      <path
        className="fill-[#1868db] dark:fill-[#4c9aff]"
        d="M23.131 5.743c.249-.405.531-.875.764-1.25a.764.764 0 0 0-.256-1.034L18.675.404a.764.764 0 0 0-1.058.26c-.195.335-.451.763-.734 1.225-1.966 3.246-3.945 2.85-7.508 1.146L4.437.694a.764.764 0 0 0-1.027.382L1.046 6.422a.764.764 0 0 0 .382 1c1.039.49 3.105 1.467 4.965 2.361 6.698 3.246 12.392 3.029 16.738-4.04z"
      />
    </svg>
  );
}
