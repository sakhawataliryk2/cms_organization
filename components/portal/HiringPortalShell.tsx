"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "nextjs-toploader/app";
import { FiLogOut, FiUser } from "react-icons/fi";

const TABS = [
  { label: "Time Cards", href: "/portal/hiring/timecards" },
  { label: "Invoices", href: "/portal/hiring/invoices" },
];

export default function HiringPortalShell({
  children,
  displayName,
}: {
  children: React.ReactNode;
  displayName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const activeHref =
    TABS.find((t) => pathname?.startsWith(t.href))?.href ??
    (pathname?.startsWith("/portal/hiring/profile") || pathname?.startsWith("/portal/hiring/home")
      ? null
      : TABS[0].href);

  const onLogout = async () => {
    await fetch("/api/portal/hiring/auth/logout", { method: "POST" }).catch(() => null);
    router.push("/portal/login");
  };

  return (
    <div className="min-h-screen bg-[#eef1f4] text-[#1a1a1a]">
      <header className="bg-[#001B3A] text-white">
        <div className="mx-auto grid h-[52px] max-w-[1100px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-5">
          <div className="truncate text-[15px] font-medium tracking-tight">
            {displayName || "Hiring Manager"}
          </div>

          <div className="justify-self-center text-[14px] font-normal text-white/95">
            Hiring Manager Portal
          </div>

          <div className="flex items-center justify-end gap-0.5">
            <Link
              href="/portal/hiring/profile"
              className="rounded-full p-2 text-white hover:bg-white/10"
              aria-label="Profile"
              title="Profile"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/90">
                <FiUser size={12} strokeWidth={2} />
              </span>
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-full p-2 text-white hover:bg-white/10"
              aria-label="Logout"
              title="Logout"
            >
              <FiLogOut size={19} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-[#dde3ea] bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-center gap-10 px-5">
          {TABS.map((tab) => {
            const active = activeHref === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative py-3.5 text-[15px] font-medium transition-colors ${
                  active ? "text-[#1a6bb5]" : "text-[#9aa3ad] hover:text-[#66707a]"
                }`}
              >
                {tab.label}
                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#1a6bb5]" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-[1100px] px-5 py-6">{children}</main>
    </div>
  );
}
