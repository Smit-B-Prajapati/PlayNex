/**
 * CHAMPIONS CLUB — Bar & Cafeteria POS Controller
 * Connected to Odoo Backend POS models (club.bar.table, club.bar.tab, club.bar.order)
 * with graceful fallback to synchronized ClubDataStore.
 * Handles table seating, DEMO DATA menu ordering, automatic member tier discounts,
 * running member tabs, multi-payment support (Cash, Card, UPI), and daily revenue reconciliation.
 */

// DEMO DATA - Menu Items (Explicitly labeled in accordance with DATA RULE)
const menuItems = [
  { id: 'm1', name: '[DEMO DATA] Post-Match Whey Protein Shake', cat: 'nutrition', price: 280 },
  { id: 'm2', name: '[DEMO DATA] Triple-Decker Club Sandwich', cat: 'food', price: 320 },
  { id: 'm3', name: '[DEMO DATA] Fresh Lime Mint Sparkling Soda', cat: 'beverage', price: 120 },
  { id: 'm4', name: '[DEMO DATA] Chilled Tender Coconut Water', cat: 'beverage', price: 90 },
  { id: 'm5', name: '[DEMO DATA] Artisan Roast Cappuccino', cat: 'beverage', price: 180 },
  { id: 'm6', name: '[DEMO DATA] Electrolyte Hydration Energy Drink', cat: 'nutrition', price: 150 },
  { id: 'm7', name: '[DEMO DATA] Grilled Chicken & Avocado Salad', cat: 'food', price: 360 }
];

// Member Discount Tiers
const memberTiers = {
  gold: { name: 'David Vance', tier: 'Gold', discount: 15 },
  silver: { name: 'Elena Rostova', tier: 'Silver', discount: 10 },
  junior: { name: 'Leo Chen', tier: 'Junior', discount: 5 },
  guest: { name: 'Walk-in Guest', tier: 'Guest', discount: 0 }
};

// State
let selectedTableId = 't1';
let currentMenuCategory = 'all';
let currentTicketItems = [];

async function getTables() {
  if (window.ClubAPI) {
    try {
      const tables = await window.ClubAPI.getBarTables();
      if (tables && tables.length > 0) return tables;
    } catch (e) {
      console.warn('API getBarTables fallback', e);
    }
  }
  if (window.ClubDataStore) {
    return window.ClubDataStore.getBarTables();
  }
  return [];
}

function saveTables(tables) {
  if (window.ClubDataStore) {
    window.ClubDataStore.saveBarTables(tables);
  }
}

async function getTabs() {
  if (window.ClubAPI) {
    try {
      const tabs = await window.ClubAPI.getBarTabs();
      if (tabs && tabs.length > 0) return tabs;
    } catch (e) {
      console.warn('API getBarTabs fallback', e);
    }
  }
  if (window.ClubDataStore) {
    return window.ClubDataStore.getBarTabs();
  }
  return [];
}

function saveTabs(tabs) {
  if (window.ClubDataStore) {
    window.ClubDataStore.saveBarTabs(tabs);
  }
}

function getRevenue() {
  if (window.ClubDataStore) {
    return window.ClubDataStore.getBarRevenue();
  }
  return { cash: 0, card: 0, upi: 0 };
}

function saveRevenue(rev) {
  if (window.ClubDataStore) {
    window.ClubDataStore.saveBarRevenue(rev);
  }
}

async function getTable(id) {
  const tables = await getTables();
  return tables.find(t => t.id === id || String(t.id) === String(id)) || tables[0];
}

async function renderTables() {
  const container = document.getElementById('table-buttons-container');
  if (!container) return;
  container.innerHTML = '';

  const tables = await getTables();
  const tabs = await getTabs();

  if (!tables || tables.length === 0) {
    container.innerHTML = '<p class="cc-body-xs" style="color: var(--cc-text-muted); padding: 10px;">No data available (0 tables configured).</p>';
    return;
  }

  tables.forEach(t => {
    // Check if table has an open tab
    const hasTab = tabs.some(tab => (tab.tableId === t.id || tab.table_id === t.id) && tab.state === 'open');
    t.state = hasTab ? 'occupied' : 'available';

    const btn = document.createElement('div');
    btn.className = `cc-table-pill-btn ${t.id === selectedTableId || String(t.id) === String(selectedTableId) ? 'is-active' : ''} ${t.state === 'occupied' ? 'is-occupied' : ''}`;
    btn.innerHTML = `
      <span>${t.name}</span>
      <span class="cc-badge ${t.state === 'available' ? 'cc-badge-active' : 'cc-badge-danger'}" style="font-size: 9px; padding: 2px 6px;">
        ${t.state === 'available' ? 'Free' : 'Occupied'}
      </span>
    `;

    btn.addEventListener('click', async () => {
      selectedTableId = t.id;
      await renderTables();
      await updateTicketHeader();
    });

    container.appendChild(btn);
  });

  saveTables(tables);
}

function renderMenuItems() {
  const container = document.getElementById('menu-items-container');
  if (!container) return;
  container.innerHTML = '';

  const filtered = menuItems.filter(m => {
    if (currentMenuCategory !== 'all' && m.cat !== currentMenuCategory) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="cc-body-xs" style="color: var(--cc-text-muted); padding: 1rem;">No data available.</p>';
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'cc-menu-item-card';
    card.innerHTML = `
      <div style="font-size: 13px; font-weight: 700; color: var(--cc-text-primary);">${item.name}</div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
        <span class="cc-text-mono" style="font-weight: 800; color: var(--cc-gold-400);">₹ ${item.price}</span>
        <button class="cc-btn cc-btn-primary cc-btn-sm cc-btn-pill" style="padding: 4px 10px; font-size: 11px;">+ Add</button>
      </div>
    `;
    card.addEventListener('click', () => {
      addItemToTicket(item);
    });
    container.appendChild(card);
  });
}

function addItemToTicket(item) {
  const existing = currentTicketItems.find(i => i.id === item.id);
  if (existing) {
    existing.qty++;
  } else {
    currentTicketItems.push({
      id: item.id,
      name: item.name,
      price: item.price,
      qty: 1
    });
  }
  renderTicket();
}

function renderTicket() {
  const container = document.getElementById('ticket-items-container');
  if (!container) return;

  if (currentTicketItems.length === 0) {
    container.innerHTML = '<p class="cc-body-xs" style="color: var(--cc-text-muted); padding: 10px 0;">No data available on ticket. Click items from the menu.</p>';
  } else {
    container.innerHTML = '';
    currentTicketItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cc-cart-item';
      div.innerHTML = `
        <div style="max-width: 170px;">
          <div style="font-weight: 700; color: var(--cc-text-primary); font-size: 12px;">${item.name}</div>
          <div class="cc-text-mono" style="font-size: 11px; color: var(--cc-text-muted);">₹ ${item.price} &times; ${item.qty}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button class="cc-btn cc-btn-secondary" style="padding: 2px 6px; font-size: 10px; height: 20px;" onclick="changeTicketQty('${item.id}', -1)">-</button>
          <span class="cc-text-mono" style="font-weight: 800; font-size: 12px;">${item.qty}</span>
          <button class="cc-btn cc-btn-secondary" style="padding: 2px 6px; font-size: 10px; height: 20px;" onclick="changeTicketQty('${item.id}', 1)">+</button>
        </div>
      `;
      container.appendChild(div);
    });
  }

  // Calculate Subtotal & Automatic Member Discount
  const subtotal = currentTicketItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const memberKey = document.getElementById('pos-customer-select')?.value || 'gold';
  const memberInfo = memberTiers[memberKey] || memberTiers.guest;
  const discountPercent = memberInfo.discount;
  const discountAmount = (subtotal * discountPercent) / 100.0;
  const totalDue = subtotal - discountAmount;

  document.getElementById('ticket-subtotal').textContent = `₹ ${subtotal.toFixed(2)}`;
  document.getElementById('ticket-disc-label').textContent = `Member Discount (${discountPercent}%):`;
  document.getElementById('ticket-discount').textContent = `- ₹ ${discountAmount.toFixed(2)}`;
  document.getElementById('ticket-total').textContent = `₹ ${totalDue.toFixed(2)}`;
}

window.changeTicketQty = function(itemId, delta) {
  const existing = currentTicketItems.find(i => i.id === itemId);
  if (!existing) return;

  existing.qty += delta;
  if (existing.qty <= 0) {
    currentTicketItems = currentTicketItems.filter(i => i.id !== itemId);
  }
  renderTicket();
};

async function updateTicketHeader() {
  const table = await getTable(selectedTableId);
  const badge = document.getElementById('ticket-table-badge');
  if (badge && table) badge.textContent = table.name;
}

function updateKPIs() {
  const revenueLedger = getRevenue();
  const total = (revenueLedger.cash || 0) + (revenueLedger.card || 0) + (revenueLedger.upi || 0);
  const kpiDaily = document.getElementById('kpi-daily-total');
  if (kpiDaily) {
    if (total === 0) {
      kpiDaily.textContent = 'No data available';
      kpiDaily.classList.add('no-data');
    } else {
      kpiDaily.textContent = `₹ ${total.toLocaleString()}`;
      kpiDaily.classList.remove('no-data');
    }
  }
  document.getElementById('kpi-cash-total').textContent = `₹ ${(revenueLedger.cash || 0).toLocaleString()}`;
  document.getElementById('kpi-card-total').textContent = `₹ ${(revenueLedger.card || 0).toLocaleString()}`;
  document.getElementById('kpi-upi-total').textContent = `₹ ${(revenueLedger.upi || 0).toLocaleString()}`;
}

async function renderActiveTabs() {
  const tbody = document.getElementById('active-tabs-body');
  const badge = document.getElementById('active-tabs-count-badge');
  if (!tbody) return;
  tbody.innerHTML = '';

  const activeTabs = await getTabs();
  const openTabs = activeTabs.filter(t => t.state === 'open');
  if (badge) badge.textContent = `${openTabs.length} Open Tab${openTabs.length === 1 ? '' : 's'}`;

  if (openTabs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--cc-text-muted); padding: 1.5rem;">No data available (0 open member tabs).</td></tr>';
    return;
  }

  openTabs.forEach(tab => {
    const items = tab.items || [];
    const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0) || (tab.amount_subtotal || 0);
    const disc = (subtotal * (tab.discountPercent || tab.discount_percent || 0)) / 100.0 || (tab.amount_discount || 0);
    const totalDue = tab.amount_total || (subtotal - disc);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="cc-text-mono" style="font-weight: 800; color: var(--cc-gold-400);">${tab.id || tab.name}</div>
        <div style="font-size: 13px; font-weight: 700; color: var(--cc-text-primary);">${tab.memberName || tab.member_name}</div>
      </td>
      <td>
        <span class="cc-badge cc-badge-silver">${tab.tableName || tab.table_name || 'Counter'}</span>
      </td>
      <td>
        <span class="cc-text-mono" style="color: var(--cc-gold-400); font-weight: 700;">${tab.discountPercent || tab.discount_percent || 0}%</span>
      </td>
      <td>${items.length > 0 ? items.reduce((s, i) => s + i.qty, 0) : 'Active'} Items</td>
      <td class="cc-text-mono" style="font-weight: 800; color: var(--cc-neon-green);">₹ ${Number(totalDue).toFixed(2)}</td>
      <td style="text-align: right;">
        <div style="display: inline-flex; gap: 4px;">
          <button class="cc-btn cc-btn-secondary cc-btn-sm" onclick="settleTabAction('${tab.id || tab.name}', 'cash')" style="padding: 3px 8px; font-size: 10px;">Cash</button>
          <button class="cc-btn cc-btn-secondary cc-btn-sm" onclick="settleTabAction('${tab.id || tab.name}', 'card')" style="padding: 3px 8px; font-size: 10px;">Card</button>
          <button class="cc-btn cc-btn-primary cc-btn-sm" onclick="settleTabAction('${tab.id || tab.name}', 'upi')" style="padding: 3px 8px; font-size: 10px;">UPI</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.settleTabAction = async function(tabId, paymentMethod) {
  if (window.ClubAPI) {
    try {
      await window.ClubAPI.settleBarTab(tabId, paymentMethod);
    } catch (e) {
      console.warn('Backend settle fallback', e);
    }
  }

  const activeTabs = await getTabs();
  const tab = activeTabs.find(t => t.id === tabId || String(t.id) === String(tabId) || t.name === tabId);
  if (!tab || tab.state !== 'open') return;

  const items = tab.items || [];
  const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0) || (tab.amount_subtotal || 0);
  const disc = (subtotal * (tab.discountPercent || tab.discount_percent || 0)) / 100.0;
  const totalDue = tab.amount_total || (subtotal - disc);

  tab.state = 'closed';
  tab.paymentMethod = paymentMethod;

  const revenueLedger = getRevenue();
  revenueLedger[paymentMethod] = (revenueLedger[paymentMethod] || 0) + totalDue;

  saveTabs(activeTabs);
  saveRevenue(revenueLedger);

  await renderTables();
  await renderActiveTabs();
  updateKPIs();
  if (window.ClubAPI) {
    window.ClubAPI.showSuccess(`Tab ${tab.id || tab.name} settled via ${paymentMethod.toUpperCase()} (₹ ${totalDue.toFixed(2)}). Table freed.`);
  }
};

window.processDirectPayment = function(method) {
  if (currentTicketItems.length === 0) {
    if (window.ClubAPI) {
      window.ClubAPI.showError("Ticket is empty. Please add items before taking payment.", "Empty Ticket");
    } else {
      alert("Ticket is empty. Please add items before taking payment.");
    }
    return;
  }

  const subtotal = currentTicketItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const memberKey = document.getElementById('pos-customer-select').value;
  const memberInfo = memberTiers[memberKey] || memberTiers.guest;
  const discountAmount = (subtotal * memberInfo.discount) / 100.0;
  const totalDue = subtotal - discountAmount;

  const revenueLedger = getRevenue();
  revenueLedger[method] = (revenueLedger[method] || 0) + totalDue;
  saveRevenue(revenueLedger);

  currentTicketItems = [];

  renderTicket();
  updateKPIs();
  if (window.ClubAPI) {
    window.ClubAPI.showSuccess(`Payment of ₹ ${totalDue.toFixed(2)} received via ${method.toUpperCase()}. Order complete!`);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await renderTables();
  renderMenuItems();
  renderTicket();
  await renderActiveTabs();
  updateKPIs();

  // Menu Category Filter Pills
  const catPills = document.querySelectorAll('#bar-menu-filters .cc-filter-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      currentMenuCategory = pill.getAttribute('data-cat');
      renderMenuItems();
    });
  });

  // Customer Select Change
  const custSelect = document.getElementById('pos-customer-select');
  const discText = document.getElementById('discount-indicator-text');
  if (custSelect) {
    custSelect.addEventListener('change', () => {
      const key = custSelect.value;
      const info = memberTiers[key] || memberTiers.guest;
      if (discText) {
        discText.textContent = info.discount > 0 
          ? `✨ ${info.discount}% discount automatically applied from ${info.tier} Tier.`
          : 'Standard pricing applied (Guest / Non-member).';
      }
      renderTicket();
    });
  }

  // Charge to Member Tab Button
  const btnChargeTab = document.getElementById('btn-charge-to-tab');
  if (btnChargeTab) {
    btnChargeTab.addEventListener('click', async () => {
      if (currentTicketItems.length === 0) {
        if (window.ClubAPI) window.ClubAPI.showError("Ticket is empty. Add menu items first.", "Empty Ticket");
        return;
      }

      const memberKey = custSelect.value;
      if (memberKey === 'guest') {
        if (window.ClubAPI) window.ClubAPI.showError("Running tabs are available exclusively for registered Club Members.", "Member Tab Restricted");
        return;
      }

      const table = await getTable(selectedTableId);
      const memberInfo = memberTiers[memberKey] || memberTiers.gold;
      const activeTabs = await getTabs();

      // Check if existing open tab for member
      let existingTab = activeTabs.find(t => t.memberKey === memberKey && t.state === 'open');
      if (existingTab) {
        existingTab.items.push(...currentTicketItems);
      } else {
        const newTabId = `CC-TAB-000${activeTabs.length + 1}`;
        activeTabs.unshift({
          id: newTabId,
          memberKey: memberKey,
          memberName: `${memberInfo.name} (${memberInfo.tier})`,
          tableId: table.id,
          tableName: table.name,
          discountPercent: memberInfo.discount,
          items: [...currentTicketItems],
          state: 'open'
        });
      }

      saveTabs(activeTabs);
      currentTicketItems = [];

      renderTicket();
      await renderTables();
      await renderActiveTabs();
      if (window.ClubAPI) {
        window.ClubAPI.showSuccess(`Items successfully charged to running tab for ${memberInfo.name}.`);
      }
    });
  }

  // Daily Revenue Report Modal
  const btnReport = document.getElementById('btn-open-daily-report');
  const modalReport = document.getElementById('modal-daily-revenue');
  if (btnReport && modalReport) {
    btnReport.addEventListener('click', () => {
      const revenueLedger = getRevenue();
      const total = (revenueLedger.cash || 0) + (revenueLedger.card || 0) + (revenueLedger.upi || 0);
      document.getElementById('report-cash').textContent = `₹ ${(revenueLedger.cash || 0).toFixed(2)}`;
      document.getElementById('report-card').textContent = `₹ ${(revenueLedger.card || 0).toFixed(2)}`;
      document.getElementById('report-upi').textContent = `₹ ${(revenueLedger.upi || 0).toFixed(2)}`;
      document.getElementById('report-total').textContent = `₹ ${total.toFixed(2)}`;

      modalReport.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  }
});
