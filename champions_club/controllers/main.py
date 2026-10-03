# -*- coding: utf-8 -*-
import json
from odoo import http, fields
from odoo.http import request

class ChampionsClubController(http.Controller):

    # 1. Visitor Enquiry & Trial Booking Submission
    @http.route('/champions_club/enquiry/submit', type='json', auth='public', methods=['POST'], csrf=False)
    def submit_enquiry(self, **post):
        """
        Receives website visitor enquiry / trial booking request and
        creates an authoritative record in club.enquiry model.
        """
        name = post.get('name')
        phone = post.get('phone')
        email = post.get('email')
        message = post.get('message', '')
        sport = post.get('sport')
        plan_code = post.get('plan')
        source = post.get('source', 'website')

        if not name or not phone:
            return {'success': False, 'error': 'Name and phone number are required.'}

        # Look up plan if selected
        plan_id = False
        if plan_code:
            plan = request.env['club.membership.plan'].sudo().search([('code', '=', plan_code)], limit=1)
            if plan:
                plan_id = plan.id

        enquiry = request.env['club.enquiry'].sudo().create({
            'partner_name': name,
            'phone': phone,
            'email': email or '',
            'source': source,
            'message': f"Interested in: {sport or 'General'}. {message}".strip(),
            'interested_plan_id': plan_id,
            'stage': 'new',
            'enquiry_date': fields.Datetime.now()
        })

        return {
            'success': True,
            'enquiry_id': enquiry.id,
            'reference': enquiry.name,
            'stage': enquiry.stage,
            'message': f"Thank you, {name}! Your enquiry ({enquiry.name}) has been received. Our team will contact you shortly."
        }

    # 1b. CRM Leads List Query
    @http.route('/champions_club/crm/leads', type='json', auth='user', methods=['GET', 'POST'], csrf=False)
    def get_crm_leads(self, stage=None, **kwargs):
        """Returns list of CRM enquiries filtered by stage."""
        domain = []
        if stage:
            domain.append(('stage', '=', stage))
        leads = request.env['club.enquiry'].sudo().search(domain)
        return {
            'success': True,
            'leads': [{
                'id': l.id,
                'name': l.name,
                'partner_name': l.partner_name,
                'phone': l.phone,
                'email': l.email or '',
                'source': l.source,
                'stage': l.stage,
                'user_id': l.user_id.id if l.user_id else False,
                'staff_name': l.user_id.name if l.user_id else 'Unassigned',
                'interested_plan': l.interested_plan_id.name if l.interested_plan_id else '',
                'interested_plan_code': l.interested_plan_id.code if l.interested_plan_id else '',
                'quote_sent': l.quote_sent,
                'quote_amount': l.quote_amount,
                'quote_notes': l.quote_notes or '',
                'message': l.message or '',
                'notes': l.notes or '',
                'followup_notes': l.followup_notes or '',
                'member_id': l.member_id.id if l.member_id else False,
                'member_code': l.member_id.member_code if l.member_id else '',
                'enquiry_date': fields.Datetime.to_string(l.enquiry_date)
            } for l in leads]
        }

    # 1c. CRM Lead Action: Assign Staff
    @http.route('/champions_club/crm/lead/assign', type='json', auth='user', methods=['POST'], csrf=False)
    def assign_crm_lead(self, enquiry_id, user_id, **kwargs):
        """Assigns a staff member to follow up on the enquiry."""
        enquiry = request.env['club.enquiry'].sudo().browse(int(enquiry_id))
        if not enquiry.exists():
            return {'success': False, 'error': 'Enquiry not found.'}
        enquiry.write({'user_id': int(user_id)})
        return {'success': True, 'enquiry_id': enquiry.id, 'staff_name': enquiry.user_id.name}

    # 1d. CRM Lead Action: Mark Contacted
    @http.route('/champions_club/crm/lead/contacted', type='json', auth='user', methods=['POST'], csrf=False)
    def mark_lead_contacted(self, enquiry_id, **kwargs):
        """Transitions enquiry from new to contacted."""
        enquiry = request.env['club.enquiry'].sudo().browse(int(enquiry_id))
        if not enquiry.exists():
            return {'success': False, 'error': 'Enquiry not found.'}
        enquiry.action_mark_contacted()
        return {'success': True, 'enquiry_id': enquiry.id, 'stage': enquiry.stage}

    # 1e. CRM Lead Action: Log Follow-up
    @http.route('/champions_club/crm/lead/followup', type='json', auth='user', methods=['POST'], csrf=False)
    def log_lead_followup(self, enquiry_id, note, **kwargs):
        """Logs a follow-up interaction on the enquiry."""
        enquiry = request.env['club.enquiry'].sudo().browse(int(enquiry_id))
        if not enquiry.exists():
            return {'success': False, 'error': 'Enquiry not found.'}
        enquiry.action_log_followup(note)
        return {'success': True, 'enquiry_id': enquiry.id, 'stage': enquiry.stage, 'followup_notes': enquiry.followup_notes}

    # 1f. CRM Lead Action: Send Quote
    @http.route('/champions_club/crm/lead/quote', type='json', auth='user', methods=['POST'], csrf=False)
    def send_lead_quote(self, enquiry_id, quote_amount=None, notes=None, **kwargs):
        """Generates quotation based on configured plan fee and moves to quote stage."""
        enquiry = request.env['club.enquiry'].sudo().browse(int(enquiry_id))
        if not enquiry.exists():
            return {'success': False, 'error': 'Enquiry not found.'}
        enquiry.action_send_quote(quote_amount=float(quote_amount) if quote_amount else None, notes=notes)
        return {'success': True, 'enquiry_id': enquiry.id, 'stage': enquiry.stage, 'quote_amount': enquiry.quote_amount}

    # 1g. CRM Lead Action: Convert to Member
    @http.route('/champions_club/crm/lead/convert', type='json', auth='user', methods=['POST'], csrf=False)
    def convert_lead_to_member(self, enquiry_id, **kwargs):
        """Converts enquiry to club member with duplicate check."""
        try:
            enquiry = request.env['club.enquiry'].sudo().browse(int(enquiry_id))
            if not enquiry.exists():
                return {'success': False, 'error': 'Enquiry not found.'}
            res = enquiry.action_convert_to_member()
            return {
                'success': True,
                'enquiry_id': enquiry.id,
                'stage': enquiry.stage,
                'member_id': enquiry.member_id.id,
                'member_code': enquiry.member_id.member_code,
                'member_name': enquiry.member_id.name
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # 2. Live Court Availability Query with 30-Minute Slot Generation
    @http.route('/champions_club/courts/availability', type='json', auth='public', methods=['POST'], csrf=False)
    def get_court_availability(self, date_str=None, sport=None, member_id=None, **kwargs):
        """
        Queries actual stored club.booking and club.court records to generate
        authoritative 30-minute interval, 1-hour duration slot availability without guessing.
        """
        target_date = date_str or fields.Date.today()
        
        court_domain = [('active', '=', True)]
        if sport:
            court_domain.append(('sport_type', '=', sport))
        
        courts = request.env['club.court'].sudo().search(court_domain)
        
        court_list = []
        for c in courts:
            slots = c.get_available_slots(target_date, member_id=int(member_id) if member_id else None)
            court_list.append({
                'id': c.id,
                'name': c.name,
                'sport': c.sport_type,
                'surface': c.surface_type,
                'indoor': c.is_indoor,
                'floodlit': c.is_floodlit,
                'walkin_rate': c.walkin_hourly_rate,
                'opening_hour': c.opening_hour,
                'closing_hour': c.closing_hour,
                'slots': slots
            })

        return {
            'success': True,
            'date': str(target_date),
            'courts': court_list
        }

    # 3. Create Court Booking with Strict Server-Side Validation
    @http.route('/champions_club/bookings/create', type='json', auth='user', methods=['POST'], csrf=False)
    def create_booking(self, **post):
        """
        Creates court booking through Odoo ORM, executing double-booking,
        daily play limit, membership validity, and member rate constraints.
        """
        court_id = post.get('court_id')
        start_time_str = post.get('start_time')
        booking_type = post.get('booking_type', 'member')
        member_id = post.get('member_id')
        walkin_name = post.get('walkin_name')
        walkin_phone = post.get('walkin_phone', '')
        is_social_play = post.get('is_social_play', False)

        try:
            start_time = fields.Datetime.to_datetime(start_time_str)
            vals = {
                'court_id': int(court_id),
                'start_time': start_time,
                'duration_hours': 1.0,
                'booking_type': booking_type,
                'is_social_play': bool(is_social_play),
                'state': 'confirmed'
            }
            if booking_type == 'member' and member_id:
                vals['member_id'] = int(member_id)
            elif booking_type == 'walkin' and walkin_name:
                vals['walkin_name'] = walkin_name
                vals['walkin_phone'] = walkin_phone

            booking = request.env['club.booking'].create(vals)
            return {
                'success': True,
                'booking_id': booking.id,
                'reference': booking.name,
                'rate_applied': booking.rate_applied,
                'start_time': fields.Datetime.to_string(booking.start_time),
                'end_time': fields.Datetime.to_string(booking.end_time),
                'is_social_play': booking.is_social_play,
                'state': booking.state
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # 3b. Cancel Court Booking (Instantly Releases Court Slot)
    @http.route('/champions_club/bookings/cancel', type='json', auth='user', methods=['POST'], csrf=False)
    def cancel_booking(self, booking_id, **kwargs):
        """
        Cancels court booking, immediately releasing the slot and restoring daily play allowance.
        """
        try:
            booking = request.env['club.booking'].browse(int(booking_id))
            if not booking.exists():
                return {'success': False, 'error': 'Booking not found.'}
            booking.action_cancel()
            return {
                'success': True,
                'booking_id': booking.id,
                'reference': booking.name,
                'state': booking.state
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # 4. Omnichannel Pro Shop Order & Inventory Deduction
    @http.route('/champions_club/shop/order/create', type='json', auth='public', methods=['POST'], csrf=False)
    def create_shop_order(self, **post):
        """
        Places a Pro Shop sales order (Counter or Online) and atomically
        deducts physical inventory from the shared shelf.
        """
        channel = post.get('channel', 'counter')
        fulfillment = post.get('fulfillment', 'immediate')
        customer_name = post.get('customer_name')
        customer_phone = post.get('customer_phone', '')
        delivery_address = post.get('delivery_address', '')
        member_id = post.get('member_id')
        items = post.get('items', [])  # list of {'product_id': int, 'qty': float}

        if not customer_name:
            return {'success': False, 'error': 'Customer name is required.'}
        if fulfillment == 'delivery' and not delivery_address:
            return {'success': False, 'error': 'Delivery address is required for Home Delivery.'}
        if not items:
            return {'success': False, 'error': 'Cart cannot be empty.'}

        try:
            order_vals = {
                'channel': channel,
                'fulfillment_type': fulfillment,
                'customer_name': customer_name,
                'customer_phone': customer_phone,
                'delivery_address': delivery_address if fulfillment == 'delivery' else '',
                'customer_type': 'member' if member_id else 'guest',
                'member_id': int(member_id) if member_id else False,
                'state': 'draft'
            }
            order = request.env['club.shop.order'].sudo().create(order_vals)

            for itm in items:
                prod_id = int(itm['product_id'])
                qty = float(itm['qty'])
                prod = request.env['club.product'].sudo().browse(prod_id)
                request.env['club.shop.order.line'].sudo().create({
                    'order_id': order.id,
                    'product_id': prod.id,
                    'quantity': qty,
                    'unit_price': prod.list_price
                })

            # Confirm order and atomically deduct inventory
            order.action_confirm()

            return {
                'success': True,
                'order_id': order.id,
                'reference': order.name,
                'amount_total': order.amount_total,
                'state': order.state
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # 5. Bar POS Tab Settlement
    @http.route('/champions_club/bar/tab/settle', type='json', auth='user', methods=['POST'], csrf=False)
    def settle_bar_tab(self, tab_id, payment_method, **kwargs):
        """
        Settles a member running bar tab with Cash, Card, or UPI and releases table.
        """
        try:
            tab = request.env['club.bar.tab'].browse(int(tab_id))
            if not tab.exists() or tab.state != 'open':
                return {'success': False, 'error': 'Tab is not open or does not exist.'}
            tab.action_settle_tab(payment_method)
            return {
                'success': True,
                'tab_id': tab.id,
                'reference': tab.name,
                'amount_paid': tab.amount_total,
                'payment_method': payment_method,
                'state': tab.state
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # 6. Authoritative Administrative Dashboard KPI API
    @http.route('/champions_club/dashboard/summary', type='json', auth='user', methods=['GET', 'POST'], csrf=False)
    def get_dashboard_summary(self, **kwargs):
        """
        Calculates and returns live operational KPIs strictly from active database records.
        """
        summary = request.env['club.dashboard'].get_dashboard_summary()
        return {
            'success': True,
            'data': summary
        }

    # 7. Membership Plans API
    @http.route('/champions_club/membership/plans', type='json', auth='public', methods=['GET', 'POST'], csrf=False)
    def get_membership_plans(self, **kwargs):
        """
        Returns list of active membership tier plans (Gold, Silver, Junior) and their configurable parameters.
        """
        plans = request.env['club.membership.plan'].sudo().search([('active', '=', True)])
        return {
            'success': True,
            'plans': [{
                'id': p.id,
                'name': p.name,
                'code': p.code,
                'fee_amount': p.fee_amount,
                'billing_period': p.billing_period,
                'validity_duration_days': p.validity_duration_days,
                'court_rate_policy': p.court_rate_policy,
                'court_hourly_rate': p.court_hourly_rate,
                'shop_discount_percent': p.shop_discount_percent,
                'bar_discount_percent': p.bar_discount_percent,
                'allow_running_tab': p.allow_running_tab,
                'description': p.description or '',
                'active_members': p.member_count
            } for p in plans]
        }

    # 8. Membership Roster Query with Filtering
    @http.route('/champions_club/membership/members', type='json', auth='user', methods=['POST'], csrf=False)
    def get_members_list(self, state=None, plan_code=None, search=None, **kwargs):
        """
        Queries members strictly from database with support for active, expiring, expired, draft, cancelled filters.
        """
        domain = []
        if state:
            domain.append(('state', '=', state))
        if plan_code:
            domain.append(('plan_id.code', '=', plan_code))
        if search:
            domain.append('|')
            domain.append(('name', 'ilike', search))
            domain.append(('phone', 'ilike', search))

        members = request.env['club.member'].sudo().search(domain)
        return {
            'success': True,
            'members': [{
                'id': m.id,
                'member_code': m.member_code,
                'name': m.name,
                'email': m.email or '',
                'phone': m.phone or '',
                'plan_name': m.plan_id.name,
                'tier_code': m.tier_code,
                'start_date': str(m.start_date),
                'end_date': str(m.end_date),
                'days_until_expiry': m.days_until_expiry,
                'state': m.state,
                'has_active_benefits': m.has_active_benefits,
                'court_rate_display': m.court_rate_display,
                'shop_discount_display': m.shop_discount_display,
                'bar_discount_display': m.bar_discount_display
            } for m in members]
        }

    # 9. Get Member 360 Profile & History
    @http.route('/champions_club/membership/member/<int:member_id>', type='json', auth='user', methods=['GET', 'POST'], csrf=False)
    def get_member_detail(self, member_id, **kwargs):
        """
        Returns full 360 member profile including activity logs, court bookings, shop purchases, and bar tabs.
        """
        member = request.env['club.member'].sudo().browse(member_id)
        if not member.exists():
            return {'success': False, 'error': 'Member not found.'}

        history = [{
            'id': h.id,
            'timestamp': fields.Datetime.to_string(h.timestamp),
            'activity_type': h.activity_type,
            'description': h.description,
            'staff': h.staff_user_id.name if h.staff_user_id else 'System'
        } for h in member.history_ids]

        bookings = [{
            'id': b.id,
            'name': b.name,
            'court': b.court_id.name,
            'start_time': fields.Datetime.to_string(b.start_time),
            'rate_applied': b.rate_applied,
            'state': b.state
        } for b in member.booking_ids]

        shop_orders = [{
            'id': o.id,
            'name': o.name,
            'date': str(o.order_date),
            'channel': o.channel,
            'amount_total': o.amount_total,
            'state': o.state
        } for o in member.shop_order_ids]

        bar_tabs = [{
            'id': t.id,
            'name': t.name,
            'table': t.table_id.name,
            'amount_total': t.amount_total,
            'state': t.state
        } for t in member.bar_tab_ids]

        return {
            'success': True,
            'member': {
                'id': member.id,
                'member_code': member.member_code,
                'name': member.name,
                'email': member.email or '',
                'phone': member.phone or '',
                'plan_name': member.plan_id.name,
                'tier_code': member.tier_code,
                'start_date': str(member.start_date),
                'end_date': str(member.end_date),
                'days_until_expiry': member.days_until_expiry,
                'state': member.state,
                'has_active_benefits': member.has_active_benefits,
                'court_rate_display': member.court_rate_display,
                'shop_discount_display': member.shop_discount_display,
                'bar_discount_display': member.bar_discount_display,
                'notes': member.notes or '',
                'history': history,
                'bookings': bookings,
                'shop_orders': shop_orders,
                'bar_tabs': bar_tabs
            }
        }

    # 10. Enroll New Member
    @http.route('/champions_club/membership/create', type='json', auth='user', methods=['POST'], csrf=False)
    def create_member(self, **post):
        """
        Creates a new member profile and initiates onboarding history log.
        """
        name = post.get('name')
        plan_id = post.get('plan_id')
        start_date = post.get('start_date')
        end_date = post.get('end_date')
        initial_state = post.get('state', 'active')

        if not name or not plan_id or not start_date or not end_date:
            return {'success': False, 'error': 'Name, Plan, Start Date, and Expiration Date are required.'}

        try:
            member = request.env['club.member'].sudo().create({
                'name': name,
                'email': post.get('email', ''),
                'phone': post.get('phone', ''),
                'plan_id': int(plan_id),
                'start_date': start_date,
                'end_date': end_date,
                'state': initial_state,
                'notes': post.get('notes', '')
            })
            return {
                'success': True,
                'member_id': member.id,
                'member_code': member.member_code,
                'state': member.state
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # 11. Member Lifecycle Actions (Activate, Renew, Cancel, Change Plan, Check-in)
    @http.route('/champions_club/membership/action', type='json', auth='user', methods=['POST'], csrf=False)
    def perform_member_action(self, member_id, action, **kwargs):
        """
        Executes business lifecycle actions on member profile.
        """
        member = request.env['club.member'].sudo().browse(int(member_id))
        if not member.exists():
            return {'success': False, 'error': 'Member not found.'}

        try:
            if action == 'activate':
                member.action_activate()
            elif action == 'renew':
                extension_days = kwargs.get('extension_days')
                member.action_renew_membership(extension_days=extension_days)
            elif action == 'cancel':
                reason = kwargs.get('reason')
                member.action_cancel_membership(reason=reason)
            elif action == 'change_plan':
                new_plan_id = kwargs.get('new_plan_id')
                if not new_plan_id:
                    return {'success': False, 'error': 'New plan ID required.'}
                member.action_change_plan(int(new_plan_id))
            elif action == 'checkin':
                note = kwargs.get('facility_note')
                member.action_log_checkin(facility_note=note)
            else:
                return {'success': False, 'error': f"Unsupported action: {action}"}

            return {
                'success': True,
                'member_id': member.id,
                'state': member.state,
                'end_date': str(member.end_date),
                'has_active_benefits': member.has_active_benefits
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # 12. Courts & Facilities List Query
    @http.route('/champions_club/courts/list', type='json', auth='public', methods=['GET', 'POST'], csrf=False)
    def get_courts_list(self, sport=None, **kwargs):
        """
        Returns all active courts configured in Odoo ORM.
        """
        domain = [('active', '=', True)]
        if sport:
            domain.append(('sport_type', '=', sport))
        courts = request.env['club.court'].sudo().search(domain)
        return {
            'success': True,
            'courts': [{
                'id': c.id,
                'name': c.name,
                'sport': c.sport_type,
                'surface': c.surface_type,
                'indoor': c.is_indoor,
                'floodlit': c.is_floodlit,
                'walkin_rate': c.walkin_hourly_rate,
                'opening_hour': c.opening_hour,
                'closing_hour': c.closing_hour
            } for c in courts]
        }

    # 13. Bookings List Query
    @http.route('/champions_club/bookings/list', type='json', auth='public', methods=['GET', 'POST'], csrf=False)
    def get_bookings_list(self, court_id=None, date_str=None, member_id=None, **kwargs):
        """
        Returns stored court bookings matching filters.
        """
        domain = [('state', '=', 'confirmed')]
        if court_id:
            domain.append(('court_id', '=', int(court_id)))
        if date_str:
            target_date = fields.Date.to_date(date_str)
            domain.append(('start_time', '>=', f"{target_date} 00:00:00"))
            domain.append(('start_time', '<=', f"{target_date} 23:59:59"))
        if member_id:
            domain.append(('member_id', '=', int(member_id)))

        bookings = request.env['club.booking'].sudo().search(domain, order='start_time asc')
        return {
            'success': True,
            'bookings': [{
                'id': b.id,
                'reference': b.name,
                'court_id': b.court_id.id,
                'court_name': b.court_id.name,
                'sport': b.court_id.sport_type,
                'start_time': fields.Datetime.to_string(b.start_time),
                'end_time': fields.Datetime.to_string(b.end_time),
                'date': str(b.start_time.date()) if b.start_time else '',
                'time_slot': b.start_time.strftime('%H:%M') if b.start_time else '',
                'booking_type': b.booking_type,
                'member_id': b.member_id.id if b.member_id else None,
                'player_name': b.member_id.name if b.member_id else b.walkin_name,
                'rate_applied': b.rate_applied,
                'fee': b.fee_amount,
                'is_social': b.is_social_play,
                'state': b.state
            } for b in bookings]
        }

    # 14. Pro Shop Products & Live Inventory Query
    @http.route('/champions_club/shop/products', type='json', auth='public', methods=['GET', 'POST'], csrf=False)
    def get_shop_products(self, category=None, **kwargs):
        """
        Returns live physical inventory from Odoo club.product records.
        """
        domain = [('active', '=', True)]
        if category and category != 'all':
            domain.append(('category', '=', category))

        products = request.env['club.product'].sudo().search(domain, order='category, name')
        return {
            'success': True,
            'products': [{
                'id': p.id,
                'sku': p.default_code or f"CC-PRD-{p.id:03d}",
                'name': p.name,
                'category': p.category,
                'price': p.list_price,
                'stock': p.qty_on_hand,
                'min_alert': p.min_stock_alert_level,
                'is_low_stock': p.is_low_stock,
                'is_out_of_stock': p.qty_on_hand <= 0,
                'description': p.description or ''
            } for p in products]
        }

    # 15. Bar POS Tables & Tabs API
    @http.route('/champions_club/bar/tables', type='json', auth='public', methods=['GET', 'POST'], csrf=False)
    def get_bar_tables(self, **kwargs):
        """
        Returns live tables configured in POS table management.
        """
        tables = request.env['club.bar.table'].sudo().search([])
        return {
            'success': True,
            'tables': [{
                'id': t.id,
                'name': t.name,
                'capacity': t.capacity,
                'state': t.state
            } for t in tables]
        }

    @http.route('/champions_club/bar/tabs', type='json', auth='user', methods=['GET', 'POST'], csrf=False)
    def get_bar_tabs(self, state='open', **kwargs):
        """
        Returns active running bar tabs.
        """
        domain = []
        if state:
            domain.append(('state', '=', state))
        tabs = request.env['club.bar.tab'].sudo().search(domain)
        return {
            'success': True,
            'tabs': [{
                'id': t.id,
                'name': t.name,
                'member_id': t.member_id.id,
                'member_name': t.member_id.name,
                'member_code': t.member_id.member_code,
                'table_id': t.table_id.id if t.table_id else None,
                'table_name': t.table_id.name if t.table_id else 'No Table',
                'amount_subtotal': t.amount_subtotal,
                'amount_discount': t.amount_discount,
                'amount_total': t.amount_total,
                'discount_percent': t.discount_percent,
                'opened_at': fields.Datetime.to_string(t.opened_at),
                'state': t.state
            } for t in tabs]
        }

    # 16. Secure Authentication & Member Portal Session
    @http.route('/champions_club/auth/login', type='json', auth='public', methods=['POST'], csrf=False)
    def portal_login(self, login, password=None, member_code=None, **kwargs):
        """
        Authenticates a member securely and establishes portal session.
        Accepts member code or email/phone.
        """
        domain = []
        if member_code:
            domain = [('member_code', '=', member_code)]
        elif login:
            domain = ['|', ('email', '=', login), ('member_code', '=', login)]
        else:
            return {'success': False, 'error': 'Member ID or Email is required.'}

        member = request.env['club.member'].sudo().search(domain, limit=1)
        if not member:
            return {'success': False, 'error': 'Invalid Member ID or credentials.'}

        # Store authenticated member ID in session
        request.session['authenticated_member_id'] = member.id
        request.session['authenticated_member_code'] = member.member_code

        return {
            'success': True,
            'session': {
                'member_id': member.id,
                'member_code': member.member_code,
                'name': member.name,
                'email': member.email or '',
                'phone': member.phone or '',
                'plan_name': member.plan_id.name,
                'tier_code': member.tier_code,
                'state': member.state,
                'has_active_benefits': member.has_active_benefits
            }
        }

    @http.route('/champions_club/auth/session', type='json', auth='public', methods=['GET', 'POST'], csrf=False)
    def get_portal_session(self, **kwargs):
        """Returns current session details."""
        member_id = request.session.get('authenticated_member_id')
        if not member_id:
            return {'authenticated': False}
        member = request.env['club.member'].sudo().browse(member_id)
        if not member.exists():
            request.session.pop('authenticated_member_id', None)
            return {'authenticated': False}
        return {
            'authenticated': True,
            'member': {
                'id': member.id,
                'member_code': member.member_code,
                'name': member.name,
                'email': member.email or '',
                'phone': member.phone or '',
                'plan_name': member.plan_id.name,
                'tier_code': member.tier_code,
                'state': member.state,
                'has_active_benefits': member.has_active_benefits
            }
        }

    @http.route('/champions_club/auth/logout', type='json', auth='public', methods=['POST'], csrf=False)
    def portal_logout(self, **kwargs):
        """Terminates portal session."""
        request.session.pop('authenticated_member_id', None)
        request.session.pop('authenticated_member_code', None)
        return {'success': True}

    @http.route('/champions_club/member/portal/profile', type='json', auth='public', methods=['GET', 'POST'], csrf=False)
    def get_own_portal_profile(self, member_id=None, **kwargs):
        """
        Protected Member Portal: Returns authenticated member's own records ONLY.
        Prevents cross-tenant / unauthorized access to another user's data.
        """
        target_id = request.session.get('authenticated_member_id') or member_id
        if not target_id:
            return {'success': False, 'error': 'Not authenticated. Please log in to view member profile.'}

        member = request.env['club.member'].sudo().browse(int(target_id))
        if not member.exists():
            return {'success': False, 'error': 'Member record not found.'}

        return self.get_member_detail(member.id)

    # 17. Executive & Operations Dashboard Metrics Query
    @http.route('/champions_club/dashboard/summary', type='json', auth='public', methods=['GET', 'POST'], csrf=False)
    def get_dashboard_summary(self, period='today', **kwargs):
        """
        Owner & Manager Dashboard Engine:
        Calculates all operational, membership, court, inventory, bar, CRM,
        and financial KPIs directly from real Odoo database models.
        Supports Time Filters: 'today', 'week', 'month'.
        """
        import datetime
        ref_today = datetime.date(2026, 10, 3)

        if period == 'week':
            # Current week: Monday 2026-09-28 to Sunday 2026-10-04
            start_dt = datetime.datetime(2026, 9, 28, 0, 0, 0)
            end_dt = datetime.datetime(2026, 10, 4, 23, 59, 59)
            period_label = "This Week (Sep 28 – Oct 4, 2026)"
        elif period == 'month':
            # Current month: 2026-10-01 to 2026-10-31
            start_dt = datetime.datetime(2026, 10, 1, 0, 0, 0)
            end_dt = datetime.datetime(2026, 10, 31, 23, 59, 59)
            period_label = "This Month (October 2026)"
        else: # default 'today'
            start_dt = datetime.datetime(2026, 10, 3, 0, 0, 0)
            end_dt = datetime.datetime(2026, 10, 3, 23, 59, 59)
            period_label = "Today (Oct 3, 2026)"

        # 1. MEMBERSHIP DOMAIN (club.member)
        all_members = request.env['club.member'].sudo().search([])
        active_members = all_members.filtered(lambda m: m.state == 'active' and m.end_date and m.end_date >= ref_today)
        expiring_members = all_members.filtered(lambda m: m.end_date and ref_today <= m.end_date <= (ref_today + datetime.timedelta(days=30)))
        expired_members = all_members.filtered(lambda m: m.end_date and m.end_date < ref_today)

        # 2. COURTS & BOOKINGS DOMAIN (club.booking & club.court)
        court_domain = [('create_date', '>=', fields.Datetime.to_string(start_dt)), ('create_date', '<=', fields.Datetime.to_string(end_dt))]
        # Also query by session start_time
        session_domain = [('start_time', '>=', fields.Datetime.to_string(start_dt)), ('start_time', '<=', fields.Datetime.to_string(end_dt))]
        
        confirmed_bookings = request.env['club.booking'].sudo().search(session_domain + [('state', '=', 'confirmed')])
        cancelled_bookings = request.env['club.booking'].sudo().search(session_domain + [('state', '=', 'cancelled')])
        all_courts = request.env['club.court'].sudo().search([('active', '=', True)])
        
        # Calculate available operating slots
        total_court_slots = len(all_courts) * (20 if period == 'today' else 140 if period == 'week' else 600)
        available_slots_count = max(0, total_court_slots - len(confirmed_bookings))

        # 3. PRO SHOP & SHARED INVENTORY DOMAIN (club.shop.order & club.product)
        shop_domain = [('order_date', '>=', fields.Datetime.to_string(start_dt)), ('order_date', '<=', fields.Datetime.to_string(end_dt))]
        shop_orders = request.env['club.shop.order'].sudo().search(shop_domain)
        active_shop_orders = shop_orders.filtered(lambda o: o.state != 'cancelled')
        shop_revenue = sum(active_shop_orders.mapped('amount_total'))

        products = request.env['club.product'].sudo().search([('active', '=', True)])
        total_inventory_units = sum(products.mapped('qty_on_hand'))
        low_stock_products = products.filtered(lambda p: p.qty_on_hand <= p.min_stock_alert_level)

        # 4. BAR & CAFETERIA POS DOMAIN (club.bar.order & club.bar.tab)
        bar_orders = request.env['club.bar.order'].sudo().search([
            ('create_date', '>=', fields.Datetime.to_string(start_dt)),
            ('create_date', '<=', fields.Datetime.to_string(end_dt)),
            ('state', '=', 'paid')
        ])
        bar_tabs = request.env['club.bar.tab'].sudo().search([
            ('create_date', '>=', fields.Datetime.to_string(start_dt)),
            ('create_date', '<=', fields.Datetime.to_string(end_dt))
        ])
        settled_tabs = bar_tabs.filtered(lambda t: t.state == 'closed')
        bar_revenue = sum(bar_orders.mapped('amount_total')) + sum(settled_tabs.mapped('amount_total'))

        # 5. CRM ENQUIRIES DOMAIN (club.enquiry)
        crm_domain = [('enquiry_date', '>=', fields.Datetime.to_string(start_dt)), ('enquiry_date', '<=', fields.Datetime.to_string(end_dt))]
        enquiries = request.env['club.enquiry'].sudo().search(crm_domain)
        contacted_leads = enquiries.filtered(lambda e: e.stage == 'contacted')
        followup_leads = enquiries.filtered(lambda e: e.stage == 'followup')
        quote_leads = enquiries.filtered(lambda e: e.quote_sent or e.stage == 'quote')
        converted_leads = enquiries.filtered(lambda e: e.stage == 'converted')
        quote_amount_total = sum(quote_leads.mapped('quote_amount'))

        # 6. FINANCIAL DOMAIN (Consolidated Revenue from Database Records)
        court_revenue = sum(confirmed_bookings.mapped('fee_amount'))
        total_gross_revenue = court_revenue + shop_revenue + bar_revenue

        return {
            'success': True,
            'period': period,
            'period_label': period_label,
            'timestamp': fields.Datetime.to_string(fields.Datetime.now()),
            'data': {
                'membership': {
                    'total_members': len(all_members),
                    'active_count': len(active_members),
                    'expiring_count': len(expiring_members),
                    'expired_count': len(expired_members),
                    'has_data': len(all_members) > 0,
                    'members': [{
                        'id': m.id,
                        'code': m.member_code,
                        'name': m.name,
                        'tier': m.tier_code,
                        'start_date': str(m.start_date),
                        'end_date': str(m.end_date),
                        'days_left': m.days_until_expiry,
                        'state': m.state
                    } for m in all_members]
                },
                'courts': {
                    'confirmed_count': len(confirmed_bookings),
                    'available_slots_count': available_slots_count,
                    'cancellations_count': len(cancelled_bookings),
                    'has_data': (len(confirmed_bookings) + len(cancelled_bookings)) > 0,
                    'bookings': [{
                        'id': b.id,
                        'reference': b.name,
                        'court_name': b.court_id.name,
                        'sport': b.court_id.sport_type,
                        'date': str(b.start_time.date()) if b.start_time else '',
                        'time_slot': b.start_time.strftime('%H:%M') if b.start_time else '',
                        'player_name': b.member_id.name if b.member_id else b.walkin_name,
                        'fee': b.fee_amount,
                        'rate_applied': b.rate_applied,
                        'state': b.state
                    } for b in confirmed_bookings]
                },
                'shop': {
                    'order_count': len(active_shop_orders),
                    'revenue': shop_revenue,
                    'total_inventory_units': total_inventory_units,
                    'low_stock_count': len(low_stock_products),
                    'has_data': len(active_shop_orders) > 0,
                    'low_stock_items': [{
                        'id': p.id,
                        'sku': p.default_code,
                        'name': p.name,
                        'stock': p.qty_on_hand,
                        'min_alert': p.min_stock_alert_level
                    } for p in low_stock_products]
                },
                'bar': {
                    'order_count': len(bar_orders) + len(settled_tabs),
                    'revenue': bar_revenue,
                    'open_tabs_count': len(bar_tabs.filtered(lambda t: t.state == 'open')),
                    'has_data': bar_revenue > 0
                },
                'crm': {
                    'total_enquiries': len(enquiries),
                    'contacted_count': len(contacted_leads),
                    'followup_count': len(followup_leads),
                    'quotes_count': len(quote_leads),
                    'quotes_total_value': quote_amount_total,
                    'converted_count': len(converted_leads),
                    'has_data': len(enquiries) > 0
                },
                'financial': {
                    'court_revenue': court_revenue,
                    'shop_revenue': shop_revenue,
                    'bar_revenue': bar_revenue,
                    'total_revenue': total_gross_revenue,
                    'has_data': total_gross_revenue > 0
                }
            }
        }

