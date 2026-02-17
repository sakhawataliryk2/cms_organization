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

export default function HomeDashboardNav() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isFileUploadOpen, setIsFileUploadOpen] = useState<boolean>(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const addMenuRef = useRef<HTMLDivElement>(null);

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

  // Close add menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        addMenuRef.current &&
        !addMenuRef.current.contains(event.target as Node)
      ) {
        setIsAddMenuOpen(false);
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
    }
    // Close add menu if it's open
    if (isAddMenuOpen) {
      setIsAddMenuOpen(false);
    }
  };

  const toggleAddMenu = () => {
    setIsAddMenuOpen(!isAddMenuOpen);
    // Close search if it's open
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery("");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality here
    console.log("Searching for:", searchQuery);
    // Reset search after submission
    setSearchQuery("");
    setIsSearchOpen(false);
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
    router.push("/dashboard");
  };

  // All navigation items without role-based filtering
  const navItems = [
    { name: "Home", path: "/dashboard", icon: <FiHome size={20} /> },
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

  return (
    <>
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 h-12 bg-slate-800 flex items-center justify-end z-10 pl-60 pr-7">
        <div className="flex items-center ml-4 space-x-4">
          {/* {isSearchOpen ? (
            <form onSubmit={handleSearch} className="flex items-center">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Search anything"
                  className="bg-slate-700 text-white pl-8 pr-8 py-1 rounded w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          ) : (
            <button
              className="flex items-center text-gray-300 hover:text-white"
              onClick={toggleSearch}
            >
              <FiSearch className="mr-1" />
              Find
            </button>
          )} */}
          <Link
            href={"/dashboard"}
            className="flex items-center text-gray-300 hover:text-white"
            // onClick={toggleSearch}
          >
            {/* <FiSearch className="mr-1" /> */}
            Dashboard
          </Link>

          {/* Add button with dropdown */}
          {/* <div className="relative" ref={addMenuRef}>
            <button
              className="flex items-center text-gray-300 hover:text-white"
              onClick={toggleAddMenu}
            >
              <FiPlus className="mr-1" />
              Add
            </button> */}

          {/* Add dropdown menu */}
          {/* {isAddMenuOpen && (
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
            )} */}
          {/* </div> */}
        </div>
      </div>

      {/* Side Navigation */}
      <div className="fixed top-0 left-0 bottom-0 w-60 bg-slate-800 text-white z-10 flex flex-col">
        {/* Logo area */}
        <div className="h-12 flex items-center px-4">
          <div className="flex items-center ml-4 space-x-4">
            {isSearchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="Search anything"
                    className="bg-slate-700 text-white pl-8 pr-8 py-1 rounded w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 rounded shadow-lg py-1 z-10">
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
        </div>
        {/* User profile and logout */}
        {/* {user && (
          <div className="border-t border-slate-700 p-4">
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-medium mr-3">
                {user.name.charAt(0)}
              </div>
              <div>
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-gray-400 capitalize">
                  {user.userType}
                </div>
              </div>
            </div>
          </div>
        )} */}

        {/* Navigation links - always visible */}
        <div className="overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
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
          ))}
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
          <div className="mt-2 text-center">
            <button
              className="py-1 px-3 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded w-full"
              onClick={handleCloseAllTabs}
            >
              CLOSE ALL TABS
            </button>
          </div>
          {/* <div className="mt-2 text-center">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full py-2 text-sm text-center bg-slate-700 hover:bg-slate-600 rounded text-white disabled:opacity-50"
            >
              {isLoggingOut ? "Logging out..." : "Log Out"}
            </button>
          </div> */}
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
