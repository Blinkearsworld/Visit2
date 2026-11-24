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

  // kind: what guests look for on Visit2.ge (mountain, sea, wine, city, nature)
  const I = n => 'img/h/' + n + '.jpg';
  const T3 = (ka, en, ru) => ({ ka, en, ru });
  const H = (slug, name, nameEn, nameRu, city, kind, theme, accent, k, photos, tag, about, amenities, loc, extra = {}) => ({
    slug, name, nameT: { en: nameEn, ru: nameRu }, city, kind, theme, accent, types: types(k), cover: photos[0], ...extra,
    site: { hero: { img: I(photos[0]), tagline: tag }, about: { img: I(photos[1] || photos[0]), text: about },
      amenities, gallery: photos.slice(1).map(I), rooms: roomsPh, location: { text: loc, map: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(city) } },
  });
  const HOTELS = [
    H('mta', 'მთის სახლი', 'Mountain House', 'Горный дом', 'ბაკურიანი', 'mountain', 'opal', '#0E857D', 1, ['bakuriani-chalet', 'ski-spa', 'gudauri-lodge'],
      T3('თბილი ხის სახლი ნაძვნარში, საბაგიროდან ხუთ წუთში', 'A warm wooden house in the firs, five minutes from the lifts', 'Тёплый деревянный дом среди елей, в пяти минутах от подъёмника'),
      T3('რვა ნომერი, ბუხარი მისაღებში და თხილამურების ოთახი. დილით ცხელი საუზმე, საღამოს ცხელი ღვინო.', 'Eight rooms, a fireplace in the lounge and a ski room. Hot breakfast in the morning, mulled wine at night.', 'Восемь номеров, камин в гостиной и комната для лыж. Утром горячий завтрак, вечером глинтвейн.'),
      ['wifi', 'parking', 'fireplace', 'ski', 'breakfast', 'pets'], T3('დიდველის გზა 4, საბაგირომდე 400 მ.', '4 Didveli Rd, 400 m to the lifts.', 'Дорога Дидвели 4, 400 м до подъёмника.'), { lat: 41.7512, lng: 43.5268 }),
    H('nino', 'ნინოს ეზო', "Nino's Courtyard", 'Двор Нино', 'ბორჯომი', 'nature', 'jade', '#3F7A4E', .8, ['blue-house', 'imereti-garden', 'marani-yard'],
      T3('ცისფერი სახლი დიდ ეზოში, კაკლის ხის ჩრდილში', 'A blue house in a big garden, in the shade of a walnut tree', 'Голубой дом в большом саду, в тени ореха'),
      T3('საუზმე ეზოში იშლება, ბავშვები ბალახზე თამაშობენ, მინერალური წყლების პარკამდე ათი წუთია.', 'Breakfast is served in the garden, kids play on the grass, and the mineral water park is ten minutes away.', 'Завтрак во дворе, дети играют на траве, до парка минеральных вод десять минут.'),
      ['wifi', 'parking', 'breakfast', 'garden', 'bbq', 'kids'], T3('რუსთაველის ქუჩა 40.', '40 Rustaveli St.', 'ул. Руставели 40.'), { promo: true, lat: 41.8402, lng: 43.3869 }),
    H('dzveli', 'ძველი უბნის ბინები', 'Old Town Apartments', 'Апартаменты в Старом городе', 'თბილისი', 'city', 'umber', '#B4472F', .9, ['tbilisi-yard', 'kutaisi-pink'],
      T3('ბინები თბილისურ ეზოში, აბანოთუბნიდან ხუთ წუთში', 'Apartments in a Tbilisi courtyard, five minutes from the baths', 'Квартиры в тбилисском дворике, в пяти минутах от бань'),
      T3('ხუთი ბინა ხის აივნებით: სამზარეულო, სწრაფი ინტერნეტი და თვითჩეკინი. ქალაქი კარს გარეთაა.', 'Five flats with wooden balconies: kitchen, fast internet and self check-in. The city is right outside.', 'Пять квартир с деревянными балконами: кухня, быстрый интернет, самостоятельное заселение.'),
      ['wifi', 'kitchen', 'center', 'balcony'], T3('ლესელიძის ქუჩა 8.', '8 Leselidze St.', 'ул. Леселидзе 8.'), { lat: 41.6889, lng: 44.8095 }),
    H('kotejebi', 'ტყის კოტეჯები', 'Forest Cottages', 'Лесные коттеджи', 'აბასთუმანი', 'nature', 'onyx', '#3E9B5F', .75, ['barrel-cabins', 'a-frame'],
      T3('ხის კოტეჯები ფიჭვნარში, ცხელი აბაზანით ღია ცის ქვეშ', 'Wooden cabins in the pines, with an outdoor hot tub', 'Деревянные домики в соснах, с купелью под открытым небом'),
      T3('ოთხი კოტეჯი, თითოს საკუთარი ტერასა. ჰაერი, სიჩუმე და ღამით ვარსკვლავები ობსერვატორიის მხრიდან.', 'Four cabins, each with its own deck. Clean air, silence and the stars from the observatory hill at night.', 'Четыре домика, у каждого своя терраса. Воздух, тишина и звёзды над обсерваторией.'),
      ['wifi', 'parking', 'bbq', 'pets', 'balcony'], T3('ობსერვატორიის გზა, ცენტრიდან 3 კმ.', 'Observatory road, 3 km from the centre.', 'Дорога к обсерватории, 3 км от центра.'), { lat: 41.7552, lng: 42.8341 }),
    H('alazani', 'ალაზნის ვილა', 'Alazani Villa', 'Вилла Алазани', 'თელავი', 'wine', 'lilac', '#7A2638', 1.3, ['kakheti-villa', 'stone-pool', 'marani-yard'],
      T3('ქვის ვილა ვენახში, აუზით და კავკასიონის ხედით', 'A stone villa in the vineyard, with a pool and a view of the Caucasus', 'Каменная вилла среди виноградников, с бассейном и видом на Кавказ'),
      T3('საკუთარი მარანი და ღვინის დეგუსტაცია, საღამოს ვახშამი ტერასაზე, დილით აუზი და ალაზნის ველი.', 'Our own marani and tastings, dinner on the terrace, a morning swim above the Alazani valley.', 'Свой марани и дегустации, ужин на террасе, утром бассейн над Алазанской долиной.'),
      ['wifi', 'parking', 'pool', 'breakfast', 'garden', 'balcony'], T3('წინანდლის გზა, თელავიდან 6 კმ.', 'Tsinandali road, 6 km from Telavi.', 'Дорога на Цинандали, 6 км от Телави.'), { promo: true, lat: 41.9135, lng: 45.4602 }),
    H('qvevri', 'ქვევრის სახლები', 'Qvevri Houses', 'Дома-квеври', 'ყვარელი', 'wine', 'amber', '#B4472F', 1.1, ['qvevri-pods', 'marani-yard'],
      T3('იცხოვრე ქვევრში: სამი ოთახი ვენახის შუაგულში', 'Sleep in a qvevri: three rooms in the middle of a vineyard', 'Ночь в квеври: три номера посреди виноградника'),
      T3('ქვევრის ფორმის სახლები დიდი ფანჯრით ველზე. ღვინო ჩვენი მარნიდან, საუზმე ტერასაზე.', 'Qvevri-shaped houses with a big window onto the valley. Wine from our marani, breakfast on the deck.', 'Дома в форме квеври с большим окном на долину. Вино из нашего марани, завтрак на террасе.'),
      ['wifi', 'parking', 'breakfast', 'balcony'], T3('ვენახის გზა, ყვარლის ცენტრიდან 4 კმ.', 'Vineyard road, 4 km from Kvareli.', 'Дорога через виноградники, 4 км от Кварели.'), { lat: 41.9531, lng: 45.8098 }),
    H('terasa', 'სიღნაღის ტერასა', 'Sighnaghi Terrace', 'Терраса Сигнахи', 'სიღნაღი', 'wine', 'ivory', '#8A5A2B', .95, ['sighnaghi-terrace', 'tbilisi-yard'],
      T3('საუზმე ტერასაზე, ქვემოთ მთელი ალაზნის ველი', 'Breakfast on the terrace with the whole Alazani valley below', 'Завтрак на террасе, внизу вся Алазанская долина'),
      T3('სიყვარულის ქალაქის ძველ ქუჩაზე: ექვსი ნომერი თაღოვანი ფანჯრებით და ველის ხედით.', 'On an old street of the city of love: six rooms with arched windows and valley views.', 'На старой улице города любви: шесть номеров с арочными окнами и видом на долину.'),
      ['wifi', 'breakfast', 'center', 'balcony'], T3('ბარატაშვილის ქუჩა 15.', '15 Baratashvili St.', 'ул. Бараташвили 15.'), { lat: 41.6198, lng: 45.9218 }),
    H('zghva', 'ზღვის ხედი', 'Sea View', 'Вид на море', 'ბათუმი', 'sea', 'cobalt', '#1F7FB0', 1.2, ['sea-resort', 'sea-deck'],
      T3('აუზი, ბაღი და ზღვამდე ორმოცი ნაბიჯი', 'A pool, a garden and forty steps to the sea', 'Бассейн, сад и сорок шагов до моря'),
      T3('ნომრები აივნით ზღვაზე, აუზი ჰორტენზიების ბაღში, ბულვარამდე ფეხით ათი წუთი.', 'Rooms with sea-facing balconies, a pool in a hydrangea garden, ten minutes on foot to the boulevard.', 'Номера с балконами на море, бассейн в саду гортензий, до бульвара десять минут пешком.'),
      ['wifi', 'pool', 'sea', 'breakfast', 'parking'], T3('მწვანე კონცხის გზა, ბათუმის ცენტრიდან 8 კმ.', 'Green Cape road, 8 km from central Batumi.', 'Дорога на Зелёный мыс, 8 км от центра Батуми.'), { lat: 41.6935, lng: 41.7109 }),
    H('gonio', 'გონიოს სახლი', 'Gonio Hill House', 'Дом на холме в Гонио', 'გონიო', 'sea', 'alba', '#1F1A17', 1, ['sea-deck', 'sea-resort'],
      T3('შუშის სახლი ბორცვზე, ჯაკუზით და ზღვის ხედით', 'A glass house on the hill, with a hot tub and a sea view', 'Стеклянный дом на холме, с джакузи и видом на море'),
      T3('ორისთვის: საწოლიდან ზღვა ჩანს, ტერასაზე ჯაკუზია, ქვემოთ ციტრუსების ბაღი.', 'For two: the sea from your bed, a hot tub on the deck, a citrus garden below.', 'Для двоих: море видно из кровати, джакузи на террасе, внизу цитрусовый сад.'),
      ['wifi', 'sea', 'parking', 'balcony'], T3('გონიოს ზედა გზა.', 'Upper Gonio road.', 'Верхняя дорога Гонио.'), { lat: 41.5672, lng: 41.5759 }),
    H('gudauri', 'გუდაური ლოჯი', 'Gudauri Lodge', 'Гудаури Лодж', 'გუდაური', 'mountain', 'alba', '#2F5A8A', 1.25, ['gudauri-lodge', 'ski-spa'],
      T3('თანამედროვე ლოჯი ფერდობზე: თხილამურით კარამდე', 'A modern lodge on the slope: ski in, ski out', 'Современный лодж на склоне: на лыжах до двери'),
      T3('თორმეტი ნომერი აივნით მთაზე, სადილი პანორამულ რესტორანში, საბაგირო ასი მეტრში.', 'Twelve rooms with mountain balconies, dinner in the panoramic restaurant, the lift a hundred metres away.', 'Двенадцать номеров с балконами на горы, ужин в панорамном ресторане, подъёмник в ста метрах.'),
      ['wifi', 'parking', 'ski', 'breakfast'], T3('ახალი გუდაური, ქვემო ტრასასთან.', 'New Gudauri, by the lower run.', 'Новый Гудаури, у нижней трассы.'), { lat: 42.4768, lng: 44.4801 }),
    H('alpine', 'ალპური სპა', 'Alpine Spa', 'Альпийский спа', 'გუდაური', 'mountain', 'indigo', '#B08D57', 1.8, ['ski-spa', 'gudauri-lodge'],
      T3('გათბობილი აუზი თოვლში, ტრასების ხედით', 'A heated pool in the snow, facing the slopes', 'Подогреваемый бассейн среди снега, с видом на трассы'),
      T3('ბუტიკ სასტუმრო ქვისა და ხისგან: სპა, სააუნა და აუზი, რომელიც ზამთარშიც თბილია.', 'A boutique hotel of stone and wood: spa, sauna and a pool that stays warm all winter.', 'Бутик-отель из камня и дерева: спа, сауна и бассейн, тёплый даже зимой.'),
      ['wifi', 'pool', 'ski', 'breakfast', 'parking'], T3('გუდაურის ზედა პლატო.', 'Upper Gudauri plateau.', 'Верхнее плато Гудаури.'), { lat: 42.4719, lng: 44.4893 }),
    H('svaneti', 'სვანური სახლი', 'Svan House', 'Сванский дом', 'მესტია', 'mountain', 'opal', '#8A5A2B', .85, ['mestia-house', 'kazbegi-stone'],
      T3('ქვის სახლი სვანური კოშკის გვერდით', 'A stone house next to a Svan tower', 'Каменный дом рядом со сванской башней'),
      T3('ოჯახური სასტუმრო: სვანური მარილი და კუბდარი სუფრაზე, აივნიდან უშბა ჩანს.', 'A family guesthouse: Svan salt and kubdari at the table, Ushba from the balcony.', 'Семейный гостевой дом: сванская соль и кубдари за столом, с балкона видна Ушба.'),
      ['wifi', 'breakfast', 'parking', 'balcony'], T3('სეტის მოედნიდან 600 მ.', '600 m from Seti square.', '600 м от площади Сети.'), { lat: 43.0447, lng: 42.7254 }),
    H('kazbegi', 'ყაზბეგის ქვა', 'Kazbegi Stone', 'Казбеги Стоун', 'სტეფანწმინდა (ყაზბეგი)', 'mountain', 'indigo', '#2F5A8A', 1.15, ['kazbegi-stone', 'mestia-house'],
      T3('ვარდისფერი ქვის სასტუმრო მყინვარწვერის ძირას', 'A pink stone hotel at the foot of Kazbek', 'Отель из розового камня у подножия Казбека'),
      T3('ცამეტი ნომერი ფრანგული აივნებით, ტერასა მწვადით და ნათელი კიბე მთის ხედზე.', 'Thirteen rooms with French balconies, a terrace with a grill and a glass staircase facing the mountains.', 'Тринадцать номеров с французскими балконами, терраса с мангалом и стеклянная лестница с видом на горы.'),
      ['wifi', 'parking', 'breakfast', 'bbq'], T3('ყაზბეგის ქუჩა 21.', '21 Kazbegi St.', 'ул. Казбеги 21.'), { lat: 42.6566, lng: 44.6429 }),
    H('racha', 'რაჭის ბაღი', 'Racha Garden', 'Рачинский сад', 'ამბროლაური', 'nature', 'jade', '#3F7A4E', .8, ['imereti-garden', 'blue-house'],
      T3('ძველი სახლი ვაზის ფანჩატურით და აუზით მთებში', 'An old house with a vine pergola and a pool in the hills', 'Старый дом с виноградной беседкой и бассейном в горах'),
      T3('ხვანჭკარის მხარე: საუზმე ფანჩატურში, აუზი ბაღში, ოჯახური ვახშამი.', 'Khvanchkara country: breakfast under the vines, a pool in the garden, family dinners.', 'Край хванчкары: завтрак под лозой, бассейн в саду, семейные ужины.'),
      ['wifi', 'pool', 'garden', 'breakfast', 'kids'], T3('ამბროლაურის ცენტრიდან 2 კმ.', '2 km from Ambrolauri.', '2 км от Амбролаури.'), { lat: 42.5251, lng: 43.1528 }),
    H('tba', 'ტბის სასტუმრო', 'Lake Hotel', 'Отель у озера', 'ლაგოდეხი', 'nature', 'alba', '#0E857D', 1.05, ['lake-hotel', 'forest-concrete'],
      T3('ტბის პირას: ნავი, ხიდური და ტყე უკან', 'By the lake: a boat, a jetty and the forest behind', 'На берегу озера: лодка, причал и лес за спиной'),
      T3('ნაკრძალის კარიბჭესთან: ტერასა წყალზე, დილით ნავით გასეირნება, საღამოს ჩანჩქერისკენ ბილიკი.', 'At the gate of the reserve: a terrace on the water, a morning row, an evening walk to the waterfall.', 'У ворот заповедника: терраса над водой, утром лодка, вечером тропа к водопаду.'),
      ['wifi', 'parking', 'breakfast', 'kids'], T3('ნაკრძალის გზა.', 'Reserve road.', 'Дорога к заповеднику.'), { lat: 41.8341, lng: 46.2963 }),
    H('kutaisi', 'ქუთაისის სახლი', 'Kutaisi House', 'Дом в Кутаиси', 'ქუთაისი', 'city', 'ivory', '#B4472F', .7, ['kutaisi-pink', 'tbilisi-yard'],
      T3('ძველი სახლი ცენტრში, ეზოთი ვაზის ქვეშ', 'An old house in the centre, with a courtyard under the vines', 'Старый дом в центре, с двором под лозой'),
      T3('ექვსი ნომერი ცოლის ქუჩაზე: ფეხით ბაზრამდე და თეთრი ხიდამდე, ეზოში ღვინის საღამოები.', 'Six rooms on a quiet street: walk to the market and the White Bridge, wine evenings in the yard.', 'Шесть номеров на тихой улице: пешком до рынка и Белого моста, винные вечера во дворе.'),
      ['wifi', 'center', 'breakfast'], T3('ტაბიძის ქუჩა 11.', '11 Tabidze St.', 'ул. Табидзе 11.'), { lat: 42.2701, lng: 42.7029 }),
  ];
  const KINDS = { mountain: ['მთა', 'Mountains', 'Горы'], sea: ['ზღვა', 'Sea', 'Море'], wine: ['ღვინო და კახეთი', 'Wine country', 'Вино и Кахетия'], city: ['ქალაქი', 'City', 'Город'], nature: ['ბუნება', 'Nature', 'Природа'] };

  // only for scripts/check-layout.py: the longest name and town we expect, never listed
  const STRESS = { slug: 'test-long', hidden: true, name: 'საოჯახო სასტუმრო „დიდი მთის ძველი სახლი“', city: 'სტეფანწმინდა (ყაზბეგი)', theme: 'kva', accent: '#0E857D', types: types(1.4), site: HOTELS[0].site, kind: 'mountain', cover: 'bakuriani-chalet', lat: 42.66, lng: 44.64 };
  const MINE = 'v2-my-hotel';
  const mine = () => { try { return JSON.parse(localStorage.getItem(MINE) || 'null'); } catch (e) { return null; } };
  function saveMine({ name, city, theme, accent, email }) {
    const h = { slug: 'my', mine: true, name, city, theme, accent, email, types: types(1), kind: 'nature', cover: 'forest-concrete',
      site: { hero: { img: I('forest-concrete'), tagline: { ka: 'აქ დაწერეთ ერთი წინადადება თქვენს სასტუმროზე', en: 'One sentence about your hotel', ru: 'Одно предложение о вашем отеле' } },
        about: { img: I('stone-pool'), text: { ka: 'აქ იქნება თქვენი სასტუმროს აღწერა. ტექსტს და ფოტოებს ადმინში შეცვლით.', en: 'Your hotel description goes here. Change texts and photos in admin.', ru: 'Здесь будет описание вашего отеля. Тексты и фото меняются в админке.' } },
        amenities: ['wifi', 'parking'], gallery: [], rooms: roomsPh, location: { text: city } } };
    try { localStorage.setItem(MINE, JSON.stringify(h)); localStorage.removeItem('v2-demo-my'); localStorage.removeItem('v2-demo-look-my'); } catch (e) {}
    return h;
  }
  const list = () => [...(mine() ? [mine()] : []), ...HOTELS];
  const get = slug => list().find(h => h.slug === slug) || (slug === STRESS.slug ? STRESS : null);
  return { list, get, mine, saveMine, ROOMS, KINDS, THEMES: ['opal', 'onyx', 'jade', 'amber', 'indigo', 'ivory', 'cobalt', 'lilac', 'umber', 'alba'] };
})();
