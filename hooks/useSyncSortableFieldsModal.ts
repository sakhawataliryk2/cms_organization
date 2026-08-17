"use client";

import { useLayoutEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";

/**
 * Keep Edit Fields modal order/visibility in sync with the catalog without
 * resetting checkboxes or moving a field to the top when it is toggled.
 * Full visible-first order is applied only when the modal opens.
 */
export function useSyncSortableFieldsModal(
  isActive: boolean,
  catalog: { key: string }[],
  savedVisibleKeys: string[],
  setOrder: Dispatch<SetStateAction<string[]>>,
  setVisible: Dispatch<SetStateAction<Record<string, boolean>>>
) {
  const wasActiveRef = useRef(false);
  const catalogKeySig = catalog.map((f) => f.key).join("\0");
  const catalogKeys = useMemo(
    () => Array.from(new Set(catalog.map((f) => f.key))),
    // catalogKeySig is the stable dependency; catalog is read for keys
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogKeySig]
  );

  useLayoutEffect(() => {
    if (!isActive) {
      wasActiveRef.current = false;
      return;
    }
    if (catalogKeys.length === 0) return;

    const isOpening = !wasActiveRef.current;
    wasActiveRef.current = true;

    if (isOpening) {
      const currentInCatalog = savedVisibleKeys.filter((k) => catalogKeys.includes(k));
      const rest = catalogKeys.filter((k) => !savedVisibleKeys.includes(k));
      setOrder([...currentInCatalog, ...rest]);
      setVisible(
        catalogKeys.reduce((acc, k) => {
          acc[k] = savedVisibleKeys.includes(k);
          return acc;
        }, {} as Record<string, boolean>)
      );
      return;
    }

    setOrder((prev) => {
      const next = prev.filter((k) => catalogKeys.includes(k));
      let changed = next.length !== prev.length;
      for (const k of catalogKeys) {
        if (!next.includes(k)) {
          next.push(k);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setVisible((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const k of catalogKeys) {
        if (!(k in next)) {
          next[k] = savedVisibleKeys.includes(k);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [isActive, catalogKeys, savedVisibleKeys, setOrder, setVisible]);
}
