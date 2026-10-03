# -*- coding: utf-8 -*-
from odoo import models, fields, api

class ClubDashboard(models.Model):
    _name = 'club.dashboard'
    _description = 'Champions Club Administrative Dashboard & Financial Reporting Engine'

    name = fields.Char(string='Dashboard View', default='Champions Club Operational & Financial Overview')
    reference_date = fields.Date(string='Reference Date', default='2026-10-03')

    @api.model
    def get_dashboard_summary(self):
        """
        Calculates operational and financial KPIs strictly from existing records across models:
        1. Memberships (active members & subscription fee revenue)
        2. Courts (bookings, court rates, corporate arena block invoices)
        3. Pro Shop (counter sales, online orders, catalog revenue)
        4. Bar / Cafeteria (POS receipts, cash/card/UPI breakdown, closed shifts)
        5. Business Clients & Corporate Invoices (corporate memberships, bulk rentals)
        6. Taxes (collected taxes from configured tax rules)
        7. Unified Revenue (traceable gross sum across all streams)
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
                'breakdown': '0 court bookings recorded',
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

        # 5. Financial Invoices & Corporate / Business Client Revenue
        invoice_model = self.env['club.invoice']
        invoices = invoice_model.search([('state', 'in', ['posted', 'paid'])])
        membership_inv_rev = sum(i.amount_total for i in invoices.filtered(lambda inv: inv.invoice_type == 'membership'))
        corporate_inv_rev = sum(i.amount_total for i in invoices.filtered(lambda inv: inv.invoice_type in ['court_corporate', 'general']))
        total_invoiced_tax = sum(i.amount_tax for i in invoices)

        if invoices:
            invoices_kpi = {
                'count': len(invoices),
                'display': f"₹ {sum(i.amount_total for i in invoices):,.2f}",
                'breakdown': f"Membership: ₹ {membership_inv_rev:,.2f} | Corporate: ₹ {corporate_inv_rev:,.2f} | Tax: ₹ {total_invoiced_tax:,.2f}",
                'membership_revenue': membership_inv_rev,
                'corporate_revenue': corporate_inv_rev,
                'tax_collected': total_invoiced_tax,
                'source': 'club.invoice records',
                'has_data': True
            }
        else:
            invoices_kpi = {
                'count': 0,
                'display': 'No data available',
                'breakdown': '0 posted invoices recorded',
                'membership_revenue': 0.0,
                'corporate_revenue': 0.0,
                'tax_collected': 0.0,
                'source': 'club.invoice table',
                'has_data': False
            }

        # 6. Shared Shelf Inventory
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

        # 7. CRM Enquiries & Leads
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

        # 8. Total Unified Revenue (Traceable Sum across all 5 streams)
        # Streams: Courts + Shop + Bar + Memberships (via Invoices) + Corporate Clients
        total_rev = (
            bookings_kpi.get('revenue', 0.0) +
            shop_kpi.get('revenue', 0.0) +
            bar_kpi.get('revenue', 0.0) +
            invoices_kpi.get('membership_revenue', 0.0) +
            invoices_kpi.get('corporate_revenue', 0.0)
        )

        if total_rev > 0:
            total_rev_kpi = {
                'display': f"₹ {total_rev:,.2f}",
                'breakdown': (
                    f"Courts: ₹ {bookings_kpi.get('revenue', 0.0):,.2f} | "
                    f"Shop: ₹ {shop_kpi.get('revenue', 0.0):,.2f} | "
                    f"Bar: ₹ {bar_kpi.get('revenue', 0.0):,.2f} | "
                    f"Memberships: ₹ {invoices_kpi.get('membership_revenue', 0.0):,.2f} | "
                    f"Corporate: ₹ {invoices_kpi.get('corporate_revenue', 0.0):,.2f}"
                ),
                'source': 'Sum of 5 Revenue Streams (Courts, Shop, Bar, Memberships, Corporate Invoices)',
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
            'invoices': invoices_kpi,
            'inventory': inventory_kpi,
            'crm_enquiries': crm_kpi,
            'total_revenue': total_rev_kpi
        }
