// SnapFind icon set — clean 24px stroke icons. No emojis in the UI.
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function wrap(paths) {
  return function Icon({ size = 18, className = "" }) {
    return (
      <svg {...base} width={size} height={size} className={className} aria-hidden>
        {paths}
      </svg>
    );
  };
}

export const IconCamera = wrap(
  <>
    <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13.5" r="3.4" />
  </>
);

export const IconQr = wrap(
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
    <path d="M13.5 13.5h3v3h-3zM20.5 13.5v7M13.5 20.5h7" />
  </>
);

export const IconUpload = wrap(
  <>
    <path d="M12 16V4m0 0L7 9m5-5l5 5" />
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
  </>
);

export const IconCheck = wrap(<path d="M4.5 12.5l5 5 10-11" />);

export const IconX = wrap(<path d="M6 6l12 12M18 6L6 18" />);

export const IconImage = wrap(
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M4.5 17.5l4.5-4.5 3.5 3.5 3-3 4 4" />
  </>
);

export const IconSearch = wrap(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </>
);

export const IconRefresh = wrap(
  <>
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 3.5V8h-4.5" />
  </>
);

export const IconDownload = wrap(
  <>
    <path d="M12 4v12m0 0l-5-5m5 5l5-5" />
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
  </>
);

export const IconTrash = wrap(
  <>
    <path d="M4.5 6.5h15M9.5 6V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6" />
    <path d="M6.5 6.5l1 13a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1l1-13" />
    <path d="M10 10.5v6M14 10.5v6" />
  </>
);

export const IconCopy = wrap(
  <>
    <rect x="9" y="9" width="11.5" height="11.5" rx="2" />
    <path d="M5.5 15H4.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1" />
  </>
);

export const IconPlus = wrap(<path d="M12 5v14M5 12h14" />);

export const IconFace = wrap(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 14.5c.8 1 2 1.6 3.5 1.6s2.7-.6 3.5-1.6" />
    <path d="M9 9.5h.01M15 9.5h.01" />
  </>
);

export const IconSpark = wrap(
  <path d="M12 3l1.9 5.7L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.3L12 3z" />
);

export const IconChevronDown = wrap(<path d="M6 9.5l6 6 6-6" />);

export const IconUsers = wrap(
  <>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7" />
    <circle cx="16.5" cy="9.5" r="2.6" />
    <path d="M16 14.6c2.3.2 3.9 1.7 4.4 4" />
  </>
);
