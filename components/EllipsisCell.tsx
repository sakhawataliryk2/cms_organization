"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Tooltip from "./Tooltip";

export type EllipsisCellRenderArgs = {
  ref: (el: HTMLElement | null) => void;
  className: string;
};

type EllipsisCellProps = {
  /** When false, children render with baseClassName only (no measurement / hover expand). */
  active: boolean;
  /** Truncation is re-checked when this changes (e.g. field value). */
  measureDep: string | number;
  baseClassName?: string;
  wrapperClassName?: string;
  /**
   * When true (default), truncated state adds `block w-full` so links/plain text ellipsize in flex rows.
   * Set false for e.g. `inline-flex` pills so display utilities are not overridden.
   */
  fullWidthTruncate?: boolean;
  children: (opts: EllipsisCellRenderArgs) => ReactNode;
};

/**
 * Single-line ellipsis when space is tight; on hover, shows full text without wrapping.
 * Uses CSS-only hover behavior to avoid flickering from state changes.
 */
export function EllipsisCell({
  active,
  measureDep,
  baseClassName = "",
  wrapperClassName = "min-w-0 max-w-full",
  fullWidthTruncate = true,
  children,
}: EllipsisCellProps) {
  const innerRef = useRef<HTMLElement | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [tooltipText, setTooltipText] = useState('')

  const setRef = useCallback((el: HTMLElement | null) => {
    innerRef.current = el;
  }, []);

  useLayoutEffect(() => {
    if (!active) {
      setTruncated(false);
      return;
    }
    const el = innerRef.current;
    if (!el) return;


    const check = () => {
      const isTruncated = el.scrollWidth > el.clientWidth + 1;
      setTruncated(isTruncated);
      if (isTruncated) {
        setTooltipText(el.textContent || "");
      }
    };

    check();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(check);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, measureDep]);

  if (!active) {
    return <>{children({ ref: () => { }, className: baseClassName })}</>;
  }

  const widthHint = fullWidthTruncate ? "block w-full max-w-full " : "max-w-full ";
  const innerClass = truncated
    ? `${baseClassName} ${widthHint}min-w-0 truncate`.trim()
    : `${baseClassName} ${widthHint}min-w-0`.trim();

  return (
    <div
      className={`${wrapperClassName}`.trim()}
      style={{ overflow: "visible" }}
      title={tooltipText}
      onMouseLeave={() => {
        if (innerRef.current) {
          innerRef.current.style.position = "";
          innerRef.current.style.zIndex = "";
          innerRef.current.style.whiteSpace = "";
          innerRef.current.style.overflow = "";
        }
      }}
    >

      {children({
        ref: setRef,
        className: innerClass,
      })}
    </div>
  );
}
