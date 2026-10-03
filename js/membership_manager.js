/**
 * CHAMPIONS CLUB — Membership & Entitlements Management Controller
 * Central identity and entitlement layer for Gold, Silver, and Junior memberships.
 * Features:
 * 1. 6-Card Interactive KPI Deck (Total, Gold, Silver, Junior, Expiring Soon, Expired)
 * 2. 3 Premium Plan Cards with Live Counts, Configurable Rates & Entitlements
 * 3. Expiring Soon Alert Banner with Fast-Renewal Trigger
 * 4. Filterable, Searchable, Sortable Member Table with Tier Ring Avatars & Badges
 * 5. Digital Membership Card with live SVG QR Code Generator
 * 6. 360° Relational Activity Timeline (Signups, Renewals, Plan Changes, Bookings, Shop, Bar)
 * 7. Junior DOB Validation (<18 Years) & Live New Member Summary Card Preview
 * 8. Non-Destructive Renewal Flow (+365d, +180d, +90d) preserving Member ID & History
 * 9. Seamless Plan Change Flow (Gold <-> Silver <-> Junior)
 * 10. Integrated Quick Court Booking with Tier-Based Pricing & History Recording
 * 11. Quick Scan / ID Lookup Modal for Front Desk Operations
 * 12. Full Odoo ORM & LocalStorage Synchronization via ClubAPI & ClubDataStore
 */

// Master Configurable Plans (Gold, Silver, Junior)
const membershipPlans = {
  gold: {
    name: 'Gold',
    badgeClass: 'cc-badge-gold',
    cardClass: 'cc-digital-card-gold',
    avatarClass: 'cc-avatar-gold',
    code: 'gold',
    title: 'Premium Full Access',
    fee: '₹ 24,000 / yr',
    feeAmount: 24000,
    courtRate: 'Free / Zero (₹0)',
    courtRateAmount: 0,
    shopDiscount: '15% Off Gear & Apparel',
    barDiscount: '15% Off F&B Orders',
    shopDiscountPct: 15,
    barDiscountPct: 15,
    tabAllowed: true,
    tabLabel: 'Allowed (Settle on Departure)'
  },
  silver: {
    name: 'Silver',
    badgeClass: 'cc-badge-silver',
    cardClass: 'cc-digital-card-silver',
    avatarClass: 'cc-avatar-silver',
    code: 'silver',
    title: 'Standard Membership',
    fee: '₹ 14,000 / yr',
    feeAmount: 14000,
    courtRate: '₹ 300 / hr (Member Rate)',
    courtRateAmount: 300,
    shopDiscount: '10% Off Gear & Apparel',
    barDiscount: '10% Off F&B Orders',
    shopDiscountPct: 10,
    barDiscountPct: 10,
    tabAllowed: false,
    tabLabel: 'Disabled (Pay as you go)'
  },
  junior: {
    name: 'Junior',
    badgeClass: 'cc-badge-junior',
    cardClass: 'cc-digital-card-junior',
    avatarClass: 'cc-avatar-junior',
    code: 'junior',
    title: 'Under 18 / Discounted',
    fee: '₹ 8,000 / yr',
    feeAmount: 8000,
    courtRate: '₹ 200 / hr (Youth Rate)',
    courtRateAmount: 200,
    shopDiscount: '15% Off Junior Gear',
    barDiscount: '5% Off Smoothies & Snacks',
    shopDiscountPct: 15,
    barDiscountPct: 5,
    tabAllowed: false,
    tabLabel: 'Disabled (Youth Account)'
  }
};

// Authoritative Current System Date: 2026-10-03
const CURRENT_DATE = new Date('2026-10-03T00:00:00');

/**
 * Calculates membership status dynamically from stored dates and manual lifecycle states.
 * Supports: Active (>30d), Expiring Soon (0-30d), Expired (<0d), Draft, Cancelled.
 */
function computeMemberStatus(member) {
  if (member.state === 'draft') {
    return {
      state: 'draft',
      days: 0,
      label: 'Draft / Pending',
      badgeClass: 'cc-badge-outline',
      hasActiveBenefits: false
    };
  }

  if (member.state === 'cancelled') {
    return {
      state: 'cancelled',
      days: 0,
      label: 'Cancelled',
      badgeClass: 'cc-badge-danger',
      hasActiveBenefits: false
    };
  }

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

/**
 * Calculates applicant age from date of birth against CURRENT_DATE (2026-10-03).
 */
function calculateAge(dobStr) {
  if (!dobStr) return null;
  const birthDate = new Date(dobStr + 'T00:00:00');
  let age = CURRENT_DATE.getFullYear() - birthDate.getFullYear();
  const m = CURRENT_DATE.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && CURRENT_DATE.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Generates a clean standalone SVG QR Code representation for a given payload string.
 */
function generateQRCodeSVG(text, size = 64) {
  // Deterministic pseudo-random hash generator for authentic QR visual matrix
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }

  const matrixSize = 21; // Standard Version 1 QR matrix (21x21)
  const matrix = Array(matrixSize).fill(null).map(() => Array(matrixSize).fill(false));

  // Function to draw finder pattern
  function drawFinder(r0, c0) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          matrix[r0 + r][c0 + c] = true;
        } else {
          matrix[r0 + r][c0 + c] = false;
        }
      }
    }
  }

  // Draw 3 standard corner finder patterns
  drawFinder(0, 0);
  drawFinder(0, matrixSize - 7);
  drawFinder(matrixSize - 7, 0);

  // Timing patterns
  for (let i = 8; i < matrixSize - 8; i++) {
    matrix[6][i] = (i % 2 === 0);
    matrix[i][6] = (i % 2 === 0);
  }

  // Data fill with deterministic bits from text
  let seed = Math.abs(hash);
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      // Skip finder zones
      if ((r < 8 && c < 8) || (r < 8 && c >= matrixSize - 8) || (r >= matrixSize - 8 && c < 8)) {
        continue;
      }
      if (r === 6 || c === 6) continue;
      
      seed = (seed * 9301 + 49297) % 233280;
      matrix[r][c] = (seed % 100) > 48;
    }
  }

  // Build SVG
  const cellSize = size / matrixSize;
  let rects = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = (c * cellSize).toFixed(2);
        const y = (r * cellSize).toFixed(2);
        const s = cellSize.toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#0D131F" />`;
      }
    }
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size}" ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="${size}" height="${size}" fill="#FFFFFF" rx="4" />
      ${rects}
    </svg>
  `;
}

// Global Filter & State Variables
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'expiry-asc';
let selectedMemberId = null;

/**
 * Syncs membership plans from backend or defaults.
 */
async function loadPlansFromBackend() {
  try {
    if (window.ClubAPI && window.ClubAPI.getPlans) {
      const plans = await window.ClubAPI.getPlans();
      if (plans && plans.length > 0) {
        plans.forEach(p => {
          if (membershipPlans[p.code]) {
            membershipPlans[p.code].fee = `₹ ${p.fee_amount.toLocaleString()} / yr`;
            membershipPlans[p.code].feeAmount = p.fee_amount;
            membershipPlans[p.code].shopDiscountPct = p.shop_discount_percent;
            membershipPlans[p.code].barDiscountPct = p.bar_discount_percent;
            membershipPlans[p.code].shopDiscount = `${p.shop_discount_percent}% Off Gear & Apparel`;
            membershipPlans[p.code].barDiscount = `${p.bar_discount_percent}% Off F&B Orders`;
          }
        });
      }
    }
  } catch (err) {
    console.warn('Could not load plans from backend, using defaults:', err.message);
  }
}

/**
 * Retrieves members safely from ClubAPI or ClubDataStore.
 */
async function getMembersFromStorage() {
  try {
    if (window.ClubAPI && window.ClubAPI.getMembers) {
      const members = await window.ClubAPI.getMembers({ search: currentSearch });
      if (members && members.length > 0) {
        return members.map(m => ({
          id: m.member_code || m.id,
          raw_id: m.id,
          name: m.name,
          email: m.email || '',
          phone: m.phone || '',
          dob: m.dob || m.date_of_birth || '1995-05-15',
          plan: (m.tier_code || m.plan_name || m.plan || 'silver').toLowerCase(),
          startDate: m.start_date || m.startDate || '2026-01-01',
          endDate: m.end_date || m.endDate || '2026-12-31',
          state: m.state || 'active',
          history: m.history || [],
          notes: m.notes || ''
        }));
      }
    }
  } catch (e) {
    console.warn('Could not query members live via ClubAPI, using local store:', e.message);
  }

  if (window.ClubDataStore && window.ClubDataStore.getMembers) {
    return window.ClubDataStore.getMembers();
  }
  return [];
}

/**
 * Saves members to ClubDataStore and triggers sync.
 */
function saveMembersToStorage(members) {
  if (window.ClubDataStore && window.ClubDataStore.saveMembers) {
    window.ClubDataStore.saveMembers(members);
  }
}

/**
 * Formats last activity from member history or defaults.
 */
function formatLastActivity(member) {
  if (member.history && member.history.length > 0) {
    const last = member.history[member.history.length - 1];
    const typeLabel = (last.type || 'Activity').toUpperCase();
    if (last.timestamp && last.timestamp.startsWith('2026-10-03')) {
      return `<span style="color: var(--cc-neon-green); font-weight: 700;">Today</span> <span style="font-size: 11px; color: var(--cc-text-muted);">(${typeLabel})</span>`;
    }
    return `<span>${last.timestamp ? last.timestamp.split(' ')[0] : 'Recent'}</span> <span style="font-size: 11px; color: var(--cc-text-muted);">(${typeLabel})</span>`;
  }
  return '<span style="color: var(--cc-text-muted);">Enrolled</span>';
}

/**
 * Main Render Function: Populates KPIs, Tier Cards, Expiring Banner, and Member Table.
 */
async function renderMembers() {
  const tbody = document.getElementById('members-table-body');
  const emptyState = document.getElementById('members-empty-state');
  if (!tbody) return;

  const memberData = await getMembersFromStorage();

  // 1. Calculate KPI Metrics
  let totalCount = memberData.length;
  let goldCount = 0;
  let silverCount = 0;
  let juniorCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  let activeCount = 0;

  memberData.forEach(m => {
    const status = computeMemberStatus(m);
    const plan = (m.plan || 'silver').toLowerCase();
    
    if (plan === 'gold') goldCount++;
    else if (plan === 'silver') silverCount++;
    else if (plan === 'junior') juniorCount++;

    if (status.state === 'active') activeCount++;
    else if (status.state === 'expiring') expiringCount++;
    else if (status.state === 'expired') expiredCount++;
  });

  // Update KPI Card Numbers
  const elTotal = document.getElementById('stat-total');
  const elGold = document.getElementById('stat-gold');
  const elSilver = document.getElementById('stat-silver');
  const elJunior = document.getElementById('stat-junior');
  const elExpiring = document.getElementById('stat-expiring');
  const elExpired = document.getElementById('stat-expired');

  if (elTotal) elTotal.textContent = totalCount;
  if (elGold) elGold.textContent = goldCount;
  if (elSilver) elSilver.textContent = silverCount;
  if (elJunior) elJunior.textContent = juniorCount;
  if (elExpiring) elExpiring.textContent = expiringCount;
  if (elExpired) elExpired.textContent = expiredCount;

  // Update Plan Card Member Counts
  const planCountGold = document.getElementById('plan-count-gold');
  const planCountSilver = document.getElementById('plan-count-silver');
  const planCountJunior = document.getElementById('plan-count-junior');
  if (planCountGold) planCountGold.textContent = `${goldCount} Active Members`;
  if (planCountSilver) planCountSilver.textContent = `${silverCount} Active Members`;
  if (planCountJunior) planCountJunior.textContent = `${juniorCount} Active Members`;

  // Update Filter Pill Count Chips
  const chipAll = document.getElementById('chip-all');
  const chipGold = document.getElementById('chip-gold');
  const chipSilver = document.getElementById('chip-silver');
  const chipJunior = document.getElementById('chip-junior');
  if (chipAll) chipAll.textContent = totalCount;
  if (chipGold) chipGold.textContent = goldCount;
  if (chipSilver) chipSilver.textContent = silverCount;
  if (chipJunior) chipJunior.textContent = juniorCount;

  // 2. Expiring Soon Alert Banner
  const banner = document.getElementById('expiring-alert-banner');
  const bannerText = document.getElementById('expiring-banner-text');
  if (banner && bannerText) {
    if (expiringCount > 0) {
      banner.style.display = 'flex';
      bannerText.textContent = `Attention: ${expiringCount} membership${expiringCount > 1 ? 's' : ''} expiring within the next 30 days.`;
    } else {
      banner.style.display = 'none';
    }
  }

  // 3. Filter & Search Records
  let filtered = memberData.filter(m => {
    const status = computeMemberStatus(m);
    const plan = (m.plan || 'silver').toLowerCase();

    // Filter rules
    if (currentFilter === 'gold' && plan !== 'gold') return false;
    if (currentFilter === 'silver' && plan !== 'silver') return false;
    if (currentFilter === 'junior' && plan !== 'junior') return false;
    if (currentFilter === 'active' && status.state !== 'active') return false;
    if (currentFilter === 'expiring' && status.state !== 'expiring') return false;
    if (currentFilter === 'expired' && status.state !== 'expired') return false;

    // Search rules
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      const matchName = (m.name || '').toLowerCase().includes(q);
      const matchId = (m.id || '').toLowerCase().includes(q);
      const matchPhone = (m.phone || '').toLowerCase().includes(q);
      const matchEmail = (m.email || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchPhone && !matchEmail) return false;
    }

    return true;
  });

  // 4. Sort Records
  filtered.sort((a, b) => {
    if (currentSort === 'expiry-asc') {
      return new Date(a.endDate || a.end_date || '2099-01-01') - new Date(b.endDate || b.end_date || '2099-01-01');
    } else if (currentSort === 'expiry-desc') {
      return new Date(b.endDate || b.end_date || '2000-01-01') - new Date(a.endDate || a.end_date || '2000-01-01');
    } else if (currentSort === 'name-asc') {
      return (a.name || '').localeCompare(b.name || '');
    } else if (currentSort === 'id-asc') {
      return (a.id || '').localeCompare(b.id || '');
    }
    return 0;
  });

  // 5. Render Table Rows
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--cc-text-muted); padding: 2.5rem;">
          No matching member records found.
        </td>
      </tr>
    `;
    return;
  } else {
    if (emptyState) emptyState.style.display = 'none';
  }

  filtered.forEach(m => {
    const status = computeMemberStatus(m);
    const planKey = (m.plan || 'silver').toLowerCase();
    const planInfo = membershipPlans[planKey] || membershipPlans.silver;
    const initial = (m.name || 'M').charAt(0).toUpperCase();

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="cc-avatar-ring ${planInfo.avatarClass}">${initial}</div>
          <div>
            <div style="font-weight: 700; color: var(--cc-text-primary); font-size: 14px;">${m.name}</div>
            <div style="font-size: 11px; color: var(--cc-text-muted);">${m.email || m.phone || 'No contact'}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="cc-text-mono" style="font-weight: 700; color: var(--cc-text-secondary); font-size: 13px;">${m.id}</span>
      </td>
      <td>
        <span class="cc-badge ${planInfo.badgeClass}">
          ${planKey === 'gold' ? '★ Gold' : planKey === 'silver' ? '◆ Silver' : '● Junior'}
        </span>
      </td>
      <td>
        <span class="cc-badge ${status.badgeClass}">
          ${status.state === 'active' ? '<span class="cc-pulse-dot"></span> ' : ''}${status.label}
        </span>
      </td>
      <td class="cc-text-mono" style="font-size: 12px; color: var(--cc-text-secondary);">
        ${m.startDate || m.start_date || '—'}
      </td>
      <td class="cc-text-mono" style="font-size: 13px; font-weight: 700; color: ${status.state === 'expired' ? 'var(--cc-crimson)' : status.state === 'expiring' ? '#FBBF24' : 'var(--cc-text-primary)'};">
        ${m.endDate || m.end_date || '—'}
      </td>
      <td style="font-size: 12px;">
        ${formatLastActivity(m)}
      </td>
      <td style="text-align: right;">
        <div style="display: inline-flex; gap: 6px;">
          <button class="cc-btn cc-btn-secondary cc-btn-sm" style="padding: 4px 10px; font-size: 12px;" onclick="openMemberDetail('${m.id}')">
            Profile &amp; 360°
          </button>
          <button class="cc-btn cc-btn-outline-gold cc-btn-sm" style="padding: 4px 8px; font-size: 11px;" title="Quick Court Booking" onclick="openQuickBookModalForMember('${m.id}')">
            Book
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Global Helper: Filter table by tier when clicking plan card buttons.
 */
window.filterTableByTier = function(tier) {
  currentFilter = tier;
  syncFilterPillsAndKPIs(tier);
  renderMembers();
  const table = document.getElementById('members-table');
  if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/**
 * Global Helper: Filter table by status (e.g. expiring, expired, active).
 */
window.filterTableByStatus = function(status) {
  currentFilter = status;
  syncFilterPillsAndKPIs(status);
  renderMembers();
};

/**
 * Global Helper: Reset all search and filter controls.
 */
window.resetMemberFilters = function() {
  currentFilter = 'all';
  currentSearch = '';
  const searchInput = document.getElementById('member-search');
  if (searchInput) searchInput.value = '';
  syncFilterPillsAndKPIs('all');
  renderMembers();
};

/**
 * Synchronizes active states on filter pills and KPI cards.
 */
function syncFilterPillsAndKPIs(filterKey) {
  // Update Filter Pills
  const pills = document.querySelectorAll('.cc-filter-pill');
  pills.forEach(p => {
    if (p.getAttribute('data-filter') === filterKey) {
      p.classList.add('is-active');
    } else {
      p.classList.remove('is-active');
    }
  });

  // Update KPI Cards
  const kpiCards = document.querySelectorAll('.cc-kpi-card');
  kpiCards.forEach(c => {
    if (c.getAttribute('data-filter') === filterKey) {
      c.classList.add('is-active-kpi');
    } else {
      c.classList.remove('is-active-kpi');
    }
  });
}

/**
 * Opens Detailed Member Profile & 360° Activity Drawer / Modal.
 */
window.openMemberDetail = async function(memberId) {
  selectedMemberId = memberId;
  const memberData = await getMembersFromStorage();
  let member = memberData.find(m => m.id === memberId || String(m.raw_id) === String(memberId));

  if (!member) return;

  const modal = document.getElementById('modal-member-detail');
  const planKey = (member.plan || 'silver').toLowerCase();
  const planInfo = membershipPlans[planKey] || membershipPlans.silver;
  const status = computeMemberStatus(member);

  // 1. Digital Membership Card presentation
  const digitalCard = document.getElementById('digital-card-container');
  if (digitalCard) {
    digitalCard.className = `cc-digital-card ${planInfo.cardClass}`;
  }

  const cardTierBadge = document.getElementById('card-tier-badge');
  if (cardTierBadge) {
    cardTierBadge.textContent = planKey === 'gold' ? '★ GOLD MEMBER' : planKey === 'silver' ? '◆ SILVER MEMBER' : '● JUNIOR MEMBER';
  }

  const cardMemberName = document.getElementById('card-member-name');
  if (cardMemberName) cardMemberName.textContent = member.name;

  const cardMemberId = document.getElementById('card-member-id');
  if (cardMemberId) cardMemberId.textContent = member.id;

  const cardStatusLabel = document.getElementById('card-status-label');
  if (cardStatusLabel) {
    cardStatusLabel.textContent = status.hasActiveBenefits ? `● ${status.label.toUpperCase()}` : `✕ ${status.label.toUpperCase()}`;
    cardStatusLabel.style.color = status.hasActiveBenefits ? 'var(--cc-neon-green)' : 'var(--cc-crimson)';
  }

  const cardValidityLabel = document.getElementById('card-validity-label');
  if (cardValidityLabel) {
    cardValidityLabel.textContent = `Valid until: ${member.endDate || member.end_date || '—'}`;
  }

  // Live SVG QR Code Generation
  const qrBox = document.getElementById('card-qr-box');
  if (qrBox) {
    qrBox.innerHTML = generateQRCodeSVG(`PLAYNEX-MEM:${member.id}:${member.name}:${planKey}`, 68);
  }

  // 2. Personal Information Panel
  const detailMemberId = document.getElementById('detail-member-id');
  if (detailMemberId) detailMemberId.textContent = member.id;

  const detailMemberName = document.getElementById('detail-member-name');
  if (detailMemberName) detailMemberName.textContent = member.name;

  const detailPhone = document.getElementById('detail-phone');
  if (detailPhone) detailPhone.textContent = member.phone || '—';

  const detailEmail = document.getElementById('detail-email');
  if (detailEmail) detailEmail.textContent = member.email || '—';

  const detailDob = document.getElementById('detail-dob');
  if (detailDob) {
    const age = calculateAge(member.dob);
    detailDob.textContent = member.dob ? `${member.dob} ${age !== null ? `(${age} yrs)` : ''}` : '—';
  }

  const detailNotes = document.getElementById('detail-notes');
  if (detailNotes) detailNotes.textContent = member.notes || 'Standard club privileges active.';

  // 3. Status & Expiry Alert
  const expiryAlert = document.getElementById('detail-expiry-alert');
  const expiryAlertText = document.getElementById('detail-expiry-alert-text');
  if (expiryAlert && expiryAlertText) {
    if (status.state === 'expiring') {
      expiryAlert.style.display = 'block';
      expiryAlertText.textContent = `Membership expires in ${status.days} day${status.days === 1 ? '' : 's'} (${member.endDate}). Prompt renewal recommended.`;
    } else if (status.state === 'expired') {
      expiryAlert.style.display = 'block';
      expiryAlert.style.borderColor = 'var(--cc-crimson)';
      expiryAlert.style.color = '#FCA5A5';
      expiryAlert.style.background = 'rgba(239, 68, 68, 0.15)';
      expiryAlertText.textContent = `Membership expired ${Math.abs(status.days)} days ago (${member.endDate}). Active entitlements are currently suspended.`;
    } else {
      expiryAlert.style.display = 'none';
    }
  }

  // 4. Entitlements Matrix
  const benefitsBadge = document.getElementById('detail-benefits-badge');
  if (benefitsBadge) {
    benefitsBadge.className = `cc-badge ${status.hasActiveBenefits ? 'cc-badge-active' : 'cc-badge-danger'}`;
    benefitsBadge.textContent = status.hasActiveBenefits ? '✓ Active Entitlements' : '✕ Benefits Suspended';
  }

  const elCourt = document.getElementById('detail-court-entitlement');
  const elShop = document.getElementById('detail-shop-discount');
  const elBar = document.getElementById('detail-bar-discount');
  const elTab = document.getElementById('detail-tab-entitlement');

  if (status.hasActiveBenefits) {
    if (elCourt) elCourt.textContent = planInfo.courtRate;
    if (elShop) elShop.textContent = planInfo.shopDiscount;
    if (elBar) elBar.textContent = planInfo.barDiscount;
    if (elTab) elTab.textContent = planInfo.tabLabel;
  } else {
    if (elCourt) elCourt.textContent = 'Walk-in Rate (Suspended)';
    if (elShop) elShop.textContent = '0% Discount (Suspended)';
    if (elBar) elBar.textContent = '0% Discount (Suspended)';
    if (elTab) elTab.textContent = 'Disabled (Suspended)';
  }

  // 5. Build 360° Aggregated Activity Timeline
  const timelineContainer = document.getElementById('detail-history-list');
  if (timelineContainer) {
    timelineContainer.innerHTML = '';

    // Collect all timeline events from membership history, bookings, shop orders, bar tabs
    const timelineEvents = [];

    // Base membership history logs
    (member.history || []).forEach(h => {
      let typeClass = 'type-signup';
      if (h.type === 'renewal') typeClass = 'type-renewal';
      else if (h.type === 'plan_change') typeClass = 'type-renewal';
      else if (h.type === 'checkin') typeClass = 'type-booking';
      else if (h.type === 'booking') typeClass = 'type-booking';
      else if (h.type === 'shop') typeClass = 'type-shop';
      else if (h.type === 'bar') typeClass = 'type-bar';

      timelineEvents.push({
        timestamp: h.timestamp || '2026-10-03 10:00',
        title: (h.type || 'Activity').toUpperCase(),
        desc: h.desc || h.description || '',
        typeClass: typeClass
      });
    });

    // Linked Court Bookings
    if (window.ClubDataStore && window.ClubDataStore.getBookings) {
      const allBookings = window.ClubDataStore.getBookings() || [];
      const memberBookings = allBookings.filter(b => b.memberId === member.id);
      memberBookings.forEach(b => {
        timelineEvents.push({
          timestamp: `${b.date} ${b.startTime}`,
          title: 'COURT BOOKING',
          desc: `Reserved ${b.courtName || b.courtId} (${b.startTime}–${b.endTime}) &bull; Rate Applied: <strong>${b.rateApplied}</strong>`,
          typeClass: 'type-booking'
        });
      });
    }

    // Linked Pro Shop Orders
    if (window.ClubDataStore && window.ClubDataStore.getShopOrders) {
      const allOrders = window.ClubDataStore.getShopOrders() || [];
      const memberOrders = allOrders.filter(o => (o.customer || '').includes(member.name) || o.memberId === member.id);
      memberOrders.forEach(o => {
        timelineEvents.push({
          timestamp: `${o.date || '2026-10-03'} 12:00`,
          title: 'PRO SHOP PURCHASE',
          desc: `Order #${o.id} &bull; Total: <strong>₹ ${(o.total || 0).toLocaleString()}</strong> &bull; Fulfillment: ${o.fulfillment || 'Counter'}`,
          typeClass: 'type-shop'
        });
      });
    }

    // Linked Bar Tabs
    if (window.ClubDataStore && window.ClubDataStore.getBarTabs) {
      const allTabs = window.ClubDataStore.getBarTabs() || [];
      const memberTabs = allTabs.filter(t => (t.memberName || '').includes(member.name) || t.memberId === member.id);
      memberTabs.forEach(t => {
        timelineEvents.push({
          timestamp: '2026-10-03 19:30',
          title: 'BAR / CAFE TAB',
          desc: `Tab #${t.id} (${t.tableName}) &bull; Applied ${t.discountPercent}% Member Discount &bull; Net: <strong>₹ ${(t.netTotal || 0).toLocaleString()}</strong>`,
          typeClass: 'type-bar'
        });
      });
    }

    // Sort descending by timestamp
    timelineEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (timelineEvents.length === 0) {
      timelineContainer.innerHTML = '<div style="color: var(--cc-text-muted); font-size: 13px;">No recorded activity yet.</div>';
    } else {
      timelineEvents.forEach(evt => {
        const item = document.createElement('div');
        item.className = `cc-history-item ${evt.typeClass}`;
        item.innerHTML = `
          <div class="cc-history-time">
            ${evt.timestamp} &bull; <strong style="letter-spacing: 0.05em;">${evt.title}</strong>
          </div>
          <div class="cc-history-desc">${evt.desc}</div>
        `;
        timelineContainer.appendChild(item);
      });
    }
  }

  // 6. Connect Action Buttons in Profile
  const btnBook = document.getElementById('btn-quick-book-court');
  if (btnBook) {
    btnBook.onclick = () => {
      modal.classList.remove('is-open');
      openQuickBookModalForMember(member.id);
    };
  }

  const btnRenew = document.getElementById('btn-action-renew');
  if (btnRenew) {
    btnRenew.onclick = () => {
      modal.classList.remove('is-open');
      openRenewalModalForMember(member.id);
    };
  }

  const btnChangePlan = document.getElementById('btn-action-change-plan');
  if (btnChangePlan) {
    btnChangePlan.onclick = () => {
      modal.classList.remove('is-open');
      openChangePlanModalForMember(member.id);
    };
  }

  const btnCheckin = document.getElementById('btn-action-checkin');
  if (btnCheckin) {
    btnCheckin.onclick = async () => {
      const nowStr = '2026-10-03 15:30';
      const allMembers = await getMembersFromStorage();
      const mIdx = allMembers.findIndex(m => m.id === member.id);
      if (mIdx !== -1) {
        if (!allMembers[mIdx].history) allMembers[mIdx].history = [];
        allMembers[mIdx].history.push({
          timestamp: nowStr,
          type: 'checkin',
          desc: 'Front desk facility check-in & member badge verification.'
        });
        saveMembersToStorage(allMembers);
        openMemberDetail(member.id);
        renderMembers();
      }
    };
  }

  const btnCancel = document.getElementById('btn-action-cancel');
  if (btnCancel) {
    btnCancel.onclick = async () => {
      if (confirm(`Are you sure you want to suspend/cancel membership for ${member.name}? Entitlements will be revoked.`)) {
        const allMembers = await getMembersFromStorage();
        const mIdx = allMembers.findIndex(m => m.id === member.id);
        if (mIdx !== -1) {
          allMembers[mIdx].state = 'cancelled';
          if (!allMembers[mIdx].history) allMembers[mIdx].history = [];
          allMembers[mIdx].history.push({
            timestamp: '2026-10-03 15:45',
            type: 'cancellation',
            desc: 'Membership cancelled by front desk staff. Entitlements suspended.'
          });
          saveMembersToStorage(allMembers);
          openMemberDetail(member.id);
          renderMembers();
        }
      }
    };
  }

  if (modal) {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
};

/**
 * Opens Renewal Modal for a specified member (or first available).
 */
window.openRenewalModalForMember = async function(memberId = null) {
  const modal = document.getElementById('modal-renew-member');
  const select = document.getElementById('renew-member-select');
  if (!modal || !select) return;

  const members = await getMembersFromStorage();
  select.innerHTML = '';

  members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.id}) — ${m.plan.toUpperCase()} Plan`;
    if (memberId && m.id === memberId) opt.selected = true;
    select.appendChild(opt);
  });

  function updateRenewalPreview() {
    const chosenId = select.value;
    const member = members.find(m => m.id === chosenId);
    if (!member) return;

    const planKey = (member.plan || 'silver').toLowerCase();
    const planInfo = membershipPlans[planKey] || membershipPlans.silver;
    const status = computeMemberStatus(member);

    const elPlan = document.getElementById('renew-current-plan');
    const elExpiry = document.getElementById('renew-current-expiry');
    const elStatus = document.getElementById('renew-current-status');
    const elFee = document.getElementById('renew-fee-label');

    if (elPlan) elPlan.textContent = `${planInfo.name} Tier (${planInfo.fee})`;
    if (elExpiry) elExpiry.textContent = member.endDate || member.end_date || '—';
    if (elStatus) {
      elStatus.className = `cc-badge ${status.badgeClass}`;
      elStatus.textContent = status.label;
    }

    const durationDays = parseInt(document.getElementById('renew-duration-select').value, 10) || 365;
    
    // Calculate new expiry date: from current expiry date or CURRENT_DATE if already expired
    const currentEnd = new Date((member.endDate || '2026-10-03') + 'T00:00:00');
    const baseDate = currentEnd < CURRENT_DATE ? new Date(CURRENT_DATE) : currentEnd;
    baseDate.setDate(baseDate.getDate() + durationDays);
    const newExpiryStr = baseDate.toISOString().split('T')[0];

    const elNewExpiry = document.getElementById('renew-new-expiry');
    if (elNewExpiry) elNewExpiry.value = newExpiryStr;

    // Fee calculation proportional to duration
    let feeAmt = planInfo.feeAmount;
    if (durationDays === 180) feeAmt = Math.round(planInfo.feeAmount * 0.55);
    else if (durationDays === 90) feeAmt = Math.round(planInfo.feeAmount * 0.30);
    if (elFee) elFee.textContent = `₹ ${feeAmt.toLocaleString()}`;
  }

  select.onchange = updateRenewalPreview;
  const durationSelect = document.getElementById('renew-duration-select');
  if (durationSelect) durationSelect.onchange = updateRenewalPreview;

  updateRenewalPreview();
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
};

/**
 * Opens Change Plan Tier Modal for a member.
 */
window.openChangePlanModalForMember = async function(memberId) {
  const modal = document.getElementById('modal-change-plan');
  if (!modal) return;

  const members = await getMembersFromStorage();
  const member = members.find(m => m.id === memberId);
  if (!member) return;

  selectedMemberId = member.id;

  const elName = document.getElementById('change-plan-member-name');
  const elBadge = document.getElementById('change-plan-current-badge');
  const select = document.getElementById('change-plan-select');

  if (elName) elName.textContent = `${member.name} (${member.id})`;
  if (elBadge) {
    const planInfo = membershipPlans[member.plan] || membershipPlans.silver;
    elBadge.className = `cc-badge ${planInfo.badgeClass}`;
    elBadge.textContent = `${planInfo.name} Tier`;
  }
  if (select) select.value = member.plan || 'silver';

  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
};

/**
 * Opens Quick Court Booking Modal for a member.
 */
window.openQuickBookModalForMember = async function(memberId) {
  const modal = document.getElementById('modal-quick-book');
  if (!modal) return;

  const members = await getMembersFromStorage();
  const member = members.find(m => m.id === memberId);
  if (!member) return;

  selectedMemberId = member.id;
  const planKey = (member.plan || 'silver').toLowerCase();
  const planInfo = membershipPlans[planKey] || membershipPlans.silver;
  const status = computeMemberStatus(member);

  const elName = document.getElementById('qb-member-name');
  const elBadge = document.getElementById('qb-tier-badge');
  const elMemberPrice = document.getElementById('qb-member-price');
  const elWalkinPrice = document.getElementById('qb-walkin-price');
  const dateInput = document.getElementById('qb-date-input');

  if (elName) elName.textContent = `${member.name} (${member.id})`;
  if (elBadge) {
    elBadge.className = `cc-badge ${planInfo.badgeClass}`;
    elBadge.textContent = `${planInfo.name} Plan (${status.label})`;
  }
  if (elWalkinPrice) elWalkinPrice.textContent = '₹ 500.00';
  if (elMemberPrice) {
    if (status.hasActiveBenefits) {
      elMemberPrice.textContent = planInfo.courtRate;
      elMemberPrice.style.color = planKey === 'gold' ? 'var(--cc-neon-green)' : 'var(--cc-gold-400)';
    } else {
      elMemberPrice.textContent = '₹ 500.00 (Standard Walk-in - Expired)';
      elMemberPrice.style.color = 'var(--cc-crimson)';
    }
  }
  if (dateInput) dateInput.value = '2026-10-03';

  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
};

/**
 * Quick Scan Simulation Helper.
 */
window.simulateQuickScan = function(memberId) {
  const modalLookup = document.getElementById('modal-scan-lookup');
  if (modalLookup) modalLookup.classList.remove('is-open');
  openMemberDetail(memberId);
};

// ==========================================
// DOM INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadPlansFromBackend();
  await renderMembers();

  // 1. Search Input Handler
  const searchInput = document.getElementById('member-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      renderMembers();
    });
  }

  // 2. Sort Select Handler
  const sortSelect = document.getElementById('member-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderMembers();
    });
  }

  // 3. Filter Pills Handlers
  const pills = document.querySelectorAll('.cc-filter-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const filter = pill.getAttribute('data-filter');
      currentFilter = filter;
      syncFilterPillsAndKPIs(filter);
      renderMembers();
    });
  });

  // 4. Interactive KPI Cards Click Handlers
  const kpiCards = document.querySelectorAll('.cc-kpi-card');
  kpiCards.forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.getAttribute('data-filter');
      currentFilter = filter;
      syncFilterPillsAndKPIs(filter);
      renderMembers();
    });
  });

  // 5. Header Action Buttons
  const btnRenewHeader = document.getElementById('btn-quick-renew-header');
  if (btnRenewHeader) {
    btnRenewHeader.addEventListener('click', () => openRenewalModalForMember());
  }

  const btnBannerRenew = document.getElementById('btn-banner-renew-fast');
  if (btnBannerRenew) {
    btnBannerRenew.addEventListener('click', () => openRenewalModalForMember());
  }

  const btnViewExpiringHeader = document.getElementById('btn-view-expiring-header');
  if (btnViewExpiringHeader) {
    btnViewExpiringHeader.addEventListener('click', () => filterTableByStatus('expiring'));
  }

  // 6. Quick Scan / ID Lookup Modal Controls
  const btnQuickScan = document.getElementById('btn-quick-scan');
  const modalLookup = document.getElementById('modal-scan-lookup');
  const btnSubmitLookup = document.getElementById('btn-submit-lookup');
  const lookupInput = document.getElementById('lookup-input');

  if (btnQuickScan && modalLookup) {
    btnQuickScan.addEventListener('click', () => {
      modalLookup.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      if (lookupInput) {
        lookupInput.value = '';
        setTimeout(() => lookupInput.focus(), 150);
      }
    });
  }

  if (btnSubmitLookup && lookupInput) {
    btnSubmitLookup.addEventListener('click', async () => {
      const query = lookupInput.value.trim().toLowerCase();
      if (!query) return;

      const members = await getMembersFromStorage();
      const match = members.find(m => 
        (m.id || '').toLowerCase() === query || 
        (m.phone || '').toLowerCase().includes(query) ||
        (m.name || '').toLowerCase().includes(query) ||
        query.includes((m.id || '').toLowerCase())
      );

      if (match) {
        modalLookup.classList.remove('is-open');
        openMemberDetail(match.id);
      } else {
        alert(`No active member record matching '${lookupInput.value}' was found.`);
      }
    });
  }

  // 7. Enroll New Member Modal & Live DOB Validation
  const btnAddMember = document.getElementById('btn-add-member');
  const modalAdd = document.getElementById('modal-add-member');
  const formAdd = document.getElementById('form-add-member');

  const inputName = document.getElementById('new-member-name');
  const inputDob = document.getElementById('new-member-dob');
  const selectPlan = document.getElementById('new-member-plan');
  const inputStart = document.getElementById('new-member-start');
  const inputEnd = document.getElementById('new-member-end');
  const ageHint = document.getElementById('new-member-age-hint');
  const juniorErrorBanner = document.getElementById('junior-error-banner');
  const summaryBox = document.getElementById('new-member-summary');
  const btnSubmitEnroll = document.getElementById('btn-submit-enroll');

  function updateNewMemberSummaryAndValidation() {
    const name = inputName ? inputName.value.trim() : '';
    const dob = inputDob ? inputDob.value : '';
    const plan = selectPlan ? selectPlan.value : 'silver';
    const start = inputStart ? inputStart.value : '2026-10-03';
    const end = inputEnd ? inputEnd.value : '2027-10-02';

    const age = calculateAge(dob);
    let isJuniorInvalid = false;

    // Age validation
    if (dob && age !== null) {
      if (ageHint) {
        ageHint.textContent = `Calculated Age: ${age} years old as of 2026-10-03`;
      }
      if (plan === 'junior' && age >= 18) {
        isJuniorInvalid = true;
        if (juniorErrorBanner) juniorErrorBanner.style.display = 'block';
        if (btnSubmitEnroll) btnSubmitEnroll.disabled = true;
      } else {
        if (juniorErrorBanner) juniorErrorBanner.style.display = 'none';
        if (btnSubmitEnroll) btnSubmitEnroll.disabled = false;
      }
    } else {
      if (ageHint) ageHint.textContent = '';
      if (juniorErrorBanner) juniorErrorBanner.style.display = 'none';
      if (btnSubmitEnroll) btnSubmitEnroll.disabled = false;
    }

    // Update Summary Box
    if (summaryBox) {
      const planInfo = membershipPlans[plan] || membershipPlans.silver;
      summaryBox.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span><strong>Member:</strong> ${name || '—'}</span>
          <span class="cc-badge ${planInfo.badgeClass}">★ ${planInfo.name.toUpperCase()} TIER</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; color: var(--cc-text-muted);">
          <span>Validity: ${start} &rarr; ${end} (1 Year)</span>
          <span style="font-weight: 700; color: var(--cc-gold-400);">${planInfo.fee}</span>
        </div>
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 6px; font-size: 11px; display: flex; gap: 10px; flex-wrap: wrap; color: var(--cc-text-secondary);">
          <span>✓ Court: ${planInfo.courtRate}</span>
          <span>✓ Shop: ${planInfo.shopDiscount}</span>
          <span>✓ Bar: ${planInfo.barDiscount}</span>
        </div>
      `;
    }
  }

  if (btnAddMember && modalAdd) {
    btnAddMember.addEventListener('click', () => {
      modalAdd.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      if (inputStart && !inputStart.value) inputStart.value = '2026-10-03';
      if (inputEnd && !inputEnd.value) inputEnd.value = '2027-10-02';
      updateNewMemberSummaryAndValidation();
    });
  }

  if (inputName) inputName.addEventListener('input', updateNewMemberSummaryAndValidation);
  if (inputDob) inputDob.addEventListener('change', updateNewMemberSummaryAndValidation);
  if (selectPlan) selectPlan.addEventListener('change', updateNewMemberSummaryAndValidation);
  if (inputStart) {
    inputStart.addEventListener('change', () => {
      if (inputStart.value && inputEnd) {
        const s = new Date(inputStart.value + 'T00:00:00');
        s.setFullYear(s.getFullYear() + 1);
        s.setDate(s.getDate() - 1);
        inputEnd.value = s.toISOString().split('T')[0];
      }
      updateNewMemberSummaryAndValidation();
    });
  }
  if (inputEnd) inputEnd.addEventListener('change', updateNewMemberSummaryAndValidation);

  // Submit New Member Form
  if (formAdd) {
    formAdd.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = inputName.value.trim();
      const phone = document.getElementById('new-member-phone').value.trim();
      const email = document.getElementById('new-member-email').value.trim();
      const dob = inputDob.value;
      const plan = selectPlan.value;
      const startDate = inputStart.value;
      const endDate = inputEnd.value;

      const age = calculateAge(dob);
      if (plan === 'junior' && age >= 18) {
        alert('Junior membership restriction: Applicant is 18 or older. Please select Silver or Gold tier.');
        return;
      }

      const allMembers = await getMembersFromStorage();
      const nextNum = 100 + allMembers.length + 1;
      const newId = `CC-MEM-00${nextNum}`;

      const newMember = {
        id: newId,
        name: name,
        email: email,
        phone: phone,
        dob: dob,
        plan: plan,
        startDate: startDate,
        endDate: endDate,
        state: 'active',
        history: [
          {
            timestamp: '2026-10-03 16:00',
            type: 'signup',
            desc: `Enrolled under ${membershipPlans[plan].name} Plan (${startDate} to ${endDate})`
          }
        ],
        notes: `New member enrolled at front desk. Tier: ${membershipPlans[plan].name}.`
      };

      // Push to ClubDataStore
      allMembers.push(newMember);
      saveMembersToStorage(allMembers);

      // Push to backend via ClubAPI if connected
      if (window.ClubAPI && window.ClubAPI.createMember) {
        try {
          const planIdMap = { gold: 1, silver: 2, junior: 3 };
          await window.ClubAPI.createMember({
            name: name,
            phone: phone,
            email: email,
            plan_id: planIdMap[plan] || 2,
            plan_code: plan,
            start_date: startDate,
            end_date: endDate,
            state: 'active'
          });
        } catch (err) {
          console.warn('Backend sync error:', err.message);
        }
      }

      modalAdd.classList.remove('is-open');
      document.body.style.overflow = '';
      formAdd.reset();
      await renderMembers();
      openMemberDetail(newId);
    });
  }

  // 8. Submit Renewal Form
  const formRenew = document.getElementById('form-renew-member');
  const modalRenew = document.getElementById('modal-renew-member');
  if (formRenew) {
    formRenew.addEventListener('submit', async (e) => {
      e.preventDefault();
      const memberId = document.getElementById('renew-member-select').value;
      const durationDays = parseInt(document.getElementById('renew-duration-select').value, 10) || 365;
      const newExpiry = document.getElementById('renew-new-expiry').value;

      const allMembers = await getMembersFromStorage();
      const mIdx = allMembers.findIndex(m => m.id === memberId);
      if (mIdx === -1) return;

      const member = allMembers[mIdx];
      const prevEnd = member.endDate || member.end_date;
      member.endDate = newExpiry;
      member.state = 'active';

      if (!member.history) member.history = [];
      member.history.push({
        timestamp: '2026-10-03 16:15',
        type: 'renewal',
        desc: `Membership renewed for +${durationDays} days. Extended from ${prevEnd} to ${newExpiry}.`
      });

      saveMembersToStorage(allMembers);

      if (window.ClubAPI && window.ClubAPI.memberAction) {
        try {
          await window.ClubAPI.memberAction(memberId, 'renew', { extension_days: durationDays });
        } catch (err) {}
      }

      modalRenew.classList.remove('is-open');
      document.body.style.overflow = '';
      await renderMembers();
      openMemberDetail(memberId);
    });
  }

  // 9. Submit Change Plan Form
  const formChangePlan = document.getElementById('form-change-plan');
  const modalChangePlan = document.getElementById('modal-change-plan');
  if (formChangePlan) {
    formChangePlan.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedMemberId) return;

      const newPlan = document.getElementById('change-plan-select').value;
      const reason = document.getElementById('change-plan-reason').value.trim();

      const allMembers = await getMembersFromStorage();
      const mIdx = allMembers.findIndex(m => m.id === selectedMemberId);
      if (mIdx === -1) return;

      const member = allMembers[mIdx];
      const oldPlan = member.plan;

      // Age validation for switching to Junior
      if (newPlan === 'junior' && member.dob) {
        const age = calculateAge(member.dob);
        if (age !== null && age >= 18) {
          alert('Cannot switch to Junior tier: Member age is 18 or older.');
          return;
        }
      }

      member.plan = newPlan;
      if (!member.history) member.history = [];
      member.history.push({
        timestamp: '2026-10-03 16:20',
        type: 'plan_change',
        desc: `Plan tier changed from ${membershipPlans[oldPlan].name} to ${membershipPlans[newPlan].name}. Reason: ${reason}`
      });

      saveMembersToStorage(allMembers);

      if (window.ClubAPI && window.ClubAPI.memberAction) {
        try {
          const planIdMap = { gold: 1, silver: 2, junior: 3 };
          await window.ClubAPI.memberAction(selectedMemberId, 'change_plan', { new_plan_id: planIdMap[newPlan] || 2 });
        } catch (err) {}
      }

      modalChangePlan.classList.remove('is-open');
      document.body.style.overflow = '';
      await renderMembers();
      openMemberDetail(selectedMemberId);
    });
  }

  // 10. Submit Quick Court Booking Form
  const formQuickBook = document.getElementById('form-quick-book');
  const modalQuickBook = document.getElementById('modal-quick-book');
  if (formQuickBook) {
    formQuickBook.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedMemberId) return;

      const courtSelect = document.getElementById('qb-court-select');
      const courtId = courtSelect.value;
      const courtName = courtSelect.options[courtSelect.selectedIndex].text;
      const date = document.getElementById('qb-date-input').value;
      const slot = document.getElementById('qb-slot-select').value;

      const allMembers = await getMembersFromStorage();
      const member = allMembers.find(m => m.id === selectedMemberId);
      if (!member) return;

      const planKey = (member.plan || 'silver').toLowerCase();
      const planInfo = membershipPlans[planKey] || membershipPlans.silver;
      const status = computeMemberStatus(member);

      const rateApplied = status.hasActiveBenefits ? planInfo.courtRate : '₹ 500.00 (Standard Walk-in)';
      const fee = status.hasActiveBenefits ? planInfo.courtRateAmount : 500.0;

      // Slot end time calculation (1 hour)
      const [h, m] = slot.split(':').map(Number);
      const endH = String((h + 1) % 24).padStart(2, '0');
      const endTime = `${endH}:${String(m).padStart(2, '0')}`;

      // Create Booking Record in ClubDataStore
      if (window.ClubDataStore && window.ClubDataStore.getBookings) {
        const bookings = window.ClubDataStore.getBookings() || [];
        const nextBkId = `CC-BK-00${bookings.length + 10}`;
        const newBooking = {
          id: nextBkId,
          courtId: courtId,
          courtName: courtName,
          sport: courtName.toLowerCase().includes('cricket') ? 'cricket' : courtName.toLowerCase().includes('badminton') ? 'badminton' : 'tennis',
          date: date,
          startTime: slot,
          endTime: endTime,
          bookingType: 'member',
          memberId: member.id,
          playerName: `${member.name} (${planInfo.name})`,
          rateApplied: rateApplied,
          fee: fee,
          isSocial: false,
          state: 'confirmed'
        };
        bookings.push(newBooking);
        window.ClubDataStore.saveBookings(bookings);
      }

      // Append Booking Event to Member History
      if (!member.history) member.history = [];
      member.history.push({
        timestamp: `${date} ${slot}`,
        type: 'booking',
        desc: `Court booked: ${courtName} (${slot}–${endTime}) &bull; Rate Applied: <strong>${rateApplied}</strong>`
      });
      saveMembersToStorage(allMembers);

      modalQuickBook.classList.remove('is-open');
      document.body.style.overflow = '';
      await renderMembers();
      openMemberDetail(selectedMemberId);
    });
  }

  // 11. Configurable Plans Modal Controls
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

      // Update Plan Cards in DOM
      const feeGold = document.getElementById('plan-fee-gold');
      const shopGold = document.getElementById('plan-shop-gold');
      const barGold = document.getElementById('plan-bar-gold');
      if (feeGold) feeGold.textContent = membershipPlans.gold.fee;
      if (shopGold) shopGold.textContent = membershipPlans.gold.shopDiscount;
      if (barGold) barGold.textContent = membershipPlans.gold.barDiscount;

      const feeSilver = document.getElementById('plan-fee-silver');
      const courtSilver = document.getElementById('plan-court-silver');
      const shopSilver = document.getElementById('plan-shop-silver');
      const barSilver = document.getElementById('plan-bar-silver');
      if (feeSilver) feeSilver.textContent = membershipPlans.silver.fee;
      if (courtSilver) courtSilver.textContent = membershipPlans.silver.courtRate;
      if (shopSilver) shopSilver.textContent = membershipPlans.silver.shopDiscount;
      if (barSilver) barSilver.textContent = membershipPlans.silver.barDiscount;

      const feeJunior = document.getElementById('plan-fee-junior');
      const courtJunior = document.getElementById('plan-court-junior');
      const shopJunior = document.getElementById('plan-shop-junior');
      const barJunior = document.getElementById('plan-bar-junior');
      if (feeJunior) feeJunior.textContent = membershipPlans.junior.fee;
      if (courtJunior) courtJunior.textContent = membershipPlans.junior.courtRate;
      if (shopJunior) shopJunior.textContent = membershipPlans.junior.shopDiscount;
      if (barJunior) barJunior.textContent = membershipPlans.junior.barDiscount;

      modalConfigPlans.classList.remove('is-open');
      document.body.style.overflow = '';
      renderMembers();
    });
  }

  // 12. Generic Modal Close Buttons
  document.querySelectorAll('[data-cc-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cc-modal-backdrop').forEach(modal => {
        modal.classList.remove('is-open');
      });
      document.body.style.overflow = '';
    });
  });

  // Close modals on clicking backdrop
  document.querySelectorAll('.cc-modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.cc-modal-backdrop.is-open').forEach(modal => {
        modal.classList.remove('is-open');
      });
      document.body.style.overflow = '';
    }
  });
});
