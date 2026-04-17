'use client';

import React, { memo } from 'react';
import { formatNoteDateTime, getNoteDateTimeValue } from '@/lib/noteUtils';

export interface ActivityReportRow {
  key: string;
  categoryLabel: string;
  userLabel?: string;
  userId?: string;
  notesCount: number;
  addedToSystem: number;
  inboundEmails: number;
  outboundEmails: number;
  calls: number;
  texts: number;
}

export interface ActivityReportGridProps {
  title?: string;
  subtitle?: string;
  headerExtra?: React.ReactNode;
  rows: ActivityReportRow[];
  loading?: boolean;
  error?: string | null;
  loadingDetails?: boolean;
  onNotesClick: (row: ActivityReportRow) => void;
  onRecordsClick: (row: ActivityReportRow) => void;
  notesModalOpen: boolean;
  notesDetails: { category: string; userLabel?: string; notes: any[] } | null;
  recordsModalOpen: boolean;
  recordsDetails: { category: string; userLabel?: string; records: any[] } | null;
  onCloseNotes: () => void;
  onCloseRecords: () => void;
  userDisplayName?: string;
}

const CATEGORY_ROW_CLASSES = 'flex border-b border-gray-300 last:border-b-0';
const CELL_BASE = 'text-sm text-gray-800 text-center';
const HEADER_ROW = (
  <div className="flex bg-gray-50 border-b border-gray-300">
    <div className="w-32 p-3 border-r border-gray-300 shrink-0" />
    <div className="w-24 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 shrink-0">Notes</div>
    <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 shrink-0"><div>Goals</div></div>
    <div className="w-32 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 shrink-0">Added to System</div>
    <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 shrink-0"><div>Goals</div></div>
    <div className="w-28 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 shrink-0">Inbound emails</div>
    <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 shrink-0"><div>Goals</div></div>
    <div className="w-28 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 shrink-0">Outbound emails</div>
    <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 shrink-0"><div>Goals</div></div>
    <div className="w-16 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 shrink-0">Calls</div>
    <div className="w-20 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 shrink-0"><div>Goals</div></div>
    <div className="w-16 p-3 text-sm font-medium text-gray-700 shrink-0">Texts</div>
  </div>
);

export const ActivityReportGrid = memo(function ActivityReportGrid({
  title = 'ACTIVITY REPORT',
  subtitle,
  headerExtra,
  rows,
  loading = false,
  error = null,
  loadingDetails = false,
  onNotesClick,
  onRecordsClick,
  notesModalOpen,
  notesDetails,
  recordsModalOpen,
  recordsDetails,
  onCloseNotes,
  onCloseRecords,
  userDisplayName,
}: ActivityReportGridProps) {
  return (
    <div className="px-6 pb-6 mt-8">
      <div className="mb-4">
        <div className={headerExtra ? 'flex items-center justify-between flex-wrap gap-2' : ''}>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
            {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
            {loading && <div className="text-xs text-gray-500 mt-1">Refreshing...</div>}
          </div>
          {headerExtra}
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        {HEADER_ROW}
        {rows.map((row, index) => (
          <div
            key={row.key}
            className={`${CATEGORY_ROW_CLASSES} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
          >
            <div className="w-32 p-3 border-r border-gray-300 text-sm font-medium text-gray-700 shrink-0">
              {row.userLabel ? `${row.userLabel} / ${row.categoryLabel}` : row.categoryLabel}
            </div>
            <div className="w-24 p-3 border-r border-gray-300 shrink-0">
              <div className={CELL_BASE}>
                {loading ? '…' : (
                  <button
                    type="button"
                    onClick={() => onNotesClick(row)}
                    className="text-blue-600 hover:text-blue-800 underline font-medium disabled:cursor-not-allowed"
                    disabled={loadingDetails}
                  >
                    {row.notesCount ?? 0}
                  </button>
                )}
              </div>
            </div>
            <div className="w-20 p-3 border-r border-gray-300 shrink-0"><div className="text-xs text-gray-500 text-center">--</div></div>
            <div className="w-32 p-3 border-r border-gray-300 shrink-0">
              <div className={CELL_BASE}>
                {loading ? '…' : (
                  <button
                    type="button"
                    onClick={() => onRecordsClick(row)}
                    className="text-blue-600 hover:text-blue-800 underline font-medium disabled:cursor-not-allowed"
                    disabled={loadingDetails}
                  >
                    {row.addedToSystem ?? 0}
                  </button>
                )}
              </div>
            </div>
            <div className="w-20 p-3 border-r border-gray-300 shrink-0"><div className="text-xs text-gray-500 text-center">--</div></div>
            <div className="w-28 p-3 border-r border-gray-300 shrink-0"><div className={CELL_BASE}>{loading ? '…' : (row.inboundEmails ?? 0)}</div></div>
            <div className="w-20 p-3 border-r border-gray-300 shrink-0"><div className="text-xs text-gray-500 text-center">--</div></div>
            <div className="w-28 p-3 border-r border-gray-300 shrink-0"><div className={CELL_BASE}>{loading ? '…' : (row.outboundEmails ?? 0)}</div></div>
            <div className="w-20 p-3 border-r border-gray-300 shrink-0"><div className="text-xs text-gray-500 text-center">--</div></div>
            <div className="w-16 p-3 border-r border-gray-300 shrink-0"><div className={CELL_BASE}>{loading ? '…' : (row.calls ?? 0)}</div></div>
            <div className="w-20 p-3 border-r border-gray-300 shrink-0"><div className="text-xs text-gray-500 text-center">--</div></div>
            <div className="w-16 p-3 shrink-0"><div className={CELL_BASE}>{loading ? '…' : (row.texts ?? 0)}</div></div>
          </div>
        ))}
      </div>

      {notesModalOpen && notesDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999">
          <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Notes - {notesDetails.category}
                {notesDetails.userLabel ? ` - ${notesDetails.userLabel}` : ''}
                {userDisplayName ? ` - ${userDisplayName}` : ''}
              </h2>
              <button type="button" onClick={onCloseNotes} className="p-1 rounded hover:bg-gray-200"><span className="text-2xl font-bold">×</span></button>
            </div>
            <div className="p-6">
              {loadingDetails ? (
                <p className="text-gray-500 text-center py-8">Loading notes...</p>
              ) : notesDetails.notes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No notes found for this category and date range.</p>
              ) : (
                <div className="space-y-3">
                  {notesDetails.notes.map((note: any, idx: number) => (
                    <div key={note.id || idx} className="border border-gray-200 rounded p-4">
                      <div className="text-sm font-medium text-gray-900">{note._entityName}</div>
                      <div className="text-sm text-gray-700 mt-2">{note.text || note.note || '(No text)'}</div>
                      {getNoteDateTimeValue(note) && (
                        <div className="text-xs text-gray-500 mt-2">Note date: {formatNoteDateTime(note)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-600">Total: {notesDetails.notes.length} note(s)</div>
              <button type="button" onClick={onCloseNotes} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium">Close</button>
            </div>
          </div>
        </div>
      )}

      {recordsModalOpen && recordsDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-999">
          <div className="bg-white rounded shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {recordsDetails.category} Records
                {recordsDetails.userLabel ? ` - ${recordsDetails.userLabel}` : ''}
                {userDisplayName ? ` - ${userDisplayName}` : ''}
              </h2>
              <button type="button" onClick={onCloseRecords} className="p-1 rounded hover:bg-gray-200"><span className="text-2xl font-bold">×</span></button>
            </div>
            <div className="p-6">
              {loadingDetails ? (
                <p className="text-gray-500 text-center py-8">Loading records...</p>
              ) : recordsDetails.records.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No records found for this category and date range.</p>
              ) : (
                <div className="space-y-4">
                  {recordsDetails.records.map((record: any, index: number) => (
                    <div key={record.id || index} className="border border-gray-200 rounded p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {record.name || record.job_title || record.full_name || `${recordsDetails.category} #${record.id}`}
                          </h3>
                          {record.email && <p className="text-sm text-gray-600">{record.email}</p>}
                          {record.organization_name && <p className="text-sm text-gray-600">{record.organization_name}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-600">Total: {recordsDetails.records.length} record(s)</div>
              <button type="button" onClick={onCloseRecords} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-medium">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
