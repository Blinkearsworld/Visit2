/* Places to eat near a hotel (demo data, invented names). On the real platform restaurants add themselves for free
   and sit in their own table with coordinates; distance is worked out from the hotel's location.
   A restaurant that pays for "recommended" is shown first and always marked as such (never hidden advertising). */
window.V2FOOD = (() => {
  // kind: [ka, en, ru]
  const KIND = {
    georgian: ['ქართული სამზარეულო', 'Georgian cuisine', 'Грузинская кухня'], cafe: ['კაფე', 'Café', 'Кафе'],
    pizza: ['პიცერია', 'Pizzeria', 'Пиццерия'], bakery: ['საცხობი', 'Bakery', 'Пекарня'], wine: ['ღვინის ბარი', 'Wine bar', 'Винный бар'],
    fish: ['თევზის რესტორანი', 'Fish restaurant', 'Рыбный ресторан'], grill: ['მწვადი და მაყალი', 'Grill', 'Шашлычная'],
  };
  // per demo town: name, kind, metres from the hotel, price level 1–3, sponsored
  const R = {
    'ბაკურიანი': [['სახლი ბუხრით', 'georgian', 350, 2, 1], ['თოვლის კაფე', 'cafe', 180, 1, 0], ['მთის პური', 'bakery', 260, 1, 0], ['ფიჭვნარის მწვადი', 'grill', 600, 2, 0],
      ['ზემო პიცა', 'pizza', 900, 2, 0], ['საბაგიროს ქოხი', 'georgian', 1200, 2, 0], ['ცხელი ღვინო', 'wine', 750, 2, 0], ['დიდველის სუფრა', 'georgian', 1600, 3, 0],
      ['ყავა და ნამცხვარი', 'cafe', 450, 1, 0], ['ტყის მწვადი', 'grill', 2100, 2, 0], ['ძველი ფურნე', 'bakery', 1300, 1, 0], ['ციგურის კაფე', 'cafe', 2600, 1, 0]],
    'ბორჯომი': [['პარკის სახლი', 'georgian', 300, 2, 1], ['წყაროსთან', 'cafe', 150, 1, 0], ['ბებოს ხაჭაპური', 'bakery', 420, 1, 0], ['მტკვრის პირას', 'fish', 800, 3, 0],
      ['რომანოვების ბაღი', 'georgian', 650, 3, 0], ['მინერალი', 'cafe', 500, 1, 0], ['ბორჯომის მწვადი', 'grill', 1100, 2, 0], ['ხეობის პიცა', 'pizza', 950, 1, 0], ['ლიკანის მარანი', 'wine', 2400, 3, 0]],
    'თბილისი': [['ძველი ქალაქის მარანი', 'wine', 120, 2, 1], ['აბანოს კაფე', 'cafe', 90, 1, 0], ['თონე', 'bakery', 200, 1, 0], ['მეიდნის სუფრა', 'georgian', 350, 2, 0],
      ['ღამის პიცა', 'pizza', 500, 1, 0], ['ნარიყალას ტერასა', 'georgian', 420, 3, 0], ['ლესელიძის ყავა', 'cafe', 60, 1, 0], ['გოგირდის მწვადი', 'grill', 280, 2, 0],
      ['მტკვრის თევზი', 'fish', 750, 3, 0], ['ხინკლის სახლი', 'georgian', 640, 1, 0], ['ქვევრის ბარი', 'wine', 380, 2, 0], ['დილის ფურნე', 'bakery', 520, 1, 0]],
    'აბასთუმანი': [['ობსერვატორიის გზაზე', 'georgian', 700, 2, 1], ['ტყის ჩაი', 'cafe', 400, 1, 0], ['ფიჭვის მწვადი', 'grill', 1200, 2, 0], ['სოფლის ფურნე', 'bakery', 900, 1, 0]],
  };
  // towns without demo data get a plausible local list (demo only), so every hotel page shows places to eat
  const POOL = [['ძველი მარანი', 'wine', 2], ['სოფლის სუფრა', 'georgian', 2], ['დილის ყავა', 'cafe', 1], ['ხაჭაპურის სახლი', 'bakery', 1], ['ცეცხლზე', 'grill', 2],
    ['ეზოს კაფე', 'cafe', 1], ['ბებოს სამზარეულო', 'georgian', 1], ['ტერასა', 'georgian', 3], ['ქვის ფურნე', 'bakery', 1], ['მთის ჩაი', 'cafe', 1]];
  const gen = town => { let h = 0; for (const c of town) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return POOL.map((p, i) => [p[0], p[1], 120 + ((h >> (i % 16)) % 18) * 90 + i * 37, p[2], i === h % 4 ? 1 : 0]).slice(0, 7 + (h % 4)); };
  // every place near the hotel, nearest first
  const all = town => (R[town] || (town ? gen(town) : [])).map(([name, kind, m, price, sponsored]) => ({ name, kind, m, price, sponsored: !!sponsored })).sort((a, b) => a.m - b.m);
  // the short list on the hotel page: recommended first, then the nearest
  const near = (town, n = 4) => all(town).sort((a, b) => (b.sponsored - a.sponsored) || (a.m - b.m)).slice(0, n);
  return { near, all, KIND };
})();
