import en from '@/locales/en.json';
import es from '@/locales/es.json';

export type Locale = 'en' | 'es';

type Messages = {
  title: string;
  subtitle: string;
};

const MESSAGES: Record<Locale, Messages> = {
  en,
  es,
};

export function resolveLocale(input?: string | null): Locale {
  if (!input) return 'en';
  return input.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
