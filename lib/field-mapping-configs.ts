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
    {
        name: "Field_1", // Organizaiton Name
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_2", // Status
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_5", // Organization Website
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_6", // Main Phone
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_8", // 	Address Line 1
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_9", // 	Address Line 2
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_10", // 	City
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_11", // 	State
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_12", // 	ZIP Code
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_30", // 	Oasis Key
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_69", // 	Owner
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_70", // 	Date Added
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
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
    // {
    //     name: "Field_3", // Reference Number
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    {
        name: "Field_4", // Status
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_5", // 	Description
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_6", // Job Type
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_7", // URL
        is_field_type_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_8", // 	Start Date
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_9", // 	Expiration Date
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_10", // Category
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_11", // Experience
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_12", // 	Address Line 1
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_14", // 	City
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_15", // 	State
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_17", // 	ZIP Code
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_18", // Salary
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_69", // Owner
        is_label_locked: true,
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_70", // Date Added
        is_label_locked: true,
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
];
export const jobsDirectHireBaseFields: FieldLockConfig[] = [

];
export const jobsExecutiveSearchBaseFields: FieldLockConfig[] = [];
export const jobSeekerBaseFields: FieldLockConfig[] = [
    // {
    //     name: "Field_1", // First Name
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_3", // Last Name
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_4", // Status
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_5", // Current Organization
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_8", // Primary Email
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_11", // Priamry Phone
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_15", // Address Line 1
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_17", // City
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_18", // State
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_19", // ZIP Code
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_21", // Current Salary
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_69", // Owner
    //     is_label_locked: true,
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
    // {
    //     name: "Field_70", // Date Added
    //     is_label_locked: true,
    //     is_field_type_locked: true,
    //     is_required_locked: true,
    //     is_hidden_locked: true,
    //     is_read_only_locked: true,
    // },
];
export const leadsBaseFields: FieldLockConfig[] = [];
export const hiringManagersBaseFields: FieldLockConfig[] = [
    {
        name: "Field_1", // First Name
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_2", // Last Name
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_3", // Organizaiton
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
    },
    {
        name: "Field_7", // Primary Email
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_12", // Address Line 1
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_14", // City
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_15", // State
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_17", // Zip Code
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_69", // Owner
        is_label_locked: true,
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_70", // Date Added
        is_label_locked: true,
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
];
export const plannerBaseFields: FieldLockConfig[] = [];
export const tasksBaseFields: FieldLockConfig[] = [
    {
        name: "Field_1", // Title
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_3", // Status
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_4", // Related Entity Type
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_5", // Related Entity ID
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_8", // Reminder
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_7", // Due Date & Time
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_69", // Owner
        is_label_locked: true,
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_70", // Date Added
        is_label_locked: true,
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
];
export const placementsBaseFields: FieldLockConfig[] = [
    {
        name: "Field_1", // Status
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_2", // Job Seeker
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_3", // Billing Contact
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_5", // Employemment Type
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_20", // Time Card Approver
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_69", // Owner
        is_label_locked: true,
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
    {
        name: "Field_70", // Date Added
        is_label_locked: true,
        is_field_type_locked: true,
        is_required_locked: true,
        is_hidden_locked: true,
        is_read_only_locked: true,
    },
];
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
