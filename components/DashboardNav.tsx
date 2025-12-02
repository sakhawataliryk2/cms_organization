"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUser, logout } from "@/lib/auth";
// Import icons from react-icons
import {
  FiHome,
  FiSearch,
  FiPlus,
  FiUsers,
  FiTarget,
  FiUserCheck,
  FiCalendar,
  FiCheckSquare,
  FiBarChart2,
  FiDollarSign,
  FiFile,
  FiSettings,
  FiBriefcase,
  FiGrid,
  FiX,
  FiLogOut,
} from "react-icons/fi";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { FaRegUserCircle } from "react-icons/fa";
import { ImDownload } from "react-icons/im";
import FileUpload from "./FileUpload";

interface User {
  name: string;
  email: string;
  userType: string;
}

interface SearchResults {
  jobs: any[];
  leads: any[];
  jobSeekers: any[];
  organizations: any[];
  tasks: any[];
}

export default function DashboardNav() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isFileUploadOpen, setIsFileUploadOpen] = useState<boolean>(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const pathname = usePathname();
  const router = useRouter();
  const addMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add menu items
  const addMenuItems = [
    {
      name: "Organization",
      path: "/dashboard/organizations/add",
      icon: <HiOutlineOfficeBuilding size={16} />,
    },
    {
      name: "Job",
      path: "/dashboard/jobs/add",
      icon: <FiBriefcase size={16} />,
    },
    {
      name: "Job Seeker",
      path: "/dashboard/job-seekers/add",
      icon: <FiUsers size={16} />,
    },
    {
      name: "Lead",
      path: "/dashboard/leads/add",
      icon: <FiTarget size={16} />,
    },
    {
      name: "Hiring Manager",
      path: "/dashboard/hiring-managers/add",
      icon: <FiUserCheck size={16} />,
    },
    {
      name: "Task",
      path: "/dashboard/tasks/add",
      icon: <FiCheckSquare size={16} />,
    },
    {
      name: "Placement",
      path: "/dashboard/placements/add",
      icon: <FiDollarSign size={16} />,
    },
  ];

  useEffect(() => {
    // Get user data
    const userData = getUser();
    if (userData) {
      setUser(userData);
    }
  }, []);

  // Global search with debouncing
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search query is empty or too short, clear results
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    // Set loading state
    setIsSearching(true);

    // Debounce search API call
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(searchQuery.trim())}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSearchResults(data.results);
          } else {
            setSearchResults(null);
          }
        } else {
          setSearchResults(null);
        }
      } catch (error) {
        console.error('Error performing global search:', error);
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(event.target as Node)
      ) {
        setIsAddMenuOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        // Don't close search on outside click, only clear query if needed
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      // Call logout API
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Use the updated logout utility function
      logout();

      // Use router for navigation
      router.push("/auth/login");
    } catch (error) {
      console.error("Logout error:", error);
      logout();
      router.push("/auth/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    if (isSearchOpen) {
      setSearchQuery("");
      setSearchResults(null);
    }
    // Close other menus if they're open
    if (isAddMenuOpen) {
      setIsAddMenuOpen(false);
    }
    if (isUserMenuOpen) {
      setIsUserMenuOpen(false);
    }
  };

  const toggleAddMenu = () => {
    setIsAddMenuOpen(!isAddMenuOpen);
    // Close other menus if they're open
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery("");
    }
    if (isUserMenuOpen) {
      setIsUserMenuOpen(false);
    }
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
    // Close other menus if they're open
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery("");
    }
    if (isAddMenuOpen) {
      setIsAddMenuOpen(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is handled in real-time via useEffect
    // If Enter is pressed, navigate to first result if available
    if (searchResults) {
      const allResults = [
        ...searchResults.jobs.map(j => ({ type: 'job', id: j.id, name: j.job_title || j.title })),
        ...searchResults.leads.map(l => ({ type: 'lead', id: l.id, name: l.first_name && l.last_name ? `${l.first_name} ${l.last_name}` : l.organization_name || l.name })),
        ...searchResults.jobSeekers.map(js => ({ type: 'jobSeeker', id: js.id, name: js.first_name && js.last_name ? `${js.first_name} ${js.last_name}` : js.name })),
        ...searchResults.organizations.map(o => ({ type: 'organization', id: o.id, name: o.name })),
        ...searchResults.tasks.map(t => ({ type: 'task', id: t.id, name: t.title || t.task_title }))
      ];
      
      if (allResults.length > 0) {
        navigateToResult(allResults[0].type, allResults[0].id);
      }
    }
  };

  const navigateToResult = (type: string, id: number) => {
    const pathMap: Record<string, string> = {
      job: `/dashboard/jobs/view?id=${id}`,
      lead: `/dashboard/leads/view?id=${id}`,
      jobSeeker: `/dashboard/job-seekers/view?id=${id}`,
      organization: `/dashboard/organizations/view?id=${id}`,
      task: `/dashboard/tasks/view?id=${id}`
    };
    const path = pathMap[type];
    if (path) {
      router.push(path);
      setSearchQuery("");
      setIsSearchOpen(false);
      setSearchResults(null);
    }
  };

  const getResultDisplayName = (item: any, type: string): string => {
    switch (type) {
      case 'job':
        return item.job_title || item.title || `Job #${item.id}`;
      case 'lead':
        if (item.first_name && item.last_name) {
          return `${item.first_name} ${item.last_name}`;
        }
        return item.organization_name || item.name || `Lead #${item.id}`;
      case 'jobSeeker':
        if (item.first_name && item.last_name) {
          return `${item.first_name} ${item.last_name}`;
        }
        return item.name || `Job Seeker #${item.id}`;
      case 'organization':
        return item.name || `Organization #${item.id}`;
      case 'task':
        return item.title || item.task_title || `Task #${item.id}`;
      default:
        return `Item #${item.id}`;
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'job':
        return <FiBriefcase size={16} />;
      case 'lead':
        return <FiTarget size={16} />;
      case 'jobSeeker':
        return <FiUsers size={16} />;
      case 'organization':
        return <HiOutlineOfficeBuilding size={16} />;
      case 'task':
        return <FiCheckSquare size={16} />;
      default:
        return <FiSearch size={16} />;
    }
  };

  const getTotalResultsCount = (results: SearchResults): number => {
    return (
      results.jobs.length +
      results.leads.length +
      results.jobSeekers.length +
      results.organizations.length +
      results.tasks.length
    );
  };

  const handleParseClick = () => {
    setIsFileUploadOpen(true);
  };

  // Navigation to add menu item
  const navigateToAddItem = (path: string) => {
    router.push(path);
    setIsAddMenuOpen(false);
  };

  // Handle Close All Tabs functionality
  const handleCloseAllTabs = () => {
    // In a real tab system, we might clear tab state here
    // For now, we'll just redirect to the home dashboard
    setIsUserMenuOpen(false);
    router.push("/dashboard");
  };

  // All navigation items without role-based filtering
  const navItems = [
    { name: "Home", path: "/home", icon: <FiHome size={20} /> },
    {
      name: "Organizations",
      path: "/dashboard/organizations",
      icon: <HiOutlineOfficeBuilding size={20} />,
    },
    { name: "Jobs", path: "/dashboard/jobs", icon: <FiBriefcase size={20} /> },
    {
      name: "Job Seekers",
      path: "/dashboard/job-seekers",
      icon: <FiUsers size={20} />,
    },
    { name: "Leads", path: "/dashboard/leads", icon: <FiTarget size={20} /> },
    {
      name: "Hiring Managers",
      path: "/dashboard/hiring-managers",
      icon: <FiUserCheck size={20} />,
    },
    {
      name: "Planner",
      path: "/dashboard/planner",
      icon: <FiCalendar size={20} />,
    },
    {
      name: "Tasks",
      path: "/dashboard/tasks",
      icon: <FiCheckSquare size={20} />,
    },
    {
      name: "Goals & Quotas",
      path: "/dashboard/goals",
      icon: <FiBarChart2 size={20} />,
    },
    {
      name: "Placements",
      path: "/dashboard/placements",
      icon: <FiDollarSign size={20} />,
    },
    {
      name: "Tearsheets",
      path: "/dashboard/tearsheets",
      icon: <FiFile size={20} />,
    },
    {
      name: "Admin Center",
      path: "/dashboard/admin",
      icon: <FiSettings size={20} />,
    },
    // { name: 'Profile', path: '/dashboard/profile', icon: <FaRegUserCircle size={20} /> },
    // { name: 'API', path: '/dashboard/api', icon: <FiGrid size={20} /> },
  ];

  // Filter navigation items based on search query
  const filteredNavItems = navItems.filter((item) => {
    if (!searchQuery.trim()) {
      return true; // Show all items when search is empty
    }
    const query = searchQuery.toLowerCase().trim();
    return (
      item.name.toLowerCase().includes(query) ||
      item.path.toLowerCase().includes(query)
    );
  });

  return (
    <>
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-slate-800 flex items-center justify-between z-10 pl-60 pr-4">
        <div className="flex items-center ml-4 space-x-4">
          {isSearchOpen ? (
            <div className="relative" ref={searchRef}>
              <form onSubmit={handleSearch} className="flex items-center">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="Search all records..."
                    className="bg-slate-700 text-white pl-8 pr-8 py-1 rounded w-96 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <FiSearch className="absolute left-2 text-gray-400" />
                  <button
                    type="button"
                    className="absolute right-2 text-gray-400 hover:text-white"
                    onClick={toggleSearch}
                  >
                    <FiX />
                  </button>
                </div>
              </form>
              
              {/* Global search results dropdown */}
              {searchQuery.trim() && searchQuery.trim().length >= 2 && (
                <div className="absolute top-full left-0 mt-1 w-96 bg-slate-800 rounded shadow-lg z-30 max-h-96 overflow-y-auto">
                  {isSearching ? (
                    <div className="px-4 py-8 text-center">
                      <div className="text-gray-400 text-sm">Searching...</div>
                    </div>
                  ) : searchResults && getTotalResultsCount(searchResults) > 0 ? (
                    <div className="py-1">
                      {/* Jobs */}
                      {searchResults.jobs.length > 0 && (
                        <div>
                          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-slate-700">
                            Jobs ({searchResults.jobs.length})
                          </div>
                          {searchResults.jobs.slice(0, 5).map((job) => (
                            <button
                              key={`job-${job.id}`}
                              type="button"
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                              onClick={() => navigateToResult('job', job.id)}
                            >
                              <span className="mr-3 text-blue-400">{getResultIcon('job')}</span>
                              <span className="flex-1 text-left truncate">{getResultDisplayName(job, 'job')}</span>
                            </button>
                          ))}
                          {searchResults.jobs.length > 5 && (
                            <div className="px-4 py-2 text-xs text-gray-400 text-center">
                              +{searchResults.jobs.length - 5} more jobs
                            </div>
                          )}
                        </div>
                      )}

                      {/* Leads */}
                      {searchResults.leads.length > 0 && (
                        <div>
                          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-slate-700">
                            Leads ({searchResults.leads.length})
                          </div>
                          {searchResults.leads.slice(0, 5).map((lead) => (
                            <button
                              key={`lead-${lead.id}`}
                              type="button"
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                              onClick={() => navigateToResult('lead', lead.id)}
                            >
                              <span className="mr-3 text-orange-400">{getResultIcon('lead')}</span>
                              <span className="flex-1 text-left truncate">{getResultDisplayName(lead, 'lead')}</span>
                            </button>
                          ))}
                          {searchResults.leads.length > 5 && (
                            <div className="px-4 py-2 text-xs text-gray-400 text-center">
                              +{searchResults.leads.length - 5} more leads
                            </div>
                          )}
                        </div>
                      )}

                      {/* Job Seekers */}
                      {searchResults.jobSeekers.length > 0 && (
                        <div>
                          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-slate-700">
                            Job Seekers ({searchResults.jobSeekers.length})
                          </div>
                          {searchResults.jobSeekers.slice(0, 5).map((js) => (
                            <button
                              key={`jobSeeker-${js.id}`}
                              type="button"
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                              onClick={() => navigateToResult('jobSeeker', js.id)}
                            >
                              <span className="mr-3 text-green-400">{getResultIcon('jobSeeker')}</span>
                              <span className="flex-1 text-left truncate">{getResultDisplayName(js, 'jobSeeker')}</span>
                            </button>
                          ))}
                          {searchResults.jobSeekers.length > 5 && (
                            <div className="px-4 py-2 text-xs text-gray-400 text-center">
                              +{searchResults.jobSeekers.length - 5} more job seekers
                            </div>
                          )}
                        </div>
                      )}

                      {/* Organizations */}
                      {searchResults.organizations.length > 0 && (
                        <div>
                          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-slate-700">
                            Organizations ({searchResults.organizations.length})
                          </div>
                          {searchResults.organizations.slice(0, 5).map((org) => (
                            <button
                              key={`organization-${org.id}`}
                              type="button"
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                              onClick={() => navigateToResult('organization', org.id)}
                            >
                              <span className="mr-3 text-purple-400">{getResultIcon('organization')}</span>
                              <span className="flex-1 text-left truncate">{getResultDisplayName(org, 'organization')}</span>
                            </button>
                          ))}
                          {searchResults.organizations.length > 5 && (
                            <div className="px-4 py-2 text-xs text-gray-400 text-center">
                              +{searchResults.organizations.length - 5} more organizations
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tasks */}
                      {searchResults.tasks.length > 0 && (
                        <div>
                          <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-slate-700">
                            Tasks ({searchResults.tasks.length})
                          </div>
                          {searchResults.tasks.slice(0, 5).map((task) => (
                            <button
                              key={`task-${task.id}`}
                              type="button"
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                              onClick={() => navigateToResult('task', task.id)}
                            >
                              <span className="mr-3 text-cyan-400">{getResultIcon('task')}</span>
                              <span className="flex-1 text-left truncate">{getResultDisplayName(task, 'task')}</span>
                            </button>
                          ))}
                          {searchResults.tasks.length > 5 && (
                            <div className="px-4 py-2 text-xs text-gray-400 text-center">
                              +{searchResults.tasks.length - 5} more tasks
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : searchQuery.trim().length >= 2 ? (
                    <div className="px-4 py-8 text-center">
                      <div className="text-gray-400 text-sm">
                        <p>No results found for</p>
                        <p className="font-medium mt-1">"{searchQuery}"</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <button
              className="flex items-center text-gray-300 hover:text-white"
              onClick={toggleSearch}
            >
              <FiSearch className="mr-1" />
              Find
            </button>
          )}

          {/* Add button with dropdown */}
          <div className="relative" ref={addMenuRef}>
            <button
              className="flex items-center text-gray-300 hover:text-white"
              onClick={toggleAddMenu}
            >
              <FiPlus className="mr-1" />
              Add
            </button>

            {/* Add dropdown menu */}
            {isAddMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 rounded shadow-lg py-1 z-20">
                {addMenuItems.map((item) => (
                  <button
                    key={item.path}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                    onClick={() => navigateToAddItem(item.path)}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* User profile with dropdown - Top Right */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              className="flex items-center space-x-2 text-gray-300 hover:text-white"
              onClick={toggleUserMenu}
            >
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white font-medium text-sm">
                {user.name.charAt(0)}
              </div>
              <span className="text-sm font-medium">{user.name}</span>
            </button>

            {/* User dropdown menu */}
            {isUserMenuOpen && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-slate-800 rounded shadow-lg py-1 z-20">
                <div className="px-4 py-2 border-b border-slate-700">
                  <div className="font-medium text-white text-sm">
                    {user.name}
                  </div>
                  <div className="text-xs text-gray-400 capitalize">
                    {user.userType}
                  </div>
                </div>
                <button
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                  onClick={handleCloseAllTabs}
                >
                  <FiX className="mr-2" size={16} />
                  <span>Close All Tabs</span>
                </button>
                <button
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  <FiLogOut className="mr-2" size={16} />
                  <span>{isLoggingOut ? "Logging out..." : "Log Out"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Side Navigation */}
      <div className="fixed top-0 left-0 bottom-0 w-60 bg-slate-800 text-white z-20 flex flex-col">
        {/* Logo area */}
        <div className="h-12 flex items-center px-4 my-4">
          <span className="text-sm font-semibold ">
            Complete Staffing Solutions
          </span>
        </div>

        {/* Navigation links - filtered by search */}
        <div className="overflow-y-auto">
          {filteredNavItems.length > 0 ? (
            filteredNavItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => {
                  // Close search when navigating to an item
                  if (isSearchOpen) {
                    setSearchQuery("");
                    setIsSearchOpen(false);
                  }
                }}
                className={`flex items-center py-2 px-4 ${
                  pathname === item.path
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-slate-700"
                }`}
              >
                <div className="w-6 h-6 mr-3 flex-shrink-0 flex items-center justify-center">
                  {item.icon}
                </div>
                {item.name}
              </Link>
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <div className="text-gray-400 text-sm">
                {searchQuery.trim() ? (
                  <>
                    <p>No results found for</p>
                    <p className="font-medium mt-1">"{searchQuery}"</p>
                  </>
                ) : (
                  <p>No navigation items</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Flexible spacer */}
        <div className="flex-grow"></div>

        {/* Footer with "Parse" button - always visible */}
        <div className="p-4 border-t border-slate-700 mt-auto">
          <div className="flex justify-between items-center">
            <span className="text-blue-300 text-sm">Parse</span>
            <button
              className="text-white bg-slate-700 p-1 rounded hover:bg-slate-600"
              onClick={handleParseClick}
            >
              <ImDownload size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* File upload modal */}
      <FileUpload
        isOpen={isFileUploadOpen}
        onClose={() => setIsFileUploadOpen(false)}
      />
    </>
  );
}
