'use client';

import React, { useState, useEffect, useRef } from 'react';

interface LookupOption {
  id: string;
  name: string;
  record_number: string;
  [key: string]: any;
}

export type MultiSelectLookupType = 'organizations' | 'hiring-managers' | 'job-seekers' | 'jobs' | 'owner';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      } else if (lookupType === 'owner') {
        fetchedOptions = (data.users || [])
          .filter(isNotArchived)
          .map((user: any) => ({
            id: user.id.toString(),
            name: user.name || user.email || '',
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const q = searchQuery.trim().toLowerCase();
  const filteredOptions = q
    ? options.filter(
        (o) =>
          o.name?.toLowerCase().includes(q) || String(o.id).toLowerCase().includes(q)
      )
    : options;
  const selectedSet = new Set(selectedIds);
  const selectableOptions = filteredOptions.filter((o) => !selectedSet.has(o.id));

  const addSelection = (option: LookupOption) => {
    const next = [...selectedIds, option.id];
    onChange(next);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const removeSelection = (id: string) => {
    const next = selectedIds.filter((x) => x !== id);
    onChange(next);
  };

  if (isLoading) {
    return (
      <div className={className + ' bg-gray-50 text-gray-500'} style={{ minHeight: 42 }}>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className={className + ' bg-red-50 text-red-600'} style={{ minHeight: 42 }}>
        {error}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={
          className +
          ' min-h-[42px] flex flex-wrap items-center gap-2 ' +
          (disabled ? ' bg-gray-100 cursor-not-allowed opacity-70' : '')
        }
      >
        {selectedIds.map((id) => {
          const opt = options.find((o) => o.id === id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-sm"
            >
              {opt?.name ?? id}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeSelection(id)}
                  className="hover:text-blue-600 font-bold leading-none"
                  aria-label="Remove"
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        {!disabled && (
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={selectedIds.length === 0 ? placeholder : 'Add more...'}
            className="flex-1 min-w-[120px] border-0 p-0 focus:ring-0 focus:outline-none bg-transparent"
          />
        )}
      </div>
      {!disabled && showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
          {selectableOptions.length > 0 ? (
            selectableOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => addSelection(opt)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 text-sm"
              >
                {opt.name}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-gray-500 text-sm">
              {filteredOptions.length === 0 ? 'No options' : 'All selected or no match'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
