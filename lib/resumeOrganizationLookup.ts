/**
 * Name-based organization matching for resume parse → job-seeker Field_5.
 * Looks up CRM organizations by cleaned employer name (exact, nickname, and
 * token/contains patterns). Does not use SQL FK columns.
 */

const LEGAL_SUFFIX_RE =
  /\b(inc|incorporated|llc|l\.l\.c|ltd|limited|co|company|corp|corporation|plc|lp|llp|pc|pllc|group|holdings|partners|the)\b/gi;

export type ResumeWorkExperience = {
  company?: string;
  job_title?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
};

export type OrganizationNameCandidate = {
  id?: string | number | null;
  name?: string | null;
  nicknames?: string | null;
};

export function normalizeOrgMatchName(name?: string | null): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(LEGAL_SUFFIX_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop city/state/dates that often trail employer names on resumes. */
export function cleanCompanyName(raw?: string | null): string {
  let name = String(raw ?? "").trim();
  if (!name) return "";

  name = name.replace(/\([^)]*\d{4}[^)]*\)\s*$/i, "").trim();
  name = name.replace(/\s+[–—-]\s+\d{4}.*$/i, "").trim();

  const parts = name
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const lastIsState = /^[A-Za-z]{2}$/.test(last);
    if (lastIsState && parts.length >= 2) {
      parts.pop();
      if (parts.length >= 2) parts.pop();
      return parts.join(", ").trim();
    }
  }

  return name;
}

function isCurrentRoleEndDate(endDate?: string | null): boolean {
  const v = String(endDate ?? "").trim();
  if (!v) return false;
  return /present|current|now|ongoing/i.test(v);
}

export function pickCurrentOrganizationName(
  parsed: {
    current_organization?: string;
    work_experience?: ResumeWorkExperience[];
  },
  resumeText?: string
): string {
  if (resumeText) {
    const headerMatch = resumeText.match(
      /([A-Z][A-Z0-9&.'\s-]{2,80}),\s+[A-Za-z][A-Za-z\s.-]+,\s+[A-Z]{2}\s*\([^)]*(?:present|current)/i
    );
    if (headerMatch?.[1]) {
      const fromHeader = cleanCompanyName(headerMatch[1]);
      if (fromHeader) return fromHeader;
    }
  }

  const jobs = Array.isArray(parsed.work_experience) ? parsed.work_experience : [];
  const current = jobs.find((j) => isCurrentRoleEndDate(j.end_date));
  const fromCurrent = cleanCompanyName(current?.company);
  if (fromCurrent) return fromCurrent;

  const explicit = cleanCompanyName(parsed.current_organization);
  if (explicit) return explicit;

  return cleanCompanyName(jobs[0]?.company);
}

function nicknameList(nicknames?: string | null): string[] {
  return String(nicknames ?? "")
    .split(/[,;|]/)
    .map((n) => normalizeOrgMatchName(n))
    .filter(Boolean);
}

export function scoreOrganizationNameMatch(
  query: string,
  candidateName?: string | null,
  nicknames?: string | null
): number {
  const q = normalizeOrgMatchName(query);
  const n = normalizeOrgMatchName(candidateName);
  if (!q || !n) return 0;

  if (q === n) return 100;

  const nicks = nicknameList(nicknames);
  if (nicks.includes(q)) return 95;

  if (n.startsWith(q) || q.startsWith(n)) return 80;
  if (n.includes(q) || (q.length >= 8 && q.includes(n))) return 70;

  const qTokens = q.split(" ").filter((t) => t.length > 1);
  const nTokenSet = new Set(n.split(" ").filter((t) => t.length > 1));
  if (qTokens.length >= 2) {
    const overlap = qTokens.filter((t) => nTokenSet.has(t)).length;
    if (overlap === qTokens.length) return 65;
    if (overlap >= 2) return 50;
  }

  for (const nick of nicks) {
    if (nick.includes(q) || (q.length >= 8 && q.includes(nick))) return 60;
  }

  return 0;
}

export function pickBestOrganizationMatch(
  query: string,
  organizations: OrganizationNameCandidate[]
): OrganizationNameCandidate | null {
  const cleaned = cleanCompanyName(query);
  if (!cleaned || !Array.isArray(organizations) || organizations.length === 0) {
    return null;
  }

  let best: OrganizationNameCandidate | null = null;
  let bestScore = 0;
  for (const org of organizations) {
    const score = scoreOrganizationNameMatch(cleaned, org.name, org.nicknames);
    if (score > bestScore) {
      bestScore = score;
      best = org;
    }
  }

  if (!best || best.id == null || bestScore < 50) return null;
  return best;
}
