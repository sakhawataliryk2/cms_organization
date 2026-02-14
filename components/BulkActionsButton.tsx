'use client';

import { useState } from 'react';
import ActionDropdown from './ActionDropdown';
import BulkOwnershipModal from './BulkOwnershipModal';
import BulkStatusModal from './BulkStatusModal';
import BulkOpenCloseModal from './BulkOpenCloseModal';
import BulkTearsheetModal from './BulkTearsheetModal';
import BulkNoteModal from './BulkNoteModal';
import BulkTaskModal from './BulkTaskModal';

interface BulkActionsButtonProps {
    selectedCount: number;
    entityType: 'organization' | 'lead' | 'job' | 'task' | 'hiring-manager' | 'job-seeker' | 'placement';
    entityIds: string[];
    availableFields?: any[];
    onSuccess?: () => void;
    onCSVExport?: () => void;
}

export default function BulkActionsButton({
    selectedCount,
    entityType,
    entityIds,
    availableFields = [],
    onSuccess,
    onCSVExport
}: BulkActionsButtonProps) {
    const [showOwnershipModal, setShowOwnershipModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showOpenCloseModal, setShowOpenCloseModal] = useState(false);
    const [showTearsheetModal, setShowTearsheetModal] = useState(false);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);

    // Find custom field definitions
    const findFieldByLabel = (label: string) => {
        return availableFields.find(f => {
            const fieldLabel = (f.field_label || '').toLowerCase();
            const fieldName = (f.field_name || '').toLowerCase();
            const searchLabel = label.toLowerCase();
            return fieldLabel === searchLabel || fieldName === searchLabel;
        });
    };

    const ownerField = findFieldByLabel('Owner');
    const statusField = findFieldByLabel('Status');
    const openCloseField = findFieldByLabel('Open/Close') || 
                          availableFields.find(f => {
                              const label = (f.field_label || '').toLowerCase();
                              return (label.includes('open') && label.includes('close')) ||
                                     label === 'open/close' || label === 'open close';
                          });

    const handleSuccess = () => {
        setShowOwnershipModal(false);
        setShowStatusModal(false);
        setShowOpenCloseModal(false);
        setShowTearsheetModal(false);
        setShowNoteModal(false);
        setShowTaskModal(false);
        onSuccess?.();
    };

    const actionOptions = [
        ...(ownerField ? [{
            label: 'Manage Ownership',
            action: () => setShowOwnershipModal(true),
            disabled: false
        }] : []),
        ...(statusField ? [{
            label: 'Change Status',
            action: () => setShowStatusModal(true),
            disabled: false
        }] : []),
        ...(openCloseField ? [{
            label: 'Open/Close',
            action: () => setShowOpenCloseModal(true),
            disabled: false
        }] : []),
        // Add Note - available for hiring-managers and other entities
        ...(entityType === 'hiring-manager' || entityType === 'organization' || entityType === 'lead' || entityType === 'job-seeker' ? [{
            label: 'Add Note',
            action: () => setShowNoteModal(true),
            disabled: false
        }] : []),
        // Create Tasks - available for hiring-managers and other entities
        ...(entityType === 'hiring-manager' || entityType === 'organization' || entityType === 'lead' || entityType === 'job-seeker' ? [{
            label: 'Create Tasks',
            action: () => setShowTaskModal(true),
            disabled: false
        }] : []),
        {
            label: 'Add to Tearsheets',
            action: () => setShowTearsheetModal(true),
            disabled: false
        },
        ...(onCSVExport ? [{
            label: 'CSV Export',
            action: () => onCSVExport(),
            disabled: false
        }] : [])
    ];

    if (actionOptions.length === 0) {
        return null;
    }

    return (
        <>
            <ActionDropdown
                label={`Actions (${selectedCount})`}
                options={actionOptions}
                buttonClassName="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
            />

            {showOwnershipModal && ownerField && (
                <BulkOwnershipModal
                    open={showOwnershipModal}
                    onClose={() => setShowOwnershipModal(false)}
                    entityType={entityType}
                    entityIds={entityIds}
                    fieldLabel={ownerField.field_label || 'Owner'}
                    onSuccess={handleSuccess}
                />
            )}

            {showStatusModal && statusField && (
                <BulkStatusModal
                    open={showStatusModal}
                    onClose={() => setShowStatusModal(false)}
                    entityType={entityType}
                    entityIds={entityIds}
                    fieldLabel={statusField.field_label || 'Status'}
                    options={statusField.options || []}
                    availableFields={availableFields}
                    onSuccess={handleSuccess}
                />
            )}

            {showOpenCloseModal && openCloseField && (
                <BulkOpenCloseModal
                    open={showOpenCloseModal}
                    onClose={() => setShowOpenCloseModal(false)}
                    entityType={entityType}
                    entityIds={entityIds}
                    fieldLabel={openCloseField.field_label || 'Open/Close'}
                    onSuccess={handleSuccess}
                />
            )}

            {showTearsheetModal && (
                <BulkTearsheetModal
                    open={showTearsheetModal}
                    onClose={() => setShowTearsheetModal(false)}
                    entityType={entityType}
                    entityIds={entityIds}
                    onSuccess={handleSuccess}
                />
            )}

            {showNoteModal && (
                <BulkNoteModal
                    open={showNoteModal}
                    onClose={() => setShowNoteModal(false)}
                    entityType={entityType}
                    entityIds={entityIds}
                    onSuccess={handleSuccess}
                />
            )}

            {showTaskModal && (
                <BulkTaskModal
                    open={showTaskModal}
                    onClose={() => setShowTaskModal(false)}
                    entityType={entityType}
                    entityIds={entityIds}
                    onSuccess={handleSuccess}
                />
            )}
        </>
    );
}
