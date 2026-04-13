"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FiLogOut, FiMenu, FiX } from "react-icons/fi";
import assets from "@/app/assets/assets";

type PortalTab = { label: string; href: string };

interface PortalNavbarProps {
    tabs: PortalTab[];
    logoutPath: string;
    userName?: string;
}

export default function PortalNavbar({ tabs, logoutPath, userName }: PortalNavbarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [mobileOpen, setMobileOpen] = useState(false);

    const activeHref = tabs.find((t) => pathname?.startsWith(t.href))?.href ?? tabs[0]?.href;

    const onLogout = async () => {
        await fetch(logoutPath, { method: "POST" }).catch(() => null);
        router.push("/portal/login");
    };

    return (
        <nav className="bg-[#1d2945] text-white shadow-md">
            <div className="mx-auto max-w-7xl px-4">
                <div className="flex h-14 items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <Image
                            src={assets.logo}
                            alt="Complete Staffing Solutions"
                            width={130}
                            height={38}
                            className="object-contain brightness-0 invert"
                        />
                    </div>

                    {/* Desktop tabs */}
                    <div className="hidden md:flex items-center gap-1">
                        {tabs.map((tab) => {
                            const active = activeHref === tab.href;
                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active
                                        ? "bg-white/20 text-white"
                                        : "text-white/70 hover:bg-white/10 hover:text-white"
                                        }`}
                                >
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {userName && (
                            <span className="hidden md:block text-sm text-white/80 truncate max-w-[160px]">
                                {userName}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={onLogout}
                            className="flex items-center gap-1.5 rounded-md border border-white/30 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition-colors"
                        >
                            <FiLogOut size={14} />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                        {/* Mobile menu toggle */}
                        <button
                            type="button"
                            className="md:hidden rounded-md p-1.5 text-white hover:bg-white/10"
                            onClick={() => setMobileOpen((v) => !v)}
                        >
                            {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
                        </button>
                    </div>
                </div>

                {/* Mobile menu */}
                {mobileOpen && (
                    <div className="md:hidden border-t border-white/10 py-2 space-y-1">
                        {tabs.map((tab) => {
                            const active = activeHref === tab.href;
                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`block rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                                        }`}
                                >
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </nav>
    );
}
