/**
 * CHAMPIONS CLUB — Central Data Store & Audit Traceability
 * Provides synchronized persistence via localStorage & live server JSON store across all browser tabs (including InPrivate/Incognito windows).
 * Every metric is calculated strictly from actual stored records.
 * Supports baseline DEMO DATA restoration and empty-state testing ("No data available").
 */

const ClubDataStore = (function() {
  'use strict';

  const KEYS = {
    MEMBERS: 'cc_members',
    BOOKINGS: 'cc_bookings',
    PRODUCTS: 'cc_products',
    SHOP_ORDERS: 'cc_shop_orders',
    BAR_TABLES: 'cc_bar_tables',
    BAR_TABS: 'cc_bar_tabs',
    BAR_REVENUE: 'cc_bar_revenue',
    LEADS: 'cc_leads'
  };

  // Seed Baseline Club Data — includes all registered members and activity
  const SEED_DATA = {
    members: [
      {
        id: 'CC-MEM-00101',
        name: 'David Vance',
        email: 'david.vance@example.com',
        phone: '+91 98234 11201',
        plan: 'gold',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        state: 'active',
        history: [
          { timestamp: '2026-01-01 10:00', type: 'signup', desc: 'Enrolled under Gold Plan (1 Year Validity)' },
          { timestamp: '2026-02-14 18:30', type: 'checkin', desc: 'Front desk check-in for Tennis Court 1' },
          { timestamp: '2026-03-20 19:15', type: 'checkin', desc: 'Front desk check-in for Friday Social Play' }
        ],
        notes: 'Prefers clay courts on weekend mornings.'
      },
      {
        id: 'CC-MEM-00102',
        name: 'Elena Rostova',
        email: 'elena.rostova@example.com',
        phone: '+91 98450 77312',
        plan: 'silver',
        startDate: '2025-11-01',
        endDate: '2026-10-25', // Expiring in ~22 days from Oct 3, 2026
        state: 'active',
        history: [
          { timestamp: '2025-11-01 11:30', type: 'signup', desc: 'Enrolled under Silver Plan' },
          { timestamp: '2026-05-10 17:00', type: 'checkin', desc: 'Front desk check-in for Cricket practice' }
        ],
        notes: 'Member requested notification upon expiry.'
      },
      {
        id: 'CC-MEM-00103',
        name: 'Leo Chen',
        email: 'leo.chen@example.com',
        phone: '+91 97123 90814',
        plan: 'junior',
        startDate: '2026-03-01',
        endDate: '2027-02-28',
        state: 'active',
        history: [
          { timestamp: '2026-03-01 14:00', type: 'signup', desc: 'Enrolled under Junior Plan (Under 18)' },
          { timestamp: '2026-06-12 16:00', type: 'checkin', desc: 'Front desk check-in for Badminton session' }
        ],
        notes: 'Parent contact: Chen Wei (+91 97123 90800).'
      },
      {
        id: 'CC-MEM-00104',
        name: 'Vikram Mehta',
        email: 'vikram.mehta@example.com',
        phone: '+91 98980 12345',
        plan: 'silver',
        startDate: '2025-08-01',
        endDate: '2026-08-01', // Expired
        state: 'expired',
        history: [
          { timestamp: '2025-08-01 09:00', type: 'signup', desc: 'Enrolled under Silver Plan' },
          { timestamp: '2026-08-01 00:00', type: 'expiry', desc: 'Validity expired on August 1, 2026' }
        ],
        notes: 'Renewal follow-up pending.'
      },
      {
        id: 'CC-MEM-00105',
        name: 'Siddharth Rao',
        email: 'siddharth.rao@example.com',
        phone: '+91 99001 22334',
        plan: 'gold',
        startDate: '2026-10-03',
        endDate: '2027-10-03',
        state: 'active',
        history: [
          { timestamp: '2026-10-03 10:00', type: 'signup', desc: 'Enrolled under Gold Plan (Converted from CRM Lead CC-ENQ-0001)' }
        ],
        notes: 'Weekend clay court enthusiast.'
      },
      {
        id: 'CC-MEM-00106',
        name: 'Vikramaditya Bose',
        email: 'vikram.bose@example.com',
        phone: '+91 97110 33445',
        plan: 'junior',
        startDate: '2026-10-03',
        endDate: '2027-10-03',
        state: 'active',
        history: [
          { timestamp: '2026-10-03 11:30', type: 'signup', desc: 'Enrolled under Junior Plan (Converted from CRM Lead CC-ENQ-0003)' }
        ],
        notes: 'Youth cricket team candidate.'
      },
      {
        id: 'CC-MEM-00107',
        name: 'Smit',
        email: 'mevawalatisha@gmail.com',
        phone: '+91 98989 00107',
        plan: 'junior',
        startDate: '2026-10-03',
        endDate: '2027-10-03',
        state: 'active',
        history: [
          { timestamp: '2026-10-03 14:00', type: 'signup', desc: 'Enrolled under Junior Plan (Front Desk Enrollment)' }
        ],
        notes: 'Enrolled at front desk.'
      }
    ],
    bookings: [
      {
        id: 'CC-BK-0001',
        courtId: '1',
        courtName: 'Tennis Court 1 (Clay)',
        sport: 'tennis',
        date: '2026-10-03',
        startTime: '18:00',
        endTime: '19:00',
        bookingType: 'member',
        memberId: 'CC-MEM-00101',
        playerName: 'David Vance (Gold)',
        rateApplied: '₹ 0.00 (Free)',
        fee: 0.0,
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
        bookingType: 'walkin',
        memberId: null,
        playerName: 'Rahul Sharma (Walk-in)',
        rateApplied: '₹ 600.00',
        fee: 600.0,
        isSocial: false,
        state: 'confirmed'
      }
    ],
    products: [
      {
        id: 'p1',
        sku: 'CC-RCK-01',
        name: 'Pro Tour Carbon Tennis Racket',
        category: 'rackets',
        price: 8500,
        stock: 12,
        minAlert: 4,
        desc: 'High-modulus graphite frame with synthetic gut stringing.'
      },
      {
        id: 'p2',
        sku: 'CC-RCK-02',
        name: 'Championship Feather Badminton Racket',
        category: 'rackets',
        price: 4200,
        stock: 3, // LOW STOCK ALERT
        minAlert: 5,
        desc: 'Lightweight head-heavy balance racket for rapid smashes.'
      },
      {
        id: 'p3',
        sku: 'CC-BAL-01',
        name: 'Tournament Tennis Balls (Can of 3)',
        category: 'balls',
        price: 450,
        stock: 65,
        minAlert: 15,
        desc: 'ITF approved championship extra-duty felt tennis balls.'
      },
      {
        id: 'p4',
        sku: 'CC-BAL-02',
        name: 'Match Grade 4-Piece Cricket Leather Ball',
        category: 'balls',
        price: 750,
        stock: 22,
        minAlert: 8,
        desc: 'Alum tanned English leather with hand-stitched seam.'
      },
      {
        id: 'p5',
        sku: 'CC-SHOE-01',
        name: 'All-Court Grip Athletic Sports Shoes',
        category: 'shoes',
        price: 5800,
        stock: 4,
        minAlert: 3,
        desc: 'Non-marking herringbone gum rubber outsole for all court surfaces.'
      },
      {
        id: 'p6',
        sku: 'CC-ACC-01',
        name: 'Pro Overgrip & Vibration Dampener Pack',
        category: 'accessories',
        price: 350,
        stock: 40,
        minAlert: 10,
        desc: 'Super absorbent polyurethane overgrips with club vibration dampeners.'
      },
      {
        id: 'p7',
        sku: 'CC-APP-01',
        name: 'Champions Club Performance Match Jersey',
        category: 'apparel',
        price: 1800,
        stock: 18,
        minAlert: 5,
        desc: 'Moisture-wicking breathable athletic polyester club jersey.'
      }
    ],
    shopOrders: [
      {
        id: 'CC-SO-0001',
        channel: 'counter',
        customer: 'Walk-in Guest',
        fulfillment: 'Immediate Handover',
        items: [{ name: 'Tournament Tennis Balls (Can of 3)', qty: 2, price: 450 }],
        total: 900,
        state: 'completed',
        date: '2026-10-03'
      },
      {
        id: 'CC-SO-0002',
        channel: 'online',
        customer: 'David Vance (Gold)',
        fulfillment: 'Collect at Club (Click & Collect)',
        items: [{ name: 'Pro Tour Carbon Tennis Racket', qty: 1, price: 8500 }],
        total: 8500,
        state: 'confirmed',
        date: '2026-10-03'
      }
    ],
    barTables: [
      { id: 't1', name: 'Courtside Table 1', state: 'occupied', currentTab: 'CC-TAB-0001' },
      { id: 't2', name: 'Courtside Table 2', state: 'available', currentTab: null },
      { id: 't3', name: 'Veranda Table 3', state: 'available', currentTab: null },
      { id: 't4', name: 'Lounge Booth 4', state: 'available', currentTab: null }
    ],
    barTabs: [
      {
        id: 'CC-TAB-0001',
        memberKey: 'gold',
        memberName: 'David Vance (Gold)',
        tableId: 't1',
        tableName: 'Courtside Table 1',
        discountPercent: 15,
        items: [
          { name: '[DEMO DATA] Post-Match Whey Protein Shake', qty: 2, price: 280 }
        ],
        subtotal: 560,
        discountAmount: 84,
        netTotal: 476,
        state: 'open'
      }
    ],
    barRevenue: {
      cash: 240.0,
      card: 450.0,
      upi: 320.0
    },
    leads: [
      {
        id: 'CC-ENQ-0001',
        name: 'Siddharth Rao',
        phone: '+91 99001 22334',
        email: 'siddharth.rao@example.com',
        plan: 'gold',
        sport: 'tennis',
        message: 'Interested in Gold membership and court availability for weekend tennis.',
        stage: 'converted',
        staff: 'Pooja Patel (Membership Advisor)',
        quoteSent: true,
        quoteAmount: 24000,
        followups: [
          { time: '2026-10-03 09:30', note: 'Website form submitted from public landing page.' },
          { time: '2026-10-03 10:00', note: 'Quote accepted; converted to member CC-MEM-00105.' }
        ],
        memberId: 'CC-MEM-00105'
      },
      {
        id: 'CC-ENQ-0002',
        name: 'Ananya Deshmukh',
        phone: '+91 98210 44556',
        email: 'ananya.d@example.com',
        plan: 'silver',
        sport: 'badminton',
        message: 'Inquiring about badminton court slots after office hours (7 PM).',
        stage: 'contacted',
        staff: 'Rohan Verma (Front Desk Lead)',
        quoteSent: false,
        quoteAmount: 14000,
        followups: [
          { time: '2026-10-02 16:45', note: 'Phone call: Discussed Silver plan entitlements and weekday slot availability.' }
        ],
        memberId: null
      },
      {
        id: 'CC-ENQ-0003',
        name: 'Vikramaditya Bose',
        phone: '+91 97110 33445',
        email: 'vikram.bose@example.com',
        plan: 'junior',
        sport: 'cricket',
        message: 'Looking for youth cricket net training for 15-year old son.',
        stage: 'converted',
        staff: 'Karan Mehra (Club Manager)',
        quoteSent: true,
        quoteAmount: 8000,
        followups: [
          { time: '2026-10-01 11:00', note: 'Spoke with parent; sent Junior membership quote (₹ 8,000/yr).' },
          { time: '2026-10-02 18:00', note: 'Parent completed club tour; scheduled trial coaching session.' },
          { time: '2026-10-03 11:30', note: 'Converted to Junior member CC-MEM-00106.' }
        ],
        memberId: 'CC-MEM-00106'
      },
      {
        id: 'CC-ENQ-0004',
        name: 'Natasha Kapoor',
        phone: '+91 98450 99887',
        email: 'natasha.k@example.com',
        plan: 'gold',
        sport: 'tennis',
        message: 'Enrolled after court trial session.',
        stage: 'converted',
        staff: 'Pooja Patel (Membership Advisor)',
        quoteSent: true,
        quoteAmount: 24000,
        followups: [
          { time: '2026-09-28 14:00', note: 'Initial enquiry regarding tennis clay courts.' },
          { time: '2026-09-30 11:30', note: 'Quote accepted; membership profile created.' }
        ],
        memberId: 'CC-MEM-00105'
      }
    ]
  };

  // Memory cache
  let _cachedStore = {};
  let _syncPromise = null;

  // Safe Loader with Memory Cache and localStorage priority
  function load(key, defaultData) {
    if (_cachedStore[key] && Array.isArray(_cachedStore[key]) && _cachedStore[key].length > 0) {
      return JSON.parse(JSON.stringify(_cachedStore[key]));
    }
    if (_cachedStore[key] && typeof _cachedStore[key] === 'object' && !Array.isArray(_cachedStore[key])) {
      return JSON.parse(JSON.stringify(_cachedStore[key]));
    }

    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        _cachedStore[key] = parsed;
        return parsed;
      }
    } catch (e) {
      console.warn(`Error loading key ${key} from storage:`, e);
    }
    return JSON.parse(JSON.stringify(defaultData));
  }

  // Safe Saver with local storage and background server persistence
  function save(key, data) {
    _cachedStore[key] = data;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`Error saving key ${key} to local storage:`, e);
    }

    // Persist to Central Server
    if (typeof fetch === 'function') {
      try {
        fetch('/api/datastore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, data })
        }).catch(() => {});
      } catch (err) {}
    }
  }

  // Asynchronous Server Synchronizer
  async function syncWithServer() {
    if (typeof fetch !== 'function') return false;
    try {
      const res = await fetch('/api/datastore', { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.data) {
          const serverStore = json.data;
          Object.keys(serverStore).forEach(k => {
            _cachedStore[k] = serverStore[k];
            try {
              localStorage.setItem(k, JSON.stringify(serverStore[k]));
            } catch (e) {}
          });
          return true;
        }
      }
    } catch (e) {
      // Server offline or static fallback
    }
    return false;
  }

  // Auto-trigger sync immediately
  if (typeof window !== 'undefined') {
    _syncPromise = syncWithServer();
  }

  return {
    // Sync Utilities
    async ensureSynced() {
      if (_syncPromise) {
        await _syncPromise;
      } else {
        await syncWithServer();
      }
    },
    syncWithServer,

    // Member Operations
    getMembers() {
      return load(KEYS.MEMBERS, SEED_DATA.members);
    },
    saveMembers(data) {
      save(KEYS.MEMBERS, data);
    },

    // Booking Operations
    getBookings() {
      return load(KEYS.BOOKINGS, SEED_DATA.bookings);
    },
    saveBookings(data) {
      save(KEYS.BOOKINGS, data);
    },

    // Shop Product Catalog
    getProducts() {
      return load(KEYS.PRODUCTS, SEED_DATA.products);
    },
    saveProducts(data) {
      save(KEYS.PRODUCTS, data);
    },

    // Shop Orders
    getShopOrders() {
      return load(KEYS.SHOP_ORDERS, SEED_DATA.shopOrders);
    },
    saveShopOrders(data) {
      save(KEYS.SHOP_ORDERS, data);
    },

    // Bar / Cafeteria
    getBarTables() {
      return load(KEYS.BAR_TABLES, SEED_DATA.barTables);
    },
    saveBarTables(data) {
      save(KEYS.BAR_TABLES, data);
    },

    getBarTabs() {
      return load(KEYS.BAR_TABS, SEED_DATA.barTabs);
    },
    saveBarTabs(data) {
      save(KEYS.BAR_TABS, data);
    },

    getBarRevenue() {
      return load(KEYS.BAR_REVENUE, SEED_DATA.barRevenue);
    },
    saveBarRevenue(data) {
      save(KEYS.BAR_REVENUE, data);
    },

    // Enquiries & CRM Leads
    getLeads() {
      return load(KEYS.LEADS, SEED_DATA.leads);
    },
    saveLeads(data) {
      save(KEYS.LEADS, data);
    },

    // Seed or Reset to Baseline DATA
    resetToDemoData() {
      save(KEYS.MEMBERS, SEED_DATA.members);
      save(KEYS.BOOKINGS, SEED_DATA.bookings);
      save(KEYS.PRODUCTS, SEED_DATA.products);
      save(KEYS.SHOP_ORDERS, SEED_DATA.shopOrders);
      save(KEYS.BAR_TABLES, SEED_DATA.barTables);
      save(KEYS.BAR_TABS, SEED_DATA.barTabs);
      save(KEYS.BAR_REVENUE, SEED_DATA.barRevenue);
      save(KEYS.LEADS, SEED_DATA.leads);
    },

    // Clear All Records (For testing the "No data available" requirement)
    clearAllData() {
      save(KEYS.MEMBERS, []);
      save(KEYS.BOOKINGS, []);
      save(KEYS.PRODUCTS, []);
      save(KEYS.SHOP_ORDERS, []);
      save(KEYS.BAR_TABLES, []);
      save(KEYS.BAR_TABS, []);
      save(KEYS.BAR_REVENUE, { cash: 0, card: 0, upi: 0 });
      save(KEYS.LEADS, []);
    }
  };
})();

// Attach to window for global access
if (typeof window !== 'undefined') {
  window.ClubDataStore = ClubDataStore;
}
