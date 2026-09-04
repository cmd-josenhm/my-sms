const Icon = ({ size = 20, children, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {children}
  </svg>
);

export const SearchIcon = (p) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></Icon>
);

export const SendIcon = (p) => (
  <Icon {...p} fill="currentColor" stroke="none"><path d="M3.4 20.4 20.8 12 3.4 3.6l2.4 6.9 8.5 1.5-8.5 1.5z" /></Icon>
);

export const ChevronLeftIcon = (p) => (
  <Icon {...p}><path d="m15 18-6-6 6-6" /></Icon>
);

export const PencilIcon = (p) => (
  <Icon {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Icon>
);

export const MoonIcon = (p) => (
  <Icon {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Icon>
);

export const SunIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const LogoutIcon = (p) => (
  <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Icon>
);

export const XIcon = (p) => (
  <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>
);

export const SmileIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 14.5s1.5 2 4 2 4-2 4-2" />
    <path d="M9 9.5h.01M15 9.5h.01" strokeWidth="2.4" />
  </Icon>
);

export const CheckIcon = (p) => (
  <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Icon>
);

export const DoubleCheckIcon = (p) => (
  <Icon {...p}><path d="m2.5 12.5 4.5 4.5L15 9" /><path d="m11.5 15.5 1.5 1.5L21.5 9" /></Icon>
);

export const ArrowDownIcon = (p) => (
  <Icon {...p}><path d="M12 5v14m0 0 6-6m-6 6-6-6" /></Icon>
);

export const UserPlusIcon = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M19 8v6M22 11h-6" />
  </Icon>
);

export const ChatBubbleIcon = (p) => (
  <Icon {...p}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1L3 20.5l1.5-5.3A8.5 8.5 0 1 1 21 11.5z" /></Icon>
);

export function Logo({ size = 28 }) {
  return (
    <span className="logo" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="9" fill="url(#lg)" />
        <path
          d="M16 7.5c-4.7 0-8.5 3.1-8.5 6.9 0 2.1 1.2 4 3 5.2l-.9 3.4 4.3-1.6c.7.1 1.4.2 2.1.2 4.7 0 8.5-3.1 8.5-6.9s-3.8-7.2-8.5-7.2z"
          fill="#fff"
        />
        <circle cx="11.8" cy="14.4" r="1.15" fill="#0e9f6e" />
        <circle cx="16" cy="14.4" r="1.15" fill="#0e9f6e" />
        <circle cx="20.2" cy="14.4" r="1.15" fill="#0e9f6e" />
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="#12b486" />
            <stop offset="1" stopColor="#0b8a66" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}
