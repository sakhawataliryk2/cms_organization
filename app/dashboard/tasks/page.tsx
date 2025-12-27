'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import LoadingScreen from '@/components/LoadingScreen';
import { useHeaderConfig } from "@/hooks/useHeaderConfig";

interface Task {
    id: string;
    title: string;
    description?: string;
    is_completed: boolean;
    due_date?: string;
    due_time?: string;
    job_seeker_name?: string;
    hiring_manager_name?: string;
    job_title?: string;
    lead_name?: string;
    placement_id?: string;
    owner?: string;
    priority: string;
    status: string;
    created_by_name?: string;
    assigned_to_name?: string;
    created_at: string;
}

export default function TaskList() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<string>('created_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [openActionId, setOpenActionId] = useState<string | null>(null);
     const DEFAULT_TASK_COLUMNS: string[] = [
       "completed",
       "due",
       "job_seeker",
       "hiring_manager",
       "job",
       "lead",
       "placement",
       "owner",
     ];

     const taskColumnsCatalog = [
       { key: "completed", label: "Completed?" },
       { key: "due", label: "Due Date & Time" },
       { key: "job_seeker", label: "Job Seeker" },
       { key: "hiring_manager", label: "Hiring Manager" },
       { key: "job", label: "Job" },
       { key: "lead", label: "Lead" },
       { key: "placement", label: "Placement" },
       { key: "owner", label: "Owner" },
       { key: "priority", label: "Priority" },
       { key: "status", label: "Status" },
       { key: "title", label: "Title" },
     ];

     const getColumnLabel = (key: string) =>
       taskColumnsCatalog.find((c) => c.key === key)?.label ?? key;

     const getColumnValue = (task: Task, key: string) => {
       switch (key) {
         case "completed":
           return task.is_completed ? "Yes" : "No";
         case "due":
           return formatDateTime(task.due_date, task.due_time) || "Not set";
         case "job_seeker":
           return task.job_seeker_name || "Not specified";
         case "hiring_manager":
           return task.hiring_manager_name || "Not specified";
         case "job":
           return task.job_title || "Not specified";
         case "lead":
           return task.lead_name || "Not specified";
         case "placement":
           return task.placement_id || "Not specified";
         case "owner":
           return task.owner || task.created_by_name || "Unknown";
         case "priority":
           return task.priority || "N/A";
         case "status":
           return task.status || "N/A";
         case "title":
           return task.title || "N/A";
         default:
           return "—";
       }
     };
     const {
       columnFields,
       setColumnFields,
       showHeaderFieldModal: showColumnModal,
       setShowHeaderFieldModal: setShowColumnModal,
       saveHeaderConfig: saveColumnConfig,
       isSaving: isSavingColumns,
     } = useHeaderConfig({
       entityType: "TASK",
       configType: "columns",
       defaultFields: DEFAULT_TASK_COLUMNS,
     });


    // Fetch tasks data when component mounts
    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/tasks', {
                headers: {
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch tasks');
            }

            const data = await response.json();
            console.log('Tasks data:', data);
            setTasks(data.tasks || []);
        } catch (err) {
            console.error('Error fetching tasks:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while fetching tasks');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredTasks = tasks.filter(
        (task) =>
            (task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.id?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.owner?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.job_seeker_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.hiring_manager_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
            (task.lead_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    );

    // Sort tasks
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        let aValue: any = a[sortField as keyof Task];
        let bValue: any = b[sortField as keyof Task];

        // Handle null/undefined values
        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        // Convert to strings for comparison
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();

        if (sortDirection === 'asc') {
            return aStr.localeCompare(bStr);
        } else {
            return bStr.localeCompare(aStr);
        }
    });

    const handleViewTask = (id: string) => {
        router.push(`/dashboard/tasks/view?id=${id}`);
    };

    const handleAddTask = () => {
        router.push('/dashboard/tasks/add');
    };

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (field: string) => {
        if (sortField !== field) return '↕️';
        return sortDirection === 'asc' ? '↑' : '↓';
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedTasks([]);
        } else {
            setSelectedTasks(sortedTasks.map(task => task.id));
        }
        setSelectAll(!selectAll);
    };

    const handleSelectTask = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click event

        if (selectedTasks.includes(id)) {
            setSelectedTasks(selectedTasks.filter(taskId => taskId !== id));
            if (selectAll) setSelectAll(false);
        } else {
            setSelectedTasks([...selectedTasks, id]);
            // If all tasks are now selected, update selectAll state
            if ([...selectedTasks, id].length === sortedTasks.length) {
                setSelectAll(true);
            }
        }
    };

    const deleteSelectedTasks = async () => {
        if (selectedTasks.length === 0) return;

        const confirmMessage = selectedTasks.length === 1
            ? 'Are you sure you want to delete this task?'
            : `Are you sure you want to delete these ${selectedTasks.length} tasks?`;

        if (!window.confirm(confirmMessage)) return;

        setIsLoading(true);

        try {
            // Create promises for all delete operations
            const deletePromises = selectedTasks.map(id =>
                fetch(`/api/tasks/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                    }
                })
            );

            // Execute all delete operations
            const results = await Promise.allSettled(deletePromises);

            // Check for failures
            const failures = results.filter(result => result.status === 'rejected');

            if (failures.length > 0) {
                throw new Error(`Failed to delete ${failures.length} tasks`);
            }

            // Refresh tasks after successful deletion
            await fetchTasks();

            // Clear selection after deletion
            setSelectedTasks([]);
            setSelectAll(false);
        } catch (err) {
            console.error('Error deleting tasks:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while deleting tasks');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTaskComplete = async (taskId: string, isCompleted: boolean) => {
        if (!taskId) {
            console.error('Task ID is required');
            return;
        }

        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1")}`
                },
                body: JSON.stringify({
                    isCompleted: !isCompleted,
                    status: !isCompleted ? 'Completed' : 'Pending'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to update task');
            }

            // Refresh tasks
            await fetchTasks();
        } catch (err) {
            console.error('Error updating task:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while updating the task');
        }
    };

    const formatDateTime = (date?: string, time?: string) => {
        if (!date) return '';

        try {
            const dateObj = new Date(date);
            let formatted = new Intl.DateTimeFormat('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric'
            }).format(dateObj);

            if (time) {
                formatted += ` ${time}`;
            }

            return formatted;
        } catch (error) {
            console.error('Error formatting date:', error);
            return '';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'in progress':
                return 'bg-blue-100 text-blue-800';
            case 'overdue':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority.toLowerCase()) {
            case 'high':
                return 'bg-red-100 text-red-800';
            case 'medium':
                return 'bg-yellow-100 text-yellow-800';
            case 'low':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (isLoading) {
        return <LoadingScreen message="Loading tasks..." />;
    }

    return (
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold">Tasks</h1>
          <div className="flex space-x-4">
            {selectedTasks.length > 0 && (
              <button
                onClick={deleteSelectedTasks}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Delete Selected ({selectedTasks.length})
              </button>
            )}
            <button
              onClick={() => setShowColumnModal(true)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 flex items-center"
            >
              Columns
            </button>
            <button
              onClick={handleAddTask}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Add Task
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
            <p>{error}</p>
          </div>
        )}

        {/* Search and Filter */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search tasks..."
              className="w-full p-2 pl-10 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* Fixed checkbox */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                </th>

                {/* Fixed Actions */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>

                {/* Fixed ID */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort("id")}
                    className="hover:text-gray-700"
                  >
                    ID
                  </button>
                </th>

                {/* Dynamic */}
                {columnFields.map((key) => (
                  <th
                    key={key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {getColumnLabel(key)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTasks.length > 0 ? (
                sortedTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleViewTask(task.id)}
                  >
                    {/* Fixed checkbox */}
                    <td
                      className="px-6 py-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        checked={selectedTasks.includes(task.id)}
                        onChange={() => {}}
                        onClick={(e) => handleSelectTask(task.id, e)}
                      />
                    </td>

                    {/* Fixed Actions dropdown */}
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionId((prev) =>
                              prev === task.id ? null : task.id
                            );
                          }}
                        >
                          Actions ▾
                        </button>

                        {openActionId === task.id && (
                          <div
                            className="absolute left-0 mt-2 w-44 rounded border bg-white shadow-lg z-[9999] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex flex-col">
                              <button
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenActionId(null);
                                  handleViewTask(task.id);
                                }}
                              >
                                View
                              </button>

                              <button
                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setOpenActionId(null);

                                  if (
                                    !window.confirm(
                                      "Are you sure you want to delete this task?"
                                    )
                                  )
                                    return;

                                  setIsLoading(true);
                                  try {
                                    const token = document.cookie
                                      .split("; ")
                                      .find((row) => row.startsWith("token="))
                                      ?.split("=")[1];

                                    const res = await fetch(
                                      `/api/tasks/${task.id}`,
                                      {
                                        method: "DELETE",
                                        headers: token
                                          ? { Authorization: `Bearer ${token}` }
                                          : undefined,
                                      }
                                    );

                                    if (!res.ok)
                                      throw new Error("Failed to delete task");
                                    await fetchTasks();
                                  } catch (err) {
                                    setError(
                                      err instanceof Error
                                        ? err.message
                                        : "Delete failed"
                                    );
                                  } finally {
                                    setIsLoading(false);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Fixed ID */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        T {task.id}
                      </div>
                    </td>

                    {/* Dynamic cells */}
                    {columnFields.map((key) => (
                      <td
                        key={key}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      >
                        {key === "completed" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTaskComplete(task.id, task.is_completed);
                            }}
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              task.is_completed
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                            }`}
                          >
                            {task.is_completed ? "✓ Yes" : "○ No"}
                          </button>
                        ) : key === "priority" ? (
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(
                              task.priority
                            )}`}
                          >
                            {getColumnValue(task, key)}
                          </span>
                        ) : key === "status" ? (
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                              task.status
                            )}`}
                          >
                            {getColumnValue(task, key)}
                          </span>
                        ) : (
                          getColumnValue(task, key)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3 + columnFields.length}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center"
                  >
                    {searchTerm
                      ? "No tasks found matching your search."
                      : 'No tasks found. Click "Add Task" to create one.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              Previous
            </button>
            <button className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to{" "}
                <span className="font-medium">{sortedTasks.length}</span> of{" "}
                <span className="font-medium">{sortedTasks.length}</span>{" "}
                results
              </p>
            </div>
          </div>
        </div>
        {showColumnModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">Customize Columns</h2>
                <button
                  onClick={() => setShowColumnModal(false)}
                  className="p-1 rounded hover:bg-gray-200"
                >
                  <span className="text-2xl font-bold">×</span>
                </button>
              </div>

              <div className="p-6 grid grid-cols-2 gap-6">
                {/* Available */}
                <div>
                  <h3 className="font-medium mb-3">Available Columns</h3>
                  <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                    {taskColumnsCatalog.map((c) => {
                      const checked = columnFields.includes(c.key);
                      return (
                        <label
                          key={c.key}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setColumnFields((prev) => {
                                if (prev.includes(c.key))
                                  return prev.filter((x) => x !== c.key);
                                return [...prev, c.key];
                              });
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-800">
                            {c.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Order */}
                <div>
                  <h3 className="font-medium mb-3">Column Order</h3>
                  <div className="border rounded p-3 max-h-[60vh] overflow-auto space-y-2">
                    {columnFields.length === 0 ? (
                      <div className="text-sm text-gray-500 italic">
                        No columns selected
                      </div>
                    ) : (
                      columnFields.map((key, idx) => (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div className="text-sm font-medium">
                            {getColumnLabel(key)}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                              disabled={idx === 0}
                              onClick={() => {
                                setColumnFields((prev) => {
                                  const copy = [...prev];
                                  [copy[idx - 1], copy[idx]] = [
                                    copy[idx],
                                    copy[idx - 1],
                                  ];
                                  return copy;
                                });
                              }}
                            >
                              ↑
                            </button>

                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-40"
                              disabled={idx === columnFields.length - 1}
                              onClick={() => {
                                setColumnFields((prev) => {
                                  const copy = [...prev];
                                  [copy[idx], copy[idx + 1]] = [
                                    copy[idx + 1],
                                    copy[idx],
                                  ];
                                  return copy;
                                });
                              }}
                            >
                              ↓
                            </button>

                            <button
                              className="px-2 py-1 border rounded text-xs hover:bg-gray-50"
                              onClick={() =>
                                setColumnFields((prev) =>
                                  prev.filter((x) => x !== key)
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      className="px-4 py-2 border rounded hover:bg-gray-50"
                      onClick={() => setColumnFields(DEFAULT_TASK_COLUMNS)}
                    >
                      Reset
                    </button>

                    <button
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      disabled={!!isSavingColumns}
                      onClick={async () => {
                        const ok = await saveColumnConfig();
                        if (ok !== false) setShowColumnModal(false);
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
}