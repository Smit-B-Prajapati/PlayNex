# -*- coding: utf-8 -*-
from odoo import models, fields, api

class ClubDashboard(models.Model):
    _name = 'club.dashboard'
    _description = 'Champions Club Administrative Dashboard & KPI Engine'

    name = fields.Char(string='Dashboard View', default='Champions Club Operational Overview')
    reference_date = fields.Date(string='Reference Date', default='2026-10-03')

    # Computed KPI Data from Actual Stored Records
    @api.model
    def get_dashboard_summary(self):
        """
        Calculates KPIs strictly from existing records across models.
        Returns 'No data available' whenever a category has 0 records.
        """
        # 1. Memberships
        member_model = self.env['club.member']
        members = member_model.search([])
        total_members = len(members)
        if total_members > 0:
            active_members = len(members.filtered(lambda m: m.state == 'active'))
            gold_members = len(members.filtered(lambda m: m.plan_id.code == 'gold'))
            silver_members = len(members.filtered(lambda m: m.plan_id.code == 'silver'))
            junior_members = len(members.filtered(lambda m: m.plan_id.code == 'junior'))
            membership_kpi = {
                'count': total_members,
                'display': f"{total_members} Members",
                'active': active_members,
                'breakdown': f"Gold: {gold_members} | Silver: {silver_members} | Junior: {junior_members}",
                'source': 'club.member records',
                'has_data': True
            }
        else:
            membership_kpi = {
                'count': 0,
                'display': 'No data available',
                'breakdown': '0 active member profiles stored',
                'source': 'club.member table',
                'has_data': False
            }

        # 2. Court Bookings
        booking_model = self.env['club.booking']
        bookings = booking_model.search([])
        total_bookings = len(bookings)
        if total_bookings > 0:
            confirmed_bk = len(bookings.filtered(lambda b: b.state == 'confirmed'))
            tennis_bk = len(bookings.filtered(lambda b: b.sport_type == 'tennis'))
            cricket_bk = len(bookings.filtered(lambda b: b.sport_type == 'cricket'))
            badminton_bk = len(bookings.filtered(lambda b: b.sport_type == 'badminton'))
            court_revenue = sum(b.rate_applied for b in bookings.filtered(lambda b: b.state == 'confirmed'))
            bookings_kpi = {
                'count': total_bookings,
                'display': f"{confirmed_bk} Bookings",
                'breakdown': f"Tennis: {tennis_bk} | Cricket: {cricket_bk} | Badminton: {badminton_bk}",
                'revenue': court_revenue,
                'source': 'club.booking records',
                'has_data': True
            }
        else:
            bookings_kpi = {
                'count': 0,
                'display': 'No data available',
                'breakdown': '0 court bookings recorded for today',
                'revenue': 0.0,
                'source': 'club.booking table',
                'has_data': False
            }

        # 3. Pro Shop Sales
        order_model = self.env['club.shop.order']
        orders = order_model.search([('state', '!=', 'cancelled')])
        if orders:
            shop_revenue = sum(o.amount_total for o in orders)
            counter_orders = len(orders.filtered(lambda o: o.channel == 'counter'))
            online_orders = len(orders.filtered(lambda o: o.channel == 'online'))
            shop_kpi = {
                'count': len(orders),
                'display': f"₹ {shop_revenue:,.2f}",
                'breakdown': f"{len(orders)} active orders ({counter_orders} counter, {online_orders} online)",
                'revenue': shop_revenue,
                'source': 'club.shop.order records',
                'has_data': True
            }
        else:
            shop_kpi = {
                'count': 0,
                'display': 'No data available',
                'breakdown': '0 shop sales orders recorded',
                'revenue': 0.0,
                'source': 'club.shop.order table',
                'has_data': False
            }

        # 4. Bar & Cafeteria POS
        shift_model = self.env['club.bar.shift']
        shifts = shift_model.search([])
        bar_revenue = sum(s.total_revenue for s in shifts)
        cash_total = sum(s.total_revenue_cash for s in shifts)
        card_total = sum(s.total_revenue_card for s in shifts)
        upi_total = sum(s.total_revenue_upi for s in shifts)
        if bar_revenue > 0:
            bar_kpi = {
                'display': f"₹ {bar_revenue:,.2f}",
                'breakdown': f"Cash: ₹ {cash_total:,.2f} | Card: ₹ {card_total:,.2f} | UPI: ₹ {upi_total:,.2f}",
                'revenue': bar_revenue,
                'source': 'club.bar.shift daily closing records',
                'has_data': True
            }
        else:
            bar_kpi = {
                'display': 'No data available',
                'breakdown': '0 daily bar receipts processed',
                'revenue': 0.0,
                'source': 'club.bar.shift table',
                'has_data': False
            }

        # 5. Shared Shelf Inventory
        product_model = self.env['club.product']
        products = product_model.search([])
        if products:
            total_units = sum(p.qty_on_hand for p in products)
            low_stock_products = products.filtered(lambda p: p.is_low_stock)
            inventory_kpi = {
                'sku_count': len(products),
                'display': f"{int(total_units)} Units",
                'breakdown': f"Across {len(products)} SKUs | Low stock alerts: {len(low_stock_products)}",
                'low_stock_count': len(low_stock_products),
                'source': 'club.product inventory records',
                'has_data': True
            }
        else:
            inventory_kpi = {
                'sku_count': 0,
                'display': 'No data available',
                'breakdown': '0 products in inventory catalog',
                'low_stock_count': 0,
                'source': 'club.product table',
                'has_data': False
            }

        # 6. CRM Enquiries & Leads
        enquiry_model = self.env['club.enquiry']
        leads = enquiry_model.search([])
        if leads:
            new_leads = len(leads.filtered(lambda l: l.stage == 'new'))
            contacted_leads = len(leads.filtered(lambda l: l.stage == 'contacted'))
            followup_leads = len(leads.filtered(lambda l: l.stage == 'followup'))
            converted_leads = len(leads.filtered(lambda l: l.stage == 'converted'))
            crm_kpi = {
                'count': len(leads),
                'display': f"{len(leads)} Leads",
                'breakdown': f"New: {new_leads} | Contacted: {contacted_leads} | Follow-up: {followup_leads} | Converted: {converted_leads}",
                'source': 'club.enquiry records',
                'has_data': True
            }
        else:
            crm_kpi = {
                'count': 0,
                'display': 'No data available',
                'breakdown': '0 visitor enquiries registered',
                'source': 'club.enquiry table',
                'has_data': False
            }

        # 7. Total Unified Revenue (Traceable Sum)
        total_rev = shop_kpi.get('revenue', 0.0) + bar_kpi.get('revenue', 0.0) + bookings_kpi.get('revenue', 0.0)
        if total_rev > 0:
            total_rev_kpi = {
                'display': f"₹ {total_rev:,.2f}",
                'breakdown': f"Shop: {shop_kpi.get('display')} | Bar: {bar_kpi.get('display')} | Courts: ₹ {bookings_kpi.get('revenue', 0.0):,.2f}",
                'source': 'Sum of Shop Orders + Bar POS + Court Receipts',
                'has_data': True
            }
        else:
            total_rev_kpi = {
                'display': 'No data available',
                'breakdown': '0 revenue recorded across club operations',
                'source': 'Ledger summation',
                'has_data': False
            }

        return {
            'memberships': membership_kpi,
            'court_bookings': bookings_kpi,
            'shop_sales': shop_kpi,
            'bar_pos': bar_kpi,
            'inventory': inventory_kpi,
            'crm_enquiries': crm_kpi,
            'total_revenue': total_rev_kpi
        }
