'use client';

import { useState } from 'react';
import Link from 'next/link';

type Props = {
  href: string;
  title: string;
  author: string;
  description?: string | null;
  cover?: string | null;
  tone?: string;
  categoryLabel?: string;
  aiLabel?: string;
  rating?: string;
  status?: string;
  openLabel: string;
  infoLabel: string;
  closeLabel: string;
};

/** Cover-first card: hover on desktop, explicit tap-to-reveal on touch screens. */
export default function BookCoverCard({
  href, title, author, description, cover, tone = 'blue', categoryLabel,
  aiLabel, rating, status, openLabel, infoLabel, closeLabel,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  return (
    <article className={`book tlp-book-cover-card${revealed ? ' is-revealed' : ''}`}>
      <div className={`tlp-book-cover-frame cover ${tone}`}>
        <Link href={href} className="tlp-book-cover-link" aria-label={`${title} — ${author}`}>
          {cover ? <img className="book-cover-image" src={cover} alt="" loading="lazy" decoding="async" /> : null}
          {aiLabel ? <span className="ai-badge ai-badge--unknown">{aiLabel}</span> : null}
          {categoryLabel ? <span className="book-cover-category">{categoryLabel}</span> : null}
        </Link>
        <button
          type="button"
          className="tlp-book-info-toggle"
          aria-label={revealed ? closeLabel : infoLabel}
          aria-expanded={revealed}
          onClick={() => setRevealed((value) => !value)}
        >
          {revealed ? '×' : 'i'}
        </button>
        <div className="tlp-book-cover-overlay" aria-hidden={!revealed}>
          <span className="tlp-book-cover-overlay-meta">{rating ? `★ ${rating}` : ''}{status ? ` · ${status}` : ''}</span>
          <h3>{title}</h3>
          <span className="tlp-book-cover-overlay-author">{author}</span>
          {description ? <p>{description}</p> : null}
          <Link href={href} tabIndex={revealed ? 0 : -1} className="tlp-book-cover-open">{openLabel} →</Link>
        </div>
      </div>
      <div className="book-details">
        <div className="book-details-meta">
          <span className="rating">{rating ? `★ ${rating}` : ''}</span>
          <span>{status || ''}</span>
        </div>
        <h3><Link href={href}>{title}</Link></h3>
        <div className="book-details-author">{author}</div>
      </div>
    </article>
  );
}
