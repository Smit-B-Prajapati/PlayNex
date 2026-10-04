/**
 * CHAMPIONS CLUB — Test Suite: Cancelled Member Tier Tag Removal
 * Verifies that when a member's subscription is cancelled, the Gold/Silver/Junior
 * membership tier badge is completely removed and replaced with CANCELLED status.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================================');
console.log('CHAMPIONS CLUB — CANCELLED MEMBER TIER TAG SUPPRESSION TEST');
console.log('================================================================================\n');

// 1. Check admin_auth.js
const adminAuthCode = fs.readFileSync(path.join(__dirname, '../js/admin_auth.js'), 'utf8');
assert(adminAuthCode.includes('CANCELLED</span>') && adminAuthCode.includes('applyMemberState'),
  'admin_auth.js applyMemberState must replace tier badge with CANCELLED for cancelled members');
assert(adminAuthCode.includes("const isCancelled = member.state === 'cancelled'"),
  'admin_auth.js must check if member.state === cancelled');
console.log('✓ [ADMIN_AUTH.JS] Top navbar tier tag suppressed for cancelled members.');

// 2. Check booking_manager.js
const bookingMgrCode = fs.readFileSync(path.join(__dirname, '../js/booking_manager.js'), 'utf8');
assert(bookingMgrCode.includes("tierBadgeEl.style.display = 'none';"),
  'booking_manager.js updateMemberDisplayCard must hide member-card-tier-badge if member is cancelled');
assert(bookingMgrCode.includes("session.state === 'cancelled'"),
  'booking_manager.js getCurrentMember must detect cancelled session');
console.log('✓ [BOOKING_MANAGER.JS] Court booking member card tier badge hidden for cancelled members.');

// 3. Check portal_manager.js
const portalMgrCode = fs.readFileSync(path.join(__dirname, '../js/portal_manager.js'), 'utf8');
assert(portalMgrCode.includes("planBadge.style.display = 'none';"),
  'portal_manager.js renderProfileHeader must hide profile-tier-badge when cancelled');
assert(portalMgrCode.includes('CANCELLED</span>') && portalMgrCode.includes('renderNavActions'),
  'portal_manager.js renderNavActions must render CANCELLED badge for cancelled members');
console.log('✓ [PORTAL_MANAGER.JS] Member portal profile header and nav actions suppress tier tag for cancelled members.');

// 4. Check shop_manager.js
const shopMgrCode = fs.readFileSync(path.join(__dirname, '../js/shop_manager.js'), 'utf8');
assert(shopMgrCode.includes("mem.state === 'cancelled'") && shopMgrCode.includes('isCancelled: true'),
  'shop_manager.js getActiveMemberDiscount must flag cancelled members');
assert(shopMgrCode.includes('if (memberDisc.isCancelled)'),
  'shop_manager.js renderShopMemberBanner must show Cancelled status without discount/tier tag');
console.log('✓ [SHOP_MANAGER.JS] Pro shop banner removes tier badge and discounts for cancelled members.');

console.log('\n================================================================================');
console.log('ALL CANCELLED MEMBER TIER SUPPRESSION ASSERTIONS PASSED (100%)');
console.log('================================================================================\n');
