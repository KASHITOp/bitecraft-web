import type { SVGProps } from "react";

/* Plain 24px line icons, 1.75 stroke. Drawn for this app, no icon pack. */
const PATHS = {
  kettle: (
    <>
      <path d="M6 20h11" />
      <path d="M7 20l-.6-9.2A2 2 0 0 1 8.4 8.6h6.2a2 2 0 0 1 2 2.2L16 20" />
      <path d="M16.6 11.5l2.2-1.6a1 1 0 0 1 1.6.8v1.7a3 3 0 0 1-1.2 2.4L16.3 16" />
      <path d="M9.5 8.6V6.5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2.1" />
      <path d="M6.6 11.5L4.5 9.5" />
    </>
  ),
  plate: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="1.6" />
      <path d="M6 16.5h1.5M16.5 16.5H18" />
    </>
  ),
  nocook: (
    <>
      <path d="M3.5 11h17a8.5 8.5 0 0 1-17 0z" />
      <path d="M9 19.5h6" />
      <path d="M14.5 11L18 4.5" />
    </>
  ),
  pan: (
    <>
      <path d="M3 12h12a0 0 0 0 1 0 0v1a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-1z" />
      <path d="M15 13h6" />
    </>
  ),
  microwave: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <rect x="5.5" y="8" width="9.5" height="8" rx="1" />
      <path d="M18 9v.01M18 12v.01M18 15v.01" />
    </>
  ),
  fridge: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="1.5" />
      <path d="M6 10h12M9 6v2M9 13v3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  jar: (
    <>
      <path d="M8 3.5h8M8.5 3.5v2.5M15.5 3.5v2.5" />
      <path d="M7 6h10a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V7.5A1.5 1.5 0 0 1 7 6z" />
      <path d="M5.5 11h13" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5.5h16v10H10l-4.5 3.5v-3.5H4z" />
      <path d="M8 9.5h8M8 12h5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h3M7.5 16.5h3M13.5 13h3" />
    </>
  ),
  more: (
    <>
      <path d="M4 6.5h16M4 12h16M4 17.5h10" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V9.5M10 3h4M18 7l1.5-1.5" />
    </>
  ),
  bookmark: <path d="M6.5 3.5h11v17L12 16.5l-5.5 4z" />,
  bookmarkFilled: <path d="M6.5 3.5h11v17L12 16.5l-5.5 4z" fill="currentColor" />,
  cart: (
    <>
      <path d="M3 4h2.5l2 11h10.5l2-7.5H6.5" />
      <circle cx="9" cy="19" r="1.4" />
      <circle cx="17" cy="19" r="1.4" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  forward: <path d="M9 5l7 7-7 7" />,
  shuffle: (
    <>
      <path d="M3.5 7h3.5c4 0 6 10 10 10h3.5" />
      <path d="M3.5 17h3.5c1.6 0 2.8-1.6 3.8-3.6M13.2 9.6C14.2 8.1 15.3 7 17 7h3.5" />
      <path d="M18 4.5L20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" />
    </>
  ),
  list: <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
    </>
  ),
  play: <path d="M8 5.5v13l10-6.5z" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  store: (
    <>
      <path d="M4 9.5L5.5 4.5h13L20 9.5" />
      <path d="M4 9.5h16a0 0 0 0 1 0 0 2.6 2.6 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0A2.6 2.6 0 0 1 4 9.5z" />
      <path d="M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20" />
    </>
  ),
  send: <path d="M4 12l16-7.5-5.5 15.5-3-6.5z" />,
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" />
    </>
  ),
  moon: <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" />,
  flame: (
    <path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 3-5 3.5-9 2.5 1.6 3.4 3.6 3.6 5.4.8-.6 1.4-1.6 1.6-2.8 2 1.7 3.3 4 3.3 6.4 0 3.2-2.4 5.6-6 5.6z" />
  ),
  refresh: (
    <>
      <path d="M19.5 9A8 8 0 0 0 5 7.5M4.5 15A8 8 0 0 0 19 16.5" />
      <path d="M19.5 4v5h-5M4.5 20v-5h5" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 24,
  ...rest
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
