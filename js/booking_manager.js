/**
 * CHAMPIONS CLUB — Court Booking Controller
 * Manages dynamic 1-3 hour sessions, slot validation, double-booking prevention,
 * daily limits (max 2/member/day), plan-dependent rates, and instant cancellation slot release.
 * Communicates with real Odoo backend endpoints via ClubAPI.
 */

let courts = [
  { id: '1', name: 'Tennis Court 1 (Clay)', sport: 'tennis', walkinRate: 500 },
  { id: '2', name: 'Tennis Court 2 (Hard)', sport: 'tennis', walkinRate: 500 },
  { id: '3', name: 'Cricket Pitch & Net 1 (Turf)', sport: 'cricket', walkinRate: 600 },
  { id: '4', name: 'Cricket Practice Net 2', sport: 'cricket', walkinRate: 600 },
  { id: '5', name: 'Badminton Court 1 (Indoor Mat)', sport: 'badminton', walkinRate: 400 },
  { id: '6', name: 'Badminton Court 2 (Indoor Mat)', sport: 'badminton', walkinRate: 400 }
];

// Dynamic Member Profiles Retrieval
function getDynamicMembers() {
  let rawMembers = [];
  if (typeof window !== 'undefined' && window.ClubDataStore) {
    rawMembers = window.ClubDataStore.getMembers() || [];
  }
  if (!rawMembers || rawMembers.length === 0) {
    rawMembers = [
      { id: 'CC-MEM-00101', name: 'David Vance', plan: 'gold', state: 'active' },
      { id: 'CC-MEM-00102', name: 'Elena Rostova', plan: 'silver', state: 'active' },
      { id: 'CC-MEM-00103', name: 'Leo Chen', plan: 'junior', state: 'active' },
      { id: 'CC-MEM-00104', name: 'Vikram Mehta', plan: 'silver', state: 'expired' }
    ];
  }

  return rawMembers.map(m => {
    const planCode = (m.plan || 'gold').toLowerCase();
    const isExpired = m.state === 'expired' || m.state === 'cancelled';
    let rate = 0.0;
    let rateLabel = 'Free (Gold Tier Entitlement)';

    if (isExpired) {
      rate = 500.0;
      rateLabel = '₹ 500.00 / hr (Expired - Standard Rate)';
    } else if (planCode === 'gold') {
      rate = 0.0;
      rateLabel = 'Free (Gold Tier Entitlement)';
    } else if (planCode === 'silver') {
      rate = 300.0;
      rateLabel = '₹ 300.00 / hr (Silver Member Rate)';
    } else if (planCode === 'junior') {
      rate = 200.0;
      rateLabel = '₹ 200.00 / hr (Junior Youth Rate)';
    }

    return {
      id: m.id || m.member_code,
      name: m.name,
      plan: planCode,
      state: m.state || 'active',
      rate: rate,
      rateLabel: rateLabel
    };
  });
}

function getCurrentMember() {
  const members = getDynamicMembers();
  let session = null;
  if (typeof window !== 'undefined') {
    if (window.ClubMemberAuth && window.ClubMemberAuth.getMember) {
      session = window.ClubMemberAuth.getMember();
    }
    if (!session) {
      const raw = sessionStorage.getItem('cc_portal_member') || localStorage.getItem('cc_portal_member') ||
                  sessionStorage.getItem('cc_current_member') || localStorage.getItem('cc_current_member');
      if (raw) {
        try { session = JSON.parse(raw); } catch (e) {}
      }
    }
  }

  if (session) {
    const sessionCode = session.member_id || session.id || session.member_code;
    const found = members.find(m => m.id === sessionCode || (session.name && m.name.toLowerCase() === session.name.toLowerCase()));
    if (found) return found;

    // If dynamic member was just registered
    const planCode = (session.plan || session.tier_code || 'gold').toLowerCase();
    const isCancelled = session.state === 'cancelled' || session.state === 'expired' || session.state === 'inactive';
    return {
      id: session.id || session.member_code || 'CC-MEM-00101',
      name: session.name,
      plan: isCancelled ? 'none' : planCode,
      state: session.state || 'active',
      rate: isCancelled ? 500.0 : (planCode === 'gold' ? 0.0 : planCode === 'silver' ? 300.0 : 200.0),
      rateLabel: isCancelled ? '₹ 500.00 / hr (Expired - Standard Rate)' : (planCode === 'gold' ? 'Free (Gold Tier Entitlement)' : planCode === 'silver' ? '₹ 300.00 / hr (Silver Member Rate)' : '₹ 200.00 / hr (Junior Youth Rate)')
    };
  }

  const explicitId = document.getElementById('booking-member-id')?.value;
  if (explicitId) {
    const found = members.find(m => m.id === explicitId);
    if (found) return found;
  }

  // Default to first active member
  const activeMem = members.find(m => m.state === 'active') || members[0];
  return activeMem;
}

function getMemberMaxBookingHours() {
  const isWalkin = document.getElementById('radio-party-walkin')?.checked;
  if (isWalkin) {
    return 1;
  }

  const member = getCurrentMember();
  if (!member || member.state === 'cancelled' || member.state === 'expired' || member.state === 'inactive') {
    return 1;
  }

  if (window.ClubDataStore && window.ClubDataStore.getMaxBookingHours) {
    return window.ClubDataStore.getMaxBookingHours(member.plan);
  }

  const plan = (member.plan || 'gold').toLowerCase();
  if (plan === 'gold') return 3;
  if (plan === 'silver') return 2;
  if (plan === 'junior') return 1;
  return 1;
}

function updateMemberDisplayCard() {
  const member = getCurrentMember();
  if (!member) return;

  const idEl = document.getElementById('member-card-id');
  const nameEl = document.getElementById('member-card-name');
  const tierBadgeEl = document.getElementById('member-card-tier-badge');
  const stateEl = document.getElementById('member-card-state');
  const rateLabelEl = document.getElementById('member-card-rate-label');
  const hiddenInput = document.getElementById('booking-member-id');

  if (idEl) idEl.textContent = member.id;
  if (nameEl) nameEl.textContent = member.name;
  if (hiddenInput) hiddenInput.value = member.id;

  const isCancelled = member.state === 'cancelled' || member.state === 'inactive' || member.state === 'expired';

  if (tierBadgeEl) {
    if (isCancelled) {
      tierBadgeEl.style.display = 'none';
    } else {
      tierBadgeEl.style.display = 'inline-flex';
      const planUpper = (member.plan || 'gold').toUpperCase();
      const badgeClass = member.plan === 'gold' ? 'cc-badge-gold' : member.plan === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior';
      tierBadgeEl.className = `cc-badge ${badgeClass}`;
      tierBadgeEl.textContent = `★ ${planUpper} TIER`;
    }
  }

  if (stateEl) {
    stateEl.className = `cc-badge ${member.state === 'active' ? 'cc-badge-active' : 'cc-badge-danger'}`;
    stateEl.textContent = member.state.toUpperCase();
  }

  if (rateLabelEl) {
    rateLabelEl.textContent = member.rateLabel;
  }

  // Adjust duration if current selected duration exceeds newly selected member's plan limit
  const maxHours = getMemberMaxBookingHours();
  if (selectedDuration > maxHours) {
    selectedDuration = 1;
  }

  updateFormSummary();
}

function renderSwitchMembersList(filterText = '') {
  const container = document.getElementById('switch-members-list');
  if (!container) return;
  container.innerHTML = '';

  const members = getDynamicMembers();
  const filtered = members.filter(m => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.plan.toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="color: var(--cc-text-muted); font-size: 12px; padding: 1rem; text-align: center;">No registered members found.</div>';
    return;
  }

  const current = getCurrentMember();

  filtered.forEach(m => {
    const isCurrent = current && current.id === m.id;
    const isCancelled = m.state === 'cancelled' || m.state === 'expired' || m.state === 'inactive';
    const planClass = m.plan === 'gold' ? 'cc-badge-gold' : m.plan === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior';
    const planBadgeHtml = isCancelled
      ? `<span class="cc-badge cc-badge-danger" style="font-size: 9px; padding: 1px 5px;">${m.state.toUpperCase()}</span>`
      : `<span class="cc-badge ${planClass}" style="font-size: 9px; padding: 1px 5px;">${m.plan.toUpperCase()}</span>`;

    const item = document.createElement('div');
    item.className = 'cc-card cc-card-glass';
    item.style.cssText = `
      padding: 10px 14px;
      cursor: pointer;
      border-color: ${isCurrent ? 'var(--cc-gold-500)' : 'var(--cc-border-medium)'};
      background: ${isCurrent ? 'rgba(212, 175, 55, 0.12)' : 'rgba(22, 29, 46, 0.6)'};
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all var(--cc-transition-fast);
    `;

    item.innerHTML = `
      <div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <strong style="color: var(--cc-text-primary); font-size: 14px;">${m.name}</strong>
          ${planBadgeHtml}
        </div>
        <div class="cc-text-mono" style="font-size: 11px; color: var(--cc-gold-400);">${m.id} &bull; <span style="color: var(--cc-text-muted);">${m.rateLabel}</span></div>
      </div>
      <div>
        ${isCurrent ? '<span class="cc-badge cc-badge-active" style="font-size: 10px;">Active</span>' : '<button type="button" class="cc-btn cc-btn-secondary cc-btn-sm" style="font-size: 11px; padding: 3px 10px;">Select</button>'}
      </div>
    `;

    item.addEventListener('click', () => {
      const hiddenInput = document.getElementById('booking-member-id');
      if (hiddenInput) hiddenInput.value = m.id;
      if (window.ClubMemberAuth) {
        window.ClubMemberAuth.login(m.name, m.phone || '+91 98234 11201');
      } else {
        sessionStorage.setItem('cc_portal_member', JSON.stringify({
          member_id: m.id,
          member_code: m.id,
          name: m.name,
          plan_name: m.plan.toUpperCase(),
          tier_code: m.plan,
          state: m.state
        }));
      }
      updateMemberDisplayCard();
      const modal = document.getElementById('modal-switch-member');
      if (modal) modal.classList.remove('is-open');
      document.body.style.overflow = '';
    });

    container.appendChild(item);
  });
}

let bookingsData = (window.ClubDataStore && window.ClubDataStore.getBookings) ? window.ClubDataStore.getBookings() : [
  {
    id: 'CC-BK-0001',
    courtId: '1',
    courtName: 'Tennis Court 1 (Clay)',
    sport: 'tennis',
    date: '2026-10-03',
    startTime: '18:00',
    endTime: '19:00',
    durationHours: 1,
    bookingType: 'member',
    memberId: 'CC-MEM-00101',
    playerName: 'David Vance (Gold)',
    rateApplied: '₹ 0.00 (Free)',
    isSocial: false,
    state: 'confirmed'
  },
  {
    id: 'CC-BK-0002',
    courtId: '3',
    courtName: 'Cricket Pitch & Net 1 (Turf)',
    sport: 'cricket',
    date: '2026-10-03',
    startTime: '17:00',
    endTime: '18:00',
    durationHours: 1,
    bookingType: 'walkin',
    memberId: null,
    playerName: 'Rahul Sharma (Walk-in)',
    rateApplied: '₹ 600.00',
    isSocial: false,
    state: 'confirmed'
  }
];

let selectedCourtId = '1';
let selectedDate = '2026-10-03';
let selectedSlotTime = '18:00';
let selectedDuration = 1;
let currentSportFilter = 'all';

// Generate 1-hour dedicated slots from 06:00 to 24:00 (midnight)
function generateTimeSlots() {
  const slots = [];
  for (let hour = 6; hour <= 23; hour++) {
    const hh = String(hour).padStart(2, '0');
    slots.push(`${hh}:00`);
  }
  return slots;
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 24 && m === 0) return '00:00';
  return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Checks if a candidate 1-hour slot (startMins to startMins + 60) overlaps with an existing booking
function checkSlotOverlap(courtId, date, slotTimeStr) {
  const startMins = timeToMinutes(slotTimeStr);
  const endMins = startMins + 60;

  for (const b of bookingsData) {
    if (String(b.courtId) === String(courtId) && b.date === date && b.state === 'confirmed' && !b.isSocial) {
      let bStart = timeToMinutes(b.startTime);
      let bEnd = timeToMinutes(b.endTime);
      if (bEnd === 0 && b.endTime === '00:00') bEnd = 1440;

      // Overlap formula: start < bEnd AND end > bStart
      if (startMins < bEnd && endMins > bStart) {
        return { isOverlap: true, booking: b };
      }
    }
  }
  return { isOverlap: false, booking: null };
}

// Check availability for all consecutive 1-hour intervals for a multi-hour session
function checkConsecutiveIntervals(courtId, date, startSlotTime, durationHours) {
  const startMins = timeToMinutes(startSlotTime);
  const intervals = [];
  let allAvailable = true;
  let firstConflict = null;

  for (let i = 0; i < durationHours; i++) {
    const intStartMins = startMins + (i * 60);
    const intEndMins = intStartMins + 60;
    const intStartTime = minutesToTime(intStartMins);
    const intEndTime = minutesToTime(intEndMins);

    if (intStartMins >= 1440) {
      allAvailable = false;
      intervals.push({
        index: i + 1,
        start: intStartTime,
        end: intEndTime,
        isAvailable: false,
        booking: { id: 'CLOSED', state: 'closed' }
      });
      continue;
    }

    const overlap = checkSlotOverlap(courtId, date, intStartTime);
    if (overlap.isOverlap) {
      allAvailable = false;
      if (!firstConflict) {
        firstConflict = {
          interval: `${intStartTime}–${intEndTime}`,
          booking: overlap.booking
        };
      }
      intervals.push({
        index: i + 1,
        start: intStartTime,
        end: intEndTime,
        isAvailable: false,
        booking: overlap.booking
      });
    } else {
      intervals.push({
        index: i + 1,
        start: intStartTime,
        end: intEndTime,
        isAvailable: true,
        booking: null
      });
    }
  }

  return {
    allAvailable,
    intervals,
    firstConflict
  };
}

async function renderSlots() {
  const container = document.getElementById('slots-container');
  if (!container) return;
  container.innerHTML = '';

  const allSlots = generateTimeSlots();

  allSlots.forEach(slot => {
    const endSlot = minutesToTime(timeToMinutes(slot) + 60);
    const overlapInfo = checkSlotOverlap(selectedCourtId, selectedDate, slot);

    const btn = document.createElement('div');
    btn.className = 'cc-slot-btn';

    if (overlapInfo.isOverlap) {
      btn.classList.add('is-occupied');
      btn.innerHTML = `
        <span class="cc-slot-time">${slot} - ${endSlot}</span>
        <span class="cc-slot-status" style="color: var(--cc-crimson); font-weight: 700;">Booked (${overlapInfo.booking.id})</span>
      `;
    } else {
      if (slot === selectedSlotTime) {
        btn.classList.add('is-selected');
      }
      btn.innerHTML = `
        <span class="cc-slot-time">${slot} - ${endSlot}</span>
        <span class="cc-slot-status" style="color: var(--cc-neon-green);">Available (1 Hr)</span>
      `;
      btn.addEventListener('click', () => {
        selectedSlotTime = slot;
        renderSlots();
        updateFormSummary();
      });
    }

    container.appendChild(btn);
  });
}

function renderDurationOptions() {
  const container = document.getElementById('duration-buttons-container');
  const badge = document.getElementById('duration-tier-limit-badge');
  if (!container) return;
  container.innerHTML = '';

  const maxHours = getMemberMaxBookingHours();
  const isWalkin = document.getElementById('radio-party-walkin')?.checked;
  const currentMember = getCurrentMember();
  const planName = isWalkin ? 'Walk-in' : (currentMember ? currentMember.plan.toUpperCase() : 'Gold');

  if (badge) {
    badge.textContent = `Max: ${maxHours} Hour${maxHours > 1 ? 's' : ''} (${planName})`;
  }

  // Ensure selectedDuration does not exceed max allowed
  if (selectedDuration > maxHours) {
    selectedDuration = 1;
  }

  for (let h = 1; h <= maxHours; h++) {
    const check = checkConsecutiveIntervals(selectedCourtId, selectedDate, selectedSlotTime, h);
    const isAvailable = check.allAvailable;
    const isSelected = selectedDuration === h;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cc-btn cc-btn-sm ${isSelected ? 'cc-btn-primary' : 'cc-btn-secondary'}`;
    btn.style.cssText = `
      flex: 1;
      min-width: 90px;
      font-weight: 700;
      transition: all var(--cc-transition-fast);
      position: relative;
    `;

    if (!isAvailable) {
      btn.disabled = true;
      btn.className = 'cc-btn cc-btn-secondary cc-btn-sm is-disabled';
      btn.style.cssText += `
        opacity: 0.5;
        border-color: rgba(239, 68, 68, 0.4);
        background: rgba(30, 20, 20, 0.4);
        cursor: not-allowed;
      `;
      btn.innerHTML = `${h} Hour${h > 1 ? 's' : ''} &#128274;`;
      btn.title = `${h}-hour booking unavailable because one or more required slots are already booked.`;
    } else {
      btn.innerHTML = `${h} Hour${h > 1 ? 's' : ''}`;
      btn.title = `${h}-hour consecutive booking available`;
      btn.addEventListener('click', () => {
        selectedDuration = h;
        updateFormSummary();
      });
    }

    container.appendChild(btn);
  }
}

function renderAvailabilityPreview() {
  const container = document.getElementById('preview-intervals-list');
  const statusBadge = document.getElementById('preview-overall-status-badge');
  const submitBtn = document.getElementById('btn-submit-booking');

  if (!container) return;
  container.innerHTML = '';

  const check = checkConsecutiveIntervals(selectedCourtId, selectedDate, selectedSlotTime, selectedDuration);

  if (statusBadge) {
    if (check.allAvailable) {
      statusBadge.className = 'cc-badge cc-badge-active';
      statusBadge.innerHTML = `&#10003; ${selectedDuration}-hour booking available`;
    } else {
      statusBadge.className = 'cc-badge cc-badge-danger';
      statusBadge.innerHTML = `&#10005; ${selectedDuration}-hour booking unavailable`;
    }
  }

  check.intervals.forEach(int => {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 8px;
      border-radius: var(--cc-radius-sm);
      background: ${int.isAvailable ? 'rgba(0, 229, 153, 0.08)' : 'rgba(239, 68, 68, 0.12)'};
      border: 1px solid ${int.isAvailable ? 'rgba(0, 229, 153, 0.25)' : 'rgba(239, 68, 68, 0.35)'};
    `;

    row.innerHTML = `
      <span class="cc-text-mono" style="color: var(--cc-text-primary); font-weight: 600;">
        ${int.start} &ndash; ${int.end}
      </span>
      <span class="cc-badge ${int.isAvailable ? 'cc-badge-active' : 'cc-badge-danger'}" style="font-size: 10px; font-weight: 700;">
        ${int.isAvailable ? 'AVAILABLE' : `BOOKED (${int.booking ? int.booking.id : 'Conflict'})`}
      </span>
    `;

    container.appendChild(row);
  });

  // Enable/Disable Submit Button based on full interval availability
  if (submitBtn) {
    const isSocial = document.getElementById('booking-social-toggle')?.checked;
    if (check.allAvailable || isSocial) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
      submitBtn.title = '';
    } else {
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.45';
      submitBtn.style.cursor = 'not-allowed';
      submitBtn.title = 'Cannot confirm: one or more required slots are already booked.';
    }
  }
}

function updateFormSummary() {
  const court = courts.find(c => String(c.id) === String(selectedCourtId)) || courts[0];
  const startMins = timeToMinutes(selectedSlotTime);
  const endSlot = minutesToTime(startMins + (selectedDuration * 60));

  if (!court) return;

  document.getElementById('summary-court-name').textContent = court.name;
  document.getElementById('summary-time-window').textContent = `${selectedSlotTime} → ${endSlot} (${selectedDuration} Hr${selectedDuration > 1 ? 's' : ''})`;
  document.getElementById('form-selected-slot-badge').textContent = `${selectedSlotTime} - ${endSlot}`;

  const isMember = document.getElementById('radio-party-member')?.checked ?? true;
  if (isMember) {
    const profile = getCurrentMember();
    if (profile) {
      if (profile.plan === 'gold' && profile.state === 'active') {
        document.getElementById('summary-rate-amount').textContent = `Free (Gold Tier Entitlement &bull; ${selectedDuration} Hr${selectedDuration > 1 ? 's' : ''})`;
      } else if (profile.plan === 'silver' && profile.state === 'active') {
        const total = 300.0 * selectedDuration;
        document.getElementById('summary-rate-amount').textContent = `₹ ${total.toFixed(2)} (${selectedDuration} hrs @ ₹300/hr)`;
      } else if (profile.plan === 'junior' && profile.state === 'active') {
        const total = 200.0 * selectedDuration;
        document.getElementById('summary-rate-amount').textContent = `₹ ${total.toFixed(2)} (${selectedDuration} hr @ ₹200/hr)`;
      } else {
        const total = 500.0 * selectedDuration;
        document.getElementById('summary-rate-amount').textContent = `₹ ${total.toFixed(2)} (${selectedDuration} hrs @ ₹500/hr Standard)`;
      }
    }
  } else {
    const total = court.walkinRate * selectedDuration;
    document.getElementById('summary-rate-amount').textContent = `₹ ${total.toFixed(2)} (${selectedDuration} hrs @ ₹${court.walkinRate}/hr)`;
  }

  renderDurationOptions();
  renderAvailabilityPreview();
}

function renderAdminBookings() {
  const tbody = document.getElementById('admin-bookings-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchVal = (document.getElementById('admin-booking-search')?.value || '').toLowerCase().trim();

  const filtered = bookingsData.filter(b => {
    if (searchVal) {
      const matchRef = b.id.toLowerCase().includes(searchVal);
      const matchPlayer = b.playerName.toLowerCase().includes(searchVal);
      const matchCourt = b.courtName.toLowerCase().includes(searchVal);
      if (!matchRef && !matchPlayer && !matchCourt) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--cc-text-muted); padding: 2rem;">
          No data available
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(b => {
    const tr = document.createElement('tr');
    const durHours = b.durationHours || 1;
    tr.innerHTML = `
      <td>
        <div class="cc-text-mono" style="font-weight: 800; color: var(--cc-gold-400);">${b.id}</div>
        <div style="font-size: 11px; text-transform: uppercase; color: var(--cc-text-muted);">${b.sport}</div>
      </td>
      <td>
        <div style="font-weight: 700; color: var(--cc-text-primary);">${b.courtName}</div>
      </td>
      <td>
        <div style="font-size: 13px; color: var(--cc-text-primary);">${b.playerName}</div>
        <div style="font-size: 11px; color: var(--cc-text-muted);">${b.bookingType === 'member' ? 'Member Booking' : 'Walk-in Guest'}</div>
      </td>
      <td class="cc-text-mono" style="font-size: 13px;">
        ${b.date} &bull; <strong style="color: var(--cc-text-primary);">${b.startTime} - ${b.endTime}</strong>
      </td>
      <td>${durHours} Hour${durHours > 1 ? 's' : ''}</td>
      <td class="cc-text-mono" style="color: var(--cc-neon-green); font-weight: 700;">${b.rateApplied}</td>
      <td>
        <span class="cc-badge ${b.state === 'confirmed' ? 'cc-badge-active' : 'cc-badge-danger'}">
          ${b.state === 'confirmed' ? '<span class="cc-pulse-dot"></span> Confirmed' : 'Cancelled'}
        </span>
      </td>
      <td style="text-align: right;">
        ${b.state === 'confirmed' ? `
          <button class="cc-btn cc-btn-outline-gold cc-btn-sm" onclick="cancelBookingAction('${b.id}')" style="padding: 4px 10px; font-size: 11px; border-color: rgba(239, 68, 68, 0.4); color: #FCA5A5;">
            Cancel Slot
          </button>
        ` : '<span style="font-size: 12px; color: var(--cc-text-muted);">Released</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.cancelBookingAction = async function(bookingId) {
  try {
    if (window.ClubAPI) {
      await window.ClubAPI.cancelBooking(bookingId);
    }
  } catch (e) {
    console.warn('Backend cancel failed, using local fallback:', e.message);
  }
  const b = bookingsData.find(x => x.id === bookingId);
  if (b) {
    b.state = 'cancelled';
    if (window.ClubDataStore) {
      window.ClubDataStore.saveBookings(bookingsData);
    }
    renderSlots();
    renderDurationOptions();
    renderAvailabilityPreview();
    renderAdminBookings();
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (window.ClubDataStore && window.ClubDataStore.ensureSynced) {
    try {
      await window.ClubDataStore.ensureSynced();
    } catch (e) {}
  }

  // Load Courts from Backend API
  try {
    if (window.ClubAPI) {
      const liveCourts = await window.ClubAPI.getCourts();
      if (liveCourts && liveCourts.length > 0) {
        courts = liveCourts.map(c => ({
          id: String(c.id),
          name: c.name,
          sport: c.sport,
          walkinRate: c.walkin_rate || 500
        }));
      }
    }
  } catch (err) {
    console.warn('Could not fetch courts live, using stored defaults.');
  }

  updateMemberDisplayCard();
  renderSlots();
  updateFormSummary();
  renderAdminBookings();

  // Member Switch Button & Search Modal
  const btnSwitchMember = document.getElementById('btn-switch-member');
  const switchModal = document.getElementById('modal-switch-member');
  const switchSearch = document.getElementById('switch-member-search');

  if (btnSwitchMember && switchModal) {
    btnSwitchMember.addEventListener('click', () => {
      if (switchSearch) switchSearch.value = '';
      renderSwitchMembersList('');
      switchModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  }

  if (switchSearch) {
    switchSearch.addEventListener('input', (e) => {
      renderSwitchMembersList(e.target.value);
    });
  }

  // Court Dropdown Change
  const courtSelect = document.getElementById('booking-court-select');
  if (courtSelect) {
    courtSelect.addEventListener('change', (e) => {
      selectedCourtId = e.target.value;
      renderSlots();
      updateFormSummary();
    });
  }

  // Date Change
  const dateInput = document.getElementById('booking-date-input');
  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      selectedDate = e.target.value;
      renderSlots();
      updateFormSummary();
    });
  }

  // Sport Filter Pills
  const sportPills = document.querySelectorAll('.cc-court-filter-pill');
  sportPills.forEach(pill => {
    pill.addEventListener('click', () => {
      sportPills.forEach(p => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      const sport = pill.getAttribute('data-sport');
      
      // Filter court options
      if (courtSelect) {
        courtSelect.innerHTML = '';
        const matchingCourts = sport === 'all' ? courts : courts.filter(c => c.sport === sport);
        matchingCourts.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          courtSelect.appendChild(opt);
        });
        if (matchingCourts.length > 0) {
          selectedCourtId = matchingCourts[0].id;
          courtSelect.value = selectedCourtId;
        }
        renderSlots();
        updateFormSummary();
      }
    });
  });

  // Radio Booking Type Toggle
  const radioMember = document.getElementById('radio-party-member');
  const radioWalkin = document.getElementById('radio-party-walkin');
  const sectionMember = document.getElementById('section-member-select');
  const sectionWalkin = document.getElementById('section-walkin-fields');

  if (radioMember && radioWalkin) {
    radioMember.addEventListener('change', () => {
      sectionMember.style.display = 'block';
      sectionWalkin.style.display = 'none';
      updateFormSummary();
    });
    radioWalkin.addEventListener('change', () => {
      sectionMember.style.display = 'none';
      sectionWalkin.style.display = 'block';
      selectedDuration = 1;
      updateFormSummary();
    });
  }

  // Social Toggle
  const socialToggle = document.getElementById('booking-social-toggle');
  if (socialToggle) {
    socialToggle.addEventListener('change', () => {
      renderAvailabilityPreview();
    });
  }

  // Search Admin Bookings
  const adminSearch = document.getElementById('admin-booking-search');
  if (adminSearch) {
    adminSearch.addEventListener('input', renderAdminBookings);
  }

  // Form Submission & Live Rule Validation (Frontend -> Backend Validation -> DB Created -> Confirmation)
  const form = document.getElementById('court-booking-form');
  const errorBox = document.getElementById('booking-form-error');
  const errorTitle = document.getElementById('form-error-title');
  const errorMsg = document.getElementById('form-error-msg');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errorBox) errorBox.style.display = 'none';

      const isMember = radioMember.checked;
      const court = courts.find(c => String(c.id) === String(selectedCourtId));
      const isSocial = document.getElementById('booking-social-toggle').checked;
      const startMins = timeToMinutes(selectedSlotTime);
      const endTimeStr = minutesToTime(startMins + (selectedDuration * 60));

      let memberId = null;
      let playerName = '';
      let rateAppliedStr = '';

      if (isMember) {
        const profile = getCurrentMember();
        if (!profile) {
          if (errorBox) {
            errorTitle.textContent = "No Member Profile";
            errorMsg.textContent = "Please select or login as a registered club member.";
            errorBox.style.display = 'flex';
          }
          return;
        }
        memberId = profile.id;
        playerName = `${profile.name} (${profile.plan.toUpperCase()})`;

        if (profile.plan === 'gold' && profile.state === 'active') {
          rateAppliedStr = '₹ 0.00 (Free)';
        } else if (profile.plan === 'silver' && profile.state === 'active') {
          rateAppliedStr = `₹ ${(300 * selectedDuration).toFixed(2)}`;
        } else if (profile.plan === 'junior' && profile.state === 'active') {
          rateAppliedStr = `₹ ${(200 * selectedDuration).toFixed(2)}`;
        } else {
          rateAppliedStr = `₹ ${(500 * selectedDuration).toFixed(2)}`;
        }

        // RULE 1: Daily Limit Enforcement (Max 2 bookings per member per day)
        const memberDayCount = bookingsData.filter(b => 
          b.bookingType === 'member' && 
          b.memberId === memberId && 
          b.date === selectedDate && 
          b.state === 'confirmed'
        ).length;

        if (memberDayCount >= 2) {
          if (errorBox) {
            errorTitle.textContent = "Daily Play Limit Exceeded";
            errorMsg.textContent = `Member '${profile.name}' already has ${memberDayCount} active bookings on ${selectedDate}. Each member can play at most twice a day.`;
            errorBox.style.display = 'flex';
          }
          return;
        }

        // RULE 2: Max Booking Duration by Membership Tier
        const maxAllowed = getMemberMaxBookingHours();
        if (selectedDuration > maxAllowed) {
          if (errorBox) {
            errorTitle.textContent = "Duration Limit Exceeded";
            errorMsg.textContent = `Your ${profile.plan.toUpperCase()} membership plan allows a maximum booking duration of ${maxAllowed} hour${maxAllowed > 1 ? 's' : ''}.`;
            errorBox.style.display = 'flex';
          }
          return;
        }

      } else {
        const walkinName = document.getElementById('walkin-name-input').value.trim();
        if (!walkinName) {
          if (errorBox) {
            errorTitle.textContent = "Missing Walk-in Name";
            errorMsg.textContent = "Please enter the walk-in customer's full name.";
            errorBox.style.display = 'flex';
          }
          return;
        }
        playerName = `${walkinName} (Walk-in)`;
        rateAppliedStr = `₹ ${(court.walkinRate * selectedDuration).toFixed(2)}`;

        if (selectedDuration > 1) {
          if (errorBox) {
            errorTitle.textContent = "Duration Limit Exceeded";
            errorMsg.textContent = "Walk-in guests are restricted to a maximum 1-hour booking duration.";
            errorBox.style.display = 'flex';
          }
          return;
        }
      }

      // RULE 3: Double Booking Protection across ALL consecutive intervals
      if (!isSocial) {
        const check = checkConsecutiveIntervals(selectedCourtId, selectedDate, selectedSlotTime, selectedDuration);
        if (!check.allAvailable) {
          const conflict = check.firstConflict;
          if (errorBox) {
            errorTitle.textContent = "Consecutive Slot Conflict";
            errorMsg.textContent = `Cannot book ${selectedSlotTime}–${endTimeStr} because ${conflict ? conflict.interval : 'a required interval'} is already booked.`;
            errorBox.style.display = 'flex';
          }
          return;
        }
      }

      const startDateTimeStr = `${selectedDate} ${selectedSlotTime}:00`;

      try {
        // Real Backend ORM Creation
        let newRef = `CC-BK-${String(bookingsData.length + 1).padStart(4, '0')}`;
        if (window.ClubAPI) {
          const apiRes = await window.ClubAPI.createBooking({
            court_id: selectedCourtId,
            start_time: startDateTimeStr,
            duration_hours: selectedDuration,
            booking_type: isMember ? 'member' : 'walkin',
            member_id: isMember ? memberId : null,
            walkin_name: !isMember ? playerName : null,
            is_social_play: isSocial
          });
          if (apiRes && apiRes.reference) {
            newRef = apiRes.reference;
          }
        }

        const newBooking = {
          id: newRef,
          courtId: selectedCourtId,
          courtName: court.name,
          sport: court.sport,
          date: selectedDate,
          startTime: selectedSlotTime,
          endTime: endTimeStr,
          durationHours: selectedDuration,
          bookingType: isMember ? 'member' : 'walkin',
          memberId: memberId,
          playerName: playerName,
          rateApplied: rateAppliedStr,
          isSocial: isSocial,
          state: 'confirmed'
        };

        bookingsData.unshift(newBooking);
        if (window.ClubDataStore) {
          window.ClubDataStore.saveBookings(bookingsData);
        }

        // Refresh UI
        renderSlots();
        renderDurationOptions();
        renderAvailabilityPreview();
        renderAdminBookings();

        // Show Confirmation Modal
        const confirmModal = document.getElementById('modal-booking-confirmation');
        document.getElementById('confirm-modal-ref').textContent = newRef;
        document.getElementById('confirm-modal-court').textContent = court.name;
        document.getElementById('confirm-modal-time').textContent = `${selectedDate} | ${selectedSlotTime} - ${endTimeStr} (${selectedDuration} Hr${selectedDuration > 1 ? 's' : ''})`;
        document.getElementById('confirm-modal-player').textContent = playerName;
        document.getElementById('confirm-modal-rate').textContent = rateAppliedStr;

        if (confirmModal) {
          confirmModal.classList.add('is-open');
          document.body.style.overflow = 'hidden';
        }
      } catch (err) {
        if (errorBox) {
          errorTitle.textContent = "Server Validation Error";
          errorMsg.textContent = err.message;
          errorBox.style.display = 'flex';
        }
      }
    });
  }

  // Expose globally for synchronized member auth events
  window.updateMemberDisplayCard = updateMemberDisplayCard;
  window.getCurrentMember = getCurrentMember;
  window.getMemberMaxBookingHours = getMemberMaxBookingHours;
  window.checkConsecutiveIntervals = checkConsecutiveIntervals;
});

// Also attach globally for immediate availability
if (typeof window !== 'undefined') {
  window.updateMemberDisplayCard = updateMemberDisplayCard;
  window.getCurrentMember = getCurrentMember;
  window.getMemberMaxBookingHours = getMemberMaxBookingHours;
  window.checkConsecutiveIntervals = checkConsecutiveIntervals;
}



