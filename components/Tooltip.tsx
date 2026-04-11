"use client";

import { useState, ReactNode, MouseEvent } from "react";

interface TooltipProps {
  children: ReactNode;
  text: string;
  className?: string;
  /** Extra classes on the inner wrapper around children (for flex/grid truncation) */
  innerClassName?: string;
  onClick?: (event: MouseEvent<HTMLSpanElement>) => void;
  /** Light = white panel (e.g. record headers); dark = default inverted */
  variant?: "dark" | "light";
}

export default function Tooltip({
  children,
  text,
  className = "",
  innerClassName = "",
  onClick,
  variant = "dark",
}: TooltipProps) {
  const [show, setShow] = useState<boolean>(false);
  const hasText = Boolean(text && String(text).trim());

  const bubbleDark =
    "bg-gray-800 text-white border-0";
  const bubbleLight =
    "bg-white text-gray-900 border border-gray-200 shadow-md";
  const bubble = variant === "light" ? bubbleLight : bubbleDark;
  const arrowDark = "bg-gray-800";
  const arrowLight = "bg-white border-r border-b border-gray-200";
  const arrow = variant === "light" ? arrowLight : arrowDark;

  return (
    <span
      onClick={onClick}
      className={className}
      onMouseEnter={() => hasText && setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div className={`relative ${innerClassName || "inline-block"} cursor-default`}>
        {children}

        {show && hasText && (
          <div
            className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 text-xs rounded px-2 py-1.5 ${bubble} ${
              variant === "light"
                ? "max-w-[min(20rem,calc(100vw-2rem))] whitespace-normal break-words text-left"
                : "w-max whitespace-nowrap"
            }`}
            role="tooltip"
          >
            {text}
            <div
              className={`absolute top-[calc(100%-5px)] left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${arrow}`}
              aria-hidden
            />
          </div>
        )}
      </div>
    </span>
  );
}
