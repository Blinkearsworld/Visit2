/* Demo hotels for the browser-only preview (GitHub Pages). On the real platform hotels come from the server.
   Each has its own template, colour, photos and prices; the owner's own hotel, made on the owners' page, is kept
   in this browser under 'v2-my-hotel' and joins the list. */
window.V2DEMO = (() => {
  const R = (guests, off, summer, winter, peak) => ({ guests, price: { peak, winter, summer, off } });
  const scale = (rates, k) => rates.map(r => ({ guests: r.guests, price: Object.fromEntries(Object.entries(r.price).map(([s, v]) => [s, Math.round(v * k / 5) * 5])) }));
  const BASE = {
    std: { name: 'სტანდარტული ორადგილიანი', rates: [R(1, 90, 120, 150, 200), R(2, 110, 140, 180, 240)] },
    family: { name: 'საოჯახო, 1 საძინებლით (4+1)', rates: [R(2, 150, 200, 240, 320), R(3, 165, 220, 265, 350), R(4, 180, 240, 290, 380), R(5, 195, 260, 310, 410)] },
    suite: { name: 'ლუქსი, 2 საძინებლით', rates: [R(2, 210, 290, 370, 480), R(4, 280, 380, 460, 600), R(6, 340, 460, 550, 710)] },
  };
  const types = k => Object.fromEntries(Object.entries(BASE).map(([id, t]) => [id, { name: t.name, rates: scale(t.rates, k) }]));
  const ROOMS = [{ id: '1', type: 'std' }, { id: '2', type: 'std' }, { id: '3', type: 'family' }, { id: '4', type: 'family' }, { id: '5', type: 'suite' }];
  const P = 'img/demo/';
  const roomsPh = { std: { photos: [P + 'room-std.jpg', P + 'room-std2.jpg'] }, family: { photos: [P + 'room-family.jpg', P + 'room-family2.jpg'] }, suite: { photos: [P + 'room-suite.jpg', P + 'room-suite2.jpg'] } };

  const HOTELS = [
    { slug: 'mta', name: 'მთის სახლი', city: 'ბაკურიანი', theme: 'kva', accent: '#0E857D', types: types(1),
      site: { hero: { img: P + 'hero.jpg', tagline: { ka: 'რვა თბილი ნომერი ტყის პირას, საბაგიროდან ხუთ წუთში', en: 'Eight warm rooms at the forest edge, five minutes from the lifts', ru: 'Восемь тёплых номеров у леса, в пяти минутах от подъёмника' } },
        about: { img: P + 'facade.jpg', text: { ka: 'პატარა საოჯახო სასტუმრო, სადაც დილით ტყის სუნი შემოდის და საღამოს ბუხართან ვსხდებით. ყველა ნომერს აქვს სამზარეულო და აივანი.', en: 'A small family hotel: pine-scented mornings and evenings by the fire. Every room has a kitchen and a balcony.', ru: 'Небольшой семейный отель: утром пахнет лесом, вечером собираемся у камина. В каждом номере кухня и балкон.' } },
        amenities: ['wifi', 'parking', 'kitchen', 'fireplace', 'ski', 'pets'], gallery: [P + 'lounge.jpg', P + 'fire.jpg', P + 'garden.jpg', P + 'games.jpg', P + 'pool.jpg', P + 'pergola.jpg'], rooms: roomsPh,
        location: { text: { ka: 'ტყის ქუჩა 12. საბაგირომდე 400 მ.', en: '12 Forest St. 400 m to the lifts.', ru: 'Лесная ул. 12. До подъёмника 400 м.' }, map: 'https://www.google.com/maps/search/?api=1&query=Bakuriani' } } },
    { slug: 'nino', name: 'ნინოს ეზო', city: 'ბორჯომი', theme: 'ezo', accent: '#3F7A4E', types: types(.8),
      site: { hero: { img: P + 'garden.jpg', tagline: { ka: 'საოჯახო სახლი დიდი ეზოთი, მინერალური წყლების პარკთან ახლოს', en: 'A family house with a big garden near the mineral water park', ru: 'Семейный дом с большим двором рядом с парком минеральных вод' } },
        about: { img: P + 'pergola.jpg', text: { ka: 'ეზოში ბავშვები თამაშობენ, ფანჩატურში საუზმე იშლება, საღამოს კი მაყალი ინთება. ნინო და მისი ოჯახი ყველა სტუმარს სახლში ხვდება.', en: 'Kids play in the garden, breakfast is served in the pergola and the grill is lit at night. Nino and her family welcome every guest at home.', ru: 'Дети играют во дворе, завтрак накрывают в беседке, вечером разжигают мангал. Нино с семьёй встречают каждого гостя дома.' } },
        amenities: ['wifi', 'parking', 'breakfast', 'garden', 'bbq', 'kids', 'pool'], gallery: [P + 'pergola.jpg', P + 'pool.jpg', P + 'garden.jpg', P + 'games.jpg'], rooms: roomsPh,
        location: { text: { ka: 'რუსთაველის ქუჩა 40, ცენტრალურ პარკამდე 7 წუთი.', en: '40 Rustaveli St, 7 minutes to the central park.', ru: 'ул. Руставели 40, 7 минут до центрального парка.' }, map: 'https://www.google.com/maps/search/?api=1&query=Borjomi' } } },
    { slug: 'dzveli', name: 'ძველი უბნის ბინები', city: 'თბილისი', theme: 'kalaki', accent: '#B4472F', types: types(.9),
      site: { hero: { img: P + 'lounge.jpg', tagline: { ka: 'ბინები ძველ თბილისში, აბანოთუბნიდან ხუთ წუთში ფეხით', en: 'Apartments in Old Tbilisi, five minutes on foot from the baths', ru: 'Апартаменты в Старом Тбилиси, в пяти минутах от бань' } },
        about: { img: P + 'room-suite.jpg', text: { ka: 'ხუთი ბინა ერთ შენობაში: თითოეულს აქვს სამზარეულო, სწრაფი ინტერნეტი და თვითჩეკინი. ქალაქის ცენტრი კარს გარეთაა.', en: 'Five apartments in one building, each with a kitchen, fast internet and self check-in. The centre is right outside.', ru: 'Пять квартир в одном доме: кухня, быстрый интернет и самостоятельное заселение. Центр прямо за дверью.' } },
        amenities: ['wifi', 'kitchen', 'center', 'transfer', 'balcony'], gallery: [P + 'room-std.jpg', P + 'room-family.jpg', P + 'lounge.jpg', P + 'room-suite2.jpg'], rooms: roomsPh,
        location: { text: { ka: 'ლესელიძის ქუჩა 8, ძველი თბილისი.', en: '8 Leselidze St, Old Tbilisi.', ru: 'ул. Леселидзе 8, Старый Тбилиси.' }, map: 'https://www.google.com/maps/search/?api=1&query=Old+Tbilisi' } } },
    { slug: 'kotejebi', name: 'ტყის კოტეჯები', city: 'აბასთუმანი', theme: 'tye', accent: '#3E9B5F', types: types(.75),
      site: { hero: { img: P + 'pool.jpg', tagline: { ka: 'ხის კოტეჯები ფიჭვნარში, აუზით და სიჩუმით', en: 'Wooden cottages in a pine forest, with a pool and silence', ru: 'Деревянные коттеджи в сосновом лесу, бассейн и тишина' } },
        about: { img: P + 'fire.jpg', text: { ka: 'აბასთუმნის ჰაერი, ხის სახლები და ბუხარი. მოდით დასასვენებლად, ქალაქის ხმაურისგან შორს.', en: 'Abastumani air, wooden houses and a fireplace. Come to rest far from city noise.', ru: 'Воздух Абастумани, деревянные дома и камин. Отдых вдали от городского шума.' } },
        amenities: ['wifi', 'parking', 'pool', 'fireplace', 'bbq', 'pets'], gallery: [P + 'pool.jpg', P + 'fire.jpg', P + 'garden.jpg'], rooms: roomsPh,
        location: { text: { ka: 'ობსერვატორიის გზა, ცენტრიდან 3 კმ.', en: 'Observatory road, 3 km from the centre.', ru: 'Дорога к обсерватории, 3 км от центра.' }, map: 'https://www.google.com/maps/search/?api=1&query=Abastumani' } } },
  ];

  // only for scripts/check-layout.py: the longest name and town we expect, never listed
  const STRESS = { slug: 'test-long', hidden: true, name: 'საოჯახო სასტუმრო „დიდი მთის ძველი სახლი“', city: 'სტეფანწმინდა (ყაზბეგი)', theme: 'kva', accent: '#0E857D', types: types(1.4), site: HOTELS[0].site };
  const MINE = 'v2-my-hotel';
  const mine = () => { try { return JSON.parse(localStorage.getItem(MINE) || 'null'); } catch (e) { return null; } };
  function saveMine({ name, city, theme, accent, email }) {
    const h = { slug: 'my', mine: true, name, city, theme, accent, email, types: types(1),
      site: { hero: { img: P + 'facade.jpg', tagline: { ka: 'აქ დაწერეთ ერთი წინადადება თქვენს სასტუმროზე', en: 'One sentence about your hotel', ru: 'Одно предложение о вашем отеле' } },
        about: { img: P + 'garden.jpg', text: { ka: 'აქ იქნება თქვენი სასტუმროს აღწერა. ტექსტს და ფოტოებს ადმინში შეცვლით.', en: 'Your hotel description goes here. Change texts and photos in admin.', ru: 'Здесь будет описание вашего отеля. Тексты и фото меняются в админке.' } },
        amenities: ['wifi', 'parking'], gallery: [], rooms: roomsPh, location: { text: city } } };
    try { localStorage.setItem(MINE, JSON.stringify(h)); localStorage.removeItem('v2-demo-my'); localStorage.removeItem('v2-demo-look-my'); } catch (e) {}
    return h;
  }
  const list = () => [...(mine() ? [mine()] : []), ...HOTELS];
  const get = slug => list().find(h => h.slug === slug) || (slug === STRESS.slug ? STRESS : null);
  return { list, get, mine, saveMine, ROOMS, THEMES: ['kva', 'ezo', 'kalaki', 'zghva', 'ghvino', 'minimali', 'tye', 'butiki', 'peradi', 'klasika'] };
})();
