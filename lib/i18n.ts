import en from "@/locales/en.json";
import es from "@/locales/es.json";
import type { Locale } from "@/types/i18n";

const dictionaries = { en, es } as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale] ?? dictionaries.en;
}
