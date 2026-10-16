export const LOCALES = [
  { code: "en", name: "English", dir: "ltr" },
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "fr", name: "Français", dir: "ltr" },
  { code: "es", name: "Español", dir: "ltr" },
  { code: "ru", name: "Русский", dir: "ltr" },
  { code: "zh", name: "中文", dir: "ltr" },
  { code: "ko", name: "한국어", dir: "ltr" },
  { code: "id", name: "Bahasa Indonesia", dir: "ltr" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];
export const LOCALE_COOKIE = "juj_locale";
export const isLocale = (v: unknown): v is Locale => LOCALES.some((l) => l.code === v);
export const localeDir = (l: Locale) => LOCALES.find((x) => x.code === l)?.dir ?? "ltr";
