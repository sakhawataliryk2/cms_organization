'use client'

import React, { useState, useEffect } from 'react';

interface LookupOption {
  id: string;
  name: string;
  record_number: string;
  email?: string;
  [key: string]: any;
}

interface LookupFieldProps {
  value: string;
  onChange: (value: string) => void;
  lookupType: 'organizations' | 'hiring-managers' | 'job-seekers' | 'jobs' | 'owner';
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  /** Optional: filter options by query param (e.g. organization_id for hiring-managers) */
  filterByParam?: { key: string; value: string };
}

export default function LookupField({
  value,
  onChange,
  lookupType,
  placeholder = 'Select an option',
  required = false,
  className = "w-full p-2 border-b border-gray-300 focus:outline-none focus:border-blue-500",
  disabled = false,
  filterByParam,
}: LookupFieldProps) {
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOptions();
  }, [lookupType, filterByParam?.key, filterByParam?.value]);

  const fetchOptions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let apiEndpoint = lookupType === 'owner' ? '/api/users/active' : `/api/${lookupType}`;
      if (filterByParam?.value && lookupType !== 'owner') {
        const u = new URL(apiEndpoint, window.location.origin);
        u.searchParams.set(filterByParam.key, filterByParam.value);
        apiEndpoint = u.pathname + u.search;
      }
      const response = await fetch(apiEndpoint);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${lookupType}`);
      }

      const data = await response.json();
      console.log(data);
      // Handle different response structures
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
      } else if (lookupType === 'owner') {
        fetchedOptions = (data.users || [])
          .filter(isNotArchived)
          .map((user: any) => ({
            id: user.id.toString(),
            name: user.name || user.email || '',
            email: user.email || '',
            // Many user records don't have an explicit record_number.
            // Fallback to the numeric id so owner options still show a prefixed code (e.g. U123 - owner@gmail.com).
            record_number:
              (user.record_number != null && user.record_number !== '')
                ? String(user.record_number)
                : user.id != null
                  ? String(user.id)
                  : ''
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

  if (isLoading) {
    return (
      <select className={className} disabled>
        <option>Loading...</option>
      </select>
    );
  }

  if (error) {
    return (
      <select className={className} disabled>
        <option>Error loading options</option>
      </select>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      required={required}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => {
        const prefix = lookupType === 'organizations' ? 'O' : lookupType === 'hiring-managers' ? 'HM' : lookupType === 'job-seekers' ? 'JS' : lookupType === 'jobs' ? 'J' : lookupType === 'owner' ? 'U' : '';
        const baseLabel =
          lookupType === 'owner'
            ? `${option.name} (${option.email})`|| option.email
            : option.name;
        const label = option.record_number ? `${prefix}${option.record_number} - ${baseLabel}` : baseLabel;
        return (
          <option key={option.id} value={option.id}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

