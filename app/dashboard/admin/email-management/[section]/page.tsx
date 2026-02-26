"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { FiX, FiEdit2, FiTrash2, FiArrowLeft } from "react-icons/fi";

interface EmailTemplate {
  id: number;
  template_name: string;
  subject: string;
  body: string;
  type: string;
}

type FormData = Omit<EmailTemplate, "id">;

// Section-specific type options and placeholders
const SECTION_CONFIG: Record<
  string,
  {
    types: { value: string; label: string }[];
    placeholders: Record<string, string[]>;
    required: Record<string, string[]>;
    defaults: Record<string, { template_name: string; subject: string; body: string }>;
  }
> = {
  "job-seeker": {
    types: [
      { value: "ONBOARDING_INTERNAL_SENT", label: "Onboarding - Internal Notification" },
      { value: "ONBOARDING_JOBSEEKER_FIRST_TIME", label: "Onboarding - Job Seeker (First Time Credentials Sent)" },
      { value: "ONBOARDING_JOBSEEKER_REPEAT", label: "Onboarding - Job Seeker (Repeat)" },
      { value: "JOB_SEEKER_DELETE_REQUEST", label: "Job Seeker - Delete Request (Payroll)" },
      { value: "JOB_SEEKER_TRANSFER_REQUEST", label: "Job Seeker - Transfer Request (Payroll)" },
      { value: "JOB_SEEKER_UNARCHIVE_REQUEST", label: "Job Seeker - Unarchive Request (Onboarding)" },
      { value: "JOB_SEEKER_APPLICATION_SUBMISSION", label: "Application Submission Template" },
    ],
    placeholders: {
      ONBOARDING_INTERNAL_SENT: ["{{jobSeekerName}}", "{{sentBy}}", "{{docsList}}"],
      ONBOARDING_JOBSEEKER_FIRST_TIME: ["{{portalUrl}}", "{{username}}", "{{tempPassword}}"],
      ONBOARDING_JOBSEEKER_REPEAT: ["{{portalUrl}}"],
      JOB_SEEKER_DELETE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{requestId}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
      JOB_SEEKER_TRANSFER_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{sourceRecordNumber}}",
        "{{targetRecordNumber}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
      JOB_SEEKER_UNARCHIVE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
      JOB_SEEKER_APPLICATION_SUBMISSION: [
        "{{candidateName}}",
        "{{candidateNameLink}}",
        "{{jobTitle}}",
        "{{submittedBy}}",
        "{{submissionType}}",
        "{{source}}",
        "{{submittedAt}}",
        "{{submissionSummary}}",
        "{{viewCandidateUrl}}",
      ],
    },
    required: {
      ONBOARDING_INTERNAL_SENT: ["{{jobSeekerName}}", "{{sentBy}}", "{{docsList}}"],
      ONBOARDING_JOBSEEKER_FIRST_TIME: ["{{portalUrl}}", "{{username}}", "{{tempPassword}}"],
      ONBOARDING_JOBSEEKER_REPEAT: ["{{portalUrl}}"],
      JOB_SEEKER_DELETE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      JOB_SEEKER_TRANSFER_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      JOB_SEEKER_UNARCHIVE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      JOB_SEEKER_APPLICATION_SUBMISSION: ["{{candidateNameLink}}", "{{viewCandidateUrl}}"],
    },
    defaults: {
      ONBOARDING_INTERNAL_SENT: {
        template_name: "Onboarding Internal Notification",
        subject: "Documents Sent for {{jobSeekerName}}",
        body:
          `<div>` +
          `<p>Hello</p>` +
          `<p>The documents for <b>Job Seeker {{jobSeekerName}}</b> have been sent for onboarding.</p>` +
          `<p><b>Documents:</b></p>` +
          `<ul>{{docsList}}</ul>` +
          `<p>These were sent by <b>{{sentBy}}</b>.</p>` +
          `</div>`,
      },
      ONBOARDING_JOBSEEKER_FIRST_TIME: {
        template_name: "Onboarding Job Seeker - First Time",
        subject: "Onboarding Documents - Portal Access",
        body:
          `<div>` +
          `<p>Hello,</p>` +
          `<p>You have onboarding documents that are awaiting your submission.</p>` +
          `<p><b>Portal:</b> <a href="{{portalUrl}}">WEBSITE</a></p>` +
          `<p><b>Username:</b> {{username}}</p>` +
          `<p><b>Temporary Password:</b> {{tempPassword}}</p>` +
          `<p>Please log in and complete your documents.</p>` +
          `<p>Best Regards,<br/>Complete Staffing Solutions, Inc.</p>` +
          `</div>`,
      },
      ONBOARDING_JOBSEEKER_REPEAT: {
        template_name: "Onboarding Job Seeker - Repeat",
        subject: "Onboarding Documents",
        body:
          `<div>` +
          `<p>Hello,</p>` +
          `<p>You have onboarding documents that are awaiting your submission.</p>` +
          `<p>Please log into <a href="{{portalUrl}}">WEBSITE</a> to complete your documents. Your username is the email address you received this email to.</p>` +
          `<p>Best Regards,<br/>Complete Staffing Solutions, Inc.</p>` +
          `</div>`,
      },
      JOB_SEEKER_DELETE_REQUEST: {
        template_name: "Job Seeker Delete Request",
        subject: "Delete Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Delete Request (Job Seeker)</h2>` +
          `<p>A new job seeker delete request has been submitted and requires your review.</p>` +
          `<p><strong>Request Details:</strong></p>` +
          `<ul>` +
          `<li><strong>Request ID:</strong> {{requestId}} (the approval link uses this ID)</li>` +
          `<li><strong>Record (Job Seeker):</strong> {{recordNumber}}</li>` +
          `<li><strong>Organization Name:</strong> {{organizationNameLink}}</li>` +
          `<li><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</li>` +
          `<li><strong>Request Date:</strong> {{requestDate}}</li>` +
          `<li><strong>Reason:</strong> {{reason}}</li>` +
          `</ul>` +
          `<p>Please review the request and take the appropriate action using the links below:</p>` +
          `<p>{{approvalUrl}} {{denyUrl}}</p>` +
          `</div>`,
      },
      JOB_SEEKER_TRANSFER_REQUEST: {
        template_name: "Job Seeker Transfer Request",
        subject: "Transfer Request: {{sourceRecordNumber}} → {{targetRecordNumber}}",
        body:
          `<div>` +
          `<h2>Job Seeker Transfer Request</h2>` +
          `<p>A transfer request has been submitted (job seeker to job seeker):</p>` +
          `<ul>` +
          `<li><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</li>` +
          `<li><strong>Source Job Seeker:</strong> {{sourceRecordNumber}}</li>` +
          `<li><strong>Target Job Seeker:</strong> {{targetRecordNumber}}</li>` +
          `<li><strong>Request Date:</strong> {{requestDate}}</li>` +
          `</ul>` +
          `<p>If approved, notes, documents, tasks, placements, and applications will move to the target job seeker. The source will be archived.</p>` +
          `<p>Please review and approve or deny using the buttons below:</p>` +
          `<p>{{approvalUrl}} {{denyUrl}}</p>` +
          `</div>`,
      },
      JOB_SEEKER_UNARCHIVE_REQUEST: {
        template_name: "UNARCHIVE_TEMPLATE",
        subject: "Unarchive Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Unarchive Request (Job Seeker)</h2>` +
          `<p>An unarchive request has been submitted for the following record.</p>` +
          `<p><strong>Record:</strong> {{recordNumber}}</p>` +
          `<p><strong>Organization Name:</strong> {{organizationNameLink}}</p>` +
          `<p><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</p>` +
          `<p><strong>Request Date:</strong> {{requestDate}}</p>` +
          `<p><strong>Reason:</strong> {{reason}}</p>` +
          `<p><a href="{{approvalUrl}}">Approve Unarchive</a> | <a href="{{denyUrl}}">Deny Unarchive</a></p>` +
          `</div>`,
      },
      JOB_SEEKER_APPLICATION_SUBMISSION: {
        template_name: "Application Submission Template",
        subject: "New Candidate Submission: {{candidateName}} → {{jobTitle}}",
        body:
          `<div>` +
          `<p><strong>Candidate:</strong> {{candidateNameLink}}</p>` +
          `<p><strong>Job:</strong> {{jobTitle}}</p>` +
          `<p><strong>Submitted By:</strong> {{submittedBy}}</p>` +
          `<p><strong>Submission Type:</strong> {{submissionType}}</p>` +
          `<p><strong>Source:</strong> {{source}}</p>` +
          `<p><strong>Submitted At:</strong> {{submittedAt}}</p>` +
          `<p><strong>Submission Summary:</strong></p>` +
          `<pre style="background:#f5f5f5;padding:10px;border-radius:4px;">{{submissionSummary}}</pre>` +
          `<p><strong>View Candidate:</strong> <a href="{{viewCandidateUrl}}">{{viewCandidateUrl}}</a></p>` +
          `<p><em>This is an automated notification from the ATS.</em></p>` +
          `</div>`,
      },
    },
  },
  organization: {
    types: [
      { value: "ORGANIZATION_DELETE_REQUEST", label: "Organization - Delete Request (Payroll)" },
      { value: "ORGANIZATION_TRANSFER_REQUEST", label: "Organization - Transfer Request (Payroll)" },
      { value: "ORGANIZATION_UNARCHIVE_REQUEST", label: "Organization - Unarchive Request (Payroll)" },
    ],
    placeholders: {
      ORGANIZATION_DELETE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{requestId}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
      ORGANIZATION_TRANSFER_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{sourceRecordNumber}}",
        "{{targetRecordNumber}}",
        "{{sourceOrganizationNameLink}}",
        "{{targetOrganizationNameLink}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
      ORGANIZATION_UNARCHIVE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
    },
    required: {
      ORGANIZATION_DELETE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      ORGANIZATION_TRANSFER_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      ORGANIZATION_UNARCHIVE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
    },
    defaults: {
      ORGANIZATION_DELETE_REQUEST: {
        template_name: "Organization Delete Request",
        subject: "Delete Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Delete Request</h2>` +
          `<p>A new organization delete request has been submitted and requires your review.</p>` +
          `<p><strong>Request Details:</strong></p>` +
          `<ul>` +
          `<li><strong>Request ID:</strong> {{requestId}} (the approval link uses this ID)</li>` +
          `<li><strong>Record (Organization):</strong> {{recordNumber}}</li>` +
          `<li><strong>Organization Name:</strong> {{organizationNameLink}}</li>` +
          `<li><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</li>` +
          `<li><strong>Request Date:</strong> {{requestDate}}</li>` +
          `<li><strong>Reason:</strong> {{reason}}</li>` +
          `</ul>` +
          `<p>Please review the request and take the appropriate action using the links below:</p>` +
          `<p>{{approvalUrl}} {{denyUrl}}</p>` +
          `</div>`,
      },
      ORGANIZATION_TRANSFER_REQUEST: {
        template_name: "Organization Transfer Request",
        subject: "Transfer Request: {{sourceRecordNumber}} → {{targetRecordNumber}}",
        body:
          `<div>` +
          `<h2>Organization Transfer Request</h2>` +
          `<p>A transfer request has been submitted:</p>` +
          `<ul>` +
          `<li><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</li>` +
          `<li><strong>Source Organization:</strong> {{sourceOrganizationNameLink}}</li>` +
          `<li><strong>Target Organization:</strong> {{targetOrganizationNameLink}}</li>` +
          `<li><strong>Request Date:</strong> {{requestDate}}</li>` +
          `</ul>` +
          `<p>Please review and approve or deny this transfer. Use the buttons below:</p>` +
          `<p>{{approvalUrl}} {{denyUrl}}</p>` +
          `</div>`,
      },
      ORGANIZATION_UNARCHIVE_REQUEST: {
        template_name: "UNARCHIVE_TEMPLATE",
        subject: "Unarchive Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Unarchive Request (Organization)</h2>` +
          `<p>An unarchive request has been submitted.</p>` +
          `<p><strong>Record:</strong> {{recordNumber}}</p>` +
          `<p><strong>Organization Name:</strong> {{organizationNameLink}}</p>` +
          `<p><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</p>` +
          `<p><strong>Request Date:</strong> {{requestDate}}</p>` +
          `<p><strong>Reason:</strong> {{reason}}</p>` +
          `<p><a href="{{approvalUrl}}">Approve Unarchive</a> | <a href="{{denyUrl}}">Deny Unarchive</a></p>` +
          `</div>`,
      },
    },
  },
  "hiring-manager": {
    types: [
      { value: "HIRING_MANAGER_DELETE_REQUEST", label: "Hiring Manager - Delete Request (Payroll)" },
      { value: "HIRING_MANAGER_TRANSFER_REQUEST", label: "Hiring Manager - Transfer Request (Payroll)" },
      { value: "HIRING_MANAGER_UNARCHIVE_REQUEST", label: "Hiring Manager - Unarchive Request (Payroll)" },
    ],
    placeholders: {
      HIRING_MANAGER_DELETE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{requestId}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
      HIRING_MANAGER_TRANSFER_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{sourceRecordNumber}}",
        "{{targetRecordNumber}}",
        "{{sourceOrganizationNameLink}}",
        "{{targetOrganizationNameLink}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
      HIRING_MANAGER_UNARCHIVE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
    },
    required: {
      HIRING_MANAGER_DELETE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      HIRING_MANAGER_TRANSFER_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      HIRING_MANAGER_UNARCHIVE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
    },
    defaults: {
      HIRING_MANAGER_DELETE_REQUEST: {
        template_name: "Hiring Manager Delete Request",
        subject: "Delete Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Delete Request (Hiring Manager)</h2>` +
          `<p>A new hiring manager delete request has been submitted and requires your review.</p>` +
          `<p><strong>Request Details:</strong></p>` +
          `<ul>` +
          `<li><strong>Request ID:</strong> {{requestId}} (the approval link uses this ID)</li>` +
          `<li><strong>Record (Hiring Manager):</strong> {{recordNumber}}</li>` +
          `<li><strong>Organization Name:</strong> {{organizationNameLink}}</li>` +
          `<li><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</li>` +
          `<li><strong>Request Date:</strong> {{requestDate}}</li>` +
          `<li><strong>Reason:</strong> {{reason}}</li>` +
          `</ul>` +
          `<p>Please review the request and take the appropriate action using the links below:</p>` +
          `<p>{{approvalUrl}} {{denyUrl}}</p>` +
          `</div>`,
      },
      HIRING_MANAGER_TRANSFER_REQUEST: {
        template_name: "Hiring Manager Transfer Request",
        subject: "Transfer Request: {{sourceRecordNumber}} → {{targetRecordNumber}}",
        body:
          `<div>` +
          `<h2>Hiring Manager / Organization Transfer Request</h2>` +
          `<p>A transfer request has been submitted (hiring manager context):</p>` +
          `<ul>` +
          `<li><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</li>` +
          `<li><strong>Source Organization:</strong> {{sourceOrganizationNameLink}}</li>` +
          `<li><strong>Target Organization:</strong> {{targetOrganizationNameLink}}</li>` +
          `<li><strong>Request Date:</strong> {{requestDate}}</li>` +
          `</ul>` +
          `<p>Please review and approve or deny this transfer. Use the buttons below:</p>` +
          `<p>{{approvalUrl}} {{denyUrl}}</p>` +
          `</div>`,
      },
      HIRING_MANAGER_UNARCHIVE_REQUEST: {
        template_name: "UNARCHIVE_TEMPLATE",
        subject: "Unarchive Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Unarchive Request (Hiring Manager)</h2>` +
          `<p>An unarchive request has been submitted.</p>` +
          `<p><strong>Record:</strong> {{recordNumber}}</p>` +
          `<p><strong>Organization Name:</strong> {{organizationNameLink}}</p>` +
          `<p><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</p>` +
          `<p><strong>Request Date:</strong> {{requestDate}}</p>` +
          `<p><strong>Reason:</strong> {{reason}}</p>` +
          `<p><a href="{{approvalUrl}}">Approve Unarchive</a> | <a href="{{denyUrl}}">Deny Unarchive</a></p>` +
          `</div>`,
      },
    },
  },
  jobs: {
    types: [
      { value: "JOB_DELETE_REQUEST", label: "Job - Delete Request (Payroll)" },
      { value: "JOB_UNARCHIVE_REQUEST", label: "Job - Unarchive Request (Payroll)" },
      { value: "JOB_DISTRIBUTION", label: "Job - Distribution email (send job to distribution list)" },
    ],
    placeholders: {
      JOB_DISTRIBUTION: [
        "{{jobTitle}}",
        "{{jobTitleLink}}",
        "{{recordNumber}}",
        "{{jobLink}}",
        "{{organizationName}}",
        "{{status}}",
        "{{employmentType}}",
        "{{createdByName}}",
      ],
      JOB_DELETE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{requestId}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
      JOB_UNARCHIVE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
    },
    required: {
      JOB_DELETE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      JOB_UNARCHIVE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      JOB_DISTRIBUTION: [],
    },
    defaults: {
      JOB_DISTRIBUTION: {
        template_name: "Job Distribution",
        subject: "New job shared with you: {{jobTitle}}",
        body:
          `<div>` +
          `<h2>Job shared with you</h2>` +
          `<p><strong>Job:</strong> {{jobTitleLink}}</p>` +
          `<p><strong>Record #:</strong> {{recordNumber}}</p>` +
          `<p><strong>Organization:</strong> {{organizationName}}</p>` +
          `<p><strong>Status:</strong> {{status}}</p>` +
          `<p><strong>Employment Type:</strong> {{employmentType}}</p>` +
          `<p><strong>Created by:</strong> {{createdByName}}</p>` +
          `<p><a href="{{jobLink}}">View job</a></p>` +
          `</div>`,
      },
      JOB_DELETE_REQUEST: {
        template_name: "Job Delete Request",
        subject: "Delete Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Delete Request (Job)</h2>` +
          `<p>A new job delete request has been submitted and requires your review.</p>` +
          `<p><strong>Request Details:</strong></p>` +
          `<ul>` +
          `<li><strong>Request ID:</strong> {{requestId}} (the approval link uses this ID)</li>` +
          `<li><strong>Record (Job):</strong> {{recordNumber}}</li>` +
          `<li><strong>Organization Name:</strong> {{organizationNameLink}}</li>` +
          `<li><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</li>` +
          `<li><strong>Request Date:</strong> {{requestDate}}</li>` +
          `<li><strong>Reason:</strong> {{reason}}</li>` +
          `</ul>` +
          `<p>Please review the request and take the appropriate action using the links below:</p>` +
          `<p>{{approvalUrl}} {{denyUrl}}</p>` +
          `</div>`,
      },
      JOB_UNARCHIVE_REQUEST: {
        template_name: "UNARCHIVE_TEMPLATE",
        subject: "Unarchive Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Unarchive Request (Job)</h2>` +
          `<p>An unarchive request has been submitted.</p>` +
          `<p><strong>Record:</strong> {{recordNumber}}</p>` +
          `<p><strong>Organization Name:</strong> {{organizationNameLink}}</p>` +
          `<p><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</p>` +
          `<p><strong>Request Date:</strong> {{requestDate}}</p>` +
          `<p><strong>Reason:</strong> {{reason}}</p>` +
          `<p><a href="{{approvalUrl}}">Approve Unarchive</a> | <a href="{{denyUrl}}">Deny Unarchive</a></p>` +
          `</div>`,
      },
    },
  },
  leads: {
    types: [
      { value: "LEAD_DELETE_REQUEST", label: "Lead - Delete Request (Payroll)" },
      { value: "LEAD_UNARCHIVE_REQUEST", label: "Lead - Unarchive Request (Payroll)" },
    ],
    placeholders: {
      LEAD_DELETE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{requestId}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
      LEAD_UNARCHIVE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
    },
    required: {
      LEAD_DELETE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      LEAD_UNARCHIVE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
    },
    defaults: {
      LEAD_DELETE_REQUEST: {
        template_name: "Lead Delete Request",
        subject: "Delete Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Delete Request (Lead)</h2>` +
          `<p>A new lead delete request has been submitted and requires your review.</p>` +
          `<p><strong>Request Details:</strong></p>` +
          `<ul>` +
          `<li><strong>Request ID:</strong> {{requestId}} (the approval link uses this ID)</li>` +
          `<li><strong>Record (Lead):</strong> {{recordNumber}}</li>` +
          `<li><strong>Organization Name:</strong> {{organizationNameLink}}</li>` +
          `<li><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</li>` +
          `<li><strong>Request Date:</strong> {{requestDate}}</li>` +
          `<li><strong>Reason:</strong> {{reason}}</li>` +
          `</ul>` +
          `<p>Please review the request and take the appropriate action using the links below:</p>` +
          `<p>{{approvalUrl}} {{denyUrl}}</p>` +
          `</div>`,
      },
      LEAD_UNARCHIVE_REQUEST: {
        template_name: "UNARCHIVE_TEMPLATE",
        subject: "Unarchive Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Unarchive Request (Lead)</h2>` +
          `<p>An unarchive request has been submitted.</p>` +
          `<p><strong>Record:</strong> {{recordNumber}}</p>` +
          `<p><strong>Organization Name:</strong> {{organizationNameLink}}</p>` +
          `<p><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</p>` +
          `<p><strong>Request Date:</strong> {{requestDate}}</p>` +
          `<p><strong>Reason:</strong> {{reason}}</p>` +
          `<p><a href="{{approvalUrl}}">Approve Unarchive</a> | <a href="{{denyUrl}}">Deny Unarchive</a></p>` +
          `</div>`,
      },
    },
  },
  tasks: {
    types: [
      { value: "TASK_REMINDER", label: "Task Reminder" },
      { value: "TASK_DELETE_REQUEST", label: "Task - Delete Request (Payroll)" },
      { value: "TASK_UNARCHIVE_REQUEST", label: "Task - Unarchive Request (Payroll)" },
    ],
    placeholders: {
      TASK_REMINDER: [
        "{{taskTitle}}",
        "{{taskDescription}}",
        "{{dueDate}}",
        "{{dueTime}}",
        "{{dueDateAndTime}}",
        "{{assignedTo}}",
        "{{createdBy}}",
        "{{organizationName}}",
        "{{hiringManagerName}}",
        "{{taskLink}}",
      ],
      TASK_DELETE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{requestId}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
      TASK_UNARCHIVE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
    },
    required: {
      TASK_REMINDER: ["{{taskTitle}}", "{{dueDateAndTime}}", "{{taskLink}}"],
      TASK_DELETE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      TASK_UNARCHIVE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
    },
    defaults: {
      TASK_REMINDER: {
        template_name: "Task Reminder",
        subject: "Task Reminder: {{taskTitle}}",
        body:
          `<div>` +
          `<h2>Task Reminder</h2>` +
          `<p>This is a reminder for the following task:</p>` +
          `<p><strong>{{taskTitle}}</strong></p>` +
          `<p>{{taskDescription}}</p>` +
          `<p><strong>Due:</strong> {{dueDateAndTime}}</p>` +
          `<p><strong>Assigned To:</strong> {{assignedTo}}</p>` +
          `<p><strong>Created By:</strong> {{createdBy}}</p>` +
          `<p><strong>Organization:</strong> {{organizationName}}</p>` +
          `<p><strong>Hiring Manager:</strong> {{hiringManagerName}}</p>` +
          `<p>You are receiving this as the task owner or assignee.</p>` +
          `<p>{{taskLink}}</p>` +
          `</div>`,
      },
      TASK_DELETE_REQUEST: {
        template_name: "Task Delete Request",
        subject: "Delete Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Delete Request (Task)</h2>` +
          `<p>A new task delete request has been submitted and requires your review.</p>` +
          `<p><strong>Request Details:</strong></p>` +
          `<ul>` +
          `<li><strong>Request ID:</strong> {{requestId}} (the approval link uses this ID)</li>` +
          `<li><strong>Record (Task):</strong> {{recordNumber}}</li>` +
          `<li><strong>Organization Name:</strong> {{organizationNameLink}}</li>` +
          `<li><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</li>` +
          `<li><strong>Request Date:</strong> {{requestDate}}</li>` +
          `<li><strong>Reason:</strong> {{reason}}</li>` +
          `</ul>` +
          `<p>Please review the request and take the appropriate action using the links below:</p>` +
          `<p>{{approvalUrl}} {{denyUrl}}</p>` +
          `</div>`,
      },
      TASK_UNARCHIVE_REQUEST: {
        template_name: "UNARCHIVE_TEMPLATE",
        subject: "Unarchive Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Unarchive Request (Task)</h2>` +
          `<p>An unarchive request has been submitted.</p>` +
          `<p><strong>Record:</strong> {{recordNumber}}</p>` +
          `<p><strong>Organization Name:</strong> {{organizationNameLink}}</p>` +
          `<p><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</p>` +
          `<p><strong>Request Date:</strong> {{requestDate}}</p>` +
          `<p><strong>Reason:</strong> {{reason}}</p>` +
          `<p><a href="{{approvalUrl}}">Approve Unarchive</a> | <a href="{{denyUrl}}">Deny Unarchive</a></p>` +
          `</div>`,
      },
    },
  },
  placements: {
    types: [
      { value: "PLACEMENT_DELETE_REQUEST", label: "Placement - Delete Request (Payroll)" },
      { value: "PLACEMENT_UNARCHIVE_REQUEST", label: "Placement - Unarchive Request (Payroll)" },
    ],
    placeholders: {
      PLACEMENT_DELETE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{requestId}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
      PLACEMENT_UNARCHIVE_REQUEST: [
        "{{requestedBy}}",
        "{{requestedByEmail}}",
        "{{recordType}}",
        "{{recordNumber}}",
        "{{organizationNameLink}}",
        "{{reason}}",
        "{{requestDate}}",
        "{{approvalUrl}}",
        "{{denyUrl}}",
      ],
    },
    required: {
      PLACEMENT_DELETE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
      PLACEMENT_UNARCHIVE_REQUEST: ["{{approvalUrl}}", "{{denyUrl}}"],
    },
    defaults: {
      PLACEMENT_DELETE_REQUEST: {
        template_name: "Placement Delete Request",
        subject: "Delete Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Delete Request (Placement)</h2>` +
          `<p>A new placement delete request has been submitted and requires your review.</p>` +
          `<p><strong>Request Details:</strong></p>` +
          `<ul>` +
          `<li><strong>Request ID:</strong> {{requestId}} (the approval link uses this ID)</li>` +
          `<li><strong>Record (Placement):</strong> {{recordNumber}}</li>` +
          `<li><strong>Organization Name:</strong> {{organizationNameLink}}</li>` +
          `<li><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</li>` +
          `<li><strong>Request Date:</strong> {{requestDate}}</li>` +
          `<li><strong>Reason:</strong> {{reason}}</li>` +
          `</ul>` +
          `<p>Please review the request and take the appropriate action using the links below:</p>` +
          `<p>{{approvalUrl}} {{denyUrl}}</p>` +
          `</div>`,
      },
      PLACEMENT_UNARCHIVE_REQUEST: {
        template_name: "UNARCHIVE_TEMPLATE",
        subject: "Unarchive Request: {{recordType}} {{recordNumber}}",
        body:
          `<div>` +
          `<h2>Unarchive Request (Placement)</h2>` +
          `<p>An unarchive request has been submitted.</p>` +
          `<p><strong>Record:</strong> {{recordNumber}}</p>` +
          `<p><strong>Organization Name:</strong> {{organizationNameLink}}</p>` +
          `<p><strong>Requested By:</strong> {{requestedBy}} ({{requestedByEmail}})</p>` +
          `<p><strong>Request Date:</strong> {{requestDate}}</p>` +
          `<p><strong>Reason:</strong> {{reason}}</p>` +
          `<p><a href="{{approvalUrl}}">Approve Unarchive</a> | <a href="{{denyUrl}}">Deny Unarchive</a></p>` +
          `</div>`,
      },
    },
  },
};

const SECTION_LABELS: Record<string, string> = {
  "job-seeker": "Job Seeker",
  organization: "Organization",
  "hiring-manager": "Hiring Manager",
  jobs: "Jobs",
  leads: "Leads",
  tasks: "Tasks",
  placements: "Placements",
};

export default function EmailManagementSectionPage() {
  const router = useRouter();
  const params = useParams();
  const section = (params?.section as string) || "";

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const config = SECTION_CONFIG[section];
  const sectionTypes = useMemo(
    () => config?.types?.map((t) => t.value) || [],
    [config]
  );

  const [formData, setFormData] = useState<FormData>({
    template_name: "",
    subject: "",
    body: "",
    type: "",
  });

  useEffect(() => {
    if (!section || !config) return;
    fetch("/api/admin/email-management")
      .then((res) => res.json())
      .then((data) => {
        const all = data.templates || [];
        setTemplates(all.filter((t: EmailTemplate) => sectionTypes.includes(t.type)));
      })
      .catch((err) => console.error("Error fetching templates:", err));
  }, [section, config, sectionTypes]);

  useEffect(() => {
    if (sectionTypes.length && !formData.type) {
      setFormData((p) => ({ ...p, type: sectionTypes[0] }));
    }
  }, [sectionTypes, formData.type]);

  const apiRequest = async (url: string, method: string, body?: any) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setFormData({
      template_name: "",
      subject: "",
      body: "",
      type: availableTypes[0] || sectionTypes[0] || "",
    });
    setShowModal(true);
  };

  const openEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      template_name: template.template_name,
      subject: template.subject,
      body: template.body,
      type: template.type,
    });
    setShowModal(true);
  };

  const insertAtCursor = (text: string) => {
    const el = document.getElementById("bodyField") as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart ?? formData.body.length;
    const end = el.selectionEnd ?? formData.body.length;
    const next = formData.body.slice(0, start) + text + formData.body.slice(end);
    setFormData((p) => ({ ...p, body: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const loadDefault = () => {
    const d = config?.defaults?.[formData.type];
    if (!d) return;
    setFormData((p) => ({
      ...p,
      template_name: p.template_name || d.template_name,
      subject: p.subject || d.subject,
      body: p.body || d.body,
    }));
  };

  const usedTypes = useMemo(() => templates.map((t) => t.type), [templates]);
  const availableTypes = useMemo(
    () => sectionTypes.filter((t) => !usedTypes.includes(t)),
    [sectionTypes, usedTypes]
  );

  const required = config?.required?.[formData.type] || [];
  const placeholders = config?.placeholders?.[formData.type] || [];
  const missing = useMemo(() => {
    const combined = `${formData.subject}\n${formData.body}`;
    return required.filter((ph) => !combined.includes(ph));
  }, [formData.type, formData.subject, formData.body, required]);

  const handleDelete = async (id: number) => {
    await apiRequest(`/api/admin/email-management/${id}`, "DELETE");
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const url = editingTemplate
        ? `/api/admin/email-management/${editingTemplate.id}`
        : "/api/admin/email-management";
      const method = editingTemplate ? "PUT" : "POST";
      const data = await apiRequest(url, method, formData);
      if (!data.success && data.message) {
        alert(data.message);
        return;
      }
      setTemplates((prev) =>
        editingTemplate
          ? prev.map((t) => (t.id === data.template.id ? data.template : t))
          : [...prev, data.template]
      );
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => router.push("/dashboard/admin/email-management");

  if (!section || !config) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Invalid section.</p>
        <button onClick={goBack} className="mt-4 text-blue-600 hover:underline">
          Back to Email Management
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-200 min-h-screen">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
          type="button"
        >
          <FiArrowLeft className="w-5 h-5" />
          Back
        </button>
        <h2 className="text-2xl font-bold text-gray-800">
          Email Management – {SECTION_LABELS[section] || section}
        </h2>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-600 text-sm">
          Use <code className="bg-gray-300 px-1 rounded">{`{{approvalUrl}}`}</code> and{" "}
          <code className="bg-gray-300 px-1 rounded">{`{{denyUrl}}`}</code> anywhere in the body—they render as full Approve/Deny buttons.
          {sectionTypes.length > 0 && (
            <span className="block mt-1">
              One template per type (e.g. one Delete Request, one Transfer Request per section).
            </span>
          )}
        </p>
        {availableTypes.length > 0 ? (
          <button
            className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition"
            onClick={openCreate}
          >
            Create New Template
          </button>
        ) : (
          <span className="text-sm text-gray-500">All types in this section have a template. Edit existing to change.</span>
        )}
      </div>

      <table className="min-w-full table-auto border-collapse border border-gray-300 shadow-sm rounded-lg overflow-hidden bg-white">
        <thead>
          <tr className="bg-gray-100 text-gray-700">
            <th className="px-4 py-2 border text-left">Template Name</th>
            <th className="px-4 py-2 border text-left">Subject</th>
            <th className="px-4 py-2 border text-left">Type</th>
            <th className="px-4 py-2 border text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id} className="hover:bg-gray-50 transition">
              <td className="px-4 py-2 border">{template.template_name}</td>
              <td className="px-4 py-2 border">{template.subject}</td>
              <td className="px-4 py-2 border">{template.type}</td>
              <td className="px-4 py-2 border">
                <div className="flex gap-3">
                  <button
                    className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition"
                    onClick={() => openEdit(template)}
                    type="button"
                  >
                    <FiEdit2 className="w-4 h-4" />
                    <span className="sr-only">Edit</span>
                  </button>
                  <button
                    className="flex items-center gap-1 text-gray-600 hover:text-red-600 transition"
                    onClick={() => handleDelete(template.id)}
                    type="button"
                  >
                    <FiTrash2 className="w-4 h-4" />
                    <span className="sr-only">Delete</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {templates.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={4}>
                No templates in this section. Create one to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showModal && (
        <div className="fixed inset-0 bg-gray-800/60 flex justify-center items-center px-4 z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg w-[900px] max-w-full relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close modal"
              type="button"
            >
              <FiX className="w-6 h-6" />
            </button>

            <div className="flex items-center justify-between gap-3 mb-6 pr-10">
              <h3 className="text-2xl font-semibold text-gray-800">
                {editingTemplate ? "Edit Template" : "Create Email Template"}
              </h3>
              <button
                type="button"
                className="text-sm px-3 py-2 border rounded hover:bg-gray-50"
                onClick={loadDefault}
              >
                Load Default
              </button>
            </div>

            {missing.length > 0 && (
              <div className="mb-5 p-3 rounded border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
                Missing placeholders: {missing.join(", ")}. Email may send without dynamic data.
              </div>
            )}

            <div className="mb-5">
              <label className="block text-sm font-medium mb-2 text-gray-700">Type</label>
              <select
                className="p-3 border rounded w-full focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                value={formData.type}
                onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
                disabled={!!editingTemplate}
              >
                {(editingTemplate ? config.types : config.types.filter((o) => availableTypes.includes(o.value))).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {editingTemplate && (
                <p className="mt-1 text-xs text-gray-500">Type cannot be changed; one template per type.</p>
              )}
              {(formData.type.includes("DELETE_REQUEST") || formData.type.includes("TRANSFER_REQUEST")) && (
                <div className="mt-2 text-xs text-gray-600">
                  Use <strong>{`{{approvalUrl}}`}</strong> and <strong>{`{{denyUrl}}`}</strong> anywhere in the body—they render as full Approve/Deny buttons. In the subject they remain plain URLs.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Template Name</label>
                <input
                  type="text"
                  className="p-3 border rounded w-full focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.template_name}
                  onChange={(e) => setFormData((p) => ({ ...p, template_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Subject</label>
                <input
                  type="text"
                  className="p-3 border rounded w-full focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.subject}
                  onChange={(e) => setFormData((p) => ({ ...p, subject: e.target.value }))}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 text-gray-700">Body</label>
              <textarea
                id="bodyField"
                className="p-3 border rounded w-full h-[220px] focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Write your email content here..."
                value={formData.body}
                onChange={(e) => setFormData((p) => ({ ...p, body: e.target.value }))}
              />
            </div>

            <div className="mb-6 text-xs text-gray-600">
              <div className="font-semibold mb-2">Quick insert:</div>
              <div className="flex flex-wrap gap-2">
                {placeholders.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100"
                    onClick={() => insertAtCursor(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                className="bg-gray-500 text-white px-5 py-2 rounded-lg hover:bg-gray-600 transition"
                onClick={() => setShowModal(false)}
                type="button"
                disabled={saving}
              >
                Close
              </button>
              <button
                className={`text-white px-5 py-2 rounded-lg shadow transition ${
                  saving ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
                onClick={handleSave}
                type="button"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
