-- Стартовый набор тегов: таксономия book/fanfic и группы для панели фильтров.
INSERT INTO tags (slug, name, kind, tag_group) VALUES
  ('romance','Romance','book','Жанры'),
  ('fantasy','Fantasy','book','Жанры'),
  ('drama','Drama','book','Жанры'),
  ('detective','Detective','book','Жанры'),
  ('historical','Historical','book','Жанры'),
  ('poetry','Poetry','book','Жанры'),
  ('war','War','book','Темы'),
  ('love','Love','book','Темы'),
  ('family','Family','book','Темы'),
  ('magic','Magic','book','Темы'),
  ('school','School','book','Темы'),
  ('adventure','Adventure','book','Темы'),
  ('au','AU','fanfic','Формат'),
  ('canon-divergence','Canon divergence','fanfic','Формат'),
  ('fix-it','Fix-it','fanfic','Формат'),
  ('crossover','Crossover','fanfic','Формат'),
  ('slash','Slash','fanfic','Отношения'),
  ('femslash','Femslash','fanfic','Отношения'),
  ('het','Het','fanfic','Отношения'),
  ('gen','Gen','fanfic','Отношения'),
  ('hurt-comfort','Hurt/comfort','fanfic','Тропы'),
  ('enemies-to-lovers','Enemies to lovers','fanfic','Тропы'),
  ('slow-burn','Slow burn','fanfic','Тропы'),
  ('fluff','Fluff','fanfic','Тропы'),
  ('angst','Angst','fanfic','Тропы')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind, tag_group = EXCLUDED.tag_group;

-- Привязать несколько тегов к существующим произведениям, чтобы счётчики были живыми.
INSERT INTO work_tags (work_id, tag_id)
SELECT w.id, t.id
  FROM works w CROSS JOIN tags t
 WHERE t.slug IN ('romance','drama','fantasy')
   AND w.id IN (SELECT id FROM works ORDER BY id LIMIT 3)
ON CONFLICT DO NOTHING;
