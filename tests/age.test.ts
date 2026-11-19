import { describe, it, expect } from 'vitest';
import { parseBirthDate, calcAge, ageGroup, groupForBirthDate, maskSmallBuckets, MIN_AGE } from '../lib/age';

const NOW = new Date('2026-11-19T12:00:00Z');

describe('дата рождения: разбор', () => {
  it('принимает корректную ISO-дату', () => {
    const d = parseBirthDate('2000-05-17', NOW);
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2000);
  });

  it('отклоняет неверный формат', () => {
    for (const bad of ['17.05.2000', '2000-5-17', '', 'вчера', '2000/05/17']) {
      expect(parseBirthDate(bad, NOW)).toBeNull();
    }
  });

  it('отклоняет несуществующую дату (31 февраля)', () => {
    expect(parseBirthDate('2000-02-31', NOW)).toBeNull();
  });

  it('отклоняет дату в будущем', () => {
    expect(parseBirthDate('2030-01-01', NOW)).toBeNull();
  });

  it('отклоняет неправдоподобно старую дату', () => {
    expect(parseBirthDate('1850-01-01', NOW)).toBeNull();
  });

  it('29 февраля принимается в високосный год', () => {
    expect(parseBirthDate('2000-02-29', NOW)).not.toBeNull();
  });
});

describe('возраст', () => {
  it('считает полные годы', () => {
    expect(calcAge(new Date(Date.UTC(2000, 4, 17)), NOW)).toBe(26);
  });

  it('за день до дня рождения возраст на год меньше', () => {
    expect(calcAge(new Date(Date.UTC(2000, 10, 20)), NOW)).toBe(25);
  });

  it('в день рождения возраст уже полный', () => {
    expect(calcAge(new Date(Date.UTC(2000, 10, 19)), NOW)).toBe(26);
  });
});

describe('возрастные группы', () => {
  it('мапит границы', () => {
    expect(ageGroup(12)).toBe('<18');
    expect(ageGroup(17)).toBe('<18');
    expect(ageGroup(18)).toBe('18-24');
    expect(ageGroup(24)).toBe('18-24');
    expect(ageGroup(25)).toBe('25-34');
    expect(ageGroup(54)).toBe('45-54');
    expect(ageGroup(55)).toBe('55+');
    expect(ageGroup(120)).toBe('55+');
    expect(ageGroup(null)).toBe('unknown');
    expect(ageGroup(200)).toBe('unknown');
  });

  it('строит группу по строке даты', () => {
    expect(groupForBirthDate('2000-05-17', NOW)).toBe('25-34');
    expect(groupForBirthDate(null, NOW)).toBe('unknown');
    expect(groupForBirthDate('не дата', NOW)).toBe('unknown');
  });

  it('минимальный возраст платформы — 13', () => {
    expect(MIN_AGE).toBe(13);
  });
});

describe('приватность возрастных агрегатов', () => {
  it('мелкие группы схлопываются в other', () => {
    const { visible, hidden } = maskSmallBuckets({ '18-24': 12, '25-34': 3, '35-44': 1 }, 5);
    expect(visible['18-24']).toBe(12);
    expect(visible['25-34']).toBeUndefined();
    expect(visible.other).toBe(4);
    expect(hidden).toBe(4);
  });

  it('группа «не указан» не схлопывается', () => {
    const { visible } = maskSmallBuckets({ '18-24': 1, unknown: 1 }, 5);
    expect(visible.unknown).toBe(1);
    expect(visible.other).toBe(1);
  });

  it('когда данных мало — сумма сохраняется', () => {
    const input = { '<18': 1, '18-24': 2, '25-34': 1 };
    const { visible } = maskSmallBuckets(input, 5);
    const total = Object.values(visible).reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
    expect(visible.other).toBe(4);
  });
});
