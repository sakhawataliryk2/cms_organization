"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface MultipleAddContextType {
  isMultipleAddMode: boolean;
  setMultipleAddMode: (enabled: boolean) => void;
  toggleMultipleAddMode: () => void;
}

const MultipleAddContext = createContext<MultipleAddContextType | undefined>(
  undefined
);

export function MultipleAddProvider({ children }: { children: ReactNode }) {
  const [isMultipleAddMode, setIsMultipleAddMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("isMultipleAddMode");
    if (stored !== null) {
      setIsMultipleAddMode(stored === "true");
    }
  }, []);

  const setMultipleAddMode = (enabled: boolean) => {
    setIsMultipleAddMode(enabled);
    localStorage.setItem("isMultipleAddMode", enabled.toString());
  };

  const toggleMultipleAddMode = () => {
    setIsMultipleAddMode((prev) => {
      const updated = !prev;
      localStorage.setItem("isMultipleAddMode", updated.toString());
      return updated;
    });
  };

  return (
    <MultipleAddContext.Provider
      value={{
        isMultipleAddMode,
        setMultipleAddMode,
        toggleMultipleAddMode,
      }}
    >
      {children}
    </MultipleAddContext.Provider>
  );
}

export function useMultipleAdd() {
  const context = useContext(MultipleAddContext);
  if (context === undefined) {
    throw new Error(
      "useMultipleAdd must be used within a MultipleAddProvider"
    );
  }
  return context;
}