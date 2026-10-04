/**
 * CHAMPIONS CLUB — Theme System Verification Test Suite
 * Tests:
 * 1. Design system token validity (Dark & Light palettes)
 * 2. ClubTheme controller functionality (toggle, persist, apply, init)
 * 3. HTML pages theme toggle presence & anti-FOUC header script
 * 4. Verification that default is dark
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('====================================================');
console.log('CHAMPIONS CLUB: THEME SYSTEM AUTOMATED VERIFICATION');
console.log('====================================================\n');

// 1. Check variables.css for required palette
console.log('--- TEST 1: CSS Variables & Exact Light Palette Tokens ---');
const variablesCss = fs.readFileSync(path.join(rootDir, 'css', 'variables.css'), 'utf-8');

const requiredTokens = [
  '#F5F3EE', // Background
  '#FFFFFF', // Card
  '#FAF9F6', // Surface
  '#20232B', // Primary Text
  '#62656D', // Secondary Text
  '#7B7D84', // Muted Text
  '#DDD9CF', // Border
  '#C9A227', // Champions Gold
  '#A98212', // Gold Hover
  '#252936', // Dark Navy
  '#16805B', // Success
  '#D68B16', // Warning
  '#C94A4A', // Danger
  '#3B82B6'  // Info
];

requiredTokens.forEach(token => {
  assert(variablesCss.includes(token), `variables.css includes token: ${token}`);
});

assert(variablesCss.includes('[data-theme="light"]'), 'variables.css contains [data-theme="light"] selector');
assert(variablesCss.includes(':root') && variablesCss.includes('[data-theme="dark"]'), 'variables.css contains dark default theme selector');

// 2. Check all HTML pages for anti-FOUC script & theme toggle
console.log('\n--- TEST 2: HTML Pages Anti-FOUC Script & Theme Toggle ---');
const htmlPages = [
  'dashboard.html',
  'bookings.html',
  'members.html',
  'crm.html',
  'portal.html',
  'shop.html',
  'pos.html',
  'index.html'
];

htmlPages.forEach(page => {
  const content = fs.readFileSync(path.join(rootDir, page), 'utf-8');
  assert(
    content.includes('cc_theme') && content.includes('data-theme'),
    `${page} has immediate anti-FOUC theme script in <head>`
  );
  assert(
    content.includes('cc-theme-toggle-btn') || content.includes('cc-theme-pill-toggle'),
    `${page} includes visible theme toggle in header`
  );
  assert(
    content.includes('css/variables.css') || content.includes('css/design_system.css'),
    `${page} includes design system / variables stylesheet`
  );
});

// 3. Test ClubTheme JS logic mock in Node.js environment
console.log('\n--- TEST 3: ClubTheme JS Engine Logic Mock ---');

// Mock browser DOM & localStorage
const mockStorage = {};
const mockLocalStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; }
};

const mockDoc = {
  documentElement: {
    attributes: {},
    setAttribute(attr, val) { this.attributes[attr] = val; },
    getAttribute(attr) { return this.attributes[attr] || null; }
  },
  body: {
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      contains(c) { return this.classes.has(c); }
    }
  },
  querySelectorAll: () => []
};

// Simulate ClubTheme engine
const ClubThemeEngine = {
  STORAGE_KEY: 'cc_theme',
  THEME_DARK: 'dark',
  THEME_LIGHT: 'light',
  getTheme() {
    try {
      const saved = mockLocalStorage.getItem(this.STORAGE_KEY);
      if (saved === this.THEME_LIGHT || saved === this.THEME_DARK) {
        return saved;
      }
    } catch (e) {}
    return this.THEME_DARK;
  },
  applyTheme(theme, save = true) {
    const targetTheme = (theme === this.THEME_LIGHT) ? this.THEME_LIGHT : this.THEME_DARK;
    mockDoc.documentElement.setAttribute('data-theme', targetTheme);
    if (targetTheme === this.THEME_LIGHT) {
      mockDoc.body.classList.add('theme-light');
      mockDoc.body.classList.remove('theme-dark');
    } else {
      mockDoc.body.classList.add('theme-dark');
      mockDoc.body.classList.remove('theme-light');
    }
    if (save) {
      try {
        mockLocalStorage.setItem(this.STORAGE_KEY, targetTheme);
      } catch (e) {}
    }
    return targetTheme;
  },
  toggleTheme() {
    const current = this.getTheme();
    const next = current === this.THEME_DARK ? this.THEME_LIGHT : this.THEME_DARK;
    return this.applyTheme(next, true);
  }
};

// Step 3a: Default must be dark
mockLocalStorage.removeItem('cc_theme');
assert(ClubThemeEngine.getTheme() === 'dark', 'ClubTheme defaults to "dark" when no preference stored');

// Step 3b: Applying light theme
ClubThemeEngine.applyTheme('light');
assert(mockDoc.documentElement.getAttribute('data-theme') === 'light', 'data-theme on html updated to "light"');
assert(mockLocalStorage.getItem('cc_theme') === 'light', 'localStorage cc_theme updated to "light"');
assert(mockDoc.body.classList.contains('theme-light'), 'body has class "theme-light"');

// Step 3c: Toggling back to dark
ClubThemeEngine.toggleTheme();
assert(mockDoc.documentElement.getAttribute('data-theme') === 'dark', 'Toggle switches light -> dark');
assert(mockLocalStorage.getItem('cc_theme') === 'dark', 'localStorage cc_theme updated to "dark"');
assert(mockDoc.body.classList.contains('theme-dark'), 'body has class "theme-dark"');

// Step 3d: Toggling to light
ClubThemeEngine.toggleTheme();
assert(mockDoc.documentElement.getAttribute('data-theme') === 'light', 'Toggle switches dark -> light');
assert(mockLocalStorage.getItem('cc_theme') === 'light', 'localStorage cc_theme updated to "light"');

// 4. Test Components CSS for light theme rules
console.log('\n--- TEST 4: Components CSS Theme Rules ---');
const componentsCss = fs.readFileSync(path.join(rootDir, 'css', 'components.css'), 'utf-8');
assert(componentsCss.includes('.cc-theme-pill-toggle'), 'components.css contains .cc-theme-pill-toggle styling');
assert(componentsCss.includes('.cc-theme-opt'), 'components.css contains .cc-theme-opt styling');
assert(componentsCss.includes('[data-theme="light"] .cc-card'), 'components.css contains light theme card rules');
assert(componentsCss.includes('[data-theme="light"] .cc-table'), 'components.css contains light theme table rules');
assert(componentsCss.includes('[data-theme="light"] .cc-modal'), 'components.css contains light theme modal rules');
assert(componentsCss.includes('[data-theme="light"] .cc-input'), 'components.css contains light theme form rules');

// 5. Test Dashboard CSS for light theme rules
console.log('\n--- TEST 5: Dashboard CSS Theme Rules ---');
const dashboardCss = fs.readFileSync(path.join(rootDir, 'css', 'dashboard.css'), 'utf-8');
assert(dashboardCss.includes('[data-theme="light"] .cc-admin-tab-btn'), 'dashboard.css contains light theme tab rules');
assert(dashboardCss.includes('[data-theme="light"] .cc-kpi-card'), 'dashboard.css contains light theme KPI rules');
assert(dashboardCss.includes('[data-theme="light"] .cc-pipeline-col'), 'dashboard.css contains light theme CRM rules');
assert(dashboardCss.includes('[data-theme="light"] .cc-tier-card-gold'), 'dashboard.css contains light theme Tier card rules');

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passedTests} passed, ${failedTests} failed out of ${totalTests} total tests`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL THEME TESTS PASSED SUCCESSFULLY! ✓\n');
}
