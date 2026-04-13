"use client";

import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

type PortalTab = {
  label: string;
  href: string;
};

interface PortalLayoutShellProps {
  title: string;
  subtitle?: string;
  tabs: PortalTab[];
  logoutPath: string;
  children: React.ReactNode;
}

export default function PortalLayoutShell({
  title,
  subtitle,
  tabs,
  logoutPath,
  children,
}: PortalLayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const activeHref = useMemo(() => {
    return tabs.find((t) => pathname?.startsWith(t.href))?.href ?? tabs[0]?.href;
  }, [pathname, tabs]);

  const onLogout = async () => {
    await fetch(logoutPath, { method: "POST" }).catch(() => null);
    router.push("/portal/login");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Logout
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 px-4 pb-3">
          {tabs.map((tab) => {
            const active = activeHref === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-blue-600 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

