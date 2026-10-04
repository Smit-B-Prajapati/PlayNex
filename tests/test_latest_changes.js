const fs = require('fs');
const assert = require('assert');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const dashHtml = fs.readFileSync(path.join(rootDir, 'dashboard.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const authJs = fs.readFileSync(path.join(rootDir, 'js', 'admin_auth.js'), 'utf8');
const dashMgrJs = fs.readFileSync(path.join(rootDir, 'js', 'dashboard_manager.js'), 'utf8');

console.log('='.repeat(70));
console.log('VERIFYING LATEST UI REQUIREMENTS');
console.log('='.repeat(70));

// 1. Navbar Admin Dashboard Pill Removal
console.log('1. Checking navbar admin dashboard heading/pill removal:');
assert(!authJs.includes('<li><a href="dashboard.html" class="cc-nav-link is-active">ADMIN DASHBOARD</a></li>'), 'ADMIN DASHBOARD link should not be injected into navUl');
console.log('  ✓ PASS: ADMIN DASHBOARD heading/pill removed from header');

// 2. Dynamic Today Date
console.log('2. Checking dynamic date setting for today:');
assert(dashMgrJs.includes('dashboard-current-date') && dashMgrJs.includes('new Date().toLocaleDateString'), 'Dynamic date updater must be present in dashboard_manager.js');
console.log('  ✓ PASS: Dynamic date logic ensures today\'s date is shown');

// 3. Silver Tier Pinkish Shade
console.log('3. Checking silver tier pinkish shade:');
assert(dashMgrJs.includes('disp-tier-fee-silver') && dashMgrJs.includes('#DB2777'), 'Silver tier in dashboard manager must use #DB2777');
assert(indexHtml.includes('id="home-tier-price-silver" style="color: #DB2777;"'), 'Silver tier in index.html must use #DB2777');
console.log('  ✓ PASS: Silver tier price styled in pinkish shade (#DB2777) for high visibility');

// 4. Tab Bar Single Unified Add Button
console.log('4. Checking singular ADD button on dashboard tab bar:');
assert(dashHtml.includes('id="btn-quick-add-main"'), 'Unified quick add button must exist');
assert(!dashHtml.includes('+ ADD COURT'), '+ ADD COURT button must be removed');
assert(!dashHtml.includes('+ ADD PRODUCT'), '+ ADD PRODUCT button must be removed');
assert(!dashHtml.includes('+ ADD CAFE/BAR TABLE / ITEM'), '+ ADD CAFE/BAR TABLE button must be removed');
console.log('  ✓ PASS: Extra buttons removed, only single singular + ADD button kept');

console.log('='.repeat(70));
console.log('ALL 4 USER REQUIREMENTS VERIFIED AND PASSED 100%! ✓');
console.log('='.repeat(70));
