import { useState, useEffect } from "react";

interface UseHeaderConfigOptions {
  entityType: string;
  defaultFields: string[];
  configType?: "header" | "columns"; 
}

export function useHeaderConfig({
  entityType,
  defaultFields,
  configType = "header",
}: UseHeaderConfigOptions) {
  const [headerFields, setHeaderFields] = useState<string[]>(defaultFields);
  const [showHeaderFieldModal, setShowHeaderFieldModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load global header fields configuration from backend
  useEffect(() => {
    const fetchHeaderConfig = async () => {
      try {
        setIsLoading(true);
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith("token="))
          ?.split("=")[1];

        if (!token) {
          console.warn("No token found, using default header fields");
          setHeaderFields(defaultFields);
          setIsLoading(false);
          return;
        }

       const response = await fetch(
          `/api/header-config?entityType=${encodeURIComponent(
            entityType
          )}&configType=${encodeURIComponent(configType)}`, // NEW
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.headerFields)) {
            if (data.headerFields.length > 0) {
              setHeaderFields(data.headerFields);
            } else {
              // Empty config, use defaults
              setHeaderFields(defaultFields);
            }
          } else {
            console.error("Failed to fetch header config, using defaults");
            setHeaderFields(defaultFields);
          }
        } else {
          console.error("Failed to fetch header config, using defaults");
          setHeaderFields(defaultFields);
        }
      } catch (error) {
        console.error("Error fetching header configuration:", error);
        setHeaderFields(defaultFields);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHeaderConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]); // Only depend on entityType, not defaultFields to avoid infinite loops

  // Save header configuration to backend
  const saveHeaderConfig = async (): Promise<boolean> => {
    try {
      setIsSaving(true);
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token="))
        ?.split("=")[1];

      if (!token) {
        alert("Authentication required. Please log in again.");
        return false;
      }

     const response = await fetch(
       `/api/header-config?entityType=${encodeURIComponent(
         entityType
       )}&configType=${encodeURIComponent(configType)}`, // NEW
       {
         method: "PUT",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`,
         },
         body: JSON.stringify({ fields: headerFields }),
       }
     );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return true;
        } else {
          throw new Error(
            data.message || "Failed to save header configuration"
          );
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Failed to save: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error("Error saving header configuration:", error);
      alert(
        `Failed to save header configuration: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    headerFields,
    setHeaderFields,
    showHeaderFieldModal,
    setShowHeaderFieldModal,
    isLoading,
    isSaving,
    saveHeaderConfig,
  };
}

