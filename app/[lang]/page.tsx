import Link from 'next/link';
import { isLang, t, type Lang } from '@/lib/i18n';
import { readSession } from '@/lib/auth';
import { listWorks, getContinueReading } from '@/lib/repo';

export const dynamic = 'force-dynamic';

type Card = {
  id: number; slug: string; title: string; author_name: string;
  cover_path: string | null; rating_avg: string; completion: string; type?: string; kind?: string; ai_usage?: 'not_declared'|'no_ai'|'assisted'|'generated';
};
const TXT: Record<Lang, {
  hello: string; continueReading: string; continueBtn: string; freshSub: string;
  allCatalog: string; books: string; fanfics: string; manga: string; empty: string;
  rec: string; top: string; newLabel: string; popularLabel: string; weekly: string;
  discover: string; heroTitle: string; heroText: string;
}> = {
  sr: { hello:'Dobro došli nazad', continueReading:'Nastavi čitanje', continueBtn:'Nastavi', freshSub:'Otkrij sledeću priču za sebe', allCatalog:'Ceo katalog', books:'Knjige', fanfics:'Fan-fikcija', manga:'Manga i stripovi', empty:'Još nema dela u ovom izboru.', rec:'Preporuke', top:'Top čitanja', newLabel:'Novo', popularLabel:'Popularno', weekly:'Najčitanije ove nedelje', discover:'Otkrij', heroTitle:'Priča koja te čeka.', heroText:'Pronađi knjige, fanfikciju i mangu. Sačuvaj omiljeno i nastavi tačno tamo gde si stao.' },
  ru: { hello:'С возвращением', continueReading:'Продолжить чтение', continueBtn:'Продолжить', freshSub:'Найди следующую историю для себя', allCatalog:'Весь каталог', books:'Книги', fanfics:'Фанфики', manga:'Манга и комиксы', empty:'В этой подборке пока нет произведений.', rec:'Рекомендации', top:'Топ читаемого', newLabel:'Новинки', popularLabel:'Популярное', weekly:'Самое читаемое за неделю', discover:'Открыть', heroTitle:'История, которая тебя ждёт.', heroText:'Находи книги, фанфики и мангу. Сохраняй любимое и продолжай чтение с того места, где остановился.' },
  en: { hello:'Welcome back', continueReading:'Continue reading', continueBtn:'Continue', freshSub:'Discover your next story', allCatalog:'Full catalog', books:'Books', fanfics:'Fan fiction', manga:'Manga & comics', empty:'No works in this selection yet.', rec:'Recommended', top:'Top reads', newLabel:'New', popularLabel:'Popular', weekly:'Most read this week', discover:'Explore', heroTitle:'A story is waiting.', heroText:'Discover books, fan fiction and manga. Save your favourites and continue exactly where you left off.' },
};
function WorkCard({w,lang,accent}:{w:Card;lang:Lang;accent:string}) {
  return <Link href={`/${lang}/work/${w.slug}`} className={`tl-home-card ${accent}`}>
    <div className="tl-home-cover">{w.cover_path ? <img src={w.cover_path} alt={w.title} loading="lazy"/> : <div className="tl-cover-placeholder"><span>TEROLIBRARY</span><strong>{w.title}</strong><small>{w.author_name}</small></div>}{w.ai_usage && w.ai_usage !== 'not_declared' ? <span className={`tl-ai-badge tl-ai-badge--${w.ai_usage}`}>{w.ai_usage === 'no_ai' ? '✓ БЕЗ ИИ' : w.ai_usage === 'assisted' ? '✦ AI-ASSISTED' : '✦ AI CONTENT'}</span> : null}</div>
    <div className="tl-home-card-info"><div className="tl-home-card-meta"><span>{w.completion === 'completed' ? (lang==='ru'?'Завершено':lang==='en'?'Completed':'Završeno') : (lang==='ru'?'В процессе':lang==='en'?'Ongoing':'U toku')}</span><span>★ {Number(w.rating_avg||0).toFixed(1)}</span></div><h3>{w.title}</h3><p>{w.author_name}</p></div>
  </Link>;
}
function WorkRow({title,subtitle,items,lang,href,accent,empty}:{title:string;subtitle:string;items:Card[];lang:Lang;href:string;accent:string;empty:string}) {
 return <section className={`tl-home-section ${accent}`}><div className="tl-section-heading"><div><div className="tl-section-eyebrow">{subtitle}</div><h2>{title}</h2></div><Link className="tl-section-more" href={href}>{lang==='ru'?'Все произведения':lang==='en'?'Browse all':'Sva dela'} <span>→</span></Link></div>{items.length?<div className="tl-home-grid">{items.map(w=><WorkCard key={w.id} w={w} lang={lang} accent={accent}/>)}</div>:<div className="tl-home-empty">{empty}</div>}</section>;
}
export default async function HomePage({params}:{params:Promise<{lang:string}>}) {
 const {lang}=await params; const l=(isLang(lang)?lang:'sr') as Lang; const x=TXT[l];
 const session=await readSession(); const cont=session?await getContinueReading(session.uid).catch(()=>null):null;
 const [booksFresh,booksTop,fanficFresh,fanficTop,mangaFresh,mangaTop]=await Promise.all([
  listWorks({type:'novel',fanfic:false,sort:'new',limit:5}).catch(()=>[]),
  listWorks({type:'novel',fanfic:false,sort:'views',limit:5}).catch(()=>[]),
  listWorks({fanfic:true,sort:'new',limit:5}).catch(()=>[]),
  listWorks({fanfic:true,sort:'views',limit:5}).catch(()=>[]),
  listWorks({type:'comic',sort:'new',limit:5}).catch(()=>[]),
  listWorks({type:'comic',sort:'views',limit:5}).catch(()=>[]),
 ]);
 const cat=(type:string)=>`/${l}/catalog?type=${type}`;
 return <main id="main" className="tl-home">
  <section className="tl-home-hero"><div className="tl-home-hero-copy"><span className="tl-home-kicker">{x.discover} · TEROLIBRARY</span><h1>{session?`${x.hello}, ${session.name}`:x.heroTitle}</h1><p>{x.heroText}</p><Link className="tl-home-hero-button" href={`/${l}/catalog`}>{x.allCatalog} <span>→</span></Link></div><div className="tl-home-hero-art" aria-hidden="true"><span className="tl-art-orbit tl-art-orbit-one"/><span className="tl-art-orbit tl-art-orbit-two"/><span className="tl-art-book tl-art-book-one"/><span className="tl-art-book tl-art-book-two"/><span className="tl-art-book tl-art-book-three">✦</span></div></section>
  <nav className="tl-home-category-nav" aria-label="Categories"><Link href={cat('book')} className="tl-home-category books"><span>📚</span>{x.books}<b>→</b></Link><Link href={cat('fanfic')} className="tl-home-category fanfics"><span>✦</span>{x.fanfics}<b>→</b></Link><Link href={cat('manga')} className="tl-home-category manga"><span>▣</span>{x.manga}<b>→</b></Link></nav>
  {cont?<Link href={`/${l}/read/${cont.chapter_id}`} className="tl-home-continue"><span className="tl-home-continue-icon">◉</span><span className="tl-home-continue-copy"><small>{x.continueReading} · {cont.percent}%</small><strong>{cont.work_title} — {cont.chapter_title||`${l==='ru'?'Глава':l==='en'?'Chapter':'Glava'} ${cont.number}`}</strong></span><span className="tl-home-continue-button">{x.continueBtn} →</span></Link>:null}
  <WorkRow title={x.books} subtitle={x.rec} items={booksFresh as Card[]} lang={l} href={cat('book')} accent="tl-books" empty={x.empty}/>
  <WorkRow title={x.weekly} subtitle={x.top} items={booksTop as Card[]} lang={l} href={`${cat('book')}&filter=popular`} accent="tl-books tl-top" empty={x.empty}/>
  <WorkRow title={x.fanfics} subtitle={x.rec} items={fanficFresh as Card[]} lang={l} href={cat('fanfic')} accent="tl-fanfics" empty={x.empty}/>
  <WorkRow title={x.weekly} subtitle={x.top} items={fanficTop as Card[]} lang={l} href={`${cat('fanfic')}&filter=popular`} accent="tl-fanfics tl-top" empty={x.empty}/>
  <WorkRow title={x.manga} subtitle={x.rec} items={mangaFresh as Card[]} lang={l} href={cat('manga')} accent="tl-manga" empty={x.empty}/>
  <WorkRow title={x.weekly} subtitle={x.top} items={mangaTop as Card[]} lang={l} href={`${cat('manga')}&filter=popular`} accent="tl-manga tl-top" empty={x.empty}/>
  <section className="tl-home-creator-cta"><div><span className="tl-home-kicker">TEROLIBRARY CREATOR STUDIO</span><h2>{l==='ru'?'Публикуешь свои истории?':l==='en'?'Have a story to publish?':'Pišeš svoju priču?'}</h2><p>{l==='ru'?'Авторский кабинет, главы, статистика читателей и инструменты публикации — в одном месте.':l==='en'?'A creator workspace for chapters, reader insights and publishing tools.':'Autorski kabinet, poglavlja, statistika čitalaca i alati za objavljivanje.'}</p></div><Link href={`/${l}/author`}>{l==='ru'?'Кабинет автора':l==='en'?'Creator studio':'Autorski kabinet'} <span>→</span></Link></section>
 </main>;
}
