'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { splitForSpeech } from '@/lib/speech';

type Lang = 'sr' | 'en' | 'ru';

const VOICE_LANG: Record<Lang, string> = { sr: 'sr-RS', en: 'en-US', ru: 'ru-RU' };
const LABEL: Record<Lang, { play: string; pause: string; stop: string; speed: string; unsupported: string; empty: string }> = {
  sr: { play: 'Slušaj', pause: 'Pauza', stop: 'Zaustavi', speed: 'Brzina', unsupported: 'Tvoj pregledač ne podržava čitanje naglas.', empty: 'Nema teksta za čitanje.' },
  ru: { play: 'Слушать', pause: 'Пауза', stop: 'Стоп', speed: 'Скорость', unsupported: 'Браузер не поддерживает озвучку.', empty: 'Нет текста для озвучки.' },
  en: { play: 'Listen', pause: 'Pause', stop: 'Stop', speed: 'Speed', unsupported: 'Your browser does not support speech synthesis.', empty: 'No text to read.' },
};

/**
 * Чтение главы вслух через Web Speech API — без внешних сервисов и ключей.
 * Текст берём из DOM (то, что реально видит читатель, включая транслитерацию),
 * режем на короткие куски: длинные некоторые движки обрывают.
 */
export default function ReaderTTS({ lang, enabled = true }: { lang: Lang; enabled?: boolean }) {
  const [supported, setSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [note, setNote] = useState('');
  const queue = useRef<string[]>([]);
  const idx = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
    return () => { try { window.speechSynthesis?.cancel(); } catch { /* нет API */ } };
  }, []);

  const readText = useCallback((): string => {
    const surface = document.querySelector('.reader-surface') || document.querySelector('.prose-reader');
    return (surface?.textContent || '').replace(/\s+/g, ' ').trim();
  }, []);

  const speakNext = useCallback(() => {
    if (cancelled.current) return;
    const chunk = queue.current[idx.current];
    if (!chunk) {
      setSpeaking(false);
      setPaused(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = VOICE_LANG[lang];
    u.rate = rate;
    u.onend = () => { idx.current += 1; speakNext(); };
    u.onerror = () => { setSpeaking(false); setPaused(false); };
    window.speechSynthesis.speak(u);
  }, [lang, rate]);

  function start() {
    const text = readText();
    const chunks = splitForSpeech(text);
    if (chunks.length === 0) { setNote(LABEL[lang].empty); return; }
    setNote('');
    try { window.speechSynthesis.cancel(); } catch { /* нет API */ }
    cancelled.current = false;
    queue.current = chunks;
    idx.current = 0;
    setSpeaking(true);
    setPaused(false);
    speakNext();
  }

  function pauseResume() {
    if (!speaking) return;
    if (paused) { window.speechSynthesis.resume(); setPaused(false); }
    else { window.speechSynthesis.pause(); setPaused(true); }
  }

  function stop() {
    cancelled.current = true;
    try { window.speechSynthesis.cancel(); } catch { /* нет API */ }
    queue.current = [];
    idx.current = 0;
    setSpeaking(false);
    setPaused(false);
  }

  if (!enabled) return null;

  const t = LABEL[lang];
  if (!supported) return <span className="text-xs muted">{t.unsupported}</span>;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {!speaking ? (
        <button type="button" className="btn btn-ghost" onClick={start}>🔊 {t.play}</button>
      ) : (
        <>
          <button type="button" className="btn btn-ghost" onClick={pauseResume}>
            {paused ? '▶' : '⏸'} {t.pause}
          </button>
          <button type="button" className="btn btn-ghost" onClick={stop}>⏹ {t.stop}</button>
        </>
      )}
      <label className="flex items-center gap-2 text-xs muted">
        {t.speed}
        <select
          className="input w-auto py-1"
          value={rate}
          onChange={(e) => {
            const next = Number(e.target.value);
            setRate(next);
            if (speaking) { stop(); }
          }}
        >
          <option value={0.8}>0.8×</option>
          <option value={1}>1×</option>
          <option value={1.25}>1.25×</option>
          <option value={1.5}>1.5×</option>
        </select>
      </label>
      {note ? <span className="text-xs muted">{note}</span> : null}
    </div>
  );
}
