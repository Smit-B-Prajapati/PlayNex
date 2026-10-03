/**
 * CHAMPIONS CLUB — Enquiries & CRM Pipeline Controller
 * Manages visitor leads across the 5 strict standard pipeline stages:
 * New Enquiry -> Contacted -> Follow-up -> Quote -> Converted
 * Fully connected to Odoo ORM club.enquiry model via ClubAPI with ClubDataStore sync.
 */

// Initial Leads (Strictly labeled as DEMO DATA in compliance with DATA RULE)
const defaultLeads = [
  {
    id: 'CC-ENQ-0001',
    name: 'Siddharth Rao',
    phone: '+91 99001 22334',
    email: 'siddharth.rao@example.com',
    source: 'website',
    plan: 'gold',
    message: 'Interested in Gold membership and court availability for weekend tennis.',
    stage: 'new',
    staff: 'Pooja Patel (Membership Advisor)',
    quoteSent: false,
    quoteAmount: 24000,
    followups: [
      { time: '2026-10-03 09:30', note: 'Website form submitted from public landing page.' }
    ],
    memberId: null
  },
  {
    id: 'CC-ENQ-0002',
    name: 'Ananya Deshmukh',
    phone: '+91 98210 44556',
    email: 'ananya.d@example.com',
    source: 'walkin',
    plan: 'silver',
    message: 'Inquiring about badminton court slots after office hours (7 PM).',
    stage: 'contacted',
    staff: 'Rohan Verma (Front Desk Lead)',
    quoteSent: false,
    quoteAmount: 14000,
    followups: [
      { time: '2026-10-02 16:45', note: 'Front desk enquiry. Staff called visitor regarding Silver plan entitlements.' }
    ],
    memberId: null
  },
  {
    id: 'CC-ENQ-0003',
    name: 'Vikramaditya Bose',
    phone: '+91 97110 33445',
    email: 'vikram.bose@example.com',
    source: 'phone',
    plan: 'junior',
    message: 'Looking for youth cricket net training for 15-year old son.',
    stage: 'followup',
    staff: 'Karan Mehra (Club Manager)',
    quoteSent: false,
    quoteAmount: 8000,
    followups: [
      { time: '2026-10-01 11:00', note: 'Spoke with parent; scheduled club tour for facility walkthrough.' },
      { time: '2026-10-02 18:00', note: 'Parent completed club tour; requested formal quotation.' }
    ],
    memberId: null
  },
  {
    id: 'CC-ENQ-0004',
    name: 'Meera Nambiar',
    phone: '+91 98765 43210',
    email: 'meera.n@example.com',
    source: 'referral',
    plan: 'gold',
    message: 'Referred by Rahul Sharma for tournament preparation and coaching.',
    stage: 'quote',
    staff: 'Pooja Patel (Membership Advisor)',
    quoteSent: true,
    quoteAmount: 24000,
    followups: [
      { time: '2026-10-02 10:00', note: 'Referred by active member. Discussed Gold tier benefits.' },
      { time: '2026-10-02 15:30', note: 'Official quotation of ₹ 24,000 sent via email & WhatsApp.' }
    ],
    memberId: null
  },
  {
    id: 'CC-ENQ-0005',
    name: 'Natasha Kapoor',
    phone: '+91 98450 99887',
    email: 'natasha.k@example.com',
    source: 'website',
    plan: 'gold',
    message: 'Enrolled after court trial session.',
    stage: 'converted',
    staff: 'Pooja Patel (Membership Advisor)',
    quoteSent: true,
    quoteAmount: 24000,
    followups: [
      { time: '2026-09-28 14:00', note: 'Initial enquiry regarding tennis clay courts.' },
      { time: '2026-09-30 11:30', note: 'Quote accepted; converted to active Gold member profile.' }
    ],
    memberId: 'CC-MEM-00105'
  }
];

let leads = [];

async function fetchLeads() {
  if (window.ClubAPI) {
    try {
      const serverLeads = await window.ClubAPI.getLeads();
      if (serverLeads && serverLeads.length > 0) {
        leads = serverLeads.map(l => ({
          id: l.name || `CC-ENQ-000${l.id}`,
          rawId: l.id,
          name: l.partner_name || l.name,
          phone: l.phone,
          email: l.email || '',
          source: l.source || 'website',
          plan: l.interested_plan_code || l.plan || 'gold',
          message: l.message || '',
          stage: l.stage || 'new',
          staff: l.staff_name || l.staff || 'Pooja Patel (Advisor)',
          quoteSent: l.quote_sent || false,
          quoteAmount: l.quote_amount || 0,
          followups: (l.followup_notes ? l.followup_notes.split('\n').filter(Boolean).map(n => ({ time: 'Recent', note: n })) : (l.followups || [])),
          memberId: l.member_code || l.memberId || null
        }));
        syncLeads();
        return leads;
      }
    } catch (e) {
      console.warn('API getLeads fallback', e);
    }
  }

  if (typeof window !== 'undefined' && window.ClubDataStore) {
    leads = window.ClubDataStore.getLeads();
    if (!leads || leads.length === 0) {
      leads = defaultLeads;
      window.ClubDataStore.saveLeads(leads);
    }
  } else {
    leads = defaultLeads;
  }
  return leads;
}

function syncLeads() {
  if (typeof window !== 'undefined' && window.ClubDataStore) {
    window.ClubDataStore.saveLeads(leads);
  }
}

let selectedLeadId = null;

async function renderPipeline() {
  await fetchLeads();

  const containers = {
    new: document.getElementById('cards-new'),
    contacted: document.getElementById('cards-contacted'),
    followup: document.getElementById('cards-followup'),
    quote: document.getElementById('cards-quote'),
    converted: document.getElementById('cards-converted')
  };

  const badges = {
    new: document.getElementById('badge-count-new'),
    contacted: document.getElementById('badge-count-contacted'),
    followup: document.getElementById('badge-count-followup'),
    quote: document.getElementById('badge-count-quote'),
    converted: document.getElementById('badge-count-converted')
  };

  // Clear columns
  Object.values(containers).forEach(c => { if (c) c.innerHTML = ''; });

  const counts = { new: 0, contacted: 0, followup: 0, quote: 0, converted: 0 };

  leads.forEach(lead => {
    if (counts[lead.stage] !== undefined) {
      counts[lead.stage]++;
    }
    const col = containers[lead.stage];
    if (!col) return;

    const planCode = lead.plan || 'gold';
    const planBadgeClass = planCode === 'gold' ? 'cc-badge-gold' : planCode === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior';
    const sourceLabel = lead.source === 'website' ? 'Web' : lead.source === 'walkin' ? 'Walk-in' : lead.source === 'phone' ? 'Phone' : lead.source === 'referral' ? 'Referral' : 'Staff';

    const card = document.createElement('div');
    card.className = `cc-lead-card ${lead.stage === 'converted' ? 'is-converted' : ''}`;
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <span class="cc-text-mono" style="font-size: 11px; font-weight: 700; color: var(--cc-gold-400);">${lead.id}</span>
        <div style="display: flex; gap: 4px;">
          <span class="cc-badge cc-badge-silver" style="font-size: 9px; padding: 1px 4px;">${sourceLabel}</span>
          <span class="cc-badge ${planBadgeClass}" style="font-size: 9px; padding: 1px 5px;">${planCode.toUpperCase()}</span>
        </div>
      </div>

      <div style="font-weight: 700; color: var(--cc-text-primary); font-size: 14px;">${lead.name}</div>
      <div style="font-size: 12px; color: var(--cc-text-secondary);"><i class="fa fa-phone"></i> ${lead.phone}</div>

      ${lead.quoteSent ? `
        <div style="font-size: 11px; color: var(--cc-neon-green); font-weight: 600;">
          ✓ Quoted: ₹ ${Number(lead.quoteAmount).toLocaleString()}
        </div>
      ` : ''}

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--cc-border-subtle); padding-top: 6px; margin-top: 4px; font-size: 11px; color: var(--cc-text-muted);">
        <span style="max-width: 110px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${(lead.staff || 'Staff').split(' ')[0]}</span>
        <span>${lead.followups ? lead.followups.length : 0} logs</span>
      </div>
    `;

    card.addEventListener('click', () => {
      openLeadModal(lead.id);
    });

    col.appendChild(card);
  });

  // Empty state handling for columns with 0 cards
  Object.keys(containers).forEach(k => {
    const col = containers[k];
    if (col && counts[k] === 0) {
      col.innerHTML = '<div style="text-align: center; color: var(--cc-text-muted); font-size: 12px; padding: 1.5rem 0.5rem;">No data available</div>';
    }
  });

  // Update badge counts
  Object.keys(badges).forEach(k => {
    if (badges[k]) badges[k].textContent = counts[k];
  });
}

function openLeadModal(leadId) {
  selectedLeadId = leadId;
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return;

  const modal = document.getElementById('modal-lead-detail');
  document.getElementById('lead-modal-ref').textContent = lead.id;
  document.getElementById('lead-modal-name').textContent = lead.name;
  document.getElementById('lead-modal-contact').textContent = `${lead.phone} • ${lead.email || 'No email'}`;

  const planCode = lead.plan || 'gold';
  const planBadgeClass = planCode === 'gold' ? 'cc-badge-gold' : planCode === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior';
  document.getElementById('lead-modal-plan-badge').innerHTML = `
    <span class="cc-badge ${planBadgeClass}">${planCode.toUpperCase()} Plan</span>
  `;

  document.getElementById('lead-modal-assign-staff').value = lead.staff || 'Pooja Patel (Membership Advisor)';
  document.getElementById('lead-modal-message').textContent = lead.message || 'No initial message provided.';

  // Quotation Status
  const quoteStatusBadge = document.getElementById('lead-modal-quote-status');
  const quoteInput = document.getElementById('lead-modal-quote-amount');
  quoteInput.value = lead.quoteAmount || (planCode === 'gold' ? 24000 : planCode === 'silver' ? 14000 : 8000);

  if (lead.quoteSent) {
    quoteStatusBadge.className = 'cc-badge cc-badge-active';
    quoteStatusBadge.textContent = 'Quote Sent';
  } else {
    quoteStatusBadge.className = 'cc-badge cc-badge-warning';
    quoteStatusBadge.textContent = 'Quote Pending';
  }

  // Render Follow-up timeline
  renderFollowupTimeline(lead);

  // Conversion Button State
  const convertBtn = document.getElementById('btn-action-convert-member');
  if (lead.stage === 'converted') {
    convertBtn.classList.add('is-disabled');
    convertBtn.textContent = `Already Converted (${lead.memberId || 'Active'})`;
    convertBtn.disabled = true;
  } else {
    convertBtn.classList.remove('is-disabled');
    convertBtn.textContent = '★ Convert to Member';
    convertBtn.disabled = false;
  }

  if (modal) {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
}

function renderFollowupTimeline(lead) {
  const container = document.getElementById('lead-followup-timeline');
  if (!container) return;
  container.innerHTML = '';

  if (!lead.followups || lead.followups.length === 0) {
    container.innerHTML = '<p class="cc-body-xs" style="color: var(--cc-text-muted);">No follow-up activity logged yet.</p>';
    return;
  }

  lead.followups.slice().reverse().forEach(f => {
    const item = document.createElement('div');
    item.className = 'cc-history-item';
    item.innerHTML = `
      <div class="cc-history-time">${f.time}</div>
      <div class="cc-history-desc">${f.note}</div>
    `;
    container.appendChild(item);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await renderPipeline();

  // Open New Enquiry Modal
  const btnOpenModal = document.getElementById('btn-open-enquiry-modal');
  const modalNew = document.getElementById('modal-new-enquiry');
  if (btnOpenModal && modalNew) {
    btnOpenModal.addEventListener('click', () => {
      modalNew.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  }

  // Submit Visitor Enquiry Form
  const formEnquiry = document.getElementById('form-visitor-enquiry');
  if (formEnquiry) {
    formEnquiry.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('enq-visitor-name').value.trim();
      const phone = document.getElementById('enq-visitor-phone').value.trim();
      const email = document.getElementById('enq-visitor-email').value.trim();
      const source = (document.getElementById('enq-source') && document.getElementById('enq-source').value) || 'website';
      const plan = document.getElementById('enq-interested-plan').value;
      const msg = document.getElementById('enq-visitor-msg').value.trim();

      if (window.ClubAPI) {
        try {
          const res = await window.ClubAPI.submitEnquiry({
            name,
            phone,
            email,
            source,
            plan,
            message: msg
          });
          if (res && res.success) {
            modalNew.classList.remove('is-open');
            document.body.style.overflow = '';
            formEnquiry.reset();
            await renderPipeline();
            return;
          }
        } catch (err) {
          console.warn('Backend enquiry submission fallback', err);
        }
      }

      const newId = `CC-ENQ-00${String(leads.length + 1).padStart(2, '0')}`;
      leads.unshift({
        id: newId,
        name: name,
        phone: phone,
        email: email,
        source: source,
        plan: plan,
        message: msg,
        stage: 'new', // Pipeline Stage 1: New Enquiry
        staff: 'Pooja Patel (Membership Advisor)',
        quoteSent: false,
        quoteAmount: plan === 'gold' ? 24000 : plan === 'silver' ? 14000 : 8000,
        followups: [
          { time: '2026-10-03 10:25', note: `Enquiry captured from ${source}. Initial status: New Enquiry.` }
        ],
        memberId: null
      });

      syncLeads();
      await renderPipeline();
      modalNew.classList.remove('is-open');
      document.body.style.overflow = '';
      formEnquiry.reset();
      if (window.ClubAPI) {
        window.ClubAPI.showSuccess(`Enquiry ${newId} received! Logged into 'New Enquiry' stage.`);
      }
    });
  }

  // Action: Mark Contacted
  const btnContacted = document.getElementById('btn-action-mark-contacted');
  if (btnContacted) {
    btnContacted.addEventListener('click', async () => {
      const lead = leads.find(l => l.id === selectedLeadId);
      if (!lead) return;

      if (lead.rawId && window.ClubAPI) {
        try {
          await window.ClubAPI.markLeadContacted(lead.rawId);
        } catch (err) {
          console.warn('Backend mark contacted fallback', err);
        }
      }

      if (lead.stage === 'new') {
        lead.stage = 'contacted';
        lead.followups.push({
          time: '2026-10-03 10:28',
          note: `Staff reached out to visitor via phone/WhatsApp (${lead.staff}).`
        });
        syncLeads();
        await renderPipeline();
        renderFollowupTimeline(lead);
        if (window.ClubAPI) window.ClubAPI.showSuccess(`Lead marked as 'Contacted'.`);
      }
    });
  }

  // Action: Send Quote (Moves to 'quote' stage)
  const btnSendQuote = document.getElementById('btn-action-send-quote');
  if (btnSendQuote) {
    btnSendQuote.addEventListener('click', async () => {
      const lead = leads.find(l => l.id === selectedLeadId);
      if (!lead) return;

      const amt = parseFloat(document.getElementById('lead-modal-quote-amount').value) || 0;

      if (lead.rawId && window.ClubAPI) {
        try {
          await window.ClubAPI.sendLeadQuote(lead.rawId, amt, `Quote for ${lead.plan} plan`);
        } catch (err) {
          console.warn('Backend quote fallback', err);
        }
      }

      lead.quoteSent = true;
      lead.quoteAmount = amt;
      lead.stage = 'quote'; // Strict Pipeline Stage: Quote
      lead.followups.push({
        time: '2026-10-03 10:30',
        note: `Sent tailored quotation of ₹ ${amt.toLocaleString()} for ${(lead.plan || 'Gold').toUpperCase()} Plan.`
      });

      syncLeads();
      await renderPipeline();
      openLeadModal(lead.id);
      if (window.ClubAPI) window.ClubAPI.showSuccess(`Quote of ₹ ${amt.toLocaleString()} sent! Moved to 'Quote' stage.`);
    });
  }

  // Action: Add Follow-up Note (Moves to 'followup' stage)
  const btnAddNote = document.getElementById('btn-add-followup');
  if (btnAddNote) {
    btnAddNote.addEventListener('click', async () => {
      const lead = leads.find(l => l.id === selectedLeadId);
      const noteInput = document.getElementById('lead-followup-input');
      const text = noteInput.value.trim();
      if (!lead || !text) return;

      if (lead.rawId && window.ClubAPI) {
        try {
          await window.ClubAPI.logLeadFollowup(lead.rawId, text);
        } catch (err) {
          console.warn('Backend followup fallback', err);
        }
      }

      lead.followups.push({
        time: '2026-10-03 10:32',
        note: text
      });
      if (lead.stage === 'contacted' || lead.stage === 'new') {
        lead.stage = 'followup'; // Strict Pipeline Stage: Follow-up
      }

      noteInput.value = '';
      syncLeads();
      await renderPipeline();
      renderFollowupTimeline(lead);
      if (window.ClubAPI) window.ClubAPI.showSuccess('Follow-up interaction logged.');
    });
  }

  // Action: Convert to Member (With Duplicate Contact / Member Prevention)
  const btnConvert = document.getElementById('btn-action-convert-member');
  if (btnConvert) {
    btnConvert.addEventListener('click', async () => {
      const lead = leads.find(l => l.id === selectedLeadId);
      if (!lead || lead.stage === 'converted') return;

      if (lead.rawId && window.ClubAPI) {
        try {
          const res = await window.ClubAPI.convertLeadToMember(lead.rawId);
          if (res && res.success) {
            lead.memberId = res.member_code;
            lead.stage = 'converted';
            syncLeads();
            await renderPipeline();
            openLeadModal(lead.id);
            return;
          }
        } catch (err) {
          console.warn('Backend conversion fallback', err);
        }
      }

      let existingMember = null;
      let members = [];
      if (typeof window !== 'undefined' && window.ClubDataStore) {
        members = window.ClubDataStore.getMembers();
        existingMember = members.find(m => 
          (lead.phone && m.phone === lead.phone) || 
          (lead.email && m.email && m.email.toLowerCase() === lead.email.toLowerCase())
        );
      }

      if (existingMember) {
        // Associate existing member without creating duplicate profile
        lead.memberId = existingMember.id;
        lead.stage = 'converted';
        lead.followups.push({
          time: '2026-10-03 10:35',
          note: `Associated with existing Member profile ${existingMember.id} (${existingMember.name}). No duplicate created.`
        });
        existingMember.history = existingMember.history || [];
        existingMember.history.push({
          timestamp: '2026-10-03 10:35',
          type: 'note',
          desc: `Enquiry ${lead.id} (${lead.source}) associated with member profile.`
        });
        if (window.ClubDataStore) {
          window.ClubDataStore.saveMembers(members);
        }
        syncLeads();
        await renderPipeline();
        openLeadModal(lead.id);
        if (window.ClubAPI) window.ClubAPI.showSuccess(`Matched existing member ${existingMember.name} (${existingMember.id}). Linked without duplicates.`);
        return;
      }

      // Create brand new member
      const newMemberId = `CC-MEM-00${100 + members.length + 1}`;
      lead.memberId = newMemberId;
      lead.stage = 'converted';
      lead.followups.push({
        time: '2026-10-03 10:35',
        note: `★ Converted to Member! Assigned Member ID: ${newMemberId}.`
      });

      if (typeof window !== 'undefined' && window.ClubDataStore) {
        members.push({
          id: newMemberId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          plan: lead.plan || 'gold',
          startDate: '2026-10-03',
          endDate: '2027-10-03',
          state: 'active',
          history: [
            { timestamp: '2026-10-03 10:35', type: 'signup', desc: `Enrolled via Enquiry ${lead.id} (Source: ${lead.source || 'Website'}). Plan: ${(lead.plan || 'gold').toUpperCase()}` }
          ],
          notes: `Converted lead from CRM. Quoted fee: ₹ ${(lead.quoteAmount || 0).toLocaleString()}`
        });
        window.ClubDataStore.saveMembers(members);
      }

      syncLeads();
      await renderPipeline();
      openLeadModal(lead.id);
      if (window.ClubAPI) {
        window.ClubAPI.showSuccess(`🎉 Congratulations! '${lead.name}' successfully converted to active Club Member (${newMemberId}).`);
      }
    });
  }

  // Staff Assignment Select Change
  const staffSelect = document.getElementById('lead-modal-assign-staff');
  if (staffSelect) {
    staffSelect.addEventListener('change', async () => {
      const lead = leads.find(l => l.id === selectedLeadId);
      if (lead) {
        lead.staff = staffSelect.value;
        syncLeads();
        await renderPipeline();
      }
    });
  }
});

