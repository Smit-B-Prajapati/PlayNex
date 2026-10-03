# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError

class ClubBarTab(models.Model):
    _name = 'club.bar.tab'
    _description = 'Member Running Bar Tab'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'opened_at desc, id desc'

    name = fields.Char(string='Tab Reference', readonly=True, copy=False, default='New')
    
    member_id = fields.Many2one('club.member', string='Member', required=True, tracking=True)
    plan_id = fields.Many2one(related='member_id.plan_id', string='Membership Plan', readonly=True)
    table_id = fields.Many2one('club.bar.table', string='Assigned Table')
    shift_id = fields.Many2one('club.bar.shift', string='Shift')

    opened_at = fields.Datetime(string='Opened At', default=fields.Datetime.now, required=True)
    closed_at = fields.Datetime(string='Settled / Closed At')

    order_ids = fields.One2many('club.bar.order', 'tab_id', string='Orders on Tab')

    discount_percent = fields.Float(
        string='Member Discount %',
        digits=(5, 2),
        compute='_compute_discount_percent',
        store=True,
        help="Automatically applied discount from member's tier plan."
    )

    amount_subtotal = fields.Float(
        string='Subtotal',
        digits=(10, 2),
        compute='_compute_tab_totals',
        store=True
    )
    amount_discount = fields.Float(
        string='Discount Amount',
        digits=(10, 2),
        compute='_compute_tab_totals',
        store=True
    )
    amount_total = fields.Float(
        string='Total to Settle',
        digits=(10, 2),
        compute='_compute_tab_totals',
        store=True
    )

    payment_method = fields.Selection([
        ('cash', 'Cash'),
        ('card', 'Card'),
        ('upi', 'UPI')
    ], string='Settlement Payment Method', tracking=True)

    state = fields.Selection([
        ('open', 'Open Tab'),
        ('closed', 'Settled / Closed'),
        ('cancelled', 'Cancelled')
    ], string='Tab Status', default='open', required=True, tracking=True)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code('club.bar.tab') or 'CC-TAB'
        tabs = super(ClubBarTab, self).create(vals_list)
        # Mark assigned table occupied
        for tab in tabs:
            if tab.table_id:
                tab.table_id.write({'state': 'occupied'})
        return tabs

    @api.depends('member_id.plan_id', 'member_id.state', 'member_id.has_active_benefits')
    def _compute_discount_percent(self):
        for tab in self:
            if tab.member_id and tab.member_id.has_active_benefits and tab.member_id.plan_id:
                tab.discount_percent = tab.member_id.plan_id.bar_discount_percent
            else:
                tab.discount_percent = 0.0

    @api.depends('order_ids.amount_subtotal', 'discount_percent')
    def _compute_tab_totals(self):
        for tab in self:
            sub = sum(tab.order_ids.mapped('amount_subtotal'))
            disc = (sub * tab.discount_percent) / 100.0 if tab.discount_percent > 0 else 0.0
            tab.amount_subtotal = sub
            tab.amount_discount = disc
            tab.amount_total = sub - disc

    def action_settle_tab(self, payment_method):
        """Action to settle tab with Cash, Card, or UPI and release table."""
        if payment_method not in ['cash', 'card', 'upi']:
            raise ValidationError("Payment method must be Cash, Card, or UPI.")

        self.write({
            'state': 'closed',
            'payment_method': payment_method,
            'closed_at': fields.Datetime.now()
        })
        # Mark all child orders paid
        self.order_ids.write({'state': 'paid', 'payment_method': 'tab'})
        
        # Free table if no other open tab on it
        if self.table_id:
            other_open = self.search_count([
                ('id', '!=', self.id),
                ('table_id', '=', self.table_id.id),
                ('state', '=', 'open')
            ])
            if other_open == 0:
                self.table_id.write({'state': 'available'})
        return True
