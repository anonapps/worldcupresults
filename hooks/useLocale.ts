import { useMemo } from "react";
import type { Locale } from "@/types/i18n";
import { getDictionary } from "@/lib/i18n";

export function useLocale(locale: Locale) {
  return useMemo(() => getDictionary(locale), [locale]);
}
