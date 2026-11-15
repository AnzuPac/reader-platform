import { describe, it, expect } from 'vitest';
import { normalizeSr, cyrToLat, latToCyr, translitSr } from '../lib/sr';

describe('сербская нормализация', () => {
  it('три написания дают одну нормализованную форму', () => {
    const a = normalizeSr('Андрић');
    const b = normalizeSr('Andrić');
    const c = normalizeSr('Andric');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('снимает диакритику и приводит регистр', () => {
    expect(normalizeSr('Čaršija Šećer')).toBe('carsija secer');
  });

  it('транслитерация кириллица→латиница и обратно', () => {
    const lat = cyrToLat('Љубав и њежност, џеп, ћерка');
    expect(lat).toContain('Ljubav');
    expect(lat).toContain('nježnost');
    expect(lat).toContain('džep');
    expect(lat).toContain('ćerka');
    const cyr = latToCyr(lat);
    expect(cyr).toBe('Љубав и њежност, дžеп, ћерка'.replace('дžеп', 'џеп'));
  });

  it('translitSr переключает письмо', () => {
    expect(translitSr('Здраво', 'lat')).toBe('Zdravo');
    expect(translitSr('Zdravo', 'cir')).toBe('Здраво');
  });
});
