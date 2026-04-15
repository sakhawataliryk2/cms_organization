'use client';

import React, { useState, useEffect } from 'react';
import StyledReactSelect, { type StyledSelectOption } from './StyledReactSelect';

const LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;
const multiLookupCache = new Map<string, { data: LookupOption[]; cachedAt: number }>();

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
  className = 'w-full',
  disabled = false,
  filterByParam,
}: MultiSelectLookupFieldProps) {
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = normalizeValue(value);


  useEffect(() => {
    const controller = new AbortController();
    const query = searchInput.trim();
    const fetchOptions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let baseUrl = lookupType === 'owner' ? '/api/users/active' : `/api/${lookupType}`;
        const u = new URL(baseUrl, window.location.origin);
        if (filterByParam?.value && lookupType !== 'owner') {
          u.searchParams.set(filterByParam.key, filterByParam.value);
        }
        if (query.length > 0) {
          u.searchParams.set('q', query);
        }
        u.searchParams.set('limit', '100');

        const requestPath = u.pathname + u.search;
        const canUseListCache = query.length > 0;
        const cached = canUseListCache ? multiLookupCache.get(requestPath) : null;
        if (cached && Date.now() - cached.cachedAt < LOOKUP_CACHE_TTL_MS) {
          setOptions(cached.data);
          setIsLoading(false);
          return;
        }

        const response = await fetch(requestPath, { signal: controller.signal });
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
          fetchedOptions = (data.hiringManagers || data.hiring_managers || [])
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
        const latestOptions = fetchedOptions.slice(0, 100);
        if (canUseListCache) {
          multiLookupCache.set(requestPath, { data: latestOptions, cachedAt: Date.now() });
        }
        setOptions(latestOptions);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error(`Error fetching ${lookupType}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load options');
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = window.setTimeout(fetchOptions, 300);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [filterByParam?.key, filterByParam?.value, lookupType, searchInput]);

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
      onInputChange={(input, meta) => {
        if (meta.action === 'input-change') setSearchInput(input);
      }}
    />
  );
}
