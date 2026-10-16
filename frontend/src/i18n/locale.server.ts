import { getCookie } from "@tanstack/react-start/server";
import { LOCALE_COOKIE, isLocale, type Locale } from "./locales";

export function requestLocale(): Locale {
  const c = getCookie(LOCALE_COOKIE);
  return isLocale(c) ? c : "en";
}
