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
