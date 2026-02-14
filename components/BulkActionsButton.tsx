'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ActionDropdown from './ActionDropdown';
import BulkOwnershipModal from './BulkOwnershipModal';
import BulkStatusModal from './BulkStatusModal';
import BulkOpenCloseModal from './BulkOpenCloseModal';
import BulkTearsheetModal from './BulkTearsheetModal';
import BulkNoteModal from './BulkNoteModal';

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
    const router = useRouter();
    const [showOwnershipModal, setShowOwnershipModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showOpenCloseModal, setShowOpenCloseModal] = useState(false);
    const [showTearsheetModal, setShowTearsheetModal] = useState(false);
    const [showNoteModal, setShowNoteModal] = useState(false);

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
        onSuccess?.();
    };

    const handleCreateTasks = () => {
        // Map entity type to the format expected by tasks add page
        const entityTypeMap: Record<string, string> = {
            'hiring-manager': 'hiring_manager',
            'job-seeker': 'job_seeker',
            'organization': 'organization',
            'lead': 'lead',
            'job': 'job',
            'placement': 'placement'
        };
        
        const mappedEntityType = entityTypeMap[entityType] || entityType;
        const entityIdsParam = entityIds.join(',');
        
        // Navigate to tasks add page with multiple entity IDs
        router.push(`/dashboard/tasks/add?relatedEntity=${mappedEntityType}&relatedEntityIds=${entityIdsParam}`);
    };

    const handleConvertToOpportunity = () => {
        // Convert leads to opportunities (jobs)
        // Navigate to jobs/add page with multiple leadIds
        const leadIdsParam = entityIds.join(',');
        router.push(`/dashboard/jobs/add?leadIds=${leadIdsParam}`);
    };

    // Email handlers for placements
    const handleEmailCandidates = async () => {
        if (entityType !== 'placement') return;
        
        const emailSet = new Set<string>();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
        
        try {
            const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
            
            for (const placementId of entityIds) {
                try {
                    const response = await fetch(`/api/placements/${placementId}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    });
                    
                    const data = await response.json();
                    const placement = data?.placement || data;
                    const jobSeekerId = placement?.jobSeekerId || placement?.job_seeker_id;
                    
                    if (jobSeekerId) {
                        const jsResponse = await fetch(`/api/job-seekers/${jobSeekerId}`, {
                            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                        });
                        const jsData = await jsResponse.json();
                        const email = jsData?.jobSeeker?.email || jsData?.job_seeker?.email;
                        if (email && email !== "No email provided" && emailRegex.test(email)) {
                            emailSet.add(email.trim().toLowerCase());
                        }
                    }
                } catch (err) {
                    console.error(`Error fetching placement ${placementId}:`, err);
                }
            }
            
            if (emailSet.size === 0) {
                toast.error("Candidate email(s) not available for selected placements");
                return;
            }
            
            window.location.href = `mailto:${Array.from(emailSet).join(";")}`;
        } catch (err) {
            toast.error("Failed to open email compose");
        }
    };

    const handleEmailBillingContacts = async () => {
        if (entityType !== 'placement') return;
        
        const emailSet = new Set<string>();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
        
        const extractEmailsFromValue = (value: any): void => {
            if (!value) return;
            if (typeof value === "string") {
                const trimmed = value.trim();
                if (emailRegex.test(trimmed)) emailSet.add(trimmed.toLowerCase());
                const matches = trimmed.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/gi);
                if (matches) matches.forEach(m => {
                    const t = m.trim();
                    if (emailRegex.test(t)) emailSet.add(t.toLowerCase());
                });
                return;
            }
            if (Array.isArray(value)) value.forEach(extractEmailsFromValue);
            if (typeof value === "object") {
                if (value.email) extractEmailsFromValue(value.email);
                if (value.email_address) extractEmailsFromValue(value.email_address);
                Object.values(value).forEach(extractEmailsFromValue);
            }
        };
        
        try {
            const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
            
            for (const placementId of entityIds) {
                try {
                    const response = await fetch(`/api/placements/${placementId}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    });
                    const data = await response.json();
                    const placement = data?.placement || data;
                    const jobId = placement?.jobId || placement?.job_id;
                    
                    if (jobId) {
                        const jobResponse = await fetch(`/api/jobs/${jobId}`, {
                            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                        });
                        const jobData = await jobResponse.json();
                        const job = jobData?.job || jobData;
                        
                        if (job?.billing_contact_email) extractEmailsFromValue(job.billing_contact_email);
                        if (job?.billing_contacts) extractEmailsFromValue(job.billing_contacts);
                        if (job?.billingContacts) extractEmailsFromValue(job.billingContacts);
                        if (Array.isArray(job?.contacts)) {
                            job.contacts.forEach((c: any) => {
                                const type = (c?.type || c?.contact_type || "").toLowerCase();
                                if (type === "billing") {
                                    const email = c?.email || c?.email_address;
                                    if (email && emailRegex.test(email.trim())) {
                                        emailSet.add(email.trim().toLowerCase());
                                    }
                                }
                            });
                        }
                    }
                } catch (err) {
                    console.error(`Error fetching placement ${placementId}:`, err);
                }
            }
            
            if (emailSet.size === 0) {
                toast.error("Billing contact email(s) not available for selected placements");
                return;
            }
            
            window.location.href = `mailto:${Array.from(emailSet).join(";")}`;
        } catch (err) {
            toast.error("Failed to open email compose");
        }
    };

    const handleEmailApprovers = async () => {
        if (entityType !== 'placement') return;
        
        const emailSet = new Set<string>();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
        
        const extractEmailsFromValue = (value: any): void => {
            if (!value) return;
            if (typeof value === "string") {
                const trimmed = value.trim();
                if (emailRegex.test(trimmed)) emailSet.add(trimmed.toLowerCase());
                const matches = trimmed.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/gi);
                if (matches) matches.forEach(m => {
                    const t = m.trim();
                    if (emailRegex.test(t)) emailSet.add(t.toLowerCase());
                });
                return;
            }
            if (Array.isArray(value)) value.forEach(extractEmailsFromValue);
            if (typeof value === "object") {
                if (value.email) extractEmailsFromValue(value.email);
                if (value.email_address) extractEmailsFromValue(value.email_address);
                Object.values(value).forEach(extractEmailsFromValue);
            }
        };
        
        try {
            const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
            
            for (const placementId of entityIds) {
                try {
                    const response = await fetch(`/api/placements/${placementId}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    });
                    const data = await response.json();
                    const placement = data?.placement || data;
                    const jobId = placement?.jobId || placement?.job_id;
                    
                    if (jobId) {
                        const jobResponse = await fetch(`/api/jobs/${jobId}`, {
                            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                        });
                        const jobData = await jobResponse.json();
                        const job = jobData?.job || jobData;
                        
                        if (Array.isArray(job?.contacts)) {
                            job.contacts.forEach((c: any) => {
                                const type = (c?.type || c?.contact_type || "").toLowerCase();
                                if (type.includes("timecard") || type.includes("approver")) {
                                    const email = c?.email || c?.email_address;
                                    if (email && emailRegex.test(email.trim())) {
                                        emailSet.add(email.trim().toLowerCase());
                                    }
                                }
                            });
                        }
                    }
                } catch (err) {
                    console.error(`Error fetching placement ${placementId}:`, err);
                }
            }
            
            if (emailSet.size === 0) {
                toast.error("Approver email(s) not available for selected placements");
                return;
            }
            
            window.location.href = `mailto:${Array.from(emailSet).join(";")}`;
        } catch (err) {
            toast.error("Failed to open email compose");
        }
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
        // Add Note - available for hiring-managers, jobs, placements, and other entities
        ...(entityType === 'hiring-manager' || entityType === 'organization' || entityType === 'lead' || entityType === 'job-seeker' || entityType === 'job' || entityType === 'placement' ? [{
            label: 'Add Note',
            action: () => setShowNoteModal(true),
            disabled: false
        }] : []),
        // Create Tasks - available for hiring-managers, jobs, placements, and other entities
        ...(entityType === 'hiring-manager' || entityType === 'organization' || entityType === 'lead' || entityType === 'job-seeker' || entityType === 'job' || entityType === 'placement' ? [{
            label: 'Create Tasks',
            action: handleCreateTasks,
            disabled: false
        }] : []),
        {
            label: 'Add to Tearsheets',
            action: () => setShowTearsheetModal(true),
            disabled: false
        },
        // Convert to Opportunity - only for leads
        ...(entityType === 'lead' ? [{
            label: 'Convert to Opportunity',
            action: handleConvertToOpportunity,
            disabled: false
        }] : []),
        // Email actions - only for placements
        ...(entityType === 'placement' ? [
            {
                label: 'Email Candidates',
                action: handleEmailCandidates,
                disabled: false
            },
            {
                label: 'Email Billing Contacts',
                action: handleEmailBillingContacts,
                disabled: false
            },
            {
                label: 'Email Approvers',
                action: handleEmailApprovers,
                disabled: false
            }
        ] : []),
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
        </>
    );
}
