import { isLang, type Lang } from '@/lib/i18n';
import { query } from '@/lib/db';
import SubscribeForm from '@/components/SubscribeForm';

export const dynamic = 'force-dynamic';

export default async function SubscribePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const plans = await query<{ code: string; name: string; price_cents: number; currency: string; period: string }>(
    'SELECT code, name, price_cents, currency, period FROM plans WHERE active = 1 ORDER BY price_cents'
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="mb-2 text-3xl font-bold">Pretplata</h1>
      <p className="mb-8 muted">Čitaj bez ograničenja i podrži autore. Prve glave su uvek besplatne.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => (
          <div key={p.code} className="card flex flex-col p-5">
            <div className="mb-1 text-lg font-semibold">{p.name}</div>
            <div className="mb-4 text-2xl font-bold">
              {(p.price_cents / 100).toFixed(2)} {p.currency}
              <span className="text-sm muted"> / {p.period === 'month' ? 'mesec' : p.period}</span>
            </div>
            <SubscribeForm planCode={p.code} disabled={p.price_cents === 0} />
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm muted">
        Plaćanje je za sada ručno: klikni „Izaberi“, pa se javi administratoru — pretplata se aktivira odmah posle uplate.
      </p>
    </main>
  );
}
