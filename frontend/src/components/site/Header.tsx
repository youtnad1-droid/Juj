import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Globe, Heart, LayoutDashboard, LayoutGrid, Monitor, Moon, Package, Search, ShieldCheck, Store, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { flatten } from "@/lib/queries";
import type { CategoryNode } from "@/lib/catalog.schemas";
import { useAuth, useRefreshSession, useRootData } from "@/hooks/useAuth";
import { useTheme, type Theme } from "@/lib/theme";
import { logoutFn } from "@/lib/catalog.functions";
import { setLocale, useI18n } from "@/i18n";
import { LOCALES } from "@/i18n/locales";

export function Logo() {
  return (
    <Link to="/" data-testid="header-logo" className="flex items-center gap-1 font-display text-2xl font-bold tracking-tight">
      <span className="rounded-md bg-primary px-1.5 text-primary-foreground">JUJ</span>
    </Link>
  );
}

function TreeList({ nodes, onPick, depth = 0 }: { nodes: CategoryNode[]; onPick: () => void; depth?: number }) {
  return (
    <ul className={depth ? "ms-3 border-s ps-3" : "space-y-1"}>
      {nodes.map((n) => (
        <li key={n.id}>
          <Link
            to="/catalog/$categorySlug"
            params={{ categorySlug: n.slug }}
            onClick={onPick}
            data-testid={`catalog-menu-${n.slug}`}
            className={`block rounded-md px-2 py-1.5 hover:bg-accent ${depth ? "text-sm" : "font-medium"}`}
          >
            {n.name}
          </Link>
          {n.children.length > 0 && <TreeList nodes={n.children} onPick={onPick} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

function ThemeItems() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const themes: { v: Theme; label: string; icon: typeof Sun }[] = [
    { v: "light", label: t("Light"), icon: Sun },
    { v: "dark", label: t("Dark"), icon: Moon },
    { v: "system", label: t("System"), icon: Monitor },
  ];
  return (
    <>
      <DropdownMenuLabel>{t("Theme")}</DropdownMenuLabel>
      {themes.map((th) => (
        <DropdownMenuItem key={th.v} data-testid={`theme-${th.v}`} onClick={() => setTheme(th.v)} className={theme === th.v ? "bg-accent" : ""}>
          <th.icon className="me-2 h-4 w-4" /> {th.label}
        </DropdownMenuItem>
      ))}
    </>
  );
}

export function LanguageMenu() {
  const { locale } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Language" data-testid="language-menu-button" className="gap-1 px-2">
          <Globe className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {LOCALES.map((l) => (
          <DropdownMenuItem key={l.code} data-testid={`language-${l.code}`} onClick={() => setLocale(l.code)} className={locale === l.code ? "bg-accent" : ""}>
            <span className="w-7 text-xs font-semibold uppercase text-muted-foreground">{l.code}</span> {l.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileMenu() {
  const { user } = useAuth();
  const { t } = useI18n();
  const refresh = useRefreshSession();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={user ? "secondary" : "default"} size="sm" aria-label="Account" data-testid="profile-menu-button">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{user ? t("Profile") : t("Login")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {user ? (
          <>
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground" data-testid="profile-email">{user.email}</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link to="/orders" data-testid="menu-orders">{t("My orders")}</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/favorites" data-testid="menu-favorites">{t("Favorites")}</Link></DropdownMenuItem>
            {user.role === "seller" && (
              <DropdownMenuItem asChild><Link to="/cabinet" data-testid="menu-cabinet"><Store className="me-2 h-4 w-4" />{t("Seller cabinet")}</Link></DropdownMenuItem>
            )}
            {user.role === "admin" && (
              <DropdownMenuItem asChild><Link to="/admin" data-testid="menu-admin"><ShieldCheck className="me-2 h-4 w-4" />{t("Admin panel")}</Link></DropdownMenuItem>
            )}
          </>
        ) : (
          <DropdownMenuItem asChild><Link to="/auth" data-testid="menu-login">{t("Log in or sign up")}</Link></DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <ThemeItems />
        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="menu-logout"
              onClick={async () => {
                await logoutFn();
                await refresh();
                navigate({ to: "/" });
              }}
            >
              {t("Log out")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const { tree } = useRootData();
  const { user } = useAuth();
  const { t } = useI18n();
  const hot = flatten(tree).filter((c) => c.show_in_header);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const panel = user?.role === "admin" ? "/admin" : user?.role === "seller" ? "/cabinet" : null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:gap-3">
        <Logo />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="secondary" size="sm" data-testid="catalog-menu-button"><LayoutGrid className="h-4 w-4" /><span className="hidden md:inline">{t("Catalog")}</span></Button>
          </SheetTrigger>
          <SheetContent side="left" className="overflow-y-auto">
            <SheetHeader><SheetTitle>{t("Catalog")}</SheetTitle></SheetHeader>
            <div className="px-4 pb-6"><TreeList nodes={tree} onPick={() => setOpen(false)} /></div>
          </SheetContent>
        </Sheet>
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
          }}
        >
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search games, cards, keys…")} className="ps-9" maxLength={100} aria-label="Search" data-testid="header-search-input" />
        </form>
        {panel ? (
          <Link to={panel} data-testid="header-panel-link" className="hidden items-center gap-1 text-sm font-medium hover:text-primary lg:flex">
            <LayoutDashboard className="h-4 w-4" /> {user?.role === "admin" ? t("Admin panel") : t("Seller cabinet")}
          </Link>
        ) : (
          <Link to="/sell" data-testid="header-start-selling" className="hidden text-sm font-medium hover:text-primary lg:block">{t("Start selling")}</Link>
        )}
        <LanguageMenu />
        <Button asChild variant="ghost" size="icon" aria-label="Favorites" data-testid="header-favorites"><Link to="/favorites"><Heart className="h-5 w-5" /></Link></Button>
        <Button asChild variant="ghost" size="icon" aria-label="Orders" className="hidden sm:inline-flex" data-testid="header-orders"><Link to="/orders"><Package className="h-5 w-5" /></Link></Button>
        <ProfileMenu />
      </div>
      {hot.length > 0 && <QuickChips items={hot} className="mx-auto max-w-7xl px-4 pb-3" />}
    </header>
  );
}

export function QuickChips({ items, className = "" }: { items: CategoryNode[]; className?: string }) {
  return (
    <div className={`flex gap-2 overflow-x-auto ${className}`}>
      {items.map((c) => (
        <Link
          key={c.id}
          to="/catalog/$categorySlug"
          params={{ categorySlug: c.slug }}
          data-testid={`quick-chip-${c.slug}`}
          className="shrink-0 rounded-full border px-3 py-1 text-sm hover:border-primary hover:bg-accent"
          activeProps={{ className: "border-primary bg-accent" }}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
