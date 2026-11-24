import { describe, it, expect } from 'vitest';
import { cleanContent } from '../src/db/clean.js';

describe('site content is checked before it is stored', () => {
  it('keeps what the admin saves', () => {
    const c = { site: { theme: 'jade', accent: '#3F7A4E', font: 'serif', hero: { img: 'media/abc.webp', tagline: { ka: 'ტექსტი', en: 'Text' } },
      gallery: ['media/a.jpg', 'img/h/blue-house.jpg'], amenities: ['wifi', 'pets'], rooms: { std: { text: { ka: 'ნომერი' }, photos: ['media/r.webp'] } },
      kids: { mode: 'fixed', price: 20 }, pin: { lat: 41.75, lng: 43.52 },
      food: { hide: ['n123'], own: [{ name: { ka: 'ჩემი კაფე' }, kind: 'cafe', map: 'https://maps.app.goo.gl/x1' }] } },
      contact: { phone: '+995 555 12 34 56', addr: { ka: 'ქუჩა 1' } }, faq: [{ q: { ka: 'კ' }, a: { ka: 'პ' } }] };
    expect(cleanContent(c)).toEqual(c);
  });
  it('drops unknown keys, script links and odd values', () => {
    const out = cleanContent({ evil: 1, site: { theme: 'x', accent: 'red', hero: { img: 'javascript:alert(1)', tagline: '<b>x</b>' },
      gallery: ['data:image/png;base64,AA', 'media/ok.jpg'], amenities: ['wifi', 'casino'], kids: { mode: 'fixed', price: -5 },
      location: { map: 'javascript:alert(1)' }, food: { own: [{ name: { ka: 'x' }, map: 'https://evil.example/maps' }] } } });
    expect(out.evil).toBeUndefined();
    expect(out.site.theme).toBeUndefined();
    expect(out.site.accent).toBeUndefined();
    expect(out.site.hero.img).toBeUndefined();
    expect(out.site.hero.tagline).toEqual({ ka: '<b>x</b>' }); // text stays text; the site escapes it
    expect(out.site.gallery).toEqual(['media/ok.jpg']);
    expect(out.site.amenities).toEqual(['wifi']);
    expect(out.site.kids).toEqual({ mode: 'fixed' });
    expect(out.site.location).toBeUndefined();
    expect(out.site.food.own[0].map).toBeUndefined();
  });
  it('cuts very long texts', () => {
    expect(cleanContent({ site: { about: { text: { ka: 'ა'.repeat(9000) } } } }).site.about.text.ka.length).toBe(3000);
  });
});
