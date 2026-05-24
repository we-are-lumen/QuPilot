import React from "react";

interface WalletIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export function PhantomIcon({ size = 24, ...props }: WalletIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 16.42 4.86 20.17 8.83 21.47C9.07 21.55 9.32 21.47 9.48 21.28L11.17 19.24C11.39 18.97 11.77 18.92 12.06 19.11C12.56 19.45 13.12 19.64 13.72 19.64C14.32 19.64 14.88 19.45 15.38 19.11C15.67 18.92 16.05 18.97 16.27 19.24L17.96 21.28C18.12 21.47 18.37 21.55 18.61 21.47C22.58 20.17 25.44 16.42 25.44 12C25.44 6.48 20.96 2 15.44 2H12ZM9.12 11.28C8.33 11.28 7.68 10.64 7.68 9.84C7.68 9.04 8.33 8.4 9.12 8.4C9.91 8.4 10.56 9.04 10.56 9.84C10.56 10.64 9.91 11.28 9.12 11.28ZM14.88 11.28C14.09 11.28 13.44 10.64 13.44 9.84C13.44 9.04 14.09 8.4 14.88 8.4C15.67 8.4 16.32 9.04 16.32 9.84C16.32 10.64 15.67 11.28 14.88 11.28Z"
        fill="#512DA8"
      />
    </svg>
  );
}

export function SolflareIcon({ size = 24, ...props }: WalletIconProps) {
  // Generate a random id suffix or use static unique id to avoid SVG conflicts in lists
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <linearGradient id="solflare-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FC6076" />
          <stop offset="100%" stopColor="#FF9A44" />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm-6-10c0-3.314 2.686-6 6-6s6 2.686 6 6-2.686 6-6 6-6-2.686-6-6z"
        fill="url(#solflare-gradient)"
      />
    </svg>
  );
}

export function BackpackIcon({ size = 24, ...props }: WalletIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="4" y="6" width="16" height="14" rx="3" fill="#E05D45" />
      <path
        d="M8 6V4C8 3.45 8.45 3 9 3H15C15.55 3 16 3.45 16 4V6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M12 9V17" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <rect x="9" y="10" width="6" height="4" rx="1" fill="#FFFFFF" />
    </svg>
  );
}

export function OkxIcon({ size = 24, ...props }: WalletIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" fill="#1F1B18" />
      <rect x="14" y="3" width="7" height="7" rx="1" fill="#1F1B18" />
      <rect x="3" y="14" width="7" height="7" rx="1" fill="#1F1B18" />
      <rect x="14" y="14" width="7" height="7" rx="1" fill="#1F1B18" />
      <rect x="8.5" y="8.5" width="7" height="7" rx="1" fill="#E05D45" />
    </svg>
  );
}

export function MetaMaskIcon({ size = 24, ...props }: WalletIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M22 6.77L12 2 2 6.77c-.49.18-.77.7-.63 1.2l3.41 12.18 10.45 9.85 10.45-9.85 3.41-12.18c.14-.5-.14-1.02-.63-1.2z"
        fill="#E2761B"
      />
      <path d="M12 16.5l-4.5-3.5h9l-4.5 3.5z" fill="#E4761B" />
      <path d="M6 10l10 6.5L26 10l-10-8L6 10z" fill="#F6851B" />
      <circle cx="9.5" cy="13.5" r="1" fill="#333" />
      <circle cx="14.5" cy="13.5" r="1" fill="#333" />
    </svg>
  );
}
