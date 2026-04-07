'use client';

import React, { useState, useEffect } from 'react';
import StyledReactSelect, { type StyledSelectOption } from './StyledReactSelect';

interface LookupOption {
  id: string;
  name: string;
  email: string;
  record_number: string;
  [key: string]: any;
}

export type MultiSelectLookupType = 'organizations' | 'hiring-managers' | 'job-seekers' | 'jobs' | 'owner' | 'leads' | 'placements';

interface MultiSelectLookupFieldProps {
  /** Value: comma-separated IDs or array of IDs */
  value: string | string[];
  onChange: (value: string[] | string) => void;
  lookupType: MultiSelectLookupType;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  /** Optional: when set, options are fetched with this query param (e.g. organizationId for contacts) */
  filterByParam?: { key: string; value: string };
}

function normalizeValue(v: string | string[] | null | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  const s = String(v).trim();
  if (!s) return [];
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export default function MultiSelectLookupField({
  value,
  onChange,
  lookupType,
  placeholder = 'Type to search...',
  required = false,
  className = 'w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500',
  disabled = false,
  filterByParam,
}: MultiSelectLookupFieldProps) {
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = normalizeValue(value);


  useEffect(() => {
    fetchOptions();
  }, [lookupType, filterByParam?.key, filterByParam?.value]);

  const fetchOptions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let url = lookupType === 'owner' ? '/api/users/active' : `/api/${lookupType}`;
      if (filterByParam?.value && lookupType !== 'owner') {
        const u = new URL(url, window.location.origin);
        u.searchParams.set(filterByParam.key, filterByParam.value);
        url = u.pathname + u.search;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${lookupType}`);
      const data = await response.json();
      let fetchedOptions: LookupOption[] = [];

      // Filter out archived records (archived_at / archivedAt not null)
      const isNotArchived = (item: any) =>
        item &&
        item.archived_at == null &&
        item.archivedAt == null;

      if (lookupType === 'organizations') {
        fetchedOptions = (data.organizations || [])
          .filter(isNotArchived)
          .map((org: any) => ({
            id: org.id.toString(),
            name: org.name,
            record_number: org.record_number || ''
          }));
      } else if (lookupType === 'hiring-managers') {
        fetchedOptions = (data.hiringManagers || [])
          .filter(isNotArchived)
          .map((hm: any) => ({
            id: hm.id.toString(),
            name: hm.full_name || `${hm.first_name} ${hm.last_name}`,
            record_number: hm.record_number || ''
          }));
      } else if (lookupType === 'job-seekers') {
        fetchedOptions = (data.jobSeekers || [])
          .filter(isNotArchived)
          .map((js: any) => ({
            id: js.id.toString(),
            name: js.full_name || `${js.first_name} ${js.last_name}`,
            record_number: js.record_number || ''
          }));
      } else if (lookupType === 'jobs') {
        fetchedOptions = (data.jobs || [])
          .filter(isNotArchived)
          .map((job: any) => ({
            id: job.id.toString(),
            name: job.job_title,
            record_number: job.record_number || ''
          }));
      } else if (lookupType === 'leads') {
        fetchedOptions = (data.leads || [])
          .filter(isNotArchived)
          .map((lead: any) => ({
            id: lead.id.toString(),
            name: lead.full_name || `${lead.firstName || lead.first_name || ''} ${lead.lastName || lead.last_name || ''}`.trim() || 'Untitled Lead',
            record_number: lead.record_number || ''
          }));
      } else if (lookupType === 'placements') {
        fetchedOptions = (data.placements || [])
          .filter(isNotArchived)
          .map((p: any) => ({
            id: p.id.toString(),
            name: `${p.job_seeker_name || 'Candidate'} - ${p.job_title || p.job_name || 'Job'}`,
            record_number: p.record_number || ''
          }));
      } else if (lookupType === 'owner') {
        fetchedOptions = (data.users || [])
          .filter(isNotArchived)
          .map((user: any) => ({
            id: user.id.toString(),
            name: user.name || '',
            email: user.email || '',
            record_number: user.record_number || ''
          }));
      }
      setOptions(fetchedOptions);
    } catch (err) {
      console.error(`Error fetching ${lookupType}:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load options');
    } finally {
      setIsLoading(false);
    }
  };

  const getOptionLabel = (opt: LookupOption) => {
    if (!opt) return "";
    const prefix = lookupType === "organizations" ? "O" :
      lookupType === "hiring-managers" ? "HM" :
        lookupType === "job-seekers" ? "JS" :
          lookupType === "jobs" ? "J" :
            lookupType === "owner" ? "U" :
              lookupType === "leads" ? "L" :
                lookupType === "placements" ? "P" : "";

    const baseLabel =
      lookupType === 'owner'
        ? `${opt.name} (${opt.email || ""})` || opt.email
        : opt.name;
    return opt.record_number ? `${prefix}${opt.record_number} - ${baseLabel}` : baseLabel;
  };

  const selectOptions: StyledSelectOption[] = options.map((opt) => ({
    value: String(opt.id),
    label: getOptionLabel(opt),
  }));

  const selectedOptions = selectOptions.filter((opt) =>
    selectedIds.includes(String(opt.value)),
  );

  return (
    <StyledReactSelect
      inputId={undefined}
      isMulti
      isSearchable
      isClearable={false}
      isDisabled={disabled}
      isLoading={isLoading}
      className={className}
      options={selectOptions}
      value={selectedOptions}
      placeholder={placeholder}
      noOptionsMessage={() => (error ? error : "No options")}
      onChange={(selected) => {
        const values = Array.isArray(selected)
          ? selected.map((opt) => String(opt.value))
          : [];
        onChange(values);
      }}
    />
  );
}
