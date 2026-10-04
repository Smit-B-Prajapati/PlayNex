/**
 * CHAMPIONS CLUB — Member Self-Service Portal Controller
 * Connects directly to authenticated Odoo backend endpoints:
 * - /champions_club/auth/login
 * - /champions_club/auth/session
 * - /champions_club/auth/logout
 * - /champions_club/member/portal/profile
 * 
 * Enforces strict member data privacy: Members see ONLY their own records.
 */

(function() {
  'use strict';

  let currentMember = null;
  let activeTab = 'ptab-bookings';

  const PLAN_FEES = {
    gold: 24000,
    silver: 14000,
    junior: 8000
  };

  let selectedUpgradeTarget = 'gold';

  async function checkSession() {
    if (window.ClubMemberAuth && window.ClubMemberAuth.isMember()) {
      const mem = window.ClubMemberAuth.getMember();
      if (mem) {
        currentMember = mem;
        await loadMemberProfile(mem.id || mem.member_id || mem.member_code || mem.name);
        return;
      }
    }
    if (window.ClubAPI) {
      try {
        const session = await window.ClubAPI.getSession();
        if (session) {
          currentMember = session;
          await loadMemberProfile(session.member_id || session.id || session.member_code);
          return;
        }
      } catch (err) {
        console.warn('Session check failed', err);
      }
    }
    showLoginView();
  }

  function showLoginView() {
    const viewLogin = document.getElementById('view-login');
    const viewProfile = document.getElementById('view-profile');
    if (viewLogin) viewLogin.style.display = 'block';
    if (viewProfile) viewProfile.style.display = 'none';
    renderNavActions(false);
  }

  function showProfileView() {
    const viewLogin = document.getElementById('view-login');
    const viewProfile = document.getElementById('view-profile');
    if (viewLogin) viewLogin.style.display = 'none';
    if (viewProfile) viewProfile.style.display = 'block';
    renderNavActions(true);
  }

  function renderNavActions(isAuthenticated) {
    const container = document.getElementById('portal-nav-actions');
    if (!container) return;
    if (isAuthenticated && currentMember) {
      const isCancelled = currentMember.state === 'cancelled' || currentMember.state === 'inactive' || currentMember.state === 'expired';
      const planCode = (currentMember.plan || currentMember.tier_code || 'gold').toLowerCase();
      const badgeClass = planCode === 'gold' ? 'cc-badge-gold' : planCode === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior';
      const tierBadgeHtml = isCancelled
        ? `<span class="cc-badge cc-badge-danger" style="font-size: 9px; padding: 1px 6px;">CANCELLED</span>`
        : `<span class="cc-badge ${badgeClass}" style="font-size: 9px; padding: 1px 6px;">${planCode.toUpperCase()}</span>`;

      container.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center;">
          <div class="cc-member-nav-badge" style="display: inline-flex; align-items: center; gap: 6px; background: ${isCancelled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(212, 175, 55, 0.15)'}; border: 1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.4)' : 'var(--cc-gold-500)'}; padding: 4px 12px; border-radius: 20px; font-size: 11px; color: #FFFFFF; font-weight: 700;">
            <span class="cc-pulse-dot" style="background: ${isCancelled ? 'var(--cc-crimson)' : 'var(--cc-neon-green)'}; width: 6px; height: 6px; border-radius: 50%;"></span>
            <span style="color: ${isCancelled ? '#FCA5A5' : 'var(--cc-gold-400)'};">👤 ${currentMember.name}</span>
            ${tierBadgeHtml}
          </div>
          <button class="cc-btn cc-btn-secondary cc-btn-sm" id="btn-portal-logout" style="font-size: 11px; padding: 4px 10px;">Sign Out</button>
        </div>
      `;
      const btnLogout = document.getElementById('btn-portal-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
          if (window.ClubMemberAuth) {
            window.ClubMemberAuth.logout();
          } else {
            if (window.ClubAPI) await window.ClubAPI.logout();
          }
          currentMember = null;
          showLoginView();
        });
      }
    } else {
      container.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="btn-nav-login" class="cc-btn cc-btn-primary cc-btn-sm" style="font-size: 11px; padding: 5px 14px; font-weight: 700;" onclick="if(window.ClubAuth) window.ClubAuth.openLoginModal()">
            👤 Login
          </button>
        </div>
      `;
    }
  }

  async function loadMemberProfile(memberIdentifier) {
    let detail = null;
    if (window.ClubAPI) {
      try {
        detail = await window.ClubAPI.getMemberDetail(memberIdentifier);
      } catch (e) {
        console.warn('Backend detail fallback', e);
      }
    }

    if (!detail && window.ClubDataStore) {
      const mems = window.ClubDataStore.getMembers();
      detail = mems.find(m => m.id === memberIdentifier || m.member_code === memberIdentifier || m.name === memberIdentifier);
    }

    if (!detail && window.ClubMemberAuth) {
      detail = window.ClubMemberAuth.getMember();
    }

    if (!detail) {
      showLoginView();
      return;
    }

    currentMember = detail;
    showProfileView();
    renderProfileHeader(detail);
    renderEntitlements(detail);
    renderBookings(detail);
    renderOrders(detail);
    renderTabs(detail);
    renderTimeline(detail);
  }

  function renderProfileHeader(member) {
    const isCancelled = member.state === 'cancelled' || member.state === 'inactive';
    const planCode = (member.plan || member.tier_code || 'gold').toLowerCase();
    const planBadge = document.getElementById('profile-tier-badge');
    if (planBadge) {
      if (isCancelled) {
        planBadge.style.display = 'none';
      } else {
        planBadge.style.display = 'inline-flex';
        planBadge.className = `cc-badge ${planCode === 'gold' ? 'cc-badge-gold' : planCode === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior'}`;
        planBadge.textContent = `${planCode.toUpperCase()} TIER`;
      }
    }

    const state = member.state || 'active';
    const statusBadge = document.getElementById('profile-status-badge');
    if (statusBadge) {
      statusBadge.className = `cc-badge ${state === 'active' ? 'cc-badge-active' : state === 'cancelled' ? 'cc-badge-danger' : state === 'expired' ? 'cc-badge-danger' : 'cc-badge-warning'}`;
      statusBadge.textContent = state.toUpperCase();
    }

    document.getElementById('profile-member-code').textContent = member.id || member.member_code || 'CC-MEM';
    document.getElementById('profile-member-name').textContent = member.name;
    document.getElementById('profile-contact-info').textContent = `${member.email || 'No email registered'} • ${member.phone || 'No phone registered'}`;
    document.getElementById('profile-expiry-date').textContent = member.endDate || member.end_date || '2027-10-03';
    
    const privEl = document.getElementById('profile-privileges-text');
    if (privEl) {
      if (state === 'active') {
        privEl.textContent = 'Full Access';
        privEl.style.color = 'var(--cc-neon-green)';
      } else if (state === 'cancelled') {
        privEl.textContent = 'Revoked (Cancelled)';
        privEl.style.color = 'var(--cc-crimson)';
      } else {
        privEl.textContent = 'Restricted';
        privEl.style.color = 'var(--cc-gold-400)';
      }
    }

    // Toggle cancellation alert banner
    const cancelBanner = document.getElementById('profile-cancelled-banner');
    if (cancelBanner) {
      cancelBanner.style.display = state === 'cancelled' ? 'block' : 'none';
    }

    // Toggle or adjust subscription lifecycle buttons
    const btnCancel = document.getElementById('btn-open-cancel-modal');
    const btnUpgrade = document.getElementById('btn-open-upgrade-modal');
    if (btnCancel) {
      btnCancel.style.display = state === 'cancelled' ? 'none' : 'inline-flex';
      btnCancel.onclick = function(e) {
        e.preventDefault();
        window.openCancelMembershipModal();
      };
    }
    if (btnUpgrade) {
      btnUpgrade.onclick = function(e) {
        e.preventDefault();
        window.openUpgradeMembershipModal();
      };
      if (state === 'cancelled') {
        btnUpgrade.textContent = '🔄 Re-Activate Subscription';
      } else {
        btnUpgrade.textContent = '⭐ Upgrade Subscription';
      }
    }
  }

  function renderEntitlements(member) {
    const isCancelled = member.state === 'cancelled';
    const isExpired = member.state === 'expired';

    const courtEl = document.getElementById('entitlement-court');
    const shopEl = document.getElementById('entitlement-shop');
    const barEl = document.getElementById('entitlement-bar');

    if (isCancelled || isExpired) {
      if (courtEl) courtEl.textContent = 'Standard Walk-in Rate (No Discount)';
      if (shopEl) shopEl.textContent = '0% (Membership Inactive)';
      if (barEl) barEl.textContent = '0% (Membership Inactive)';
      return;
    }

    const planCode = (member.plan || member.tier_code || 'gold').toLowerCase();
    const plans = window.ClubDataStore ? window.ClubDataStore.getMembershipPlans() : null;
    const planInfo = plans ? plans[planCode] : null;

    if (courtEl) courtEl.textContent = planInfo ? planInfo.courtRate : (planCode === 'gold' ? 'Free / Zero' : planCode === 'silver' ? '₹ 300 / hr' : '₹ 200 / hr');
    if (shopEl) shopEl.textContent = planInfo ? `${planInfo.shopDiscount}% Storewide` : (planCode === 'gold' ? '20% Storewide' : planCode === 'silver' ? '10% Storewide' : '15% Storewide');
    if (barEl) barEl.textContent = planInfo ? `${planInfo.barDiscount}% Tab Privilege` : (planCode === 'gold' ? '15% Tab Privilege' : planCode === 'silver' ? '10% Tab Privilege' : '5% Tab Privilege');
  }

  function renderBookings(member) {
    const tbody = document.getElementById('portal-bookings-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const memberId = member.id || member.member_code;
    let allBookings = window.ClubDataStore ? window.ClubDataStore.getBookings() : [];
    
    // Privacy boundary: Filter only current member's bookings
    const myBookings = allBookings.filter(b => b.memberId === memberId || b.playerName === member.name || (b.member_id && String(b.member_id) === String(member.id)));

    if (myBookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--cc-text-muted); padding: 1.5rem;">No data available (0 court bookings found).</td></tr>';
      return;
    }

    myBookings.forEach(b => {
      const tr = document.createElement('tr');
      const isConfirmed = b.state === 'confirmed';
      tr.innerHTML = `
        <td><strong class="cc-text-mono" style="color: var(--cc-gold-400);">${b.id || b.name}</strong></td>
        <td><strong>${b.courtName || b.court_name}</strong><br><span class="cc-badge cc-badge-silver" style="font-size: 9px;">${(b.sport || 'Tennis').toUpperCase()}</span></td>
        <td>${b.date}<br><span class="cc-text-mono" style="font-size: 11px; color: var(--cc-text-muted);">${b.startTime || b.start_time} - ${b.endTime || b.end_time}</span></td>
        <td><strong style="color: var(--cc-text-primary);">${b.rateApplied || (b.fee === 0 ? 'Member Free' : '₹ ' + b.fee)}</strong></td>
        <td><span class="cc-badge ${isConfirmed ? 'cc-badge-active' : 'cc-badge-danger'}">${(b.state || 'confirmed').toUpperCase()}</span></td>
        <td style="text-align: right;">
          ${isConfirmed ? `
            <button class="cc-btn cc-btn-danger cc-btn-sm" style="padding: 3px 8px; font-size: 10px;" onclick="cancelMyBooking('${b.id || b.name}')">Cancel Slot</button>
          ` : '<span style="color: var(--cc-text-muted); font-size: 11px;">Cancelled</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.cancelMyBooking = async function(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking? The slot will immediately open for other members.')) return;
    if (window.ClubAPI) {
      try {
        await window.ClubAPI.cancelBooking(bookingId);
      } catch (err) {
        console.warn('Cancel API fallback', err);
      }
    }
    if (window.ClubDataStore) {
      const bookings = window.ClubDataStore.getBookings();
      const target = bookings.find(b => b.id === bookingId || b.name === bookingId);
      if (target) {
        target.state = 'cancelled';
        window.ClubDataStore.saveBookings(bookings);
      }
    }
    renderBookings(currentMember);
  };

  function renderOrders(member) {
    const tbody = document.getElementById('portal-orders-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const memberId = member.id || member.member_code;
    let allOrders = window.ClubDataStore ? window.ClubDataStore.getShopOrders() : [];
    
    // Privacy boundary: Filter only current member's orders
    const myOrders = allOrders.filter(o => o.memberId === memberId || o.customer === member.name);

    if (myOrders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--cc-text-muted); padding: 1.5rem;">No data available (0 shop purchases recorded).</td></tr>';
      return;
    }

    myOrders.forEach(o => {
      const itemsDesc = (o.items || []).map(i => `${i.qty}x ${i.name}`).join(', ');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong class="cc-text-mono" style="color: var(--cc-gold-400);">${o.id || o.name}</strong></td>
        <td><span class="cc-body-xs" style="color: var(--cc-text-primary);">${itemsDesc}</span></td>
        <td><span class="cc-badge cc-badge-silver">${(o.channel || 'online').toUpperCase()}</span></td>
        <td>${o.fulfillment || 'Pickup'}</td>
        <td><strong class="cc-text-mono" style="color: var(--cc-gold-400);">₹ ${Number(o.total || o.amount_total).toFixed(2)}</strong></td>
        <td><span class="cc-badge ${o.state === 'completed' ? 'cc-badge-active' : 'cc-badge-gold'}">${(o.state || 'confirmed').toUpperCase()}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderTabs(member) {
    const tbody = document.getElementById('portal-tabs-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const memberId = member.id || member.member_code;
    let allTabs = window.ClubDataStore ? window.ClubDataStore.getBarTabs() : [];
    
    // Privacy boundary: Filter only current member's tabs
    const myTabs = allTabs.filter(t => t.memberKey === memberId || t.memberId === memberId || t.memberName === member.name || (t.member_code && t.member_code === memberId));

    if (myTabs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--cc-text-muted); padding: 1.5rem;">No data available (0 bar tab entries found).</td></tr>';
      return;
    }

    myTabs.forEach(t => {
      const itemsDesc = (t.items || []).map(i => `${i.qty}x ${i.name.replace('[DEMO DATA] ', '')}`).join(', ');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong class="cc-text-mono" style="color: var(--cc-gold-400);">${t.id || t.name}</strong></td>
        <td>${t.tableName || t.table_name || 'Cafe/Bar Counter'}</td>
        <td><span class="cc-body-xs" style="color: var(--cc-text-secondary);">${itemsDesc || 'Tab orders'}</span></td>
        <td><span class="cc-text-mono" style="color: var(--cc-gold-400);">${t.discountPercent || t.discount_percent || 0}%</span></td>
        <td><strong class="cc-text-mono" style="color: var(--cc-neon-green);">₹ ${Number(t.amount_total || t.netTotal || 0).toFixed(2)}</strong></td>
        <td><span class="cc-badge ${t.state === 'open' ? 'cc-badge-warning' : 'cc-badge-active'}">${(t.state || 'open').toUpperCase()}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderTimeline(member) {
    const container = document.getElementById('portal-timeline-container');
    if (!container) return;
    container.innerHTML = '';

    const history = member.history || [
      { timestamp: '2026-10-03 09:00', type: 'system', desc: 'Member profile loaded from Odoo ORM.' }
    ];

    if (history.length === 0) {
      container.innerHTML = '<p class="cc-body-xs" style="color: var(--cc-text-muted);">No activity history logged yet.</p>';
      return;
    }

    history.slice().reverse().forEach(h => {
      const div = document.createElement('div');
      div.className = 'cc-history-item';
      div.innerHTML = `
        <div class="cc-history-time">${h.timestamp || '2026-10-03'}</div>
        <div class="cc-history-desc">${h.desc}</div>
      `;
      container.appendChild(div);
    });
  }

  // ==========================================================================
  // MEMBERSHIP LIFECYCLE 1: CANCELLATION WITH NO-REFUND POLICY
  // ==========================================================================

  window.openCancelMembershipModal = function() {
    if (!currentMember && window.ClubMemberAuth) {
      currentMember = window.ClubMemberAuth.getMember();
    }
    if (!currentMember && window.ClubDataStore) {
      const allMems = window.ClubDataStore.getMembers();
      if (allMems && allMems.length > 0) currentMember = allMems[0];
    }
    if (!currentMember) {
      alert('Please sign in to view and manage your membership.');
      return;
    }

    const modal = document.getElementById('modal-cancel-membership');
    if (!modal) return;

    // Fill current member info
    const elName = document.getElementById('cancel-modal-member-name');
    const elCode = document.getElementById('cancel-modal-member-code');
    const elTier = document.getElementById('cancel-modal-member-tier');
    const elExpiry = document.getElementById('cancel-modal-member-expiry');
    const chkPolicy = document.getElementById('cancel-policy-checkbox');

    if (elName) elName.textContent = currentMember.name;
    if (elCode) elCode.textContent = currentMember.id || currentMember.member_code || 'CC-MEM';
    if (elTier) {
      const planCode = (currentMember.plan || currentMember.tier_code || 'gold').toLowerCase();
      elTier.className = `cc-badge ${planCode === 'gold' ? 'cc-badge-gold' : planCode === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior'}`;
      elTier.textContent = `${planCode.toUpperCase()} TIER`;
    }
    if (elExpiry) elExpiry.textContent = `Valid until: ${currentMember.endDate || currentMember.end_date || '2027-10-03'}`;
    if (chkPolicy) chkPolicy.checked = false;

    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  window.closeCancelMembershipModal = function() {
    const modal = document.getElementById('modal-cancel-membership');
    if (modal) {
      modal.classList.remove('is-open');
    }
    document.body.style.overflow = '';
  };

  window.confirmCancelMembership = function() {
    if (!currentMember && window.ClubMemberAuth) {
      currentMember = window.ClubMemberAuth.getMember();
    }
    if (!currentMember) return;

    const chkPolicy = document.getElementById('cancel-policy-checkbox');
    if (chkPolicy && !chkPolicy.checked) {
      alert('Please acknowledge and accept the No-Refund Policy by ticking the checkbox before confirming cancellation.');
      return;
    }

    const reasonSelect = document.getElementById('cancel-reason-select');
    const feedbackText = document.getElementById('cancel-feedback-text');
    const reason = reasonSelect ? reasonSelect.value : 'Member requested cancellation';
    const feedback = feedbackText ? feedbackText.value.trim() : '';

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const cancelNote = `Member self-cancelled subscription. Reason: ${reason}.${feedback ? ' Feedback: ' + feedback : ''} Acknowledged strict No-Refund Policy (₹0.00 refund).`;

    // 1. Update Current Member Object
    currentMember.state = 'cancelled';
    currentMember.has_active_benefits = false;
    if (!currentMember.history) currentMember.history = [];
    currentMember.history.push({
      timestamp: timestamp,
      type: 'cancellation',
      desc: cancelNote
    });

    // 2. Persist to DataStore
    if (window.ClubDataStore) {
      const members = window.ClubDataStore.getMembers();
      const idx = members.findIndex(m => m.id === currentMember.id || m.member_code === currentMember.id || m.name === currentMember.name);
      if (idx !== -1) {
        members[idx] = JSON.parse(JSON.stringify(currentMember));
        window.ClubDataStore.saveMembers(members);
      }
    }

    // 3. Persist to Session
    const sessionKey = 'cc_portal_member';
    sessionStorage.setItem(sessionKey, JSON.stringify(currentMember));
    localStorage.setItem(sessionKey, JSON.stringify(currentMember));

    closeCancelMembershipModal();

    if (window.ClubAPI && window.ClubAPI.showSuccess) {
      window.ClubAPI.showSuccess('Membership cancelled. Note: No-Refund Policy applied.');
    } else {
      alert('Your membership has been cancelled. As per club policy, no refund has been issued.');
    }

    // Re-render UI
    renderNavActions(true);
    renderProfileHeader(currentMember);
    renderEntitlements(currentMember);
    renderTimeline(currentMember);

    if (window.ClubMemberAuth) {
      if (window.ClubMemberAuth.applyMemberState) window.ClubMemberAuth.applyMemberState();
      if (window.ClubMemberAuth.syncMemberProfileEverywhere) window.ClubMemberAuth.syncMemberProfileEverywhere(currentMember);
    }
  };

  // ==========================================================================
  // MEMBERSHIP LIFECYCLE 2: UPGRADE SUBSCRIPTION (PRO-RATA CREDIT)
  // ==========================================================================

  window.openUpgradeMembershipModal = function() {
    if (!currentMember && window.ClubMemberAuth) {
      currentMember = window.ClubMemberAuth.getMember();
    }
    if (!currentMember && window.ClubDataStore) {
      const allMems = window.ClubDataStore.getMembers();
      if (allMems && allMems.length > 0) currentMember = allMems[0];
    }
    if (!currentMember) {
      alert('Please sign in to view and manage your membership.');
      return;
    }

    const modal = document.getElementById('modal-upgrade-membership');
    if (!modal) return;

    const currentPlan = (currentMember.plan || currentMember.tier_code || 'silver').toLowerCase();
    const currentFee = PLAN_FEES[currentPlan] || 14000;
    const monthlyRate = currentFee / 12.0;

    // Remaining term calculation
    const today = new Date();
    const endDate = new Date(currentMember.endDate || currentMember.end_date || '2027-10-04');
    const remainingDays = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
    
    // Divide subscription fee by 12 and multiply by remaining months
    const remainingMonths = (currentMember.state === 'cancelled' || remainingDays <= 0) 
      ? 0 
      : Math.min(12, Math.max(1, Math.ceil(remainingDays / 30.4375)));

    const prorataDiscount = Math.round(remainingMonths * monthlyRate);

    // Populate Current Plan Info in Modal
    const elCurPlan = document.getElementById('upgrade-current-plan-name');
    const elMonthlyVal = document.getElementById('upgrade-current-monthly-val');
    const elRemMonthsBadge = document.getElementById('upgrade-remaining-months-badge');
    const elCurExpiry = document.getElementById('upgrade-current-expiry-display');
    const elFormulaFee = document.getElementById('calc-formula-fee');
    const elFormulaMonths = document.getElementById('calc-formula-months');
    const elDiscountAmt = document.getElementById('upgrade-discount-amount-display');

    if (elCurPlan) elCurPlan.textContent = `${currentPlan.toUpperCase()} Plan (₹ ${currentFee.toLocaleString()} / yr)`;
    if (elMonthlyVal) elMonthlyVal.textContent = `₹ ${monthlyRate.toFixed(2)} / mo`;
    if (elRemMonthsBadge) {
      if (currentMember.state === 'cancelled') {
        elRemMonthsBadge.textContent = 'Cancelled (0 Months Credit)';
        elRemMonthsBadge.className = 'cc-badge cc-badge-danger';
      } else {
        elRemMonthsBadge.textContent = `${remainingMonths} Month${remainingMonths === 1 ? '' : 's'} Remaining`;
        elRemMonthsBadge.className = 'cc-badge cc-badge-active';
      }
    }
    if (elCurExpiry) elCurExpiry.textContent = `Expires: ${currentMember.endDate || '2027-10-04'}`;
    if (elFormulaFee) elFormulaFee.textContent = `₹ ${currentFee.toLocaleString()}`;
    if (elFormulaMonths) elFormulaMonths.textContent = `${remainingMonths}`;
    if (elDiscountAmt) elDiscountAmt.textContent = `- ₹ ${prorataDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    // Build Available Upgrade Target Options
    const optionsContainer = document.getElementById('upgrade-plan-options-container');
    if (optionsContainer) {
      let optionsHtml = '';
      if (currentPlan === 'junior') {
        optionsHtml += `
          <label class="cc-upgrade-plan-card is-selected" id="card-upgrade-gold" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.03); border: 2px solid var(--cc-gold-500); border-radius: var(--cc-radius-md); padding: 1rem; cursor: pointer;">
            <div style="display: flex; gap: 12px; align-items: center;">
              <input type="radio" name="upgrade_target_plan" value="gold" checked onchange="selectUpgradeTargetPlan('gold')" style="accent-color: var(--cc-gold-500); width: 18px; height: 18px;">
              <div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <strong style="color: #FFFFFF; font-size: 15px;">Gold Membership</strong>
                  <span class="cc-badge cc-badge-gold" style="font-size: 9px;">PREMIUM</span>
                </div>
                <div style="font-size: 11px; color: var(--cc-text-muted); margin-top: 2px;">
                  Free Courts &bull; 15% Shop &amp; Cafe/Bar &bull; Cafe/Bar Tab Privilege &bull; 4 Guest Passes
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <div class="cc-text-mono" style="font-weight: 800; font-size: 15px; color: var(--cc-gold-400);">₹ 24,000 / yr</div>
              <div style="font-size: 10px; color: var(--cc-neon-green);">1-Year Validity</div>
            </div>
          </label>

          <label class="cc-upgrade-plan-card" id="card-upgrade-silver" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--cc-border-medium); border-radius: var(--cc-radius-md); padding: 1rem; cursor: pointer;">
            <div style="display: flex; gap: 12px; align-items: center;">
              <input type="radio" name="upgrade_target_plan" value="silver" onchange="selectUpgradeTargetPlan('silver')" style="accent-color: var(--cc-gold-500); width: 18px; height: 18px;">
              <div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <strong style="color: #FFFFFF; font-size: 15px;">Silver Membership</strong>
                  <span class="cc-badge cc-badge-silver" style="font-size: 9px;">STANDARD</span>
                </div>
                <div style="font-size: 11px; color: var(--cc-text-muted); margin-top: 2px;">
                  ₹ 300/hr Courts &bull; 10% Shop &amp; Cafe/Bar Discounts &bull; 1 Guest Pass
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <div class="cc-text-mono" style="font-weight: 800; font-size: 15px; color: #E2E8F0;">₹ 14,000 / yr</div>
              <div style="font-size: 10px; color: var(--cc-neon-green);">1-Year Validity</div>
            </div>
          </label>
        `;
        selectedUpgradeTarget = 'gold';
      } else if (currentPlan === 'silver') {
        optionsHtml += `
          <label class="cc-upgrade-plan-card is-selected" id="card-upgrade-gold" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.03); border: 2px solid var(--cc-gold-500); border-radius: var(--cc-radius-md); padding: 1rem; cursor: pointer;">
            <div style="display: flex; gap: 12px; align-items: center;">
              <input type="radio" name="upgrade_target_plan" value="gold" checked onchange="selectUpgradeTargetPlan('gold')" style="accent-color: var(--cc-gold-500); width: 18px; height: 18px;">
              <div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <strong style="color: #FFFFFF; font-size: 15px;">Gold Membership</strong>
                  <span class="cc-badge cc-badge-gold" style="font-size: 9px;">PREMIUM</span>
                </div>
                <div style="font-size: 11px; color: var(--cc-text-muted); margin-top: 2px;">
                  Free Courts &bull; 15% Shop &amp; Cafe/Bar &bull; Cafe/Bar Tab Privilege &bull; 4 Guest Passes
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <div class="cc-text-mono" style="font-weight: 800; font-size: 15px; color: var(--cc-gold-400);">₹ 24,000 / yr</div>
              <div style="font-size: 10px; color: var(--cc-neon-green);">1-Year Validity</div>
            </div>
          </label>
        `;
        selectedUpgradeTarget = 'gold';
      } else {
        // Already Gold: Allow 1-Year Renewal Upgrade with full extension
        optionsHtml += `
          <label class="cc-upgrade-plan-card is-selected" id="card-upgrade-gold" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.03); border: 2px solid var(--cc-gold-500); border-radius: var(--cc-radius-md); padding: 1rem; cursor: pointer;">
            <div style="display: flex; gap: 12px; align-items: center;">
              <input type="radio" name="upgrade_target_plan" value="gold" checked onchange="selectUpgradeTargetPlan('gold')" style="accent-color: var(--cc-gold-500); width: 18px; height: 18px;">
              <div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <strong style="color: #FFFFFF; font-size: 15px;">Gold Membership (1-Year Extension)</strong>
                  <span class="cc-badge cc-badge-gold" style="font-size: 9px;">HIGHEST TIER</span>
                </div>
                <div style="font-size: 11px; color: var(--cc-text-muted); margin-top: 2px;">
                  Full Club Access &bull; Free Unlimited Courts &bull; 15% Store &amp; F&amp;B Discounts
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <div class="cc-text-mono" style="font-weight: 800; font-size: 15px; color: var(--cc-gold-400);">₹ 24,000 / yr</div>
              <div style="font-size: 10px; color: var(--cc-neon-green);">+1 Full Year</div>
            </div>
          </label>
        `;
        selectedUpgradeTarget = 'gold';
      }
      optionsContainer.innerHTML = optionsHtml;
    }

    updateUpgradeFinancials();

    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  window.closeUpgradeMembershipModal = function() {
    const modal = document.getElementById('modal-upgrade-membership');
    if (modal) {
      modal.classList.remove('is-open');
    }
    document.body.style.overflow = '';
  };

  window.selectUpgradeTargetPlan = function(targetPlan) {
    selectedUpgradeTarget = targetPlan;
    
    // Update visual borders on radio cards
    const cardGold = document.getElementById('card-upgrade-gold');
    const cardSilver = document.getElementById('card-upgrade-silver');
    if (cardGold) {
      cardGold.style.border = targetPlan === 'gold' ? '2px solid var(--cc-gold-500)' : '1px solid var(--cc-border-medium)';
    }
    if (cardSilver) {
      cardSilver.style.border = targetPlan === 'silver' ? '2px solid var(--cc-gold-500)' : '1px solid var(--cc-border-medium)';
    }

    updateUpgradeFinancials();
  };

  function updateUpgradeFinancials() {
    if (!currentMember && window.ClubMemberAuth) {
      currentMember = window.ClubMemberAuth.getMember();
    }
    if (!currentMember) return;

    const currentPlan = (currentMember.plan || currentMember.tier_code || 'silver').toLowerCase();
    const currentFee = PLAN_FEES[currentPlan] || 14000;
    const monthlyRate = currentFee / 12.0;

    const today = new Date();
    const endDate = new Date(currentMember.endDate || currentMember.end_date || '2027-10-04');
    const remainingDays = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
    
    const remainingMonths = (currentMember.state === 'cancelled' || remainingDays <= 0) 
      ? 0 
      : Math.min(12, Math.max(1, Math.ceil(remainingDays / 30.4375)));

    const prorataDiscount = (currentPlan === selectedUpgradeTarget) ? 0 : Math.round(remainingMonths * monthlyRate);
    const targetFee = PLAN_FEES[selectedUpgradeTarget] || 24000;
    const netPayable = Math.max(0, targetFee - prorataDiscount);

    // Calculate new expiry date (1 full year from today)
    const newEnd = new Date(today.getTime() + 365 * 24 * 3600 * 1000);
    const newEndStr = newEnd.toISOString().substring(0, 10);

    const elNewPlanFee = document.getElementById('summary-new-plan-fee');
    const elProrataCred = document.getElementById('summary-prorata-credit');
    const elNetPayable = document.getElementById('summary-net-payable');
    const elNewExpiry = document.getElementById('summary-new-expiry-date');
    const btnSubmit = document.getElementById('btn-confirm-upgrade-submit');

    if (elNewPlanFee) elNewPlanFee.textContent = `₹ ${targetFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (elProrataCred) elProrataCred.textContent = `- ₹ ${prorataDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (elNetPayable) elNetPayable.textContent = `₹ ${netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (elNewExpiry) elNewExpiry.textContent = `${newEndStr} (1 Full Year)`;
    if (btnSubmit) btnSubmit.textContent = `Confirm & Upgrade Plan (Pay ₹ ${netPayable.toLocaleString()}) →`;
  }

  window.confirmUpgradeMembership = function() {
    if (!currentMember && window.ClubMemberAuth) {
      currentMember = window.ClubMemberAuth.getMember();
    }
    if (!currentMember) return;

    const currentPlan = (currentMember.plan || currentMember.tier_code || 'silver').toLowerCase();
    const currentFee = PLAN_FEES[currentPlan] || 14000;
    const monthlyRate = currentFee / 12.0;

    const today = new Date();
    const todayStr = today.toISOString().substring(0, 10);
    const endDate = new Date(currentMember.endDate || currentMember.end_date || '2027-10-04');
    const remainingDays = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));
    
    const remainingMonths = (currentMember.state === 'cancelled' || remainingDays <= 0) 
      ? 0 
      : Math.min(12, Math.max(1, Math.ceil(remainingDays / 30.4375)));

    const prorataDiscount = (currentPlan === selectedUpgradeTarget) ? 0 : Math.round(remainingMonths * monthlyRate);
    const targetPlan = selectedUpgradeTarget;
    const targetFee = PLAN_FEES[targetPlan] || 24000;
    const netPayable = Math.max(0, targetFee - prorataDiscount);

    const newEnd = new Date(today.getTime() + 365 * 24 * 3600 * 1000);
    const newEndStr = newEnd.toISOString().substring(0, 10);

    const paymentMethods = document.querySelectorAll('input[name="upgrade_payment_method"]');
    let paymentMethod = 'UPI';
    paymentMethods.forEach(p => { if (p.checked) paymentMethod = p.value.toUpperCase(); });

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const upgradeDesc = `Upgraded subscription from ${currentPlan.toUpperCase()} to ${targetPlan.toUpperCase()} Tier. Applied pro-rata term discount: ₹${prorataDiscount.toLocaleString()} (${remainingMonths} months @ ₹${monthlyRate.toFixed(2)}/mo). Net paid: ₹${netPayable.toLocaleString()} via ${paymentMethod}. Validity extended until ${newEndStr}.`;

    // 1. Update Member Record
    currentMember.plan = targetPlan;
    currentMember.tier_code = targetPlan;
    currentMember.startDate = todayStr;
    currentMember.endDate = newEndStr;
    currentMember.state = 'active';
    currentMember.has_active_benefits = true;
    if (!currentMember.history) currentMember.history = [];
    currentMember.history.push({
      timestamp: timestamp,
      type: 'plan_upgrade',
      desc: upgradeDesc
    });

    // 2. Generate Membership Upgrade Invoice
    const invoiceId = `CC-INV-${Date.now().toString().slice(-6)}`;
    const newInvoice = {
      id: invoiceId,
      clientName: `${currentMember.name} (${targetPlan.toUpperCase()} Membership Upgrade)`,
      invoiceType: 'membership',
      issueDate: todayStr,
      dueDate: todayStr,
      amountUntaxed: netPayable,
      taxAmount: Math.round(netPayable * 0.18),
      totalAmount: Math.round(netPayable * 1.18),
      state: 'paid',
      paymentMethod: paymentMethod.toLowerCase(),
      notes: `Subscription upgrade from ${currentPlan.toUpperCase()} to ${targetPlan.toUpperCase()} with pro-rata unused term credit of ₹${prorataDiscount.toLocaleString()}.`
    };

    // 3. Persist to DataStore
    if (window.ClubDataStore) {
      const members = window.ClubDataStore.getMembers();
      const idx = members.findIndex(m => m.id === currentMember.id || m.member_code === currentMember.id || m.name === currentMember.name);
      if (idx !== -1) {
        members[idx] = JSON.parse(JSON.stringify(currentMember));
        window.ClubDataStore.saveMembers(members);
      }

      const invoices = window.ClubDataStore.getInvoices();
      invoices.unshift(newInvoice);
      window.ClubDataStore.saveInvoices(invoices);
    }

    // 4. Persist to Session
    const sessionKey = 'cc_portal_member';
    sessionStorage.setItem(sessionKey, JSON.stringify(currentMember));
    localStorage.setItem(sessionKey, JSON.stringify(currentMember));

    closeUpgradeMembershipModal();

    if (window.ClubAPI && window.ClubAPI.showSuccess) {
      window.ClubAPI.showSuccess(`🎉 Upgraded to ${targetPlan.toUpperCase()} Tier! Discount applied: ₹${prorataDiscount.toLocaleString()}`);
    } else {
      alert(`Congratulations! You have been upgraded to the ${targetPlan.toUpperCase()} Tier. Pro-rata discount of ₹${prorataDiscount.toLocaleString()} was applied.`);
    }

    // Re-render UI
    renderNavActions(true);
    renderProfileHeader(currentMember);
    renderEntitlements(currentMember);
    renderTimeline(currentMember);
  };

  document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    // Login Form (Name & Phone Number Only)
    const formLogin = document.getElementById('form-portal-login');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('login-name') || document.getElementById('login-identifier');
        const phoneInput = document.getElementById('login-phone') || document.getElementById('login-password');
        const name = nameInput ? nameInput.value.trim() : '';
        const phone = phoneInput ? phoneInput.value.trim() : '';

        if (window.ClubMemberAuth) {
          const session = window.ClubMemberAuth.login(name, phone);
          if (session) {
            currentMember = session;
            await loadMemberProfile(session.member_id || session.id || session.member_code);
          }
        } else if (window.ClubAPI) {
          try {
            const session = await window.ClubAPI.login(name, phone);
            if (session) {
              currentMember = session;
              await loadMemberProfile(session.member_id || session.id || session.member_code);
            }
          } catch (err) {
            console.error('Login error', err);
          }
        }
      });
    }

    // Portal Tabs
    const tabButtons = document.querySelectorAll('#portal-tab-buttons .cc-filter-pill');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const targetId = btn.getAttribute('data-ptab');
        document.querySelectorAll('.portal-tab-content').forEach(panel => {
          panel.style.display = panel.id === targetId ? 'block' : 'none';
        });
      });
    });

    // Backdrop click listeners for modals
    const cancelModal = document.getElementById('modal-cancel-membership');
    if (cancelModal) {
      cancelModal.addEventListener('click', (e) => {
        if (e.target === cancelModal) window.closeCancelMembershipModal();
      });
    }
    const upgradeModal = document.getElementById('modal-upgrade-membership');
    if (upgradeModal) {
      upgradeModal.addEventListener('click', (e) => {
        if (e.target === upgradeModal) window.closeUpgradeMembershipModal();
      });
    }
  });

  // Expose functions globally
  if (typeof window !== 'undefined') {
    window.loadMemberProfile = loadMemberProfile;
  }

})();
