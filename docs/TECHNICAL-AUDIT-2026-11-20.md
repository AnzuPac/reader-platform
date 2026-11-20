# TeroLibrary — технический аудит мастер-ТЗ

Дата: 2026-11-20  
Исходная база: архив `TeroLibrary-stage10.zip` (после дизайн-этапов 1–10).

## Краткий статус

- API route handlers: **93**
- Тестовые файлы: **39**
- DB schema files: PostgreSQL + SQLite
- Build/test execution: **не подтверждены**. В окружении Node `v22.16.0`, тогда как `package.json` требует `^22.22.2 || ^24.15.0 || >=26.0.0`. `npm ci` завершился timeout дважды; зависимости не установлены, поэтому `npm test`, `npm run build` и E2E не запускались.
- ZIP integrity: проверяется после упаковки.

## Приоритетные выводы

### P0 — запуск/верификация блокированы
1. **Нет подтверждённого production build и тестового прогона.** Требуется Node из поддерживаемого диапазона и успешная установка зависимостей.
2. **Необходимо проверить production secrets/config.** `.env.example` существует, но конфигурация deployment и внешние ключи должны быть сверены с реальным окружением, без публикации секретов.

### P1 — интеграции и честность состояния
1. **Email reminders не интегрированы.** `lib/subscriptions.ts` содержит `markReminderSent`, которое фиксирует `channel: email, stub: true`; отправка email не реализована. Не следует считать уведомление отправленным, пока provider не настроен и отправка не подтверждена.
2. **Payment provider / webhook verification требуется отдельная проверка.** По исходникам и тестам нельзя считать production платежи полностью проверенными без запуска integration tests и проверки секретов/webhook в окружении.
3. **DRM/anti-piracy — проверить реальную интеграцию.** Наличие защитных функций и тестов не подтверждает подключение лицензированного DRM provider. Нельзя обещать абсолютную защиту скриншотов.
4. **PDF/EPUB import/export — проверить generated artifacts.** Наличие тестов не подтверждает запуск всех тестов; проверить кириллицу, повреждённые файлы, права экспорта и защиту приватных файлов.

### P1 — security review
1. Выполнить аудит всех 93 API handlers на authentication, authorization, IDOR, input validation, rate limiting, cache headers и ownership checks.
2. Сверить publisher routes с `resolvePublisherScope`; при статическом поиске несколько handlers не содержали прямых маркеров auth, но после ручной проверки publisher routes используют scope guard. Статический grep не является доказательством уязвимости.
3. Проверить загрузки файлов: MIME sniffing, размеры, path traversal, SVG/HTML, архивы, malware scanning и private storage.
4. Проверить rate limiting, admin token/session, CSRF для mutating endpoints, webhook signature и idempotency.

### P2 — качество/полнота
1. E2E сценарии: регистрация/вход, каталог/поиск, чтение и прогресс, library, author publish, purchase, refund, subscription cancel, publisher rights, payout, moderation.
2. Accessibility: keyboard navigation, focus states, labels, contrast, reduced motion.
3. SEO: metadata, sitemap, canonical, robots и закрытие приватных страниц от индексации.
4. Localization: проверить RU/SR/EN для всех новых и существующих страниц, особенно формы ошибок и системные уведомления.
5. Responsive visual regression: desktop/tablet/mobile для основных маршрутов.

## Что подтверждено статически

- В проекте присутствует 93 API route handlers.
- В `tests` найдено 39 test files.
- В `package.json` доступны scripts `test`, `build`, `check`, `e2e`.
- Имеются PostgreSQL и SQLite schema files.
- Имеется `.env.example`, README, HANDOFF и документация ТЗ/anti-piracy.
- Поиск TODO/FIXME выявил конкретную email reminder stub в `lib/subscriptions.ts`; остальные совпадения были placeholders UI, SQL placeholders либо комментарии.

## Что НЕ проверено

- TypeScript compile / Next build.
- Vitest suite.
- E2E.
- Browser visual tests.
- Live PostgreSQL/SQLite migrations.
- Stripe/payment live or test integration.
- Email delivery.
- DRM provider.
- Production deployment, CDN/cache headers and backups.

## Рекомендуемый порядок дальнейших работ

1. Поднять окружение на поддерживаемом Node и добиться install/build/test baseline.
2. Создать отчёт результатов тестов, исправить build/type/test failures.
3. Security audit по API и storage; закрывать P0/P1 до запуска.
4. Проверить payment/webhook idempotency и refund flows.
5. Настроить email provider и корректный lifecycle reminders.
6. Проверить import/export и права на protected content.
7. E2E, accessibility, localization, SEO и responsive regression.
8. Deployment rehearsal: migrations, backup/restore, secrets, healthcheck, rollback.

## Статус

Это **статический первичный аудит**, а не подтверждение production readiness. Следующий deliverable должен содержать реальные результаты сборки, тестов и security review после установки зависимостей в совместимом окружении.

## Account roles and monetization policy (follow-up)
- Reader-to-author self-service activation implemented on the existing account.
- Fanfiction/public-domain works are donation-only; server-side checks block book and chapter sales.
- Original self-published works and original comics may be commercially priced after rights confirmation.
- Publisher pricing remains publisher-managed; publisher chapter pricing endpoint added.
- Existing non-commercial sale prices are disabled by migration; existing purchase entitlements and donations are retained.
- Validation performed: TypeScript transpile syntax for touched files; pure policy cases; SQLite schema/migration behavior. Full app tests/build remain unavailable without dependencies.
