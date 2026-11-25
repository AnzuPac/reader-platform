import { describe, it, expect } from 'vitest';
import { isNewer, mergeProgress, mergeSettings, mergeItems } from '../lib/sync';

describe('синхронизация: выбор версии', () => {
  it('свежая метка времени побеждает', () => {
    expect(isNewer({ updated_at: '2026-01-02T00:00:00Z' }, { updated_at: '2026-01-01T00:00:00Z' })).toBe(true);
    expect(isNewer({ updated_at: '2026-01-01T00:00:00Z' }, { updated_at: '2026-01-02T00:00:00Z' })).toBe(false);
  });
  it('при равном времени решает версия', () => {
    const t = '2026-01-01T00:00:00Z';
    expect(isNewer({ updated_at: t, version: 3 }, { updated_at: t, version: 2 })).toBe(true);
  });
});

describe('прогресс', () => {
  it('берёт более свежую позицию', () => {
    const server = { work_id: 1, chapter_id: 5, position: 10, percent: 20, updated_at: '2026-01-01T10:00:00Z' };
    const client = { work_id: 1, chapter_id: 6, position: 0, percent: 30, updated_at: '2026-01-01T11:00:00Z' };
    expect(mergeProgress(server, client).value?.chapter_id).toBe(6);
  });
  it('разные главы в одном окне — это конфликт, но без потери прогресса', () => {
    const server = { work_id: 1, chapter_id: 5, position: 10, percent: 20, updated_at: '2026-01-01T10:00:00Z' };
    const client = { work_id: 1, chapter_id: 6, position: 0, percent: 30, updated_at: '2026-01-01T10:02:00Z' };
    const merged = mergeProgress(server, client);
    expect(merged.conflict).toBe(true);
    expect(merged.value?.chapter_id).toBe(6);
  });
});

describe('настройки и закладки', () => {
  it('настройки: побеждает более свежие', () => {
    const server = { font_size: 18, line_height: 1.8, theme: 'light', content_width: 720, updated_at: '2026-01-01T00:00:00Z' };
    const client = { font_size: 22, line_height: 1.9, theme: 'sepia', content_width: 680, updated_at: '2026-01-02T00:00:00Z' };
    expect(mergeSettings(server, client).value?.theme).toBe('sepia');
  });
  it('закладки объединяются, независимые не теряются', () => {
    const server = [{ client_id: 'a', chapter_id: 1, position: 5, updated_at: '2026-01-01T00:00:00Z' }];
    const client = [
      { client_id: 'a', chapter_id: 1, position: 9, updated_at: '2026-01-02T00:00:00Z' },
      { client_id: 'b', chapter_id: 2, position: 1, updated_at: '2026-01-02T00:00:00Z' },
    ];
    const merged = mergeItems(server, client);
    expect(merged.items.map((x) => x.client_id).sort()).toEqual(['a', 'b']);
    expect(merged.items.find((x) => x.client_id === 'a')?.position).toBe(9);
  });
  it('надгробие удаления не воскрешается старой копией', () => {
    const server = [{ client_id: 'a', chapter_id: 1, position: 0, deleted: true, updated_at: '2026-01-03T00:00:00Z' }];
    const client = [{ client_id: 'a', chapter_id: 1, position: 2, deleted: false, updated_at: '2026-01-01T00:00:00Z' }];
    const merged = mergeItems(server, client);
    expect(merged.items[0].deleted).toBe(true);
    expect(merged.conflicts).toBe(1);
  });
});
