import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  List,
  Upload,
  ChevronLeft,
  ChevronRight,
  Menu,
  Crosshair,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DemoUpload } from "./DemoUpload";

interface NavItem {
  to: "/" | "/matches";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/matches", label: "Matches", icon: List },
];

function NavLink({
  to,
  label,
  icon: Icon,
  collapsed,
  onClick,
}: NavItem & {
  collapsed: boolean;
  onClick?: () => void;
}) {
  const router = useRouterState();
  const isActive =
    to === "/" ? router.location.pathname === "/" : router.location.pathname.startsWith(to);

  const link = (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

function SidebarNav({
  collapsed,
  onUploadClick,
  onNavClick,
}: {
  collapsed: boolean;
  onUploadClick: () => void;
  onNavClick?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className={cn("flex items-center gap-2 px-4 py-4", collapsed && "justify-center px-2")}>
        <Crosshair className="h-6 w-6 shrink-0 text-team-ct" />
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight">
            <span className="text-team-ct">CS2</span>{" "}
            <span className="text-foreground">Stats</span>
          </span>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* nav links */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => (
          <NavLink key={item.to} {...item} collapsed={collapsed} onClick={onNavClick} />
        ))}

        {/* upload button */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  onNavClick?.();
                  onUploadClick();
                }}
                className="flex w-full items-center justify-center rounded-md px-2 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              >
                <Upload className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Upload Demo</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={() => {
              onNavClick?.();
              onUploadClick();
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span>Upload Demo</span>
          </button>
        )}
      </nav>
    </div>
  );
}

type BreadcrumbItem =
  | { label: string; to: "/" | "/matches" }
  | { label: string; to?: undefined };

function Breadcrumbs() {
  const router = useRouterState();
  const path = router.location.pathname;

  const crumbs: BreadcrumbItem[] = [{ label: "CS2 Stats", to: "/" }];

  if (path === "/matches") {
    crumbs.push({ label: "Matches" });
  } else if (path.startsWith("/matches/")) {
    crumbs.push({ label: "Matches", to: "/matches" });
    crumbs.push({ label: "Match Detail" });
  } else if (path === "/") {
    crumbs.push({ label: "Dashboard" });
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/50">/</span>}
          {crumb.to !== undefined ? (
            <Link to={crumb.to} className="hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-foreground">{crumb.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* desktop sidebar */}
        <aside
          className={cn(
            "hidden border-r border-sidebar-border bg-sidebar md:flex md:flex-col transition-all duration-300",
            collapsed ? "w-14" : "w-56",
          )}
        >
          <SidebarNav collapsed={collapsed} onUploadClick={() => setShowUpload(true)} />

          {/* collapse toggle */}
          <div className="border-t border-sidebar-border p-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </aside>

        {/* main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* top bar */}
          <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
            {/* mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarNav
                  collapsed={false}
                  onUploadClick={() => setShowUpload(true)}
                  onNavClick={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <Breadcrumbs />
          </header>

          {/* page content */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</div>
          </main>
        </div>

        {/* upload dialog */}
        <DemoUpload open={showUpload} onOpenChange={setShowUpload} />
      </div>
    </TooltipProvider>
  );
}
