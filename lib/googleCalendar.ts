export interface CalendarEvent {
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  body?: {
    contentType: string;
    content: string;
  };
  location?: {
    displayName: string;
  };
}

export const getCalendarTimeZone = (): string => {
  if (typeof Intl !== "undefined") {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }
  return "UTC";
};

export const toLocalDateTimeString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
};

export const sendCalendarInvite = async (
  event: CalendarEvent,
  attendees: string[],
): Promise<boolean> => {
  const response = await fetch("/api/google/calendar/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      attendees,
      sendUpdates: "all",
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.message || "Failed to send Google calendar invite");
  }

  return true;
};
