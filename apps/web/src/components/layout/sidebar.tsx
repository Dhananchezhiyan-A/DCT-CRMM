"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import {
  LayoutDashboard,
  Users,
  Contact,
  Building2,
  UserCheck,
  MapPin,
  TrendingUp,
  FileText,
  CalendarCheck,
  CreditCard,
  FolderKanban,
  CheckSquare,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Menu,
  X,
  Database,
  Boxes,
} from "lucide-react";
import { objectManagerApi } from "@/lib/api";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  items?: NavItem[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  user: Users,
  contact: Contact,
  building: Building2,
  "trending-up": TrendingUp,
  "file-text": FileText,
  "calendar-check": CalendarCheck,
  "credit-card": CreditCard,
  "folder-kanban": FolderKanban,
  "check-square": CheckSquare,
  "map-pin": MapPin,
  home: Building2,
  activity: TrendingUp,
  database: Database,
  boxes: Boxes,
};

function getNavigationByProfile(profileName: string | undefined, roles: string[], hasEffectivePermission: (perm: string) => boolean, isSuperAdmin: boolean, isAdmin: boolean): NavItem[] {
  const showAdminSection = isSuperAdmin || isAdmin;

  const allItems: NavItem[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  ];

  if (isSuperAdmin) {
    allItems.push({ title: "Companies", href: "/admin/companies", icon: Building2 });
  }

  allItems.push(
    {
      title: "CRM",
      href: "#",
      icon: Users,
      items: [
        { title: "Leads", href: "/leads", icon: Contact },
        { title: "Contacts", href: "/contacts", icon: Contact },
        { title: "Accounts", href: "/accounts", icon: Building2 },
        { title: "Customers", href: "/customers", icon: UserCheck },
      ],
    },
    {
      title: "Sales",
      href: "#",
      icon: TrendingUp,
      items: [
        { title: "Site Visits", href: "/site-visits", icon: MapPin },
        { title: "Opportunities", href: "/opportunities", icon: TrendingUp },
        { title: "Quotations", href: "/quotations", icon: FileText },
        { title: "Bookings", href: "/bookings", icon: CalendarCheck },
        { title: "Payments", href: "/payments", icon: CreditCard },
      ],
    },
    { title: "Projects", href: "/projects", icon: FolderKanban },
    { title: "Tasks", href: "/tasks", icon: CheckSquare },
    { title: "Reports", href: "/reports", icon: BarChart3 },
  );

  if (showAdminSection) {
    allItems.push({
      title: "Setup",
      href: "#",
      icon: Settings,
      items: [
        { title: "Setup Home", href: "/setup", icon: Settings },
      ],
    });
    return allItems;
  }

  const nav: NavItem[] = [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }];

  if (hasEffectivePermission("LEAD_READ")) {
    const leadItems: NavItem[] = [];
    if (hasEffectivePermission("LEAD_READ")) leadItems.push({ title: "Leads", href: "/leads", icon: Contact });
    if (leadItems.length > 0) {
      nav.push({ title: "CRM", href: "#", icon: Users, items: leadItems });
    }
  }

  const salesItems: NavItem[] = [];
  if (hasEffectivePermission("SITE_VISIT_READ")) salesItems.push({ title: "Site Visits", href: "/site-visits", icon: MapPin });
  if (hasEffectivePermission("OPPORTUNITY_READ")) salesItems.push({ title: "Opportunities", href: "/opportunities", icon: TrendingUp });
  if (hasEffectivePermission("QUOTATION_READ")) salesItems.push({ title: "Quotations", href: "/quotations", icon: FileText });
  if (hasEffectivePermission("BOOKING_READ")) salesItems.push({ title: "Bookings", href: "/bookings", icon: CalendarCheck });
  if (hasEffectivePermission("PAYMENT_READ")) salesItems.push({ title: "Payments", href: "/payments", icon: CreditCard });
  if (salesItems.length > 0) {
    nav.push({ title: "Sales", href: "#", icon: TrendingUp, items: salesItems });
  }

  if (hasEffectivePermission("PROJECT_READ")) nav.push({ title: "Projects", href: "/projects", icon: FolderKanban });
  if (hasEffectivePermission("TASK_READ")) nav.push({ title: "Tasks", href: "/tasks", icon: CheckSquare });
  if (hasEffectivePermission("REPORT_VIEW")) nav.push({ title: "Reports", href: "/reports", icon: BarChart3 });

  return nav;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, roles, hasEffectivePermission, isSuperAdmin, isAdmin, tenant } = useAuth();
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);
  const [customObjects, setCustomObjects] = React.useState<NavItem[]>([]);

  React.useEffect(() => {
    loadCustomObjects();
  }, []);

  const loadCustomObjects = async () => {
    try {
      const res = await objectManagerApi.listObjects();
      const objects = res.data.data || [];
      const customItems: NavItem[] = objects
        .filter((obj: any) => obj.objectType === "custom" && obj.isActive)
        .map((obj: any) => ({
          title: obj.pluralLabel,
          href: `/objects/${obj.name.toLowerCase()}`,
          icon: iconMap[obj.icon || "database"] || Database,
        }));

      if (customItems.length > 0) {
        setCustomObjects([
          {
            title: "Custom Objects",
            href: "#",
            icon: Boxes,
            items: customItems,
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to load custom objects:", error);
    }
  };

  const staticNavigation = getNavigationByProfile(profile?.name, roles, hasEffectivePermission, isSuperAdmin, isAdmin);
  const navigation = [...staticNavigation, ...customObjects];

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => pathname === href;
  const isParentActive = (item: NavItem) =>
    item.items?.some(
      (child) => pathname === child.href || pathname.startsWith(child.href + "/")
    );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <Link href="/dashboard" className="flex items-center gap-2">
            {tenant && (tenant as any).logo ? (
              <img
                src={`/api/proxy/api/super-admin/logos/${(tenant as any).logo}`}
                alt={tenant.name}
                className="h-8 w-8 rounded object-cover"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">DCT</span>
              </div>
            )}
            <span className="font-bold text-lg">{isSuperAdmin ? "CRM" : (tenant?.name || "CRM")}</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-4rem)] py-4">
          <nav className="space-y-1 px-3">
            {navigation.map((item) => (
              <div key={item.title}>
                {item.items ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.title)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                        isParentActive(item)
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        {item.title}
                      </span>
                      {expandedItems.includes(item.title) || isParentActive(item) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {(expandedItems.includes(item.title) || isParentActive(item)) && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.items.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                              isActive(child.href)
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            <child.icon className="h-4 w-4" />
                            {child.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                      isActive(item.href)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>
    </>
  );
}
