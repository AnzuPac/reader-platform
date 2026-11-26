import path from 'node:path';

/** Приватный корень для страниц комиксов. В Docker это volume /app/data/storage. */
export function privateRoot(): string {
  return process.env.PRIVATE_MEDIA_DIR || path.join(process.cwd(), 'data', 'storage');
}

/** Каталог страниц: <root>/comics/<slug>/<number>. */
export function comicDir(slug: string, number: number | string): string {
  return path.join(privateRoot(), 'comics', slug, String(number));
}

/** Путь в БД: относительный, без /uploads и без ведущего слэша. */
export function comicRelPath(slug: string, number: number | string, name: string): string {
  return `comics/${slug}/${number}/${name}`;
}

/**
 * Превращает значение из БД в абсолютный путь.
 * Поддерживает и новый вид (`comics/...`), и старый (`/uploads/comics/...`),
 * чтобы существующие записи не пришлось переписывать.
 */
export function resolveComicPath(filePath: string): string {
  const rel = String(filePath).replace(/^\/+/, '').replace(/^uploads\//, '');
  const root = privateRoot();
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(path.resolve(root) + path.sep)) throw new Error('path_escape');
  return abs;
}

export function comicPageUrl(chapterId: number, pageNo: number): string {
  return `/api/comic/page?chapter=${chapterId}&page=${pageNo}`;
}

export function imageContentType(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.avif') return 'image/avif';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}
