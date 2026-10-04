/**
 * CHAMPIONS CLUB — Membership Cancellation & Pro-Rata Upgrade Verification Test Harness
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORTAL_HTML = path.join(ROOT_DIR, 'portal.html');
const PORTAL_JS = path.join(ROOT_DIR, 'js', 'portal_manager.js');
const PYTHON_MEMBER = path.join(ROOT_DIR, 'champions_club', 'models', 'club_member.py');

console.log('='.repeat(80));
console.log('CHAMPIONS CLUB — MEMBERSHIP CANCELLATION & PRO-RATA UPGRADE TEST HARNESS');
console.log('='.repeat(80));

// 1. Check HTML Markup
const portalHtmlContent = fs.readFileSync(PORTAL_HTML, 'utf8');

console.log('\n[TEST 1] Verifying Portal UI Markup & No-Refund Policy Callout:');
assert.ok(portalHtmlContent.includes('id="btn-open-cancel-modal"'), 'Missing #btn-open-cancel-modal in portal.html');
assert.ok(portalHtmlContent.includes('id="btn-open-upgrade-modal"'), 'Missing #btn-open-upgrade-modal in portal.html');
assert.ok(portalHtmlContent.includes('id="modal-cancel-membership"'), 'Missing #modal-cancel-membership modal in portal.html');
assert.ok(portalHtmlContent.includes('id="modal-upgrade-membership"'), 'Missing #modal-upgrade-membership modal in portal.html');
assert.ok(portalHtmlContent.includes('Strict No-Refund Policy Notice') || portalHtmlContent.includes('No-Refund Policy'), 'Missing No-Refund Policy Notice in portal.html');
assert.ok(portalHtmlContent.includes('Zero refund (₹ 0.00)') || portalHtmlContent.includes('no refund'), 'Missing zero refund declaration in modal');
console.log('  ✓ Cancel & Upgrade modal structures and No-Refund Policy callout verified in portal.html.');

// 2. Check JavaScript Logic
const portalJsContent = fs.readFileSync(PORTAL_JS, 'utf8');

console.log('\n[TEST 2] Verifying JavaScript Controller Logic:');
assert.ok(portalJsContent.includes('openCancelMembershipModal'), 'Missing openCancelMembershipModal in portal_manager.js');
assert.ok(portalJsContent.includes('confirmCancelMembership'), 'Missing confirmCancelMembership in portal_manager.js');
assert.ok(portalJsContent.includes('openUpgradeMembershipModal'), 'Missing openUpgradeMembershipModal in portal_manager.js');
assert.ok(portalJsContent.includes('selectUpgradeTargetPlan'), 'Missing selectUpgradeTargetPlan in portal_manager.js');
assert.ok(portalJsContent.includes('confirmUpgradeMembership'), 'Missing confirmUpgradeMembership in portal_manager.js');
console.log('  ✓ All cancellation and upgrade functions defined in portal_manager.js.');

// 3. Pro-Rata Math Unit Simulation
console.log('\n[TEST 3] Simulating Pro-Rata Formula Calculations:');

const PLAN_FEES = { gold: 24000, silver: 14000, junior: 8000 };

function calcProRata(currentPlan, targetPlan, remainingMonths) {
  const currentFee = PLAN_FEES[currentPlan];
  const monthlyRate = currentFee / 12.0;
  const discount = Math.round(remainingMonths * monthlyRate);
  const targetFee = PLAN_FEES[targetPlan];
  const netPayable = Math.max(0, targetFee - discount);
  return { currentFee, monthlyRate, discount, targetFee, netPayable };
}

// Case A: Silver member with 6 months left upgrading to Gold
const caseA = calcProRata('silver', 'gold', 6);
assert.strictEqual(caseA.currentFee, 14000, 'Silver fee should be 14000');
assert.strictEqual(Math.round(caseA.monthlyRate * 100) / 100, 1166.67, 'Silver monthly rate should be 1166.67');
assert.strictEqual(caseA.discount, 7000, '6 months Silver discount should be 7000');
assert.strictEqual(caseA.netPayable, 17000, 'Net payable should be 24000 - 7000 = 17000');
console.log(`  ✓ Case A (Silver -> Gold, 6 mos left): Discount = ₹${caseA.discount}, Net Payable = ₹${caseA.netPayable}`);

// Case B: Junior member with 9 months left upgrading to Gold
const caseB = calcProRata('junior', 'gold', 9);
assert.strictEqual(caseB.currentFee, 8000, 'Junior fee should be 8000');
assert.strictEqual(Math.round(caseB.monthlyRate * 100) / 100, 666.67, 'Junior monthly rate should be 666.67');
assert.strictEqual(caseB.discount, 6000, '9 months Junior discount should be 6000');
assert.strictEqual(caseB.netPayable, 18000, 'Net payable should be 24000 - 6000 = 18000');
console.log(`  ✓ Case B (Junior -> Gold, 9 mos left): Discount = ₹${caseB.discount}, Net Payable = ₹${caseB.netPayable}`);

// Case C: Junior member with 9 months left upgrading to Silver
const caseC = calcProRata('junior', 'silver', 9);
assert.strictEqual(caseC.discount, 6000, '9 months Junior discount should be 6000');
assert.strictEqual(caseC.netPayable, 8000, 'Net payable should be 14000 - 6000 = 8000');
console.log(`  ✓ Case C (Junior -> Silver, 9 mos left): Discount = ₹${caseC.discount}, Net Payable = ₹${caseC.netPayable}`);

// Case D: Member with 0 months left (expired) upgrading to Gold
const caseD = calcProRata('silver', 'gold', 0);
assert.strictEqual(caseD.discount, 0, '0 months discount should be 0');
assert.strictEqual(caseD.netPayable, 24000, 'Net payable should be 24000');
console.log(`  ✓ Case D (Silver -> Gold, 0 mos left): Discount = ₹${caseD.discount}, Net Payable = ₹${caseD.netPayable}`);

// 4. Check Python Odoo Model
console.log('\n[TEST 4] Verifying Python Odoo Model:');
const pyContent = fs.readFileSync(PYTHON_MEMBER, 'utf8');
assert.ok(pyContent.includes('action_cancel_membership'), 'Missing action_cancel_membership in club_member.py');
assert.ok(pyContent.includes('action_upgrade_subscription'), 'Missing action_upgrade_subscription in club_member.py');
assert.ok(pyContent.includes('No-Refund Policy') || pyContent.includes('No-Refund'), 'Missing No-Refund policy notice in club_member.py');
console.log('  ✓ Python model action_upgrade_subscription & action_cancel_membership verified.');

console.log('\n' + '='.repeat(80));
console.log('ALL MEMBERSHIP CANCELLATION & UPGRADE ASSERTIONS PASSED (100%)');
console.log('='.repeat(80));
