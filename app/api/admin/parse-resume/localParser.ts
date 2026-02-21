/**
 * Free, open-source local resume parser.
 * Extracts text from PDF/DOCX/TXT then parses name, email, phone, and sections
 * into the same shape as external APIs (so resumeResultToRow in admin works).
 */

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}/g;

const SECTION_HEADERS = [
  'professional experience', 'work experience', 'experience', 'employment',
  'education', 'academic', 'qualifications',
  'technical skills', 'core competencies', 'skills', 'expertise',
  'summary', 'objective', 'profile', 'about',
  'projects', 'certifications', 'languages', 'contact', 'references',
];

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  return [...new Set(matches)].slice(0, 3);
}

function extractPhones(text: string): string[] {
  const matches = text.match(PHONE_REGEX) || [];
  return [...new Set(matches)]
    .map((s) => s.trim())
    .filter((s) => s.length >= 10 && /\d{3,}/.test(s))
    .slice(0, 3);
}

function findSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  let currentHeader = 'preamble';
  let currentContent: string[] = [];

  const flush = () => {
    const content = currentContent.join(' ').replace(/\s+/g, ' ').trim();
    if (content) sections[currentHeader] = content;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    const isHeader = SECTION_HEADERS.some((h) => lower === h || lower.startsWith(h + ':') || lower.startsWith(h + ' '));
    const headerMatch = SECTION_HEADERS.find((h) => lower === h || lower.startsWith(h + ':'));
    if (isHeader && headerMatch) {
      flush();
      currentHeader = headerMatch;
      currentContent = [trimmed.replace(new RegExp(`^${headerMatch}:?\\s*`, 'i'), '')];
    } else {
      currentContent.push(trimmed);
    }
  }
  flush();
  return sections;
}

function guessName(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (line.includes('@') || PHONE_REGEX.test(line)) continue;
    if (line.length >= 2 && line.length <= 60 && /^[A-Za-z\s.'-]+$/.test(line)) {
      return line;
    }
  }
  return '';
}

/** Parse raw resume text into APYHub-like result for resumeResultToRow. */
export function parseResumeText(text: string): {
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  candidate_address: string;
  positions: Array<{ position_name: string; company_name: string; skills: string[]; job_details: string }>;
  education_qualifications: Array<{ school_name: string; degree_type: string; specialization_subjects: string }>;
} {
  const emails = extractEmails(text);
  const phones = extractPhones(text);
  const sections = findSections(text);
  const name = guessName(text);

  const experienceText = sections['experience'] || sections['work experience'] || sections['employment'] || sections['professional experience'] || '';
  const educationText = sections['education'] || sections['academic'] || sections['qualifications'] || '';
  const skillsText = sections['skills'] || sections['technical skills'] || sections['core competencies'] || sections['expertise'] || '';

  const skillsList = skillsText
    ? skillsText.split(/[,;•·|–-]|\n/).map((s) => s.trim()).filter(Boolean)
    : [];

  const positions = experienceText
    ? [{ position_name: '', company_name: '', skills: skillsList, job_details: experienceText }]
    : [{ position_name: '', company_name: '', skills: skillsList, job_details: '' }];

  const education_qualifications = educationText
    ? [{ school_name: educationText.slice(0, 200), degree_type: '', specialization_subjects: '' }]
    : [];

  return {
    candidate_name: name,
    candidate_email: emails[0] || '',
    candidate_phone: phones[0] || '',
    candidate_address: '',
    positions,
    education_qualifications,
  };
}
