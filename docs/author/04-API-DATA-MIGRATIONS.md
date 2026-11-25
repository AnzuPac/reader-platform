# API, данные и миграции Author

## Правило
Сначала сверить реальные схемы SQLite и PostgreSQL, затем писать миграции. Не создавать сущности-дубликаты и не переименовывать существующие поля без обратной совместимости.

## Уже найденные маршруты/модули
- `/api/author/register`
- `/api/author/work`
- `/api/author/chapter`
- `/api/author/publish`
- `/api/author/import`
- `/api/author/import-epub`
- `/api/author/image`
- `/api/author/cover`
- `/api/author/stats`
- `/api/author/income`, `/api/author/payouts`, `/api/author/donations`
- `/api/author/chapter-edit`
- `lib/author.ts`, `lib/author-stats.ts`, `lib/export.ts`
- `components/ChapterEditor.tsx`, `AuthorWorks.tsx`, `AuthorStats.tsx`, `AuthorActivation.tsx`

## Предлагаемые новые API-контракты
Маршруты ниже — целевой контракт, не утверждение, что они уже существуют.

### Версии глав
- `GET /api/author/chapters/:id/revisions`
- `GET /api/author/chapters/:id/revisions/:revisionId`
- `POST /api/author/chapters/:id/revisions` — создать ревизию с baseRevision
- `POST /api/author/chapters/:id/revisions/:revisionId/restore` — восстановить как новую ревизию
- `GET /api/author/chapters/:id/diff?from=&to=`

### Импорт/экспорт
- `POST /api/author/import/jobs` — принять файлы, создать job
- `GET /api/author/import/jobs/:jobId` — состояние и preview
- `POST /api/author/import/jobs/:jobId/confirm` — применить после подтверждения
- `POST /api/author/export/jobs` — создать экспорт
- `GET /api/author/export/jobs/:jobId` — статус
- `GET /api/author/export/jobs/:jobId/download` — повторная проверка права и временная выдача файла
- `GET /api/author/files/operations` — история файловых операций

### Профиль и настройки
Использовать существующие account/profile endpoints, если они покрывают задачу. Не создавать отдельный авторский пароль или учётную запись.

## Предлагаемые сущности
`chapter_revisions`: immutable revisions and content hashes.
`file_import_jobs`: uploader, status, original file, detected format, warnings, result references, timestamps.
`file_export_jobs`: requested scope, format, policy result, status, expiry, file reference.
`author_file_assets`: private original uploads and media references.
`sync_devices`: registered device metadata and last sync cursor.
`sync_operations`: idempotent operation IDs and sync status.

Для каждой таблицы нужны индексы по owner/user, status, created_at и TTL/cleanup policy для временных файлов.

## Sync API (целевой контракт)
- `GET /api/author/sync/bootstrap` — серверный snapshot/cursor.
- `POST /api/author/sync/operations` — пакет операций с idempotency keys и base revisions.
- `GET /api/author/sync/changes?cursor=` — дельта изменений.
- `POST /api/author/sync/conflicts/:id/resolve` — выбранная/объединённая ревизия.
Нельзя доверять ownerId из клиента: owner вычисляется из сессии на сервере.

## Обязательные проверки
- каждый запрос проверяет сессию, статус аккаунта и ownership;
- роли admin/moderator не дают обычному автору обходить собственность;
- массовые операции атомарны или имеют явный partial-success report;
- все переходы статуса проверяются сервером;
- CSRF/origin policy соответствует существующему проекту;
- rate limiting на import/export и дорогостоящие конвертации.
