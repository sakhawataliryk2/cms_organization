"use client";

import LoadingScreen from "@/components/LoadingScreen";

export default function LoadingState({ text = "Loading..." }: { text?: string }) {
  return <LoadingScreen message={text} />;
}

