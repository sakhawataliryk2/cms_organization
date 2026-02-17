// app/dashboard/admin/activity-tracker/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { FiActivity, FiArrowLeft } from 'react-icons/fi';

export default function ActivityTrackerPage() {
  const router = useRouter();

  return (
    <div className="bg-gray-200 min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push('/dashboard/admin')}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900 mb-6"
        >
          <FiArrowLeft size={20} />
          Back to Admin Center
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-black flex items-center justify-center rounded-sm">
              <FiActivity size={32} color="white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Activity Tracker</h1>
              <p className="text-gray-500 text-sm">Per-person activity overview and export</p>
            </div>
          </div>

          <p className="text-gray-600 mb-6">
            Activity Tracker will break down system usage <strong>by person</strong>: what each user
            views, creates, updates, and does in the system, with an overview of their performance
            and an <strong>exportable Excel</strong> report.
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Planned flow
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-600 text-sm">
              <li>
                <strong>Capture</strong> — Frontend and/or backend records each significant action
                (page views, creates, updates, key clicks).
              </li>
              <li>
                <strong>Store</strong> — Activity/audit table queryable by user, date range, action
                type, entity type.
              </li>
              <li>
                <strong>Admin UI</strong> — Select person and date range; view timeline and summary
                (counts by action and entity); <strong>Export to Excel</strong> (raw list +
                summary sheet).
              </li>
            </ol>
          </div>

          <p className="text-sm text-gray-500">
            Full flow and implementation phases are documented in{' '}
            <code className="bg-gray-100 px-1 rounded">docs/activity-tracker-flow.md</code>. This
            page will be replaced with the full Activity Tracker UI once backend and capture are in
            place.
          </p>
        </div>
      </div>
    </div>
  );
}
