"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { getUser, logout } from "@/lib/auth";
import {
  type PinnedRecord,
  loadPinnedRecords,
  PINNED_RECORDS_CHANGED_EVENT,
  unpinRecord,
  pinRecord,
  buildPinnedKey,
  savePinnedRecords,
  dispatchPinnedRecordsChanged,
} from "@/lib/pinnedRecords";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// Import icons from react-icons
import {
  FiHome,
  FiSearch,
  FiPlus,
  FiUsers,
  FiUser,
  FiTarget,
  FiUserCheck,
  FiCalendar,
  FiCheckSquare,
  FiBarChart2,
  FiDollarSign,
  FiFile,
  FiSettings,
  FiBriefcase,
  FiMessageSquare,
  FiGrid,
  FiX,
  FiLogOut,
  FiUpload,
  FiMenu,
} from "react-icons/fi";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { FaRegUserCircle } from "react-icons/fa";

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
  hiringManagers?: any[];
  placements?: any[];
}

interface RecentSearch {
  type: string;
  id: number;
  name: string;
  url: string;
  timestamp: number;
}

function SortablePinnedTab({
  record,
  isActive,
  onClick,
  onUnpin
}: {
  record: PinnedRecord;
  isActive: boolean;
  onClick: () => void;
  onUnpin: (e: React.MouseEvent) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: record.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    ...(isActive
      ? {
        backgroundColor: "#16a34a",
        color: "#ffffff",
        ["--tabs-selected-bg-color" as any]: "#16a34a",
        ["--tabs-selected-text-color" as any]: "#ffffff",
      }
      : {
        backgroundColor: "rgb(29 41 61)",
        color: "rgb(255, 255, 255)",
      })
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      type="button"
      className={`sd-tab-label is-pinned ${isActive ? "is-active" : "hover:bg-slate-200"} transition-colors cursor-grab active:cursor-grabbing`}
      onClick={onClick}
    >
      <div className="sd-tab-desc">{String(record.label || "")}</div>
      <span
        className="sd-tab-icon sd-tab-close"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onUnpin}
        title="Unpin"
      >
        <FiX size={14} />
      </span>
    </button>
  );
}

export default function DashboardNav() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  const [pinnedRecords, setPinnedRecords] = useState<PinnedRecord[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setPinnedRecords((items) => {
        const oldIndex = items.findIndex((item) => item.key === active.id);
        const newIndex = items.findIndex((item) => item.key === over?.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        // Save to storage
        savePinnedRecords(newItems);
        // dispatchPinnhanged(); // Avoid double update in same window
        return newItems;
      });
    }
  };

  const [showTbiQuickTab, setShowTbiQuickTab] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const addMenuRef = useRef<HTMLDivElement>(null);
  const addMenuDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [addMenuPosition, setAddMenuPosition] = useState<{ top: number; left: number } | null>(null);

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

  // Functions to manage recent searches
  const loadRecentSearches = (): RecentSearch[] => {
    try {
      const stored = localStorage.getItem("recentSearches");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error("Error loading recent searches:", error);
    }
    return [];
  };

  const saveRecentSearches = (searches: RecentSearch[]) => {
    try {
      localStorage.setItem("recentSearches", JSON.stringify(searches));
    } catch (error) {
      console.error("Error saving recent searches:", error);
    }
  };

  const addRecentSearch = (type: string, id: number, name: string, url: string) => {
    const newSearch: RecentSearch = {
      type,
      id,
      name,
      url,
      timestamp: Date.now(),
    };

    setRecentSearches((prev) => {
      // Remove duplicate if exists (same type and id)
      const filtered = prev.filter(
        (s) => !(s.type === type && s.id === id)
      );
      // Add new search at the beginning
      const updated = [newSearch, ...filtered].slice(0, 7); // Keep only last 7
      saveRecentSearches(updated);
      return updated;
    });
  };

  const removeRecentSearch = (type: string, id: number) => {
    setRecentSearches((prev) => {
      const updated = prev.filter(
        (s) => !(s.type === type && s.id === id)
      );
      saveRecentSearches(updated);
      return updated;
    });
  };

  useEffect(() => {
    // Get user data
    const userData = getUser();
    if (userData) {
      setUser(userData);
    }
    // Load recent searches
    setRecentSearches(loadRecentSearches());
  }, []);

  const hasQuickTabs = showTbiQuickTab || pinnedRecords.length > 0;

  // Keep layout padding in sync with whether the quick-tab strip is visible
  useEffect(() => {
    if (typeof document === "undefined") return;
    const nextOffset = hasQuickTabs ? "88px" : "48px"; // 40px bar + 48px top bar
    document.documentElement.style.setProperty("--dashboard-top-offset", nextOffset);
    return () => {
      // Restore default when component unmounts
      document.documentElement.style.setProperty("--dashboard-top-offset", "48px");
    };
  }, [hasQuickTabs]);

  // Listen for pinned records changes and update bar accordingly
  useEffect(() => {
    const syncPinned = () => {
      try {
        // Back-compat: migrate legacy single pinnedOrg into pinnedRecords (once)
        const legacyRaw = localStorage.getItem("pinnedOrg");
        if (legacyRaw) {
          const legacy = JSON.parse(legacyRaw) as { id: string; name: string };
          const key = buildPinnedKey("org", legacy.id);
          pinRecord({
            key,
            label: legacy.name || "Organization",
            url: `/dashboard/organizations/view?id=${legacy.id}`,
          });
          localStorage.removeItem("pinnedOrg");
        }

        setPinnedRecords(loadPinnedRecords());
      } catch {
        // Ignore JSON errors
      }
    };

    // Initial sync
    syncPinned();
    window.addEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
    return () => window.removeEventListener(PINNED_RECORDS_CHANGED_EVENT, syncPinned);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("showTbiQuickTab");
      setShowTbiQuickTab(raw === "1");
    } catch {
      // ignore
    }
  }, []);

  // Global search with debouncing
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search query is empty, clear results
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    // Allow single character searches (especially for numeric IDs)
    // Minimum length check removed to allow searching for IDs like "8"

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
          // Try to get error message from response
          try {
            const errorData = await response.json();
            console.error('Search API error:', errorData.message || 'Unknown error');
          } catch (e) {
            console.error('Search API error:', response.status, response.statusText);
          }
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
      // Close Add menu if clicking outside
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(event.target as Node) &&
        addMenuDropdownRef.current &&
        !addMenuDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAddMenuOpen(false);
      }
      
      // Close User menu if clicking outside
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
      
      // Close Search dropdown if clicking outside
      if (
        isSearchOpen &&
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
        // Optionally clear search query when closing - commented out to preserve query
        // setSearchQuery("");
        // setSearchResults(null);
      }
    }

    // Only add listener if any menu is open
    if (isAddMenuOpen || isUserMenuOpen || isSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAddMenuOpen, isUserMenuOpen, isSearchOpen]);

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
  };

  // Calculate dropdown position when menu opens
  useLayoutEffect(() => {
    if (isAddMenuOpen && addMenuRef.current) {
      const rect = addMenuRef.current.getBoundingClientRect();
      setAddMenuPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    } else {
      setAddMenuPosition(null);
    }
  }, [isAddMenuOpen]);

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

  const goToPinned = (url: string) => {
    router.push(url);
  };

  const openTbiQuickTab = () => {
    try {
      localStorage.setItem("showTbiQuickTab", "1");
    } catch {
      // ignore
    }
    setShowTbiQuickTab(true);
    router.push("/dashboard/tbi");
  };

  const closeTbiQuickTab = () => {
    try {
      localStorage.removeItem("showTbiQuickTab");
    } catch {
      // ignore
    }
    setShowTbiQuickTab(false);
    if (pathname === "/dashboard/tbi") {
      router.push("/dashboard");
    }
  };
  const searchParams = useSearchParams();

  useEffect(() => {
    setCurrentUrl(
      `${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`
    );
  }, [pathname, searchParams]);


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
        ...searchResults.tasks.map(t => ({ type: 'task', id: t.id, name: t.title || t.task_title })),
        ...(searchResults.hiringManagers || []).map(hm => ({ type: 'hiringManager', id: hm.id, name: hm.first_name && hm.last_name ? `${hm.first_name} ${hm.last_name}` : hm.name })),
        ...(searchResults.placements || []).map(p => ({ type: 'placement', id: p.id, name: p.job_title || `Placement ${p.id}` }))
      ];

      if (allResults.length > 0) {
        // Find the actual item from searchResults
        const firstResult = allResults[0];
        let item: any = null;
        if (firstResult.type === 'job') {
          item = searchResults.jobs.find(j => j.id === firstResult.id);
        } else if (firstResult.type === 'lead') {
          item = searchResults.leads.find(l => l.id === firstResult.id);
        } else if (firstResult.type === 'jobSeeker') {
          item = searchResults.jobSeekers.find(js => js.id === firstResult.id);
        } else if (firstResult.type === 'organization') {
          item = searchResults.organizations.find(o => o.id === firstResult.id);
        } else if (firstResult.type === 'task') {
          item = searchResults.tasks.find(t => t.id === firstResult.id);
        } else if (firstResult.type === 'hiringManager') {
          item = searchResults.hiringManagers?.find(hm => hm.id === firstResult.id);
        } else if (firstResult.type === 'placement') {
          item = searchResults.placements?.find(p => p.id === firstResult.id);
        }
        navigateToResult(firstResult.type, firstResult.id, item);
      }
    }
  };

  const navigateToResult = (type: string, id: number, item?: any) => {
    const pathMap: Record<string, string> = {
      job: `/dashboard/jobs/view?id=${id}`,
      lead: `/dashboard/leads/view?id=${id}`,
      jobSeeker: `/dashboard/job-seekers/view?id=${id}`,
      organization: `/dashboard/organizations/view?id=${id}`,
      task: `/dashboard/tasks/view?id=${id}`,
      hiringManager: `/dashboard/hiring-managers/view?id=${id}`,
      placement: `/dashboard/placements/view?id=${id}`
    };
    const path = pathMap[type];
    if (path) {
      // Save to recent searches
      const displayName = item ? getResultDisplayName(item, type) : `${type} ${id}`;
      addRecentSearch(type, id, displayName, path);
      
      router.push(path);
      setSearchQuery("");
      setIsSearchOpen(false);
      setSearchResults(null);
    }
  };

  const getResultDisplayName = (item: any, type: string): string => {
    const formatId = (id: number | string, prefix: string) => {
      if (!id && id !== 0) return '';
      return `${prefix}${id}`;
    };

    switch (type) {
      case 'job':
        return item.job_title || item.title || `Job ${formatId(item.id, 'J')}`;
      case 'lead':
        if (item.first_name && item.last_name) {
          return `${item.first_name} ${item.last_name}`;
        }
        return item.organization_name || item.name || `Lead ${formatId(item.id, 'L')}`;
      case 'jobSeeker':
        if (item.first_name && item.last_name) {
          return `${item.first_name} ${item.last_name}`;
        }
        return item.name || `Job Seeker ${formatId(item.id, 'JS')}`;
      case 'organization':
        return item.name || `Organization ${formatId(item.id, 'O')}`;
      case 'task':
        return item.title || item.task_title || `Task ${formatId(item.id, 'T')}`;
      case 'hiringManager':
        if (item.first_name && item.last_name) {
          return `${item.first_name} ${item.last_name}`;
        }
        return item.name || `Hiring Manager ${formatId(item.id, 'HM')}`;
      case 'placement':
        return item.job_title || `Placement ${formatId(item.id, 'P')}`;
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
      case 'hiringManager':
        return <FiUser size={16} />;
      case 'placement':
        return <FiDollarSign size={16} />;
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
      results.tasks.length +
      (results.hiringManagers?.length || 0) +
      (results.placements?.length || 0)
    );
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

  // Don't filter navigation items based on search query - always show all items
  // The search query is only for the global search functionality, not for filtering sidebar
  const filteredNavItems = navItems;

  const isNavItemActive = (itemPath: string) => {
    if (pathname === itemPath) return true;
    if (itemPath === "/") return pathname === "/";
    return pathname.startsWith(`${itemPath}/`);
  };

  return (
    <>
      {/* Mobile sidebar backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity"
        style={{ opacity: isSidebarOpen ? 1 : 0, pointerEvents: isSidebarOpen ? "auto" : "none" }}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden={!isSidebarOpen}
      />

      {/* Top Navigation Bar - full width on mobile, offset by sidebar on desktop */}
      <div className="fixed top-0 left-0 right-0 z-10 pl-4 md:pl-60 pr-2 sm:pr-4">
        {/* Chrome-style tab strip (shown after clicking T.B.I) */}
        {hasQuickTabs && (
          <div className="sd-tabs sd-tabs-bar">
            <div className="sd-tabs-row">
              {showTbiQuickTab &&
                (() => {
                  const isActive = pathname === "/dashboard/tbi";
                  return (
                    <button
                      key="tbi"
                      type="button"
                      className={`sd-tab-label ${isActive ? "is-active" : "hover:bg-slate-200"} transition-colors`}
                      style={
                        isActive
                          ? ({
                            ["--tabs-selected-bg-color" as any]: "#16a34a",
                            ["--tabs-selected-text-color" as any]: "#ffffff",
                          } as any)
                          : undefined
                      }
                      onClick={openTbiQuickTab}
                      title="T.B.I"
                    >
                      <div className="sd-tab-desc">T.B.I</div>
                      <span
                        className="sd-tab-icon sd-tab-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          closeTbiQuickTab();
                        }}
                        title="Close"
                      >
                        <FiX size={14} />
                      </span>
                    </button>
                  );
                })()}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToHorizontalAxis]}
              >
                <SortableContext
                  items={pinnedRecords.map((r) => r.key)}
                  strategy={horizontalListSortingStrategy}
                >
                  {pinnedRecords.map((rec) => (
                    <SortablePinnedTab
                      key={rec.key}
                      record={rec}
                      isActive={currentUrl === rec.url}
                      onClick={() => goToPinned(rec.url)}
                      onUnpin={(e) => {
                        e.stopPropagation();
                        unpinRecord(rec.key);
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}

        <div className="h-12 bg-slate-800 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            {/* Hamburger - mobile only */}
            <button
              type="button"
              className="md:hidden p-2 -ml-1 text-gray-300 hover:text-white hover:bg-slate-700 rounded"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open menu"
            >
              <FiMenu size={22} />
            </button>
            {isSearchOpen ? (
              <div className="relative" ref={searchRef}>
                <form onSubmit={handleSearch} className="flex items-center">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Search all records..."
                      className="bg-slate-700 text-white pl-8 pr-8 py-1 rounded w-full min-w-0 max-w-64 sm:max-w-80 md:w-96 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                {(searchQuery.trim() && searchQuery.trim().length >= 1) || recentSearches.length > 0 ? (
                  <div 
                    className="absolute top-full left-0 mt-1 w-full min-w-0 max-w-[min(24rem,100vw-2rem)] md:w-96 bg-slate-800 rounded shadow-lg z-30 max-h-96 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Recent Searches - Show when query is empty */}
                    {(!searchQuery.trim() || searchQuery.trim().length === 0) && recentSearches.length > 0 && (
                      <div className="py-1">
                        <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-slate-700">
                          Recent Searches
                        </div>
                        {recentSearches.map((search) => (
                          <div
                            key={`recent-${search.type}-${search.id}`}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 group"
                          >
                            <button
                              type="button"
                              className="flex items-center flex-1 min-w-0 text-left hover:text-white"
                              onClick={() => {
                                router.push(search.url);
                                setSearchQuery("");
                                setIsSearchOpen(false);
                                setSearchResults(null);
                              }}
                            >
                              <span className="mr-3 shrink-0">
                                {getResultIcon(search.type)}
                              </span>
                              <span className="flex-1 truncate">
                                {search.name}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="ml-2 p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecentSearch(search.type, search.id);
                              }}
                              title="Remove from recent searches"
                            >
                              <FiX size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Search Results - Show when query has content */}
                    {searchQuery.trim() && searchQuery.trim().length >= 1 && (
                      <>
                        {isSearching ? (
                          <div className="px-4 py-8 text-center">
                            <div className="text-gray-400 text-sm">
                              Searching...
                            </div>
                          </div>
                        ) : searchResults &&
                          getTotalResultsCount(searchResults) > 0 ? (
                          <div className="py-1">
                        {/* Recent Searches at top of results */}
                        {recentSearches.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-slate-700">
                              Recent Searches
                            </div>
                            {recentSearches.slice(0, 3).map((search) => (
                              <div
                                key={`recent-${search.type}-${search.id}`}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 group"
                              >
                                <button
                                  type="button"
                                  className="flex items-center flex-1 min-w-0 text-left hover:text-white"
                                  onClick={() => {
                                    router.push(search.url);
                                    setSearchQuery("");
                                    setIsSearchOpen(false);
                                    setSearchResults(null);
                                  }}
                                >
                                  <span className="mr-3 shrink-0">
                                    {getResultIcon(search.type)}
                                  </span>
                                  <span className="flex-1 truncate">
                                    {search.name}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className="ml-2 p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeRecentSearch(search.type, search.id);
                                  }}
                                  title="Remove from recent searches"
                                >
                                  <FiX size={14} />
                                </button>
                              </div>
                            ))}
                            <div className="px-4 py-2 border-b border-slate-700"></div>
                          </div>
                        )}
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
                                onClick={() => navigateToResult("job", job.id, job)}
                              >
                                <span className="mr-3 text-blue-400">
                                  {getResultIcon("job")}
                                </span>
                                <span className="flex-1 text-left truncate">
                                  {getResultDisplayName(job, "job")}
                                </span>
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
                                onClick={() =>
                                  navigateToResult("lead", lead.id, lead)
                                }
                              >
                                <span className="mr-3 text-orange-400">
                                  {getResultIcon("lead")}
                                </span>
                                <span className="flex-1 text-left truncate">
                                  {getResultDisplayName(lead, "lead")}
                                </span>
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
                                onClick={() =>
                                  navigateToResult("jobSeeker", js.id, js)
                                }
                              >
                                <span className="mr-3 text-green-400">
                                  {getResultIcon("jobSeeker")}
                                </span>
                                <span className="flex-1 text-left truncate">
                                  {getResultDisplayName(js, "jobSeeker")}
                                </span>
                              </button>
                            ))}
                            {searchResults.jobSeekers.length > 5 && (
                              <div className="px-4 py-2 text-xs text-gray-400 text-center">
                                +{searchResults.jobSeekers.length - 5} more job
                                seekers
                              </div>
                            )}
                          </div>
                        )}

                        {/* Organizations */}
                        {searchResults.organizations.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-slate-700">
                              Organizations (
                              {searchResults.organizations.length})
                            </div>
                            {searchResults.organizations
                              .slice(0, 5)
                              .map((org) => (
                                <button
                                  key={`organization-${org.id}`}
                                  type="button"
                                  className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                                  onClick={() =>
                                    navigateToResult("organization", org.id, org)
                                  }
                                >
                                  <span className="mr-3 text-purple-400">
                                    {getResultIcon("organization")}
                                  </span>
                                  <span className="flex-1 text-left truncate">
                                    {getResultDisplayName(org, "organization")}
                                  </span>
                                </button>
                              ))}
                            {searchResults.organizations.length > 5 && (
                              <div className="px-4 py-2 text-xs text-gray-400 text-center">
                                +{searchResults.organizations.length - 5} more
                                organizations
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
                                onClick={() =>
                                  navigateToResult("task", task.id, task)
                                }
                              >
                                <span className="mr-3 text-cyan-400">
                                  {getResultIcon("task")}
                                </span>
                                <span className="flex-1 text-left truncate">
                                  {getResultDisplayName(task, "task")}
                                </span>
                              </button>
                            ))}
                            {searchResults.tasks.length > 5 && (
                              <div className="px-4 py-2 text-xs text-gray-400 text-center">
                                +{searchResults.tasks.length - 5} more tasks
                              </div>
                            )}
                          </div>
                        )}

                        {/* Hiring Managers */}
                        {searchResults.hiringManagers &&
                          searchResults.hiringManagers.length > 0 && (
                            <div>
                              <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-slate-700">
                                Hiring Managers (
                                {searchResults.hiringManagers.length})
                              </div>
                              {searchResults.hiringManagers
                                .slice(0, 5)
                                .map((hm) => (
                                  <button
                                    key={`hiringManager-${hm.id}`}
                                    type="button"
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                                    onClick={() =>
                                      navigateToResult("hiringManager", hm.id, hm)
                                    }
                                  >
                                    <span className="mr-3 text-yellow-400">
                                      {getResultIcon("hiringManager")}
                                    </span>
                                    <span className="flex-1 text-left truncate">
                                      {getResultDisplayName(
                                        hm,
                                        "hiringManager"
                                      )}
                                    </span>
                                  </button>
                                ))}
                              {searchResults.hiringManagers.length > 5 && (
                                <div className="px-4 py-2 text-xs text-gray-400 text-center">
                                  +{searchResults.hiringManagers.length - 5}{" "}
                                  more hiring managers
                                </div>
                              )}
                            </div>
                          )}

                        {/* Placements */}
                        {searchResults.placements &&
                          searchResults.placements.length > 0 && (
                            <div>
                              <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase border-b border-slate-700">
                                Placements ({searchResults.placements.length})
                              </div>
                              {searchResults.placements
                                .slice(0, 5)
                                .map((placement) => (
                                  <button
                                    key={`placement-${placement.id}`}
                                    type="button"
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white"
                                    onClick={() =>
                                      navigateToResult(
                                        "placement",
                                        placement.id,
                                        placement
                                      )
                                    }
                                  >
                                    <span className="mr-3 text-pink-400">
                                      {getResultIcon("placement")}
                                    </span>
                                    <span className="flex-1 text-left truncate">
                                      {getResultDisplayName(
                                        placement,
                                        "placement"
                                      )}
                                    </span>
                                  </button>
                                ))}
                              {searchResults.placements.length > 5 && (
                                <div className="px-4 py-2 text-xs text-gray-400 text-center">
                                  +{searchResults.placements.length - 5} more
                                  placements
                                </div>
                              )}
                            </div>
                          )}
                          </div>
                        ) : searchQuery.trim().length >= 1 ? (
                          <div className="px-4 py-8 text-center">
                            <div className="text-gray-400 text-sm">
                              {/* <p>No results found for</p>
                            <p className="font-medium mt-1">"{searchQuery}"</p> */}
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
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

              {/* Add dropdown menu - rendered via portal */}
              {isAddMenuOpen && addMenuPosition && typeof document !== "undefined" && createPortal(
                <div
                  ref={addMenuDropdownRef}
                  className="fixed w-56 bg-slate-800 rounded shadow-lg py-1 z-[300]"
                  style={{
                    top: `${addMenuPosition.top}px`,
                    left: `${addMenuPosition.left}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
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
                </div>,
                document.body
              )}
            </div>
          </div>


          {/* User profile with dropdown - Top Right */}
          {user && (
            <div className="pr-2 sm:pr-6 relative shrink-0" ref={userMenuRef}>
              <div className="flex items-center gap-1 sm:space-x-2">
                <div className="hidden sm:flex items-center text-gray-300 hover:bg-slate-700 hover:text-white py-2 px-4 rounded">
                  <FiMessageSquare className="mr-2" />
                  Messages
                </div>

                <button
                  className="flex items-center space-x-2 text-gray-300 hover:text-white min-w-0"
                  onClick={toggleUserMenu}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white font-medium text-sm shrink-0">
                    {user.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium truncate max-w-[100px] sm:max-w-none">{user.name}</span>
                </button>
              </div>

              {/* User dropdown menu */}
              {isUserMenuOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-slate-800 rounded shadow-lg py-1 z-10000">
                  <div className="px-4 py-2 border-b border-slate-700">
                    <div className="font-medium text-white text-sm">{user.name}</div>
                    <div className="text-xs text-gray-400 capitalize">{user.userType}</div>
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
      </div>

      {/* Side Navigation - drawer on mobile, fixed on md+ */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-60 bg-slate-800 text-white z-30 flex flex-col transition-transform duration-200 ease-out md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo area + close on mobile */}
        <div className="h-12 flex items-center justify-between px-4 my-4 shrink-0">
          <span className="text-sm font-semibold">
            Complete Staffing Solutions
          </span>
          <button
            type="button"
            className="md:hidden p-2 text-gray-300 hover:text-white hover:bg-slate-700 rounded"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close menu"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Navigation links - always show all items, not filtered by search */}
        <div className="flex-1 min-h-0">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center py-2 px-4 ${isNavItemActive(item.path)
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-slate-700"
                }`}
            >
              <div className="w-6 h-6 mr-3 shrink-0 flex items-center justify-center">
                {item.icon}
              </div>
              {item.name}
            </Link>
          ))}
        </div>

        {/* T.B.I Button - Static, always visible */}
        <div className="p-4 border-t border-slate-700 shrink-0">
          <button
            type="button"
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold text-2xl rounded transition-colors"
            onClick={() => {
              openTbiQuickTab();
              setIsSidebarOpen(false);
            }}
          >
            T.B.I
          </button>
        </div>

        {/* Footer with "Upload CSV" button - always visible */}
        <div className="p-4 border-t border-slate-700 shrink-0">
          <div className="flex justify-between items-center">
            <span className="text-blue-300 text-sm">Upload CSV</span>
            <button
              className="text-white bg-slate-700 p-1 rounded hover:bg-slate-600"
              onClick={() => { router.push('/dashboard/admin?upload=true'); setIsSidebarOpen(false); }}
            >
              <FiUpload size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
