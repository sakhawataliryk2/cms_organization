"use client";

import { useEffect, useState } from "react";
import FieldValueRenderer from "@/components/FieldValueRenderer";
import LoadingState from "@/components/portal/LoadingState";

const sections = {
  personal: ["Field_1", "Field_2", "Field_6"],
  contact: ["Field_7", "Field_8", "Field_9"],
  address: ["Field_12", "Field_13", "Field_14", "Field_15", "Field_16", "Field_17"],
} as const;

export default function HiringProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch("/api/portal/hiring/profile", { cache: "no-store" }).catch(() => null);
      const data = await res?.json().catch(() => ({}));
      setProfile(data?.profile || null);
      setLoading(false);
    };
    void load();
  }, []);

  if (loading) return <LoadingState text="Loading profile..." />;
  if (!profile) return <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">Profile not available.</div>;

  const labels = profile?.field_labels_by_field_name || {};
  const values = profile?.custom_fields_by_field_name || {};
  const renderField = (field: string) => (
    <div key={field} className="rounded-md border border-slate-200 p-3">
      <p className="text-xs font-medium text-slate-500">{labels[field] || field}</p>
      <div className="mt-1 text-sm text-slate-800">
        <FieldValueRenderer value={values[field] ?? "-"} fieldInfo={{ name: field, label: labels[field] || field }} />
      </div>
    </div>
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Profile</h2>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Personal information</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{sections.personal.map(renderField)}</div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Contact information</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{sections.contact.map(renderField)}</div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Address</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{sections.address.map(renderField)}</div>
      </div>
    </div>
  );
}

