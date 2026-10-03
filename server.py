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
