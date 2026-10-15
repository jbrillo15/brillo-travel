/* Fake sheet data shaped like the script's raw read (values + display).
   Trip dates and cities match the real trip so date logic is exercised, but
   every name, flight time, booking ref and confirmation number is FAKE
   (HANDOFF §18 rule 9). The flights keep the real edge cases: leg 2 lands the
   next calendar day, and the return lands "before" it departs on the clock. */
(function () {
  'use strict';
  window.FIXTURES = window.FIXTURES || {};

  function tab(rows) { return { values: rows, display: rows.map(function (r) { return r.map(function (v) { return v === null || v === undefined ? '' : String(v); }); }) }; }

  var IT_H = ['ID', 'Date', 'Time', 'Slot', 'City', 'Title', 'Kind', 'Place (EN)', 'Place (JA)', 'Maps', 'Getting there',
    'Notes', 'Booking ref', 'Est cost ¥ pp', 'Allergy risk', 'Booking status', 'Done', 'Updated'];
  function it(id, date, time, slot, city, title, extra) {
    var r = [id, date, time || '', slot, city, title, '', '', '', '', '', '', '', '', '', '', false, ''];
    Object.keys(extra || {}).forEach(function (k) { r[IT_H.indexOf(k)] = extra[k]; });
    return r;
  }

  function good() {
    var raw = build();
    // A 17-digit number loses precision as a JS number; the display string keeps every digit.
    raw.Hotels.display[1][12] = '11112222333344445';
    return raw;
  }

  function build() {
    return {
      Settings: tab([
        ['Key', 'Value'], ['Trip name', 'Test Trip'], ['Trip start', '2026-11-18'], ['Trip end', '2026-11-26'],
        ['First spend day', '2026-11-19'], ['Trip time zone', 'Asia/Tokyo'], ['Home time zone', 'America/Los_Angeles'],
        ['Travelers', 'Jordan, Lindsay'], ['Cities', 'Osaka, Kyoto, Tokyo, Travel'], ['Daily budget ¥ (both)', 220000],
        ['Shopping budget ¥', ''], ['Starting cash ¥', ''], ['Large amount confirm ¥', 20000],
        ['FX rate (live)', '#N/A'], ['FX rate (fallback)', 158.3], ['Min app version', '0.1.0']
      ]),
      Itinerary: tab([IT_H,
        it('it_a1', '2026-11-18', '', 'All day', 'Travel', 'Fly out', { Kind: 'Transit' }),
        it('it_a2', '2026-11-19', '4:55 PM', 'Evening', 'Osaka', 'Land and train to the hotel', { Kind: 'Transit', 'Est cost ¥ pp': '¥1,000' }),
        it('it_a3', '2026-11-20', '', 'Morning', 'Osaka', 'Fake market', { Kind: 'Food', 'Allergy risk': 'Caution', 'Place (JA)': 'テスト市場' }),
        it('it_a4', '2026-11-20', '', 'Midday', 'Osaka', 'Fake lunch', { 'Booking status': 'To book', 'Est cost ¥ pp': 5000 }),
        ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', false, ''],          // blank row mid-table
        it('it_a5', '2026-11-21', '', 'Afternoon', 'Kyoto', 'Fake temple', { Kind: 'temple' }),
        it('it_a6', '2026-11-22', '18:00', 'Evening', 'Kyoto', 'Fake illumination', { 'Allergy risk': 'High' }),
        it('it_a7', '2026-11-23', '', 'Morning', 'Travel', 'Fake train to Tokyo'),
        it('it_a8', '2026-11-24', '', 'All day', 'Tokyo', 'Fake theme park'),
        it('it_a9', '2026-11-25', '', 'Night', 'Tokyo', 'Fake izakaya', { Time: '00:30' }),
        it('it_b1', '2026-11-26', '19:15', 'Evening', 'Travel', 'Fly home')
      ]),
      Hotels: tab([
        ['ID', 'City', 'Hotel (EN)', 'Hotel (JA)', 'Address (EN)', 'Address (JA)', 'Phone', 'Nearest station & exit',
          'Check-in date', 'Check-out date', 'Check-in time', 'Check-out time', 'Confirmation #', 'Breakfast', 'Total',
          'Currency', 'Payment', 'Free cancel by', 'Maps', 'Notes'],
        ['ho_1', 'Osaka', 'Hotel Alpha', 'ホテルアルファ', '1-1 Fake, Osaka', '大阪府テスト1-1', '06-0000-0000', 'Fake Stn exit 1',
          '2026-11-19', '2026-11-21', '3:00 PM', '10:00 AM', 11112222333344445, 'Yes', '', '', '', '', '', ''],
        ['ho_2', 'Kyoto', 'Hotel Beta', 'ホテルベータ', '2-2 Fake, Kyoto', '京都府テスト2-2', '075-000-0000', 'Fake Stn exit 2',
          '2026-11-21', '2026-11-23', '15:00', '11:00', '55556666777788889', 'No', '¥42,000', 'JPY', 'Pay at hotel', '2026-11-19', '', ''],
        ['ho_3', 'Tokyo', 'Hotel Gamma', 'ホテルガンマ', '3-3 Fake, Tokyo', '東京都テスト3-3', '03-0000-0000', 'Fake Stn exit 3',
          '2026-11-23', '2026-11-26', '15:00', '10:00', '99990000111122223', 'Yes', '', '', '', '', '', '']
      ]),
      Transportation: tab([
        ['ID', 'Type', 'Depart date', 'Depart time', 'Depart TZ', 'From', 'Arrive date', 'Arrive time', 'Arrive TZ', 'To',
          'Number', 'Booking #', 'Carrier', 'Seat', 'Notes'],
        ['tr_1', 'Flight', '2026-11-18', '6:05 AM', 'America/Los_Angeles', 'AAA', '2026-11-18', '10:40 AM', 'America/Vancouver', 'BBB', 'XX100', 'FAKE01', 'Fake Air', '', ''],
        ['tr_2', 'Flight', '2026-11-18', '1:30 PM', 'America/Vancouver', 'BBB', '2026-11-19', '4:55 PM', 'Asia/Tokyo', 'CCC', 'XX200', 'FAKE01', 'Fake Air', '', ''],
        ['tr_3', 'Flight', '2026-11-26', '7:15 PM', 'Asia/Tokyo', 'DDD', '2026-11-26', '12:25 PM', 'America/Los_Angeles', 'AAA', 'YY300', 'FAKE02', 'Fake Lines', '', '']
      ]),
      Expenses: tab([['ID', 'Created at', 'Trip date', 'Amount', 'Currency', 'Envelope', 'Category', 'Method', 'Paid by',
        'Note', 'Tax-free', 'Refund status', 'Device', 'Updated at', 'Deleted']]),
      Ideas: tab([['ID', 'Name (EN)', 'Name (JA)', 'City', 'Area', 'Category', 'Lat', 'Lng', 'Maps', 'Why', 'Hours / notes',
        'Allergy note', 'Source', 'Status', 'Planned date', 'Added by', 'Updated at', 'Deleted']]),
      Checklists: tab([
        ['ID', 'List', 'Item', 'Owner', 'Bag', 'Due', 'Done', 'Done by', 'Done at', 'Notes', 'Sort', 'Updated at', 'Deleted'],
        ['ck_1', 'Pre-trip', 'Fake task', 'Both', '—', '2026-10-20', false, '', '', '', '', '', false],
        ['', '', '', '', '', '', false, '', '', '', '', '', false]
      ]),
      Phrases: tab([
        ['ID', 'Category', 'English', 'Japanese', 'Romaji', 'Card', 'Verified', 'Source'],
        ['ph_1', 'Taxi', 'Please take me here.', 'ここへお願いします。', 'Koko e onegaishimasu.', true, false, 'test'],
        ['', '', '', '', '', false, false, '']
      ])
    };
  }

  window.FIXTURES.sheet = good;
  window.FIXTURES.tab = tab;
  window.FIXTURES.IT_H = IT_H;
  window.FIXTURES.it = it;
})();
