'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

type TearsheetEntityType =
  | 'organization'
  | 'job'
  | 'job_seeker'
  | 'hiring_manager'
  | 'lead'
  | 'task';

const LINKED_API_PATH: Record<TearsheetEntityType, string> = {
  organization: 'organization',
  job: 'job',
  job_seeker: 'job-seeker',
  hiring_manager: 'hiring-manager',
  lead: 'lead',
  task: 'task',
};

function getAssociateBody(
  entityType: TearsheetEntityType,
  entityId: string
): Record<string, number> {
  const id = parseInt(entityId, 10);
  if (Number.isNaN(id)) return {};
  switch (entityType) {
    case 'organization':
      return { organization_id: id };
    case 'job':
      return { job_id: id };
    case 'job_seeker':
      return { job_seeker_id: id };
    case 'hiring_manager':
      return { hiring_manager_id: id };
    case 'lead':
      return { lead_id: id };
    case 'task':
      return { task_id: id };
    default:
      return {};
  }
}

interface BulkTearsheetModalProps {
  open: boolean;
  onClose: () => void;
  entityType: string;
  entityIds: string[];
  onSuccess?: () => void;
}

export default function BulkTearsheetModal({
  open,
  onClose,
  entityType,
  entityIds,
  onSuccess,
}: BulkTearsheetModalProps) {
  const [tearsheetForm, setTearsheetForm] = useState({
    name: '',
    visibility: 'Existing' as 'New' | 'Existing',
    selectedTearsheetId: '',
  });
  const [existingTearsheets, setExistingTearsheets] = useState<any[]>([]);
  const [isLoadingTearsheets, setIsLoadingTearsheets] = useState(false);
  const [isSavingTearsheet, setIsSavingTearsheet] = useState(false);
  const [tearsheetSearchQuery, setTearsheetSearchQuery] = useState('');
  const [showTearsheetDropdown, setShowTearsheetDropdown] = useState(false);
  const tearsheetSearchRef = useRef<HTMLDivElement>(null);

  const getAuthHeaders = () => {
    const token = document.cookie.replace(
      /(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/,
      '$1'
    );
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  useEffect(() => {
    if (open) {
      fetchExistingTearsheets();
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tearsheetSearchRef.current &&
        !tearsheetSearchRef.current.contains(event.target as Node)
      ) {
        setShowTearsheetDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchExistingTearsheets = async () => {
    setIsLoadingTearsheets(true);
    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch('/api/tearsheets', { headers: authHeaders });
      if (response.ok) {
        const data = await response.json();
        setExistingTearsheets(data.tearsheets || []);
      } else {
        setExistingTearsheets([]);
      }
    } catch {
      setExistingTearsheets([]);
    } finally {
      setIsLoadingTearsheets(false);
    }
  };

  const filteredTearsheets =
    tearsheetSearchQuery.trim() === ''
      ? existingTearsheets
      : existingTearsheets.filter((ts: any) =>
          ts.name.toLowerCase().includes(tearsheetSearchQuery.toLowerCase())
        );

  const handleTearsheetSelect = (tearsheet: any) => {
    setTearsheetForm((prev) => ({
      ...prev,
      selectedTearsheetId: tearsheet.id.toString(),
    }));
    setTearsheetSearchQuery(tearsheet.name);
    setShowTearsheetDropdown(false);
  };

  const handleSubmit = async () => {
    if (tearsheetForm.visibility === 'New') {
      if (!tearsheetForm.name.trim()) {
        toast.error('Please enter a tearsheet name');
        return;
      }
      setIsSavingTearsheet(true);
      try {
        const authHeaders = getAuthHeaders();
        const createRes = await fetch('/api/tearsheets', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            name: tearsheetForm.name.trim(),
            visibility: 'Existing',
          }),
        });
        if (!createRes.ok) {
          const errorData = await createRes.json().catch(() => ({
            message: 'Failed to create tearsheet',
          }));
          throw new Error(errorData.message || 'Failed to create tearsheet');
        }
        const createData = await createRes.json();
        const tearsheetId = createData.tearsheet?.id;
        if (!tearsheetId) throw new Error('Tearsheet created but ID missing');

        // Associate all selected entities
        await associateEntitiesToTearsheet(tearsheetId);

        toast.success(
          `Tearsheet created and ${entityIds.length} record(s) added.`
        );
        handleClose();
        onSuccess?.();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'Failed to create tearsheet. Please try again.'
        );
      } finally {
        setIsSavingTearsheet(false);
      }
    } else {
      if (!tearsheetForm.selectedTearsheetId) {
        toast.error('Please select a tearsheet');
        return;
      }
      setIsSavingTearsheet(true);
      try {
        await associateEntitiesToTearsheet(
          parseInt(tearsheetForm.selectedTearsheetId, 10)
        );
        toast.success(`Added ${entityIds.length} record(s) to tearsheet.`);
        handleClose();
        onSuccess?.();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'Failed to add to tearsheet. Please try again.'
        );
      } finally {
        setIsSavingTearsheet(false);
      }
    }
  };

  const associateEntitiesToTearsheet = async (tearsheetId: number) => {
    const authHeaders = getAuthHeaders();
    const errors: string[] = [];

    // Associate each entity to the tearsheet
    for (const entityId of entityIds) {
      try {
        const associateBody = getAssociateBody(
          entityType as TearsheetEntityType,
          entityId
        );
        const assocRes = await fetch(`/api/tearsheets/${tearsheetId}/associate`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(associateBody),
        });
        if (!assocRes.ok) {
          const errData = await assocRes.json().catch(() => ({}));
          errors.push(
            `Record ${entityId}: ${errData.message || errData.error || 'Failed'}`
          );
        }
      } catch (err) {
        errors.push(`Record ${entityId}: ${err instanceof Error ? err.message : 'Failed'}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Some records failed: ${errors.join('; ')}`);
    }
  };

  const handleClose = () => {
    setTearsheetForm({
      name: '',
      visibility: 'Existing',
      selectedTearsheetId: '',
    });
    setTearsheetSearchQuery('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Add to Tearsheets</h2>
        <p className="text-gray-600 mb-4">
          Add {entityIds.length} selected record(s) to a tearsheet
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tearsheet
          </label>
          <div className="flex gap-2 mb-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="Existing"
                checked={tearsheetForm.visibility === 'Existing'}
                onChange={(e) =>
                  setTearsheetForm((prev) => ({
                    ...prev,
                    visibility: e.target.value as 'Existing',
                  }))
                }
                className="mr-2"
              />
              Existing
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="New"
                checked={tearsheetForm.visibility === 'New'}
                onChange={(e) =>
                  setTearsheetForm((prev) => ({
                    ...prev,
                    visibility: e.target.value as 'New',
                  }))
                }
                className="mr-2"
              />
              New
            </label>
          </div>

          {tearsheetForm.visibility === 'New' ? (
            <input
              type="text"
              value={tearsheetForm.name}
              onChange={(e) =>
                setTearsheetForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter tearsheet name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <div ref={tearsheetSearchRef} className="relative">
              <input
                type="text"
                value={tearsheetSearchQuery}
                onChange={(e) => {
                  setTearsheetSearchQuery(e.target.value);
                  setShowTearsheetDropdown(true);
                }}
                onFocus={() => setShowTearsheetDropdown(true)}
                placeholder="Search tearsheets..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showTearsheetDropdown && filteredTearsheets.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredTearsheets.map((ts: any) => (
                    <div
                      key={ts.id}
                      onClick={() => handleTearsheetSelect(ts)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {ts.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            disabled={isSavingTearsheet}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={isSavingTearsheet}
          >
            {isSavingTearsheet ? 'Adding...' : 'Add to Tearsheet'}
          </button>
        </div>
      </div>
    </div>
  );
}
