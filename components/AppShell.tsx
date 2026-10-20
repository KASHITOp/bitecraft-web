"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { useHydrated } from "@/lib/useStored";
import { useOnboarding, useProfile, useSettings } from "@/lib/state";
import { targets } from "@/lib/profile";

const TABS: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Explore", icon: "search", match: (p) => p === "/" || p.startsWith("/recipe") },
  { href: "/pantry", label: "Pantry", icon: "jar", match: (p) => p.startsWith("/pantry") },
  { href: "/chef", label: "Chef", icon: "chat", match: (p) => p.startsWith("/chef") },
  { href: "/planner", label: "Planner", icon: "calendar", match: (p) => p.startsWith("/planner") },
  {
    href: "/more",
    label: "More",
    icon: "more",
    match: (p) => ["/more", "/saved", "/shopping", "/mart", "/mine"].some((x) => p.startsWith(x)),
  },
];

const FULLSCREEN = ["/cook", "/onboarding"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const hydrated = useHydrated();
  const [onboarding] = useOnboarding();
  const [settings] = useSettings();
  const fullscreen = FULLSCREEN.some((p) => pathname.startsWith(p));

  // First launch goes to onboarding. Skipping marks it done too.
  useEffect(() => {
    if (hydrated && !onboarding.done && !pathname.startsWith("/onboarding")) {
      router.replace("/onboarding");
    }
  }, [hydrated, onboarding.done, pathname, router]);

  // Theme preference lives in settings; mirror it onto <html>.
  useEffect(() => {
    if (!hydrated) return;
    const el = document.documentElement;
    if (settings.theme === "system") delete el.dataset.theme;
    else el.dataset.theme = settings.theme;
  }, [hydrated, settings.theme]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID}`, { scope: "/" }).catch(() => {});
    }
  }, []);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-surface focus:p-3"
      >
        Skip to content
      </a>
      {!fullscreen && <Header />}
      <main id="main" className={fullscreen ? "" : "mx-auto w-full max-w-xl pb-28"}>
        {children}
      </main>
      {!fullscreen && <BottomNav pathname={pathname} />}
    </>
  );
}

function Header() {
  const [profile] = useProfile();
  const t = profile ? targets(profile) : null;
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-bg/95 backdrop-blur-[2px] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-lg tap -ml-1 px-1">
          <span aria-hidden className="inline-block h-4 w-4 rounded-[3px] bg-accent" />
          BiteCraft
        </Link>
        {t ? (
          <div className="flex items-center gap-2 text-sm" data-testid="header-targets">
            <span className="flex flex-col items-end leading-tight">
              <span>
                <span className="num font-semibold">{t.kcal}</span>{" "}
                <span className="text-muted">kcal</span>
              </span>
              <span>
                <span className="num font-semibold">{t.protein}</span>
                <span className="text-muted"> g protein</span>
              </span>
            </span>
            <Link
              href="/onboarding?edit=1"
              className="tap inline-flex items-center px-2 font-semibold underline underline-offset-4"
              aria-label="Edit daily targets"
            >
              Edit
            </Link>
          </div>
        ) : (
          <Link href="/onboarding?edit=1" className="tap inline-flex items-center text-sm font-semibold underline underline-offset-4">
            Set my targets
          </Link>
        )}
      </div>
    </header>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                {active && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b bg-accent" />}
                <Icon name={t.icon} size={24} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
