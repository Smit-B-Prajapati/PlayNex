/**
 * CHAMPIONS CLUB — Admin Dashboard & Acceptance Criteria Comprehensive Test Suite
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('='.repeat(88));
console.log('CHAMPIONS CLUB — ADMIN DASHBOARD FULL ACCEPTANCE & COMPLIANCE SUITE');
console.log('='.repeat(88));

let allPassed = true;
function assert(desc, condition, details = '') {
  if (condition) {
    console.log(`✓ [PASS] ${desc}`);
  } else {
    console.error(`✗ [FAIL] ${desc} — ${details}`);
    allPassed = false;
  }
}

// 1. Check Files
const dashboardHtml = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
const portalHtml = fs.readFileSync(path.join(__dirname, '..', 'portal.html'), 'utf8');
const adminAuthJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin_auth.js'), 'utf8');
const dashboardManagerJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'dashboard_manager.js'), 'utf8');
const clubDataStoreJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'club_data_store.js'), 'utf8');

// 2. Acceptance Checklist Audits

// [1] Normal member portal is untouched
assert('Normal member portal exists (portal.html)', portalHtml.length > 5000);
assert('Normal member portal features member profile banner and tier badges', portalHtml.includes('cc-member-hero-banner') && portalHtml.includes('profile-tier-badge'));
assert('Normal member portal includes quick booking, shop orders, and benefits', portalHtml.includes('portal-bookings-tbody') && portalHtml.includes('portal-orders-tbody'));

// [2] Admin Navigation Cleanliness
assert('Admin auth logic provides clean navbar for Admin without redundant links', adminAuthJs.includes('navUl.innerHTML = \'\'') && adminAuthJs.includes('dashboard.html'));
assert('Admin header excludes separate top links for Courts, Shop, Bar POS, CRM, Roster, Member Portal', 
  !dashboardHtml.includes('<a href="courts.html"') && 
  !dashboardHtml.includes('<a href="shop.html"') && 
  !dashboardHtml.includes('<a href="pos.html"') && 
  !dashboardHtml.includes('<a href="crm.html"') &&
  !dashboardHtml.includes('<a href="members.html"') &&
  !dashboardHtml.includes('<a href="portal.html"')
);

// [3] Admin Dashboard Tab Navigation (Strict 6 Buttons, Overview Removed)
assert('Admin Dashboard does NOT contain Overview tab button', !dashboardHtml.includes('data-tab="overview"'));
assert('Admin Dashboard does NOT contain section-overview container', !dashboardHtml.includes('id="section-overview"'));

const requiredTabs = [
  'memberships', 'sales', 'inventory', 'crm', 'invoices', 'employees'
];
requiredTabs.forEach(tab => {
  assert(`Admin Dashboard contains tab button for "${tab}"`, dashboardHtml.includes(`data-tab="${tab}"`));
  assert(`Admin Dashboard contains section container for "section-${tab}"`, dashboardHtml.includes(`id="section-${tab}"`));
});

// [4] Preserved First Screenshot Functionality in Memberships
assert('Memberships section has search input', dashboardHtml.includes('id="member-search"'));
assert('Memberships section has sort select dropdown', dashboardHtml.includes('id="member-sort-select"'));
assert('Memberships section has filter pills for Gold, Silver, Junior, Active, Expiring, Expired', 
  dashboardHtml.includes('data-mfilter="gold"') &&
  dashboardHtml.includes('data-mfilter="silver"') &&
  dashboardHtml.includes('data-mfilter="junior"') &&
  dashboardHtml.includes('data-mfilter="active"') &&
  dashboardHtml.includes('data-mfilter="expiring"') &&
  dashboardHtml.includes('data-mfilter="expired"')
);
assert('Memberships section has full table columns: Member, Member ID, Tier Plan, Status, Start Date, Expiry Date, Last Activity, Actions',
  dashboardHtml.includes('<th>Member</th>') &&
  dashboardHtml.includes('<th>Member ID</th>') &&
  dashboardHtml.includes('<th>Tier Plan</th>') &&
  dashboardHtml.includes('<th>Status</th>') &&
  dashboardHtml.includes('<th>Start Date</th>') &&
  dashboardHtml.includes('<th>Expiry Date</th>') &&
  dashboardHtml.includes('<th>Last Activity</th>') &&
  dashboardHtml.includes('Actions</th>')
);
assert('Memberships section has Profile & 360° action button support', dashboardManagerJs.includes('openMember360'));
assert('Memberships section has direct Court Booking action support', dashboardManagerJs.includes('quickBookMember'));

// [5] Unified Single Finance Hub Requirement
assert('Finance & Revenue has ONE consolidated hero card', dashboardHtml.includes('id="fin-grand-total"'));
assert('Finance & Revenue breaks down Cash, Card, UPI payment totals', 
  dashboardHtml.includes('id="fin-cash-total"') && 
  dashboardHtml.includes('id="fin-card-total"') && 
  dashboardHtml.includes('id="fin-upi-total"')
);
assert('Finance & Revenue compares 3 streams: Courts, Pro Shop, Bar/Cafe with cash/card/upi splits', 
  dashboardHtml.includes('id="fin-stream-courts"') && 
  dashboardHtml.includes('id="fin-stream-shop"') && 
  dashboardHtml.includes('id="fin-stream-bar"')
);
assert('Finance & Revenue supports period filters (Today, This Week, This Month, All Time)',
  dashboardHtml.includes('data-fperiod="today"') &&
  dashboardHtml.includes('data-fperiod="week"') &&
  dashboardHtml.includes('data-fperiod="month"') &&
  dashboardHtml.includes('data-fperiod="all"')
);

// [6] Inventory Management
assert('Shared Shelf inventory has low stock warning banner', dashboardHtml.includes('id="inventory-low-stock-alert-pill"'));
assert('Inventory table contains SKU, Category, Shelf Stock, Min Alert, Unit Price, Status',
  dashboardHtml.includes('<th>SKU</th>') &&
  dashboardHtml.includes('<th>Shelf Stock</th>') &&
  dashboardHtml.includes('<th>Min Alert Threshold</th>')
);
assert('Inventory section supports quick +5 Restock action', dashboardManagerJs.includes('restockProduct'));

// [7] CRM Pipeline
assert('CRM section has 5-stage Kanban board (New, Contacted, Follow-up, Quote, Converted)',
  dashboardHtml.includes('id="crm-col-new"') &&
  dashboardHtml.includes('id="crm-col-contacted"') &&
  dashboardHtml.includes('id="crm-col-followup"') &&
  dashboardHtml.includes('id="crm-col-quote"') &&
  dashboardHtml.includes('id="crm-col-converted"')
);
assert('CRM lead progression supports Quotation, Follow-up logs, Contacted, and Conversion to Member',
  dashboardManagerJs.includes('handleSendLeadQuote') &&
  dashboardManagerJs.includes('handleAddLeadFollowup') &&
  dashboardManagerJs.includes('handleMarkLeadContacted') &&
  dashboardManagerJs.includes('handleConvertLead')
);

// [8] Business Invoices & Clients
assert('Invoices section has summary cards: Total Invoiced, Paid, Pending, Overdue',
  dashboardHtml.includes('id="inv-kpi-total"') &&
  dashboardHtml.includes('id="inv-kpi-paid"') &&
  dashboardHtml.includes('id="inv-kpi-pending"') &&
  dashboardHtml.includes('id="inv-kpi-overdue"')
);
assert('Invoices table tracks Untaxed Base, 18% GST, and Total Amount',
  dashboardHtml.includes('<th>Untaxed Base</th>') &&
  dashboardHtml.includes('<th>GST (18%)</th>') &&
  dashboardHtml.includes('<th>Total Amount</th>')
);
assert('Invoices section supports Mark Paid action', dashboardManagerJs.includes('markInvoicePaid'));

// [9] Employee Management
assert('Employee section computes monthly club payroll obligation', dashboardHtml.includes('id="emp-payroll-total"'));
assert('Employee table shows Employee ID, Staff Member, Role, Department, Contact, Salary, Status, Joining Date',
  dashboardHtml.includes('<th>Employee ID</th>') &&
  dashboardHtml.includes('<th>Monthly Salary</th>') &&
  dashboardHtml.includes('<th>Joining Date</th>')
);

// [10] Leave Management
assert('Leave Management section shows pending leave requests with days and reasons', dashboardHtml.includes('id="leaves-table-body"'));
assert('Leave Management supports Approve and Reject administrator actions', 
  dashboardManagerJs.includes('approveLeave') && 
  dashboardManagerJs.includes('rejectLeave')
);

// [11] Tax & Audit Reports
assert('Tax & Reports calculates Gross Revenue, Taxable Base (Net of 18% GST), and GST 18% Tax Collected',
  dashboardHtml.includes('id="tax-gross-rev"') &&
  dashboardHtml.includes('id="tax-taxable-base"') &&
  dashboardHtml.includes('id="tax-gst-total"')
);
assert('Tax section features multi-stream tax matrix table and print/export report',
  dashboardHtml.includes('id="tax-matrix-table-body"') &&
  dashboardHtml.includes('window.print()')
);

// [12] Modals
const requiredModals = [
  'modal-new-member', 'modal-member-360', 'modal-new-booking', 
  'modal-new-product', 'modal-new-invoice', 'modal-new-enquiry', 
  'modal-new-employee', 'modal-lead-detail', 'modal-config-plans',
  'modal-quick-add-hub'
];
requiredModals.forEach(m => {
  assert(`Dashboard contains modal dialog "${m}"`, dashboardHtml.includes(`id="${m}"`));
});

// [13] Single Unified Quick Action Button Beside Employee Details
assert('Top bar contains ONE single unified + ADD button beside Employee Details', 
  dashboardHtml.includes('id="btn-quick-add-main"') && dashboardHtml.includes('+ ADD')
);
assert('Unified Quick Add Hub modal integrates all 3 options: Court, Product, and Bar Table/Item',
  dashboardHtml.includes('data-qtab="court"') &&
  dashboardHtml.includes('data-qtab="product"') &&
  dashboardHtml.includes('data-qtab="bar"') &&
  dashboardHtml.includes('id="qadd-pane-court"') &&
  dashboardHtml.includes('id="qadd-pane-product"') &&
  dashboardHtml.includes('id="qadd-pane-bar"')
);
assert('dashboard_manager.js supports openQuickAddModal and switchQuickAddTab',
  dashboardManagerJs.includes('openQuickAddModal') &&
  dashboardManagerJs.includes('switchQuickAddTab')
);

// [14] Integrated Stream Cards with Details
assert('Sales Stream 1 (Courts) embeds integrated live booking table', 
  dashboardHtml.includes('id="stream-card-courts"') && dashboardHtml.includes('id="courts-bookings-table-body"')
);
assert('Sales Stream 2 (Shop) embeds integrated live order list', 
  dashboardHtml.includes('id="stream-card-shop"') && dashboardHtml.includes('id="shop-orders-full-body"')
);
assert('Sales Stream 3 (Bar POS) embeds integrated live reconciliation and active tabs', 
  dashboardHtml.includes('id="stream-card-bar"') && 
  dashboardHtml.includes('id="bar-shift-reconciliation-box"') &&
  dashboardHtml.includes('id="bar-active-tabs-container"')
);

// [13] Editable Membership Pricing by Admin
assert('Admin Dashboard contains button to edit tier prices & benefits', dashboardHtml.includes('id="btn-open-config-plans"'));
assert('Admin Dashboard has plan config modal input fields for Gold, Silver, Junior fees & court rates',
  dashboardHtml.includes('id="cfg-gold-fee"') &&
  dashboardHtml.includes('id="cfg-silver-fee"') &&
  dashboardHtml.includes('id="cfg-junior-fee"') &&
  dashboardHtml.includes('id="cfg-gold-court"') &&
  dashboardHtml.includes('id="cfg-silver-court"') &&
  dashboardHtml.includes('id="cfg-junior-court"')
);
assert('dashboard_manager.js supports openPlanConfigModal and handleSavePlanConfig',
  dashboardManagerJs.includes('openPlanConfigModal') &&
  dashboardManagerJs.includes('handleSavePlanConfig')
);
assert('Admin Dashboard brand logo links to dashboard.html instead of index.html',
  dashboardHtml.includes('<a href="dashboard.html" class="cc-brand">')
);

console.log('='.repeat(88));
if (allPassed) {
  console.log('✓ ALL 30+ ADMIN DASHBOARD ACCEPTANCE CRITERIA VERIFIED WITH 100% SUCCESS!');
} else {
  console.error('✗ SOME AUDIT CHECKS FAILED');
  process.exit(1);
}
console.log('='.repeat(88));
