import { formatRecordId, type RecordType } from "@/lib/recordIdFormatter";

export type NoteMentionTrigger = {
  char: "@" | "#";
  start: number;
  end: number;
  query: string;
};

export type NoteMentionUser = {
  id?: string | number;
  name?: string;
  email?: string;
};

export type NoteMentionRecord = {
  id: string;
  type: string;
  display: string;
  value: string;
};

export function getMentionTrigger(
  text: string,
  cursor: number,
): NoteMentionTrigger | null {
  if (cursor < 0 || cursor > text.length) return null;
  const before = text.slice(0, cursor);
  const match = before.match(/(^|[\s([{])([@#])([^\s@#]*)$/);
  if (!match) return null;
  const char = match[2] as "@" | "#";
  const query = match[3] ?? "";
  const start = before.length - query.length - 1;
  return { char, start, end: cursor, query };
}

export function replaceMentionToken(
  text: string,
  trigger: NoteMentionTrigger,
  insertion: string,
): { text: string; cursor: number } {
  const token = insertion.endsWith(" ") ? insertion : `${insertion} `;
  const next = text.slice(0, trigger.start) + token + text.slice(trigger.end);
  return { text: next, cursor: trigger.start + token.length };
}

export function userMentionLabel(user: NoteMentionUser): string {
  const name = String(user.name || "").trim();
  if (name) return name;
  const email = String(user.email || "").trim();
  return email || "User";
}

export function userNotifyValue(user: NoteMentionUser): string | null {
  const email = String(user.email || "").trim();
  if (email) return email;
  const name = String(user.name || "").trim();
  return name || null;
}

export const NOTE_MENTION_MODULES = [
  {
    type: "Organization",
    label: "Organizations",
    hint: "Name or record number",
    aliases: ["o", "org", "organization"],
  },
  {
    type: "Job",
    label: "Jobs",
    hint: "Title or record number",
    aliases: ["j", "job"],
  },
  {
    type: "Job Seeker",
    label: "Job Seekers",
    hint: "Name or record number",
    aliases: ["js", "jobseeker", "candidate"],
  },
  {
    type: "Lead",
    label: "Leads",
    hint: "Name or record number",
    aliases: ["l", "lead"],
  },
  {
    type: "Hiring Manager",
    label: "Hiring Managers",
    hint: "Name or record number",
    aliases: ["hm", "hiring", "manager"],
  },
  {
    type: "Task",
    label: "Tasks",
    hint: "Title or record number",
    aliases: ["t", "task"],
  },
  {
    type: "Placement",
    label: "Placements",
    hint: "Name, job title, or record number",
    aliases: ["p", "placement"],
  },
] as const;

export type NoteMentionModule = (typeof NOTE_MENTION_MODULES)[number];

export function filterMentionModules(query: string): NoteMentionModule[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...NOTE_MENTION_MODULES];
  return NOTE_MENTION_MODULES.filter((mod) => {
    if (mod.label.toLowerCase().includes(q) || mod.type.toLowerCase().includes(q)) {
      return true;
    }
    return mod.aliases.some((alias) => alias.startsWith(q) || q.startsWith(alias));
  });
}

export function mentionPillClass(_kind?: string): string {
  return "bg-sky-50 text-blue-700 border-sky-200";
}

export const MENTION_PILL_BASE_CLASS =
  "mention-pill inline-flex items-baseline rounded border px-1.5 py-0 mx-px text-[13px] font-medium leading-5 align-baseline select-none";

export function formatUserMentionToken(user: NoteMentionUser): string {
  const label = userMentionLabel(user).replace(/[\]|]/g, "");
  const email = userNotifyValue(user)?.replace(/[\]|]/g, "") || label;
  return `@[[${email}|${label}]]`;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function mentionPillHtml(
  kind: "user" | "record",
  label: string,
  meta: { type?: string; id?: string; email?: string; token: string },
): string {
  const color = mentionPillClass(kind === "user" ? "user" : meta.type || "");
  const prefix = kind === "user" ? "@" : "#";
  const typeAttr = meta.type ? ` data-type="${escapeHtml(meta.type)}"` : "";
  const idAttr = meta.id ? ` data-id="${escapeHtml(meta.id)}"` : "";
  const emailAttr = meta.email ? ` data-email="${escapeHtml(meta.email)}"` : "";
  return `<span contenteditable="false" class="${MENTION_PILL_BASE_CLASS} ${color}" data-mention="${kind}" data-token="${escapeHtml(meta.token)}" data-label="${escapeHtml(label)}"${typeAttr}${idAttr}${emailAttr}>${prefix}${escapeHtml(label)}</span>`;
}

export function htmlFromSerializedNote(text: string): string {
  const raw = text ?? "";
  if (!raw) return "";
  const parts = parseNoteTextParts(raw, []);
  if (!parts.length) {
    return escapeHtml(raw).replace(/\n/g, "<br>");
  }
  return parts
    .map((part) => {
      if (part.kind === "text") return escapeHtml(part.text).replace(/\n/g, "<br>");
      if (part.kind === "user") {
        return mentionPillHtml("user", part.label, {
          email: part.email,
          token: `@[[${part.email}|${part.label}]]`,
        });
      }
      return mentionPillHtml("record", part.label, {
        type: part.type,
        id: part.id,
        token: `#[[${part.type}:${part.id}|${part.label}]]`,
      });
    })
    .join("");
}

export function serializeNoteEditor(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent || "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.dataset?.token) {
      out += el.dataset.token;
      return;
    }
    if (el.tagName === "BR") {
      out += "\n";
      return;
    }
    const block = el.tagName === "DIV" || el.tagName === "P";
    if (block && out && !out.endsWith("\n")) out += "\n";
    el.childNodes.forEach(walk);
    if (block && !out.endsWith("\n")) out += "\n";
  };
  root.childNodes.forEach(walk);
  return out.replace(/\n+$/, "");
}

export function filterMentionUsers(
  users: NoteMentionUser[],
  query: string,
  limit = 12,
): NoteMentionUser[] {
  const q = query.trim().toLowerCase();
  const filtered = (users || []).filter((user) => {
    if (!userNotifyValue(user)) return false;
    if (!q) return true;
    const name = String(user.name || "").toLowerCase();
    const email = String(user.email || "").toLowerCase();
    return name.includes(q) || email.includes(q);
  });
  return filtered.slice(0, limit);
}

function toRecord(
  item: any,
  type: string,
  formatKey: RecordType,
  name: string,
): NoteMentionRecord {
  const num = item?.record_number ?? item?.recordNumber ?? item?.id;
  const prefixLabel = formatRecordId(num, formatKey);
  const label = String(name || "Unnamed").trim() || "Unnamed";
  return {
    id: String(item?.id ?? ""),
    type,
    display: `${prefixLabel} ${label}`.trim(),
    value: prefixLabel,
  };
}

export function mapSearchResultsToNoteRecords(results: any): NoteMentionRecord[] {
  const out: NoteMentionRecord[] = [];
  const r = results && typeof results === "object" ? results : {};

  for (const job of r.jobs || []) {
    out.push(
      toRecord(job, "Job", "job", job.job_title || job.title || job.name),
    );
  }
  for (const org of r.organizations || []) {
    out.push(toRecord(org, "Organization", "organization", org.name));
  }
  for (const js of r.jobSeekers || []) {
    const name =
      `${js.first_name || ""} ${js.last_name || ""}`.trim() ||
      js.name ||
      js.full_name;
    out.push(toRecord(js, "Job Seeker", "jobSeeker", name));
  }
  for (const lead of r.leads || []) {
    out.push(toRecord(lead, "Lead", "lead", lead.name));
  }
  for (const hm of r.hiringManagers || []) {
    const name =
      `${hm.first_name || ""} ${hm.last_name || ""}`.trim() ||
      hm.name ||
      hm.full_name;
    out.push(toRecord(hm, "Hiring Manager", "hiringManager", name));
  }
  for (const task of r.tasks || []) {
    out.push(toRecord(task, "Task", "task", task.title || task.task_title));
  }
  for (const placement of r.placements || []) {
    const name =
      [placement.jobSeekerName, placement.jobTitle, placement.job_title]
        .filter(Boolean)
        .join(" – ") || "Placement";
    out.push(toRecord(placement, "Placement", "placement", name));
  }

  return out.filter((row) => row.id);
}

export async function searchNoteRecords(
  query: string,
  moduleType?: string,
): Promise<NoteMentionRecord[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(`/api/search?query=${encodeURIComponent(q)}&limit=12`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  if (!data?.success || !data.results) return [];
  const rows = mapSearchResultsToNoteRecords(data.results);
  if (!moduleType) return rows;
  const wanted = moduleType.toLowerCase().replace(/[\s_-]+/g, "");
  return rows.filter(
    (row) => row.type.toLowerCase().replace(/[\s_-]+/g, "") === wanted,
  );
}

const RECORD_VIEW_ROUTES: Record<string, string> = {
  organization: "/dashboard/organizations/view",
  organizations: "/dashboard/organizations/view",
  job: "/dashboard/jobs/view",
  jobs: "/dashboard/jobs/view",
  jobseeker: "/dashboard/job-seekers/view",
  jobseekers: "/dashboard/job-seekers/view",
  candidate: "/dashboard/job-seekers/view",
  lead: "/dashboard/leads/view",
  leads: "/dashboard/leads/view",
  hiringmanager: "/dashboard/hiring-managers/view",
  hiringmanagers: "/dashboard/hiring-managers/view",
  contact: "/dashboard/hiring-managers/view",
  task: "/dashboard/tasks/view",
  tasks: "/dashboard/tasks/view",
  placement: "/dashboard/placements/view",
  placements: "/dashboard/placements/view",
};

export function noteRecordHref(
  type: string | null | undefined,
  id: string | number | null | undefined,
): string | null {
  if (id == null || String(id).trim() === "") return null;
  const key = String(type || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  const path = RECORD_VIEW_ROUTES[key];
  if (!path) return null;
  return `${path}?id=${encodeURIComponent(String(id).trim())}`;
}

export function recordMentionLabel(record: NoteMentionRecord): string {
  const display = String(record.display || "").trim();
  const value = String(record.value || "").trim();
  if (value && display.toLowerCase().startsWith(value.toLowerCase())) {
    const rest = display.slice(value.length).trim();
    if (rest) return rest;
  }
  const stripped = display.replace(/^(JS|HM|O|J|L|T|P)\s+\d+\s+/i, "").trim();
  return stripped || display || String(record.type || "Record");
}

export function formatRecordMentionToken(record: NoteMentionRecord): string {
  const label = recordMentionLabel(record).replace(/[\]|]/g, "");
  const type = String(record.type || "Record").replace(/[\[\]:]/g, "");
  return `#[[${type}:${record.id}|${label}]]`;
}

export function parseNoteAboutReferences(refs: unknown): NoteMentionRecord[] {
  let rows: unknown[] = [];
  if (!refs) return [];
  if (typeof refs === "string") {
    const trimmed = refs.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) rows = parsed;
    } catch {
      return [];
    }
  } else if (Array.isArray(refs)) {
    rows = refs;
  } else {
    return [];
  }

  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = r.id ?? r.record_id ?? r.recordId;
      if (id == null || String(id).trim() === "") return null;
      return {
        id: String(id),
        type: String(r.type || r.entity_type || r.entityType || ""),
        display: String(r.display || r.label || r.name || r.title || "").trim(),
        value: String(r.value || "").trim(),
      } as NoteMentionRecord;
    })
    .filter(Boolean) as NoteMentionRecord[];
}

export function noteReferencePayload(note: any): unknown {
  if (!note || typeof note !== "object") return null;
  const additional = note.additional_references ?? note.additionalReferences;
  const about = note.about_references ?? note.aboutReferences ?? note.about;
  if (Array.isArray(about) && Array.isArray(additional)) {
    return [...about, ...additional];
  }
  return about ?? additional ?? null;
}

export type NoteTextPart =
  | { kind: "text"; text: string }
  | { kind: "record"; label: string; href: string; type: string; id: string }
  | { kind: "user"; label: string; email: string };

function spansOverlap(
  spans: Array<{ start: number; end: number }>,
  start: number,
  end: number,
) {
  return spans.some((s) => start < s.end && end > s.start);
}

export function parseNoteTextParts(
  text: string,
  refs: NoteMentionRecord[] = [],
): NoteTextPart[] {
  const raw = text ?? "";
  if (!raw) return [];

  type Span = { start: number; end: number; part: NoteTextPart };
  const spans: Span[] = [];

  const structured = /#\[\[([^:\]]+):([^|\]]+)\|([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = structured.exec(raw)) !== null) {
    const type = match[1].trim();
    const id = match[2].trim();
    const label = match[3].trim();
    const href = noteRecordHref(type, id);
    if (!href || !label) continue;
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      part: { kind: "record", label, href, type, id },
    });
  }

  const userToken = /@\[\[([^|\]]+)\|([^\]]+)\]\]/g;
  while ((match = userToken.exec(raw)) !== null) {
    const email = match[1].trim();
    const label = match[2].trim();
    if (!label) continue;
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      part: { kind: "user", label, email },
    });
  }

  const needles: Array<{ needle: string; ref: NoteMentionRecord }> = [];
  for (const ref of refs) {
    if (!ref?.id) continue;
    const label = recordMentionLabel(ref);
    const display = String(ref.display || "").trim();
    const value = String(ref.value || "").trim();
    for (const needle of [`#${display}`, `#${label}`, `#${value}`]) {
      if (needle.length > 1) needles.push({ needle, ref });
    }
  }
  needles.sort((a, b) => b.needle.length - a.needle.length);

  for (const { needle, ref } of needles) {
    const href = noteRecordHref(ref.type, ref.id);
    if (!href) continue;
    let from = 0;
    while (from < raw.length) {
      const idx = raw.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      if (!spansOverlap(spans, idx, end)) {
        spans.push({
          start: idx,
          end,
          part: {
            kind: "record",
            label: recordMentionLabel(ref),
            href,
            type: ref.type,
            id: String(ref.id),
          },
        });
      }
      from = end;
    }
  }

  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept: Span[] = [];
  for (const span of spans) {
    if (spansOverlap(kept, span.start, span.end)) continue;
    kept.push(span);
  }

  const parts: NoteTextPart[] = [];
  let cursor = 0;
  for (const span of kept) {
    if (span.start > cursor) {
      parts.push({ kind: "text", text: raw.slice(cursor, span.start) });
    }
    parts.push(span.part);
    cursor = span.end;
  }
  if (cursor < raw.length) parts.push({ kind: "text", text: raw.slice(cursor) });
  return parts;
}

export function truncateNoteTextParts(
  parts: NoteTextPart[],
  maxChars: number,
): NoteTextPart[] {
  if (!maxChars || maxChars <= 0) return parts;
  let used = 0;
  const out: NoteTextPart[] = [];
  for (const part of parts) {
    if (used >= maxChars) {
      out.push({ kind: "text", text: "..." });
      break;
    }
    if (part.kind === "record" || part.kind === "user") {
      out.push(part);
      used += part.label.length;
      continue;
    }
    const remain = maxChars - used;
    if (part.text.length <= remain) {
      out.push(part);
      used += part.text.length;
    } else {
      out.push({ kind: "text", text: `${part.text.slice(0, remain)}...` });
      break;
    }
  }
  return out;
}
