import json
import sys
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000"

def rpc_call(endpoint, data):
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return {'success': False, 'error': f"HTTP {e.code}: {e.reason}"}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def run_all_tests():
    print("==================================================")
    print("STARTING PLAYNEX COURT BOOKING RULE VALIDATION SUITE")
    print("==================================================")

    results = {}

    # Reset test store state if needed or inspect plans
    plans_res = rpc_call("/champions_club/membership/plans", {})
    print(f"Plans API result: {plans_res.get('success')} with {len(plans_res.get('plans', []))} plans")
    for p in plans_res.get('plans', []):
        print(f" - Plan {p.get('name')}: max_booking_hours = {p.get('max_booking_hours')}")

    test_date = "2026-10-15"

    # Clean up any existing bookings for test_date to ensure a clean slate
    import os
    store_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'club_store.json')
    if os.path.exists(store_path):
        with open(store_path, 'r', encoding='utf-8') as f:
            store_data = json.load(f)
        store_data['cc_bookings'] = [b for b in store_data.get('cc_bookings', []) if b.get('date') != test_date]
        with open(store_path, 'w', encoding='utf-8') as f:
            json.dump(store_data, f, indent=2)

    # TEST 1: Gold + 1 hour + available
    print("\n--- TEST 1: Gold + 1 hour + available ---")
    t1_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "1",
        "start_time": f"{test_date} 08:00:00",
        "duration_hours": 1,
        "booking_type": "member",
        "member_id": "CC-MEM-00101" # David Vance (Gold)
    })
    print("Test 1 Result:", t1_res)
    assert t1_res.get('success') == True, f"Expected success, got {t1_res}"
    results["TEST 1 (Gold 1h)"] = "PASSED"

    # TEST 2: Gold + 2 hours + available (09:00 - 11:00)
    print("\n--- TEST 2: Gold + 2 hours + available ---")
    # Note: David Vance has 1 booking today. He can book a 2nd booking.
    t2_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "2",
        "start_time": f"{test_date} 09:00:00",
        "duration_hours": 2,
        "booking_type": "member",
        "member_id": "CC-MEM-00101" # David Vance (Gold)
    })
    print("Test 2 Result:", t2_res)
    assert t2_res.get('success') == True, f"Expected success, got {t2_res}"
    results["TEST 2 (Gold 2h)"] = "PASSED"

    # TEST 12: Existing maximum-two-plays-per-day rule (David Vance now has 2 bookings on 2026-10-10, 3rd should fail)
    print("\n--- TEST 12: Max 2 plays per day rule ---")
    t12_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "1",
        "start_time": f"{test_date} 14:00:00",
        "duration_hours": 1,
        "booking_type": "member",
        "member_id": "CC-MEM-00101"
    })
    print("Test 12 Result:", t12_res)
    assert t12_res.get('success') == False and "Daily Limit Exceeded" in t12_res.get('error', ''), f"Expected Daily Limit Exceeded, got {t12_res}"
    results["TEST 12 (Max 2 plays/day)"] = "PASSED"

    # Create another Gold member for multi-hour tests
    # TEST 3: Gold + 3 hours + available (10:00 - 13:00 on Court 4)
    # Let's use Elena or create test booking with Gold member (let's create/use Elena temporarily upgraded or a new Gold member)
    print("\n--- TEST 3: Gold + 3 hours + available ---")
    # Member CC-MEM-00105 or create new Gold member
    create_mem_res = rpc_call("/champions_club/membership/create", {
        "name": "Roger Federer",
        "email": "roger@tennis.org",
        "phone": "+91 99001 00001",
        "plan_code": "gold",
        "start_date": "2026-10-01",
        "end_date": "2027-10-01",
        "state": "active"
    })
    gold_id = create_mem_res.get('member_code', 'CC-MEM-00105')
    print("Created Gold Member:", gold_id)

    t3_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "4",
        "start_time": f"{test_date} 10:00:00",
        "duration_hours": 3,
        "booking_type": "member",
        "member_id": gold_id
    })
    print("Test 3 Result:", t3_res)
    assert t3_res.get('success') == True, f"Expected success, got {t3_res}"
    results["TEST 3 (Gold 3h)"] = "PASSED"

    # TEST 4: Gold + 3 hours + middle slot booked
    # Setup: Court 5 on test_date: 11:00-12:00 is booked.
    print("\n--- TEST 4: Gold + 3 hours + middle slot booked ---")
    # Book middle slot 11:00 - 12:00 on Court 5
    mid_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "5",
        "start_time": f"{test_date} 11:00:00",
        "duration_hours": 1,
        "booking_type": "walkin",
        "walkin_name": "Existing Middle Player"
    })
    print("Setup Middle Booking on Court 5 (11-12):", mid_res)
    existing_mid_id = mid_res.get('reference')

    # Attempt 3-hour Gold booking from 10:00 to 13:00 on Court 5
    create_mem_res2 = rpc_call("/champions_club/membership/create", {
        "name": "Rafael Nadal",
        "email": "rafa@tennis.org",
        "phone": "+91 99001 00002",
        "plan_code": "gold",
        "start_date": "2026-10-01",
        "end_date": "2027-10-01",
        "state": "active"
    })
    gold_id_2 = create_mem_res2.get('member_code')

    t4_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "5",
        "start_time": f"{test_date} 10:00:00",
        "duration_hours": 3,
        "booking_type": "member",
        "member_id": gold_id_2
    })
    print("Test 4 Result:", t4_res)
    assert t4_res.get('success') == False, f"Expected rejection, got {t4_res}"
    assert "already booked" in t4_res.get('error', ''), f"Expected conflict error message, got {t4_res.get('error')}"
    results["TEST 4 (Gold 3h middle slot booked rejected)"] = "PASSED"

    # TEST 9: Existing booking must remain unchanged after failed longer booking
    print("\n--- TEST 9: Existing booking unchanged ---")
    # Verify the middle booking on Court 5 still exists and is confirmed
    # Let's inspect store
    with open(store_path, "r", encoding="utf-8") as f:
        store_data = json.load(f)
    mid_bk = next((b for b in store_data.get('cc_bookings', []) if b.get('id') == existing_mid_id), None)
    print("Existing middle booking status:", mid_bk)
    assert mid_bk is not None, "Existing booking was deleted!"
    assert "Existing Middle Player" in mid_bk.get('playerName', ''), "Existing booking player was changed!"
    results["TEST 9 (Existing booking unchanged)"] = "PASSED"

    # Create active Silver Member
    create_silver_res = rpc_call("/champions_club/membership/create", {
        "name": "Elena Rostova",
        "email": "elena.silver@example.com",
        "phone": "+91 98200 11002",
        "plan_code": "silver",
        "start_date": "2026-10-01",
        "end_date": "2027-10-01",
        "state": "active"
    })
    silver_id = create_silver_res.get('member_code')
    print("Created Silver Member:", silver_id)

    # TEST 5: Silver + 2 hours + available
    print("\n--- TEST 5: Silver + 2 hours + available ---")
    t5_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "6",
        "start_time": f"{test_date} 09:00:00",
        "duration_hours": 2,
        "booking_type": "member",
        "member_id": silver_id
    })
    print("Test 5 Result:", t5_res)
    assert t5_res.get('success') == True, f"Expected success, got {t5_res}"
    results["TEST 5 (Silver 2h)"] = "PASSED"

    # TEST 6: Silver attempting 3 hours -> Not allowed
    print("\n--- TEST 6: Silver attempting 3 hours ---")
    t6_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "6",
        "start_time": f"{test_date} 14:00:00",
        "duration_hours": 3,
        "booking_type": "member",
        "member_id": silver_id
    })
    print("Test 6 Result:", t6_res)
    assert t6_res.get('success') == False, f"Expected rejection, got {t6_res}"
    assert "Duration Limit Exceeded" in t6_res.get('error', ''), f"Expected duration limit error, got {t6_res}"
    results["TEST 6 (Silver 3h rejected)"] = "PASSED"

    # Create active Junior Member
    create_junior_res = rpc_call("/champions_club/membership/create", {
        "name": "Leo Chen",
        "email": "leo.junior@example.com",
        "phone": "+91 98200 11003",
        "plan_code": "junior",
        "start_date": "2026-10-01",
        "end_date": "2027-10-01",
        "state": "active"
    })
    junior_id = create_junior_res.get('member_code')
    print("Created Junior Member:", junior_id)

    # TEST 7: Junior + 1 hour -> Allowed
    print("\n--- TEST 7: Junior + 1 hour ---")
    t7_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "3",
        "start_time": f"{test_date} 14:00:00",
        "duration_hours": 1,
        "booking_type": "member",
        "member_id": junior_id
    })
    print("Test 7 Result:", t7_res)
    assert t7_res.get('success') == True, f"Expected success, got {t7_res}"
    results["TEST 7 (Junior 1h)"] = "PASSED"

    # TEST 8: Junior attempting 2 hours -> Not allowed
    print("\n--- TEST 8: Junior attempting 2 hours ---")
    t8_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "3",
        "start_time": f"{test_date} 16:00:00",
        "duration_hours": 2,
        "booking_type": "member",
        "member_id": junior_id
    })
    print("Test 8 Result:", t8_res)
    assert t8_res.get('success') == False, f"Expected rejection, got {t8_res}"
    assert "Duration Limit Exceeded" in t8_res.get('error', ''), f"Expected duration limit error, got {t8_res}"
    results["TEST 8 (Junior 2h rejected)"] = "PASSED"

    # TEST 10: Two users attempting the same court/time -> Only one confirmed booking
    print("\n--- TEST 10: Double booking conflict between two users ---")
    user1_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "1",
        "start_time": f"{test_date} 18:00:00",
        "duration_hours": 1,
        "booking_type": "walkin",
        "walkin_name": "User Alpha"
    })
    print("User 1 Booking:", user1_res)
    assert user1_res.get('success') == True

    user2_res = rpc_call("/champions_club/bookings/create", {
        "court_id": "1",
        "start_time": f"{test_date} 18:00:00",
        "duration_hours": 1,
        "booking_type": "walkin",
        "walkin_name": "User Beta"
    })
    print("User 2 Booking on same court/slot:", user2_res)
    assert user2_res.get('success') == False
    assert "already booked" in user2_res.get('error', '')
    results["TEST 10 (Concurrent clash only 1 confirmed)"] = "PASSED"

    # TEST 11: Cancelled booking should behave according to existing cancellation logic (instantly release slot)
    print("\n--- TEST 11: Cancellation slot release ---")
    cancel_res = rpc_call("/champions_club/bookings/cancel", {
        "booking_id": user1_res.get('reference')
    })
    print("Cancel Result:", cancel_res)
    assert cancel_res.get('success') == True

    # Now User 2 attempts to book the same released slot
    user2_retry = rpc_call("/champions_club/bookings/create", {
        "court_id": "1",
        "start_time": f"{test_date} 18:00:00",
        "duration_hours": 1,
        "booking_type": "walkin",
        "walkin_name": "User Beta"
    })
    print("User 2 Retry after cancellation:", user2_retry)
    assert user2_retry.get('success') == True
    results["TEST 11 (Cancellation slot release)"] = "PASSED"

    print("\n==================================================")
    print("SUMMARY OF TEST RESULTS:")
    print("==================================================")
    for k, v in results.items():
        print(f" {k}: {v}")
    print("==================================================")

if __name__ == "__main__":
    run_all_tests()
