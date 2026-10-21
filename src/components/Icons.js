import { cx } from "@/components/ui";

function Icon({ className, children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx(className || "h-5 w-5")}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function CarIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M5 16V11l2-5h10l2 5v5" />
      <path d="M3 16h18v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2z" />
      <circle cx="8" cy="13" r="1" />
      <circle cx="16" cy="13" r="1" />
    </Icon>
  );
}

export function PinIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

export function WalletIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h13v4" />
      <path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z" />
      <circle cx="16.5" cy="14" r="1" />
    </Icon>
  );
}

export function ReceiptIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h6" />
    </Icon>
  );
}

export function TagIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M3 12V4h8l10 10-8 8L3 12z" />
      <circle cx="7.5" cy="8.5" r="1" />
    </Icon>
  );
}

export function EyeIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function EyeOffIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 3l18 18" />
    </Icon>
  );
}

export function CheckIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M5 12l4 4 10-10" />
    </Icon>
  );
}

export function StarIcon({ className, filled = false }) {
  return (
    <Icon className={className}>
      <path
        d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z"
        fill={filled ? "currentColor" : "none"}
      />
    </Icon>
  );
}