import { headers } from 'next/headers';
import { getMessages, resolveLocale } from '@/lib/i18n';

export default async function HomePage() {
  const acceptLanguage = (await headers()).get('accept-language');
  const locale = resolveLocale(acceptLanguage);
  const messages = getMessages(locale);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-6 py-20">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-slate-500">Locale: {locale.toUpperCase()}</p>
        <h1 className="text-4xl font-bold text-slate-900">{messages.title}</h1>
        <p className="mt-4 text-lg text-slate-600">{messages.subtitle}</p>
      </section>
    </main>
  );
}
