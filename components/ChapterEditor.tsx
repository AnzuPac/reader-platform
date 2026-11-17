'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';

type Chapter = { id: number; number: number; title: string; access: string; status: string; word_count: number };

const FONTS = [
  { label: 'Georgia (книжный)', value: 'Georgia, serif' },
  { label: 'Inter (современный)', value: 'Inter, system-ui, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Courier (машинописный)', value: '"Courier New", monospace' },
];

export default function ChapterEditor({ workSlug }: { workSlug: string }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [edits, setEdits] = useState<Array<{ id: number; chapter_number: number; title: string; status: string; comment: string | null }>>([]);
  const [translationReqs, setTranslationReqs] = useState<Array<{ id: number; chapter_number: number; target_lang: string; status: string }>>([]);
  const [number, setNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [access, setAccess] = useState('free');
  const [font, setFont] = useState(FONTS[0].value);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const fontRef = useRef<HTMLInputElement>(null);
  const [fontName, setFontName] = useState('');
  const imageRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '<p></p>',
    editorProps: { attributes: { class: 'prose-reader focus:outline-none min-h-[360px] px-1 py-2' } },
    immediatelyRender: false,
  });

  async function loadChapters() {
    const r = await fetch(`/api/author/chapter?work=${encodeURIComponent(workSlug)}`);
    if (!r.ok) return;
    const j = await r.json();
    setChapters(j.chapters || []);
  }
  useEffect(() => { loadChapters(); }, [workSlug]);
  useEffect(() => { loadEdits(); }, []);
  useEffect(() => { loadTranslationReqs(); }, []);
  async function loadTranslationReqs() {
    const r = await fetch('/api/author/translation');
    if (!r.ok) return;
    const j = await r.json().catch(() => ({}));
    setTranslationReqs(j.requests || []);
  }

  async function requestTranslation(chapterId: number, lang: string) {
    const r = await fetch('/api/author/translation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapterId, targetLang: lang }),
    });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Zahtev za prevod poslat' : 'Greška prevoda: ' + (j.error || r.status));
    await loadTranslationReqs();
  }

  async function loadEdits() {
    const r = await fetch('/api/author/chapter-edit');
    if (!r.ok) return;
    const j = await r.json().catch(() => ({}));
    setEdits(j.requests || []);
  }

  async function openChapter(n: number) {
    const r = await fetch(`/api/author/chapter?work=${encodeURIComponent(workSlug)}`);
    if (!r.ok) return;
    const j = await r.json();
    const meta = (j.chapters || []).find((c: Chapter) => c.number === n);
    if (!meta) return;
    setNumber(meta.number);
    setTitle(meta.title);
    setAccess(meta.access);
    const full = await fetch(`/api/author/chapter?work=${encodeURIComponent(workSlug)}&full=${n}`);
    if (full.ok) {
      const fj = await full.json();
      if (fj.content) editor?.commands.setContent(fj.content);
    }
  }

  const insertImage = useCallback((url: string) => {
    editor?.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg('Импортирую…');
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/author/import', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg('Greška импорта: ' + (j.error || r.status)); return; }
    editor?.commands.setContent(j.html || '');
    setMsg(`Импортировано: ${j.words} слов`);
    e.target.value = '';
  }

  async function onImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg('Загружаю иллюстрацию…');
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/author/image', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg('Greška: ' + (j.error || r.status)); return; }
    insertImage(j.url);
    setMsg('Иллюстрация вставлена');
    e.target.value = '';
  }

  async function publishChapter() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/author/publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workSlug, number, publish: true }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? 'Глава опубликована' : 'Greška публикации: ' + (j.error || r.status));
    await loadChapters();
  }

  async function uploadFont(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg('Загружаю шрифт…');
    const fd = new FormData();
    fd.append('workSlug', workSlug);
    fd.append('family', fontName || 'Custom');
    fd.append('file', file);
    const r = await fetch('/api/author/font', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg('Greška шрифта: ' + (j.error || r.status)); return; }
    setMsg(`Font «${j.family}» загружен и применён к произведению`);
    e.target.value = '';
  }

  async function save() {
    if (!editor) return;
    setBusy(true); setMsg('');
    const body = editor.getHTML();
    const wrapped = `<div style="font-family:${font}">${body}</div>`;
    const meta = chapters.find((c) => c.number === number);
    const published = meta?.status === 'published';
    const r = await fetch(published ? '/api/author/chapter-edit' : '/api/author/chapter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workSlug, number, title, content: wrapped, access }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg('Greška сохранения: ' + (j.error || r.status)); return; }
    if (published) {
      setMsg(`Izmena poslata na moderaciju (zahtev ${j.requestId}). Glava ostaje objavljena do odluke.`);
      await loadEdits();
    } else {
      setMsg(`Sačuvano: глава ${j.chapter.number}, ${j.words} слов`);
      await loadChapters();
    }
  }

  const B = ({ on, active, children, onClick, title: ttl }: any) => (
    <button type="button" onClick={onClick} title={ttl}
      className={`rounded px-2 py-1 text-xs font-semibold ${active ? 'bg-brand text-white' : 'bg-[#221a35] text-mist hover:text-ink'}`}>
      {children}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className="input max-w-[110px]" type="number" min={1} value={number}
                 onChange={(e) => setNumber(Number(e.target.value))} />
          <input className="input flex-1" placeholder="Naslov glave" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="input max-w-[190px]" value={access} onChange={(e) => setAccess(e.target.value)}>
            <option value="free">Besplatno</option>
            <option value="subscribers">Подписчики</option>
            <option value="paid">Платная</option>
          </select>
          <select className="input max-w-[190px]" value={font} onChange={(e) => setFont(e.target.value)}>
            {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {editor ? (
          <div className="mb-2 flex flex-wrap gap-1">
            <B onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Жирный"><b>B</b></B>
            <B onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Курсив"><i>I</i></B>
            <B onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Подчёркнутый"><u>U</u></B>
            <B onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Зачёркнутый"><s>S</s></B>
            <span className="mx-1 w-px bg-line" />
            <B onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>H1</B>
            <B onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>H2</B>
            <B onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>H3</B>
            <span className="mx-1 w-px bg-line" />
            <B onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Список">•</B>
            <B onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Нумерация">1.</B>
            <B onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Цитата">❝</B>
            <span className="mx-1 w-px bg-line" />
            <B onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>⟸</B>
            <B onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>↔</B>
            <B onClick={() => imageRef.current?.click()} title="Иллюстрация">🖼</B>
            <B onClick={() => importRef.current?.click()} title="Импорт .docx / .pdf / .md / .txt">📄 Импорт</B>
          </div>
        ) : null}

        <div className="rounded-lg border border-line bg-[#150f21] p-3" style={{ fontFamily: font }}>
          <EditorContent editor={editor} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" onClick={save} disabled={busy}>Sačuvaj главу</button>
          <button className="btn btn-ghost" onClick={publishChapter} disabled={busy}>Опубликовать</button>
          <input ref={importRef} type="file" accept=".docx,.pdf,.md,.markdown,.txt" className="hidden" onChange={onImport} />
          <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={onImage} />
          <input ref={fontRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={uploadFont} />
          <div className="flex items-center gap-2">
            <input className="input max-w-[150px]" placeholder="Имя шрифта" value={fontName} onChange={(e) => setFontName(e.target.value)} />
            <button className="btn btn-ghost" onClick={() => fontRef.current?.click()} disabled={busy}>Свой шрифт</button>
          </div>
          <span className="text-sm muted">{editor ? editor.storage.characterCount?.words?.() ?? '' : ''}</span>
        </div>
        {msg ? <p className="mt-2 text-sm text-hot">{msg}</p> : null}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-semibold">Главы ({chapters.length})</div>
        <ul className="divide-y divide-line">
          {chapters.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2">
              <span className="w-8 text-sm muted">{c.number}</span>
              <button className="flex-1 text-left text-sm hover:text-brand" onClick={() => openChapter(c.number)}>
                {c.title || `Glava ${c.number}`}
              </button>
              <span className="text-xs muted">{c.word_count} слов · {c.status}{c.access !== 'free' ? ' 🔒' : ''}</span>
              <select className="input max-w-[64px] text-xs" defaultValue="en"
                onChange={(e) => requestTranslation(c.id, e.target.value)} title="Заявка на перевод">
                <option value="en">EN</option>
                <option value="ru">RU</option>
                <option value="sr">SR</option>
              </select>
            </li>
          ))}
          {chapters.length === 0 ? <li className="px-4 py-3 text-sm muted">Пока нет глав</li> : null}
        </ul>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-semibold">Переводы ({translationReqs.filter((t) => t.status !== 'approved' && t.status !== 'rejected').length} в работе)</div>
        <ul className="divide-y divide-line">
          {translationReqs.slice(0, 10).map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-8 muted">{t.chapter_number}</span>
              <span className="flex-1">{t.target_lang.toUpperCase()}</span>
              <span className={t.status === 'approved' ? 'text-xs text-brand' : t.status === 'rejected' ? 'text-xs text-hot' : 'text-xs muted'}>
                {t.status === 'requested' ? 'ждёт ИИ' : t.status === 'ai_done' ? 'на проверке' : t.status === 'approved' ? 'готово' : 'отклонено'}
              </span>
            </li>
          ))}
          {translationReqs.length === 0 ? <li className="px-4 py-3 text-sm muted">Заявок на перевод нет</li> : null}
        </ul>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3 font-semibold">
          Заявки на правку ({edits.filter((e) => e.status === 'pending').length} на модерации)
        </div>
        <ul className="divide-y divide-line">
          {edits.slice(0, 10).map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="w-8 muted">{e.chapter_number}</span>
              <span className="flex-1">{e.title}</span>
              <span className={e.status === 'approved' ? 'text-xs text-brand' : e.status === 'rejected' ? 'text-xs text-hot' : 'text-xs muted'}>
                {e.status === 'pending' ? 'на модерации' : e.status === 'approved' ? 'одобрено' : 'отклонено'}
              </span>
            </li>
          ))}
          {edits.length === 0 ? <li className="px-4 py-3 text-sm muted">Заявок пока нет</li> : null}
        </ul>
      </div>
    </div>
  );
}
