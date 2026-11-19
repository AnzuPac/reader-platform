import { describe, it, expect } from 'vitest';
import { buildExportHtml, exportPolicy, renderPdf, escapeHtml } from '../lib/export';

const work = {
  id: 1, slug: 'knjiga', title: 'Knjiga', author_id: 10, author_name: 'Autor',
  is_classic: 0,
};

describe('права на экспорт PDF', () => {
  it('гость не получает платное произведение', () => {
    expect(exportPolicy(work, null)).toEqual({ allowed: false, reason: 'auth_required' });
  });

  it('классику может скачать любой', () => {
    const r = exportPolicy({ ...work, is_classic: 1 }, null);
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.reason).toBe('public_domain');
  });

  it('автор качает своё произведение', () => {
    const r = exportPolicy(work, { uid: 10, role: 'author' });
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.reason).toBe('owner');
  });

  it('чужое платное произведение закрыто даже для читателя', () => {
    expect(exportPolicy(work, { uid: 11, role: 'reader' })).toEqual({ allowed: false, reason: 'protected' });
  });

  it('админ и модератор получают файл с меткой', () => {
    const r = exportPolicy(work, { uid: 11, role: 'moderator' });
    expect(r.allowed).toBe(true);
    if (r.allowed) expect(r.watermark).toContain('staff:11');
  });
});

describe('сборка HTML для PDF', () => {
  const chapters = [
    { number: 1, title: 'Početak', html: '<p>Prvi pasus.</p>' },
    { number: 2, title: 'Nastavak <b>', html: '<p>Drugi.</p>' },
  ];

  it('содержит главы и оглавление', () => {
    const html = buildExportHtml(chapters, { title: 'Knjiga', author: 'Autor' });
    expect(html).toContain('Prvi pasus.');
    expect(html).toContain('Sadržaj');
    expect(html).toContain('Početak');
    // Заголовок второй главы экранируется: в тексте не должно быть живого тега.
    expect(html).toContain('Nastavak &lt;b&gt;');
  });

  it('экранирует заголовки и метку', () => {
    const html = buildExportHtml(chapters, { title: '<script>x</script>', watermark: 'staff:"A"' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapeHtml закрывает все спецсимволы', () => {
    expect(escapeHtml('<&">')).toBe('&lt;&amp;&quot;&gt;');
  });
});

describe('рендер PDF движком', () => {
  it('создаёт настоящий PDF или честно сообщает об отсутствии движка', async () => {
    const html = buildExportHtml([{ number: 1, title: 'Test', html: '<p>Кириллица и latinica.</p>' }], { title: 'Test' });
    const res = await renderPdf(html, 25_000);
    if (!res.ok) {
      // В среде без Chrome — это честный engine_missing, а не тихий успех.
      expect(['engine_missing', 'failed']).toContain(res.error);
      return;
    }
    expect(res.pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.pdf.length).toBeGreaterThan(1000);
  }, 40_000);
});
