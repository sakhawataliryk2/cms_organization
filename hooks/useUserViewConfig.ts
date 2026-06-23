import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewEntityType } from "@/lib/viewConfigEntityTypes";
import { HEADER_CONFIG_ENTITY_MAP } from "@/lib/viewConfigEntityTypes";
import {
  clearLegacyLocalStorage,
  mergeCache,
  migrateLegacyLocalStorage,
  readCache,
  type ViewConfig,
} from "@/lib/viewConfigCache";

type ConfigKey = keyof ViewConfig;

type SetStateAction<T> = T | ((prev: T) => T);

interface UseUserViewConfigOptions<T extends ConfigKey> {
  entityType: ViewEntityType;
  key: T;
  defaultValue: NonNullable<ViewConfig[T]>;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseUserViewConfigResult<T extends ConfigKey> {
  value: NonNullable<ViewConfig[T]>;
  setValue: (value: SetStateAction<NonNullable<ViewConfig[T]>>) => void;
  isLoading: boolean;
  isSaving: boolean;
  saveNow: () => Promise<boolean>;
  fullConfig: ViewConfig;
}

type EntityState = {
  config: ViewConfig;
  isLoading: boolean;
  isSaving: boolean;
  loaded: boolean;
  listeners: Set<() => void>;
};

const entityStates = new Map<ViewEntityType, EntityState>();
const loadPromises = new Map<ViewEntityType, Promise<ViewConfig>>();

function getEntityState(entityType: ViewEntityType): EntityState {
  let state = entityStates.get(entityType);
  if (!state) {
    state = {
      config: readCache(entityType) || {},
      isLoading: true,
      isSaving: false,
      loaded: false,
      listeners: new Set(),
    };
    entityStates.set(entityType, state);
  }
  return state;
}

function notifyListeners(entityType: ViewEntityType) {
  const state = entityStates.get(entityType);
  if (!state) return;
  state.listeners.forEach((fn) => fn());
}

function getToken(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("token="))
    ?.split("=")[1];
}

async function fetchHeaderConfigDefault(
  entityType: ViewEntityType
): Promise<Partial<ViewConfig>> {
  const mapping = HEADER_CONFIG_ENTITY_MAP[entityType];
  if (!mapping) return {};

  const token = getToken();
  if (!token) return {};

  try {
    const url = `/api/header-config?entityType=${encodeURIComponent(
      mapping.entityType
    )}&configType=${encodeURIComponent(mapping.configType)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const data = await response.json();
    if (!data?.success) return {};

    if (mapping.configType === "header" && Array.isArray(data.headerFields)) {
      return { header_fields: data.headerFields };
    }
    if (mapping.configType === "columns" && Array.isArray(data.listColumns)) {
      return { column_order: data.listColumns };
    }
  } catch {
    // ignore
  }

  return {};
}

async function fetchServerConfig(
  entityType: ViewEntityType
): Promise<ViewConfig> {
  const token = getToken();
  if (!token) return {};

  const response = await fetch(
    `/api/user-view-config/${encodeURIComponent(entityType)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  const data = await response.json();
  if (!data?.success) return {};
  return (data.config as ViewConfig) || {};
}

async function saveServerConfig(
  entityType: ViewEntityType,
  partial: Partial<ViewConfig>
): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  const response = await fetch(
    `/api/user-view-config/${encodeURIComponent(entityType)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ config: partial }),
    }
  );

  const data = await response.json().catch(() => null);
  return !!(response.ok && data?.success);
}

function hasConfigData(config: ViewConfig): boolean {
  return Object.keys(config).some(
    (k) => k !== "_migrated" && config[k as ConfigKey] != null
  );
}

async function loadEntityConfig(entityType: ViewEntityType): Promise<ViewConfig> {
  const cached = readCache(entityType);
  if (cached && hasConfigData(cached)) {
    const state = getEntityState(entityType);
    state.config = cached;
    notifyListeners(entityType);
  }

  const serverConfig = await fetchServerConfig(entityType);

  if (hasConfigData(serverConfig)) {
    mergeCache(entityType, serverConfig);
    return serverConfig;
  }

  const legacy = migrateLegacyLocalStorage(entityType);
  if (hasConfigData(legacy)) {
    await saveServerConfig(entityType, { ...legacy, _migrated: true });
    mergeCache(entityType, { ...legacy, _migrated: true });
    clearLegacyLocalStorage(entityType);
    return { ...legacy, _migrated: true };
  }

  const defaults = await fetchHeaderConfigDefault(entityType);
  if (hasConfigData(defaults)) {
    mergeCache(entityType, defaults);
    return defaults;
  }

  return cached || {};
}

function ensureEntityLoaded(entityType: ViewEntityType): Promise<ViewConfig> {
  const existing = loadPromises.get(entityType);
  if (existing) return existing;

  const state = getEntityState(entityType);
  state.isLoading = true;
  notifyListeners(entityType);

  const promise = loadEntityConfig(entityType)
    .then((config) => {
      state.config = config;
      state.isLoading = false;
      state.loaded = true;
      notifyListeners(entityType);
      return config;
    })
    .catch(() => {
      state.isLoading = false;
      state.loaded = true;
      notifyListeners(entityType);
      return state.config;
    })
    .finally(() => {
      loadPromises.delete(entityType);
    });

  loadPromises.set(entityType, promise);
  return promise;
}

export function useUserViewConfig<T extends ConfigKey>({
  entityType,
  key,
  defaultValue,
  debounceMs = 500,
  enabled = true,
}: UseUserViewConfigOptions<T>): UseUserViewConfigResult<T> {
  const state = getEntityState(entityType);
  const [, forceUpdate] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    state.listeners.add(listener);
    return () => {
      state.listeners.delete(listener);
    };
  }, [entityType, state]);

  useEffect(() => {
    if (!enabled) return;
    ensureEntityLoaded(entityType);
  }, [entityType, enabled]);

  const currentValue =
    (state.config[key] as NonNullable<ViewConfig[T]> | undefined) ??
    defaultValueRef.current;

  const setValue = useCallback(
    (value: SetStateAction<NonNullable<ViewConfig[T]>>) => {
      const prevValue =
        (state.config[key] as NonNullable<ViewConfig[T]> | undefined) ??
        defaultValueRef.current;
      const resolvedValue =
        typeof value === "function"
          ? (
              value as (
                prev: NonNullable<ViewConfig[T]>
              ) => NonNullable<ViewConfig[T]>
            )(prevValue)
          : value;

      const nextConfig = mergeCache(entityType, { [key]: resolvedValue });
      state.config = nextConfig;
      notifyListeners(entityType);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        state.isSaving = true;
        notifyListeners(entityType);
        await saveServerConfig(entityType, { [key]: resolvedValue });
        state.isSaving = false;
        notifyListeners(entityType);
      }, debounceMs);
    },
    [entityType, key, debounceMs, state]
  );

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    state.isSaving = true;
    notifyListeners(entityType);
    const ok = await saveServerConfig(entityType, { [key]: currentValue });
    state.isSaving = false;
    notifyListeners(entityType);
    return ok;
  }, [entityType, key, currentValue, state]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    value: currentValue,
    setValue,
    isLoading: enabled ? state.isLoading && !state.loaded : false,
    isSaving: state.isSaving,
    saveNow,
    fullConfig: state.config,
  };
}

/** Compatibility wrapper replacing useHeaderConfig for header/columns */
export function useHeaderViewConfig({
  entityType,
  defaultFields,
  configType,
}: {
  entityType: ViewEntityType;
  defaultFields: string[];
  configType: "header" | "columns";
}) {
  const configKey = configType === "header" ? "header_fields" : "column_order";

  const {
    value,
    setValue,
    isLoading,
    isSaving,
    saveNow,
  } = useUserViewConfig({
    entityType,
    key: configKey as "header_fields" | "column_order",
    defaultValue: defaultFields,
  });

  const [showHeaderFieldModal, setShowHeaderFieldModal] = useState(false);

  const noopSetter = (_value: SetStateAction<string[]>) => {};

  return {
    headerFields: configType === "header" ? (value as string[]) : defaultFields,
    setHeaderFields:
      configType === "header"
        ? (setValue as (v: SetStateAction<string[]>) => void)
        : noopSetter,
    columnFields: configType === "columns" ? (value as string[]) : defaultFields,
    setColumnFields:
      configType === "columns"
        ? (setValue as (v: SetStateAction<string[]>) => void)
        : noopSetter,
    showHeaderFieldModal,
    setShowHeaderFieldModal,
    isLoading,
    isSaving,
    saveHeaderConfig: saveNow,
  };
}
