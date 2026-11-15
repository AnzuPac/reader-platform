import { describe, it, expect } from 'vitest';
import {
  latToCyr, cyrToLat, normalizeSr, stripDiacritics, detectScript, toScript,
} from '../lib/translit';

const CYR = 'Била је то тиха ноћ у Београду, а киша је прала калдрму. Љубав и њежност, џеп, ћуприја, ђак.';
const LAT = 'Bila je to tiha noć u Beogradu, a kiša je prala kaldrmu. Ljubav i nežnost, džep, ćuprija, đak.';

describe('транслитерација ćirilica ↔ latinica', () => {
  it('переводит сербскую латиницу в ћирилицу, включая диграфы', () => {
    expect(latToCyr('Ljubav, njiva, džep, čaša, šuma, žena, đak, ćuprija'))
      .toBe('Љубав, њива, џеп, чаша, шума, жена, ђак, ћуприја');
  });

  it('переводит ћирилицу в латиницу', () => {
    expect(cyrToLat('Љубав, њива, џеп, чаша, шума, жена, ђак, ћуприја'))
      .toBe('Ljubav, njiva, džep, čaša, šuma, žena, đak, ćuprija');
  });

  it('сохраняет регистр', () => {
    expect(latToCyr('NJEGOŠ')).toBe('ЊЕГОШ');
    expect(cyrToLat('Његош')).toBe('Njegoš');
    expect(latToCyr('Beograd')).toBe('Београд');
  });

  it('контрольный абзац переживает перевод туда и обратно', () => {
    const back = latToCyr(cyrToLat(CYR));
    expect(back).toBe(CYR);
    expect(back.length).toBe(CYR.length);
    expect(cyrToLat(latToCyr(LAT))).toBe(LAT);
  });

  it('не трогает цифры, пунктуацию и невидимые маркеры', () => {
    const withMarker = 'Текст\u2060\u200B\u200C\u2063 и 42 %.';
    const back = latToCyr(cyrToLat(withMarker));
    expect(back).toBe(withMarker);
    expect(back).toContain('\u200B');
  });

  it('toScript идемпотентен и определяет письмо', () => {
    expect(toScript(LAT, 'lat')).toBe(LAT);
    expect(toScript(CYR, 'cir')).toBe(CYR);
    expect(detectScript(CYR)).toBe('cir');
    expect(detectScript(LAT)).toBe('lat');
    expect(detectScript('12345')).toBeNull();
  });
});

describe('нормализация для поиска (P8)', () => {
  it('три написания дают один ключ', () => {
    expect(normalizeSr('Андрић')).toBe('andric');
    expect(normalizeSr('Andrić')).toBe('andric');
    expect(normalizeSr('Andric')).toBe('andric');
  });

  it('снимает диакритику и приводит к нижнему регистру', () => {
    expect(normalizeSr('Čačak — Šabac, Žabalj')).toBe('cacak sabac zabalj');
    expect(stripDiacritics('Đorđe')).toBe('Djordje');
    expect(normalizeSr('Ђорђе')).toBe('djordje');
    expect(normalizeSr('Djordje')).toBe('djordje');
  });

  it('кириллица и латиница в названии уравнены', () => {
    expect(normalizeSr('На Дрини ћуприја')).toBe(normalizeSr('Na Drini ćuprija'));
  });
});
