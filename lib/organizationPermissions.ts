export const ORG_PERMISSIONS = {
  LIST_VIEW: "organizations.list.view",
  RECORD_VIEW: "organizations.record.view",
  RECORD_CREATE: "organizations.record.create",
  RECORD_UPDATE: "organizations.record.update",
  DELETE_REQUEST: "organizations.delete.request",
  DELETE_APPROVE: "organizations.delete.approve",
  DELETE_DENY: "organizations.delete.deny",
  DOCUMENTS_VIEW: "organizations.documents.view",
  DOCUMENTS_UPLOAD: "organizations.documents.upload",
  DOCUMENTS_UPDATE: "organizations.documents.update",
  DOCUMENTS_DELETE: "organizations.documents.delete",
  INVOICES_VIEW: "organizations.invoices.view",
  TRANSFER_REQUEST: "organizations.transfer.request",
  TRANSFER_APPROVE: "organizations.transfer.approve",
  TRANSFER_DENY: "organizations.transfer.deny",
  ARCHIVED_VIEW: "organizations.archived.view",
  BULK_ARCHIVE: "organizations.bulk.archive",
  BULK_DELETE: "organizations.bulk.delete",
  UNARCHIVE_REQUEST: "organizations.unarchive.request",
} as const;

export type OrgRecordLike = {
  created_by?: number | string | null;
  createdBy?: number | string | null;
  assigned_to?: number | string | null;
  assignedTo?: number | string | null;
};

export { toScopedRecord as toOrgRecord } from "@/lib/permissions/types";
export type { ScopedRecordLike } from "@/lib/permissions/types";
