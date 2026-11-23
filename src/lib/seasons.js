// Which season a night belongs to. Seasons come from the hotel (seasons table), not from code.
// A range is MM-DD..MM-DD inclusive and may wrap the new year (12-25..01-07). The first match by sort wins.

export const inRange = (md, from, to) => (from <= to ? md >= from && md <= to : md >= from || md <= to);

export function seasonOf(seasons, date) {
  const md = date.slice(5);
  for (const s of seasons) if (inRange(md, s.from, s.to)) return s.id;
  return seasons.length ? seasons[seasons.length - 1].id : null;
}
