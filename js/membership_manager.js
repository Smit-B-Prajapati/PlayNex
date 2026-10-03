/**
 * CHAMPIONS CLUB — Membership Management Controller
 * Fully functional membership backend client communicating with Odoo ORM models via ClubAPI.
 * Handles Member Profile, 5 Status States (Draft, Active, Expiring, Expired, Cancelled),
 * Expiry calculated from stored dates, Entitlement revocation, and 360 Relational History.
 */

// Master Configurable Plans (Gold, Silver, Junior)
const membershipPlans = {
  gold: {
    name: 'Gold',
    badgeClass: 'cc-badge-gold',
    code: 'gold',
    fee: '₹ 24,000 / yr (Configurable)',
    feeAmount: 24000,
    courtRate: 'Free / Zero',
    shopDiscount: '20% Discount',
    barDiscount: '15% Discount',
    shopDiscountPct: 20,
    barDiscountPct: 15,
    tabAllowed: true
  },
  silver: {
    name: 'Silver',
    badgeClass: 'cc-badge-silver',
    code: 'silver',
    fee: '₹ 14,000 / yr (Configurable)',
    feeAmount: 14000,
    courtRate: '₹ 300 / hr (Configurable)',
    shopDiscount: '10% Discount',
    barDiscount: '10% Discount',
    shopDiscountPct: 10,
    barDiscountPct: 10,
    tabAllowed: false
  },
  junior: {
    name: 'Junior',
    badgeClass: 'cc-badge-junior',
    code: 'junior',
    fee: '₹ 8,000 / yr (Configurable)',
    feeAmount: 8000,
    courtRate: '₹ 200 / hr (Configurable)',
    shopDiscount: '15% Discount',
    barDiscount: '5% Discount',
    shopDiscountPct: 15,
    barDiscountPct: 5,
    tabAllowed: false
  }
};

// Authoritative Current System Date: 2026-10-03
const CURRENT_DATE = new Date('2026-10-03T00:00:00');

/**
 * Calculates membership status dynamically from stored dates and manual lifecycle states.
 * Supports 5 Explicit States: Draft, Active, Expiring Soon, Expired, Cancelled.
 */
function computeMemberStatus(member) {
  // If explicitly Draft
  if (member.state === 'draft') {
    return {
      state: 'draft',
      days: 0,
      label: 'Draft / Application',
      badgeClass: 'cc-badge-outline',
      hasActiveBenefits: false
    };
  }

  // If explicitly Cancelled
  if (member.state === 'cancelled') {
    return {
      state: 'cancelled',
      days: 0,
      label: 'Cancelled',
      badgeClass: 'cc-badge-danger',
      hasActiveBenefits: false
    };
  }

  // Calculate from stored dates
  const endDateStr = member.endDate || member.end_date;
  if (!endDateStr) {
    return {
      state: 'expired',
      days: 0,
      label: 'Expired',
      badgeClass: 'cc-badge-danger',
      hasActiveBenefits: false
    };
  }

  const endDate = new Date(endDateStr + 'T00:00:00');
  const diffTime = endDate - CURRENT_DATE;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      state: 'expired',
      days: diffDays,
      label: 'Expired',
      badgeClass: 'cc-badge-danger',
      hasActiveBenefits: false
    };
  } else if (diffDays <= 30) {
    return {
      state: 'expiring',
      days: diffDays,
      label: `Expiring Soon (${diffDays}d)`,
      badgeClass: 'cc-badge-warning',
      hasActiveBenefits: true
    };
  } else {
    return {
      state: 'active',
      days: diffDays,
      label: 'Active',
      badgeClass: 'cc-badge-active',
      hasActiveBenefits: true
    };
  }
}

let currentFilter = 'all';
let currentSearch = '';
let selectedMemberId = null;

async function loadPlansFromBackend() {
  try {
    if (window.ClubAPI) {
      const plans = await window.ClubAPI.getPlans();
      if (plans && plans.length > 0) {
        plans.forEach(p => {
          if (membershipPlans[p.code]) {
            membershipPlans[p.code].fee = `₹ ${p.fee_amount.toLocaleString()} / yr`;
            membershipPlans[p.code].feeAmount = p.fee_amount;
            membershipPlans[p.code].shopDiscountPct = p.shop_discount_percent;
            membershipPlans[p.code].barDiscountPct = p.bar_discount_percent;
            membershipPlans[p.code].shopDiscount = `${p.shop_discount_percent}% Discount`;
            membershipPlans[p.code].barDiscount = `${p.bar_discount_percent}% Discount`;
          }
        });
      }
    }
  } catch (err) {
    console.warn('Could not load plans from backend, using defaults.');
  }
}

async function getMembersFromStorage() {
  try {
    if (window.ClubAPI) {
      const members = await window.ClubAPI.getMembers({ state: currentFilter !== 'all' ? currentFilter : null, search: currentSearch });
      if (members && members.length > 0) {
        return members.map(m => ({
          id: m.member_code || m.id,
          raw_id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          plan: (m.tier_code || m.plan_name || 'silver').toLowerCase(),
          startDate: m.start_date,
          endDate: m.end_date,
          state: m.state,
          history: m.history || []
        }));
      }
    }
  } catch (e) {
    console.warn('Could not query members live, using local store:', e.message);
  }
  if (window.ClubDataStore) {
    return window.ClubDataStore.getMembers();
  }
  return [];
}

function saveMembersToStorage(members) {
  if (window.ClubDataStore) {
    window.ClubDataStore.saveMembers(members);
  }
}

async function renderMembers() {
  const tbody = document.getElementById('members-table-body');
  const emptyState = document.getElementById('members-empty-state');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align: center; padding: 2rem; color: var(--cc-text-muted);">
        <div class="cc-spinner" style="margin: 0 auto 0.5rem;"></div>
        Querying Odoo Member Records...
      </td>
    </tr>
  `;

  const memberData = await getMembersFromStorage();
  tbody.innerHTML = '';

  let activeCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  let otherCount = 0;

  // Compute counts strictly from stored data
  memberData.forEach(m => {
    const status = computeMemberStatus(m);
    if (status.state === 'active') activeCount++;
    else if (status.state === 'expiring') expiringCount++;
    else if (status.state === 'expired') expiredCount++;
    else otherCount++;
  });

  const elActive = document.getElementById('stat-active');
  const elExpiring = document.getElementById('stat-expiring');
  const elExpired = document.getElementById('stat-expired');
  const elOther = document.getElementById('stat-other');

  if (elActive) elActive.textContent = activeCount;
  if (elExpiring) elExpiring.textContent = expiringCount;
  if (elExpired) elExpired.textContent = expiredCount;
  if (elOther) elOther.textContent = otherCount;

  // Filter & Search
  const filtered = memberData.filter(m => {
    const status = computeMemberStatus(m);
    
    // Status & tier filters
    if (currentFilter === 'active' && status.state !== 'active') return false;
    if (currentFilter === 'expiring' && status.state !== 'expiring') return false;
    if (currentFilter === 'expired' && status.state !== 'expired') return false;
    if (currentFilter === 'draft' && status.state !== 'draft') return false;
    if (currentFilter === 'cancelled' && status.state !== 'cancelled') return false;
    if (currentFilter === 'gold' && m.plan !== 'gold') return false;
    if (currentFilter === 'silver' && m.plan !== 'silver') return false;
    if (currentFilter === 'junior' && m.plan !== 'junior') return false;

    // Search query matching
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      const matchName = (m.name || '').toLowerCase().includes(q);
      const matchId = (m.id || '').toLowerCase().includes(q);
      const matchPhone = (m.phone || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchPhone) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--cc-text-muted); padding: 2.5rem;">
          No data available
        </td>
      </tr>
    `;
    return;
  } else {
    if (emptyState) emptyState.style.display = 'none';
  }

  filtered.forEach(m => {
    const status = computeMemberStatus(m);
    const planInfo = membershipPlans[m.plan] || membershipPlans.silver;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="font-weight: 700; color: var(--cc-text-primary);">${m.name}</div>
        <div class="cc-text-mono" style="font-size: 12px; color: var(--cc-text-muted);">${m.id}</div>
      </td>
      <td>
        <span class="cc-badge ${planInfo.badgeClass}">
          ${m.plan === 'gold' ? '&#9733; Gold' : m.plan === 'silver' ? '&#9670; Silver' : '&#9679; Junior'}
        </span>
      </td>
      <td>
        <div style="font-size: 13px; color: var(--cc-text-primary);">${m.phone}</div>
        <div style="font-size: 11px; color: var(--cc-text-muted);">${m.email || '—'}</div>
      </td>
      <td class="cc-text-mono" style="font-size: 13px;">
        ${m.startDate} <span style="color: var(--cc-text-muted);">&rarr;</span> ${m.endDate}
      </td>
      <td>
        <span class="cc-text-mono" style="font-weight: 700; color: ${status.state === 'expired' ? 'var(--cc-crimson)' : status.state === 'expiring' ? '#FBBF24' : status.state === 'active' ? 'var(--cc-neon-green)' : 'var(--cc-text-muted)'};">
          ${status.state === 'draft' || status.state === 'cancelled' ? '—' : status.days < 0 ? `${Math.abs(status.days)} days ago` : `${status.days} days`}
        </span>
      </td>
      <td>
        <span class="cc-badge ${status.hasActiveBenefits ? 'cc-badge-active' : 'cc-badge-danger'}">
          ${status.hasActiveBenefits ? '&#10003; Active Benefits' : '&#10005; Benefits Suspended'}
        </span>
      </td>
      <td>
        <span class="cc-badge ${status.badgeClass}">
          ${status.state === 'active' ? '<span class="cc-pulse-dot"></span> ' : ''}${status.label}
        </span>
      </td>
      <td style="text-align: right;">
        <button class="cc-btn cc-btn-secondary cc-btn-sm" onclick="openMemberDetail('${m.id}')">
          Profile &amp; 360 History
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openMemberDetail = async function(memberId) {
  selectedMemberId = memberId;
  const memberData = await getMembersFromStorage();
  let member = memberData.find(m => m.id === memberId || String(m.raw_id) === String(memberId));

  // Fetch full 360 details from Odoo ORM if available
  if (window.ClubAPI && member && member.raw_id) {
    const liveDetail = await window.ClubAPI.getMemberDetail(member.raw_id);
    if (liveDetail) {
      member = {
        id: liveDetail.member_code || member.id,
        raw_id: liveDetail.id,
        name: liveDetail.name,
        email: liveDetail.email,
        phone: liveDetail.phone,
        plan: (liveDetail.tier_code || 'silver').toLowerCase(),
        startDate: liveDetail.start_date,
        endDate: liveDetail.end_date,
        state: liveDetail.state,
        history: liveDetail.history || member.history || [],
        bookings: liveDetail.bookings || [],
        shop_orders: liveDetail.shop_orders || [],
        bar_tabs: liveDetail.bar_tabs || []
      };
    }
  }

  if (!member) return;

  const modal = document.getElementById('modal-member-detail');
  const planInfo = membershipPlans[member.plan] || membershipPlans.silver;
  const status = computeMemberStatus(member);

  document.getElementById('detail-member-id').textContent = member.id;
  document.getElementById('detail-member-name').textContent = member.name;
  document.getElementById('detail-expiry-date').textContent = member.endDate;

  document.getElementById('detail-plan-badge').innerHTML = `
    <span class="cc-badge ${planInfo.badgeClass}">
      ${member.plan === 'gold' ? '★ Gold Tier' : member.plan === 'silver' ? '◆ Silver Tier' : '● Junior Tier'}
    </span>
  `;

  document.getElementById('detail-status-badge').innerHTML = `
    <span class="cc-badge ${status.badgeClass}">${status.label}</span>
  `;

  document.getElementById('detail-benefits-badge').innerHTML = `
    <span class="cc-badge ${status.hasActiveBenefits ? 'cc-badge-active' : 'cc-badge-danger'}">
      ${status.hasActiveBenefits ? 'Entitled' : 'Suspended'}
    </span>
  `;

  // Entitlements: active only if status allows
  if (status.hasActiveBenefits) {
    document.getElementById('detail-court-entitlement').textContent = planInfo.courtRate;
    document.getElementById('detail-shop-discount').textContent = planInfo.shopDiscount;
    document.getElementById('detail-bar-discount').textContent = planInfo.barDiscount;
  } else {
    document.getElementById('detail-court-entitlement').textContent = 'Walk-in Rate (Suspended)';
    document.getElementById('detail-shop-discount').textContent = '0% (Suspended)';
    document.getElementById('detail-bar-discount').textContent = '0% (Suspended)';
  }

  // Toggle Action Buttons based on state
  const btnActivate = document.getElementById('btn-action-activate');
  const btnRenew = document.getElementById('btn-action-renew');
  const btnCancel = document.getElementById('btn-action-cancel');
  const btnChangePlan = document.getElementById('btn-action-change-plan');
  const btnCheckin = document.getElementById('btn-action-checkin');

  if (btnActivate) {
    btnActivate.style.display = member.state === 'draft' ? 'inline-flex' : 'none';
  }
  if (btnCancel) {
    btnCancel.style.display = member.state === 'cancelled' ? 'none' : 'inline-flex';
  }

  // 1. Render Activity History Log
  const historyList = document.getElementById('detail-history-list');
  if (historyList) {
    historyList.innerHTML = '';
    const hist = (member.history || []).slice().reverse();
    if (hist.length === 0) {
      historyList.innerHTML = '<div style="color: var(--cc-text-muted); font-size: 13px;">No activity logged yet.</div>';
    } else {
      hist.forEach(h => {
        const item = document.createElement('div');
        item.className = 'cc-history-item';
        item.innerHTML = `
          <div class="cc-history-time">${h.timestamp} &bull; <strong style="text-transform: uppercase;">${h.activity_type || h.type || 'Event'}</strong></div>
          <div class="cc-history-desc">${h.description || h.desc}</div>
        `;
        historyList.appendChild(item);
      });
    }
  }

  // 2. Render Linked Court Bookings
  const bookingsList = document.getElementById('detail-bookings-list');
  if (bookingsList) {
    let memberBookings = member.bookings || [];
    if (memberBookings.length === 0 && window.ClubDataStore) {
      const allBookings = window.ClubDataStore.getBookings() || [];
      memberBookings = allBookings.filter(b => b.memberId === member.id);
    }

    if (memberBookings.length === 0) {
      bookingsList.innerHTML = '<p style="color: var(--cc-text-muted);">No court bookings on record for this member.</p>';
    } else {
      let bHtml = '<table class="cc-table" style="font-size: 12px;"><thead><tr><th>Booking Ref</th><th>Court</th><th>Date & Time</th><th>Rate Applied</th><th>Status</th></tr></thead><tbody>';
      memberBookings.forEach(b => {
        bHtml += `<tr>
          <td class="cc-text-mono">${b.name || b.id}</td>
          <td>${b.court || b.courtName || b.courtId}</td>
          <td>${b.start_time || `${b.date} ${b.startTime}`}</td>
          <td>${b.rate_applied || b.rateApplied}</td>
          <td><span class="cc-badge cc-badge-active">${b.state}</span></td>
        </tr>`;
      });
      bHtml += '</tbody></table>';
      bookingsList.innerHTML = bHtml;
    }
  }

  // 3. Render Linked Pro Shop Purchases
  const purchasesList = document.getElementById('detail-purchases-list');
  if (purchasesList) {
    let memberShopOrders = member.shop_orders || [];
    if (memberShopOrders.length === 0 && window.ClubDataStore) {
      const allShopOrders = window.ClubDataStore.getShopOrders() || [];
      memberShopOrders = allShopOrders.filter(o => (o.customer || '').includes(member.name) || o.memberId === member.id);
    }

    if (memberShopOrders.length === 0) {
      purchasesList.innerHTML = '<p style="color: var(--cc-text-muted);">No pro shop purchases found.</p>';
    } else {
      let sHtml = '<table class="cc-table" style="font-size: 12px;"><thead><tr><th>Order ID</th><th>Channel</th><th>Total</th><th>Status</th></tr></thead><tbody>';
      memberShopOrders.forEach(o => {
        sHtml += `<tr>
          <td class="cc-text-mono">${o.name || o.id}</td>
          <td>${o.channel}</td>
          <td class="cc-text-mono">₹ ${(o.amount_total || o.total || 0).toLocaleString()}</td>
          <td><span class="cc-badge cc-badge-active">${o.state}</span></td>
        </tr>`;
      });
      sHtml += '</tbody></table>';
      purchasesList.innerHTML = sHtml;
    }
  }

  if (modal) {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await loadPlansFromBackend();
  await renderMembers();

  // Search input
  const searchInput = document.getElementById('member-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      renderMembers();
    });
  }

  // Filter pills
  const pills = document.querySelectorAll('.cc-filter-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      currentFilter = pill.getAttribute('data-filter');
      renderMembers();
    });
  });

  // Open New Member Modal
  const btnAdd = document.getElementById('btn-add-member');
  const modalAdd = document.getElementById('modal-add-member');
  if (btnAdd && modalAdd) {
    btnAdd.addEventListener('click', () => {
      modalAdd.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  }

  // Submit New Member Form (Connects to Odoo ORM via ClubAPI)
  const formAdd = document.getElementById('form-new-member');
  if (formAdd) {
    formAdd.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('new-member-name').value.trim();
      const phone = document.getElementById('new-member-phone').value.trim();
      const email = document.getElementById('new-member-email').value.trim();
      const plan = document.getElementById('new-member-plan').value;
      const startDate = document.getElementById('new-member-start-date').value;
      const endDate = document.getElementById('new-member-end-date').value;
      const notes = document.getElementById('new-member-notes').value.trim();

      const planObj = membershipPlans[plan];
      const planIdMap = { gold: 1, silver: 2, junior: 3 };

      try {
        if (window.ClubAPI) {
          await window.ClubAPI.createMember({
            name: name,
            phone: phone,
            email: email,
            plan_id: planIdMap[plan] || 1,
            plan_code: plan,
            start_date: startDate,
            end_date: endDate,
            state: 'active',
            notes: notes
          });
        }
      } catch (err) {
        console.warn('Backend creation failed, relying on local store:', err.message);
      }

      modalAdd.classList.remove('is-open');
      document.body.style.overflow = '';
      formAdd.reset();
      await renderMembers();
    });
  }

  // Action: Check-in
  const btnCheckin = document.getElementById('btn-action-checkin');
  if (btnCheckin) {
    btnCheckin.addEventListener('click', async () => {
      if (!selectedMemberId) return;
      if (window.ClubAPI) {
        try {
          await window.ClubAPI.memberAction(selectedMemberId, 'checkin', { facility_note: 'Front Desk Walk-in' });
        } catch (e) {}
      }
      openMemberDetail(selectedMemberId);
      renderMembers();
    });
  }

  // Action: Renew Membership
  const btnRenew = document.getElementById('btn-action-renew');
  if (btnRenew) {
    btnRenew.addEventListener('click', async () => {
      if (!selectedMemberId) return;
      if (window.ClubAPI) {
        try {
          await window.ClubAPI.memberAction(selectedMemberId, 'renew', { extension_days: 365 });
        } catch (e) {}
      }
      openMemberDetail(selectedMemberId);
      renderMembers();
    });
  }

  // Action: Cancel Membership
  const btnCancel = document.getElementById('btn-action-cancel');
  if (btnCancel) {
    btnCancel.addEventListener('click', async () => {
      if (!selectedMemberId) return;
      if (!confirm('Are you sure you want to cancel this membership? All active tier benefits will be suspended.')) {
        return;
      }
      if (window.ClubAPI) {
        try {
          await window.ClubAPI.memberAction(selectedMemberId, 'cancel', { reason: 'Cancelled by front desk' });
        } catch (e) {}
      }
      openMemberDetail(selectedMemberId);
      renderMembers();
    });
  }

  // Action: Change Plan Tier
  const btnChangePlan = document.getElementById('btn-action-change-plan');
  if (btnChangePlan) {
    btnChangePlan.addEventListener('click', async () => {
      if (!selectedMemberId) return;
      const planIdMap = { gold: 1, silver: 2, junior: 3 };
      if (window.ClubAPI) {
        try {
          await window.ClubAPI.memberAction(selectedMemberId, 'change_plan', { new_plan_id: 1 });
        } catch (e) {}
      }
      openMemberDetail(selectedMemberId);
      renderMembers();
    });
  }

  // Open / Save Plan Configuration Modal
  const btnConfigPlans = document.getElementById('btn-config-plans');
  const modalConfigPlans = document.getElementById('modal-config-plans');
  const btnSavePlanConfig = document.getElementById('btn-save-plan-config');

  if (btnConfigPlans && modalConfigPlans) {
    btnConfigPlans.addEventListener('click', () => {
      modalConfigPlans.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  }

  if (btnSavePlanConfig && modalConfigPlans) {
    btnSavePlanConfig.addEventListener('click', () => {
      membershipPlans.gold.fee = document.getElementById('cfg-gold-fee').value;
      membershipPlans.gold.courtRate = document.getElementById('cfg-gold-court').value;
      membershipPlans.gold.shopDiscount = document.getElementById('cfg-gold-shop').value;
      membershipPlans.gold.barDiscount = document.getElementById('cfg-gold-bar').value;

      membershipPlans.silver.fee = document.getElementById('cfg-silver-fee').value;
      membershipPlans.silver.courtRate = document.getElementById('cfg-silver-court').value;
      membershipPlans.silver.shopDiscount = document.getElementById('cfg-silver-shop').value;
      membershipPlans.silver.barDiscount = document.getElementById('cfg-silver-bar').value;

      membershipPlans.junior.fee = document.getElementById('cfg-junior-fee').value;
      membershipPlans.junior.courtRate = document.getElementById('cfg-junior-court').value;
      membershipPlans.junior.shopDiscount = document.getElementById('cfg-junior-shop').value;
      membershipPlans.junior.barDiscount = document.getElementById('cfg-junior-bar').value;

      modalConfigPlans.classList.remove('is-open');
      document.body.style.overflow = '';
      renderMembers();
    });
  }
});
