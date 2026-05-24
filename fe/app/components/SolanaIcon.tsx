"use client";

import React from "react";

type SolanaIconProps = {
  size?: number;
  className?: string;
};

export default function SolanaIcon({ size = 12, className }: SolanaIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 397 311"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="solanaGradient" x1="0" y1="0" x2="397" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9945FF" />
          <stop offset="1" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <path d="M64.6 237.9c2.1-2.1 5-3.3 8-3.3h315.8c4.8 0 7.2 5.8 3.8 9.2l-62.3 62.3c-2.1 2.1-5 3.3-8 3.3H6.1c-4.8 0-7.2-5.8-3.8-9.2l62.3-62.3z" fill="url(#solanaGradient)" />
      <path d="M64.6 4.3c2.1-2.1 5-3.3 8-3.3h315.8c4.8 0 7.2 5.8 3.8 9.2l-62.3 62.3c-2.1 2.1-5 3.3-8 3.3H6.1c-4.8 0-7.2-5.8-3.8-9.2L64.6 4.3z" fill="url(#solanaGradient)" />
      <path d="M332.4 121.1c-2.1-2.1-5-3.3-8-3.3H8.6c-4.8 0-7.2 5.8-3.8 9.2l62.3 62.3c2.1 2.1 5 3.3 8 3.3h315.8c4.8 0 7.2-5.8 3.8-9.2l-62.3-62.3z" fill="url(#solanaGradient)" />
    </svg>
  );
}
