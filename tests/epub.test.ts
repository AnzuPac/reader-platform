import { describe, it, expect } from 'vitest';
import { parseEpub, readZip } from '../lib/epub';

/** Собирает ZIP без сжатия (stored) — достаточно для проверки разборщика. */
function zipStore(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  let count = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 8);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    locals.push(lh, nameBuf, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += 30 + nameBuf.length + data.length;
    count += 1;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const container = `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
const opf = `<?xml version="1.0"?><package><metadata><dc:title>Test Book</dc:title><dc:language>sr</dc:language></metadata>
<manifest><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="ch2.xhtml" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`;
const ch1 = `<?xml version="1.0"?><html><head><title>Prva glava</title></head><body><h1>Prva glava</h1><p>Tekst prve glave.</p></body></html>`;
const ch2 = `<?xml version="1.0"?><html><head><title>Druga</title></head><body><p>Tekst druge glave.</p></body></html>`;

describe('EPUB-импорт (ТЗ 7.3)', () => {
  it('читает zip и находит файлы', () => {
    const zip = readZip(zipStore({ 'META-INF/container.xml': container, 'OEBPS/content.opf': opf }));
    expect(zip.has('OEBPS/content.opf')).toBe(true);
  });

  it('разбирает container → OPF → spine → главы', () => {
    const epub = zipStore({
      'META-INF/container.xml': container,
      'OEBPS/content.opf': opf,
      'OEBPS/ch1.xhtml': ch1,
      'OEBPS/ch2.xhtml': ch2,
    });
    const parsed = parseEpub(epub);
    expect(parsed.title).toBe('Test Book');
    expect(parsed.language).toBe('sr');
    expect(parsed.chapters.length).toBe(2);
    expect(parsed.chapters[0].title).toBe('Prva glava');
    expect(parsed.chapters[0].html).toContain('Tekst prve glave');
    expect(parsed.chapters[1].title).toBe('Druga');
    expect(parsed.warnings.length).toBe(0);
  });

  it('без container.xml — понятная ошибка', () => {
    expect(() => parseEpub(zipStore({ 'a.txt': 'x' }))).toThrow(/no_container/);
  });

  it('глава без файла попадает в предупреждения, но книга разбирается', () => {
    const epub = zipStore({ 'META-INF/container.xml': container, 'OEBPS/content.opf': opf, 'OEBPS/ch1.xhtml': ch1 });
    const parsed = parseEpub(epub);
    expect(parsed.chapters.length).toBe(1);
    expect(parsed.warnings.join(' ')).toContain('ch2.xhtml');
  });
});
