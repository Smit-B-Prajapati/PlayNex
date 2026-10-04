const http = require('http');
const assert = require('assert');

function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 8000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body, status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING COURT BOOKING API AUDIT ---');
  const testDate = '2026-10-05'; // Use a fresh date for test suite

  // Test 1: Book with Leo Chen (CC-MEM-00103) - 1 Hour Junior plan
  const res1 = await postJson('/champions_club/bookings/create', {
    court_id: '1',
    start_time: `${testDate} 06:00:00`,
    duration_hours: 1,
    booking_type: 'member',
    member_id: 'CC-MEM-00103',
    member_name: 'Leo Chen',
    member_plan: 'junior',
    is_social_play: false
  });
  console.log('Test 1 (Leo Chen - CC-MEM-00103):', res1);
  assert(res1.success === true, 'Test 1 should succeed: ' + JSON.stringify(res1));

  // Test 2: Book with Elena Rostova (CC-MEM-00110) - 2 Hours Silver plan
  const res2 = await postJson('/champions_club/bookings/create', {
    court_id: '2',
    start_time: `${testDate} 07:00:00`,
    duration_hours: 2,
    booking_type: 'member',
    member_id: 'CC-MEM-00110',
    member_name: 'Elena Rostova',
    member_plan: 'silver',
    is_social_play: false
  });
  console.log('Test 2 (Elena Rostova - CC-MEM-00110):', res2);
  assert(res2.success === true, 'Test 2 should succeed: ' + JSON.stringify(res2));

  // Test 3: Book with David Vance (CC-MEM-00101) - 3 Hours Gold plan
  const res3 = await postJson('/champions_club/bookings/create', {
    court_id: '3',
    start_time: `${testDate} 09:00:00`,
    duration_hours: 3,
    booking_type: 'member',
    member_id: 'CC-MEM-00101',
    member_name: 'David Vance',
    member_plan: 'gold',
    is_social_play: false
  });
  console.log('Test 3 (David Vance - CC-MEM-00101):', res3);
  assert(res3.success === true, 'Test 3 should succeed: ' + JSON.stringify(res3));

  // Test 4: Duration limit validation (Junior trying 2 hours)
  const res4 = await postJson('/champions_club/bookings/create', {
    court_id: '1',
    start_time: `${testDate} 11:00:00`,
    duration_hours: 2,
    booking_type: 'member',
    member_id: 'CC-MEM-00103',
    member_name: 'Leo Chen',
    member_plan: 'junior',
    is_social_play: false
  });
  console.log('Test 4 (Junior 2-hr limit check):', res4);
  assert(res4.success === false, 'Junior should not be allowed 2 hours');
  assert(res4.error.includes('Duration Limit Exceeded'), 'Should report duration limit exceeded');

  // Test 5: Conflict check (Trying to book overlapping time on court 1 at 06:00)
  const res5 = await postJson('/champions_club/bookings/create', {
    court_id: '1',
    start_time: `${testDate} 06:00:00`,
    duration_hours: 1,
    booking_type: 'member',
    member_id: 'CC-MEM-00105',
    member_name: 'Siddharth Rao',
    member_plan: 'gold',
    is_social_play: false
  });
  console.log('Test 5 (Conflict on Court 1 at 06:00):', res5);
  assert(res5.success === false, 'Should reject double booking on court 1');
  assert(res5.error.includes('already booked'), 'Should state interval already booked');

  // Test 6: Walk-in guest booking
  const res6 = await postJson('/champions_club/bookings/create', {
    court_id: '5',
    start_time: `${testDate} 14:00:00`,
    duration_hours: 1,
    booking_type: 'walkin',
    walkin_name: 'Novak Djokovic',
    is_social_play: false
  });
  console.log('Test 6 (Walk-in booking):', res6);
  assert(res6.success === true, 'Walk-in booking should succeed');

  // Test 7: Cancel booking and release slot
  const cancelRes = await postJson('/champions_club/bookings/cancel', {
    booking_id: res1.reference
  });
  console.log('Test 7 (Cancel booking):', cancelRes);
  assert(cancelRes.success === true, 'Cancellation should succeed');

  // Test 8: Re-book released slot at 06:00 on court 1
  const res8 = await postJson('/champions_club/bookings/create', {
    court_id: '1',
    start_time: `${testDate} 06:00:00`,
    duration_hours: 1,
    booking_type: 'member',
    member_id: 'CC-MEM-00105',
    member_name: 'Siddharth Rao',
    member_plan: 'gold',
    is_social_play: false
  });
  console.log('Test 8 (Re-book released slot on Court 1):', res8);
  assert(res8.success === true, 'Re-booking released slot should succeed');

  console.log('--- ALL BACKEND & BOOKING VALIDATION AUDITS PASSED 100% ---');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
