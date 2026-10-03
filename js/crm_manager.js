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
        leads = serverLeads.map((l, idx) => {
          const leadId = l.id && String(l.id).startsWith('CC-ENQ-') ? l.id : 
                         l.reference ? l.reference : 
                         (l.name && String(l.name).startsWith('CC-ENQ-')) ? l.name : 
                         `CC-ENQ-000${l.id || (idx + 1)}`;
          const leadName = l.partner_name ? l.partner_name : 
                           (l.name && !String(l.name).startsWith('CC-ENQ-')) ? l.name : 
                           'Prospective Member';

          return {
            id: leadId,
            rawId: l.id || (idx + 1),
            name: leadName,
            phone: l.phone || '',
            email: l.email || '',
            source: l.source || 'website',
            plan: l.interested_plan_code || l.plan || 'gold',
            message: l.message || '',
            stage: l.stage || 'new',
            staff: l.staff_name || l.staff || 'Pooja Patel (Advisor)',
            quoteSent: l.quote_sent || l.quoteSent || false,
            quoteAmount: l.quote_amount || l.quoteAmount || 0,
            followups: (l.followup_notes ? l.followup_notes.split('\n').filter(Boolean).map(n => ({ time: 'Recent', note: n })) : (l.followups || [])),
            memberId: l.member_code || l.memberId || null
          };
        });
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
    card.setAttribute('data-lead-id', lead.id);
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

  // ==========================================
  // PUBLIC ENQUIRY FORM & TRACKER LOGIC
  // ==========================================
  
  // 1. URL Query Parameter Plan Pre-Selection (e.g. ?plan=gold, ?plan=silver, ?plan=junior)
  const urlParams = new URLSearchParams(window.location.search);
  const requestedPlan = urlParams.get('plan');
  const pubPlanSelect = document.getElementById('pub-enq-plan');
  if (requestedPlan && pubPlanSelect) {
    const validPlans = ['gold', 'silver', 'junior'];
    const matched = validPlans.find(p => p === requestedPlan.toLowerCase());
    if (matched) {
      pubPlanSelect.value = matched;
    }
  }

  // 2. Public Membership Enquiry Form Submission
  const pubForm = document.getElementById('form-public-enquiry');
  if (pubForm) {
    pubForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('pub-enq-name').value.trim();
      const phone = document.getElementById('pub-enq-phone').value.trim();
      const email = document.getElementById('pub-enq-email').value.trim();
      const plan = document.getElementById('pub-enq-plan').value;
      const message = document.getElementById('pub-enq-message').value.trim();
      const feedback = document.getElementById('pub-enquiry-feedback');
      const submitBtn = document.getElementById('btn-submit-public-enquiry');

      if (!name || !phone) {
        if (feedback) {
          feedback.style.display = 'block';
          feedback.innerHTML = '<div class="cc-badge cc-badge-cancelled" style="width: 100%; text-align: center; padding: 8px;">Please provide both your name and phone number.</div>';
        }
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Registering Enquiry in Club CRM...';

      try {
        let createdLead = null;
        if (window.ClubAPI && window.ClubAPI.createLead) {
          createdLead = await window.ClubAPI.createLead({
            name,
            phone,
            email,
            plan,
            message,
            source: 'website'
          });
        }

        await fetchLeads();

        const refCode = (createdLead && (createdLead.id || createdLead.name || createdLead.reference)) || `CC-ENQ-000${leads.length + 1}`;

        if (feedback) {
          feedback.style.display = 'block';
          feedback.innerHTML = `
            <div style="background: rgba(0, 229, 153, 0.1); border: 1px solid var(--cc-neon-green); border-radius: var(--cc-radius-md); padding: 14px; color: var(--cc-neon-green); font-size: 13px; line-height: 1.5;">
              <strong style="font-size: 14px;">✓ Membership Enquiry Submitted Successfully!</strong><br>
              Official Tracking Reference: <strong class="cc-text-mono" style="color: var(--cc-gold-400); font-size: 14px;">${refCode}</strong><br>
              <span style="font-size: 12px; color: var(--cc-text-secondary);">
                Assigned Advisor: <strong>Pooja Patel (Membership Team)</strong> &bull; We will contact you via WhatsApp / Call at <strong>${phone}</strong> shortly.
              </span>
            </div>
          `;
        }

        pubForm.reset();
        if (requestedPlan && pubPlanSelect) pubPlanSelect.value = requestedPlan;
        
        try { localStorage.setItem('cc_last_enquiry_ref', refCode); } catch (e) {}

        if (window.ClubAPI && window.ClubAPI.showSuccess) {
          window.ClubAPI.showSuccess(`Enquiry ${refCode} registered in CRM!`);
        }

        // Auto-fill track input for ease of use and trigger live tracking
        const trackInput = document.getElementById('pub-track-input');
        if (trackInput) {
          trackInput.value = refCode;
          const btnTrack = document.getElementById('btn-pub-track');
          if (btnTrack) btnTrack.click();
        }

      } catch (err) {
        if (feedback) {
          feedback.style.display = 'block';
          feedback.innerHTML = `<div class="cc-badge cc-badge-cancelled" style="width: 100%; text-align: center; padding: 8px;">Error: ${err.message}</div>`;
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Membership Enquiry →';
      }
    });
  }

  // 3. Live Enquiry Status Tracker
  const btnTrack = document.getElementById('btn-pub-track');
  const trackInput = document.getElementById('pub-track-input');
  const trackResult = document.getElementById('pub-track-result');

  // Auto-fill last reference if available
  try {
    const lastRef = localStorage.getItem('cc_last_enquiry_ref');
    if (lastRef && trackInput && !trackInput.value) {
      trackInput.value = lastRef;
    }
  } catch (e) {}

  if (btnTrack && trackInput && trackResult) {
    const performTrack = async () => {
      const rawQ = trackInput.value.trim();
      const q = rawQ.toLowerCase();
      if (!q) {
        trackResult.style.display = 'block';
        trackResult.innerHTML = '<div style="color: var(--cc-crimson); font-size: 12px; padding: 8px;">Please enter your reference code (e.g. CC-ENQ-0001) or phone number.</div>';
        return;
      }

      await fetchLeads();
      const digitsOnly = q.replace(/\D/g, '');

      const found = leads.find(l => {
        const leadId = (l.id || '').toLowerCase();
        const leadPhoneDigits = (l.phone || '').replace(/\D/g, '');
        const leadEmail = (l.email || '').toLowerCase();
        const leadName = (l.name || '').toLowerCase();

        return leadId === q ||
               leadId.includes(q) ||
               (digitsOnly.length >= 4 && leadPhoneDigits.includes(digitsOnly)) ||
               (leadEmail && (leadEmail === q || leadEmail.includes(q))) ||
               (leadName && (leadName === q || leadName.includes(q)));
      });

      trackResult.style.display = 'block';
      if (!found) {
        trackResult.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--cc-radius-md); padding: 14px; font-size: 13px; color: #fca5a5;">
            <strong>No enquiry record found matching "${rawQ}".</strong><br>
            <span style="font-size: 12px; color: var(--cc-text-muted);">
              Please verify your reference number (e.g. <code>CC-ENQ-0001</code>) or submit a new enquiry using the form on the left.
            </span>
          </div>
        `;
        return;
      }

      const stagesOrder = ['new', 'contacted', 'followup', 'quote', 'converted'];
      const currentStageIndex = stagesOrder.indexOf(found.stage);

      const stageDisplay = [
        { key: 'new', name: 'Received', desc: 'Enquiry captured in CRM' },
        { key: 'contacted', name: 'Contacted', desc: 'Advisor assigned' },
        { key: 'followup', name: 'Tour / Trial', desc: 'Club tour & consultation' },
        { key: 'quote', name: 'Quotation', desc: found.quoteAmount ? `₹ ${Number(found.quoteAmount).toLocaleString()} sent` : 'Fee proposal' },
        { key: 'converted', name: 'Member', desc: found.memberId ? `${found.memberId} Active` : 'Enrolled' }
      ];

      const stageBadges = {
        new: 'cc-badge-junior',
        contacted: 'cc-badge-warning',
        followup: 'cc-badge-silver',
        quote: 'cc-badge-gold',
        converted: 'cc-badge-active'
      };

      const stageLabels = {
        new: 'Stage 1: New Enquiry Received',
        contacted: 'Stage 2: Contacted by Membership Team',
        followup: 'Stage 3: Club Tour & Trial Session Scheduled',
        quote: `Stage 4: Official Quotation Sent (₹ ${Number(found.quoteAmount || 0).toLocaleString()})`,
        converted: `Stage 5: Converted to Active Club Member (${found.memberId || 'Active'})`
      };

      const planCode = (found.plan || 'gold').toLowerCase();
      const planBadgeClass = planCode === 'gold' ? 'cc-badge-gold' : planCode === 'silver' ? 'cc-badge-silver' : 'cc-badge-junior';

      trackResult.innerHTML = `
        <div style="background: rgba(14, 19, 31, 0.95); border: 1px solid var(--cc-border-highlight); border-radius: var(--cc-radius-lg); padding: 1.25rem; font-size: 13px; box-shadow: var(--cc-shadow-md);">
          
          <!-- HEADER -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid var(--cc-border-subtle); padding-bottom: 0.75rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="cc-text-mono" style="font-size: 15px; font-weight: 800; color: var(--cc-gold-400);">${found.id}</span>
                <span class="cc-badge ${planBadgeClass}">${planCode.toUpperCase()} TIER</span>
              </div>
              <h4 style="margin: 4px 0 0; font-size: 15px; color: var(--cc-text-primary); font-weight: 700;">${found.name}</h4>
            </div>
            <span class="cc-badge ${stageBadges[found.stage] || 'cc-badge-silver'}" style="font-size: 11px;">
              ${stageLabels[found.stage] || found.stage}
            </span>
          </div>

          <!-- 5-STEP PROGRESSION STEPPER -->
          <div style="margin-bottom: 1.25rem;">
            <div style="font-size: 11px; text-transform: uppercase; color: var(--cc-text-muted); font-weight: 700; margin-bottom: 0.5rem; letter-spacing: 0.5px;">
              Enquiry Lifecycle Progress:
            </div>
            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px;">
              ${stageDisplay.map((st, idx) => {
                const isPassed = idx <= currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                const bg = isCurrent ? 'var(--cc-gold-500)' : isPassed ? 'var(--cc-neon-green)' : 'rgba(255,255,255,0.08)';
                const textColor = isCurrent ? '#000000' : isPassed ? '#000000' : 'var(--cc-text-muted)';
                const icon = isPassed && !isCurrent ? '✓' : idx + 1;

                return `
                  <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px;">
                    <div style="width: 22px; height: 22px; border-radius: 50%; background: ${bg}; color: ${textColor}; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800;">
                      ${icon}
                    </div>
                    <span style="font-size: 10px; font-weight: 600; color: ${isPassed ? 'var(--cc-text-primary)' : 'var(--cc-text-muted)'}; line-height: 1.2;">
                      ${st.name}
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- KEY DETAILS STRIP -->
          <div style="background: rgba(22, 29, 46, 0.6); border: 1px solid var(--cc-border-subtle); border-radius: var(--cc-radius-md); padding: 0.75rem 1rem; margin-bottom: 1rem; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; font-size: 12px;">
            <div>
              <span style="color: var(--cc-text-muted);">Assigned Advisor:</span><br>
              <strong style="color: var(--cc-text-primary); font-size: 13px;">${found.staff || 'Pooja Patel (Membership Advisor)'}</strong>
            </div>
            <div>
              <span style="color: var(--cc-text-muted);">Quoted Amount:</span><br>
              <strong style="color: ${found.quoteSent ? 'var(--cc-neon-green)' : 'var(--cc-text-primary)'}; font-size: 13px;">
                ${found.quoteSent ? `₹ ${Number(found.quoteAmount).toLocaleString()} / yr` : 'Under Consultation'}
              </strong>
            </div>
            <div>
              <span style="color: var(--cc-text-muted);">Contact Verified:</span><br>
              <span style="color: var(--cc-text-secondary);">${found.phone} ${found.email ? `&bull; ${found.email}` : ''}</span>
            </div>
            <div>
              <span style="color: var(--cc-text-muted);">Member ID (Upon Conversion):</span><br>
              <strong style="color: var(--cc-gold-400);">${found.memberId || 'Pending Activation'}</strong>
            </div>
          </div>

          <!-- FOLLOW-UP TIMELINE -->
          ${found.followups && found.followups.length ? `
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--cc-text-muted); font-weight: 700; margin-bottom: 0.5rem; letter-spacing: 0.5px;">
                Advisor Activity &amp; Next Steps:
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.4rem; max-height: 140px; overflow-y: auto;">
                ${found.followups.map(f => `
                  <div style="display: flex; gap: 8px; font-size: 11px; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: var(--cc-radius-sm); border-left: 2px solid var(--cc-gold-500);">
                    <span style="color: var(--cc-text-muted); white-space: nowrap;">${f.time || 'Recent'}:</span>
                    <span style="color: var(--cc-text-secondary);">${f.note}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

        </div>
      `;
    };

    btnTrack.addEventListener('click', performTrack);
    trackInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performTrack();
      }
    });

    // Auto-trigger if ref query param is provided
    const requestedRef = urlParams.get('ref');
    if (requestedRef) {
      const cleanRef = decodeURIComponent(requestedRef).trim();
      trackInput.value = cleanRef;
      performTrack();
    }
  }

  // Auto-focus and open lead in Admin View if ref query param is present
  const requestedRef = urlParams.get('ref');
  if (requestedRef) {
    const cleanRef = decodeURIComponent(requestedRef).trim();
    const normalizedRef = cleanRef.replace(/[_\s]+/g, '-').toLowerCase();
    
    setTimeout(async () => {
      await fetchLeads();
      const matchedLead = leads.find(l => {
        const lid = (l.id || '').toLowerCase().replace(/[_\s]+/g, '-');
        const lraw = String(l.rawId || '').toLowerCase();
        const lphone = (l.phone || '').replace(/\D/g, '');
        const cleanDigits = cleanRef.replace(/\D/g, '');
        return lid === normalizedRef ||
               lid.includes(normalizedRef) ||
               lraw === normalizedRef ||
               (cleanDigits.length >= 2 && lid.endsWith(cleanDigits)) ||
               (cleanDigits.length >= 4 && lphone.includes(cleanDigits));
      });

      if (matchedLead) {
        const isAdmin = window.ClubAdminAuth && window.ClubAdminAuth.isAdmin && window.ClubAdminAuth.isAdmin();
        if (isAdmin) {
          openLeadModal(matchedLead.id);
          const cardEl = document.querySelector(`[data-lead-id="${matchedLead.id}"]`);
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardEl.style.boxShadow = '0 0 0 2px var(--cc-gold-400), 0 0 16px rgba(212,175,55,0.4)';
          }
        }
      }
    }, 350);

  // 4. View Switcher Helper for Staff / Public
  const btnToggleCrm = document.getElementById('btn-toggle-crm-view');
  if (btnToggleCrm) {
    btnToggleCrm.addEventListener('click', () => {
      const publicSec = document.getElementById('public-enquiry-section');
      const gate = document.getElementById('cc-admin-access-gate');
      const protectedContent = document.getElementById('cc-admin-protected-content');
      const isAdmin = window.ClubAdminAuth && window.ClubAdminAuth.isAdmin();

      if (isAdmin) {
        // If admin is logged in, toggle between public view and Kanban board
        if (publicSec && publicSec.style.display !== 'none') {
          publicSec.style.display = 'none';
          if (protectedContent) protectedContent.style.display = 'block';
          btnToggleCrm.textContent = '👥 Public View';
        } else {
          if (publicSec) publicSec.style.display = 'block';
          if (protectedContent) protectedContent.style.display = 'none';
          btnToggleCrm.textContent = '📋 CRM Pipeline';
        }
      } else {
        // If not logged in, open the Admin Login modal / gate
        if (window.ClubAdminAuth && window.ClubAdminAuth.openLoginModal) {
          window.ClubAdminAuth.openLoginModal();
        } else {
          showStaffGateView();
        }
      }
    });
  }
});

// Global Helpers for CRM views
function showPublicEnquiryView() {
  const publicSec = document.getElementById('public-enquiry-section');
  const gate = document.getElementById('cc-admin-access-gate');
  const protectedContent = document.getElementById('cc-admin-protected-content');
  if (publicSec) publicSec.style.display = 'block';
  if (gate) gate.style.display = 'none';
  if (protectedContent) protectedContent.style.display = 'none';
}

function showStaffGateView() {
  const publicSec = document.getElementById('public-enquiry-section');
  const gate = document.getElementById('cc-admin-access-gate');
  const protectedContent = document.getElementById('cc-admin-protected-content');
  if (publicSec) publicSec.style.display = 'none';
  if (gate) gate.style.display = 'block';
  if (protectedContent) protectedContent.style.display = 'none';
}

window.showPublicEnquiryView = showPublicEnquiryView;
window.showStaffGateView = showStaffGateView;


