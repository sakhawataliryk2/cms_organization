"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  filterMentionUsers,
  formatRecordMentionToken,
  getMentionTrigger,
  replaceMentionToken,
  searchNoteRecords,
  userMentionLabel,
  type NoteMentionRecord,
  type NoteMentionTrigger,
  type NoteMentionUser,
} from "@/lib/noteMentions";

type MentionOption =
  | { kind: "user"; user: NoteMentionUser }
  | { kind: "record"; record: NoteMentionRecord };

type NoteMentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  users: NoteMentionUser[];
  usersLoading?: boolean;
  onSelectUser: (user: NoteMentionUser) => void;
  onSelectRecord: (record: NoteMentionRecord) => void;
  textareaRef?: { current: HTMLTextAreaElement | null };
  hasError?: boolean;
  placeholder?: string;
  rows?: number;
};

export default function NoteMentionTextarea({
  value,
  onChange,
  users,
  usersLoading = false,
  onSelectUser,
  onSelectRecord,
  textareaRef,
  hasError = false,
  placeholder = "Enter your note text here. Type @ to tag teammates, # to link a job, organization, job seeker, lead, and more.",
  rows = 6,
}: NoteMentionTextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<NoteMentionTrigger | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [trigger, setTrigger] = useState<NoteMentionTrigger | null>(null);
  const [records, setRecords] = useState<NoteMentionRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const textarea = textareaRef ?? innerRef;

  const userOptions = useMemo(
    () =>
      trigger?.char === "@"
        ? filterMentionUsers(users, trigger.query).map(
            (user) => ({ kind: "user", user }) as MentionOption,
          )
        : [],
    [trigger, users],
  );

  const recordOptions = useMemo(
    () =>
      trigger?.char === "#"
        ? records.map((record) => ({ kind: "record", record }) as MentionOption)
        : [],
    [trigger, records],
  );

  const options = trigger?.char === "@" ? userOptions : recordOptions;
  const isOpen = Boolean(trigger);

  const updateTriggerFromTextarea = useCallback(
    (text: string, cursor: number) => {
      const next = getMentionTrigger(text, cursor);
      triggerRef.current = next;
      setTrigger(next);
      setActiveIndex(0);
      if (next?.char !== "#") {
        setRecords([]);
        setRecordsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (trigger?.char !== "#") return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const query = trigger.query;
    if (!query.trim()) {
      setRecords([]);
      setRecordsLoading(false);
      return;
    }
    setRecordsLoading(true);
    searchTimer.current = setTimeout(() => {
      void searchNoteRecords(query)
        .then((rows) => {
          if (triggerRef.current?.char === "#" && triggerRef.current.query === query) {
            setRecords(rows);
          }
        })
        .finally(() => {
          if (triggerRef.current?.char === "#" && triggerRef.current.query === query) {
            setRecordsLoading(false);
          }
        });
    }, 180);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [trigger?.char, trigger?.query]);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        triggerRef.current = null;
        setTrigger(null);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-mention-index="${activeIndex}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const applySelection = useCallback(
    (option: MentionOption) => {
      const current = triggerRef.current;
      const el = textarea.current;
      if (!current || !el) return;

      const insertion =
        option.kind === "user"
          ? `@${userMentionLabel(option.user)}`
          : formatRecordMentionToken(option.record);
      const next = replaceMentionToken(value, current, insertion);
      onChange(next.text);
      if (option.kind === "user") onSelectUser(option.user);
      else onSelectRecord(option.record);

      triggerRef.current = null;
      setTrigger(null);
      setRecords([]);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(next.cursor, next.cursor);
      });
    },
    [onChange, onSelectRecord, onSelectUser, textarea, value],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      triggerRef.current = null;
      setTrigger(null);
      return;
    }
    if (!options.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) applySelection(option);
    }
  };

  const groupedRecords = useMemo(() => {
    const groups: Array<{ type: string; items: Array<{ option: MentionOption; index: number }> }> = [];
    const indexByType = new Map<string, number>();
    recordOptions.forEach((option, index) => {
      if (option.kind !== "record") return;
      const type = option.record.type;
      let gi = indexByType.get(type);
      if (gi == null) {
        gi = groups.length;
        indexByType.set(type, gi);
        groups.push({ type, items: [] });
      }
      groups[gi].items.push({ option, index });
    });
    return groups;
  }, [recordOptions]);

  const loadingLabel =
    trigger?.char === "@"
      ? usersLoading
        ? "Loading users..."
        : null
      : recordsLoading
        ? "Searching records..."
        : null;

  const emptyLabel =
    trigger?.char === "@"
      ? usersLoading
        ? null
        : trigger.query
          ? "No matching users"
          : "Type to match an internal user"
      : recordsLoading
        ? null
        : trigger?.query
          ? "No matching records"
          : "Type to match a job, organization, job seeker, lead, and more";

  return (
    <div ref={wrapRef} className="relative">
      <textarea
        ref={textarea}
        value={value}
        autoFocus
        rows={rows}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onClick={(e) =>
          updateTriggerFromTextarea(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
        }
        onKeyUp={(e) => {
          if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) return;
          updateTriggerFromTextarea(e.currentTarget.value, e.currentTarget.selectionStart ?? 0);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          updateTriggerFromTextarea(e.target.value, e.target.selectionStart ?? 0);
        }}
        className={`w-full p-3 border rounded focus:outline-none focus:ring-2 ${
          hasError
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:ring-blue-500"
        }`}
      />
      {isOpen && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg"
          role="listbox"
        >
          {trigger?.char === "@" && (
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-b">
              Internal users
            </div>
          )}
          {loadingLabel && (
            <div className="px-3 py-2 text-sm text-gray-500">{loadingLabel}</div>
          )}
          {trigger?.char === "@" &&
            userOptions.map((option, index) => {
              if (option.kind !== "user") return null;
              const user = option.user;
              const active = index === activeIndex;
              return (
                <button
                  type="button"
                  key={`${user.id ?? user.email ?? user.name}-${index}`}
                  data-mention-index={index}
                  role="option"
                  aria-selected={active}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                    active ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySelection(option);
                  }}
                >
                  <span className="font-medium">{userMentionLabel(user)}</span>
                  {user.email ? (
                    <span className="text-xs text-gray-500">{user.email}</span>
                  ) : null}
                </button>
              );
            })}
          {trigger?.char === "#" &&
            groupedRecords.map((group) => (
              <div key={group.type}>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-50 border-y">
                  {group.type}
                </div>
                {group.items.map(({ option, index }) => {
                  if (option.kind !== "record") return null;
                  const active = index === activeIndex;
                  return (
                    <button
                      type="button"
                      key={`${option.record.type}:${option.record.id}`}
                      data-mention-index={index}
                      role="option"
                      aria-selected={active}
                      className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                        active ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50"
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySelection(option);
                      }}
                    >
                      <span className="font-medium">{option.record.display}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          {!loadingLabel && !options.length && emptyLabel && (
            <div className="px-3 py-2 text-sm text-gray-500">{emptyLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}
