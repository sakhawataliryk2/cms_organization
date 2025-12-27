import { useState, useEffect } from "react";

interface UseHeaderConfigOptions {
  entityType: string;
  defaultFields: string[];
  configType: "header" | "columns"; 
}

export function useHeaderConfig({
  entityType,
  defaultFields,
  configType,
}: UseHeaderConfigOptions) {
  const [headerFields, setHeaderFields] = useState<string[]>(defaultFields);
  const [columnFields, setColumnFields] = useState<string[]>(defaultFields);
  const [showHeaderFieldModal, setShowHeaderFieldModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchHeaderConfig = async () => {
      try {
        setIsLoading(true);
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("token="))
          ?.split("=")[1];

        if (!token) {
          configType === "header"
            ? setHeaderFields(defaultFields)
            : setColumnFields(defaultFields);
          return;
        }

        const url = `/api/header-config?entityType=${encodeURIComponent(
          entityType
        )}&configType=${encodeURIComponent(configType)}`;

        console.log("🔗 Fetching URL:", url);

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        const data = await response.json();
        let receivedFields: string[] = defaultFields;

        if (data?.success) {
          if (configType === "header" && Array.isArray(data?.headerFields)) {
            receivedFields = data.headerFields;
          } else if (
            configType === "columns" &&
            Array.isArray(data?.listColumns)
          ) {
            receivedFields = data.listColumns;
          }
        }

        configType === "header"
          ? setHeaderFields(receivedFields)
          : setColumnFields(receivedFields);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeaderConfig();
  }, [entityType, configType]);

  const saveHeaderConfig = async (): Promise<boolean> => {
    if (!configType) return false;

    try {
      setIsSaving(true);
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      if (!token) return false;

      const fieldsToSave =
        configType === "header" ? headerFields : columnFields;

      const url = `/api/header-config?entityType=${encodeURIComponent(
        entityType
      )}&configType=${encodeURIComponent(configType)}`;

      console.log("🔗 Final URL:", url);

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fields: fieldsToSave }),
      });

      const data = await response.json().catch(() => null);
      return !!(response.ok && data?.success);
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    headerFields,
    setHeaderFields,
    columnFields,
    setColumnFields,
    showHeaderFieldModal,
    setShowHeaderFieldModal,
    isLoading,
    isSaving,
    saveHeaderConfig,
  };
}
