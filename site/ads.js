/* Sample paid restaurant places ("რეკომენდებული"): how a restaurant that buys a place will look.
   Invented restaurants, always marked "ნიმუში" (sample), shown only on Visit2.ge's own pages and sample hotels.
   When real restaurants buy places, they come from the server instead and this file goes. */
(() => {
  const AD = [
    { id: 'ad-bak', town: 'ბაკურიანი', kind: 'georgian', photo: 'img/demo/fire.jpg', lat: 41.7508, lng: 43.5290,
      name: { ka: 'ბუხრის სახლი', en: 'Fireside House', ru: 'Дом у камина' },
      note: { ka: 'ქართული სუფრა ბუხართან, თხილამურების შემდეგ.', en: 'Georgian food by the fire, after skiing.', ru: 'Грузинская кухня у камина после лыж.' } },
    { id: 'ad-tbs', town: 'თბილისი', kind: 'wine', photo: 'img/h/tbilisi-yard-s.jpg', lat: 41.6905, lng: 44.8070,
      name: { ka: 'ეზოს ღვინის ბარი', en: 'Courtyard Wine Bar', ru: 'Винный бар во дворике' },
      note: { ka: 'ქვევრის ღვინო ძველ თბილისურ ეზოში.', en: 'Qvevri wine in an old Tbilisi courtyard.', ru: 'Вино из квеври в старом тбилисском дворике.' } },
    { id: 'ad-bat', town: 'ბათუმი', kind: 'fish', photo: 'img/h/sea-deck-s.jpg', lat: 41.6480, lng: 41.6340,
      name: { ka: 'ზღვის ტერასა', en: 'Sea Terrace', ru: 'Морская терраса' },
      note: { ka: 'დღის თევზი და ჩაის ბაღის ხედი.', en: 'Catch of the day with a view of the sea.', ru: 'Рыба дня с видом на море.' } },
    { id: 'ad-tel', town: 'თელავი', kind: 'georgian', photo: 'img/h/marani-yard-s.jpg', lat: 41.9180, lng: 45.4720,
      name: { ka: 'მარნის სუფრა', en: 'Marani Table', ru: 'Стол в марани' },
      note: { ka: 'კახური კერძები მარანში, ღვინის დეგუსტაციით.', en: 'Kakhetian dishes in a wine cellar, with a tasting.', ru: 'Кахетинская кухня в марани, с дегустацией.' } },
    { id: 'ad-gud', town: 'გუდაური', kind: 'cafe', photo: 'img/demo/lounge.jpg', lat: 42.4775, lng: 44.4795,
      name: { ka: 'მთის კაფე', en: 'Mountain Café', ru: 'Горное кафе' },
      note: { ka: 'ცხელი შოკოლადი და ხაჭაპური საბაგიროსთან.', en: 'Hot chocolate and khachapuri by the lift.', ru: 'Горячий шоколад и хачапури у подъёмника.' } },
  ];
  const metres = (a, b) => { const r = Math.PI / 180, da = (b.lat - a.lat) * r, dl = (b.lng - a.lng) * r;
    return Math.round(12742000 * Math.asin(Math.sqrt(Math.sin(da / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dl / 2) ** 2))); };
  // paid places within 3 km of a point, or in a town
  const near = (p, km = 3) => AD.map(x => ({ ...x, m: metres(p, x) })).filter(x => x.m <= km * 1000).sort((a, b) => a.m - b.m);
  const inTown = town => AD.filter(x => x.town === town);
  window.V2ADS = { all: AD, near, inTown, metres };
})();
