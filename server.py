#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CHAMPIONS CLUB — Unified HTTP & State Persistence Server
Serves static assets (HTML/CSS/JS) and provides real-time JSON Datastore sync across all browser tabs (including InPrivate/Incognito windows).
"""

import os
import sys
import json
import urllib.parse
from http.server import SimpleHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data', 'club_store.json')

DEFAULT_STORE = {
    "cc_members": [
        {
            "id": "CC-MEM-00101",
            "member_code": "CC-MEM-00101",
            "name": "David Vance",
            "email": "david.vance@example.com",
            "phone": "+91 98234 11201",
            "plan": "gold",
            "startDate": "2026-01-01",
            "endDate": "2026-12-31",
            "state": "active",
            "history": [
                { "timestamp": "2026-01-01 10:00", "type": "signup", "desc": "Enrolled under Gold Plan (1 Year Validity)" },
                { "timestamp": "2026-02-14 18:30", "type": "checkin", "desc": "Front desk check-in for Tennis Court 1" },
                { "timestamp": "2026-03-20 19:15", "type": "checkin", "desc": "Front desk check-in for Friday Social Play" }
            ],
            "notes": "Prefers clay courts on weekend mornings."
        },
        {
            "id": "CC-MEM-00102",
            "member_code": "CC-MEM-00102",
            "name": "Elena Rostova",
            "email": "elena.rostova@example.com",
            "phone": "+91 98450 77312",
            "plan": "silver",
            "startDate": "2025-11-01",
            "endDate": "2026-10-25",
            "state": "active",
            "history": [
                { "timestamp": "2025-11-01 11:30", "type": "signup", "desc": "Enrolled under Silver Plan" },
                { "timestamp": "2026-05-10 17:00", "type": "checkin", "desc": "Front desk check-in for Cricket practice" }
            ],
            "notes": "Member requested notification upon expiry."
        },
        {
            "id": "CC-MEM-00103",
            "member_code": "CC-MEM-00103",
            "name": "Leo Chen",
            "email": "leo.chen@example.com",
            "phone": "+91 97123 90814",
            "plan": "junior",
            "startDate": "2026-03-01",
            "endDate": "2027-02-28",
            "state": "active",
            "history": [
                { "timestamp": "2026-03-01 14:00", "type": "signup", "desc": "Enrolled under Junior Plan (Under 18)" },
                { "timestamp": "2026-06-12 16:00", "type": "checkin", "desc": "Front desk check-in for Badminton session" }
            ],
            "notes": "Parent contact: Chen Wei (+91 97123 90800)."
        },
        {
            "id": "CC-MEM-00104",
            "member_code": "CC-MEM-00104",
            "name": "Vikram Mehta",
            "email": "vikram.mehta@example.com",
            "phone": "+91 98980 12345",
            "plan": "silver",
            "startDate": "2025-08-01",
            "endDate": "2026-08-01",
            "state": "expired",
            "history": [
                { "timestamp": "2025-08-01 09:00", "type": "signup", "desc": "Enrolled under Silver Plan" },
                { "timestamp": "2026-08-01 00:00", "type": "expiry", "desc": "Validity expired on August 1, 2026" }
            ],
            "notes": "Renewal follow-up pending."
        },
        {
            "id": "CC-MEM-00105",
            "member_code": "CC-MEM-00105",
            "name": "Siddharth Rao",
            "email": "siddharth.rao@example.com",
            "phone": "+91 99001 22334",
            "plan": "gold",
            "startDate": "2026-10-03",
            "endDate": "2027-10-03",
            "state": "active",
            "history": [
                { "timestamp": "2026-10-03 10:00", "type": "signup", "desc": "Enrolled under Gold Plan (Converted from CRM Lead CC-ENQ-0001)" }
            ],
            "notes": "Weekend clay court enthusiast."
        },
        {
            "id": "CC-MEM-00106",
            "member_code": "CC-MEM-00106",
            "name": "Vikramaditya Bose",
            "email": "vikram.bose@example.com",
            "phone": "+91 97110 33445",
            "plan": "junior",
            "startDate": "2026-10-03",
            "endDate": "2027-10-03",
            "state": "active",
            "history": [
                { "timestamp": "2026-10-03 11:30", "type": "signup", "desc": "Enrolled under Junior Plan (Converted from CRM Lead CC-ENQ-0003)" }
            ],
            "notes": "Youth cricket team candidate."
        },
        {
            "id": "CC-MEM-00107",
            "member_code": "CC-MEM-00107",
            "name": "Smit",
            "email": "mevawalatisha@gmail.com",
            "phone": "+91 98989 00107",
            "plan": "junior",
            "startDate": "2026-10-03",
            "endDate": "2027-10-03",
            "state": "active",
            "history": [
                { "timestamp": "2026-10-03 14:00", "type": "signup", "desc": "Enrolled under Junior Plan (Front Desk Enrollment)" }
            ],
            "notes": "Enrolled at front desk."
        },
        {
            "id": "CC-MEM-00110",
            "member_code": "CC-MEM-00110",
            "name": "Elena Rostova",
            "email": "elena.rostova@example.com",
            "phone": "+91 98450 77312",
            "plan": "silver",
            "startDate": "2025-11-01",
            "endDate": "2026-10-25",
            "state": "active",
            "history": [
                { "timestamp": "2025-11-01 11:30", "type": "signup", "desc": "Enrolled under Silver Plan" }
            ],
            "notes": "Silver Tier member."
        }
    ],
    "cc_courts": [
        { "id": "1", "name": "Tennis Court 1 (Clay)", "sport": "tennis", "surface": "Clay", "walkinRate": 500, "state": "active" },
        { "id": "2", "name": "Tennis Court 2 (Hard)", "sport": "tennis", "surface": "Hard Court", "walkinRate": 500, "state": "active" },
        { "id": "3", "name": "Cricket Pitch & Net 1 (Turf)", "sport": "cricket", "surface": "Natural Turf", "walkinRate": 600, "state": "active" },
        { "id": "4", "name": "Cricket Practice Net 2", "sport": "cricket", "surface": "Synthetic Turf", "walkinRate": 600, "state": "active" },
        { "id": "5", "name": "Badminton Court 1 (Indoor Mat)", "sport": "badminton", "surface": "Indoor Wooden/Mat", "walkinRate": 400, "state": "active" },
        { "id": "6", "name": "Badminton Court 2 (Indoor Mat)", "sport": "badminton", "surface": "Indoor Wooden/Mat", "walkinRate": 400, "state": "active" }
    ],
    "cc_products": [
        {
            "id": "p1",
            "sku": "CC-RCK-01",
            "name": "Pro Tour Carbon Tennis Racket",
            "category": "rackets",
            "price": 8500,
            "stock": 12,
            "minAlert": 4,
            "desc": "High-modulus graphite frame with synthetic gut stringing.",
            "image": "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=400&q=80"
        },
        {
            "id": "p2",
            "sku": "CC-RCK-02",
            "name": "Championship Feather Badminton Racket",
            "category": "rackets",
            "price": 4200,
            "stock": 3,
            "minAlert": 5,
            "desc": "Lightweight head-heavy balance racket for rapid smashes.",
            "image": "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=400&q=80"
        },
        {
            "id": "p3",
            "sku": "CC-BAL-01",
            "name": "Tournament Tennis Balls (Can of 3)",
            "category": "balls",
            "price": 450,
            "stock": 65,
            "minAlert": 15,
            "desc": "ITF approved championship extra-duty felt tennis balls.",
            "image": "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=400&q=80"
        },
        {
            "id": "p4",
            "sku": "CC-BAL-02",
            "name": "Match Grade 4-Piece Cricket Leather Ball",
            "category": "balls",
            "price": 750,
            "stock": 22,
            "minAlert": 8,
            "desc": "Alum tanned English leather with hand-stitched seam.",
            "image": "https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=400&q=80"
        },
        {
            "id": "p5",
            "sku": "CC-SHOE-01",
            "name": "All-Court Grip Athletic Sports Shoes",
            "category": "shoes",
            "price": 5800,
            "stock": 4,
            "minAlert": 3,
            "desc": "Non-marking herringbone gum rubber outsole for all court surfaces.",
            "image": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80"
        },
        {
            "id": "p6",
            "sku": "CC-ACC-01",
            "name": "Pro Overgrip & Vibration Dampener Pack",
            "category": "accessories",
            "price": 350,
            "stock": 40,
            "minAlert": 10,
            "desc": "Super absorbent polyurethane overgrips with club vibration dampeners.",
            "image": "https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?auto=format&fit=crop&w=400&q=80"
        },
        {
            "id": "p7",
            "sku": "CC-APP-01",
            "name": "Champions Club Performance Match Jersey",
            "category": "apparel",
            "price": 1800,
            "stock": 18,
            "minAlert": 5,
            "desc": "Moisture-wicking breathable athletic polyester club jersey.",
            "image": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=400&q=80"
        }
    ],
    "cc_shop_orders": [
        {
            "id": "CC-SO-0001",
            "channel": "counter",
            "customer": "Walk-in Guest",
            "fulfillment": "Immediate Handover",
            "items": [{ "name": "Tournament Tennis Balls (Can of 3)", "qty": 2, "price": 450 }],
            "total": 900,
            "state": "completed",
            "date": "2026-10-03"
        },
        {
            "id": "CC-SO-0002",
            "channel": "online",
            "customer": "David Vance (Gold)",
            "fulfillment": "Collect at Club (Click & Collect)",
            "items": [{ "name": "Pro Tour Carbon Tennis Racket", "qty": 1, "price": 8500 }],
            "total": 8500,
            "state": "confirmed",
            "date": "2026-10-03"
        }
    ],
    "cc_bar_tables": [
        { "id": "t1", "name": "Courtside Table 1", "capacity": 4, "area": "Courtside", "state": "occupied", "currentTab": "CC-TAB-0001" },
        { "id": "t2", "name": "Courtside Table 2", "capacity": 4, "area": "Courtside", "state": "available", "currentTab": None },
        { "id": "t3", "name": "Veranda Table 3", "capacity": 6, "area": "Veranda", "state": "available", "currentTab": None },
        { "id": "t4", "name": "Lounge Booth 4", "capacity": 8, "area": "Lounge", "state": "available", "currentTab": None }
    ],
    "cc_bar_menu": [
        { "id": "bm1", "name": "Post-Match Whey Protein Shake", "category": "Smoothies & Shakes", "price": 280, "tax": 5 },
        { "id": "bm2", "name": "Cold Pressed Green Detox Juice", "category": "Beverages", "price": 220, "tax": 5 },
        { "id": "bm3", "name": "Grilled Chicken & Quinoa Energy Bowl", "category": "Health Bowls", "price": 380, "tax": 5 },
        { "id": "bm4", "name": "Artisan Espresso / Americano", "category": "Beverages", "price": 160, "tax": 5 }
    ],
    "cc_bar_tabs": [
        {
            "id": "CC-TAB-0001",
            "memberKey": "gold",
            "memberName": "David Vance (Gold)",
            "tableId": "t1",
            "tableName": "Courtside Table 1",
            "discountPercent": 15,
            "items": [
                { "name": "[DEMO DATA] Post-Match Whey Protein Shake", "qty": 2, "price": 280 }
            ],
            "subtotal": 560,
            "discountAmount": 84,
            "netTotal": 476,
            "state": "open"
        }
    ],
    "cc_bar_revenue": {
        "cash": 240.0,
        "card": 450.0,
        "upi": 320.0
    },
    "cc_leads": [
        {
            "id": "CC-ENQ-0001",
            "name": "Siddharth Rao",
            "phone": "+91 99001 22334",
            "email": "siddharth.rao@example.com",
            "plan": "gold",
            "source": "website",
            "sport": "tennis",
            "message": "Interested in Gold membership and court availability for weekend tennis.",
            "stage": "converted",
            "staff": "Pooja Patel (Membership Advisor)",
            "quoteSent": True,
            "quoteAmount": 24000,
            "followups": [
                { "time": "2026-10-03 09:30", "note": "Website form submitted from public landing page." },
                { "time": "2026-10-03 10:00", "note": "Quote accepted; converted to member CC-MEM-00105." }
            ],
            "memberId": "CC-MEM-00105"
        },
        {
            "id": "CC-ENQ-0002",
            "name": "Ananya Deshmukh",
            "phone": "+91 98210 44556",
            "email": "ananya.d@example.com",
            "plan": "silver",
            "source": "website",
            "sport": "badminton",
            "message": "Inquiring about badminton court slots after office hours (7 PM).",
            "stage": "contacted",
            "staff": "Rohan Verma (Front Desk Lead)",
            "quoteSent": False,
            "quoteAmount": 14000,
            "followups": [
                { "time": "2026-10-02 16:45", "note": "Phone call: Discussed Silver plan entitlements and weekday slot availability." }
            ],
            "memberId": None
        }
    ],
    "cc_bookings": [
        {
            "id": "CC-BK-0001",
            "courtId": "1",
            "courtName": "Tennis Court 1 (Clay)",
            "sport": "tennis",
            "date": "2026-10-03",
            "startTime": "18:00",
            "endTime": "19:00",
            "duration": "1 Hour",
            "durationHours": 1,
            "bookingType": "member",
            "memberId": "CC-MEM-00101",
            "playerName": "David Vance (GOLD)",
            "rateApplied": "₹ 0.00 (Free)",
            "isSocial": False,
            "state": "confirmed"
        },
        {
            "id": "CC-BK-0002",
            "courtId": "3",
            "courtName": "Cricket Pitch & Net 1 (Turf)",
            "sport": "cricket",
            "date": "2026-10-03",
            "startTime": "17:00",
            "endTime": "18:00",
            "duration": "1 Hour",
            "durationHours": 1,
            "bookingType": "walkin",
            "memberId": None,
            "playerName": "Rahul Sharma (Walk-in)",
            "rateApplied": "₹ 600.00",
            "isSocial": False,
            "state": "confirmed"
        }
    ]
}

def load_store():
    store = {}
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                store = json.load(f)
        except Exception as e:
            print(f"[Store] Error reading {DATA_FILE}: {e}")
            store = {}
    
    modified = False
    for k, v in DEFAULT_STORE.items():
        if k not in store or (isinstance(store[k], list) and len(store[k]) == 0 and len(v) > 0):
            store[k] = v
            modified = True
            
    if modified:
        save_store(store)

    return store

def save_store(store_data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(store_data, f, indent=2)
        return True
    except Exception as e:
        print(f"[Store] Error writing {DATA_FILE}: {e}")
        return False

class ClubRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == '/api/datastore' or path == '/api/sync':
            store = load_store()
            payload = json.dumps({'success': True, 'data': store}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # Fallback to standard static file serving
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b'{}'
        try:
            data = json.loads(body.decode('utf-8'))
        except Exception:
            data = {}

        if path == '/api/datastore' or path == '/api/sync':
            store = load_store()
            if 'all' in data and isinstance(data['all'], dict):
                store.update(data['all'])
            elif 'key' in data and 'data' in data:
                store[data['key']] = data['data']
            elif isinstance(data, dict):
                store.update(data)

            save_store(store)
            payload = json.dumps({'success': True, 'data': store}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # Courts API endpoints
        if path == '/champions_club/courts/list':
            store = load_store()
            courts = store.get('cc_courts', DEFAULT_STORE.get('cc_courts', []))
            sport_filter = data.get('sport')
            if sport_filter and sport_filter != 'all':
                courts = [c for c in courts if c.get('sport') == sport_filter]
            payload = json.dumps({'success': True, 'courts': courts}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # Handle Champions Club Odoo JSON RPC endpoints
        if path == '/champions_club/membership/plans':
            plans = [
                {
                    'id': 1,
                    'name': 'Gold Plan',
                    'code': 'gold',
                    'fee_amount': 24000.0,
                    'court_hourly_rate': 0.0,
                    'court_rate_policy': 'free',
                    'shop_discount_percent': 15.0,
                    'bar_discount_percent': 15.0,
                    'allow_running_tab': True,
                    'max_booking_hours': 3
                },
                {
                    'id': 2,
                    'name': 'Silver Plan',
                    'code': 'silver',
                    'fee_amount': 14000.0,
                    'court_hourly_rate': 300.0,
                    'court_rate_policy': 'discounted',
                    'shop_discount_percent': 10.0,
                    'bar_discount_percent': 10.0,
                    'allow_running_tab': False,
                    'max_booking_hours': 2
                },
                {
                    'id': 3,
                    'name': 'Junior Plan',
                    'code': 'junior',
                    'fee_amount': 8000.0,
                    'court_hourly_rate': 200.0,
                    'court_rate_policy': 'discounted',
                    'shop_discount_percent': 15.0,
                    'bar_discount_percent': 5.0,
                    'allow_running_tab': False,
                    'max_booking_hours': 1
                }
            ]
            payload = json.dumps({'success': True, 'plans': plans}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if path == '/champions_club/bookings/create':
            store = load_store()
            bookings = store.get('cc_bookings', [])
            members = store.get('cc_members', [])
            courts = store.get('cc_courts', DEFAULT_STORE.get('cc_courts', []))

            court_id = str(data.get('court_id', '1'))
            start_time_str = data.get('start_time', '')
            duration_hours = float(data.get('duration_hours') or 1.0)
            booking_type = data.get('booking_type', 'member')
            member_id = data.get('member_id')
            member_name_req = data.get('member_name')
            member_plan_req = (data.get('member_plan') or 'gold').lower()
            walkin_name = data.get('walkin_name', '')
            is_social = bool(data.get('is_social_play', False))

            court = next((c for c in courts if str(c.get('id')) == court_id), None)
            court_name = court['name'] if court else f"Court {court_id}"
            sport = court.get('sport', 'tennis') if court else 'tennis'
            walkin_rate = float(court.get('walkinRate', 500) if court else 500)

            # Parse start time and date
            try:
                parts = start_time_str.split(' ')
                booking_date = parts[0]
                start_slot = parts[1][:5]
                start_h, start_m = map(int, start_slot.split(':'))
                start_mins = start_h * 60 + start_m
                end_mins = int(start_mins + duration_hours * 60)
                end_h = (end_mins // 60) % 24
                end_m = end_mins % 60
                end_slot = f"{str(end_h).zfill(2)}:{str(end_m).zfill(2)}"
                if end_mins == 1440:
                    end_slot = "00:00"
            except Exception as e:
                payload = json.dumps({'success': False, 'error': f"Invalid start time format ({start_time_str})"}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
                return

            # Validation 1: Membership Plan & Duration Limit
            member = None
            max_duration = 1.0
            hourly_rate = walkin_rate
            rate_label = f"₹ {walkin_rate * duration_hours:.2f}"

            if booking_type == 'member' and member_id:
                for m in members:
                    if (str(m.get('id', '')).strip().lower() == str(member_id).strip().lower() or
                        str(m.get('member_code', '')).strip().lower() == str(member_id).strip().lower() or
                        str(m.get('name', '')).strip().lower() == str(member_id).strip().lower() or
                        (member_name_req and str(m.get('name', '')).strip().lower() == str(member_name_req).strip().lower())):
                        member = m
                        break

                if not member:
                    # Auto-register active profile for authenticated / dynamic member
                    mem_name = member_name_req or member_id
                    member = {
                        'id': member_id,
                        'member_code': member_id,
                        'name': mem_name,
                        'email': f"{str(member_id).lower().replace(' ', '.')}@example.com",
                        'phone': '+91 98000 00000',
                        'plan': member_plan_req,
                        'startDate': '2026-01-01',
                        'endDate': '2027-12-31',
                        'state': 'active',
                        'history': [
                            {'timestamp': '2026-10-04 00:00', 'type': 'signup', 'desc': f'Enrolled under {member_plan_req.title()} Plan'}
                        ],
                        'notes': 'Active member profile'
                    }
                    members.append(member)
                    store['cc_members'] = members
                    save_store(store)

                if member.get('state') == 'cancelled' or member.get('state') == 'expired':
                    max_duration = 1.0
                    hourly_rate = walkin_rate
                    rate_label = f"₹ {walkin_rate * duration_hours:.2f} (Expired - Standard Rate)"
                else:
                    plan_code = (member.get('plan') or 'silver').lower()
                    if plan_code == 'gold':
                        max_duration = 3.0
                        hourly_rate = 0.0
                        rate_label = "₹ 0.00 (Free)"
                    elif plan_code == 'silver':
                        max_duration = 2.0
                        hourly_rate = 300.0
                        rate_label = f"₹ {300.0 * duration_hours:.2f}"
                    elif plan_code == 'junior':
                        max_duration = 1.0
                        hourly_rate = 200.0
                        rate_label = f"₹ {200.0 * duration_hours:.2f}"

                if duration_hours > max_duration:
                    plan_upper = (member.get('plan') or 'Standard').upper()
                    payload = json.dumps({'success': False, 'error': f"Duration Limit Exceeded: '{plan_upper}' plan allows a maximum booking duration of {int(max_duration)} hour(s). Requested: {int(duration_hours)} hour(s)."}).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return

                # Validation 2: Daily limit (Max 2 bookings per member per day)
                member_day_count = sum(1 for b in bookings if b.get('bookingType') == 'member' and (b.get('memberId') == member_id or b.get('memberId') == member.get('id')) and b.get('date') == booking_date and b.get('state') == 'confirmed')
                if member_day_count >= 2:
                    payload = json.dumps({'success': False, 'error': f"Daily Limit Exceeded: Member '{member.get('name')}' already has {member_day_count} bookings on {booking_date}. Each member can play at most twice a day."}).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return
            else:
                if duration_hours > 1.0:
                    payload = json.dumps({'success': False, 'error': "Walk-in guests are limited to a maximum booking duration of 1 hour."}).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return

            # Validation 3: Overlapping Bookings Check Across All Requested Consecutive Intervals
            if not is_social:
                conflicting = []
                for b in bookings:
                    if str(b.get('courtId')) == court_id and b.get('date') == booking_date and b.get('state') == 'confirmed' and not b.get('isSocial'):
                        try:
                            b_start_h, b_start_m = map(int, b.get('startTime', '00:00').split(':'))
                            b_start_mins = b_start_h * 60 + b_start_m
                            b_end_str = b.get('endTime', '01:00')
                            if b_end_str == '00:00':
                                b_end_mins = 1440
                            else:
                                b_end_h, b_end_m = map(int, b_end_str.split(':'))
                                b_end_mins = b_end_h * 60 + b_end_m

                            # Overlap condition: start_mins < b_end_mins and end_mins > b_start_mins
                            if start_mins < b_end_mins and end_mins > b_start_mins:
                                conflicting.append(f"{b.get('startTime')}–{b.get('endTime')} ({b.get('id')})")
                        except Exception:
                            pass

                if conflicting:
                    conflict_desc = ", ".join(conflicting)
                    payload = json.dumps({
                        'success': False,
                        'error': f"Cannot book {start_slot}–{end_slot} because {conflict_desc} is already booked."
                    }).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return

            # Create new booking
            new_id = f"CC-BK-{str(len(bookings) + 1).zfill(4)}"
            player_name = f"{member.get('name')} ({(member.get('plan') or 'Gold').upper()})" if member else (walkin_name or "Walk-in Guest")
            new_booking = {
                'id': new_id,
                'courtId': court_id,
                'courtName': court_name,
                'sport': sport,
                'date': booking_date,
                'startTime': start_slot,
                'endTime': end_slot,
                'duration': f"{int(duration_hours)} Hour{'s' if duration_hours > 1 else ''}",
                'durationHours': duration_hours,
                'bookingType': booking_type,
                'memberId': (member.get('id') if member else None),
                'playerName': player_name,
                'rateApplied': rate_label,
                'isSocial': is_social,
                'state': 'confirmed'
            }

            bookings.insert(0, new_booking)
            store['cc_bookings'] = bookings
            save_store(store)

            payload = json.dumps({
                'success': True,
                'reference': new_id,
                'booking_id': new_id,
                'booking': new_booking
            }).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if path == '/champions_club/bookings/cancel':
            store = load_store()
            bookings = store.get('cc_bookings', [])
            b_id = str(data.get('booking_id', ''))
            found = False
            for b in bookings:
                if str(b.get('id')) == b_id:
                    b['state'] = 'cancelled'
                    found = True
                    break
            if found:
                store['cc_bookings'] = bookings
                save_store(store)
                payload = json.dumps({'success': True, 'message': 'Booking cancelled and slot released.'}).encode('utf-8')
            else:
                payload = json.dumps({'success': False, 'error': f"Booking '{b_id}' not found."}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # Handle Champions Club Odoo JSON RPC endpoints
        if path == '/champions_club/membership/members':
            store = load_store()
            members = store.get('cc_members', [])
            payload = json.dumps({'success': True, 'members': members}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if path == '/champions_club/membership/create':
            store = load_store()
            members = store.get('cc_members', [])
            mem_id = data.get('member_code') or f"CC-MEM-00{100 + len(members) + 1}"
            new_mem = {
                'id': mem_id,
                'name': data.get('name', 'New Member'),
                'email': data.get('email', ''),
                'phone': data.get('phone', ''),
                'plan': data.get('plan_code', data.get('plan', 'gold')),
                'startDate': data.get('start_date', '2026-10-03'),
                'endDate': data.get('end_date', '2027-10-03'),
                'state': data.get('state', 'active'),
                'history': [
                    {'timestamp': '2026-10-03 10:00', 'type': 'signup', 'desc': f"Enrolled under {(data.get('plan_code') or 'gold').upper()} Plan"}
                ],
                'notes': data.get('notes', '')
            }
            members.append(new_mem)
            store['cc_members'] = members
            save_store(store)
            payload = json.dumps({'success': True, 'member_code': mem_id, 'member_id': mem_id}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if path == '/champions_club/crm/leads':
            store = load_store()
            leads = store.get('cc_leads', [])
            payload = json.dumps({'success': True, 'leads': leads}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if path == '/champions_club/enquiry/submit' or path == '/champions_club/crm/lead/create':
            store = load_store()
            leads = store.get('cc_leads', [])
            
            # Determine next reference ID
            max_num = 0
            for l in leads:
                lid = str(l.get('id', ''))
                if lid.startswith('CC-ENQ-'):
                    try:
                        num = int(lid.replace('CC-ENQ-', ''))
                        if num > max_num:
                            max_num = num
                    except ValueError:
                        pass
            
            new_id_num = max(max_num + 1, len(leads) + 1)
            ref_code = f"CC-ENQ-00{String(new_id_num).zfill(2) if 'String' in globals() else str(new_id_num).zfill(2)}"
            # Standard formatting: CC-ENQ-0005 or CC-ENQ-0038
            if new_id_num < 100:
                ref_code = f"CC-ENQ-00{str(new_id_num).zfill(2)}"
            else:
                ref_code = f"CC-ENQ-{str(new_id_num).zfill(4)}"

            name = data.get('partner_name') or data.get('name') or 'Prospective Member'
            phone = data.get('phone') or ''
            email = data.get('email') or ''
            plan = data.get('plan_code') or data.get('plan') or 'gold'
            source = data.get('source') or 'website'
            msg = data.get('message') or ''

            quote_amt = 24000 if plan == 'gold' else 14000 if plan == 'silver' else 8000

            new_lead = {
                'id': ref_code,
                'rawId': ref_code,
                'name': name,
                'phone': phone,
                'email': email,
                'source': source,
                'plan': plan,
                'message': msg,
                'stage': 'new',
                'staff': 'Pooja Patel (Membership Advisor)',
                'quoteSent': False,
                'quoteAmount': quote_amt,
                'followups': [
                    {'time': '2026-10-03 20:40', 'note': f"Website enquiry registered from {source}. Stage: New Enquiry."}
                ],
                'memberId': None
            }

            leads.insert(0, new_lead)
            store['cc_leads'] = leads
            save_store(store)

            payload = json.dumps({
                'success': True,
                'reference': ref_code,
                'id': ref_code,
                'name': ref_code,
                'lead': new_lead
            }).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if path == '/champions_club/crm/lead/contacted':
            store = load_store()
            leads = store.get('cc_leads', [])
            enq_id = str(data.get('enquiry_id', ''))
            for l in leads:
                if str(l.get('id')) == enq_id or str(l.get('rawId')) == enq_id:
                    l['stage'] = 'contacted'
                    l.setdefault('followups', []).append({
                        'time': '2026-10-03 20:42',
                        'note': f"Staff reached out to visitor via phone/WhatsApp ({l.get('staff', 'Staff')})."
                    })
                    break
            store['cc_leads'] = leads
            save_store(store)
            payload = json.dumps({'success': True, 'stage': 'contacted'}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if path == '/champions_club/crm/lead/followup':
            store = load_store()
            leads = store.get('cc_leads', [])
            enq_id = str(data.get('enquiry_id', ''))
            note_text = data.get('note', 'Follow-up interaction logged.')
            for l in leads:
                if str(l.get('id')) == enq_id or str(l.get('rawId')) == enq_id:
                    l.setdefault('followups', []).append({
                        'time': '2026-10-03 20:43',
                        'note': note_text
                    })
                    if l.get('stage') in ['new', 'contacted']:
                        l['stage'] = 'followup'
                    break
            store['cc_leads'] = leads
            save_store(store)
            payload = json.dumps({'success': True}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if path == '/champions_club/crm/lead/quote':
            store = load_store()
            leads = store.get('cc_leads', [])
            enq_id = str(data.get('enquiry_id', ''))
            amt = float(data.get('quote_amount', 0))
            for l in leads:
                if str(l.get('id')) == enq_id or str(l.get('rawId')) == enq_id:
                    l['quoteSent'] = True
                    l['quoteAmount'] = amt
                    l['stage'] = 'quote'
                    l.setdefault('followups', []).append({
                        'time': '2026-10-03 20:44',
                        'note': f"Official quotation of ₹ {amt:,.2f} sent."
                    })
                    break
            store['cc_leads'] = leads
            save_store(store)
            payload = json.dumps({'success': True, 'quote_amount': amt}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if path == '/champions_club/crm/lead/convert':
            store = load_store()
            leads = store.get('cc_leads', [])
            members = store.get('cc_members', [])
            enq_id = str(data.get('enquiry_id', ''))
            target_lead = None
            for l in leads:
                if str(l.get('id')) == enq_id or str(l.get('rawId')) == enq_id:
                    target_lead = l
                    break
            
            if target_lead:
                # Duplicate check
                existing_member = None
                for m in members:
                    if (target_lead.get('phone') and m.get('phone') == target_lead.get('phone')) or \
                       (target_lead.get('email') and m.get('email') and m.get('email', '').lower() == target_lead.get('email', '').lower()):
                        existing_member = m
                        break
                
                if existing_member:
                    target_lead['memberId'] = existing_member['id']
                    target_lead['stage'] = 'converted'
                    target_lead.setdefault('followups', []).append({
                        'time': '2026-10-03 20:45',
                        'note': f"Linked to existing member profile {existing_member['id']} ({existing_member['name']})."
                    })
                    mem_code = existing_member['id']
                    mem_name = existing_member['name']
                else:
                    new_mem_id = f"CC-MEM-00{100 + len(members) + 1}"
                    new_mem = {
                        'id': new_mem_id,
                        'name': target_lead.get('name', 'New Member'),
                        'email': target_lead.get('email', ''),
                        'phone': target_lead.get('phone', ''),
                        'plan': target_lead.get('plan', 'gold'),
                        'startDate': '2026-10-03',
                        'endDate': '2027-10-03',
                        'state': 'active',
                        'history': [
                            {'timestamp': '2026-10-03 20:45', 'type': 'signup', 'desc': f"Enrolled via CRM Enquiry {target_lead['id']}"}
                        ],
                        'notes': f"Converted lead from CRM. Quoted: ₹ {target_lead.get('quoteAmount', 0):,.2f}"
                    }
                    members.append(new_mem)
                    store['cc_members'] = members
                    target_lead['memberId'] = new_mem_id
                    target_lead['stage'] = 'converted'
                    target_lead.setdefault('followups', []).append({
                        'time': '2026-10-03 20:45',
                        'note': f"Converted to active Member {new_mem_id}!"
                    })
                    mem_code = new_mem_id
                    mem_name = new_mem['name']

                store['cc_leads'] = leads
                save_store(store)
                payload = json.dumps({'success': True, 'member_code': mem_code, 'member_name': mem_name}).encode('utf-8')
            else:
                payload = json.dumps({'success': False, 'error': 'Lead not found'}).encode('utf-8')

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        if path == '/champions_club/crm/lead/assign':
            store = load_store()
            leads = store.get('cc_leads', [])
            enq_id = str(data.get('enquiry_id', ''))
            user_id = data.get('user_id', 'Pooja Patel (Membership Advisor)')
            for l in leads:
                if str(l.get('id')) == enq_id or str(l.get('rawId')) == enq_id:
                    l['staff'] = user_id
                    break
            store['cc_leads'] = leads
            save_store(store)
            payload = json.dumps({'success': True, 'staff_name': user_id}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return

        # Generic success for other POSTs
        payload = json.dumps({'success': True}).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

def run():
    server_address = ('', PORT)
    httpd = ThreadedHTTPServer(server_address, ClubRequestHandler)
    print(f"Champions Club Server running at http://localhost:{PORT}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()

if __name__ == '__main__':
    run()
