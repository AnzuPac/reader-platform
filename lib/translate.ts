import { createHash } from 'node:crypto';
import { query, one, initSchema } from './db';

const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.TRANSLATE_MODEL || 'qwen2.5:7b';
const PROMPT_VERSION = 'v1';

export type Lang = 'sr' | 'en' | 'ru';
const LANG_NAME: Record<Lang, string> = { sr: 'Serbian (Latin script)', en: 'English', ru: 'Russian' };

/** Промпт в каркасе Tormund: XML-теги, роль, строгий формат вывода, правила стиля. */
function buildPrompt(text: string, lang: Lang, glossary: string): string {
  return `<system_prompt>
  <role>
    Ti si književni prevodilac. Prevodis prozu sa srpskog na ${LANG_NAME[lang]}.
    Prevod mora zvucati kao da je knjiga napisana na tom jeziku — ne kao masinski prevod.
  </role>

  <rules>
    1. Sacuvaj stil, ritam i emociju originale. Ne skracuj i ne dodaj sadrzaj.
    2. Imena, toponime i izmisljene termine prenesi iz glosara ako postoje.
    3. Ne objasnjavaj nista i ne dodaj komentare.
    4. Vrati SAMO prevedeni tekst, bez uvoda i bez markdown ograda.
    5. Ako naidjes na HTML tagove (<p>, <h2>, <em>, <strong>, <blockquote>), zadrzi ih tacno.
    6. Ako je recenica dvosmislena, biraj znacenje koje najbolje sluzi prici.
  </rules>

  <glossary>
${glossary || '(nema posebnih termina)'}
  </glossary>

  <source_text>
${text}
  </source_text>

  <output_format>
    Vrati samo prevedeni tekst, sa istim HTML tagovima i istim redom pasusa.
  </output_format>
</system_prompt>`;
}

async function callModel(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { temperature: 0.2, num_ctx: 8192 } }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  return String(data.response || '').trim();
}

function sha(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Разбивает HTML на куски по абзацам, чтобы модель не теряла контекст. */
function chunk(html: string, max = 2500): string[] {
  const parts = html.split(/(?=<(?:p|h2|h3|blockquote)[ >])/i).filter((p) => p.trim());
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + p).length > max && cur) { out.push(cur); cur = p; }
    else cur += p;
  }
  if (cur) out.push(cur);
  return out.length ? out : [html];
}

export async function translateChapter(chapterId: number, lang: Lang): Promise<{ content: string; cached: boolean; model: string }> {
  await initSchema();
  const chapter = await one<{ id: number; work_id: number; title: string; content: string }>(
    'SELECT id, work_id, title, content FROM chapters WHERE id = $1', [chapterId]
  );
  if (!chapter) throw new Error('chapter_not_found');

  const terms = await query<{ term: string; translation: string }>(
    `SELECT term, translation FROM glossary_terms WHERE work_id = $1 AND lang = $2`, [chapter.work_id, lang]
  );
  const glossary = terms.map((t) => `- ${t.term} → ${t.translation}`).join('\n');
  const hash = sha(`${chapter.content}|${lang}|${PROMPT_VERSION}|${glossary}`);

  const cached = await one<{ content: string; model: string }>(
    `SELECT content, model FROM chapter_translations
      WHERE chapter_id = $1 AND lang = $2 AND source_hash = $3 AND status = 'approved'`,
    [chapter.id, lang, hash]
  );
  if (cached) return { content: cached.content, cached: true, model: cached.model || MODEL };

  const chunks = chunk(chapter.content);
  const translated: string[] = [];
  for (const piece of chunks) {
    translated.push(await callModel(buildPrompt(piece, lang, glossary)));
  }
  const body = translated.join('\n');

  await query(
    `INSERT INTO chapter_translations (chapter_id, lang, title, content, source_hash, status, model)
     VALUES ($1,$2,$3,$4,$5,'approved',$6)
     ON CONFLICT (chapter_id, lang, source_hash) DO UPDATE SET content = EXCLUDED.content, status = 'approved'`,
    [chapter.id, lang, chapter.title, body, hash, MODEL]
  );

  return { content: body, cached: false, model: MODEL };
}
