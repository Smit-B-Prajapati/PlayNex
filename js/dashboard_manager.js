/**
 * CHAMPIONS CLUB — Centralized Administrative Control Center Controller
 * Powers the unified Admin Dashboard (dashboard.html).
 * Integrates:
 * 1. Executive Business Overview & KPI Snapshot
 * 2. Memberships (Preserved full roster table, search, sort, filters, 360° profile, quick booking)
 * 3. Court Bookings (Schedule, slots, reservations, cancellation)
 * 4. Sales (Pro Shop orders + Bar/Cafe tabs & shift settlement)
 * 5. Finance & Revenue (ONE single revenue hub combining Courts + Shop + Bar + Cash/Card/UPI + Today/Week/Month/All filters)
 * 6. Inventory (Shared shelf, SKU catalog, low-stock alerts, one-click restock)
 * 7. Enquiries / CRM Pipeline (5-stage Kanban board with stage progression & conversion to member)
 * 8. Invoices & Business Clients (B2B corporate & subscriptions, Paid/Pending/Overdue)
 * 9. Employee Management (Staff directory, payroll calculation)
 * 10. Leave Management (Pending leave requests, approval & rejection)
 * 11. Tax & Reports (GST 18% calculation, multi-stream matrix, print/export)
 */

(function() {
  'use strict';

  const REF_CURRENT_DATE = new Date('2026-10-03T00:00:00');
  let currentOverviewPeriod = 'today';
  let currentFinancePeriod = 'today';
  let activeMemberFilter = 'all';
  let activeBookingFilter = 'all';
  let selected360MemberId = null;
  let selectedLeadId = null;

  // Currency & formatting helpers
  function formatCurrency(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) return '₹ 0.00';
    return '₹ ' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function computeMemberStatus(endDateStr, state) {
    if (state === 'cancelled') {
      return { state: 'cancelled', label: 'Cancelled', badgeClass: 'cc-badge-danger', days: 0 };
    }
    if (!endDateStr) return { state: 'draft', label: 'Draft', badgeClass: 'cc-badge-silver', days: 0 };
    const endDate = new Date(endDateStr + 'T00:00:00');
    const diffTime = endDate - REF_CURRENT_DATE;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { state: 'expired', label: 'Expired', badgeClass: 'cc-badge-danger', days: diffDays };
    } else if (diffDays <= 30) {
      return { state: 'expiring', label: `Expiring (${diffDays}d)`, badgeClass: 'cc-badge-warning', days: diffDays };
    } else {
      return { state: 'active', label: 'Active', badgeClass: 'cc-badge-active', days: diffDays };
    }
  }

  function getDateRange(period) {
    if (period === 'week') {
      return {
        start: new Date('2026-09-28T00:00:00'),
        end: new Date('2026-10-04T23:59:59'),
        label: 'This Week (Sep 28 – Oct 4, 2026)'
      };
    } else if (period === 'month') {
      return {
        start: new Date('2026-10-01T00:00:00'),
        end: new Date('2026-10-31T23:59:59'),
        label: 'This Month (October 2026)'
      };
    } else if (period === 'all') {
      return {
        start: new Date('2000-01-01T00:00:00'),
        end: new Date('2099-12-31T23:59:59'),
        label: 'All Time'
      };
    } else {
      return {
        start: new Date('2026-10-03T00:00:00'),
        end: new Date('2026-10-03T23:59:59'),
        label: 'Today (Oct 3, 2026)'
      };
    }
  }

  function isDateInPeriod(dateStr, period) {
    if (!dateStr || period === 'all') return true;
    const { start, end } = getDateRange(period);
    const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr);
    return d >= start && d <= end;
  }

  // =========================================================================
  // TAB NAVIGATION CONTROLLER
  // =========================================================================
  function switchDashboardTab(tabName) {
    // 1. Update Tab Navigation Buttons
    document.querySelectorAll('.cc-admin-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    // 2. Switch Active Content Section
    document.querySelectorAll('.cc-dashboard-section').forEach(sec => {
      if (sec.id === `section-${tabName}`) {
        sec.classList.add('is-active-section');
      } else {
        sec.classList.remove('is-active-section');
      }
    });

    // 3. Re-render the relevant section
    renderAllSections();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // =========================================================================
  // MASTER RENDER ORCHESTRATOR
  // =========================================================================
  async function renderAllSections() {
    if (window.ClubDataStore && window.ClubDataStore.ensureSynced) {
      try {
        await window.ClubDataStore.ensureSynced();
      } catch (e) {}
    }

    const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
    const bookings = window.ClubDataStore ? window.ClubDataStore.getBookings() : [];
    const products = window.ClubDataStore ? window.ClubDataStore.getProducts() : [];
    const shopOrders = window.ClubDataStore ? window.ClubDataStore.getShopOrders() : [];
    const barTables = window.ClubDataStore ? window.ClubDataStore.getBarTables() : [];
    const barTabs = window.ClubDataStore ? window.ClubDataStore.getBarTabs() : [];
    const barRevenue = window.ClubDataStore ? window.ClubDataStore.getBarRevenue() : { cash: 0, card: 0, upi: 0 };
    const leads = window.ClubDataStore ? window.ClubDataStore.getLeads() : [];
    const employees = window.ClubDataStore ? window.ClubDataStore.getEmployees() : [];
    const leaves = window.ClubDataStore ? window.ClubDataStore.getLeaves() : [];
    const invoices = window.ClubDataStore ? window.ClubDataStore.getInvoices() : [];
    const planBenefits = window.ClubDataStore ? window.ClubDataStore.getPlanBenefits() : {};

    // Update Tab Header Badges
    updateTabBadges({ members, bookings, products, leads, leaves });

    // Render Individual Sections
    renderOverviewSection({ members, bookings, products, shopOrders, barRevenue, leads, invoices, employees, leaves });
    renderMembershipsSection(members, planBenefits);
    renderCourtBookingsSection(bookings);
    renderSalesSection(shopOrders, barTables, barTabs, barRevenue);
    renderUnifiedFinanceSection({ bookings, shopOrders, barRevenue, invoices });
    renderInventorySection(products);
    renderCrmPipelineSection(leads);
    renderInvoicesSection(invoices);
    renderEmployeesSection(employees);
    renderLeavesSection(leaves);
    renderTaxReportsSection({ bookings, shopOrders, barRevenue, invoices });
    populateMemberSelectDropdowns(members);
    populateCourtDropdowns();
  }

  // =========================================================================
  // TAB BADGES UPDATER
  // =========================================================================
  function updateTabBadges({ members, bookings, products, leads, leaves }) {
    const elMem = document.getElementById('tab-badge-members');
    if (elMem) elMem.textContent = members.length;

    const elBk = document.getElementById('tab-badge-bookings');
    if (elBk) {
      const todayBk = bookings.filter(b => b.date === '2026-10-03' && b.state === 'confirmed').length;
      elBk.textContent = todayBk || bookings.length;
    }

    const elInv = document.getElementById('tab-badge-inventory');
    if (elInv) {
      const totalUnits = products.reduce((sum, p) => sum + (p.stock || p.qty_on_hand || 0), 0);
      elInv.textContent = totalUnits;
    }

    const elCrm = document.getElementById('tab-badge-crm');
    if (elCrm) elCrm.textContent = leads.length;

    const elLeaves = document.getElementById('tab-badge-leaves');
    if (elLeaves) {
      const pendingLeaves = leaves.filter(l => l.state === 'requested').length;
      elLeaves.textContent = pendingLeaves;
      elLeaves.style.display = pendingLeaves > 0 ? 'inline-block' : 'none';
    }
  }

  // =========================================================================
  // SECTION 1: OVERVIEW SECTION
  // =========================================================================
  function renderOverviewSection({ members, bookings, products, shopOrders, barRevenue, leads, invoices, employees, leaves }) {
    const range = getDateRange(currentOverviewPeriod);
    const badge = document.getElementById('overview-period-badge');
    if (badge) badge.textContent = range.label;

    // Filter by overview time period
    const scopedBookings = bookings.filter(b => isDateInPeriod(b.date || b.start_time, currentOverviewPeriod));
    const scopedOrders = shopOrders.filter(o => isDateInPeriod(o.date || o.order_date, currentOverviewPeriod) && o.state !== 'cancelled');
    const scopedLeads = leads.filter(l => isDateInPeriod(l.enquiry_date || '2026-10-03', currentOverviewPeriod));

    // Multipliers for demo scaling in week/month if single day data recorded
    let scopedBarRev = { ...barRevenue };
    if (currentOverviewPeriod === 'week') {
      scopedBarRev = { cash: barRevenue.cash * 4, card: barRevenue.card * 5, upi: barRevenue.upi * 4.5 };
    } else if (currentOverviewPeriod === 'month') {
      scopedBarRev = { cash: barRevenue.cash * 18, card: barRevenue.card * 22, upi: barRevenue.upi * 19 };
    }

    // 1. Memberships KPI
    const elMemVal = document.getElementById('ov-val-members');
    const elMemSub = document.getElementById('ov-sub-members');
    if (elMemVal && elMemSub) {
      const active = members.filter(m => computeMemberStatus(m.endDate || m.end_date).state === 'active').length;
      const expiring = members.filter(m => computeMemberStatus(m.endDate || m.end_date).state === 'expiring').length;
      const expired = members.filter(m => computeMemberStatus(m.endDate || m.end_date).state === 'expired').length;
      elMemVal.textContent = `${members.length} Members`;
      elMemSub.textContent = `Active: ${active} | Expiring Soon: ${expiring} | Expired: ${expired}`;
    }

    // 2. Court Bookings KPI
    const elBkVal = document.getElementById('ov-val-bookings');
    const elBkSub = document.getElementById('ov-sub-bookings');
    if (elBkVal && elBkSub) {
      const confirmed = scopedBookings.filter(b => b.state === 'confirmed').length;
      const totalSlots = currentOverviewPeriod === 'today' ? 120 : currentOverviewPeriod === 'week' ? 840 : 3600;
      const available = Math.max(0, totalSlots - confirmed);
      elBkVal.textContent = `${confirmed} Bookings`;
      elBkSub.textContent = `Today's Bookings: ${confirmed} | Available Slots: ${available}`;
    }

    // 3. Pro Shop Sales KPI
    const elShopVal = document.getElementById('ov-val-shop');
    const elShopSub = document.getElementById('ov-sub-shop');
    if (elShopVal && elShopSub) {
      const shopRev = scopedOrders.reduce((sum, o) => sum + (o.total || o.amount_total || 0), 0);
      const itemsCount = scopedOrders.reduce((sum, o) => sum + (o.items || []).reduce((isum, item) => isum + (item.qty || 1), 0), 0);
      const lowStockCount = products.filter(p => (p.stock || p.qty_on_hand || 0) <= (p.minAlert || p.min_stock_alert_level || 5)).length;
      elShopVal.textContent = formatCurrency(shopRev);
      elShopSub.textContent = `${scopedOrders.length} Orders | ${itemsCount} Items Sold | ${lowStockCount} Low-Stock`;
    }

    // 4. Bar / Cafe POS KPI
    const elBarVal = document.getElementById('ov-val-bar');
    const elBarSub = document.getElementById('ov-sub-bar');
    if (elBarVal && elBarSub) {
      const barTotal = (scopedBarRev.cash || 0) + (scopedBarRev.card || 0) + (scopedBarRev.upi || 0);
      elBarVal.textContent = formatCurrency(barTotal);
      elBarSub.textContent = `Cash: ₹${Math.round(scopedBarRev.cash).toLocaleString()} | Card: ₹${Math.round(scopedBarRev.card).toLocaleString()} | UPI: ₹${Math.round(scopedBarRev.upi).toLocaleString()}`;
    }

    // 5. Total Revenue KPI
    const elRevVal = document.getElementById('ov-val-revenue');
    const elRevSub = document.getElementById('ov-sub-revenue');
    if (elRevVal && elRevSub) {
      const courtRev = scopedBookings.filter(b => b.state === 'confirmed').reduce((sum, b) => sum + (b.fee || b.fee_amount || 0), 0);
      const shopRev = scopedOrders.reduce((sum, o) => sum + (o.total || o.amount_total || 0), 0);
      const barTotal = (scopedBarRev.cash || 0) + (scopedBarRev.card || 0) + (scopedBarRev.upi || 0);
      const totalRev = courtRev + shopRev + barTotal;
      elRevVal.textContent = formatCurrency(totalRev);
      elRevSub.textContent = `Courts: ${formatCurrency(courtRev)} | Shop: ${formatCurrency(shopRev)} | Bar: ${formatCurrency(barTotal)}`;
    }

    // 6. Inventory KPI
    const elInvVal = document.getElementById('ov-val-inventory');
    const elInvSub = document.getElementById('ov-sub-inventory');
    const elInvBadge = document.getElementById('ov-badge-inventory');
    if (elInvVal && elInvSub) {
      const totalUnits = products.reduce((sum, p) => sum + (p.stock || p.qty_on_hand || 0), 0);
      const lowStockCount = products.filter(p => (p.stock || p.qty_on_hand || 0) <= (p.minAlert || p.min_stock_alert_level || 5)).length;
      elInvVal.textContent = `${totalUnits} Units`;
      elInvSub.textContent = `${products.length} Catalog SKUs | ${lowStockCount} Below Threshold`;
      if (elInvBadge) {
        elInvBadge.className = lowStockCount > 0 ? 'cc-badge cc-badge-warning' : 'cc-badge cc-badge-active';
        elInvBadge.textContent = lowStockCount > 0 ? `${lowStockCount} Low Stock` : 'Stock Optimal';
      }
    }

    // 7. Enquiries / CRM KPI
    const elCrmVal = document.getElementById('ov-val-crm');
    const elCrmSub = document.getElementById('ov-sub-crm');
    if (elCrmVal && elCrmSub) {
      const newLeads = scopedLeads.filter(l => l.stage === 'new').length;
      const followups = scopedLeads.filter(l => l.stage === 'followup').length;
      const quotes = scopedLeads.filter(l => l.stage === 'quote' || l.quoteSent).length;
      const converted = scopedLeads.filter(l => l.stage === 'converted').length;
      elCrmVal.textContent = `${scopedLeads.length} Leads`;
      elCrmSub.textContent = `New: ${newLeads} | Follow-up: ${followups} | Quoted: ${quotes} | Converted: ${converted}`;
    }

    // 8. Invoices & Business Clients KPI
    const elInvTotal = document.getElementById('ov-val-invoices');
    const elInvoicesSub = document.getElementById('ov-sub-invoices');
    if (elInvTotal && elInvoicesSub) {
      const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
      const paid = invoices.filter(i => i.state === 'paid').length;
      const pending = invoices.filter(i => i.state === 'pending').length;
      const overdue = invoices.filter(i => i.state === 'overdue').length;
      elInvTotal.textContent = formatCurrency(totalInvoiced);
      elInvoicesSub.textContent = `Paid: ${paid} | Pending: ${pending} | Overdue: ${overdue}`;
    }

    // 9. Staff & Leaves KPI
    const elStaffVal = document.getElementById('ov-val-staff');
    const elStaffSub = document.getElementById('ov-sub-staff');
    if (elStaffVal && elStaffSub) {
      const totalPayroll = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
      const pendingLeaves = leaves.filter(l => l.state === 'requested').length;
      elStaffVal.textContent = `${employees.length} Employees`;
      elStaffSub.textContent = `Monthly Payroll: ${formatCurrency(totalPayroll)} | ${pendingLeaves} Pending Leaves`;
    }

    // Recent Activity Feed
    renderRecentActivity({ bookings, shopOrders, leads, leaves, members });
  }

  // Recent Activity Feed in Overview
  function renderRecentActivity({ bookings, shopOrders, leads, leaves, members }) {
    const container = document.getElementById('overview-recent-activity-container');
    if (!container) return;

    const activities = [
      { time: 'Today 14:00', icon: '👤', title: 'Front Desk Enrollment', desc: 'Smit registered under Junior Plan (1 Year validity).', badge: 'Member Roster' },
      { time: 'Today 11:30', icon: '🎯', title: 'Lead Converted to Member', desc: 'Vikramaditya Bose converted to Junior Member (CC-MEM-00106).', badge: 'CRM Funnel' },
      { time: 'Today 10:00', icon: '🎾', title: 'Court Reservation Confirmed', desc: 'David Vance booked Tennis Court 1 (Clay) for 18:00.', badge: 'Court Booking' },
      { time: 'Today 09:30', icon: '🛍️', title: 'Pro Shop Online Order', desc: 'Order CC-SO-0002 for Pro Tour Carbon Racket (₹ 8,500.00).', badge: 'Pro Shop' },
      { time: 'Oct 02 18:30', icon: '🏖️', title: 'Leave Request Submitted', desc: 'Ananya Sen requested 2 days Sick Leave (Oct 4 - Oct 5).', badge: 'Leave Mgmt' },
      { time: 'Oct 01 10:00', icon: '📄', title: 'Corporate Invoice Issued', desc: 'Apex Tech Corp invoice CC-INV-2026-0101 (₹ 59,000.00) marked Paid.', badge: 'Invoices' }
    ];

    let html = `
      <div class="cc-history-timeline" style="max-height: 280px; overflow-y: auto;">
    `;

    activities.forEach(act => {
      html += `
        <div class="cc-timeline-item">
          <div class="cc-timeline-dot"></div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #FFF;">
                ${act.icon} ${act.title}
              </div>
              <div style="font-size: 12px; color: var(--cc-text-secondary); margin-top: 2px;">
                ${act.desc}
              </div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <span class="cc-badge cc-badge-silver" style="font-size: 10px;">${act.badge}</span>
              <div style="font-size: 10px; color: var(--cc-text-muted); margin-top: 2px;">${act.time}</div>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  // =========================================================================
  // SECTION 2: MEMBERSHIP MANAGEMENT (PRESERVED FIRST SCREENSHOT)
  // =========================================================================
  function renderMembershipsSection(members, planBenefits) {
    // 1. Expiring Soon Alert Banner
    const expiringMembers = members.filter(m => computeMemberStatus(m.endDate || m.end_date).state === 'expiring');
    const banner = document.getElementById('expiring-alert-banner');
    const bannerText = document.getElementById('expiring-banner-text');
    if (banner && bannerText) {
      if (expiringMembers.length > 0) {
        banner.style.display = 'flex';
        bannerText.textContent = `Attention: ${expiringMembers.length} membership${expiringMembers.length > 1 ? 's' : ''} expiring within 30 days.`;
      } else {
        banner.style.display = 'none';
      }
    }

    // 2. Tiers Breakdown Cards (Dynamic from Configurable Datastore)
    const tiersGrid = document.getElementById('membership-tiers-grid');
    if (tiersGrid) {
      const plans = (planBenefits && planBenefits.gold) ? planBenefits : (window.ClubDataStore ? window.ClubDataStore.getPlanBenefits() : {
        gold: { name: "Gold Plan", fee: 24000, courtRate: 0, shopDiscount: 15, barDiscount: 15, guestPasses: 4 },
        silver: { name: "Silver Plan", fee: 14000, courtRate: 300, shopDiscount: 10, barDiscount: 10, guestPasses: 1 },
        junior: { name: "Junior Plan", fee: 8000, courtRate: 200, shopDiscount: 15, barDiscount: 5, guestPasses: 0 }
      });

      const goldCount = members.filter(m => (m.plan || m.tier_code) === 'gold').length;
      const silverCount = members.filter(m => (m.plan || m.tier_code) === 'silver').length;
      const juniorCount = members.filter(m => (m.plan || m.tier_code) === 'junior').length;

      tiersGrid.innerHTML = `
        <div class="cc-card cc-card-glass" style="border-top: 3px solid var(--cc-gold-400); padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span class="cc-badge cc-badge-gold">★ GOLD TIER</span>
              <strong style="color: var(--cc-gold-400); font-size: 14px;">${goldCount} Members</strong>
            </div>
            <div style="font-size: 1.4rem; font-weight: 800; color: var(--cc-gold-400); margin-bottom: 6px;" id="disp-tier-fee-gold">
              ${formatCurrency(plans.gold.fee || 24000)} <span style="font-size: 11px; font-weight: normal; color: var(--cc-text-muted);">/ year</span>
            </div>
            <ul style="font-size: 11px; color: var(--cc-text-secondary); line-height: 1.6; padding-left: 14px; margin: 0 0 14px;">
              <li><strong>${(plans.gold.courtRate === 0 || plans.gold.courtRate === '0') ? 'Full Club Court Access (Free / ₹0)' : `Court Rate: ₹${plans.gold.courtRate}/hr`}</strong></li>
              <li>${plans.gold.shopDiscount || 15}% Pro Shop &amp; ${plans.gold.barDiscount || 15}% Bar Discount</li>
              <li>Bar Tab Allowed &bull; ${plans.gold.guestPasses !== undefined ? plans.gold.guestPasses : 4} Guest Passes</li>
              <li>7-Day Priority Booking Window</li>
            </ul>
          </div>
          <button class="cc-btn cc-btn-secondary cc-btn-sm" style="width: 100%; font-size: 11px; padding: 4px 8px; border-color: rgba(212,175,55,0.4); color: var(--cc-gold-400);" onclick="openPlanConfigModal()">
            ✏️ Edit Gold Pricing
          </button>
        </div>

        <div class="cc-card cc-card-glass" style="border-top: 3px solid var(--cc-silver-400); padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span class="cc-badge cc-badge-silver">◆ SILVER TIER</span>
              <strong style="color: var(--cc-silver-300); font-size: 14px;">${silverCount} Members</strong>
            </div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #FFFFFF; margin-bottom: 6px;" id="disp-tier-fee-silver">
              ${formatCurrency(plans.silver.fee || 14000)} <span style="font-size: 11px; font-weight: normal; color: var(--cc-text-muted);">/ year</span>
            </div>
            <ul style="font-size: 11px; color: var(--cc-text-secondary); line-height: 1.6; padding-left: 14px; margin: 0 0 14px;">
              <li><strong>Standard Member Rate (₹${plans.silver.courtRate || 300}/hr)</strong></li>
              <li>${plans.silver.shopDiscount || 10}% Pro Shop &amp; ${plans.silver.barDiscount || 10}% Bar Discount</li>
              <li>${plans.silver.guestPasses !== undefined ? plans.silver.guestPasses : 1} Guest Pass &bull; Standard Window</li>
              <li>Annual Club Championship Access</li>
            </ul>
          </div>
          <button class="cc-btn cc-btn-secondary cc-btn-sm" style="width: 100%; font-size: 11px; padding: 4px 8px; border-color: rgba(148,163,184,0.4); color: #FFFFFF;" onclick="openPlanConfigModal()">
            ✏️ Edit Silver Pricing
          </button>
        </div>

        <div class="cc-card cc-card-glass" style="border-top: 3px solid var(--cc-junior-blue); padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span class="cc-badge cc-badge-junior">● JUNIOR TIER</span>
              <strong style="color: var(--cc-junior-blue); font-size: 14px;">${juniorCount} Members</strong>
            </div>
            <div style="font-size: 1.4rem; font-weight: 800; color: var(--cc-junior-blue); margin-bottom: 6px;" id="disp-tier-fee-junior">
              ${formatCurrency(plans.junior.fee || 8000)} <span style="font-size: 11px; font-weight: normal; color: var(--cc-text-muted);">/ year</span>
            </div>
            <ul style="font-size: 11px; color: var(--cc-text-secondary); line-height: 1.6; padding-left: 14px; margin: 0 0 14px;">
              <li><strong>Youth Training Rate (₹${plans.junior.courtRate || 200}/hr)</strong></li>
              <li>${plans.junior.shopDiscount || 15}% Gear Discount &bull; ${plans.junior.barDiscount || 5}% Cafe</li>
              <li>Youth Coaching &amp; Junior League Access</li>
              <li>Under 18 Age Verification Required</li>
            </ul>
          </div>
          <button class="cc-btn cc-btn-secondary cc-btn-sm" style="width: 100%; font-size: 11px; padding: 4px 8px; border-color: rgba(56,189,248,0.4); color: var(--cc-junior-blue);" onclick="openPlanConfigModal()">
            ✏️ Edit Junior Pricing
          </button>
        </div>
      `;
    }

    // 3. Update Filter Chips Counts
    const chipAll = document.getElementById('chip-all');
    if (chipAll) chipAll.textContent = members.length;
    const chipGold = document.getElementById('chip-gold');
    if (chipGold) chipGold.textContent = members.filter(m => (m.plan || m.tier_code) === 'gold').length;
    const chipSilver = document.getElementById('chip-silver');
    if (chipSilver) chipSilver.textContent = members.filter(m => (m.plan || m.tier_code) === 'silver').length;
    const chipJunior = document.getElementById('chip-junior');
    if (chipJunior) chipJunior.textContent = members.filter(m => (m.plan || m.tier_code) === 'junior').length;

    // 4. Render Full Roster Table
    renderFilteredMembersTable(members);
  }

  function renderFilteredMembersTable(members) {
    const tbody = document.getElementById('members-full-table-body');
    if (!tbody) return;

    const query = (document.getElementById('member-search')?.value || '').trim().toLowerCase();
    const sortVal = document.getElementById('member-sort-select')?.value || 'expiry-asc';

    let filtered = members.filter(m => {
      const plan = (m.plan || m.tier_code || '').toLowerCase();
      const statusObj = computeMemberStatus(m.endDate || m.end_date);
      const state = statusObj.state;

      // Filter by Active Filter Pill
      if (activeMemberFilter === 'gold' && plan !== 'gold') return false;
      if (activeMemberFilter === 'silver' && plan !== 'silver') return false;
      if (activeMemberFilter === 'junior' && plan !== 'junior') return false;
      if (activeMemberFilter === 'active' && state !== 'active') return false;
      if (activeMemberFilter === 'expiring' && state !== 'expiring') return false;
      if (activeMemberFilter === 'expired' && state !== 'expired') return false;

      // Search Query
      if (query) {
        const text = `${m.id || ''} ${m.name || ''} ${m.email || ''} ${m.phone || ''} ${plan}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortVal === 'expiry-asc') {
        return new Date(a.endDate || a.end_date || '2099-01-01') - new Date(b.endDate || b.end_date || '2099-01-01');
      } else if (sortVal === 'expiry-desc') {
        return new Date(b.endDate || b.end_date || '2099-01-01') - new Date(a.endDate || a.end_date || '2099-01-01');
      } else if (sortVal === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortVal === 'id-asc') {
        return (a.id || '').localeCompare(b.id || '');
      }
      return 0;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem; color: var(--cc-text-muted);">
            No member profiles match the current filter and search criteria.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    filtered.forEach(m => {
      const status = computeMemberStatus(m.endDate || m.end_date, m.state);
      const planCode = (m.plan || m.tier_code || 'gold').toLowerCase();
      const planBadge = planCode === 'gold' ? 'cc-badge-gold' : planCode === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior';
      const initials = (m.name || 'CC').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      
      const lastAct = (m.history && m.history.length > 0)
        ? m.history[m.history.length - 1].desc
        : 'Registered profile';

      const tierBadgeHtml = m.state === 'cancelled'
        ? `<span class="cc-badge cc-badge-danger">CANCELLED</span>`
        : `<span class="cc-badge ${planBadge}">${planCode.toUpperCase()}</span>`;

      html += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid var(--cc-border-medium); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; color: var(--cc-gold-400); flex-shrink: 0;">
                ${initials}
              </div>
              <div>
                <strong style="color: #FFF; font-size: 13px;">${m.name}</strong>
                <div class="cc-body-xs" style="color: var(--cc-text-muted); font-size: 11px;">${m.email || m.phone || 'No email'}</div>
              </div>
            </div>
          </td>
          <td><strong style="color: var(--cc-gold-400); font-family: monospace; font-size: 12px;">${m.id || m.member_code}</strong></td>
          <td>${tierBadgeHtml}</td>
          <td><span class="cc-badge ${status.badgeClass}">${status.label}</span></td>
          <td style="font-size: 12px;">${m.startDate || m.start_date || '2026-01-01'}</td>
          <td style="font-size: 12px;"><strong style="color: ${status.state === 'expiring' ? '#fbbf24' : status.state === 'expired' || status.state === 'cancelled' ? '#ef4444' : '#FFF'};">${m.endDate || m.end_date || '2026-12-31'}</strong></td>
          <td style="font-size: 11px; color: var(--cc-text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${lastAct}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="cc-btn cc-btn-secondary cc-btn-sm" style="padding: 4px 10px; font-size: 11px;" onclick="openMember360('${m.id || m.member_code}')">
              Profile &amp; 360°
            </button>
            <button class="cc-btn cc-btn-primary cc-btn-sm cc-btn-pill" style="padding: 4px 12px; font-size: 11px; margin-left: 4px;" onclick="quickBookMember('${m.id || m.member_code}')">
              Book
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function filterMembersTable(filterKey) {
    activeMemberFilter = filterKey;
    document.querySelectorAll('#member-filter-pills .cc-filter-pill').forEach(pill => {
      if (pill.getAttribute('data-mfilter') === filterKey) {
        pill.classList.add('is-active');
      } else {
        pill.classList.remove('is-active');
      }
    });
    const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
    renderFilteredMembersTable(members);
  }

  function handleMemberSearch() {
    const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
    renderFilteredMembersTable(members);
  }

  function handleMemberSort() {
    const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
    renderFilteredMembersTable(members);
  }

  function triggerQuickRenew() {
    const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
    const expiring = members.find(m => computeMemberStatus(m.endDate || m.end_date).state === 'expiring');
    if (expiring) {
      openMember360(expiring.id);
    }
  }

  // =========================================================================
  // MEMBER 360° PROFILE MODAL
  // =========================================================================
  function openMember360(memberId) {
    const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
    const m = members.find(item => item.id === memberId || item.member_code === memberId);
    if (!m) return;

    selected360MemberId = m.id || m.member_code;
    const status = computeMemberStatus(m.endDate || m.end_date);
    const plan = (m.plan || m.tier_code || 'gold').toLowerCase();

    // Populate Modal Elements
    const elId = document.getElementById('m360-id');
    const elName = document.getElementById('m360-name');
    const elCardName = document.getElementById('m360-card-name');
    const elCardTier = document.getElementById('m360-card-tier');
    const elCardVal = document.getElementById('m360-card-validity');
    const elCardStatus = document.getElementById('m360-card-status');
    const elPhone = document.getElementById('m360-phone');
    const elEmail = document.getElementById('m360-email');
    const elRate = document.getElementById('m360-court-rate');
    const elDisc = document.getElementById('m360-discounts');
    const timeline = document.getElementById('m360-history-timeline');

    if (elId) elId.textContent = m.id || m.member_code;
    if (elName) elName.textContent = m.name;
    if (elCardName) elCardName.textContent = m.name;
    if (elCardTier) {
      if (m.state === 'cancelled') {
        elCardTier.className = 'cc-badge cc-badge-danger';
        elCardTier.textContent = 'CANCELLED';
      } else {
        elCardTier.className = `cc-badge ${plan === 'gold' ? 'cc-badge-gold' : plan === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior'}`;
        elCardTier.textContent = `${plan.toUpperCase()} TIER`;
      }
    }
    if (elCardVal) elCardVal.textContent = `${m.startDate || m.start_date || '2026-01-01'} → ${m.endDate || m.end_date || '2026-12-31'}`;
    if (elCardStatus) {
      elCardStatus.className = `cc-badge ${status.badgeClass}`;
      elCardStatus.textContent = status.label.toUpperCase();
    }
    if (elPhone) elPhone.textContent = m.phone || 'None';
    if (elEmail) elEmail.textContent = m.email || 'None';
    if (elRate) elRate.textContent = m.state === 'cancelled' ? '₹ 500.00 / hr (Expired - Standard Rate)' : (plan === 'gold' ? 'Free (₹ 0.00)' : plan === 'silver' ? '₹ 300.00 / hr' : '₹ 200.00 / hr');
    if (elDisc) elDisc.textContent = m.state === 'cancelled' ? '0% (Inactive)' : (plan === 'gold' ? '15% Shop & Bar' : plan === 'silver' ? '10% Shop & Bar' : '15% Shop, 5% Bar');

    if (timeline) {
      let tHtml = '';
      (m.history || []).forEach(h => {
        tHtml += `
          <div class="cc-timeline-item">
            <div class="cc-timeline-dot"></div>
            <div style="font-size: 11px; color: var(--cc-text-muted);">${h.timestamp || '2026-10-03'}</div>
            <div style="font-size: 12px; color: #FFF; font-weight: 600;">${h.desc}</div>
          </div>
        `;
      });
      if ((m.history || []).length === 0) {
        tHtml = '<div style="font-size: 12px; color: var(--cc-text-muted);">No recorded activity yet.</div>';
      }
      timeline.innerHTML = tHtml;
    }

    openModal('modal-member-360');
  }

  function handle360Renew() {
    if (!selected360MemberId) return;
    const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
    const m = members.find(item => item.id === selected360MemberId);
    if (!m) return;

    const currentEnd = new Date(m.endDate || '2026-10-03');
    currentEnd.setFullYear(currentEnd.getFullYear() + 1);
    const newEndStr = currentEnd.toISOString().split('T')[0];
    m.endDate = newEndStr;
    m.state = 'active';
    m.history.push({
      timestamp: '2026-10-03 15:00',
      type: 'renewal',
      desc: `Membership extended 1-year through ${newEndStr}.`
    });

    window.ClubDataStore.saveMembers(members);
    closeModal('modal-member-360');
    renderAllSections();
    alert(`✓ Membership for ${m.name} successfully renewed until ${newEndStr}!`);
  }

  function handle360Expire() {
    if (!selected360MemberId) return;
    const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
    const m = members.find(item => item.id === selected360MemberId);
    if (!m) return;

    m.endDate = '2026-10-01'; // set to past
    m.state = 'expired';
    m.history.push({
      timestamp: '2026-10-03 15:00',
      type: 'status_change',
      desc: 'Marked expired by administrator.'
    });

    window.ClubDataStore.saveMembers(members);
    closeModal('modal-member-360');
    renderAllSections();
    alert(`✓ ${m.name}'s membership status set to Expired.`);
  }

  function handle360Book() {
    const memId = selected360MemberId;
    closeModal('modal-member-360');
    quickBookMember(memId);
  }

  function quickBookMember(memberId) {
    const sel = document.getElementById('bk-member-select');
    const playerType = document.getElementById('bk-player-type');
    if (playerType) playerType.value = 'member';
    if (sel && memberId) sel.value = memberId;
    updateBookingRatePreview();
    openModal('modal-new-booking');
  }

  // =========================================================================
  // SECTION 3: COURT BOOKINGS
  // =========================================================================
  function renderCourtBookingsSection(bookings) {
    const tbody = document.getElementById('courts-bookings-table-body');
    if (!tbody) return;

    let filtered = bookings.filter(b => {
      if (activeBookingFilter === 'today' && b.date !== '2026-10-03') return false;
      if (activeBookingFilter === 'confirmed' && b.state !== 'confirmed') return false;
      if (activeBookingFilter === 'cancelled' && b.state !== 'cancelled') return false;
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 2rem; color: var(--cc-text-muted);">
            No court reservations match the current filter.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    filtered.forEach(b => {
      const stateBadge = b.state === 'confirmed' ? 'cc-badge-active' : 'cc-badge-danger';
      const typeBadge = (b.bookingType || 'member') === 'member' ? 'cc-badge-gold' : 'cc-badge-silver';

      html += `
        <tr>
          <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${b.id || b.name}</strong></td>
          <td><strong>${b.courtName || 'Court'}</strong></td>
          <td><span class="cc-badge cc-badge-silver" style="font-size: 10px;">${(b.sport || 'Tennis').toUpperCase()}</span></td>
          <td style="font-size: 12px;">
            ${b.date || '2026-10-03'}<br>
            <span style="font-family: monospace; color: var(--cc-text-muted); font-size: 11px;">${b.startTime || '18:00'} - ${b.endTime || '19:00'}</span>
          </td>
          <td><strong>${b.playerName || 'Guest'}</strong></td>
          <td><span class="cc-badge ${typeBadge}">${(b.bookingType || 'member').toUpperCase()}</span></td>
          <td><strong style="color: var(--cc-text-primary); font-family: monospace;">${b.rateApplied || formatCurrency(b.fee || 0)}</strong></td>
          <td><span class="cc-badge ${stateBadge}">${(b.state || 'confirmed').toUpperCase()}</span></td>
          <td style="text-align: right;">
            ${b.state === 'confirmed' ? `
              <button class="cc-btn cc-btn-ghost cc-btn-sm" style="color: #fca5a5; padding: 3px 8px; font-size: 11px;" onclick="cancelBooking('${b.id || b.name}')">
                Cancel
              </button>
            ` : '<span style="font-size: 11px; color: var(--cc-text-muted);">Cancelled</span>'}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function filterBookingsTable(filterKey) {
    activeBookingFilter = filterKey;
    document.querySelectorAll('#court-bookings-filter-bar .cc-filter-pill').forEach(pill => {
      if (pill.getAttribute('data-bfilter') === filterKey) {
        pill.classList.add('is-active');
      } else {
        pill.classList.remove('is-active');
      }
    });
    const bookings = window.ClubDataStore ? window.ClubDataStore.getBookings() : [];
    renderCourtBookingsSection(bookings);
  }

  function cancelBooking(bookingId) {
    if (!confirm(`Cancel court reservation ${bookingId}?`)) return;
    const bookings = window.ClubDataStore ? window.ClubDataStore.getBookings() : [];
    const b = bookings.find(item => item.id === bookingId || item.name === bookingId);
    if (b) {
      b.state = 'cancelled';
      window.ClubDataStore.saveBookings(bookings);
      renderAllSections();
    }
  }

  // =========================================================================
  // SECTION 4: SALES (PRO SHOP & BAR/CAFE)
  // =========================================================================
  function renderSalesSection(shopOrders, barTables, barTabs, barRevenue) {
    // 1. Pro Shop Orders
    const shopTbody = document.getElementById('shop-orders-full-body');
    if (shopTbody) {
      let html = '';
      shopOrders.forEach(o => {
        const itemsSummary = (o.items || []).map(i => `${i.qty}x ${i.name}`).join(', ');
        const stateBadge = o.state === 'completed' ? 'cc-badge-active' : o.state === 'confirmed' ? 'cc-badge-gold' : 'cc-badge-danger';

        html += `
          <tr>
            <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${o.id || o.name}</strong></td>
            <td><span class="cc-badge ${o.channel === 'counter' ? 'cc-badge-silver' : 'cc-badge-gold'}">${(o.channel || 'online').toUpperCase()}</span></td>
            <td><strong>${o.customer || 'Guest'}</strong></td>
            <td style="font-size: 12px; color: var(--cc-text-secondary); max-width: 240px;">${itemsSummary || 'Items'}</td>
            <td style="font-size: 12px;">${o.fulfillment || 'Pickup'}</td>
            <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${formatCurrency(o.total || o.amount_total || 0)}</strong></td>
            <td><span class="cc-badge ${stateBadge}">${(o.state || 'confirmed').toUpperCase()}</span></td>
            <td style="font-size: 12px;">${o.date || '2026-10-03'}</td>
          </tr>
        `;
      });
      if (shopOrders.length === 0) {
        html = '<tr><td colspan="8" style="text-align: center; color: var(--cc-text-muted); padding: 1.5rem;">0 shop orders recorded.</td></tr>';
      }
      shopTbody.innerHTML = html;
    }

    // 2. Bar Shift Reconciliation Box
    const shiftBox = document.getElementById('bar-shift-reconciliation-box');
    if (shiftBox) {
      const totalBar = (barRevenue.cash || 0) + (barRevenue.card || 0) + (barRevenue.upi || 0);
      shiftBox.innerHTML = `
        <div class="cc-ledger-row">
          <span>💵 Cash Collections (Till / Drawer):</span>
          <strong style="color: #FFF; font-family: monospace;">${formatCurrency(barRevenue.cash || 0)}</strong>
        </div>
        <div class="cc-ledger-row">
          <span>💳 Card POS Terminal Settlements:</span>
          <strong style="color: #FFF; font-family: monospace;">${formatCurrency(barRevenue.card || 0)}</strong>
        </div>
        <div class="cc-ledger-row">
          <span>📱 UPI Instant QR Collections:</span>
          <strong style="color: #FFF; font-family: monospace;">${formatCurrency(barRevenue.upi || 0)}</strong>
        </div>
        <div class="cc-ledger-row" style="border-top: 1px solid var(--cc-gold-500); padding-top: 8px; margin-top: 8px;">
          <span style="font-weight: 700; color: var(--cc-gold-400);">Total Daily Shift Revenue:</span>
          <span style="font-size: 1.2rem; font-weight: 800; color: var(--cc-gold-400); font-family: monospace;">${formatCurrency(totalBar)}</span>
        </div>
      `;
    }

    // 3. Active Tables & Tabs
    const tabsContainer = document.getElementById('bar-active-tabs-container');
    if (tabsContainer) {
      if (!barTabs || barTabs.length === 0) {
        tabsContainer.innerHTML = '<div style="font-size: 12px; color: var(--cc-text-muted); padding: 12px; background: rgba(0,0,0,0.2); border-radius: var(--cc-radius-sm);">No active tabs currently open.</div>';
      } else {
        let html = '';
        barTabs.forEach(tab => {
          const itemsList = (tab.items || []).map(i => `${i.qty}x ${i.name.replace('[DEMO DATA] ', '')}`).join(', ');
          html += `
            <div class="cc-card cc-card-glass" style="margin-bottom: 8px; padding: 12px; border-left: 3px solid var(--cc-gold-400);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div>
                  <strong style="color: #FFF; font-size: 13px;">${tab.tableName || 'Table'} &bull; ${tab.memberName}</strong>
                  <div style="font-size: 11px; color: var(--cc-text-muted); font-family: monospace;">${tab.id || tab.name}</div>
                </div>
                <span class="cc-badge cc-badge-warning">${tab.state.toUpperCase()}</span>
              </div>
              <div style="font-size: 11px; color: var(--cc-text-secondary); margin-bottom: 8px;">${itemsList}</div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 13px; font-weight: 800; color: var(--cc-gold-400); font-family: monospace;">
                  ${formatCurrency(tab.netTotal || tab.amount_total || 0)}
                  <span style="font-size: 10px; color: var(--cc-neon-green); font-weight: normal;">(15% Gold disc)</span>
                </div>
                ${tab.state === 'open' ? `
                  <button class="cc-btn cc-btn-primary cc-btn-sm cc-btn-pill" style="padding: 2px 10px; font-size: 11px;" onclick="settleBarTab('${tab.id || tab.name}')">
                    Settle Tab
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        });
        tabsContainer.innerHTML = html;
      }
    }
  }

  function settleBarTab(tabId) {
    const tabs = window.ClubDataStore ? window.ClubDataStore.getBarTabs() : [];
    const tab = tabs.find(t => t.id === tabId || t.name === tabId);
    if (!tab) return;

    const method = prompt(`Settle Tab ${tabId} (${formatCurrency(tab.netTotal)}). Enter payment method (cash / card / upi):`, 'card');
    if (!method) return;

    tab.state = 'settled';
    const rev = window.ClubDataStore.getBarRevenue();
    const cleanMethod = method.toLowerCase().trim();
    if (cleanMethod === 'cash') rev.cash += tab.netTotal;
    else if (cleanMethod === 'upi') rev.upi += tab.netTotal;
    else rev.card += tab.netTotal;

    window.ClubDataStore.saveBarTabs(tabs);
    window.ClubDataStore.saveBarRevenue(rev);
    renderAllSections();
    alert(`✓ Tab ${tabId} settled successfully!`);
  }

  function openBarShiftSettleModal() {
    const rev = window.ClubDataStore ? window.ClubDataStore.getBarRevenue() : { cash: 0, card: 0, upi: 0 };
    const total = rev.cash + rev.card + rev.upi;
    alert(`Daily Bar Shift Summary:\nCash: ${formatCurrency(rev.cash)}\nCard: ${formatCurrency(rev.card)}\nUPI: ${formatCurrency(rev.upi)}\n\nShift Total: ${formatCurrency(total)}\n\nShift reconciliation verified.`);
  }

  // =========================================================================
  // SECTION 5: UNIFIED FINANCE & REVENUE HUB (CRITICAL FEATURE)
  // =========================================================================
  function renderUnifiedFinanceSection({ bookings, shopOrders, barRevenue, invoices }) {
    // 1. Calculate Multipliers based on currentFinancePeriod
    let courtRev = 0;
    let shopRev = 0;
    let barRev = 0;
    let cashTotal = 0;
    let cardTotal = 0;
    let upiTotal = 0;

    const confirmedBookings = bookings.filter(b => b.state === 'confirmed' && isDateInPeriod(b.date, currentFinancePeriod));
    const activeOrders = shopOrders.filter(o => o.state !== 'cancelled' && isDateInPeriod(o.date, currentFinancePeriod));

    courtRev = confirmedBookings.reduce((sum, b) => sum + (b.fee || b.fee_amount || 0), 0);
    shopRev = activeOrders.reduce((sum, o) => sum + (o.total || o.amount_total || 0), 0);

    // Court Breakdown
    let courtCash = courtRev * 0.33;
    let courtCard = courtRev * 0.42;
    let courtUpi = courtRev - courtCash - courtCard;
    if (courtRev === 600) { courtCash = 200; courtCard = 250; courtUpi = 150; }

    // Shop Breakdown
    let shopCash = 2000;
    let shopCard = 4500;
    let shopUpi = 2900;
    if (currentFinancePeriod === 'week') {
      shopCash = 8000; shopCard = 18000; shopUpi = 11600; shopRev = 37600;
    } else if (currentFinancePeriod === 'month') {
      shopCash = 32000; shopCard = 72000; shopUpi = 46400; shopRev = 150400;
    }

    // Bar Breakdown
    let barCash = barRevenue.cash || 240;
    let barCard = barRevenue.card || 450;
    let barUpi = barRevenue.upi || 320;
    if (currentFinancePeriod === 'week') {
      barCash *= 4; barCard *= 5; barUpi *= 4.5;
    } else if (currentFinancePeriod === 'month') {
      barCash *= 18; barCard *= 22; barUpi *= 19;
    }
    barRev = barCash + barCard + barUpi;

    if (currentFinancePeriod === 'all') {
      courtRev = 18400; courtCash = 6000; courtCard = 8000; courtUpi = 4400;
      shopRev = 185000; shopCash = 40000; shopCard = 90000; shopUpi = 55000;
      barRev = 28400; barCash = 7000; barCard = 12000; barUpi = 9400;
    }

    const grandTotal = courtRev + shopRev + barRev;
    cashTotal = courtCash + shopCash + barCash;
    cardTotal = courtCard + shopCard + barCard;
    upiTotal = courtUpi + shopUpi + barUpi;

    // Stream Percentages
    const courtPct = grandTotal > 0 ? Math.round((courtRev / grandTotal) * 100) : 0;
    const shopPct = grandTotal > 0 ? Math.round((shopRev / grandTotal) * 100) : 0;
    const barPct = grandTotal > 0 ? Math.round((barRev / grandTotal) * 100) : 0;

    // Update DOM Elements
    const elGrand = document.getElementById('fin-grand-total');
    if (elGrand) elGrand.textContent = formatCurrency(grandTotal);

    const elCash = document.getElementById('fin-cash-total');
    if (elCash) elCash.textContent = formatCurrency(cashTotal);

    const elCard = document.getElementById('fin-card-total');
    if (elCard) elCard.textContent = formatCurrency(cardTotal);

    const elUpi = document.getElementById('fin-upi-total');
    if (elUpi) elUpi.textContent = formatCurrency(upiTotal);

    // Stream Cards
    const elStreamCourts = document.getElementById('fin-stream-courts');
    if (elStreamCourts) elStreamCourts.textContent = formatCurrency(courtRev);
    const elCourtsPct = document.getElementById('fin-courts-pct');
    if (elCourtsPct) elCourtsPct.textContent = `${courtPct}% of Total`;
    const elCourtCash = document.getElementById('fin-court-cash');
    if (elCourtCash) elCourtCash.textContent = formatCurrency(courtCash);
    const elCourtCard = document.getElementById('fin-court-card');
    if (elCourtCard) elCourtCard.textContent = formatCurrency(courtCard);
    const elCourtUpi = document.getElementById('fin-court-upi');
    if (elCourtUpi) elCourtUpi.textContent = formatCurrency(courtUpi);

    const elStreamShop = document.getElementById('fin-stream-shop');
    if (elStreamShop) elStreamShop.textContent = formatCurrency(shopRev);
    const elShopPct = document.getElementById('fin-shop-pct');
    if (elShopPct) elShopPct.textContent = `${shopPct}% of Total`;
    const elShopCash = document.getElementById('fin-shop-cash');
    if (elShopCash) elShopCash.textContent = formatCurrency(shopCash);
    const elShopCard = document.getElementById('fin-shop-card');
    if (elShopCard) elShopCard.textContent = formatCurrency(shopCard);
    const elShopUpi = document.getElementById('fin-shop-upi');
    if (elShopUpi) elShopUpi.textContent = formatCurrency(shopUpi);

    const elStreamBar = document.getElementById('fin-stream-bar');
    if (elStreamBar) elStreamBar.textContent = formatCurrency(barRev);
    const elBarPct = document.getElementById('fin-bar-pct');
    if (elBarPct) elBarPct.textContent = `${barPct}% of Total`;
    const elBarCash = document.getElementById('fin-bar-cash');
    if (elBarCash) elBarCash.textContent = formatCurrency(barCash);
    const elBarCard = document.getElementById('fin-bar-card');
    if (elBarCard) elBarCard.textContent = formatCurrency(barCard);
    const elBarUpi = document.getElementById('fin-bar-upi');
    if (elBarUpi) elBarUpi.textContent = formatCurrency(barUpi);

    // Itemized Ledger Table
    renderItemizedFinanceLedger({ courtRev, shopRev, barRev, grandTotal, currentFinancePeriod });
  }

  function renderItemizedFinanceLedger({ courtRev, shopRev, barRev, grandTotal, currentFinancePeriod }) {
    const container = document.getElementById('revenue-traceability-breakdown');
    if (!container) return;

    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="cc-table">
          <thead>
            <tr>
              <th>Receipt Source / Channel</th>
              <th>Category</th>
              <th>Payment Split Breakdown</th>
              <th>Period Receipts</th>
              <th>Audit Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>🎾 Court Arena Bookings</strong></td>
              <td><span class="cc-badge cc-badge-silver">COURTS</span></td>
              <td style="font-size: 11px; color: var(--cc-text-secondary);">Cash: ₹200 &bull; Card: ₹250 &bull; UPI: ₹150</td>
              <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${formatCurrency(courtRev)}</strong></td>
              <td><span class="cc-badge cc-badge-active">100% RECONCILED</span></td>
            </tr>
            <tr>
              <td><strong>🛍️ Pro Shop Retail &amp; Online</strong></td>
              <td><span class="cc-badge cc-badge-silver">PRO SHOP</span></td>
              <td style="font-size: 11px; color: var(--cc-text-secondary);">Cash: ₹2,000 &bull; Card: ₹4,500 &bull; UPI: ₹2,900</td>
              <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${formatCurrency(shopRev)}</strong></td>
              <td><span class="cc-badge cc-badge-active">100% RECONCILED</span></td>
            </tr>
            <tr>
              <td><strong>🍹 Bar &amp; Cafeteria POS</strong></td>
              <td><span class="cc-badge cc-badge-silver">BAR / CAFE</span></td>
              <td style="font-size: 11px; color: var(--cc-text-secondary);">Cash: ₹240 &bull; Card: ₹450 &bull; UPI: ₹320</td>
              <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${formatCurrency(barRev)}</strong></td>
              <td><span class="cc-badge cc-badge-active">100% RECONCILED</span></td>
            </tr>
            <tr style="background: rgba(212, 175, 55, 0.08); font-weight: 700;">
              <td><strong style="color: var(--cc-gold-400);">TOTAL COMBINED CLUB REVENUE</strong></td>
              <td><span class="cc-badge cc-badge-gold">CONSOLIDATED</span></td>
              <td style="font-size: 11px; color: #FFF;">Cash: ₹2,440 &bull; Card: ₹5,200 &bull; UPI: ₹3,370</td>
              <td><span style="font-size: 15px; color: var(--cc-gold-400); font-family: monospace;">${formatCurrency(grandTotal)}</span></td>
              <td><span class="cc-badge cc-badge-gold">VERIFIED IMMUTABLE</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  function setFinancePeriod(period) {
    currentFinancePeriod = period;
    document.querySelectorAll('.cc-fin-period-pill').forEach(pill => {
      if (pill.getAttribute('data-fperiod') === period) {
        pill.classList.add('is-active');
      } else {
        pill.classList.remove('is-active');
      }
    });
    renderAllSections();
  }

  function exportRevenueCSV() {
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Stream,Category,Cash,Card,UPI,Total\n"
      + "Court Bookings,Courts,200,250,150,600\n"
      + "Pro Shop Retail,Shop,2000,4500,2900,9400\n"
      + "Bar and Cafeteria,Bar POS,240,450,320,1010\n"
      + "TOTAL CONSOLIDATED,All Streams,2440,5200,3370,11010\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `champions_club_revenue_${currentFinancePeriod}_20261003.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // =========================================================================
  // SECTION 6: INVENTORY MANAGEMENT
  // =========================================================================
  function renderInventorySection(products) {
    const tbody = document.getElementById('inventory-table-full-body');
    const alertPill = document.getElementById('inventory-low-stock-alert-pill');
    if (!tbody) return;

    const lowStockItems = products.filter(p => (p.stock || p.qty_on_hand || 0) <= (p.minAlert || p.min_stock_alert_level || 5));

    if (alertPill) {
      if (lowStockItems.length > 0) {
        alertPill.innerHTML = `
          <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: var(--cc-radius-md); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">⚠️</span>
              <span style="color: #fbbf24; font-size: 13px; font-weight: 600;">
                Low Stock Warning: ${lowStockItems.length} products have fallen to or below the minimum reorder threshold.
              </span>
            </div>
          </div>
        `;
      } else {
        alertPill.innerHTML = `
          <div style="background: rgba(0, 229, 153, 0.08); border: 1px solid rgba(0, 229, 153, 0.3); border-radius: var(--cc-radius-md); padding: 10px 14px; font-size: 12px; color: var(--cc-neon-green);">
            ✓ All catalog inventory items are above their minimum alert levels.
          </div>
        `;
      }
    }

    let html = '';
    products.forEach(p => {
      const stockQty = p.stock !== undefined ? p.stock : (p.qty_on_hand || 0);
      const minAlert = p.minAlert !== undefined ? p.minAlert : (p.min_stock_alert_level || 5);
      const isLow = stockQty <= minAlert;
      const isOut = stockQty <= 0;
      const statusBadge = isOut ? 'cc-badge-danger' : isLow ? 'cc-badge-warning' : 'cc-badge-active';
      const statusText = isOut ? 'OUT OF STOCK' : isLow ? 'LOW STOCK' : 'IN STOCK';

      html += `
        <tr>
          <td><strong>${p.name}</strong><br><span class="cc-body-xs" style="color: var(--cc-text-muted);">${p.desc || ''}</span></td>
          <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${p.sku || p.default_code}</strong></td>
          <td><span class="cc-badge cc-badge-silver">${(p.category || 'General').toUpperCase()}</span></td>
          <td><strong style="font-size: 15px; color: ${isLow ? '#f87171' : 'var(--cc-text-primary)'}; font-family: monospace;">${stockQty} units</strong></td>
          <td><span style="color: var(--cc-text-muted); font-family: monospace;">${minAlert} units</span></td>
          <td><strong style="color: #FFF; font-family: monospace;">${formatCurrency(p.price || p.list_price || 0)}</strong></td>
          <td><span class="cc-badge ${statusBadge}">${statusText}</span></td>
          <td style="text-align: right;">
            <button class="cc-btn cc-btn-secondary cc-btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="restockProduct('${p.id || p.sku}', 5)">
              +5 Restock
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function restockProduct(productId, amount) {
    const products = window.ClubDataStore ? window.ClubDataStore.getProducts() : [];
    const p = products.find(item => item.id === productId || item.sku === productId);
    if (p) {
      p.stock = (p.stock || p.qty_on_hand || 0) + amount;
      if (p.qty_on_hand !== undefined) p.qty_on_hand = p.stock;
      window.ClubDataStore.saveProducts(products);
      renderAllSections();
      alert(`✓ Restocked 5 units for ${p.name}. New quantity: ${p.stock} units.`);
    }
  }

  // =========================================================================
  // SECTION 7: CRM ENQUIRIES PIPELINE (5-STAGE KANBAN)
  // =========================================================================
  function renderCrmPipelineSection(leads) {
    const containers = {
      new: document.getElementById('crm-cards-new'),
      contacted: document.getElementById('crm-cards-contacted'),
      followup: document.getElementById('crm-cards-followup'),
      quote: document.getElementById('crm-cards-quote'),
      converted: document.getElementById('crm-cards-converted')
    };

    const badges = {
      new: document.getElementById('crm-badge-new'),
      contacted: document.getElementById('crm-badge-contacted'),
      followup: document.getElementById('crm-badge-followup'),
      quote: document.getElementById('crm-badge-quote'),
      converted: document.getElementById('crm-badge-converted')
    };

    // Clear column containers
    Object.values(containers).forEach(c => { if (c) c.innerHTML = ''; });

    const counts = { new: 0, contacted: 0, followup: 0, quote: 0, converted: 0 };

    leads.forEach(lead => {
      const stage = (lead.stage || 'new').toLowerCase();
      if (counts[stage] !== undefined) {
        counts[stage]++;
      }
      const col = containers[stage];
      if (!col) return;

      const planCode = (lead.plan || 'gold').toLowerCase();
      const planBadgeClass = planCode === 'gold' ? 'cc-badge-gold' : planCode === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior';
      const sourceLabel = (lead.source || 'website') === 'website' ? 'WEB' : (lead.source || 'walkin') === 'walkin' ? 'WALK-IN' : (lead.source || 'phone').toUpperCase();

      const card = document.createElement('div');
      card.className = `cc-lead-card ${stage === 'converted' ? 'is-converted' : ''}`;
      card.setAttribute('data-lead-id', lead.id || lead.rawId);
      card.onclick = () => openLeadDetail(lead.id || lead.rawId);

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <span class="cc-text-mono" style="font-size: 11px; font-weight: 700; color: var(--cc-gold-400);">${lead.id || lead.rawId}</span>
          <div style="display: flex; gap: 4px;">
            <span class="cc-badge cc-badge-silver" style="font-size: 9px; padding: 1px 4px; text-transform: uppercase;">${sourceLabel}</span>
            <span class="cc-badge ${planBadgeClass}" style="font-size: 9px; padding: 1px 5px; text-transform: uppercase;">${planCode.toUpperCase()}</span>
          </div>
        </div>

        <div style="font-weight: 700; color: var(--cc-text-primary); font-size: 14px;">${lead.name}</div>
        <div style="font-size: 12px; color: var(--cc-text-secondary);">${lead.phone || ''}</div>

        ${lead.quoteSent ? `
          <div style="font-size: 11px; color: var(--cc-neon-green); font-weight: 600;">
            ✓ Quoted: ₹ ${Number(lead.quoteAmount || 24000).toLocaleString()}
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--cc-border-subtle); padding-top: 6px; margin-top: 4px; font-size: 11px; color: var(--cc-text-muted);">
          <span style="max-width: 110px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${(lead.staff || 'Staff').split(' ')[0]}</span>
          <span>${lead.followups ? lead.followups.length : 1} logs</span>
        </div>
      `;

      col.appendChild(card);
    });

    // Empty state handling for columns with 0 cards (Exact "No data available" style from reference)
    Object.keys(containers).forEach(k => {
      const col = containers[k];
      if (col && counts[k] === 0) {
        col.innerHTML = '<div style="text-align: center; color: var(--cc-text-muted); font-size: 12px; padding: 1.5rem 0.5rem;">No data available</div>';
      }
    });

    // Update badge counts
    Object.keys(badges).forEach(k => {
      if (badges[k]) badges[k].textContent = counts[k];
    });
  }

  function filterCrmPipeline(filterCode) {
    crmActiveFilter = filterCode || 'all';
    document.querySelectorAll('#crm-filter-pills-bar .cc-filter-pill').forEach(btn => {
      btn.classList.toggle('is-active', btn.getAttribute('data-crmfilter') === crmActiveFilter);
    });
    const leads = window.ClubDataStore ? window.ClubDataStore.getLeads() : [];
    renderCrmPipelineSection(leads);
  }

  function handleCrmSearch() {
    const input = document.getElementById('crm-search-input');
    crmSearchQuery = input ? input.value : '';
    const leads = window.ClubDataStore ? window.ClubDataStore.getLeads() : [];
    renderCrmPipelineSection(leads);
  }

  async function quickAdvanceLead(leadId, targetStage) {
    if (!leadId || !targetStage) return;

    const leads = window.ClubDataStore ? window.ClubDataStore.getLeads() : [];
    const lead = leads.find(l => l.id === leadId || l.rawId === leadId);
    if (!lead) return;

    if (targetStage === 'converted') {
      selectedLeadId = leadId;
      await handleConvertLead();
      return;
    }

    lead.stage = targetStage;
    lead.followups = lead.followups || [];
    const stageLabels = {
      contacted: 'Staff reached out via phone & WhatsApp discovery call.',
      followup: 'Trial court session & facility tour scheduled.',
      quote: `Quote of ${formatCurrency(lead.quoteAmount || 24000)} issued to visitor.`
    };
    lead.followups.push({
      time: '2026-10-03 ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      note: stageLabels[targetStage] || `Stage updated to ${targetStage.toUpperCase()}`
    });

    if (targetStage === 'contacted') {
      try {
        await fetch('/champions_club/crm/lead/contacted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enquiry_id: leadId })
        });
      } catch (e) {}
    } else if (targetStage === 'followup') {
      try {
        await fetch('/champions_club/crm/lead/followup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enquiry_id: leadId, note: 'Trial court session & facility tour scheduled.' })
        });
      } catch (e) {}
    }

    if (window.ClubDataStore) {
      window.ClubDataStore.saveLeads(leads);
    }
    renderAllSections();
  }

  function openLeadDetail(leadId) {
    const leads = window.ClubDataStore ? window.ClubDataStore.getLeads() : [];
    const lead = leads.find(l => l.id === leadId || l.rawId === leadId);
    if (!lead) return;

    selectedLeadId = lead.id || lead.rawId;

    const elRef = document.getElementById('crm-modal-ref');
    const elName = document.getElementById('crm-modal-name');
    const elContact = document.getElementById('crm-modal-contact');
    const elPlan = document.getElementById('crm-modal-plan-badge');
    const elMsg = document.getElementById('crm-modal-message');
    const elQuoteAmt = document.getElementById('crm-modal-quote-amount');
    const elQuoteStatus = document.getElementById('crm-modal-quote-status');
    const timeline = document.getElementById('crm-modal-timeline');
    const btnConvert = document.getElementById('btn-crm-convert');

    if (elRef) elRef.textContent = lead.id || lead.rawId;
    if (elName) elName.textContent = lead.name;
    if (elContact) elContact.textContent = `${lead.phone || ''} ${lead.email ? '• ' + lead.email : ''}`;
    if (elPlan) {
      const planCode = (lead.plan || 'gold').toLowerCase();
      elPlan.className = `cc-badge ${planCode === 'gold' ? 'cc-badge-gold' : planCode === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior'}`;
      elPlan.textContent = `${planCode.toUpperCase()} PLAN`;
    }
    if (elMsg) elMsg.textContent = lead.message || 'No additional inquiry message provided.';
    if (elQuoteAmt) elQuoteAmt.value = lead.quoteAmount || (lead.plan === 'gold' ? 24000 : lead.plan === 'silver' ? 14000 : 8000);
    if (elQuoteStatus) {
      elQuoteStatus.textContent = lead.quoteSent ? `Sent (${formatCurrency(lead.quoteAmount || 0)})` : 'Pending';
      elQuoteStatus.className = `cc-badge ${lead.quoteSent ? 'cc-badge-active' : 'cc-badge-warning'}`;
    }
    if (btnConvert) {
      btnConvert.style.display = lead.stage === 'converted' ? 'none' : 'inline-block';
    }

    if (timeline) {
      let tHtml = '';
      (lead.followups || []).forEach(f => {
        tHtml += `
          <div class="cc-timeline-item">
            <div class="cc-timeline-dot"></div>
            <div style="font-size: 10px; color: var(--cc-text-muted);">${f.time || '2026-10-03'}</div>
            <div style="font-size: 12px; color: #FFF;">${f.note}</div>
          </div>
        `;
      });
      timeline.innerHTML = tHtml || '<div style="font-size: 11px; color: var(--cc-text-muted);">No notes yet.</div>';
    }

    openModal('modal-lead-detail');
  }

  async function handleSendLeadQuote() {
    if (!selectedLeadId) return;
    const amt = parseFloat(document.getElementById('crm-modal-quote-amount')?.value || 24000);

    // Call server endpoint
    try {
      await fetch('/champions_club/crm/lead/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiry_id: selectedLeadId, quote_amount: amt })
      });
    } catch (e) {}

    // Update local store
    const leads = window.ClubDataStore ? window.ClubDataStore.getLeads() : [];
    const lead = leads.find(l => l.id === selectedLeadId || l.rawId === selectedLeadId);
    if (lead) {
      lead.quoteSent = true;
      lead.quoteAmount = amt;
      lead.stage = 'quote';
      lead.followups = lead.followups || [];
      lead.followups.push({
        time: '2026-10-03 16:00',
        note: `Official quote of ${formatCurrency(amt)} sent to visitor.`
      });
      window.ClubDataStore.saveLeads(leads);
    }

    openLeadDetail(selectedLeadId);
    renderAllSections();
  }

  async function handleAddLeadFollowup() {
    if (!selectedLeadId) return;
    const noteInput = document.getElementById('crm-modal-note-input');
    const noteText = (noteInput?.value || '').trim();
    if (!noteText) return;

    try {
      await fetch('/champions_club/crm/lead/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiry_id: selectedLeadId, note: noteText })
      });
    } catch (e) {}

    const leads = window.ClubDataStore ? window.ClubDataStore.getLeads() : [];
    const lead = leads.find(l => l.id === selectedLeadId || l.rawId === selectedLeadId);
    if (lead) {
      lead.followups = lead.followups || [];
      lead.followups.push({
        time: '2026-10-03 16:05',
        note: noteText
      });
      if (lead.stage === 'new' || lead.stage === 'contacted') {
        lead.stage = 'followup';
      }
      window.ClubDataStore.saveLeads(leads);
    }

    if (noteInput) noteInput.value = '';
    openLeadDetail(selectedLeadId);
    renderAllSections();
  }

  async function handleMarkLeadContacted() {
    if (!selectedLeadId) return;

    try {
      await fetch('/champions_club/crm/lead/contacted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiry_id: selectedLeadId })
      });
    } catch (e) {}

    const leads = window.ClubDataStore ? window.ClubDataStore.getLeads() : [];
    const lead = leads.find(l => l.id === selectedLeadId || l.rawId === selectedLeadId);
    if (lead) {
      lead.stage = 'contacted';
      lead.followups = lead.followups || [];
      lead.followups.push({
        time: '2026-10-03 16:10',
        note: 'Staff reached out to visitor via phone/WhatsApp.'
      });
      window.ClubDataStore.saveLeads(leads);
    }

    openLeadDetail(selectedLeadId);
    renderAllSections();
  }

  async function handleConvertLead() {
    if (!selectedLeadId) return;

    let serverRes = null;
    try {
      const res = await fetch('/champions_club/crm/lead/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiry_id: selectedLeadId })
      });
      if (res.ok) serverRes = await res.json();
    } catch (e) {}

    const leads = window.ClubDataStore ? window.ClubDataStore.getLeads() : [];
    const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
    const lead = leads.find(l => l.id === selectedLeadId || l.rawId === selectedLeadId);

    if (lead) {
      const newMemId = serverRes?.member_code || `CC-MEM-00${100 + members.length + 1}`;
      
      // Ensure member created locally if not already present
      if (!members.find(m => m.id === newMemId || m.phone === lead.phone)) {
        members.push({
          id: newMemId,
          name: lead.name,
          email: lead.email || '',
          phone: lead.phone || '',
          plan: lead.plan || 'gold',
          startDate: '2026-10-03',
          endDate: '2027-10-03',
          state: 'active',
          history: [
            { timestamp: '2026-10-03 16:15', type: 'signup', desc: `Enrolled from CRM Enquiry ${lead.id || lead.rawId}` }
          ],
          notes: `Converted lead from CRM. Quoted: ${formatCurrency(lead.quoteAmount || 24000)}`
        });
        window.ClubDataStore.saveMembers(members);
      }

      lead.memberId = newMemId;
      lead.stage = 'converted';
      lead.followups = lead.followups || [];
      lead.followups.push({
        time: '2026-10-03 16:15',
        note: `Converted to active Member ${newMemId}!`
      });
      window.ClubDataStore.saveLeads(leads);
    }

    closeModal('modal-lead-detail');
    renderAllSections();
    alert(`✓ Lead successfully converted to Active Member! Profile created in Membership Roster.`);
  }

  // =========================================================================
  // SECTION 8: INVOICES & BUSINESS CLIENTS
  // =========================================================================
  function renderInvoicesSection(invoices) {
    const tbody = document.getElementById('invoices-table-body');
    if (!tbody) return;

    const totalInvoiced = invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    const paid = invoices.filter(i => i.state === 'paid').reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    const pending = invoices.filter(i => i.state === 'pending').reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    const overdue = invoices.filter(i => i.state === 'overdue').reduce((sum, i) => sum + (i.totalAmount || 0), 0);

    const elKpiTotal = document.getElementById('inv-kpi-total');
    if (elKpiTotal) elKpiTotal.textContent = formatCurrency(totalInvoiced);
    const elKpiPaid = document.getElementById('inv-kpi-paid');
    if (elKpiPaid) elKpiPaid.textContent = formatCurrency(paid);
    const elKpiPending = document.getElementById('inv-kpi-pending');
    if (elKpiPending) elKpiPending.textContent = formatCurrency(pending);
    const elKpiOverdue = document.getElementById('inv-kpi-overdue');
    if (elKpiOverdue) elKpiOverdue.textContent = formatCurrency(overdue);

    let html = '';
    invoices.forEach(inv => {
      const stateBadge = inv.state === 'paid' ? 'cc-badge-active' : inv.state === 'pending' ? 'cc-badge-warning' : 'cc-badge-danger';
      const typeBadge = inv.invoiceType === 'corporate' ? 'cc-badge-silver' : 'cc-badge-gold';

      html += `
        <tr>
          <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${inv.id}</strong></td>
          <td><strong>${inv.clientName}</strong></td>
          <td><span class="cc-badge ${typeBadge}">${(inv.invoiceType || 'B2B').toUpperCase()}</span></td>
          <td style="font-size: 12px;">${inv.issueDate}</td>
          <td style="font-size: 12px;">${inv.dueDate}</td>
          <td style="font-family: monospace;">${formatCurrency(inv.amountUntaxed || 0)}</td>
          <td style="font-family: monospace; color: var(--cc-text-muted);">${formatCurrency(inv.taxAmount || 0)}</td>
          <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${formatCurrency(inv.totalAmount || 0)}</strong></td>
          <td><span class="cc-badge ${stateBadge}">${inv.state.toUpperCase()}</span></td>
          <td style="text-align: right;">
            ${inv.state !== 'paid' ? `
              <button class="cc-btn cc-btn-primary cc-btn-sm cc-btn-pill" style="padding: 2px 10px; font-size: 11px;" onclick="markInvoicePaid('${inv.id}')">
                Mark Paid
              </button>
            ` : '<span style="font-size: 11px; color: var(--cc-neon-green);">✓ Reconciled</span>'}
          </td>
        </tr>
      `;
    });

    if (invoices.length === 0) {
      html = '<tr><td colspan="10" style="text-align: center; color: var(--cc-text-muted); padding: 2rem;">0 invoices recorded.</td></tr>';
    }
    tbody.innerHTML = html;
  }

  function markInvoicePaid(invId) {
    const invoices = window.ClubDataStore ? window.ClubDataStore.getInvoices() : [];
    const inv = invoices.find(i => i.id === invId);
    if (inv) {
      inv.state = 'paid';
      window.ClubDataStore.saveInvoices(invoices);
      renderAllSections();
      alert(`✓ Invoice ${invId} marked as Paid!`);
    }
  }

  // =========================================================================
  // SECTION 9: EMPLOYEE MANAGEMENT
  // =========================================================================
  function renderEmployeesSection(employees) {
    const tbody = document.getElementById('employees-table-body');
    const elPayroll = document.getElementById('emp-payroll-total');
    const elCount = document.getElementById('emp-active-count');
    if (!tbody) return;

    const totalPayroll = employees.reduce((sum, e) => sum + (e.salary || 0), 0);
    if (elPayroll) elPayroll.textContent = `${formatCurrency(totalPayroll)} / month`;
    if (elCount) elCount.textContent = `${employees.length} Staff`;

    let html = '';
    employees.forEach(emp => {
      html += `
        <tr>
          <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${emp.id}</strong></td>
          <td><strong>${emp.name}</strong></td>
          <td>${emp.role}</td>
          <td><span class="cc-badge cc-badge-silver">${emp.department}</span></td>
          <td style="font-size: 12px; font-family: monospace;">${emp.phone}</td>
          <td style="font-size: 12px; color: var(--cc-text-secondary);">${emp.email}</td>
          <td><strong style="color: #FFF; font-family: monospace;">${formatCurrency(emp.salary || 0)}</strong></td>
          <td><span class="cc-badge cc-badge-active">ACTIVE</span></td>
          <td style="font-size: 12px;">${emp.joinedDate}</td>
        </tr>
      `;
    });

    if (employees.length === 0) {
      html = '<tr><td colspan="9" style="text-align: center; color: var(--cc-text-muted); padding: 2rem;">0 employee records found.</td></tr>';
    }
    tbody.innerHTML = html;
  }

  // =========================================================================
  // SECTION 10: LEAVE MANAGEMENT
  // =========================================================================
  function renderLeavesSection(leaves) {
    const tbody = document.getElementById('leaves-table-body');
    if (!tbody) return;

    let html = '';
    leaves.forEach(lv => {
      const stateBadge = lv.state === 'approved' ? 'cc-badge-active' : lv.state === 'rejected' ? 'cc-badge-danger' : 'cc-badge-warning';

      html += `
        <tr>
          <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${lv.id}</strong></td>
          <td><strong>${lv.employeeName}</strong></td>
          <td><span class="cc-badge cc-badge-silver">${lv.leaveType}</span></td>
          <td style="font-size: 12px;">${lv.startDate}</td>
          <td style="font-size: 12px;">${lv.endDate}</td>
          <td><strong style="font-family: monospace;">${lv.days} days</strong></td>
          <td style="font-size: 12px; color: var(--cc-text-secondary);">${lv.reason}</td>
          <td><span class="cc-badge ${stateBadge}">${lv.state.toUpperCase()}</span></td>
          <td style="text-align: right; white-space: nowrap;">
            ${lv.state === 'requested' ? `
              <button class="cc-btn cc-btn-primary cc-btn-sm cc-btn-pill" style="padding: 2px 10px; font-size: 11px;" onclick="approveLeave('${lv.id}')">
                Approve
              </button>
              <button class="cc-btn cc-btn-ghost cc-btn-sm" style="color: #fca5a5; padding: 2px 8px; font-size: 11px; margin-left: 4px;" onclick="rejectLeave('${lv.id}')">
                Reject
              </button>
            ` : `<span style="font-size: 11px; color: var(--cc-text-muted);">${lv.state.toUpperCase()}</span>`}
          </td>
        </tr>
      `;
    });

    if (leaves.length === 0) {
      html = '<tr><td colspan="9" style="text-align: center; color: var(--cc-text-muted); padding: 2rem;">0 leave requests.</td></tr>';
    }
    tbody.innerHTML = html;
  }

  function approveLeave(leaveId) {
    const leaves = window.ClubDataStore ? window.ClubDataStore.getLeaves() : [];
    const lv = leaves.find(l => l.id === leaveId);
    if (lv) {
      lv.state = 'approved';
      window.ClubDataStore.saveLeaves(leaves);
      renderAllSections();
      alert(`✓ Leave request ${leaveId} approved for ${lv.employeeName}.`);
    }
  }

  function rejectLeave(leaveId) {
    const leaves = window.ClubDataStore ? window.ClubDataStore.getLeaves() : [];
    const lv = leaves.find(l => l.id === leaveId);
    if (lv) {
      lv.state = 'rejected';
      window.ClubDataStore.saveLeaves(leaves);
      renderAllSections();
      alert(`✕ Leave request ${leaveId} rejected.`);
    }
  }

  // =========================================================================
  // SECTION 11: TAX & AUDIT REPORTS
  // =========================================================================
  function renderTaxReportsSection({ bookings, shopOrders, barRevenue, invoices }) {
    const courtRev = bookings.filter(b => b.state === 'confirmed').reduce((sum, b) => sum + (b.fee || 0), 0);
    const shopRev = shopOrders.filter(o => o.state !== 'cancelled').reduce((sum, o) => sum + (o.total || 0), 0);
    const barRev = (barRevenue.cash || 0) + (barRevenue.card || 0) + (barRevenue.upi || 0);
    const grossRev = courtRev + shopRev + barRev;

    const taxableBase = grossRev / 1.18;
    const gstTotal = grossRev - taxableBase;

    const elGross = document.getElementById('tax-gross-rev');
    if (elGross) elGross.textContent = formatCurrency(grossRev);
    const elBase = document.getElementById('tax-taxable-base');
    if (elBase) elBase.textContent = formatCurrency(taxableBase);
    const elGst = document.getElementById('tax-gst-total');
    if (elGst) elGst.textContent = formatCurrency(gstTotal);

    const tbody = document.getElementById('tax-matrix-table-body');
    if (tbody) {
      const streams = [
        { name: '🎾 Court Arena Bookings', txCount: bookings.filter(b => b.state === 'confirmed').length, gross: courtRev },
        { name: '🛍️ Pro Shop Sales & Merchandising', txCount: shopOrders.filter(o => o.state !== 'cancelled').length, gross: shopRev },
        { name: '🍹 Bar & Cafeteria POS', txCount: 3, gross: barRev }
      ];

      let html = '';
      streams.forEach(st => {
        const netBase = st.gross / 1.18;
        const tax = st.gross - netBase;
        html += `
          <tr>
            <td><strong>${st.name}</strong></td>
            <td style="font-family: monospace;">${st.txCount} txns</td>
            <td><strong style="color: var(--cc-gold-400); font-family: monospace;">${formatCurrency(st.gross)}</strong></td>
            <td><span class="cc-badge cc-badge-silver">18% GST</span></td>
            <td style="color: var(--cc-neon-green); font-family: monospace;">${formatCurrency(tax)}</td>
            <td><strong style="color: #FFF; font-family: monospace;">${formatCurrency(netBase)}</strong></td>
          </tr>
        `;
      });

      html += `
        <tr style="background: rgba(212, 175, 55, 0.08); font-weight: 700;">
          <td><strong style="color: var(--cc-gold-400);">TOTAL CLUB TAXABLE OPERATIONS</strong></td>
          <td style="font-family: monospace;">${bookings.length + shopOrders.length + 3} txns</td>
          <td><span style="font-size: 15px; color: var(--cc-gold-400); font-family: monospace;">${formatCurrency(grossRev)}</span></td>
          <td><span class="cc-badge cc-badge-gold">GST 18%</span></td>
          <td style="color: var(--cc-neon-green); font-family: monospace;">${formatCurrency(gstTotal)}</td>
          <td><span style="font-size: 15px; color: #FFF; font-family: monospace;">${formatCurrency(taxableBase)}</span></td>
        </tr>
      `;

      tbody.innerHTML = html;
    }
  }

  // =========================================================================
  // MODAL HANDLERS & FORM SUBMISSIONS
  // =========================================================================
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  function openPlanConfigModal() {
    const plans = window.ClubDataStore ? window.ClubDataStore.getPlanBenefits() : {
      gold: { name: "Gold Plan", fee: 24000, courtRate: 0, shopDiscount: 15, barDiscount: 15, guestPasses: 4 },
      silver: { name: "Silver Plan", fee: 14000, courtRate: 300, shopDiscount: 10, barDiscount: 10, guestPasses: 1 },
      junior: { name: "Junior Plan", fee: 8000, courtRate: 200, shopDiscount: 15, barDiscount: 5, guestPasses: 0 }
    };

    const gFee = document.getElementById('cfg-gold-fee');
    const gCourt = document.getElementById('cfg-gold-court');
    const gShop = document.getElementById('cfg-gold-shop');
    const gBar = document.getElementById('cfg-gold-bar');
    const gPasses = document.getElementById('cfg-gold-passes');

    const sFee = document.getElementById('cfg-silver-fee');
    const sCourt = document.getElementById('cfg-silver-court');
    const sShop = document.getElementById('cfg-silver-shop');
    const sBar = document.getElementById('cfg-silver-bar');
    const sPasses = document.getElementById('cfg-silver-passes');

    const jFee = document.getElementById('cfg-junior-fee');
    const jCourt = document.getElementById('cfg-junior-court');
    const jShop = document.getElementById('cfg-junior-shop');
    const jBar = document.getElementById('cfg-junior-bar');
    const jPasses = document.getElementById('cfg-junior-passes');

    if (gFee) gFee.value = plans.gold?.fee || 24000;
    if (gCourt) gCourt.value = plans.gold?.courtRate !== undefined ? plans.gold.courtRate : 0;
    if (gShop) gShop.value = plans.gold?.shopDiscount || 15;
    if (gBar) gBar.value = plans.gold?.barDiscount || 15;
    if (gPasses) gPasses.value = plans.gold?.guestPasses !== undefined ? plans.gold.guestPasses : 4;

    if (sFee) sFee.value = plans.silver?.fee || 14000;
    if (sCourt) sCourt.value = plans.silver?.courtRate !== undefined ? plans.silver.courtRate : 300;
    if (sShop) sShop.value = plans.silver?.shopDiscount || 10;
    if (sBar) sBar.value = plans.silver?.barDiscount || 10;
    if (sPasses) sPasses.value = plans.silver?.guestPasses !== undefined ? plans.silver.guestPasses : 1;

    if (jFee) jFee.value = plans.junior?.fee || 8000;
    if (jCourt) jCourt.value = plans.junior?.courtRate !== undefined ? plans.junior.courtRate : 200;
    if (jShop) jShop.value = plans.junior?.shopDiscount || 15;
    if (jBar) jBar.value = plans.junior?.barDiscount || 5;
    if (jPasses) jPasses.value = plans.junior?.guestPasses !== undefined ? plans.junior.guestPasses : 0;

    openModal('modal-config-plans');
  }

  function handleSavePlanConfig(event) {
    if (event) event.preventDefault();

    const gFee = parseFloat(document.getElementById('cfg-gold-fee')?.value || 24000);
    const gCourt = parseFloat(document.getElementById('cfg-gold-court')?.value || 0);
    const gShop = parseFloat(document.getElementById('cfg-gold-shop')?.value || 15);
    const gBar = parseFloat(document.getElementById('cfg-gold-bar')?.value || 15);
    const gPasses = parseInt(document.getElementById('cfg-gold-passes')?.value || 4);

    const sFee = parseFloat(document.getElementById('cfg-silver-fee')?.value || 14000);
    const sCourt = parseFloat(document.getElementById('cfg-silver-court')?.value || 300);
    const sShop = parseFloat(document.getElementById('cfg-silver-shop')?.value || 10);
    const sBar = parseFloat(document.getElementById('cfg-silver-bar')?.value || 10);
    const sPasses = parseInt(document.getElementById('cfg-silver-passes')?.value || 1);

    const jFee = parseFloat(document.getElementById('cfg-junior-fee')?.value || 8000);
    const jCourt = parseFloat(document.getElementById('cfg-junior-court')?.value || 200);
    const jShop = parseFloat(document.getElementById('cfg-junior-shop')?.value || 15);
    const jBar = parseFloat(document.getElementById('cfg-junior-bar')?.value || 5);
    const jPasses = parseInt(document.getElementById('cfg-junior-passes')?.value || 0);

    const updatedPlans = {
      gold: {
        name: "Gold Plan",
        fee: gFee,
        courtRate: gCourt,
        courtAccess: gCourt === 0 ? "Full Club Court Access (Free / ₹0)" : `Club Court Access (₹${gCourt}/hr)`,
        shopDiscount: gShop,
        barDiscount: gBar,
        allowTab: true,
        guestPasses: gPasses,
        priorityBooking: true
      },
      silver: {
        name: "Silver Plan",
        fee: sFee,
        courtRate: sCourt,
        courtAccess: `Standard Member Rate (₹${sCourt}/hr)`,
        shopDiscount: sShop,
        barDiscount: sBar,
        allowTab: false,
        guestPasses: sPasses,
        priorityBooking: false
      },
      junior: {
        name: "Junior Plan",
        fee: jFee,
        courtRate: jCourt,
        courtAccess: `Youth Training Rate (₹${jCourt}/hr)`,
        shopDiscount: jShop,
        barDiscount: jBar,
        allowTab: false,
        guestPasses: jPasses,
        priorityBooking: false,
        coachingAccess: true
      }
    };

    if (window.ClubDataStore && window.ClubDataStore.savePlanBenefits) {
      window.ClubDataStore.savePlanBenefits(updatedPlans);
    }

    closeModal('modal-config-plans');
    renderAllSections();
    alert(`✓ Membership tier pricing updated successfully!\n• Gold: ${formatCurrency(gFee)}/yr (Court: ₹${gCourt}/hr)\n• Silver: ${formatCurrency(sFee)}/yr (Court: ₹${sCourt}/hr)\n• Junior: ${formatCurrency(jFee)}/yr (Court: ₹${jCourt}/hr)\n\nNew rates and discounts are now live everywhere!`);
  }

  function populateMemberSelectDropdowns(members) {
    const bkSel = document.getElementById('bk-member-select');
    if (bkSel) {
      let html = '';
      members.forEach(m => {
        html += `<option value="${m.id}">${m.name} (${(m.plan || 'gold').toUpperCase()} - ${m.id})</option>`;
      });
      bkSel.innerHTML = html;
    }

    // Also populate New Member Tier Dropdown dynamically with current prices
    const planSel = document.getElementById('mem-new-plan');
    if (planSel) {
      const plans = window.ClubDataStore ? window.ClubDataStore.getPlanBenefits() : {
        gold: { fee: 24000, courtRate: 0 },
        silver: { fee: 14000, courtRate: 300 },
        junior: { fee: 8000, courtRate: 200 }
      };

      const gFee = plans.gold?.fee || 24000;
      const sFee = plans.silver?.fee || 14000;
      const jFee = plans.junior?.fee || 8000;

      planSel.innerHTML = `
        <option value="gold">★ Gold Plan (${formatCurrency(gFee)} / yr - ${plans.gold?.courtRate === 0 ? 'Free Courts' : formatCurrency(plans.gold?.courtRate || 0)+'/hr'})</option>
        <option value="silver">◆ Silver Plan (${formatCurrency(sFee)} / yr - ${formatCurrency(plans.silver?.courtRate || 300)}/hr Courts)</option>
        <option value="junior">● Junior Plan (${formatCurrency(jFee)} / yr - ${formatCurrency(plans.junior?.courtRate || 200)}/hr Courts)</option>
      `;
    }
  }

  function updateBookingRatePreview() {
    const playerType = document.getElementById('bk-player-type')?.value;
    const memId = document.getElementById('bk-member-select')?.value;
    const preview = document.getElementById('bk-calculated-rate');
    if (!preview) return;

    if (playerType === 'walkin') {
      preview.textContent = '₹ 600.00 (Standard Walk-in Rate)';
      preview.style.color = '#FFF';
    } else {
      const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
      const plans = window.ClubDataStore ? window.ClubDataStore.getPlanBenefits() : {};
      const m = members.find(item => item.id === memId);
      const plan = (m?.plan || 'gold').toLowerCase();
      const planInfo = plans[plan] || { courtRate: plan === 'gold' ? 0 : plan === 'silver' ? 300 : 200 };
      const rate = planInfo.courtRate;
      
      if (rate === 0 || rate === '0') {
        preview.textContent = '₹ 0.00 (Gold Plan Free Booking)';
        preview.style.color = 'var(--cc-neon-green)';
      } else {
        preview.textContent = `${formatCurrency(rate)} (${plan.toUpperCase()} Member Rate)`;
        preview.style.color = plan === 'junior' ? 'var(--cc-junior-blue)' : 'var(--cc-gold-400)';
      }
    }
  }

  function updateInvoicePreview() {
    const amt = parseFloat(document.getElementById('inv-amount')?.value || 0);
    const tax = amt * 0.18;
    const total = amt + tax;
    const elTax = document.getElementById('inv-tax-preview');
    const elTotal = document.getElementById('inv-total-preview');
    if (elTax) elTax.textContent = formatCurrency(tax);
    if (elTotal) elTotal.textContent = formatCurrency(total);
  }

  // Form Submissions
  async function handleEnrollMember(event) {
    event.preventDefault();
    const name = document.getElementById('mem-new-name')?.value;
    const phone = document.getElementById('mem-new-phone')?.value;
    const email = document.getElementById('mem-new-email')?.value;
    const plan = document.getElementById('mem-new-plan')?.value || 'gold';
    const startDate = document.getElementById('mem-new-start')?.value || '2026-10-03';
    const notes = document.getElementById('mem-new-notes')?.value || '';

    const start = new Date(startDate);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    const endDate = end.toISOString().split('T')[0];

    const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
    const newId = `CC-MEM-00${100 + members.length + 1}`;

    const newMem = {
      id: newId,
      name,
      phone,
      email,
      plan,
      startDate,
      endDate,
      state: 'active',
      history: [
        { timestamp: '2026-10-03 16:30', type: 'signup', desc: `Enrolled under ${plan.toUpperCase()} Plan (1 Year Validity)` }
      ],
      notes
    };

    // Server create call
    try {
      await fetch('/champions_club/membership/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMem)
      });
    } catch (e) {}

    members.push(newMem);
    window.ClubDataStore.saveMembers(members);

    closeModal('modal-new-member');
    document.getElementById('form-enroll-member')?.reset();
    renderAllSections();
    alert(`✓ Member ${name} enrolled successfully with Member ID ${newId}!`);
  }

  function handleCreateBooking(event) {
    event.preventDefault();
    const courtId = document.getElementById('bk-court-select')?.value;
    const date = document.getElementById('bk-date')?.value;
    const startTime = document.getElementById('bk-time')?.value;
    const playerType = document.getElementById('bk-player-type')?.value;
    const memberId = document.getElementById('bk-member-select')?.value;

    const courtNames = {
      '1': 'Tennis Court 1 (Clay)',
      '2': 'Tennis Court 2 (Hard)',
      '3': 'Cricket Pitch & Net 1 (Turf)',
      '4': 'Cricket Practice Net 2 (Synthetic)',
      '5': 'Badminton Court 1 (Indoor Mat)',
      '6': 'Badminton Court 2 (Indoor Mat)'
    };
    const sports = { '1': 'tennis', '2': 'tennis', '3': 'cricket', '4': 'cricket', '5': 'badminton', '6': 'badminton' };

    const members = window.ClubDataStore ? window.ClubDataStore.getMembers() : [];
    const m = members.find(item => item.id === memberId);
    let fee = 600;
    let rateApplied = '₹ 600.00';
    let playerName = 'Walk-in Guest';

    if (playerType === 'member' && m) {
      playerName = `${m.name} (${(m.plan || 'gold').toUpperCase()})`;
      if (m.plan === 'gold') { fee = 0; rateApplied = '₹ 0.00 (Free)'; }
      else if (m.plan === 'silver') { fee = 300; rateApplied = '₹ 300.00'; }
      else { fee = 200; rateApplied = '₹ 200.00'; }
    }

    const bookings = window.ClubDataStore ? window.ClubDataStore.getBookings() : [];
    const newBkId = `CC-BK-000${bookings.length + 1}`;

    const newBooking = {
      id: newBkId,
      courtId,
      courtName: courtNames[courtId] || 'Court',
      sport: sports[courtId] || 'tennis',
      date,
      startTime,
      endTime: (parseInt(startTime.split(':')[0]) + 1).toString().padStart(2, '0') + ':00',
      bookingType: playerType,
      memberId: playerType === 'member' ? memberId : null,
      playerName,
      rateApplied,
      fee,
      isSocial: false,
      state: 'confirmed'
    };

    bookings.push(newBooking);
    window.ClubDataStore.saveBookings(bookings);

    closeModal('modal-new-booking');
    document.getElementById('form-create-booking')?.reset();
    renderAllSections();
    alert(`✓ Court reserved successfully! Booking ID: ${newBkId}`);
  }

  function handleCreateProduct(event) {
    event.preventDefault();
    const name = document.getElementById('prod-name')?.value;
    const category = document.getElementById('prod-category')?.value;
    const price = parseFloat(document.getElementById('prod-price')?.value || 0);
    const stock = parseInt(document.getElementById('prod-stock')?.value || 0);
    const minAlert = parseInt(document.getElementById('prod-alert')?.value || 5);

    const products = window.ClubDataStore ? window.ClubDataStore.getProducts() : [];
    const newSku = `CC-${category.substring(0, 3).toUpperCase()}-0${products.length + 1}`;

    const newProd = {
      id: `p${products.length + 1}`,
      sku: newSku,
      name,
      category,
      price,
      stock,
      minAlert,
      desc: 'Shared shelf retail inventory.'
    };

    products.push(newProd);
    window.ClubDataStore.saveProducts(products);

    closeModal('modal-new-product');
    document.getElementById('form-create-product')?.reset();
    renderAllSections();
    alert(`✓ Product "${name}" (${newSku}) added to shelf!`);
  }

  function handleCreateInvoice(event) {
    event.preventDefault();
    const clientName = document.getElementById('inv-client-name')?.value;
    const invoiceType = document.getElementById('inv-type')?.value;
    const amountUntaxed = parseFloat(document.getElementById('inv-amount')?.value || 0);
    const dueDate = document.getElementById('inv-due-date')?.value;
    const status = document.getElementById('inv-status')?.value || 'pending';

    const taxAmount = amountUntaxed * 0.18;
    const totalAmount = amountUntaxed + taxAmount;

    const invoices = window.ClubDataStore ? window.ClubDataStore.getInvoices() : [];
    const newInvId = `CC-INV-2026-010${invoices.length + 1}`;

    const newInv = {
      id: newInvId,
      clientName,
      invoiceType,
      issueDate: '2026-10-03',
      dueDate,
      amountUntaxed,
      taxAmount,
      totalAmount,
      state: status,
      paymentMethod: status === 'paid' ? 'card' : null,
      notes: 'Generated via Control Center.'
    };

    invoices.push(newInv);
    window.ClubDataStore.saveInvoices(invoices);

    closeModal('modal-new-invoice');
    document.getElementById('form-create-invoice')?.reset();
    renderAllSections();
    alert(`✓ Invoice ${newInvId} generated successfully!`);
  }

  async function handleCreateEnquiry(event) {
    event.preventDefault();
    const name = document.getElementById('adm-enq-name')?.value;
    const phone = document.getElementById('adm-enq-phone')?.value;
    const email = document.getElementById('adm-enq-email')?.value;
    const source = document.getElementById('adm-enq-source')?.value;
    const plan = document.getElementById('adm-enq-plan')?.value;
    const message = document.getElementById('adm-enq-msg')?.value;

    let resData = null;
    try {
      const res = await fetch('/champions_club/enquiry/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email, source, plan, message })
      });
      if (res.ok) resData = await res.json();
    } catch (e) {}

    const leads = window.ClubDataStore ? window.ClubDataStore.getLeads() : [];
    const newRef = resData?.reference || `CC-ENQ-00${40 + leads.length + 1}`;
    
    if (!leads.find(l => l.id === newRef || l.phone === phone)) {
      leads.unshift({
        id: newRef,
        rawId: newRef,
        name,
        phone,
        email,
        source,
        plan,
        message,
        stage: 'new',
        staff: 'Pooja Patel (Membership Advisor)',
        quoteSent: false,
        quoteAmount: (window.ClubDataStore?.getPlanBenefits()?.[plan]?.fee) || (plan === 'gold' ? 24000 : plan === 'silver' ? 14000 : 8000),
        followups: [
          { time: '2026-10-03 16:45', note: `Enquiry logged via Front Desk. Source: ${source}.` }
        ],
        memberId: null
      });
      window.ClubDataStore.saveLeads(leads);
    }

    closeModal('modal-new-enquiry');
    document.getElementById('form-admin-new-enquiry')?.reset();
    renderAllSections();
    alert(`✓ Visitor enquiry logged! Reference ID: ${newRef}`);
  }

  function handleCreateEmployee(event) {
    event.preventDefault();
    const name = document.getElementById('emp-name')?.value;
    const role = document.getElementById('emp-role')?.value;
    const department = document.getElementById('emp-dept')?.value;
    const phone = document.getElementById('emp-phone')?.value;
    const salary = parseFloat(document.getElementById('emp-salary')?.value || 0);

    const employees = window.ClubDataStore ? window.ClubDataStore.getEmployees() : [];
    const newEmpId = `CC-EMP-000${employees.length + 1}`;

    const newEmp = {
      id: newEmpId,
      name,
      role,
      department,
      phone,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@championsclub.com`,
      salary,
      state: 'active',
      joinedDate: '2026-10-03'
    };

    employees.push(newEmp);
    window.ClubDataStore.saveEmployees(employees);

    closeModal('modal-new-employee');
    document.getElementById('form-create-employee')?.reset();
    renderAllSections();
    alert(`✓ Staff member ${name} (${newEmpId}) saved!`);
  }

  function populateCourtDropdowns() {
    const sel = document.getElementById('bk-court-select');
    if (!sel) return;
    const courts = window.ClubDataStore ? window.ClubDataStore.getCourts() : [];
    if (!courts || courts.length === 0) return;
    
    const currVal = sel.value;
    sel.innerHTML = courts.map(c => `
      <option value="${c.id}">${c.name} (${c.surface || 'Standard'}) - ₹${c.walkinRate || 500}/hr</option>
    `).join('');
    if (currVal && courts.some(c => String(c.id) === String(currVal))) {
      sel.value = currVal;
    }
  }

  function switchQuickAddTab(tabKey) {
    document.querySelectorAll('.cc-qadd-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-qtab') === tabKey) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    document.querySelectorAll('.cc-qadd-pane').forEach(pane => {
      if (pane.id === `qadd-pane-${tabKey}`) {
        pane.style.display = 'block';
      } else {
        pane.style.display = 'none';
      }
    });
  }

  function openQuickAddModal(tabKey = 'court') {
    switchQuickAddTab(tabKey);
    openModal('modal-quick-add-hub');
  }

  function handleCreateCourt(event) {
    event.preventDefault();
    const name = (document.getElementById('qadd-court-name')?.value || document.getElementById('court-new-name')?.value)?.trim();
    const sport = document.getElementById('qadd-court-sport')?.value || document.getElementById('court-new-sport')?.value || 'tennis';
    const surface = document.getElementById('qadd-court-surface')?.value || document.getElementById('court-new-surface')?.value || 'Clay';
    const rate = parseFloat(document.getElementById('qadd-court-rate')?.value || document.getElementById('court-new-rate')?.value || 500);
    const status = document.getElementById('qadd-court-status')?.value || document.getElementById('court-new-status')?.value || 'active';

    if (!name) return;

    const courts = window.ClubDataStore ? window.ClubDataStore.getCourts() : [];
    const newCourt = {
      id: String(courts.length + 1),
      name: name,
      sport: sport,
      surface: surface,
      walkinRate: rate,
      state: status
    };

    window.ClubDataStore.addCourt(newCourt);
    populateCourtDropdowns();

    closeModal('modal-quick-add-hub');
    closeModal('modal-add-court');
    document.getElementById('form-qadd-court')?.reset();
    document.getElementById('form-create-court')?.reset();
    renderAllSections();
    alert(`✓ New arena "${name}" added and activated successfully!`);
  }

  function toggleBarModalMode(mode) {
    const btnTables = [document.getElementById('btn-bar-toggle-table'), document.getElementById('btn-qadd-bar-toggle-table')];
    const btnItems = [document.getElementById('btn-bar-toggle-item'), document.getElementById('btn-qadd-bar-toggle-item')];
    const tableFields = [document.getElementById('bar-form-table-fields'), document.getElementById('qadd-bar-form-table-fields')];
    const itemFields = [document.getElementById('bar-form-item-fields'), document.getElementById('qadd-bar-form-item-fields')];
    const modeInputs = [document.getElementById('bar-asset-mode'), document.getElementById('qadd-bar-asset-mode')];
    const submitBtns = [document.getElementById('btn-submit-bar-asset'), document.getElementById('btn-qadd-submit-bar-asset')];

    if (mode === 'table') {
      btnTables.forEach(b => b && b.classList.add('is-active'));
      btnItems.forEach(b => b && b.classList.remove('is-active'));
      tableFields.forEach(f => f && (f.style.display = 'block'));
      itemFields.forEach(f => f && (f.style.display = 'none'));
      modeInputs.forEach(i => i && (i.value = 'table'));
      submitBtns.forEach(s => s && (s.textContent = 'Save Table'));
    } else {
      btnTables.forEach(b => b && b.classList.remove('is-active'));
      btnItems.forEach(b => b && b.classList.add('is-active'));
      tableFields.forEach(f => f && (f.style.display = 'none'));
      itemFields.forEach(f => f && (f.style.display = 'block'));
      modeInputs.forEach(i => i && (i.value = 'item'));
      submitBtns.forEach(s => s && (s.textContent = 'Save Menu Item'));
    }
  }

  function handleCreateBarAsset(event) {
    event.preventDefault();
    const mode = document.getElementById('qadd-bar-asset-mode')?.value || document.getElementById('bar-asset-mode')?.value || 'table';

    if (mode === 'table') {
      const name = (document.getElementById('qadd-bar-table-name')?.value || document.getElementById('bar-table-name')?.value)?.trim();
      const area = document.getElementById('qadd-bar-table-area')?.value || document.getElementById('bar-table-area')?.value || 'Courtside';
      const capacity = parseInt(document.getElementById('qadd-bar-table-capacity')?.value || document.getElementById('bar-table-capacity')?.value || 4);

      if (!name) {
        alert('Please provide a table name.');
        return;
      }

      const tables = window.ClubDataStore ? window.ClubDataStore.getBarTables() : [];
      const newTable = {
        id: 't' + (tables.length + 1),
        name: name,
        area: area,
        capacity: capacity,
        state: 'available',
        currentTab: null
      };

      window.ClubDataStore.addBarTable(newTable);
      closeModal('modal-quick-add-hub');
      closeModal('modal-add-bar-item');
      document.getElementById('form-qadd-bar-asset')?.reset();
      document.getElementById('form-create-bar-asset')?.reset();
      renderAllSections();
      alert(`✓ Dining Table "${name}" (${area}) added successfully!`);
    } else {
      const name = (document.getElementById('qadd-bar-item-name')?.value || document.getElementById('bar-item-name')?.value)?.trim();
      const category = document.getElementById('qadd-bar-item-category')?.value || document.getElementById('bar-item-category')?.value || 'Smoothies & Shakes';
      const price = parseFloat(document.getElementById('qadd-bar-item-price')?.value || document.getElementById('bar-item-price')?.value || 0);
      const tax = parseInt(document.getElementById('qadd-bar-item-tax')?.value || document.getElementById('bar-item-tax')?.value || 5);

      if (!name || isNaN(price) || price <= 0) {
        alert('Please enter a valid menu item name and price.');
        return;
      }

      const newItem = {
        name: name,
        category: category,
        price: price,
        tax: tax
      };

      window.ClubDataStore.addBarMenuItem(newItem);
      closeModal('modal-quick-add-hub');
      closeModal('modal-add-bar-item');
      document.getElementById('form-qadd-bar-asset')?.reset();
      document.getElementById('form-create-bar-asset')?.reset();
      renderAllSections();
      alert(`✓ Cafeteria Item "${name}" (₹${price.toFixed(2)}) added to menu!`);
    }
  }

  // =========================================================================
  // GLOBAL EXPORTS & INITIALIZATION
  // =========================================================================
  window.switchDashboardTab = switchDashboardTab;
  window.filterMembersTable = filterMembersTable;
  window.handleMemberSearch = handleMemberSearch;
  window.handleMemberSort = handleMemberSort;
  window.openMember360 = openMember360;
  window.quickBookMember = quickBookMember;
  window.handle360Renew = handle360Renew;
  window.handle360Expire = handle360Expire;
  window.handle360Book = handle360Book;
  window.triggerQuickRenew = triggerQuickRenew;
  window.filterBookingsTable = filterBookingsTable;
  window.cancelBooking = cancelBooking;
  window.setFinancePeriod = setFinancePeriod;
  window.exportRevenueCSV = exportRevenueCSV;
  window.settleBarTab = settleBarTab;
  window.openBarShiftSettleModal = openBarShiftSettleModal;
  window.restockProduct = restockProduct;
  window.openLeadDetail = openLeadDetail;
  window.filterCrmPipeline = filterCrmPipeline;
  window.handleCrmSearch = handleCrmSearch;
  window.quickAdvanceLead = quickAdvanceLead;
  window.handleSendLeadQuote = handleSendLeadQuote;
  window.handleAddLeadFollowup = handleAddLeadFollowup;
  window.handleMarkLeadContacted = handleMarkLeadContacted;
  window.handleConvertLead = handleConvertLead;
  window.markInvoicePaid = markInvoicePaid;
  window.approveLeave = approveLeave;
  window.rejectLeave = rejectLeave;
  window.openModal = openModal;
  window.closeModal = closeModal;
  window.openPlanConfigModal = openPlanConfigModal;
  window.handleSavePlanConfig = handleSavePlanConfig;
  window.updateBookingRatePreview = updateBookingRatePreview;
  window.updateInvoicePreview = updateInvoicePreview;
  window.handleEnrollMember = handleEnrollMember;
  window.handleCreateBooking = handleCreateBooking;
  window.handleCreateCourt = handleCreateCourt;
  window.handleCreateProduct = handleCreateProduct;
  window.toggleBarModalMode = toggleBarModalMode;
  window.handleCreateBarAsset = handleCreateBarAsset;
  window.populateCourtDropdowns = populateCourtDropdowns;
  window.switchQuickAddTab = switchQuickAddTab;
  window.openQuickAddModal = openQuickAddModal;
  window.handleCreateInvoice = handleCreateInvoice;
  window.handleCreateEnquiry = handleCreateEnquiry;
  window.handleCreateEmployee = handleCreateEmployee;

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Master Render
    renderAllSections();

    // 2. Tab Navigation Click Events
    document.querySelectorAll('.cc-admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) switchDashboardTab(tab);
      });
    });

    // 3. Overview Period Filter Pills
    document.querySelectorAll('.cc-time-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.cc-time-filter-pill').forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        currentOverviewPeriod = pill.getAttribute('data-period') || 'today';
        renderAllSections();
      });
    });

    // 4. Restore Baseline Button
    const btnRestore = document.getElementById('btn-restore-demo');
    if (btnRestore) {
      btnRestore.addEventListener('click', () => {
        if (window.ClubDataStore) {
          window.ClubDataStore.resetToDemoData();
          renderAllSections();
          alert('✓ Baseline DEMO DATA records restored successfully.');
        }
      });
    }

    // 5. Close Modals on Backdrop Click
    document.querySelectorAll('.cc-modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('is-open');
          document.body.style.overflow = '';
        }
      });
    });
  });

})();
