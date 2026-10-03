# -*- coding: utf-8 -*-
"""
CHAMPIONS CLUB — Court Booking Engine Comprehensive Test Suite
Validates all required booking rules and scenarios A through L:
A. Valid booking
B. Overlapping booking (30-min staggered)
C. Same court same time (exact collision)
D. Same member first booking
E. Same member second booking
F. Same member third booking (daily limit rejection)
G. Cancellation (instant slot release & play allowance restoration)
H. Walk-in booking (standard court pricing)
I. Expired member (booking rejection)
J. Different court same time (multi-court concurrency)
K. Adjacent/non-overlapping bookings (abutting slots)
L. Social play (Friday night shared court mode)
"""

import sys
from datetime import date, datetime, timedelta

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

class ValidationError(Exception):
    pass

class MockCourt:
    def __init__(self, id, name, sport_type, walkin_rate=500.0, opening_hour=6.0, closing_hour=23.0, slot_interval=30):
        self.id = id
        self.name = name
        self.sport_type = sport_type
        self.walkin_hourly_rate = walkin_rate
        self.opening_hour = opening_hour
        self.closing_hour = closing_hour
        self.slot_interval_minutes = slot_interval

class MockPlan:
    def __init__(self, id, name, code, court_policy, hourly_rate=0.0):
        self.id = id
        self.name = name
        self.code = code
        self.court_rate_policy = court_policy  # 'free', 'discounted', 'standard'
        self.court_hourly_rate = hourly_rate

class MockMember:
    def __init__(self, id, name, plan, start_date=None, end_date=None, state='active'):
        self.id = id
        self.name = name
        self.plan_id = plan
        self.start_date = start_date or date(2026, 1, 1)
        self.end_date = end_date or date(2026, 12, 31)
        self.state = state
        self.has_active_benefits = (state in ['active', 'expiring'])

class BookingEngine:
    def __init__(self):
        self.bookings = []
        self._next_id = 1

    def create_booking(self, court, booking_type, start_time, member=None, walkin_name=None, walkin_phone=None, is_social_play=False, state='confirmed'):
        duration_hours = 1.0  # Problem statement: Sessions last exactly 1 hour
        end_time = start_time + timedelta(hours=duration_hours)

        # 1. Slot Timing Validation: 30-minute interval boundary
        if start_time.minute not in [0, 30] or start_time.second != 0:
            raise ValidationError(
                f"INVALID_SLOT_TIMING: Court slot start time ({start_time.strftime('%H:%M:%S')}) must align with 30-minute boundaries (:00 or :30)."
            )

        # 2. Party validation
        if booking_type == 'member':
            if not member:
                raise ValidationError("MEMBER_REQUIRED: Member record must be specified for member booking.")
            
            # 3. Membership Validity Validation on Booking Date
            booking_date = start_time.date()
            if member.end_date and member.end_date < booking_date:
                raise ValidationError(
                    f"MEMBERSHIP_EXPIRED_ERROR: Member '{member.name}' membership expired on {member.end_date}. "
                    "Cannot reserve courts with expired membership."
                )
            if member.start_date and member.start_date > booking_date:
                raise ValidationError(
                    f"MEMBERSHIP_INACTIVE_ERROR: Member '{member.name}' membership starts on {member.start_date}."
                )
            if not member.has_active_benefits:
                raise ValidationError(
                    f"MEMBERSHIP_SUSPENDED_ERROR: Member '{member.name}' does not have active membership privileges (State: {member.state})."
                )
        elif booking_type == 'walkin':
            if not walkin_name:
                raise ValidationError("WALKIN_NAME_REQUIRED: Walk-in customer name is required.")

        # 4. Compute applied pricing (Configurable)
        if booking_type == 'member' and member and member.plan_id:
            if member.plan_id.court_rate_policy == 'free':
                rate_applied = 0.0
            else:
                rate_applied = member.plan_id.court_hourly_rate
        else:
            rate_applied = court.walkin_hourly_rate

        booking_record = {
            'id': self._next_id,
            'name': f"CC-BK-{self._next_id:04d}",
            'court_id': court,
            'sport_type': court.sport_type,
            'booking_type': booking_type,
            'member_id': member,
            'walkin_name': walkin_name,
            'walkin_phone': walkin_phone,
            'start_time': start_time,
            'end_time': end_time,
            'duration_hours': duration_hours,
            'is_social_play': is_social_play,
            'rate_applied': rate_applied,
            'state': state
        }

        # 5. Server-Side Double Booking Check
        self._validate_double_booking(booking_record)

        # 6. Server-Side Daily Play Limit Check (Max 2 per member per day)
        self._validate_daily_limit(booking_record)

        self.bookings.append(booking_record)
        self._next_id += 1
        return booking_record

    def cancel_booking(self, booking_id):
        for b in self.bookings:
            if b['id'] == booking_id:
                b['state'] = 'cancelled'
                return b
        raise ValueError(f"Booking ID {booking_id} not found.")

    def _validate_double_booking(self, record):
        if record['state'] == 'cancelled' or record['is_social_play']:
            return

        for existing in self.bookings:
            if existing['id'] == record['id']:
                continue
            if existing['state'] == 'cancelled' or existing['is_social_play']:
                continue
            if existing['court_id'].id != record['court_id'].id:
                continue

            # Overlap condition: start_time < existing.end_time AND end_time > existing.start_time
            if record['start_time'] < existing['end_time'] and record['end_time'] > existing['start_time']:
                raise ValidationError(
                    f"DOUBLE_BOOKING_ERROR: Court '{record['court_id'].name}' is already booked from "
                    f"{existing['start_time'].strftime('%H:%M')} to {existing['end_time'].strftime('%H:%M')} "
                    f"by booking {existing['name']}."
                )

    def _validate_daily_limit(self, record):
        if record['booking_type'] != 'member' or not record['member_id'] or record['state'] == 'cancelled':
            return

        booking_date = record['start_time'].date()
        daily_count = 0
        for existing in self.bookings:
            if existing['id'] == record['id'] or existing['state'] == 'cancelled':
                continue
            if existing['booking_type'] == 'member' and existing['member_id'].id == record['member_id'].id:
                if existing['start_time'].date() == booking_date:
                    daily_count += 1

        if daily_count >= 2:
            raise ValidationError(
                f"DAILY_LIMIT_ERROR: Member '{record['member_id'].name}' already has {daily_count} bookings on {booking_date}. "
                "Each member can play at most twice a day."
            )

    def generate_slots(self, court, target_date, member=None):
        """Generates 30-minute interval 1-hour slots from court operating hours."""
        start_dt = datetime.combine(target_date, datetime.min.time()).replace(hour=int(court.opening_hour))
        close_dt = datetime.combine(target_date, datetime.min.time()).replace(hour=int(court.closing_hour))
        interval = timedelta(minutes=court.slot_interval_minutes)
        session_dur = timedelta(hours=1.0)

        slots = []
        curr = start_dt
        while curr + session_dur <= close_dt:
            slot_end = curr + session_dur
            
            # Check availability
            conflicting = None
            is_social = False
            for b in self.bookings:
                if b['court_id'].id == court.id and b['state'] != 'cancelled':
                    if b['is_social_play']:
                        if b['start_time'] < slot_end and b['end_time'] > curr:
                            is_social = True
                    else:
                        if b['start_time'] < slot_end and b['end_time'] > curr:
                            conflicting = b
                            break

            rate = court.walkin_hourly_rate
            if member and member.has_active_benefits and member.plan_id:
                rate = 0.0 if member.plan_id.court_rate_policy == 'free' else member.plan_id.court_hourly_rate

            slots.append({
                'start_time': curr,
                'end_time': slot_end,
                'label': f"{curr.strftime('%H:%M')}–{slot_end.strftime('%H:%M')}",
                'is_available': (conflicting is None),
                'is_social_play': is_social,
                'conflicting_booking': conflicting['name'] if conflicting else None,
                'rate': rate
            })
            curr += interval

        return slots


def run_tests():
    print("=" * 80)
    print("CHAMPIONS CLUB — COMPLETE COURT BOOKING ENGINE TEST SUITE (A to L)")
    print("=" * 80)

    # Master Facilities & Plans
    plan_gold = MockPlan(1, "Gold (Full Access)", "gold", "free", 0.0)
    plan_silver = MockPlan(2, "Silver (Standard)", "silver", "discounted", 300.0)
    plan_junior = MockPlan(3, "Junior (Under 18)", "junior", "discounted", 200.0)

    member_gold = MockMember(101, "David Vance (Gold)", plan_gold)
    member_silver = MockMember(102, "Elena Rostova (Silver)", plan_silver)
    member_junior = MockMember(103, "Leo Chen (Junior)", plan_junior)
    member_expired = MockMember(104, "Vikram Mehta (Expired)", plan_silver, start_date=date(2025, 8, 1), end_date=date(2026, 8, 1), state='expired')

    court_tennis_1 = MockCourt(1, "Tennis Court 1 (Clay)", "tennis", walkin_rate=500.0)
    court_tennis_2 = MockCourt(2, "Tennis Court 2 (Hard)", "tennis", walkin_rate=500.0)
    court_cricket_1 = MockCourt(3, "Cricket Pitch & Net 1 (Turf)", "cricket", walkin_rate=600.0)
    court_badminton_1 = MockCourt(4, "Badminton Court 1 (Indoor)", "badminton", walkin_rate=400.0)

    engine = BookingEngine()
    test_day = date(2026, 10, 3)

    results = []

    def report_test(test_code, title, input_desc, expected_desc, actual_desc, status):
        print(f"\n[{test_code}] {title}")
        print(f"  INPUT:    {input_desc}")
        print(f"  EXPECTED: {expected_desc}")
        print(f"  ACTUAL:   {actual_desc}")
        print(f"  STATUS:   {status}")
        results.append((test_code, title, status))

    # -------------------------------------------------------------------------
    # TEST A: Valid Booking
    # -------------------------------------------------------------------------
    start_a = datetime(2026, 10, 3, 18, 0)
    b_a = engine.create_booking(court_tennis_1, 'member', start_a, member=member_gold)
    actual_a = f"Booking Confirmed: {b_a['name']} ({b_a['start_time'].strftime('%H:%M')}–{b_a['end_time'].strftime('%H:%M')}), Rate: ₹ {b_a['rate_applied']:.2f} (Free Gold Entitlement)"
    passed_a = (b_a['state'] == 'confirmed' and b_a['rate_applied'] == 0.0 and b_a['duration_hours'] == 1.0)
    report_test(
        "TEST A", "Valid Booking",
        f"Court: Tennis Court 1, Type: Member ({member_gold.name}), Time: 2026-10-03 18:00 (1 hour)",
        "Booking Confirmed, Duration: 1.0 hr, Applied Rate: ₹ 0.00 (Gold Plan)",
        actual_a,
        "PASS" if passed_a else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST B: Overlapping Booking (30-minute staggered overlap)
    # -------------------------------------------------------------------------
    start_b = datetime(2026, 10, 3, 18, 30)
    caught_b = False
    actual_b = ""
    try:
        engine.create_booking(court_tennis_1, 'walkin', start_b, walkin_name="Maria Garcia")
    except ValidationError as e:
        caught_b = True
        actual_b = f"Rejection: {e}"
    report_test(
        "TEST B", "Overlapping Booking (30-min Staggered)",
        f"Court: Tennis Court 1, Time: 2026-10-03 18:30–19:30 (overlaps with existing 18:00–19:00 booking)",
        "Server-side DOUBLE_BOOKING_ERROR rejecting reservation due to 30-min overlap",
        actual_b,
        "PASS" if caught_b else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST C: Same Court Same Time (Exact Collision)
    # -------------------------------------------------------------------------
    start_c = datetime(2026, 10, 3, 18, 0)
    caught_c = False
    actual_c = ""
    try:
        engine.create_booking(court_tennis_1, 'member', start_c, member=member_silver)
    except ValidationError as e:
        caught_c = True
        actual_c = f"Rejection: {e}"
    report_test(
        "TEST C", "Same Court Same Time (Exact Collision)",
        f"Court: Tennis Court 1, Time: 2026-10-03 18:00–19:00 (exact time as CC-BK-0001)",
        "Server-side DOUBLE_BOOKING_ERROR rejecting exact collision",
        actual_c,
        "PASS" if caught_c else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST D: Same Member First Booking
    # -------------------------------------------------------------------------
    start_d = datetime(2026, 10, 3, 7, 0)
    b_d = engine.create_booking(court_tennis_2, 'member', start_d, member=member_silver)
    actual_d = f"Booking Confirmed: {b_d['name']} for {member_silver.name}, Applied Rate: ₹ {b_d['rate_applied']:.2f} (Silver Disc Rate)"
    passed_d = (b_d['state'] == 'confirmed' and b_d['rate_applied'] == 300.0)
    report_test(
        "TEST D", "Same Member First Booking",
        f"Member: {member_silver.name}, Court: Tennis Court 2, Time: 2026-10-03 07:00–08:00 (Play #1 of day)",
        "Booking Confirmed, Daily Plays: 1/2, Rate: ₹ 300.00",
        actual_d,
        "PASS" if passed_d else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST E: Same Member Second Booking
    # -------------------------------------------------------------------------
    start_e = datetime(2026, 10, 3, 16, 0)
    b_e = engine.create_booking(court_tennis_2, 'member', start_e, member=member_silver)
    actual_e = f"Booking Confirmed: {b_e['name']} for {member_silver.name}, Daily Plays Count: 2/2"
    passed_e = (b_e['state'] == 'confirmed')
    report_test(
        "TEST E", "Same Member Second Booking",
        f"Member: {member_silver.name}, Court: Tennis Court 2, Time: 2026-10-03 16:00–17:00 (Play #2 of day)",
        "Booking Confirmed, Daily Plays: 2/2 (Max allowable plays reached)",
        actual_e,
        "PASS" if passed_e else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST F: Same Member Third Booking (Daily Limit Rejection)
    # -------------------------------------------------------------------------
    start_f = datetime(2026, 10, 3, 20, 0)
    caught_f = False
    actual_f = ""
    try:
        engine.create_booking(court_tennis_2, 'member', start_f, member=member_silver)
    except ValidationError as e:
        caught_f = True
        actual_f = f"Rejection: {e}"
    report_test(
        "TEST F", "Same Member Third Booking",
        f"Member: {member_silver.name}, Court: Tennis Court 2, Time: 2026-10-03 20:00–21:00 (Attempted Play #3)",
        "Server-side DAILY_LIMIT_ERROR rejecting 3rd booking on same calendar day",
        actual_f,
        "PASS" if caught_f else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST G: Cancellation and Slot Re-booking
    # -------------------------------------------------------------------------
    # Cancel b_a (Tennis Court 1 from 18:00–19:00)
    cancelled_rec = engine.cancel_booking(b_a['id'])
    # Now attempt booking by Junior Member on Tennis Court 1 at 18:00
    b_g = engine.create_booking(court_tennis_1, 'member', start_a, member=member_junior)
    actual_g = f"Cancelled {cancelled_rec['name']} (State: {cancelled_rec['state']}); Freed slot re-booked: {b_g['name']} for {member_junior.name} at ₹ {b_g['rate_applied']:.2f}"
    passed_g = (cancelled_rec['state'] == 'cancelled' and b_g['state'] == 'confirmed' and b_g['rate_applied'] == 200.0)
    report_test(
        "TEST G", "Cancellation & Instant Slot Release",
        f"Cancel {b_a['name']} (18:00-19:00), then book Tennis Court 1 for {member_junior.name} at 18:00",
        "Previous booking marked Cancelled; court slot instantly released; new booking Confirmed",
        actual_g,
        "PASS" if passed_g else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST H: Walk-in Booking
    # -------------------------------------------------------------------------
    start_h = datetime(2026, 10, 3, 17, 0)
    b_h = engine.create_booking(court_cricket_1, 'walkin', start_h, walkin_name="Rahul Sharma", walkin_phone="+91 98980 11223")
    actual_h = f"Walk-in Booking Confirmed: {b_h['name']} for '{b_h['walkin_name']}', Applied Rate: ₹ {b_h['rate_applied']:.2f} (Cricket Walk-in Rate)"
    passed_h = (b_h['state'] == 'confirmed' and b_h['rate_applied'] == 600.0 and b_h['booking_type'] == 'walkin')
    report_test(
        "TEST H", "Walk-in Booking",
        "Court: Cricket Pitch & Net 1, Type: Walk-in (Rahul Sharma), Time: 2026-10-03 17:00–18:00",
        "Booking Confirmed, Applied Rate: ₹ 600.00 (Standard Walk-in Rate)",
        actual_h,
        "PASS" if passed_h else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST I: Expired Member Booking Rejection
    # -------------------------------------------------------------------------
    start_i = datetime(2026, 10, 3, 10, 0)
    caught_i = False
    actual_i = ""
    try:
        engine.create_booking(court_tennis_2, 'member', start_i, member=member_expired)
    except ValidationError as e:
        caught_i = True
        actual_i = f"Rejection: {e}"
    report_test(
        "TEST I", "Expired Member Booking",
        f"Member: {member_expired.name} (Expired on {member_expired.end_date}), Time: 2026-10-03 10:00",
        "Server-side MEMBERSHIP_EXPIRED_ERROR rejecting booking due to lapsed validity",
        actual_i,
        "PASS" if caught_i else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST J: Different Court Same Time (Multi-Court Concurrency)
    # -------------------------------------------------------------------------
    start_j = datetime(2026, 10, 3, 17, 0)  # Same time as Cricket Pitch 1 walk-in
    b_j = engine.create_booking(court_badminton_1, 'member', start_j, member=member_junior)
    actual_j = f"Simultaneous Booking Confirmed: {b_j['name']} on {b_j['court_id'].name} at {start_j.strftime('%H:%M')}"
    passed_j = (b_j['state'] == 'confirmed' and b_j['court_id'].id == court_badminton_1.id)
    report_test(
        "TEST J", "Different Court Same Time",
        f"Court: Badminton Court 1, Time: 2026-10-03 17:00–18:00 (Concurrent with Cricket Court booking)",
        "Booking Confirmed (No cross-court interference)",
        actual_j,
        "PASS" if passed_j else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST K: Adjacent / Non-Overlapping Bookings (Abutting Slots)
    # -------------------------------------------------------------------------
    start_k = datetime(2026, 10, 3, 19, 0)  # Abutting immediately after b_g (18:00–19:00)
    b_k = engine.create_booking(court_tennis_1, 'walkin', start_k, walkin_name="Karan Johar")
    actual_k = f"Abutting Booking Confirmed: {b_k['name']} ({b_k['start_time'].strftime('%H:%M')}–{b_k['end_time'].strftime('%H:%M')}) immediately following 18:00–19:00 session"
    passed_k = (b_k['state'] == 'confirmed' and b_k['start_time'] == datetime(2026, 10, 3, 19, 0))
    report_test(
        "TEST K", "Adjacent / Non-Overlapping Bookings",
        "Court: Tennis Court 1, Time: 2026-10-03 19:00–20:00 (Starts exactly when previous session ends)",
        "Booking Confirmed with 0-minute buffer conflict",
        actual_k,
        "PASS" if passed_k else "FAIL"
    )

    # -------------------------------------------------------------------------
    # TEST L: Social Play Session (Friday Night Shared Court)
    # -------------------------------------------------------------------------
    friday_social_time = datetime(2026, 10, 9, 19, 0)  # Friday 19:00
    soc_1 = engine.create_booking(court_tennis_1, 'member', friday_social_time, member=member_gold, is_social_play=True)
    soc_2 = engine.create_booking(court_tennis_1, 'member', friday_social_time, member=member_silver, is_social_play=True)
    actual_l = f"Social Session Confirmed: Participant 1 ({soc_1['name']}, {member_gold.name}), Participant 2 ({soc_2['name']}, {member_silver.name}) on shared court"
    passed_l = (soc_1['is_social_play'] and soc_2['is_social_play'] and soc_1['state'] == 'confirmed' and soc_2['state'] == 'confirmed')
    report_test(
        "TEST L", "Social Play (Friday Night Shared Court)",
        f"Court: Tennis Court 1, Time: Friday 2026-10-09 19:00–20:00, Mode: is_social_play=True, 2 Members",
        "Both participants successfully registered on shared court without double-booking collision",
        actual_l,
        "PASS" if passed_l else "FAIL"
    )

    # -------------------------------------------------------------------------
    # SUMMARY TABLE
    # -------------------------------------------------------------------------
    print("\n" + "=" * 80)
    print("COURT BOOKING ENGINE VALIDATION SUMMARY (TESTS A TO L)")
    print("=" * 80)
    print(f"{'Test':<8} | {'Description':<40} | {'Status'}")
    print("-" * 80)
    for code, title, status in results:
        print(f"{code:<8} | {title:<40} | {status}")
    print("=" * 80)
    assert all(st == "PASS" for _, _, st in results), "All tests must pass!"
    print(f"✓ ALL {len(results)} BACKEND BOOKING TESTS COMPLETED WITH 100% SUCCESS!\n")

if __name__ == '__main__':
    run_tests()
