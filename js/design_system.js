/**
 * CHAMPIONS CLUB — Design System Interactive Component & Theme Controller
 * Provides interactive behaviors for modals, mobile nav, demo states, and dual-theme switching (Dark <-> Light).
 */

// ============================================================================
// 1. DUAL-THEME SWITCHER CONTROLLER (DARK <-> LIGHT)
// ============================================================================
const ClubTheme = (function() {
  'use strict';
  const THEME_KEY = 'cc_theme';

  function getTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || 'dark';
    } catch (e) {
      return 'dark';
    }
  }

  function applyTheme(theme, smooth = true) {
    const validTheme = (theme === 'light') ? 'light' : 'dark';
    if (!smooth) {
      document.documentElement.classList.add('cc-theme-no-transition');
    }

    document.documentElement.setAttribute('data-theme', validTheme);
    if (document.body) {
      document.body.setAttribute('data-theme', validTheme);
    }

    try {
      localStorage.setItem(THEME_KEY, validTheme);
    } catch (e) {}

    updateToggleButtons(validTheme);

    if (!smooth) {
      // Force reflow and remove no-transition class
      void document.documentElement.offsetHeight;
      document.documentElement.classList.remove('cc-theme-no-transition');
    }

    window.dispatchEvent(new CustomEvent('cc-theme-change', { detail: { theme: validTheme } }));
  }

  function toggleTheme() {
    const current = getTheme();
    const next = (current === 'light') ? 'dark' : 'light';
    applyTheme(next, true);
    return next;
  }

  function updateToggleButtons(theme) {
    const isLight = (theme === 'light');

    // Update compact buttons
    document.querySelectorAll('.cc-theme-toggle-btn, [data-cc-theme-toggle]').forEach(btn => {
      btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
      btn.setAttribute('title', isLight ? 'Switch to Dark Mode (Currently Light)' : 'Switch to Light Mode (Currently Dark)');
      btn.classList.toggle('is-light', isLight);
      btn.classList.toggle('is-dark', !isLight);
      
      const label = btn.querySelector('.cc-theme-toggle-label');
      if (label) {
        label.textContent = isLight ? 'Light' : 'Dark';
      }
      const icon = btn.querySelector('.cc-theme-toggle-icon');
      if (icon) {
        icon.textContent = isLight ? '☀️' : '🌙';
      }
    });

    // Update pill-style segmented toggles
    document.querySelectorAll('.cc-theme-pill-toggle').forEach(pill => {
      pill.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
      pill.setAttribute('title', isLight ? 'Switch to Dark Mode (Currently Light)' : 'Switch to Light Mode (Currently Dark)');
      const optDark = pill.querySelector('.cc-theme-opt-dark');
      const optLight = pill.querySelector('.cc-theme-opt-light');
      if (optDark) optDark.classList.toggle('is-active', !isLight);
      if (optLight) optLight.classList.toggle('is-active', isLight);
    });
  }

  function init() {
    const current = getTheme();
    applyTheme(current, false);

    // Bind all theme toggles present in the DOM
    document.querySelectorAll('.cc-theme-toggle-btn, .cc-theme-pill-toggle, [data-cc-theme-toggle]').forEach(btn => {
      if (!btn.dataset.themeBound) {
        btn.dataset.themeBound = 'true';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          toggleTheme();
        });
      }
    });
  }

  return {
    getTheme,
    applyTheme,
    toggleTheme,
    updateToggleButtons,
    init
  };
})();

// Attach globally
if (typeof window !== 'undefined') {
  window.ClubTheme = ClubTheme;
}

// Immediate initial execution to prevent flash of wrong theme
(function() {
  try {
    const saved = localStorage.getItem('cc_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  } catch (e) {}
})();

// ============================================================================
// 2. DOM INTERACTION & COMPONENT HANDLERS
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Theme System
  ClubTheme.init();

  // 1. Mobile Navigation Toggle
  const navToggle = document.getElementById('cc-nav-toggle');
  const navbar = document.querySelector('.cc-navbar');

  if (navToggle && navbar) {
    navToggle.addEventListener('click', () => {
      navbar.classList.toggle('is-mobile-open');
    });
  }

  // 2. Modal Open / Close Handlers
  const modalBackdrop = document.getElementById('demo-modal-backdrop');
  const openModalBtns = document.querySelectorAll('[data-cc-modal-target]');
  const closeModalBtns = document.querySelectorAll('[data-cc-modal-close]');

  openModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-cc-modal-target');
      const targetModal = document.getElementById(targetId);
      if (targetModal) {
        targetModal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const parentModal = btn.closest('.cc-modal-backdrop');
      if (parentModal) {
        parentModal.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
  });

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        modalBackdrop.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
  }

  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.cc-modal-backdrop.is-open');
      if (openModal) {
        openModal.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    }
  });

  // 3. Interactive Demo: Loading State Toggle
  const toggleLoadingBtn = document.getElementById('btn-toggle-loading-demo');
  if (toggleLoadingBtn) {
    toggleLoadingBtn.addEventListener('click', () => {
      const demoBtn = document.getElementById('demo-loading-btn');
      const skeletonGroup = document.getElementById('demo-skeleton-group');
      const contentGroup = document.getElementById('demo-content-group');

      if (demoBtn) {
        demoBtn.classList.toggle('is-loading');
      }

      if (skeletonGroup && contentGroup) {
        const isSkeletonVisible = skeletonGroup.style.display !== 'none';
        skeletonGroup.style.display = isSkeletonVisible ? 'none' : 'block';
        contentGroup.style.display = isSkeletonVisible ? 'block' : 'none';
      }
    });
  }

  // 4. Interactive Demo: Form Error State Toggle
  const toggleFormErrorBtn = document.getElementById('btn-toggle-error-demo');
  if (toggleFormErrorBtn) {
    toggleFormErrorBtn.addEventListener('click', () => {
      const demoInput = document.getElementById('demo-email-input');
      const demoErrorMsg = document.getElementById('demo-email-error');
      if (demoInput && demoErrorMsg) {
        demoInput.classList.toggle('is-error');
        demoErrorMsg.style.display = demoInput.classList.contains('is-error') ? 'flex' : 'none';
      }
    });
  }
});
