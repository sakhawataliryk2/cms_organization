"use client";

import { useMemo } from "react";
import { usePermissions } from "@/contexts/PermissionContext";
import {
  ORG_PERMISSIONS,
  OrgRecordLike,
  toOrgRecord,
} from "@/lib/organizationPermissions";

export function useOrganizationPermissions(org?: OrgRecordLike | null) {
  const { can, isLoading, getScope } = usePermissions();

  const record = useMemo(() => toOrgRecord(org ?? undefined), [org]);

  const check = (permission: string, target?: OrgRecordLike | null) => {
    const scoped = toOrgRecord(target ?? org ?? undefined);
    return can(permission, scoped ? { record: scoped } : undefined);
  };

  return {
    isLoading,
    record,
    can,
    check,
    getScope,
    canListView: check(ORG_PERMISSIONS.LIST_VIEW),
    canCreate: check(ORG_PERMISSIONS.RECORD_CREATE),
    canViewRecord: (target?: OrgRecordLike | null) =>
      check(ORG_PERMISSIONS.RECORD_VIEW, target),
    canUpdate: (target?: OrgRecordLike | null) =>
      check(ORG_PERMISSIONS.RECORD_UPDATE, target),
    canDeleteRequest: (target?: OrgRecordLike | null) =>
      check(ORG_PERMISSIONS.DELETE_REQUEST, target),
    canDeleteApprove: check(ORG_PERMISSIONS.DELETE_APPROVE),
    canDeleteDeny: check(ORG_PERMISSIONS.DELETE_DENY),
    canViewDocuments: check(ORG_PERMISSIONS.DOCUMENTS_VIEW),
    canUploadDocuments: check(ORG_PERMISSIONS.DOCUMENTS_UPLOAD),
    canUpdateDocuments: check(ORG_PERMISSIONS.DOCUMENTS_UPDATE),
    canDeleteDocuments: check(ORG_PERMISSIONS.DOCUMENTS_DELETE),
    canViewInvoices: check(ORG_PERMISSIONS.INVOICES_VIEW),
    canTransferRequest: (target?: OrgRecordLike | null) =>
      check(ORG_PERMISSIONS.TRANSFER_REQUEST, target),
    canTransferApprove: check(ORG_PERMISSIONS.TRANSFER_APPROVE),
    canTransferDeny: check(ORG_PERMISSIONS.TRANSFER_DENY),
    canViewArchived: check(ORG_PERMISSIONS.ARCHIVED_VIEW),
    canBulkArchive: check(ORG_PERMISSIONS.BULK_ARCHIVE),
    canBulkDelete: check(ORG_PERMISSIONS.BULK_DELETE),
    canUnarchiveRequest: (target?: OrgRecordLike | null) =>
      check(ORG_PERMISSIONS.UNARCHIVE_REQUEST, target),
  };
}
