/**
 * CHAMPIONS CLUB — Design System Interactive Component Controller
 * Provides interactive behaviors for modals, mobile nav, and demo state toggles.
 */

document.addEventListener('DOMContentLoaded', () => {
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
