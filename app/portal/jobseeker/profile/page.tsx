"use client";

import { useEffect, useState } from "react";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import LoadingState from "@/components/portal/LoadingState";
import { getCustomFieldLabel } from "@/lib/getCustomFieldLabel";

const sections = {
  personal: ["Field_1", "Field_2", "Field_21"],
  contact: ["Field_11", "Field_8"],
  address: ["Field_15", "Field_16", "Field_17", "Field_18", "Field_19"],
} as const;

export default function JobSeekerProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch("/api/portal/jobseeker/profile", { cache: "no-store" }).catch(() => null);
      const data = await res?.json().catch(() => ({}));
      const nextProfile = data?.profile || null;
      setProfile(nextProfile);

      const backendLabels = nextProfile?.field_labels_by_field_name;
      if (backendLabels && typeof backendLabels === "object") {
        setLabels(backendLabels);
      } else {
        const allFields = [
          ...sections.personal,
          ...sections.contact,
          ...sections.address,
        ];
        const entries = await Promise.all(
          allFields.map(async (f) => {
            const label = await getCustomFieldLabel("job-seekers", f);
            return [f, label || f] as const;
          })
        );
        setLabels(Object.fromEntries(entries));
      }
      setLoading(false);
    };
    void load();
  }, []);

  if (loading) return <LoadingState text="Loading profile..." />;
  if (!profile) return <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">Profile not available.</div>;

  const valuesByFieldName = profile?.custom_fields_by_field_name || {};
  const rawCustomFields = profile?.custom_fields;
  const customFields =
    typeof rawCustomFields === "string"
      ? (() => {
          try {
            return JSON.parse(rawCustomFields);
          } catch {
            return {};
          }
        })()
      : rawCustomFields && typeof rawCustomFields === "object"
        ? rawCustomFields
        : {};

  const renderField = (field: string) => {
    const label = labels[field] || field;
    const value = valuesByFieldName[field] ?? customFields[label] ?? customFields[field] ?? "-";
    return (
      <div key={field} className="rounded-md border border-slate-200 p-3">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div className="mt-1 text-sm text-slate-800">
          <FieldValueRenderer value={value} fieldInfo={{ name: field, label }} />
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Profile</h2>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Personal information</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{sections.personal.map(renderField)}</div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Contact details</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{sections.contact.map(renderField)}</div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Address</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{sections.address.map(renderField)}</div>
      </div>
    </div>
  );
}

