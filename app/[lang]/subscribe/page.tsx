import { isLang, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { listPlans, activeSubscription, planFacts } from '@/lib/subscriptions';
import SubscribeForm from '@/components/SubscribeForm';
import SubscribeControls from '@/components/SubscribeControls';
import { formatRsd } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function SubscribePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const l = (isLang(lang) ? lang : 'sr') as Lang;
  const session = await readSession();
  const plans = await listPlans();
  const current = session ? await activeSubscription(session.uid) : null;
  const currentPlan = plans.find((p) => p.code === current?.plan_code) || null;

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="mb-2 text-3xl font-bold">Pretplata</h1>
      <p className="mb-8 muted">
        Čitaj bez ograničenja i podrži autore. Bez reklama, bez kredita — cela ponuda je u pretplati.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => (
          <div key={p.code} className="card flex flex-col p-5">
            <div className="mb-1 text-lg font-semibold">{p.name}</div>
            <div className="mb-3 text-2xl font-bold">
              {formatRsd(p.price_cents)}
              <span className="text-sm muted"> / {p.period === 'year' ? 'godina' : 'mesec'}</span>
            </div>
            <ul className="mb-4 space-y-1 text-sm muted">
              {planFacts(p).map((f) => <li key={f}>· {f}</li>)}
            </ul>
            <SubscribeForm
              planCode={p.code}
              disabled={current?.plan_code === p.code || p.price_cents === 0}
            />
          </div>
        ))}
      </div>

      {current ? (
        <SubscribeControls
          active
          planCode={current.plan_code}
          activeUntil={current.current_period_end}
          priceLabel={currentPlan ? formatRsd(currentPlan.price_cents) : null}
        />
      ) : null}

      <p className="mt-8 text-sm muted">
        Plaćanje je za sada ručno: izaberi tarifu i javi se administratoru — pretplata se aktivira odmah posle uplate.
        Cena je u RSD, 1 novčić = 1 RSD. Otkazivanje u dva klika, bez skrivenih uslova.
      </p>
    </main>
  );
}
