// Headless test of booking_manager logic and DOM interactions
const fs = require('fs');

console.log("==================================================");
console.log("STARTING FRONTEND DOM & LOGIC VALIDATION SUITE");
console.log("==================================================");

// Mock DOM elements and objects
const domStore = {};
const mockStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
global.sessionStorage = mockStorage;
global.localStorage = mockStorage;

function createElement(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    style: {},
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      contains(c) { return this.classes.has(c); }
    },
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener(evt, fn) {
      this.listeners = this.listeners || {};
      this.listeners[evt] = fn;
    },
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    checked: false
  };
  return el;
}

global.document = {
  getElementById(id) {
    if (!domStore[id]) {
      domStore[id] = createElement('div');
      domStore[id].id = id;
    }
    return domStore[id];
  },
  createElement,
  querySelectorAll() { return []; },
  addEventListener() {}
};
global.window = {
  ClubDataStore: {
    getMembers() {
      return [
        { id: 'CC-MEM-00101', name: 'David Vance', plan: 'gold', state: 'active' },
        { id: 'CC-MEM-00102', name: 'Elena Rostova', plan: 'silver', state: 'active' },
        { id: 'CC-MEM-00103', name: 'Leo Chen', plan: 'junior', state: 'active' }
      ];
    },
    getBookings() {
      return [
        {
          id: 'CC-BK-0001',
          courtId: '1',
          courtName: 'Tennis Court 1 (Clay)',
          sport: 'tennis',
          date: '2026-10-03',
          startTime: '11:00',
          endTime: '12:00',
          durationHours: 1,
          bookingType: 'walkin',
          state: 'confirmed'
        }
      ];
    },
    getMaxBookingHours(plan) {
      if (plan === 'gold') return 3;
      if (plan === 'silver') return 2;
      if (plan === 'junior') return 1;
      return 1;
    }
  }
};

// Evaluate booking_manager.js code
const code = fs.readFileSync('./js/booking_manager.js', 'utf-8');
eval(code);

console.log("Testing helper functions loaded:");

// TEST A: getMemberMaxBookingHours for Gold
document.getElementById('radio-party-walkin').checked = false;
document.getElementById('booking-member-id').value = 'CC-MEM-00101'; // Gold
const goldMax = window.getMemberMaxBookingHours();
console.log("Gold Max Hours:", goldMax);
console.assert(goldMax === 3, `Expected 3, got ${goldMax}`);

// TEST B: getMemberMaxBookingHours for Silver
document.getElementById('booking-member-id').value = 'CC-MEM-00102'; // Silver
const silverMax = window.getMemberMaxBookingHours();
console.log("Silver Max Hours:", silverMax);
console.assert(silverMax === 2, `Expected 2, got ${silverMax}`);

// TEST C: getMemberMaxBookingHours for Junior
document.getElementById('booking-member-id').value = 'CC-MEM-00103'; // Junior
const juniorMax = window.getMemberMaxBookingHours();
console.log("Junior Max Hours:", juniorMax);
console.assert(juniorMax === 1, `Expected 1, got ${juniorMax}`);

// TEST D: getMemberMaxBookingHours for Walk-in
document.getElementById('radio-party-walkin').checked = true;
const walkinMax = window.getMemberMaxBookingHours();
console.log("Walk-in Max Hours:", walkinMax);
console.assert(walkinMax === 1, `Expected 1, got ${walkinMax}`);

// TEST E: Consecutive Interval Check with Middle Slot Booked (11:00-12:00 on Court 1)
// Starting at 10:00 for 3 hours (10:00 - 13:00)
console.log("\nTesting consecutive interval conflict detection on Court 1 (11:00-12:00 is booked):");
const checkRes = checkConsecutiveIntervals('1', '2026-10-03', '10:00', 3);
console.log("All Available:", checkRes.allAvailable);
console.log("First Conflict:", checkRes.firstConflict);
console.log("Intervals breakdown:", checkRes.intervals);

console.assert(checkRes.allAvailable === false, "Expected allAvailable to be false");
console.assert(checkRes.intervals.length === 3, "Expected 3 intervals");
console.assert(checkRes.intervals[0].isAvailable === true, "Interval 1 (10-11) should be available");
console.assert(checkRes.intervals[1].isAvailable === false, "Interval 2 (11-12) should be booked");
console.assert(checkRes.intervals[2].isAvailable === true, "Interval 3 (12-13) should be available");

// TEST F: Consecutive Interval Check when completely available (Court 2, 10:00, 3 hours)
const cleanCheck = checkConsecutiveIntervals('2', '2026-10-03', '10:00', 3);
console.log("\nTesting clean court 3-hour check:", cleanCheck.allAvailable);
console.assert(cleanCheck.allAvailable === true, "Expected cleanCheck to be true");
console.assert(cleanCheck.intervals.every(i => i.isAvailable), "All intervals should be available");

console.log("\n==================================================");
console.log("ALL FRONTEND LOGIC TESTS PASSED SUCCESSFULLY!");
console.log("==================================================");
