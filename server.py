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

def load_store():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[Store] Error reading {DATA_FILE}: {e}")
    return {}

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
            courts = store.get('cc_courts', [
                {'id': '1', 'name': 'Tennis Court 1 (Clay)', 'sport': 'tennis', 'walkinRate': 500},
                {'id': '2', 'name': 'Tennis Court 2 (Hard)', 'sport': 'tennis', 'walkinRate': 500},
                {'id': '3', 'name': 'Cricket Pitch & Net 1 (Turf)', 'sport': 'cricket', 'walkinRate': 600},
                {'id': '4', 'name': 'Cricket Practice Net 2', 'sport': 'cricket', 'walkinRate': 600},
                {'id': '5', 'name': 'Badminton Court 1 (Indoor Mat)', 'sport': 'badminton', 'walkinRate': 400},
                {'id': '6', 'name': 'Badminton Court 2 (Indoor Mat)', 'sport': 'badminton', 'walkinRate': 400}
            ])

            court_id = str(data.get('court_id', '1'))
            start_time_str = data.get('start_time', '')
            duration_hours = float(data.get('duration_hours') or 1.0)
            booking_type = data.get('booking_type', 'member')
            member_id = data.get('member_id')
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
                member = next((m for m in members if m.get('id') == member_id or m.get('member_code') == member_id), None)
                if not member:
                    payload = json.dumps({'success': False, 'error': f"Member profile '{member_id}' not found."}).encode('utf-8')
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Content-Length', str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return

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
                member_day_count = sum(1 for b in bookings if b.get('bookingType') == 'member' and b.get('memberId') == member_id and b.get('date') == booking_date and b.get('state') == 'confirmed')
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
                'memberId': member_id if member else None,
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
