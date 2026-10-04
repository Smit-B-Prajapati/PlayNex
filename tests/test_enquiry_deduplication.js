const http = require('http');
const assert = require('assert');

function postJson(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 8000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runEnquiryDeduplicationTests() {
  console.log('='.repeat(75));
  console.log('CHAMPIONS CLUB — CRM ENQUIRY DEDUPLICATION & REPEAT VISITOR SUITE');
  console.log('='.repeat(75));

  // 1. Initial CRM leads count
  const initialRes = await postJson('/champions_club/crm/leads', {});
  assert(initialRes.success, 'Fetch leads must succeed');
  const initialLeads = initialRes.leads;
  const initialCount = initialLeads.length;
  console.log(`1. Initial active leads in CRM pipeline: ${initialCount}`);

  // 2. Submit a unique test visitor enquiry
  const testPhone = '9999988888';
  const testName = 'Aanya Sharma';
  console.log(`2. Submitting initial enquiry for '${testName}' (${testPhone})...`);
  const firstEnqRes = await postJson('/champions_club/enquiry/submit', {
    name: testName,
    phone: testPhone,
    email: 'aanya.sharma@example.com',
    plan: 'gold',
    source: 'website',
    message: 'Interested in weekend tennis memberships.'
  });

  assert(firstEnqRes.success, 'First enquiry submission must succeed');
  assert(firstEnqRes.reference, 'First enquiry must have reference');
  assert.strictEqual(firstEnqRes.is_existing, false, 'First enquiry should be marked as brand new (not existing)');
  const leadRef = firstEnqRes.reference;
  console.log(`  ✓ Created lead: ${leadRef}`);

  // Verify count increased by 1
  const afterFirstRes = await postJson('/champions_club/crm/leads', {});
  assert.strictEqual(afterFirstRes.leads.length, initialCount + 1, 'Total leads should increase by exactly 1');
  console.log(`  ✓ Total leads now: ${afterFirstRes.leads.length}`);

  // 3. Move lead to contacted or follow-up stage
  console.log(`3. Progressing lead ${leadRef} to 'contacted' stage...`);
  const contactRes = await postJson('/champions_club/crm/lead/contacted', { enquiry_id: leadRef });
  assert(contactRes.success, 'Contact stage progression must succeed');

  // 4. Submit duplicate enquiry with same phone
  console.log(`4. Submitting duplicate enquiry with same phone (${testPhone}) and new message...`);
  const repeatEnqRes = await postJson('/champions_club/enquiry/submit', {
    name: testName,
    phone: testPhone,
    email: 'aanya.sharma@example.com',
    plan: 'silver',
    source: 'website',
    message: 'Checking back regarding court timings.'
  });

  assert(repeatEnqRes.success, 'Repeat enquiry submission must succeed');
  assert.strictEqual(repeatEnqRes.is_existing, true, 'Repeat enquiry must be recognized as existing');
  assert.strictEqual(repeatEnqRes.reference, leadRef, `Reference must match original ${leadRef}`);
  console.log(`  ✓ Duplicate detected! Returned existing reference: ${repeatEnqRes.reference}`);

  // 5. Verify total leads count did NOT increase
  const afterRepeatRes = await postJson('/champions_club/crm/leads', {});
  assert.strictEqual(afterRepeatRes.leads.length, initialCount + 1, 'Total leads count MUST NOT increase on duplicate submission');
  console.log(`  ✓ PASS: Pipeline total leads remained strictly at ${afterRepeatRes.leads.length} (no duplicate card created)!`);

  // 6. Verify repeat enquiry logged inside follow-up logs
  const updatedLead = afterRepeatRes.leads.find(l => l.id === leadRef || l.rawId === leadRef);
  assert(updatedLead, 'Updated lead record must exist');
  assert(updatedLead.followups && updatedLead.followups.length >= 2, 'Lead must have appended follow-up log for repeat enquiry');
  const latestLog = updatedLead.followups[updatedLead.followups.length - 1];
  console.log(`  ✓ Repeat enquiry log recorded: "${latestLog.note}"`);
  assert(latestLog.note.includes('Repeat enquiry') || latestLog.note.includes('Checking back'), 'Followup note must record repeat enquiry message');

  console.log('='.repeat(75));
  console.log('ALL CRM ENQUIRY DEDUPLICATION AUDITS PASSED 100%! ✓');
  console.log('='.repeat(75));
}

runEnquiryDeduplicationTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
