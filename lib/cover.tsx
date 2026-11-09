
export function WorkCover({ title, cover, size = 'cover-sm' }: { title: string; cover?: string | null; size?: string }) {
  return (
    <div className={`cover ${size} relative`} style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      {cover ? <span className="absolute inset-0 bg-black/45" /> : null}
      <span className="relative line-clamp-3">{title}</span>
    </div>
  );
}
