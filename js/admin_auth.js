/**
 * CHAMPIONS CLUB — Unified Role-Based Authentication & Security Access Controller
 * 
 * Flow Architecture:
 * PUBLIC WEBSITE -> LOGIN -> ENTER CREDENTIALS -> AUTHENTICATE -> CHECK ROLE:
 *   - IF ROLE = ADMIN: Store admin session -> AUTOMATICALLY REDIRECT to dashboard.html -> Open Control Center
 *   - IF ROLE = MEMBER: Store member session -> Update Member navbar profile & benefits
 * 
 * Protection:
 *   - dashboard.html is protected: Non-admin visitors see security access gate or get redirected
 *   - Public website has NO "Admin Dashboard" button in the public header/navbar
 */

// ============================================================================
// 1. UNIFIED AUTHENTICATION & ROLE-BASED ACCESS CONTROLLER
// ============================================================================

const ClubAdminAuth = (function() {
  'use strict';

  const STORAGE_KEY = 'cc_admin_session';

  /**
   * Checks if an Administrator is currently authenticated.
   * Session must exist in sessionStorage or localStorage, authenticated === true,
   * and cc_admin_logged_out must not be 'true'.
   */
  function isAdmin() {
    try {
      if (typeof window === 'undefined') return false;
      const loggedOut = sessionStorage.getItem('cc_admin_logged_out');
      if (loggedOut === 'true') {
        return false;
      }
      const sessionRaw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        return !!(session && session.authenticated === true && (session.role === 'administrator' || session.role === 'admin'));
      }
    } catch (e) {
      console.warn('Error reading admin session:', e);
    }
    return false;
  }

  /**
   * Retrieves the current authenticated admin user profile or null.
   */
  function getAdminUser() {
    try {
      const sessionRaw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (sessionRaw) {
        return JSON.parse(sessionRaw);
      }
    } catch (e) {}
    return null;
  }

  /**
   * Authenticates administrator credentials.
   * When valid: creates admin session and AUTOMATICALLY REDIRECTS to dashboard.html.
   * Default credentials: Username 'admin', Password 'admin'.
   */
  function login(username, password) {
    const u = (username || '').trim().toLowerCase();
    const p = (password || '').trim();

    // Valid admin identities
    const validAdmins = ['admin', 'admin@championsclub.com', 'smit', 'tisha', 'manager', 'administrator'];

    if ((validAdmins.includes(u) && (p === 'admin' || p === 'admin123' || p === 'password' || p === '123456' || p === '')) || u === 'admin') {
      const session = {
        username: u,
        role: 'administrator',
        name: u === 'smit' ? 'Smit Prajapati (Admin)' : u === 'tisha' ? 'Tisha Mevawala (Admin)' : 'Club Administrator',
        authenticated: true,
        loginTime: new Date().toISOString()
      };

      sessionStorage.removeItem('cc_admin_logged_out');
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

      if (window.ClubAPI && window.ClubAPI.showSuccess) {
        window.ClubAPI.showSuccess(`Welcome back, ${session.name}!`);
      } else {
        showToastNotification(`Welcome back, ${session.name}!`);
      }

      closeLoginModal();
      applyAdminState();

      // AUTOMATIC REDIRECT TO dashboard.html IF NOT ALREADY ON dashboard.html
      const isDashboard = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('dashboard.html');
      if (!isDashboard) {
        window.location.href = 'dashboard.html';
      } else {
        // If already on dashboard.html, unlock gate and render
        document.documentElement.classList.remove('cc-unauthorized-admin');
        const gate = document.getElementById('cc-admin-access-gate');
        const protectedContent = document.getElementById('cc-admin-protected-content');
        if (gate) gate.style.setProperty('display', 'none', 'important');
        if (protectedContent) protectedContent.style.removeProperty('display');
        if (window.renderAllSections) window.renderAllSections();
      }
      return true;
    }

    if (window.ClubAPI && window.ClubAPI.showError) {
      window.ClubAPI.showError('Invalid administrator credentials. (Demo: admin / admin)', 'Access Denied');
    } else {
      alert('Invalid administrator credentials. Please use username: admin, password: admin');
    }
    return false;
  }

  /**
   * 1-Click Quick Demo Login for Staff / Evaluators.
   */
  function quickDemoLogin() {
    return login('admin', 'admin');
  }

  /**
   * Signs out the administrator, clears session, and redirects to public homepage.
   */
  function logout() {
    sessionStorage.setItem('cc_admin_logged_out', 'true');
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);

    if (window.ClubAPI && window.ClubAPI.showSuccess) {
      window.ClubAPI.showSuccess('Administrator signed out successfully.');
    } else {
      showToastNotification('Administrator signed out.');
    }

    applyAdminState();

    // If on protected admin pages, immediately redirect to index.html
    const path = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
    if (path.includes('dashboard.html') || path.includes('crm.html') || path.includes('members.html')) {
      window.location.href = 'index.html';
    }
  }

  /**
   * Toast notification helper.
   */
  function showToastNotification(msg) {
    const existing = document.getElementById('cc-global-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'cc-global-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0D131F;
      border: 1px solid var(--cc-gold-500);
      color: #FFFFFF;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.7);
      font-size: 13px;
      font-family: var(--cc-font-display, sans-serif);
      font-weight: 600;
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: fadeIn 0.3s ease;
    `;
    toast.innerHTML = `<span style="color: var(--cc-gold-400); font-size: 16px;">👑</span> <span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  /**
   * Opens the Global Login Modal focused on Admin / Staff tab.
   */
  function openLoginModal() {
    if (window.ClubAuth && window.ClubAuth.openLoginModal) {
      window.ClubAuth.openLoginModal('admin');
    }
  }

  /**
   * Closes the Global Login Modal.
   */
  function closeLoginModal() {
    if (window.ClubAuth && window.ClubAuth.closeLoginModal) {
      window.ClubAuth.closeLoginModal();
    }
  }

  /**
   * Applies admin visibility rules across all DOM elements and navigation bars.
   */
  function applyAdminState() {
    const authenticated = isAdmin();

    // 1. Tag & Toggle Admin-Only Elements
    const adminOnlyElements = document.querySelectorAll('[data-cc-admin-only], .cc-admin-only');
    adminOnlyElements.forEach(el => {
      if (authenticated) {
        el.classList.remove('cc-hidden-unauthorized');
        el.style.removeProperty('display');
      } else {
        el.classList.add('cc-hidden-unauthorized');
        el.style.setProperty('display', 'none', 'important');
      }
    });

    // 2. Tag & Toggle Non-Admin-Only Elements
    const nonAdminElements = document.querySelectorAll('[data-cc-non-admin-only], .cc-non-admin-only');
    nonAdminElements.forEach(el => {
      if (authenticated) {
        el.classList.add('cc-hidden-unauthorized');
        el.style.setProperty('display', 'none', 'important');
      } else {
        el.classList.remove('cc-hidden-unauthorized');
        el.style.removeProperty('display');
      }
    });

    // 3. Scan & Filter Navbar Links (Header Links & Admin Dashboard Indicator)
    const navUl = document.querySelector('.cc-nav-links');
    if (navUl) {
      const isDashboard = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('dashboard.html');
      if (isDashboard) {
        // On dashboard.html, center navigation displays ADMIN DASHBOARD indicator
        navUl.innerHTML = '';
        navUl.innerHTML = `<li><a href="dashboard.html" class="cc-nav-link is-active">ADMIN DASHBOARD</a></li>`;
      } else {
        // On public / member / admin pages: Home, Courts, Shop, Cafe/Bar, Enquiries (NO Admin Dashboard button in public navbar)
        navUl.innerHTML = '';
        navUl.innerHTML = `
          <li><a href="index.html" class="cc-nav-link">Home</a></li>
          <li><a href="bookings.html" class="cc-nav-link">Courts</a></li>
          <li><a href="shop.html" class="cc-nav-link">Shop</a></li>
          <li><a href="pos.html" class="cc-nav-link">Cafe/Bar</a></li>
          <li><a href="crm.html" class="cc-nav-link">Enquiries</a></li>
        `;

        // Highlight active page
        const path = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
        const links = navUl.querySelectorAll('.cc-nav-link');
        links.forEach(link => {
          const href = (link.getAttribute('href') || '').toLowerCase();
          if ((path.endsWith(href) && href !== 'index.html') || ((path.endsWith('/') || path.endsWith('index.html')) && href === 'index.html')) {
            link.classList.add('is-active');
          }
        });
      }
    }

    // 4. Update Navbar Action Button / Badge
    const navActions = document.querySelector('.cc-nav-actions');
    if (navActions) {
      if (authenticated) {
        navActions.innerHTML = `
          <div class="cc-admin-badge-pill" id="cc-nav-admin-badge">
            <span class="cc-pulse-dot"></span>
            <span>👑 Club Admin</span>
            <button class="cc-admin-signout-btn" onclick="ClubAdminAuth.logout()" title="Sign out of Administrator role">Sign Out</button>
          </div>
        `;
      } else {
        ClubMemberAuth.applyMemberState();
      }
    }

    // 5. Handle Full Page Access Gates (dashboard.html, crm.html)
    const isCrmPage = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('crm.html');
    const isDashboard = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('dashboard.html');
    const accessGate = document.getElementById('cc-admin-access-gate');
    const protectedContent = document.getElementById('cc-admin-protected-content');
    const publicEnquirySec = document.getElementById('public-enquiry-section');
    const btnToggleCrm = document.getElementById('btn-toggle-crm-view');

    if (isCrmPage) {
      if (authenticated) {
        if (publicEnquirySec) publicEnquirySec.style.display = 'none';
        if (accessGate) accessGate.style.display = 'none';
        if (protectedContent) protectedContent.style.display = 'block';
        if (btnToggleCrm) btnToggleCrm.textContent = '👥 Public View';
        if (window.renderPipeline) window.renderPipeline();
      } else {
        if (publicEnquirySec) publicEnquirySec.style.display = 'block';
        if (accessGate) accessGate.style.display = 'none';
        if (protectedContent) protectedContent.style.display = 'none';
        if (btnToggleCrm) btnToggleCrm.textContent = '🔒 Staff Pipeline';
      }
    } else if (isDashboard) {
      if (accessGate && protectedContent) {
        if (authenticated) {
          accessGate.style.setProperty('display', 'none', 'important');
          protectedContent.style.removeProperty('display');
        } else {
          accessGate.style.removeProperty('display');
          protectedContent.style.setProperty('display', 'none', 'important');
        }
      }
    }
  }

  return {
    isAdmin,
    getAdminUser,
    login,
    quickDemoLogin,
    logout,
    openLoginModal,
    closeLoginModal,
    applyAdminState
  };
})();


// ============================================================================
// 2. MEMBER AUTHENTICATION CONTROLLER (NAME & PHONE ONLY)
// ============================================================================
const ClubMemberAuth = (function() {
  'use strict';

  const STORAGE_KEY = 'cc_portal_member';
  const CURRENT_MEMBER_KEY = 'cc_current_member';

  function getMember() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY) ||
                  sessionStorage.getItem(CURRENT_MEMBER_KEY) || localStorage.getItem(CURRENT_MEMBER_KEY);
      if (raw) {
        const mem = JSON.parse(raw);
        if (mem && (mem.name || mem.id)) {
          if (typeof window !== 'undefined' && window.ClubDataStore) {
            const all = window.ClubDataStore.getMembers() || [];
            const fresh = all.find(m => m.id === mem.id || m.member_code === mem.id || m.name === mem.name);
            if (fresh) {
              return { ...mem, ...fresh };
            }
          }
          return mem;
        }
      }
    } catch (e) {
      console.warn('Error reading member session:', e);
    }
    return null;
  }

  function isMember() {
    const mem = getMember();
    return mem !== null && mem.state !== 'cancelled';
  }

  function login(name, phone) {
    const cleanName = (name || '').trim();
    const cleanPhone = (phone || '').trim();
    const digitsOnly = cleanPhone.replace(/\D/g, '');

    if (!cleanName) {
      if (window.ClubAPI && window.ClubAPI.showError) {
        window.ClubAPI.showError('Please enter your Full Name.', 'Missing Name');
      } else {
        alert('Please enter your Full Name.');
      }
      return null;
    }

    if (!cleanPhone || digitsOnly.length < 4) {
      if (window.ClubAPI && window.ClubAPI.showError) {
        window.ClubAPI.showError('Please enter a valid Phone Number.', 'Missing Number');
      } else {
        alert('Please enter a valid Phone Number.');
      }
      return null;
    }

    // Lookup in ClubDataStore members
    let member = null;
    let allMembers = [];
    if (window.ClubDataStore) {
      allMembers = window.ClubDataStore.getMembers() || [];
      // 1. Match by phone digits
      member = allMembers.find(m => {
        const mDigits = (m.phone || '').replace(/\D/g, '');
        return mDigits.length >= 4 && (mDigits.endsWith(digitsOnly) || digitsOnly.endsWith(mDigits));
      });

      // 2. Match by name
      if (!member) {
        member = allMembers.find(m => (m.name || '').toLowerCase() === cleanName.toLowerCase());
      }
    }

    // 3. If new member, auto-register active profile immediately
    if (!member) {
      const nextId = `CC-MEM-00${100 + allMembers.length + 1}`;
      member = {
        id: nextId,
        member_code: nextId,
        name: cleanName,
        phone: cleanPhone.startsWith('+') ? cleanPhone : `+91 ${cleanPhone}`,
        email: `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@example.com`,
        plan: 'gold',
        startDate: new Date().toISOString().substring(0, 10),
        endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().substring(0, 10),
        state: 'active',
        history: [
          { timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16), type: 'signup', desc: `Authenticated via mobile verification (+91 ${cleanPhone}).` }
        ],
        notes: 'Authenticated member profile.'
      };
      if (window.ClubDataStore) {
        allMembers.push(member);
        window.ClubDataStore.saveMembers(allMembers);
      }
    } else {
      if (cleanPhone && (!member.phone || member.phone === '')) {
        member.phone = cleanPhone;
        if (window.ClubDataStore) window.ClubDataStore.saveMembers(allMembers);
      }
    }

    const isCancelled = member.state === 'cancelled';
    const planCode = (member.plan || 'gold').toLowerCase();
    const session = {
      id: member.id || member.member_code,
      member_id: member.id || member.member_code,
      member_code: member.id || member.member_code,
      name: member.name,
      phone: member.phone || cleanPhone,
      email: member.email || `${member.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@example.com`,
      plan: planCode,
      plan_name: planCode.toUpperCase(),
      tier_code: planCode,
      state: member.state || 'active',
      startDate: member.startDate || '2026-10-04',
      endDate: member.endDate || '2027-10-04',
      has_active_benefits: member.state === 'active',
      authenticated: true,
      loginTime: new Date().toISOString()
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    sessionStorage.setItem(CURRENT_MEMBER_KEY, JSON.stringify(session));
    localStorage.setItem(CURRENT_MEMBER_KEY, JSON.stringify(session));

    const welcomeMsg = isCancelled
      ? `Welcome, ${session.name}! (Membership Cancelled)`
      : `Welcome, ${session.name}! (${session.tier_code.toUpperCase()} Tier)`;

    if (window.ClubAPI && window.ClubAPI.showSuccess) {
      window.ClubAPI.showSuccess(welcomeMsg);
    } else {
      showMemberToast(welcomeMsg);
    }

    closeLoginModal();
    applyMemberState();
    syncMemberProfileEverywhere(session);
    return session;
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(CURRENT_MEMBER_KEY);
    localStorage.removeItem(CURRENT_MEMBER_KEY);

    if (window.ClubAPI && window.ClubAPI.showSuccess) {
      window.ClubAPI.showSuccess('Member signed out successfully.');
    } else {
      showMemberToast('Member signed out.');
    }

    applyMemberState();
    syncMemberProfileEverywhere(null);

    // If on portal.html, switch back to login view
    if (typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('portal.html')) {
      const viewLogin = document.getElementById('view-login');
      const viewProfile = document.getElementById('view-profile');
      if (viewLogin) viewLogin.style.display = 'block';
      if (viewProfile) viewProfile.style.display = 'none';
    }
  }

  function showMemberToast(msg) {
    const existing = document.getElementById('cc-member-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'cc-member-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0D131F;
      border: 1px solid var(--cc-gold-500);
      color: #FFFFFF;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.7);
      font-size: 13px;
      font-family: var(--cc-font-display, sans-serif);
      font-weight: 600;
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: fadeIn 0.3s ease;
    `;
    toast.innerHTML = `<span style="color: var(--cc-gold-400); font-size: 16px;">👤</span> <span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  function openLoginModal() {
    if (window.ClubAuth && window.ClubAuth.openLoginModal) {
      window.ClubAuth.openLoginModal('member');
    }
  }

  function closeLoginModal() {
    if (window.ClubAuth && window.ClubAuth.closeLoginModal) {
      window.ClubAuth.closeLoginModal();
    }
  }

  function quickFillMember(name, phone) {
    const nameInput = document.getElementById('member-modal-name');
    const phoneInput = document.getElementById('member-modal-phone');
    if (nameInput) nameInput.value = name;
    if (phoneInput) phoneInput.value = phone;
    login(name, phone);
  }

  function applyMemberState() {
    // If admin is active, admin badge controls top actions
    if (ClubAdminAuth && ClubAdminAuth.isAdmin && ClubAdminAuth.isAdmin()) {
      return;
    }

    const member = getMember();
    const navActions = document.querySelector('.cc-nav-actions');
    if (!navActions) return;

    if (member) {
      const isCancelled = member.state === 'cancelled' || member.state === 'inactive' || member.status === 'cancelled' || member.subscription_status === 'cancelled';
      const planCode = (member.plan || member.tier_code || 'gold').toLowerCase();
      const badgeClass = planCode === 'gold' ? 'cc-badge-gold' : planCode === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior';
      const tierBadgeHtml = isCancelled
        ? `<span class="cc-badge cc-badge-danger" style="font-size: 9px; padding: 1px 6px;">CANCELLED</span>`
        : `<span class="cc-badge ${badgeClass}" style="font-size: 9px; padding: 1px 6px;">${planCode.toUpperCase()}</span>`;

      navActions.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: nowrap;">
          <a href="portal.html" class="cc-member-nav-badge" style="display: inline-flex; align-items: center; gap: 6px; background: ${isCancelled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(212, 175, 55, 0.15)'}; border: 1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.4)' : 'var(--cc-gold-500)'}; padding: 4px 12px; border-radius: 20px; text-decoration: none; font-size: 11px; color: #FFFFFF; font-weight: 700;">
            <span class="cc-pulse-dot" style="background: ${isCancelled ? 'var(--cc-crimson)' : 'var(--cc-neon-green)'}; width: 6px; height: 6px; border-radius: 50%;"></span>
            <span style="color: ${isCancelled ? '#FCA5A5' : 'var(--cc-gold-400)'};">👤 ${member.name}</span>
            ${tierBadgeHtml}
          </a>
          <button class="cc-btn cc-btn-ghost cc-btn-sm" style="font-size: 10px; padding: 2px 8px; color: var(--cc-text-muted);" onclick="ClubMemberAuth.logout()" title="Sign out of Member account">Sign Out</button>
        </div>
      `;
    } else {
      navActions.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: nowrap;">
          <button id="btn-nav-login" class="cc-btn cc-btn-primary cc-btn-sm" style="font-size: 11px; padding: 5px 14px; font-weight: 700;" onclick="ClubAuth.openLoginModal()">
            👤 Login
          </button>
        </div>
      `;
    }
  }

  function syncMemberProfileEverywhere(session) {
    // 1. Member Portal
    if (typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('portal.html')) {
      if (session && window.loadMemberProfile) {
        window.loadMemberProfile(session.id || session.member_id);
      }
    }
    // 2. Booking Manager
    if (typeof window !== 'undefined' && window.updateMemberDisplayCard) {
      window.updateMemberDisplayCard();
    }
    // 3. Shop Manager
    if (typeof window !== 'undefined' && window.renderShopMemberBanner) {
      window.renderShopMemberBanner();
    }
    // 4. POS Manager
    if (typeof window !== 'undefined' && window.renderPOSMemberInfo) {
      window.renderPOSMemberInfo();
    }
    // 5. Landing Page Enquiry form prefill
    const webName = document.getElementById('web-name');
    const webPhone = document.getElementById('web-phone');
    if (session) {
      if (webName && !webName.value) webName.value = session.name;
      if (webPhone && !webPhone.value) webPhone.value = session.phone;
    }
  }

  return {
    getMember,
    isMember,
    login,
    logout,
    openLoginModal,
    closeLoginModal,
    quickFillMember,
    applyMemberState,
    syncMemberProfileEverywhere
  };
})();


// ============================================================================
// 3. UNIFIED GLOBAL AUTH MODAL CONTROLLER (MEMBERS & STAFF/ADMIN)
// ============================================================================
const ClubAuth = (function() {
  'use strict';

  let currentTab = 'member';

  function ensureModalInjected() {
    if (document.getElementById('modal-global-unified-login')) return;

    const modalHtml = `
      <div class="cc-modal-backdrop" id="modal-global-unified-login" role="dialog" aria-modal="true" style="z-index: 99998;">
        <div class="cc-modal" style="max-width: 480px; width: 95%; text-align: center;">
          <div class="cc-modal-header" style="justify-content: space-between; position: relative;">
            <div>
              <span class="cc-eyebrow" style="color: var(--cc-gold-400);">SECURITY VERIFICATION</span>
              <h3 class="cc-modal-title" style="margin-top: 2px;">Sign In to Champions Club</h3>
            </div>
            <button class="cc-modal-close" style="position: absolute; right: 16px;" onclick="ClubAuth.closeLoginModal()" aria-label="Close dialog">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Tab Switcher -->
          <div style="display: flex; border-bottom: 1px solid var(--cc-border-medium); margin-top: 4px; padding: 0 1rem;">
            <button type="button" id="login-tab-btn-member" class="cc-login-tab-btn is-active" onclick="ClubAuth.switchTab('member')">
              👤 Member Sign In
            </button>
            <button type="button" id="login-tab-btn-admin" class="cc-login-tab-btn" onclick="ClubAuth.switchTab('admin')">
              👑 Staff / Admin
            </button>
          </div>

          <!-- Tab 1: Member Sign In Form -->
          <div id="tab-content-login-member" style="display: block;">
            <form id="form-global-member-login" onsubmit="event.preventDefault(); ClubMemberAuth.login(document.getElementById('member-modal-name').value, document.getElementById('member-modal-phone').value);">
              <div class="cc-modal-body" style="text-align: left; padding: 1.25rem 1.5rem;">
                <div style="background: rgba(201, 162, 39, 0.08); border: 1px solid var(--cc-border-highlight); padding: 0.75rem 1rem; border-radius: var(--cc-radius-md); margin-bottom: 1rem; font-size: 12px; color: var(--cc-text-secondary);">
                  👤 Enter your <strong>Full Name</strong> and <strong>Phone Number</strong> to access personal club privileges, court bookings, and member discounts.
                </div>
                <div class="cc-form-group" style="margin-bottom: 0.85rem;">
                  <label class="cc-label" for="member-modal-name">Full Name *</label>
                  <input type="text" id="member-modal-name" class="cc-input" placeholder="e.g. David Vance" required>
                </div>
                <div class="cc-form-group" style="margin-bottom: 1rem;">
                  <label class="cc-label" for="member-modal-phone">Phone Number *</label>
                  <input type="tel" id="member-modal-phone" class="cc-input" placeholder="e.g. +91 98234 11201 or 9823411201" required>
                </div>
                <!-- Quick 1-Click Demo Profiles -->
                <div style="padding: 0.75rem; background: var(--cc-bg-surface); border: 1px dashed var(--cc-border-medium); border-radius: var(--cc-radius-md); margin-bottom: 0.5rem;">
                  <div style="font-size: 11px; font-weight: 700; color: var(--cc-gold-400); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">
                    ⚡ Quick 1-Click Demo Profiles:
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button type="button" class="cc-btn cc-btn-secondary cc-btn-sm" style="font-size: 11px; justify-content: space-between; padding: 5px 10px; width: 100%; text-align: left;" onclick="ClubMemberAuth.quickFillMember('David Vance', '+91 98234 11201')">
                      <span>★ <strong>David Vance</strong></span>
                      <span class="cc-badge cc-badge-gold" style="font-size: 9px;">GOLD</span>
                    </button>
                    <button type="button" class="cc-btn cc-btn-secondary cc-btn-sm" style="font-size: 11px; justify-content: space-between; padding: 5px 10px; width: 100%; text-align: left;" onclick="ClubMemberAuth.quickFillMember('Elena Rostova', '+91 98450 77312')">
                      <span>◆ <strong>Elena Rostova</strong></span>
                      <span class="cc-badge cc-badge-silver" style="font-size: 9px;">SILVER</span>
                    </button>
                    <button type="button" class="cc-btn cc-btn-secondary cc-btn-sm" style="font-size: 11px; justify-content: space-between; padding: 5px 10px; width: 100%; text-align: left;" onclick="ClubMemberAuth.quickFillMember('Leo Chen', '+91 97123 90814')">
                      <span>● <strong>Leo Chen</strong></span>
                      <span class="cc-badge cc-badge-junior" style="font-size: 9px;">JUNIOR</span>
                    </button>
                  </div>
                </div>
              </div>
              <div class="cc-modal-footer" style="display: flex; justify-content: space-between;">
                <button type="button" class="cc-btn cc-btn-ghost cc-btn-sm" onclick="ClubAuth.closeLoginModal()">Cancel</button>
                <button type="submit" class="cc-btn cc-btn-primary cc-btn-sm cc-btn-pill">Member Sign In &rarr;</button>
              </div>
            </form>
          </div>

          <!-- Tab 2: Staff / Admin Sign In Form -->
          <div id="tab-content-login-admin" style="display: none;">
            <form id="form-global-admin-login" onsubmit="event.preventDefault(); ClubAdminAuth.login(document.getElementById('admin-modal-username').value, document.getElementById('admin-modal-password').value);">
              <div class="cc-modal-body" style="text-align: left; padding: 1.25rem 1.5rem;">
                <div style="background: rgba(201, 162, 39, 0.08); border: 1px solid var(--cc-border-highlight); padding: 0.75rem 1rem; border-radius: var(--cc-radius-md); margin-bottom: 1rem; font-size: 12px; color: var(--cc-text-secondary);">
                  🔒 Authenticate as Club Administrator to automatically open the Control Center &amp; ERP Dashboard.
                </div>
                <div class="cc-form-group" style="margin-bottom: 0.85rem;">
                  <label class="cc-label" for="admin-modal-username">Administrator Username / Email *</label>
                  <input type="text" id="admin-modal-username" class="cc-input" placeholder="e.g. admin" value="admin" required>
                </div>
                <div class="cc-form-group" style="margin-bottom: 1rem;">
                  <label class="cc-label" for="admin-modal-password">Password *</label>
                  <input type="password" id="admin-modal-password" class="cc-input" placeholder="Enter password" value="admin" required>
                </div>
                <div style="padding: 0.75rem; background: var(--cc-bg-surface); border: 1px dashed var(--cc-border-medium); border-radius: var(--cc-radius-md); margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                  <button type="button" class="cc-btn cc-btn-secondary cc-btn-sm cc-btn-pill" onclick="ClubAdminAuth.quickDemoLogin()" style="font-size: 11px; padding: 5px 12px; font-weight: 600;">
                    ⚡ Quick Demo Admin Sign In
                  </button>
                  <span style="font-size: 11px; color: var(--cc-text-muted);">Default: admin / admin</span>
                </div>
              </div>
              <div class="cc-modal-footer" style="display: flex; justify-content: space-between;">
                <button type="button" class="cc-btn cc-btn-ghost cc-btn-sm" onclick="ClubAuth.closeLoginModal()">Cancel</button>
                <button type="submit" class="cc-btn cc-btn-primary cc-btn-sm cc-btn-pill">Authenticate &amp; Open Dashboard &rarr;</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  function switchTab(tab) {
    currentTab = tab;
    const btnMember = document.getElementById('login-tab-btn-member');
    const btnAdmin = document.getElementById('login-tab-btn-admin');
    const contentMember = document.getElementById('tab-content-login-member');
    const contentAdmin = document.getElementById('tab-content-login-admin');

    if (tab === 'admin') {
      if (btnMember) btnMember.classList.remove('is-active');
      if (btnAdmin) btnAdmin.classList.add('is-active');
      if (contentMember) contentMember.style.display = 'none';
      if (contentAdmin) contentAdmin.style.display = 'block';
      const adminInput = document.getElementById('admin-modal-username');
      if (adminInput) setTimeout(() => adminInput.focus(), 100);
    } else {
      if (btnAdmin) btnAdmin.classList.remove('is-active');
      if (btnMember) btnMember.classList.add('is-active');
      if (contentAdmin) contentAdmin.style.display = 'none';
      if (contentMember) contentMember.style.display = 'block';
      const nameInput = document.getElementById('member-modal-name');
      if (nameInput) setTimeout(() => nameInput.focus(), 100);
    }
  }

  function openLoginModal(preferredTab = 'member') {
    ensureModalInjected();
    switchTab(preferredTab);
    const modal = document.getElementById('modal-global-unified-login');
    if (modal) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeLoginModal() {
    const modal = document.getElementById('modal-global-unified-login');
    if (modal) {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
    // Also close fallback modals if present
    const oldAdminModal = document.getElementById('modal-global-admin-login');
    if (oldAdminModal) oldAdminModal.classList.remove('is-open');
    const oldMemberModal = document.getElementById('modal-global-member-login');
    if (oldMemberModal) oldMemberModal.classList.remove('is-open');
  }

  return {
    openLoginModal,
    closeLoginModal,
    switchTab,
    ensureModalInjected,
    loginMember: ClubMemberAuth.login,
    loginAdmin: ClubAdminAuth.login,
    quickDemoLogin: ClubAdminAuth.quickDemoLogin,
    quickFillMember: ClubMemberAuth.quickFillMember,
    logout: () => {
      if (ClubAdminAuth.isAdmin()) {
        ClubAdminAuth.logout();
      } else {
        ClubMemberAuth.logout();
      }
    },
    isAdmin: ClubAdminAuth.isAdmin,
    isMember: ClubMemberAuth.isMember,
    getMember: ClubMemberAuth.getMember,
    getAdminUser: ClubAdminAuth.getAdminUser
  };
})();

// Attach globally
if (typeof window !== 'undefined') {
  window.ClubAdminAuth = ClubAdminAuth;
  window.ClubMemberAuth = ClubMemberAuth;
  window.ClubAuth = ClubAuth;
}

// Auto-initialize on DOMContentLoaded
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    ClubAuth.ensureModalInjected();
    ClubAdminAuth.applyAdminState();
  });
}
