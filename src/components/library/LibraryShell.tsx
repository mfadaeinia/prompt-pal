import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Home,
  LayoutGrid,
  GraduationCap,
  Bookmark,
  History,
  BookOpen,
  NotebookPen,
  Settings,
  Gem,
  Menu,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  icon: typeof LayoutGrid;
  to?: string;
  active?: boolean;
};

const NAV: NavItem[] = [
  { label: "Home", icon: Home, to: "/" },
  { label: "Browse", icon: LayoutGrid, to: "/library", active: true },
  { label: "My Learning", icon: GraduationCap, to: "/" },
  { label: "Saved videos", icon: Bookmark, to: "/saved" },
  { label: "History", icon: History },
  { label: "Vocabulary", icon: BookOpen },
  { label: "Notebook", icon: NotebookPen },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {!item.to && (
              <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                soon
              </span>
            )}
          </>
        );
        const base =
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200";
        if (!item.to) {
          return (
            <span
              key={item.label}
              className={cn(base, "cursor-not-allowed text-muted-foreground/70")}
            >
              {content}
            </span>
          );
        }
        return (
          <Link
            key={item.label}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              base,
              item.active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

function UpgradeCard() {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
        <Gem className="h-4 w-4 text-primary" />
      </span>
      <p className="mt-2 text-sm font-semibold text-foreground">Unlock Premium</p>
      <ul className="mt-2 space-y-1 text-left text-[11px] leading-relaxed text-muted-foreground">
        <li>• Unlimited explanations</li>
        <li>• Unlimited vocabulary</li>
        <li>• Practice mode</li>
      </ul>
      <Button size="sm" variant="outline" className="mt-3 w-full rounded-full text-xs">
        Upgrade
      </Button>
    </div>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/" aria-label="NativeFlow home" className="px-1 pt-1">
        <BrandLogo markClassName="h-8 w-8" gradientId="nf-sidebar" />
      </Link>
      <NavList onNavigate={onNavigate} />
      <div className="mt-auto space-y-3">
        <UpgradeCard />
        <span className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground/70">
          <Settings className="h-4 w-4" /> Settings
        </span>
      </div>
    </div>
  );
}

/**
 * Fixed-sidebar dashboard shell for the curated library.
 * Sidebar collapses into a slide-over sheet on mobile.
 */
export function LibraryShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-border bg-card lg:block">
        <SidebarInner />
      </aside>

      {/* mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-border p-2 text-muted-foreground transition hover:text-foreground"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Link to="/" aria-label="NativeFlow home">
          <BrandLogo markClassName="h-7 w-7" gradientId="nf-sidebar-m" />
        </Link>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
          />
          <div className="animate-slide-in-right absolute inset-y-0 left-0 w-[264px] border-r border-border bg-card">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarInner onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="lg:pl-[248px]">
        <div className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 sm:px-8">{children}</div>
        <AppFooter />
      </main>

    </div>
  );
}

export default LibraryShell;
