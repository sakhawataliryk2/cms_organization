import type { Dispatch, SetStateAction } from "react";
import type { ParsedOrganization } from "@/app/api/parse-organization/route";

type SimpleCustomField = {
  field_name: string;
  field_label?: string | null;
};

const LABELS_FOR_NAME = ["Organization Name", "Name", "Company"];
const LABELS_FOR_NICKNAMES = ["Nicknames", "Nickname"];
const LABELS_FOR_PARENT = ["Parent Organization", "Parent Company"];
const LABELS_FOR_WEBSITE = ["Website", "Organization Website", "URL"];
const LABELS_FOR_PHONE = ["Contact Phone", "Main Phone"];
const LABELS_FOR_ADDRESS = ["Address", "Street Address", "Address 1"];
const LABELS_FOR_ADDRESS_2 = ["Address 2", "Suite", "Apt", "Apartment", "Floor"];
const LABELS_FOR_CITY = ["City"];
const LABELS_FOR_STATE = ["State", "Province"];
const LABELS_FOR_ZIP = ["ZIP Code", "ZIP", "Zip Code", "Postal Code"];
const LABELS_FOR_COUNTRY = ["Country"];
const LABELS_FOR_STATUS = ["Status"];
const LABELS_FOR_OVERVIEW = ["Overview", "Organization Overview", "About"];
const LABELS_FOR_YEAR_FOUNDED = ["Year Founded", "Founded"];
const LABELS_FOR_NUM_EMPLOYEES = ["# of Employees", "Number of Employees"];
const LABELS_FOR_NUM_OFFICES = ["# of Offices", "Number of Offices"];
const LABELS_FOR_PERM_FEE = ["Standard Perm Fee (%)", "Perm Fee", "Placement Fee"];
const LABELS_FOR_CONTRACT_ON_FILE = ["Contract Signed on File"];
const LABELS_FOR_CONTRACT_SIGNED_BY = ["Contract Signed By"];
const LABELS_FOR_DATE_CONTRACT_SIGNED = ["Date Contract Signed"];

function addValueByLabels(map: Record<string, string>, labels: string[], value: string) {
  if (!value) return;
  for (const label of labels) {
    map[label] = value;
  }
}

export function applyParsedOrganizationToCustomFields(
  parsed: ParsedOrganization,
  setCustomFieldValues: Dispatch<SetStateAction<Record<string, any>>>,
  customFields: SimpleCustomField[]
): void {
  const valueByLabel: Record<string, string> = {};

  addValueByLabels(valueByLabel, LABELS_FOR_NAME, parsed.name || "");
  addValueByLabels(valueByLabel, LABELS_FOR_NICKNAMES, parsed.nicknames || "");
  addValueByLabels(valueByLabel, LABELS_FOR_PARENT, parsed.parent_organization || "");
  addValueByLabels(valueByLabel, LABELS_FOR_WEBSITE, parsed.website || "");
  addValueByLabels(valueByLabel, LABELS_FOR_PHONE, parsed.contact_phone || "");
  addValueByLabels(valueByLabel, LABELS_FOR_ADDRESS, parsed.address || "");
  addValueByLabels(valueByLabel, LABELS_FOR_ADDRESS_2, parsed.address_2 || "");
  addValueByLabels(valueByLabel, LABELS_FOR_CITY, parsed.city || "");
  addValueByLabels(valueByLabel, LABELS_FOR_STATE, parsed.state || "");
  addValueByLabels(valueByLabel, LABELS_FOR_ZIP, parsed.zip || "");
  addValueByLabels(valueByLabel, LABELS_FOR_COUNTRY, parsed.country || "");
  addValueByLabels(valueByLabel, LABELS_FOR_STATUS, parsed.status || "");
  addValueByLabels(valueByLabel, LABELS_FOR_OVERVIEW, parsed.overview || "");
  addValueByLabels(valueByLabel, LABELS_FOR_YEAR_FOUNDED, parsed.year_founded || "");
  addValueByLabels(valueByLabel, LABELS_FOR_NUM_EMPLOYEES, parsed.num_employees || "");
  addValueByLabels(valueByLabel, LABELS_FOR_NUM_OFFICES, parsed.num_offices || "");
  addValueByLabels(valueByLabel, LABELS_FOR_PERM_FEE, parsed.perm_fee || "");
  addValueByLabels(valueByLabel, LABELS_FOR_CONTRACT_ON_FILE, parsed.contract_on_file || "");
  addValueByLabels(valueByLabel, LABELS_FOR_CONTRACT_SIGNED_BY, parsed.contract_signed_by || "");
  addValueByLabels(
    valueByLabel,
    LABELS_FOR_DATE_CONTRACT_SIGNED,
    parsed.date_contract_signed || ""
  );

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

