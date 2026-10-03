# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError

class ClubBarOrder(models.Model):
    _name = 'club.bar.order'
    _description = 'Cafeteria & Bar POS Order'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'order_time desc, id desc'

    name = fields.Char(string='Order Ticket', readonly=True, copy=False, default='New')

    order_type = fields.Selection([
        ('direct', 'Direct Payment Order'),
        ('tab', 'Charge to Member Tab')
    ], string='Order Billing Type', required=True, default='direct')

    tab_id = fields.Many2one('club.bar.tab', string='Member Tab')
    table_id = fields.Many2one('club.bar.table', string='Table')
    shift_id = fields.Many2one('club.bar.shift', string='Shift')

    customer_type = fields.Selection([
        ('member', 'Club Member'),
        ('walkin', 'Walk-in Guest')
    ], string='Customer Type', required=True, default='member')

    member_id = fields.Many2one('club.member', string='Member')
    plan_id = fields.Many2one(related='member_id.plan_id', string='Membership Plan', readonly=True)
    guest_name = fields.Char(string='Guest Name')

    order_time = fields.Datetime(string='Order Placed At', default=fields.Datetime.now, required=True)

    order_line_ids = fields.One2many(
        'club.bar.order.line',
        'order_id',
        string='Menu Items Ordered',
        copy=True
    )

    # Automatic Member Tier Discount
    discount_percent = fields.Float(
        string='Applied Member Discount %',
        digits=(5, 2),
        compute='_compute_discount_percent',
        store=True,
        help="Discount applied automatically from member tier plan without manual prompt."
    )

    amount_subtotal = fields.Float(
        string='Subtotal',
        digits=(10, 2),
        compute='_compute_order_totals',
        store=True
    )
    amount_discount = fields.Float(
        string='Member Discount Amount',
        digits=(10, 2),
        compute='_compute_order_totals',
        store=True
    )
    amount_total = fields.Float(
        string='Total Due',
        digits=(10, 2),
        compute='_compute_order_totals',
        store=True
    )

    # Multi-Payment Support: Cash, Card, UPI
    payment_method = fields.Selection([
        ('cash', 'Cash'),
        ('card', 'Card (Credit/Debit)'),
        ('upi', 'UPI (Instant QR / VPA)'),
        ('tab', 'Running Member Tab')
    ], string='Payment Method', tracking=True)

    state = fields.Selection([
        ('draft', 'Draft / In Entry'),
        ('confirmed', 'In Kitchen / Bar Prep'),
        ('served', 'Served to Table'),
        ('paid', 'Paid & Completed'),
        ('tabbed', 'Charged to Tab'),
        ('cancelled', 'Cancelled')
    ], string='Order Status', default='draft', required=True, tracking=True)

    notes = fields.Text(string='Kitchen / Preparation Notes')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code('club.bar.order') or 'CC-BAR'
        orders = super(ClubBarOrder, self).create(vals_list)
        for order in orders:
            if order.table_id and order.state not in ['paid', 'cancelled']:
                order.table_id.write({'state': 'occupied'})
        return orders

    @api.depends('customer_type', 'member_id.plan_id', 'tab_id')
    def _compute_discount_percent(self):
        for order in self:
            if order.tab_id and order.tab_id.member_id and order.tab_id.member_id.plan_id:
                order.discount_percent = order.tab_id.member_id.plan_id.bar_discount_percent
            elif order.customer_type == 'member' and order.member_id and order.member_id.plan_id:
                order.discount_percent = order.member_id.plan_id.bar_discount_percent
            else:
                order.discount_percent = 0.0

    @api.depends('order_line_ids.subtotal', 'discount_percent')
    def _compute_order_totals(self):
        for order in self:
            sub = sum(order.order_line_ids.mapped('subtotal'))
            disc = (sub * order.discount_percent) / 100.0 if order.discount_percent > 0 else 0.0
            order.amount_subtotal = sub
            order.amount_discount = disc
            order.amount_total = sub - disc

    def action_confirm_order(self):
        """Sends order to kitchen/bar with table tracking."""
        if not self.order_line_ids:
            raise ValidationError("Cannot send an empty order.")
        self.write({'state': 'confirmed'})
        if self.table_id:
            self.table_id.write({'state': 'occupied'})
        return True

    def action_mark_served(self):
        self.write({'state': 'served'})
        return True

    def action_pay_direct(self, payment_method):
        """Processes payment via Cash, Card, or UPI and completes transaction."""
        if payment_method not in ['cash', 'card', 'upi']:
            raise ValidationError("Payment method must be Cash, Card, or UPI.")
        self.write({
            'state': 'paid',
            'payment_method': payment_method
        })
        if self.table_id:
            # Check if other active orders on table
            active_orders = self.search_count([
                ('id', '!=', self.id),
                ('table_id', '=', self.table_id.id),
                ('state', 'in', ['draft', 'confirmed', 'served'])
            ])
            if active_orders == 0:
                self.table_id.write({'state': 'available'})
        return True

    def action_charge_to_tab(self, tab):
        """Charges order to an open member running tab."""
        self.write({
            'state': 'tabbed',
            'tab_id': tab.id,
            'payment_method': 'tab'
        })
        return True


class ClubBarOrderLine(models.Model):
    _name = 'club.bar.order.line'
    _description = 'Bar Order Line Item'

    order_id = fields.Many2one('club.bar.order', string='Order', required=True, ondelete='cascade')
    item_id = fields.Many2one('club.bar.item', string='Menu Item', required=True)
    qty = fields.Float(string='Quantity', digits=(10, 0), default=1.0, required=True)
    unit_price = fields.Float(string='Unit Price', digits=(10, 2), required=True)
    subtotal = fields.Float(string='Subtotal', digits=(10, 2), compute='_compute_subtotal', store=True)

    @api.onchange('item_id')
    def _onchange_item_id(self):
        if self.item_id:
            self.unit_price = self.item_id.price

    @api.depends('qty', 'unit_price')
    def _compute_subtotal(self):
        for line in self:
            line.subtotal = line.qty * line.unit_price
