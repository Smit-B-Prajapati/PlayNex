# -*- coding: utf-8 -*-
from odoo import models, fields, api

class ClubBarShift(models.Model):
    _name = 'club.bar.shift'
    _description = 'Cafeteria & Bar Staff Shift & Daily Revenue'
    _order = 'start_time desc, id desc'

    name = fields.Char(string='Shift Name / Code', required=True)
    staff_name = fields.Char(string='Staff On Shift', required=True)
    employee_id = fields.Many2one('club.employee', string='Assigned Employee', tracking=True)
    start_time = fields.Datetime(string='Shift Start Time', default=fields.Datetime.now, required=True)
    end_time = fields.Datetime(string='Shift End Time')
    
    state = fields.Selection([
        ('active', 'Active Shift'),
        ('closed', 'Shift Closed / Reconciled')
    ], string='Shift Status', default='active', required=True)

    order_ids = fields.One2many('club.bar.order', 'shift_id', string='Processed Orders')
    tab_ids = fields.One2many('club.bar.tab', 'shift_id', string='Settled Tabs')

    # Daily Bar Revenue Breakdown
    total_revenue_cash = fields.Float(
        string='Total Cash Revenue',
        digits=(10, 2),
        compute='_compute_shift_revenue',
        store=True
    )
    total_revenue_card = fields.Float(
        string='Total Card Revenue',
        digits=(10, 2),
        compute='_compute_shift_revenue',
        store=True
    )
    total_revenue_upi = fields.Float(
        string='Total UPI Revenue',
        digits=(10, 2),
        compute='_compute_shift_revenue',
        store=True
    )
    total_revenue = fields.Float(
        string='Total Daily Bar Revenue',
        digits=(10, 2),
        compute='_compute_shift_revenue',
        store=True
    )

    @api.depends('order_ids.state', 'order_ids.payment_method', 'order_ids.amount_total',
                 'tab_ids.state', 'tab_ids.payment_method', 'tab_ids.amount_total')
    def _compute_shift_revenue(self):
        for shift in self:
            cash = 0.0
            card = 0.0
            upi = 0.0

            # Direct completed orders
            for order in shift.order_ids.filtered(lambda o: o.state == 'paid' and not o.tab_id):
                if order.payment_method == 'cash':
                    cash += order.amount_total
                elif order.payment_method == 'card':
                    card += order.amount_total
                elif order.payment_method == 'upi':
                    upi += order.amount_total

            # Settled tabs
            for tab in shift.tab_ids.filtered(lambda t: t.state == 'closed'):
                if tab.payment_method == 'cash':
                    cash += tab.amount_total
                elif tab.payment_method == 'card':
                    card += tab.amount_total
                elif tab.payment_method == 'upi':
                    upi += tab.amount_total

            shift.total_revenue_cash = cash
            shift.total_revenue_card = card
            shift.total_revenue_upi = upi
            shift.total_revenue = cash + card + upi

    def action_close_shift(self):
        """Action for bar closing revenue reconciliation."""
        self.write({
            'state': 'closed',
            'end_time': fields.Datetime.now()
        })
        return True
