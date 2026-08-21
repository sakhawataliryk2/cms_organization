"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  filterMentionModules,
  filterMentionUsers,
  formatRecordMentionToken,
  formatUserMentionToken,
  htmlFromSerializedNote,
  mentionPillHtml,
  recordMentionChipLabel,
  searchNoteRecords,
  serializeNoteEditor,
  userMentionLabel,
  type NoteMentionModule,
  type NoteMentionRecord,
  type NoteMentionUser,
} from "@/lib/noteMentions";

type PickerState =
  | { char: "@"; query: string }
  | { char: "#"; stage: "module"; query: string }
  | { char: "#"; stage: "record"; query: string; module: NoteMentionModule };

type NoteMentionTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  users: NoteMentionUser[];
  usersLoading?: boolean;
  onSelectUser: (user: NoteMentionUser) => void;
  onSelectRecord: (record: NoteMentionRecord) => void;
  textareaRef?: { current: HTMLElement | null };
  hasError?: boolean;
  placeholder?: string;
  rows?: number;
};

function isMentionNode(node: Node | null): node is HTMLElement {
  return Boolean(
    node &&
      node.nodeType === Node.ELEMENT_NODE &&
      (node as HTMLElement).dataset?.mention,
  );
}

function mentionFromNode(node: Node | null): HTMLElement | null {
  if (!node) return null;
  if (isMentionNode(node)) return node;
  if (node.nodeType === Node.ELEMENT_NODE) {
    return (node as HTMLElement).closest("[data-mention]");
  }
  return (node.parentElement as HTMLElement | null)?.closest("[data-mention]") ?? null;
}

function unwrapMentionPill(mention: HTMLElement, sel: Selection) {
  const text = mention.textContent || "";
  const textNode = document.createTextNode(text);
  mention.replaceWith(textNode);
  const range = document.createRange();
  range.setStart(textNode, textNode.textContent?.length ?? 0);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function getTriggerFromCaret(): { char: "@" | "#"; query: string; length: number } | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  if ((node.parentElement as HTMLElement | null)?.closest("[data-mention]")) return null;
  const before = (node.textContent || "").slice(0, range.startOffset);
  const match = before.match(/(^|[\s([{])([@#])([^\s@#]*)$/);
  if (!match) return null;
  return {
    char: match[2] as "@" | "#",
    query: match[3] || "",
    length: (match[3] || "").length + 1,
  };
}

export default function NoteMentionTextarea({
  value,
  onChange,
  users,
  usersLoading = false,
  onSelectUser,
  onSelectRecord,
  textareaRef,
  hasError = false,
  placeholder = "Enter your note text here. Type @ to tag teammates, # to pick a module and then a record.",
  rows = 6,
}: NoteMentionTextareaProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<PickerState | null>(null);
  const lastSerialized = useRef(value);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [picker, setPicker] = useState<PickerState | null>(null);
  const [records, setRecords] = useState<NoteMentionRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isEmpty, setIsEmpty] = useState(!value);

  const setEditorNode = useCallback(
    (node: HTMLDivElement | null) => {
      editorRef.current = node;
      if (textareaRef) textareaRef.current = node;
    },
    [textareaRef],
  );

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = serializeNoteEditor(editor);
    lastSerialized.current = next;
    setIsEmpty(!editor.textContent?.trim());
    onChange(next);
  }, [onChange]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (value === lastSerialized.current) return;
    lastSerialized.current = value;
    editor.innerHTML = htmlFromSerializedNote(value);
    setIsEmpty(!value.trim());
  }, [value]);

  const moduleOptions = useMemo(
    () =>
      picker?.char === "#" && picker.stage === "module"
        ? filterMentionModules(picker.query)
        : [],
    [picker],
  );

  const userOptions = useMemo(
    () =>
      picker?.char === "@" ? filterMentionUsers(users, picker.query) : [],
    [picker, users],
  );

  const optionCount =
    picker?.char === "@"
      ? userOptions.length
      : picker?.stage === "module"
        ? moduleOptions.length
        : records.length;

  useEffect(() => {
    if (!(picker?.char === "#" && picker.stage === "record")) {
      setRecords([]);
      setRecordsLoading(false);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const query = picker.query;
    const moduleType = picker.module.type;
    if (!query.trim()) {
      setRecords([]);
      setRecordsLoading(false);
      return;
    }
    setRecordsLoading(true);
    searchTimer.current = setTimeout(() => {
      void searchNoteRecords(query, moduleType)
        .then((rows) => {
          const current = pickerRef.current;
          if (
            current?.char === "#" &&
            current.stage === "record" &&
            current.query === query
          ) {
            setRecords(rows);
          }
        })
        .finally(() => {
          const current = pickerRef.current;
          if (
            current?.char === "#" &&
            current.stage === "record" &&
            current.query === query
          ) {
            setRecordsLoading(false);
          }
        });
    }, 180);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [picker]);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        pickerRef.current = null;
        setPicker(null);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-mention-index="${activeIndex}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const closePicker = () => {
    pickerRef.current = null;
    setPicker(null);
    setRecords([]);
    setActiveIndex(0);
  };

  const updatePickerFromCaret = useCallback(() => {
    const found = getTriggerFromCaret();
    if (!found) {
      closePicker();
      return;
    }
    const prev = pickerRef.current;
    if (found.char === "@") {
      const next: PickerState = { char: "@", query: found.query };
      const same = prev?.char === "@" && prev.query === found.query;
      pickerRef.current = next;
      setPicker(next);
      if (!same) setActiveIndex(0);
      return;
    }
    if (prev?.char === "#" && prev.stage === "record") {
      const next: PickerState = {
        char: "#",
        stage: "record",
        module: prev.module,
        query: found.query,
      };
      const same = prev.query === found.query;
      pickerRef.current = next;
      setPicker(next);
      if (!same) setActiveIndex(0);
      return;
    }
    const next: PickerState = { char: "#", stage: "module", query: found.query };
    const same = prev?.char === "#" && prev.stage === "module" && prev.query === found.query;
    pickerRef.current = next;
    setPicker(next);
    if (!same) setActiveIndex(0);
  }, []);

  const deleteTriggerText = (length: number) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const start = Math.max(0, range.startOffset - length);
    const text = node.textContent || "";
    node.textContent = text.slice(0, start) + text.slice(range.startOffset);
    const next = document.createRange();
    next.setStart(node, start);
    next.collapse(true);
    sel.removeAllRanges();
    sel.addRange(next);
  };

  const insertPillAndFinish = (html: string) => {
    const editor = editorRef.current;
    const found = getTriggerFromCaret();
    if (!editor || !found) return;
    deleteTriggerText(found.length);
    editor.focus();

    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const pill = wrap.firstElementChild;
    if (!pill) return;

    const sel = window.getSelection();
    if (!sel) return;
    let range: Range;
    if (sel.rangeCount) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.collapse(true);

    const space = document.createTextNode(" ");
    const fragment = document.createDocumentFragment();
    fragment.appendChild(pill);
    fragment.appendChild(space);
    range.insertNode(fragment);

    const after = document.createRange();
    after.setStart(space, 1);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);

    closePicker();
    emitChange();
  };

  const selectUser = (user: NoteMentionUser) => {
    const token = formatUserMentionToken(user);
    const html = mentionPillHtml("user", userMentionLabel(user), {
      email: user.email || "",
      token,
    });
    insertPillAndFinish(html);
    onSelectUser(user);
  };

  const selectRecord = (record: NoteMentionRecord) => {
    const token = formatRecordMentionToken(record);
    const html = mentionPillHtml("record", recordMentionChipLabel(record), {
      type: record.type,
      id: record.id,
      token,
    });
    insertPillAndFinish(html);
    onSelectRecord(record);
  };

  const selectModule = (mod: NoteMentionModule) => {
    const next: PickerState = { char: "#", stage: "record", module: mod, query: "" };
    pickerRef.current = next;
    setPicker(next);
    setRecords([]);
    setActiveIndex(0);
    const found = getTriggerFromCaret();
    if (found) deleteTriggerText(found.length);
    editorRef.current?.focus();
    document.execCommand("insertText", false, "#");
    emitChange();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if ((event.key === "Backspace" || event.key === "Delete") && sel?.rangeCount) {
      const range = sel.getRangeAt(0);
      let mention: HTMLElement | null = mentionFromNode(range.startContainer);
      if (!mention && !sel.isCollapsed) {
        mention = mentionFromNode(range.endContainer);
      }
      if (!mention && sel.isCollapsed) {
        const node = range.startContainer;
        if (event.key === "Backspace") {
          if (node.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
            const prev = node.previousSibling;
            if (isMentionNode(prev)) mention = prev;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const prev = (node as HTMLElement).childNodes[range.startOffset - 1];
            if (isMentionNode(prev)) mention = prev;
          }
        } else if (
          node.nodeType === Node.TEXT_NODE &&
          range.startOffset === (node.textContent || "").length
        ) {
          const next = node.nextSibling;
          if (isMentionNode(next)) mention = next;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const next = (node as HTMLElement).childNodes[range.startOffset];
          if (isMentionNode(next)) mention = next;
        }
      }
      if (mention) {
        event.preventDefault();
        unwrapMentionPill(mention, sel);
        emitChange();
        return;
      }
    }

    if (picker?.char === "#" && picker.stage === "record" && event.key === "Backspace") {
      const found = getTriggerFromCaret();
      if (found && found.query === "") {
        event.preventDefault();
        const next: PickerState = { char: "#", stage: "module", query: "" };
        pickerRef.current = next;
        setPicker(next);
        setActiveIndex(0);
        return;
      }
    }

    if (!picker) {
      if (event.key === "Enter") {
        event.preventDefault();
        document.execCommand("insertLineBreak");
        emitChange();
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (picker.char === "#" && picker.stage === "record") {
        const next: PickerState = { char: "#", stage: "module", query: "" };
        pickerRef.current = next;
        setPicker(next);
        setActiveIndex(0);
        return;
      }
      closePicker();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!optionCount) return;
      setActiveIndex((i) => (i + 1) % optionCount);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!optionCount) return;
      setActiveIndex((i) => (i - 1 + optionCount) % optionCount);
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      if (picker.char === "@") {
        const user = userOptions[activeIndex];
        if (user) selectUser(user);
        return;
      }
      if (picker.stage === "module") {
        const mod = moduleOptions[activeIndex];
        if (mod) selectModule(mod);
        return;
      }
      const record = records[activeIndex];
      if (record) selectRecord(record);
    }
  };

  const minHeight = `${Math.max(rows, 4) * 1.5 + 1.5}rem`;

  return (
    <div ref={wrapRef} className="relative">
      <div
        ref={setEditorNode}
        role="textbox"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) return;
          updatePickerFromCaret();
        }}
        onClick={updatePickerFromCaret}
        onInput={() => {
          emitChange();
          updatePickerFromCaret();
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          emitChange();
          updatePickerFromCaret();
        }}
        className={`relative z-10 w-full p-3 border rounded text-gray-900 focus:outline-none focus:ring-2 overflow-y-auto whitespace-pre-wrap wrap-break-word ${
          hasError
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:ring-blue-500"
        }`}
        style={{ minHeight }}
      />
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 p-3 text-gray-400">
          {placeholder}
        </div>
      )}
      {picker && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg"
          role="listbox"
        >
          {picker.char === "@" && (
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 bg-sky-50 border-b">
              Internal users
            </div>
          )}
          {picker.char === "#" && picker.stage === "module" && (
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 bg-slate-50 border-b">
              Choose a module
            </div>
          )}
          {picker.char === "#" && picker.stage === "record" && (
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide bg-slate-50 border-b text-slate-600">
              {picker.module.label} — type a name, title, or record number
            </div>
          )}

          {picker.char === "@" && usersLoading && (
            <div className="px-3 py-2 text-sm text-gray-500">Loading users...</div>
          )}
          {picker.char === "@" &&
            userOptions.map((user, index) => {
              const active = index === activeIndex;
              return (
                <button
                  type="button"
                  key={`${user.id ?? user.email ?? user.name}-${index}`}
                  data-mention-index={index}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                    active ? "bg-sky-50 text-blue-800" : "hover:bg-gray-50"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectUser(user);
                  }}
                >
                  <span className="font-medium">{userMentionLabel(user)}</span>
                  {user.email ? (
                    <span className="text-xs text-gray-500">{user.email}</span>
                  ) : null}
                </button>
              );
            })}
          {picker.char === "@" && !usersLoading && !userOptions.length && (
            <div className="px-3 py-2 text-sm text-gray-500">
              {picker.query ? "No matching users" : "Type to match an internal user"}
            </div>
          )}

          {picker.char === "#" &&
            picker.stage === "module" &&
            moduleOptions.map((mod, index) => {
              const active = index === activeIndex;
              return (
                <button
                  type="button"
                  key={mod.type}
                  data-mention-index={index}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                    active ? "bg-sky-50 text-blue-800" : "hover:bg-gray-50"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectModule(mod);
                  }}
                >
                  <span className="font-medium">{mod.label}</span>
                  <span className="text-xs text-gray-500">{mod.hint}</span>
                </button>
              );
            })}
          {picker.char === "#" && picker.stage === "module" && !moduleOptions.length && (
            <div className="px-3 py-2 text-sm text-gray-500">No matching modules</div>
          )}

          {picker.char === "#" && picker.stage === "record" && recordsLoading && (
            <div className="px-3 py-2 text-sm text-gray-500">Searching records...</div>
          )}
          {picker.char === "#" &&
            picker.stage === "record" &&
            records.map((record, index) => {
              const active = index === activeIndex;
              return (
                <button
                  type="button"
                  key={`${record.type}:${record.id}`}
                  data-mention-index={index}
                  className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                    active ? "bg-sky-50 text-blue-800" : "hover:bg-gray-50"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectRecord(record);
                  }}
                >
                  <span className="font-medium">{recordMentionChipLabel(record)}</span>
                  <span className="text-xs text-gray-500">{record.type}</span>
                </button>
              );
            })}
          {picker.char === "#" &&
            picker.stage === "record" &&
            !recordsLoading &&
            !records.length && (
              <div className="px-3 py-2 text-sm text-gray-500">
                {picker.query
                  ? "No matching records"
                  : `Type a ${picker.module.hint.toLowerCase()}`}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
