import type { Dispatch, SetStateAction } from "react";
import type { ParsedJob } from "@/app/api/parse-job/route";

type FormField = {
  id: string;
  name: string;
  label: string;
  type: string;
  required: boolean;
  visible: boolean;
  options?: string[];
  placeholder?: string;
  value: string;
};

type SimpleCustomField = {
  field_name: string;
  field_label?: string | null;
};

// Label groups for mapping ParsedJob fields into admin-defined labels
const LABELS_FOR_JOB_TITLE = ["Job Title", "Title", "Position"];
const LABELS_FOR_ORGANIZATION = ["Organization", "Organization Name", "Company"];
const LABELS_FOR_LOCATION = ["Location", "Job Location"];
const LABELS_FOR_CITY = ["City"];
const LABELS_FOR_STATE = ["State", "Province"];
const LABELS_FOR_COUNTRY = ["Country"];
const LABELS_FOR_REMOTE_ONSITE = ["Remote / Onsite", "Remote or Onsite", "Work Arrangement"];
const LABELS_FOR_EMPLOYMENT_TYPE = ["Employment Type", "Job Type"];
const LABELS_FOR_STATUS = ["Status", "Job Status"];
const LABELS_FOR_SALARY_MIN = ["Minimum Salary", "Salary Min", "Min Salary", "Base Salary Min"];
const LABELS_FOR_SALARY_MAX = ["Maximum Salary", "Salary Max", "Max Salary", "Base Salary Max"];
const LABELS_FOR_SALARY_CURRENCY = ["Salary Currency", "Currency"];
const LABELS_FOR_EXPERIENCE_LEVEL = ["Experience Level", "Seniority Level"];
const LABELS_FOR_MIN_YEARS_EXP = ["Min Years Experience", "Minimum Years of Experience", "Min Experience (Years)"];
const LABELS_FOR_REQUIRED_SKILLS = ["Required Skills", "Skills", "Core Skills"];
const LABELS_FOR_NICE_TO_HAVE_SKILLS = ["Nice To Have Skills", "Preferred Skills", "Bonus Skills"];
const LABELS_FOR_JOB_DESCRIPTION = ["Job Description", "Description", "Responsibilities"];
const LABELS_FOR_NOTES = ["Notes", "Internal Notes", "Additional Notes"];

function addValueByLabels(map: Record<string, string>, labels: string[], value: string) {
  if (!value) return;
  for (const label of labels) {
    map[label] = value;
  }
}

export function applyParsedJobToForm(
  parsed: ParsedJob,
  setFormFields: Dispatch<SetStateAction<FormField[]>> | null,
  setCustomFieldValues: Dispatch<SetStateAction<Record<string, any>>>,
  customFields: SimpleCustomField[]
): void {
  const requiredSkillsStr = Array.isArray(parsed.required_skills)
    ? parsed.required_skills.join(", ")
    : "";
  const niceToHaveSkillsStr = Array.isArray(parsed.nice_to_have_skills)
    ? parsed.nice_to_have_skills.join(", ")
    : "";

  const valueByLabel: Record<string, string> = {};
  addValueByLabels(valueByLabel, LABELS_FOR_JOB_TITLE, parsed.job_title || "");
  addValueByLabels(valueByLabel, LABELS_FOR_ORGANIZATION, parsed.organization_name || "");
  addValueByLabels(valueByLabel, LABELS_FOR_LOCATION, parsed.location || "");
  addValueByLabels(valueByLabel, LABELS_FOR_CITY, parsed.city || "");
  addValueByLabels(valueByLabel, LABELS_FOR_STATE, parsed.state || "");
  addValueByLabels(valueByLabel, LABELS_FOR_COUNTRY, parsed.country || "");
  addValueByLabels(valueByLabel, LABELS_FOR_REMOTE_ONSITE, parsed.remote_or_onsite || "");
  addValueByLabels(valueByLabel, LABELS_FOR_EMPLOYMENT_TYPE, parsed.employment_type || "");
  addValueByLabels(valueByLabel, LABELS_FOR_STATUS, parsed.status || "");
  addValueByLabels(valueByLabel, LABELS_FOR_SALARY_MIN, parsed.salary_min || "");
  addValueByLabels(valueByLabel, LABELS_FOR_SALARY_MAX, parsed.salary_max || "");
  addValueByLabels(valueByLabel, LABELS_FOR_SALARY_CURRENCY, parsed.salary_currency || "");
  addValueByLabels(valueByLabel, LABELS_FOR_EXPERIENCE_LEVEL, parsed.experience_level || "");
  addValueByLabels(valueByLabel, LABELS_FOR_MIN_YEARS_EXP, parsed.min_years_experience || "");
  addValueByLabels(valueByLabel, LABELS_FOR_REQUIRED_SKILLS, requiredSkillsStr);
  addValueByLabels(valueByLabel, LABELS_FOR_NICE_TO_HAVE_SKILLS, niceToHaveSkillsStr);
  addValueByLabels(valueByLabel, LABELS_FOR_JOB_DESCRIPTION, parsed.job_description || "");
  addValueByLabels(valueByLabel, LABELS_FOR_NOTES, parsed.notes || "");

  // Update left-column static fields when provided
  if (setFormFields) {
    const updateField = (arr: FormField[], id: string, value: string): FormField[] => {
      const idx = arr.findIndex((f) => f.id === id);
      if (idx === -1) return arr;
      const next = [...arr];
      next[idx] = { ...next[idx], value };
      return next;
    };

    setFormFields((prev) => {
      let next = prev;
      next = updateField(next, "jobTitle", parsed.job_title || "");
      next = updateField(next, "jobDescription", parsed.job_description || "");
      next = updateField(next, "status", parsed.status || "");
      return next;
    });
  }

  // Apply into admin-defined custom fields (by field_name or field_label)
  setCustomFieldValues((prev) => {
    const next = { ...prev };

    for (const field of customFields) {
      const byName = parsed.custom_fields?.[field.field_name];
      if (byName !== undefined && byName !== "") {
        next[field.field_name] = byName;
        continue;
      }
      if (field.field_label && valueByLabel[field.field_label]) {
        next[field.field_name] = valueByLabel[field.field_label];
      }
    }

    return next;
  });
}

