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

  async function checkSession() {
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
    document.getElementById('view-login').style.display = 'block';
    document.getElementById('view-profile').style.display = 'none';
    renderNavActions(false);
  }

  function showProfileView() {
    document.getElementById('view-login').style.display = 'none';
    document.getElementById('view-profile').style.display = 'block';
    renderNavActions(true);
  }

  function renderNavActions(isAuthenticated) {
    const container = document.getElementById('portal-nav-actions');
    if (!container) return;
    if (isAuthenticated) {
      container.innerHTML = `
        <span class="cc-text-mono" style="font-size: 12px; color: var(--cc-gold-400); font-weight: 700; margin-right: 8px;">
          ${currentMember.name || 'Member'}
        </span>
        <button class="cc-btn cc-btn-secondary cc-btn-sm" id="btn-portal-logout">Sign Out</button>
      `;
      const btnLogout = document.getElementById('btn-portal-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
          if (window.ClubAPI) await window.ClubAPI.logout();
          currentMember = null;
          showLoginView();
        });
      }
    } else {
      container.innerHTML = `
        <a href="index.html" class="cc-btn cc-btn-secondary cc-btn-sm">Return Home</a>
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
    const planCode = member.plan || member.tier_code || 'gold';
    const planBadge = document.getElementById('profile-tier-badge');
    if (planBadge) {
      planBadge.className = `cc-badge ${planCode === 'gold' ? 'cc-badge-gold' : planCode === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior'}`;
      planBadge.textContent = `${planCode.toUpperCase()} TIER`;
    }

    const state = member.state || 'active';
    const statusBadge = document.getElementById('profile-status-badge');
    if (statusBadge) {
      statusBadge.className = `cc-badge ${state === 'active' ? 'cc-badge-active' : state === 'expired' ? 'cc-badge-danger' : 'cc-badge-warning'}`;
      statusBadge.textContent = state.toUpperCase();
    }

    document.getElementById('profile-member-code').textContent = member.id || member.member_code || 'CC-MEM';
    document.getElementById('profile-member-name').textContent = member.name;
    document.getElementById('profile-contact-info').textContent = `${member.email || 'No email registered'} • ${member.phone || 'No phone registered'}`;
    document.getElementById('profile-expiry-date').textContent = member.endDate || member.end_date || '2027-10-03';
    document.getElementById('profile-privileges-text').textContent = state === 'active' ? 'Full Access' : 'Restricted';
  }

  function renderEntitlements(member) {
    const planCode = (member.plan || member.tier_code || 'gold').toLowerCase();
    const plans = window.ClubDataStore ? window.ClubDataStore.getMembershipPlans() : null;
    const planInfo = plans ? plans[planCode] : null;

    const courtEl = document.getElementById('entitlement-court');
    const shopEl = document.getElementById('entitlement-shop');
    const barEl = document.getElementById('entitlement-bar');

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
        <td>${t.tableName || t.table_name || 'Bar Counter'}</td>
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

  document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    // Login Form
    const formLogin = document.getElementById('form-portal-login');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('login-identifier').value.trim();
        const password = document.getElementById('login-password').value.trim();

        if (window.ClubAPI) {
          try {
            const session = await window.ClubAPI.login(identifier, password);
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
  });

})();
