import { createContext, useContext, useMemo, type ReactNode } from "react";
import en from "./en.json";
import ar from "./ar.json";
import fr from "./fr.json";
import es from "./es.json";
import ru from "./ru.json";
import zh from "./zh.json";
import ko from "./ko.json";
import id from "./id.json";
import { LOCALE_COOKIE, type Locale } from "./locales";

const DICTS: Record<Locale, Record<string, string>> = { en, ar, fr, es, ru, zh, ko, id };
type Vars = Record<string, string | number>;
export type T = (s: string, vars?: Vars) => string;

function make(locale: Locale): T {
  const d = DICTS[locale] ?? {};
  return (s, vars) => {
    let out = d[s] || s;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    return out;
  };
}

const Ctx = createContext<{ locale: Locale; t: T }>({ locale: "en", t: make("en") });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: make(locale) }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

export function setLocale(code: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}
