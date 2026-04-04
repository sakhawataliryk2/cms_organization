// lib/field-mapping-configs.ts

export interface FieldLockConfig {
    name: string;
    is_label_locked?: boolean;
    is_field_type_locked?: boolean;
    is_required_locked?: boolean;
    is_hidden_locked?: boolean;
    is_read_only_locked?: boolean;
    is_sort_order_locked?: boolean;
    is_placeholder_locked?: boolean;
    is_default_value_locked?: boolean;
    is_options_locked?: boolean;
}

export const organizationsBaseFields: FieldLockConfig[] = [

];
export const jobsBaseFields: FieldLockConfig[] = [
    {
        name: "Field_1", // Title
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_2", // Company / Organization
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_3", // Reference Number
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_4", // Status
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
        // is_options_locked: tr
    },
];
export const jobsDirectHireBaseFields: FieldLockConfig[] = [
    
];
export const jobsExecutiveSearchBaseFields: FieldLockConfig[] = [];
export const jobSeekerBaseFields: FieldLockConfig[] = [];
export const leadsBaseFields: FieldLockConfig[] = [];
export const hiringManagersBaseFields: FieldLockConfig[] = [];
export const plannerBaseFields: FieldLockConfig[] = [];
export const tasksBaseFields: FieldLockConfig[] = [];
export const placementsBaseFields: FieldLockConfig[] = [];
export const placementsDirectHireBaseFields: FieldLockConfig[] = [];
export const placementsExecutiveSearchBaseFields: FieldLockConfig[] = [];
export const goalsQuotasBaseFields: FieldLockConfig[] = [];

export const entityFieldConfigs: Record<string, FieldLockConfig[]> = {
    organizations: organizationsBaseFields,
    jobs: jobsBaseFields,
    "jobs-direct-hire": jobsDirectHireBaseFields,
    "jobs-executive-search": jobsExecutiveSearchBaseFields,
    "job-seekers": jobSeekerBaseFields,
    leads: leadsBaseFields,
    "hiring-managers": hiringManagersBaseFields,
    planner: plannerBaseFields,
    tasks: tasksBaseFields,
    placements: placementsBaseFields,
    "placements-direct-hire": placementsDirectHireBaseFields,
    "placements-executive-search": placementsExecutiveSearchBaseFields,
    "goals-quotas": goalsQuotasBaseFields,
};
