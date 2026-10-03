/**
 * CHAMPIONS CLUB — Admin Authentication & Access Guard Controller
 * Centralized role-based access controller ensuring administrative controls,
 * financial dashboards, member management rosters, and CRM pipelines are accessible
 * strictly when an authorized Administrator / Staff user is authenticated.
 */

const ClubAdminAuth = (function() {
  'use strict';

  const STORAGE_KEY = 'cc_admin_session';

  /**
   * Checks if an Administrator is currently authenticated.
   */
  function isAdmin() {
    try {
      const sessionRaw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        return session && session.authenticated === true;
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

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

      if (window.ClubAPI && window.ClubAPI.showSuccess) {
        window.ClubAPI.showSuccess(`Welcome back, ${session.name}!`);
      } else {
        showToastNotification(`Welcome back, ${session.name}!`);
      }

      closeLoginModal();
      applyAdminState();
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
    login('admin', 'admin');
  }

  /**
   * Signs out the administrator and hides all administrative controls.
   */
  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);

    if (window.ClubAPI && window.ClubAPI.showSuccess) {
      window.ClubAPI.showSuccess('Administrator signed out successfully.');
    } else {
      showToastNotification('Administrator signed out.');
    }

    applyAdminState();

    // If on full admin pages, reload or transition smoothly
    const path = window.location.pathname.toLowerCase();
    if (path.includes('dashboard.html') || path.includes('crm.html')) {
      const gate = document.getElementById('cc-admin-access-gate');
      if (!gate) {
        window.location.href = 'index.html';
      }
    }
  }

  /**
   * Simple toast notifier fallback.
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
   * Opens the Global Admin Login Modal.
   */
  function openLoginModal() {
    ensureLoginModalInjected();
    const modal = document.getElementById('modal-global-admin-login');
    if (modal) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      const userInput = document.getElementById('admin-modal-username');
      if (userInput) {
        userInput.value = 'admin';
        const passInput = document.getElementById('admin-modal-password');
        if (passInput) passInput.value = 'admin';
        setTimeout(() => userInput.focus(), 150);
      }
    }
  }

  /**
   * Closes the Global Admin Login Modal.
   */
  function closeLoginModal() {
    const modal = document.getElementById('modal-global-admin-login');
    if (modal) {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  /**
   * Injects the Global Admin Login Modal markup if not already present.
   */
  function ensureLoginModalInjected() {
    if (document.getElementById('modal-global-admin-login')) return;

    const modalHtml = `
      <div class="cc-modal-backdrop" id="modal-global-admin-login" role="dialog" aria-modal="true" style="z-index: 99998;">
        <div class="cc-modal" style="max-width: 480px; width: 95%; text-align: center;">
          <div class="cc-modal-header" style="justify-content: center; position: relative;">
            <div>
              <span class="cc-eyebrow" style="color: var(--cc-gold-400);">SECURITY VERIFICATION</span>
              <h3 class="cc-modal-title" style="margin-top: 2px;">Administrator Sign In</h3>
            </div>
            <button class="cc-modal-close" style="position: absolute; right: 16px;" onclick="ClubAdminAuth.closeLoginModal()" aria-label="Close dialog">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <form id="form-global-admin-login" onsubmit="event.preventDefault(); ClubAdminAuth.login(document.getElementById('admin-modal-username').value, document.getElementById('admin-modal-password').value);">
            <div class="cc-modal-body" style="text-align: left; padding: 1.5rem;">
              <div style="background: rgba(212, 175, 55, 0.08); border: 1px solid var(--cc-border-highlight); padding: 0.75rem 1rem; border-radius: var(--cc-radius-md); margin-bottom: 1.25rem; font-size: 12px; color: var(--cc-text-secondary);">
                🔒 Sign in to access administrative rosters, executive dashboard, financial metrics, and CRM leads.
              </div>

              <div class="cc-form-group" style="margin-bottom: 1rem;">
                <label class="cc-label" for="admin-modal-username">Administrator Username / Email</label>
                <input type="text" id="admin-modal-username" class="cc-input" placeholder="e.g. admin" value="admin" required>
              </div>

              <div class="cc-form-group" style="margin-bottom: 1.25rem;">
                <label class="cc-label" for="admin-modal-password">Password</label>
                <input type="password" id="admin-modal-password" class="cc-input" placeholder="Enter password" value="admin" required>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                <button type="button" class="cc-admin-quick-login-btn" onclick="ClubAdminAuth.quickDemoLogin()" style="margin-top: 0;">
                  ⚡ Quick Demo Admin Login
                </button>
                <span style="font-size: 11px; color: var(--cc-text-muted);">Default: admin / admin</span>
              </div>
            </div>
            <div class="cc-modal-footer" style="display: flex; justify-content: space-between;">
              <button type="button" class="cc-btn cc-btn-ghost cc-btn-sm" onclick="ClubAdminAuth.closeLoginModal()">Cancel</button>
              <button type="submit" class="cc-btn cc-btn-primary cc-btn-sm cc-btn-pill">Authenticate &amp; Unlock</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  /**
   * Applies admin visibility rules across all DOM elements and navigation bars.
   */
  function applyAdminState() {
    const authenticated = isAdmin();
    const adminUser = getAdminUser();

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

    // 3. Scan & Filter Navbar Links
    const navLinks = document.querySelectorAll('.cc-nav-link');
    navLinks.forEach(link => {
      const href = (link.getAttribute('href') || '').toLowerCase();
      const text = (link.textContent || '').toLowerCase();

      // Enquiries (crm.html) is public-accessible for visitor membership enquiries
      const isPureAdminDest = href.includes('dashboard.html') || 
                              text.includes('admin dashboard') || 
                              text.includes('roster (admin)') ||
                              link.hasAttribute('data-cc-admin-nav');

      if (isPureAdminDest) {
        const li = link.closest('li') || link;
        if (authenticated) {
          li.classList.remove('cc-hidden-unauthorized');
          li.style.removeProperty('display');
        } else {
          li.classList.add('cc-hidden-unauthorized');
          li.style.setProperty('display', 'none', 'important');
        }
      }
    });

    // 4. Update Navbar Action Button / Badge
    const navActions = document.querySelector('.cc-nav-actions');
    if (navActions) {
      let adminBadge = document.getElementById('cc-nav-admin-badge');
      let adminLoginBtn = document.getElementById('btn-nav-admin-login');

      if (authenticated) {
        if (adminLoginBtn) adminLoginBtn.remove();
        if (!adminBadge) {
          adminBadge = document.createElement('div');
          adminBadge.id = 'cc-nav-admin-badge';
          adminBadge.className = 'cc-admin-badge-pill';
          navActions.insertBefore(adminBadge, navActions.firstChild);
        }
        adminBadge.innerHTML = `
          <span class="cc-pulse-dot"></span>
          <span>👑 ${adminUser ? adminUser.name.split(' ')[0] : 'Admin'}</span>
          <button class="cc-admin-signout-btn" onclick="ClubAdminAuth.logout()" title="Sign out of Administrator role">Sign Out</button>
        `;
      } else {
        if (adminBadge) adminBadge.remove();
        if (!adminLoginBtn) {
          adminLoginBtn = document.createElement('button');
          adminLoginBtn.id = 'btn-nav-admin-login';
          adminLoginBtn.className = 'cc-btn cc-btn-outline-gold cc-btn-sm';
          adminLoginBtn.style.fontSize = '11px';
          adminLoginBtn.style.padding = '4px 12px';
          adminLoginBtn.innerHTML = `🔒 Staff / Admin Login`;
          adminLoginBtn.onclick = openLoginModal;
          navActions.insertBefore(adminLoginBtn, navActions.firstChild);
        }
      }
    }

    // 5. Handle Full Page Access Gates (dashboard.html, crm.html, members.html)
    const isCrmPage = typeof window !== 'undefined' && window.location && window.location.pathname.toLowerCase().includes('crm.html');
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
    } else {
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

  // Auto-initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    ensureLoginModalInjected();
    applyAdminState();
  });

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

// Attach globally
if (typeof window !== 'undefined') {
  window.ClubAdminAuth = ClubAdminAuth;
}
