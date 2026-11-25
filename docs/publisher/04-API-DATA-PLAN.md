# Publisher API и модель данных — план расширения

## Что уже найдено в исходниках
- `app/[lang]/publisher/page.tsx` — существующий кабинет.
- `lib/publisher.ts` — publishers, publisher members, works, report, payouts, licenses.
- `lib/publisher-guard.ts` — проверка членства и publisher scope.
- `app/api/publisher/works` — список произведений издательства.
- `app/api/publisher/report` — отчёт по продажам/выручке/комиссиям/роялти, CSV.
- `app/api/publisher/members` — управление участниками.
- `app/api/publisher/payouts`.
- `components/PublisherReport.tsx`, `PublisherMembers.tsx`.
- Роли уже представлены как `owner | manager | member`.

## Что проверить до изменений
1. `getAuthorStats()` и таблицы событий: какие метрики реально можно агрегировать.
2. Схемы SQLite/PostgreSQL и индексы по `works.publisher_id`, `author_id`, timestamps.
3. Как устроены лицензии и произведения с несколькими правообладателями.
4. Какие права уже имеют owner/manager/member.
5. Есть ли публичная страница отдельного издательства по slug.

## Предлагаемые API-контракты
Это целевые маршруты, не утверждение, что они уже существуют:
- `GET /api/publisher/analytics/overview?from=&to=`
- `GET /api/publisher/analytics/works?from=&to=&authorId=&workId=`
- `GET /api/publisher/analytics/authors?from=&to=`
- `GET /api/publisher/analytics/authors/:authorId?from=&to=`
- `GET /api/publisher/analytics/export?from=&to=&scope=overview|authors|works&format=csv`

Существующие маршруты сохранять. Каждый новый маршрут использует `resolvePublisherScope()`/единый guard и серверный фильтр по publisher scope. `authorId` из URL — только фильтр, не доказательство права.

## Возможные агрегаты
Не добавлять таблицу, если текущая аналитика уже содержит подходящие события. Если нужны агрегаты, рассмотреть дневную rollup-таблицу:
`publisher_analytics_daily(publisher_id, work_id, author_id, day, metric, value)`
с уникальностью по ключам и идемпотентным пересчётом.
Финансовые события брать из `purchases` и `royalty_ledger`, а не дублировать в аналитике.
