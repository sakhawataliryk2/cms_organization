'use client'

import React, { useEffect, useMemo, useState } from 'react';
import StyledReactSelect, { type StyledSelectOption } from './StyledReactSelect';
import { FiArrowRightCircle } from 'react-icons/fi';

function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <div className="group relative inline-flex">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
        {text}
      </span>
    </div>
  );
}

const LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;
const lookupListCache = new Map<string, { data: LookupOption[]; cachedAt: number }>();
const lookupByIdCache = new Map<string, { data: LookupOption; cachedAt: number }>();

interface LookupOption {
  id: string;
  name: string;
  record_number: string;
  email?: string;
}

interface LookupFieldProps {
  value: string;
  onChange: (value: string) => void;
  lookupType: 'organizations' | 'hiring-managers' | 'job-seekers' | 'jobs' | 'owner' | 'leads' | 'placements';
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
  className = 'w-full',
  disabled = false,
  filterByParam,
}: LookupFieldProps) {
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConvertedToLookup, setIsConvertedToLookup] = useState(false);

  const checkIsPlainTextValue = (val: string, converted: boolean, opts: LookupOption[]): boolean => {
    if (!val) return false;
    if (converted) return false;
    if (!/^\d+$/.test(val)) return true;
    const isValidOption = opts.some((option) => option.id === val);
    return !isValidOption;
  };

  const shouldShowAsText = checkIsPlainTextValue(value, isConvertedToLookup, options);

  useEffect(() => {
    if (shouldShowAsText && value && !isConvertedToLookup) {
      return;
    }
    if (value && !checkIsPlainTextValue(value, isConvertedToLookup, options)) {
      setIsConvertedToLookup(false);
    }
  }, [options, value, isConvertedToLookup, shouldShowAsText]);

  const handleConvertToLookup = () => {
    setIsConvertedToLookup(true);
  };

  const handleTextInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  useEffect(() => {
    const controller = new AbortController();
    const query = searchInput.trim();

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let apiEndpoint = lookupType === 'owner' ? '/api/users/active' : `/api/${lookupType}`;
        const u = new URL(apiEndpoint, window.location.origin);
        if (filterByParam?.value && lookupType !== 'owner') {
          u.searchParams.set(filterByParam.key, filterByParam.value);
        }
        if (query.length > 0) {
          u.searchParams.set('q', query);
        }
        u.searchParams.set('limit', '100');

        const requestPath = u.pathname + u.search;
        const canUseListCache = query.length > 0;
        const cached = canUseListCache ? lookupListCache.get(requestPath) : null;
        if (cached && Date.now() - cached.cachedAt < LOOKUP_CACHE_TTL_MS) {
          setOptions(cached.data);
          setIsLoading(false);
          return;
        }

        const response = await fetch(requestPath, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch ${lookupType}`);
        }

        const data = await response.json();
        const mappedOptions = mapLookupResponse(lookupType, data).slice(0, 100);
        if (canUseListCache) {
          lookupListCache.set(requestPath, { data: mappedOptions, cachedAt: Date.now() });
        }
        setOptions(mappedOptions);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load options');
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = window.setTimeout(run, 300);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [lookupType, filterByParam?.key, filterByParam?.value, searchInput]);

  useEffect(() => {
    const fetchSelectedOption = async () => {
      if (!value || lookupType === 'owner') return;
      if (options.some((option) => option.id === value)) return;

      const cacheKey = `${lookupType}:${value}`;
      const cached = lookupByIdCache.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt < LOOKUP_CACHE_TTL_MS) {
        setOptions((prev) => {
          if (prev.some((item) => item.id === cached.data.id)) return prev;
          return [cached.data, ...prev];
        });
        return;
      }

      const endpoint = `/api/${lookupType}/${encodeURIComponent(value)}`;
      try {
        const response = await fetch(endpoint);
        if (!response.ok) return;
        const data = await response.json();
        const selectedRecord = mapSingleLookupRecord(lookupType, data);
        if (!selectedRecord) return;
        lookupByIdCache.set(cacheKey, { data: selectedRecord, cachedAt: Date.now() });

        setOptions((prev) => {
          if (prev.some((item) => item.id === selectedRecord.id)) return prev;
          return [selectedRecord, ...prev];
        });
      } catch {
        // Keep form usable even if single-record lookup fails.
      }
    };

    fetchSelectedOption();
  }, [lookupType, options, value]);

  const selectOptions = useMemo<StyledSelectOption[]>(() => {
    return options.map((option) => {
      const prefix =
        lookupType === 'organizations' ? 'O' :
        lookupType === 'hiring-managers' ? 'HM' :
        lookupType === 'job-seekers' ? 'JS' :
        lookupType === 'jobs' ? 'J' :
        lookupType === 'owner' ? 'U' :
        lookupType === 'leads' ? 'L' :
        lookupType === 'placements' ? 'P' : '';

      const ownerLabel = option.email ? `${option.name} (${option.email})` : option.name;
      const baseLabel = lookupType === 'owner' ? ownerLabel : option.name;
      const label = option.record_number ? `${prefix}${option.record_number} - ${baseLabel}` : baseLabel;

      return {
        value: option.id,
        label,
      };
    });
  }, [lookupType, options]);

  const selectedOption = useMemo(
    () => selectOptions.find((opt) => opt.value === value) ?? null,
    [selectOptions, value]
  );

  if (disabled) {
    if (shouldShowAsText) {
      return (
        <div className="w-full py-2 px-3 border border-gray-200 rounded bg-gray-50 text-gray-700">
          {value || '—'}
        </div>
      );
    }
    return (
      <div className="relative">
        <StyledReactSelect
          className={className}
          value={selectedOption}
          options={selectOptions}
          onChange={() => {}}
          isDisabled
          isLoading={isLoading}
          placeholder={placeholder}
          noOptionsMessage={() => {
            if (error) return 'Error loading options';
            return 'No options found';
          }}
        />
      </div>
    );
  }

  if (shouldShowAsText) {
    return (
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={handleTextInputChange}
          placeholder={placeholder}
          className="w-full py-2 px-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <Tooltip text="Convert to lookup">
          <button
            type="button"
            onClick={handleConvertToLookup}
            className="absolute top-1/2 -translate-y-1/2 right-2 p-1 text-gray-500 hover:text-blue-600 transition-colors"
            aria-label="Convert to lookup"
          >
            <FiArrowRightCircle className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="relative">
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={() => {}}
          required={required}
          className="absolute h-0 w-0 opacity-0 pointer-events-none"
          aria-hidden="true"
        />
      )}
      <StyledReactSelect
        className={className}
        value={selectedOption}
        options={selectOptions}
        onChange={(option) => onChange((option as StyledSelectOption | null)?.value ?? '')}
        onInputChange={(input, meta) => {
          if (meta.action === 'input-change') setSearchInput(input);
        }}
        isDisabled={disabled}
        isLoading={isLoading}
        isClearable
        placeholder={
          placeholder
        }
        noOptionsMessage={() => {
          if (error) return 'Error loading options';
          return 'No options found';
        }}
      />
    </div>
  );
}

function mapLookupResponse(
  lookupType: LookupFieldProps['lookupType'],
  data: Record<string, unknown>
): LookupOption[] {
  const isNotArchived = (item: any) =>
    item &&
    item.archived_at == null &&
    item.archivedAt == null;

  if (lookupType === 'organizations') {
    return ((data.organizations as any[]) || [])
      .filter(isNotArchived)
      .map((org) => ({
        id: String(org.id),
        name: org.name,
        record_number: org.record_number ? String(org.record_number) : '',
      }));
  }

  if (lookupType === 'hiring-managers') {
    return (((data.hiringManagers as any[]) || (data.hiring_managers as any[]) || []))
      .filter(isNotArchived)
      .map((hm) => ({
        id: String(hm.id),
        name: hm.full_name || `${hm.first_name || ''} ${hm.last_name || ''}`.trim(),
        record_number: hm.record_number ? String(hm.record_number) : '',
      }));
  }

  if (lookupType === 'job-seekers') {
    return ((data.jobSeekers as any[]) || [])
      .filter(isNotArchived)
      .map((js) => ({
        id: String(js.id),
        name: js.full_name || `${js.first_name || ''} ${js.last_name || ''}`.trim(),
        record_number: js.record_number ? String(js.record_number) : '',
      }));
  }

  if (lookupType === 'leads') {
    return ((data.leads as any[]) || [])
      .filter(isNotArchived)
      .map((lead) => ({
        id: String(lead.id),
        name: lead.full_name || `${lead.firstName || lead.first_name || ''} ${lead.lastName || lead.last_name || ''}`.trim() || 'Untitled Lead',
        record_number: lead.record_number ? String(lead.record_number) : '',
      }));
  }

  if (lookupType === 'placements') {
    return ((data.placements as any[]) || [])
      .filter(isNotArchived)
      .map((p) => ({
        id: String(p.id),
        name: `${p.job_seeker_name || 'Candidate'} - ${p.job_title || p.job_name || 'Job'}`,
        record_number: p.record_number ? String(p.record_number) : '',
      }));
  }

  if (lookupType === 'jobs') {
    return ((data.jobs as any[]) || [])
      .filter(isNotArchived)
      .map((job) => ({
        id: String(job.id),
        name: job.job_title || 'Untitled Job',
        record_number: job.record_number ? String(job.record_number) : '',
      }));
  }

  if (lookupType === 'owner') {
    return ((data.users as any[]) || [])
      .filter(isNotArchived)
      .map((user) => ({
        id: String(user.id),
        name: user.name || user.email || '',
        email: user.email || '',
        record_number:
          user.record_number != null && user.record_number !== ''
            ? String(user.record_number)
            : user.id != null
              ? String(user.id)
              : '',
      }));
  }

  return [];
}

function mapSingleLookupRecord(
  lookupType: LookupFieldProps['lookupType'],
  data: Record<string, any>
): LookupOption | null {
  if (lookupType === 'organizations' && data.organization) {
    const org = data.organization;
    return {
      id: String(org.id),
      name: org.name || 'Unnamed Organization',
      record_number: org.record_number ? String(org.record_number) : '',
    };
  }
  if (lookupType === 'hiring-managers' && data.hiringManager) {
    const hm = data.hiringManager;
    return {
      id: String(hm.id),
      name: hm.full_name || `${hm.first_name || ''} ${hm.last_name || ''}`.trim(),
      record_number: hm.record_number ? String(hm.record_number) : '',
    };
  }
  if (lookupType === 'job-seekers' && data.jobSeeker) {
    const js = data.jobSeeker;
    return {
      id: String(js.id),
      name: js.full_name || `${js.first_name || ''} ${js.last_name || ''}`.trim(),
      record_number: js.record_number ? String(js.record_number) : '',
    };
  }
  if (lookupType === 'jobs' && data.job) {
    const job = data.job;
    return {
      id: String(job.id),
      name: job.job_title || 'Untitled Job',
      record_number: job.record_number ? String(job.record_number) : '',
    };
  }
  if (lookupType === 'leads' && data.lead) {
    const lead = data.lead;
    return {
      id: String(lead.id),
      name: lead.full_name || `${lead.firstName || lead.first_name || ''} ${lead.lastName || lead.last_name || ''}`.trim() || 'Untitled Lead',
      record_number: lead.record_number ? String(lead.record_number) : '',
    };
  }
  if (lookupType === 'placements' && data.placement) {
    const placement = data.placement;
    return {
      id: String(placement.id),
      name: `${placement.job_seeker_name || 'Candidate'} - ${placement.job_title || placement.job_name || 'Job'}`,
      record_number: placement.record_number ? String(placement.record_number) : '',
    };
  }

  return null;
}

