import { describe, it, expect } from 'vitest';
import { detectFormat } from '../lib/user-files';

function zipWith(name: string, compSize = 0, uncompSize = 0): Buffer {
  const nameBuf = Buffer.from(name, 'utf8');
  const cd = Buffer.alloc(46 + nameBuf.length);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
  cd.writeUInt32LE(compSize, 20);
  cd.writeUInt32LE(uncompSize, 24);
  cd.writeUInt16LE(nameBuf.length, 28);
  nameBuf.copy(cd, 46);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(0, 16);
  return Buffer.concat([cd, eocd]);
}

describe('форматы личных файлов', () => {
  it('TXT принимается, бинарный — нет', () => {
    expect(detectFormat(Buffer.from('Привет, мир\n'), 'txt').ok).toBe(true);
    expect(detectFormat(Buffer.from([0x00, 0x01, 0x02]), 'txt')).toEqual({ ok: false, error: 'binary_txt' });
  });
  it('PDF по сигнатуре', () => {
    expect(detectFormat(Buffer.from('%PDF-1.7\n'), 'pdf').ok).toBe(true);
    expect(detectFormat(Buffer.from('nope'), 'pdf').ok).toBe(false);
  });
  it('FB2 по корневому тегу', () => {
    expect(detectFormat(Buffer.from('<?xml version="1.0"?><FictionBook></FictionBook>'), 'fb2').ok).toBe(true);
  });
  it('CBR по RAR-сигнатуре', () => {
    expect(detectFormat(Buffer.from('Rar!\x1a\x07\x00rest'), 'cbr').ok).toBe(true);
    expect(detectFormat(Buffer.from('PK\x03\x04'), 'cbr').ok).toBe(false);
  });
  it('EPUB без mimetype отклоняется, CBZ из zip принимается', () => {
    const zip = zipWith('page1.jpg');
    expect(detectFormat(zip, 'epub')).toEqual({ ok: false, error: 'not_epub' });
    expect(detectFormat(zip, 'cbz').ok).toBe(true);
  });
  it('расширение вне списка отклоняется', () => {
    expect(detectFormat(Buffer.from('x'), 'exe')).toEqual({ ok: false, error: 'format_not_allowed' });
  });
});

describe('защита архивов', () => {
  it('path traversal отклоняется', () => {
    expect(detectFormat(zipWith('../evil.jpg'), 'cbz')).toEqual({ ok: false, error: 'zip_path_traversal' });
  });
  it('zip-bomb по размеру отклоняется', () => {
    expect(detectFormat(zipWith('a.jpg', 1, 2_000_000_000), 'cbz')).toEqual({ ok: false, error: 'zip_bomb_suspected' });
  });
  it('пустой zip — невалидный архив', () => {
    expect(detectFormat(Buffer.from('PK\x03\x04garbage'), 'cbz').ok).toBe(false);
  });
});
