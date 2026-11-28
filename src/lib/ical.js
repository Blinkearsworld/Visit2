// iCal (RFC 5545), only what calendar sync between booking sites needs: whole-day busy periods.
// Booking.com, Airbnb, VRBO and Google Calendar all read and write this.

// unfold lines ("\r\n " continues a line), read VEVENTs: { uid, from, to, summary } with dates as YYYY-MM-DD (to = check-out)
export function parseIcs(text) {
  const lines = String(text || '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const out = []; let ev = null;
  const day = v => { const m = String(v || '').match(/(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (line === 'END:VEVENT') {
      if (ev && ev.from) { if (!ev.to || ev.to <= ev.from) { const d = new Date(ev.from + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); ev.to = d.toISOString().slice(0, 10); } out.push(ev); }
      ev = null; continue;
    }
    if (!ev) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const key = line.slice(0, i).split(';')[0].toUpperCase(), val = line.slice(i + 1);
    if (key === 'DTSTART') ev.from = day(val);
    else if (key === 'DTEND') ev.to = day(val);
    else if (key === 'UID') ev.uid = val.slice(0, 200);
    else if (key === 'SUMMARY') ev.summary = val.slice(0, 120);
  }
  return out;
}

const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const ymd = d => d.replace(/-/g, '');
// a room's busy days for other sites: dates only, never the guest's name or phone
export function buildIcs({ name, events, stamp }) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Visit2.ge//Calendar//KA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(name)];
  for (const e of events) L.push('BEGIN:VEVENT', 'UID:' + e.uid, 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + ymd(e.from), 'DTEND;VALUE=DATE:' + ymd(e.to), 'SUMMARY:' + esc(e.summary || 'Not available'), 'END:VEVENT');
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}
