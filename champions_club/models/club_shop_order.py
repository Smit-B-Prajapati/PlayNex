# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError

class ClubShopOrder(models.Model):
    _name = 'club.shop.order'
    _description = 'Pro Shop Omnichannel Sales Order'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'order_date desc, id desc'

    name = fields.Char(
        string='Order Reference',
        readonly=True,
        copy=False,
        default='New'
    )

    # Omnichannel Ordering
    channel = fields.Selection([
        ('counter', 'Counter Purchase (In-Club Walk-in)'),
        ('online', 'Online Order (Home / Sofa Order)')
    ], string='Sales Channel', required=True, default='counter', tracking=True)

    # Fulfillment: Pickup at Club vs Home Delivery
    fulfillment_type = fields.Selection([
        ('immediate', 'Immediate Handover (Counter)'),
        ('pickup', 'Collect at Club (Click & Collect)'),
        ('delivery', 'Home Delivery (Dispatched to Doorstep)')
    ], string='Fulfillment Method', required=True, default='immediate', tracking=True)

    customer_type = fields.Selection([
        ('member', 'Club Member'),
        ('guest', 'Walk-in / Online Guest')
    ], string='Customer Type', required=True, default='member')

    member_id = fields.Many2one('club.member', string='Member', tracking=True)
    customer_name = fields.Char(string='Customer / Recipient Name', required=True)
    customer_phone = fields.Char(string='Contact Number')
    delivery_address = fields.Text(
        string='Delivery Address',
        help="Required when fulfillment method is Home Delivery."
    )

    order_date = fields.Datetime(
        string='Order Date',
        default=fields.Datetime.now,
        required=True
    )

    order_line_ids = fields.One2many(
        'club.shop.order.line',
        'order_id',
        string='Order Items',
        copy=True
    )

    amount_total = fields.Float(
        string='Total Amount (Configurable)',
        digits=(10, 2),
        compute='_compute_amount_total',
        store=True,
        help="Total order value calculated from product lines."
    )

    state = fields.Selection([
        ('draft', 'Draft / Cart'),
        ('confirmed', 'Confirmed / Stock Deducted'),
        ('ready', 'Ready for Collection / Dispatched'),
        ('completed', 'Completed / Delivered'),
        ('cancelled', 'Cancelled / Stock Restored')
    ], string='Order Status', default='draft', tracking=True)

    notes = fields.Text(string='Special Instructions')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code('club.shop.order') or 'CC-SO'
        return super(ClubShopOrder, self).create(vals_list)

    @api.depends('order_line_ids.subtotal')
    def _compute_amount_total(self):
        for order in self:
            order.amount_total = sum(order.order_line_ids.mapped('subtotal'))

    @api.constrains('fulfillment_type', 'delivery_address')
    def _check_delivery_address(self):
        for order in self:
            if order.fulfillment_type == 'delivery' and not order.delivery_address:
                raise ValidationError("Delivery Address is required for Home Delivery orders.")

    def action_confirm(self):
        """
        Confirms order and atomically deducts inventory from the unified shelf.
        Both online and counter orders draw from the EXACT same stock records.
        """
        for order in self:
            if order.state != 'draft':
                continue

            if not order.order_line_ids:
                raise ValidationError("Cannot confirm an order with no product lines.")

            # Atomically check and deduct stock from unified shelf
            for line in order.order_line_ids:
                product = line.product_id
                if product.qty_on_hand < line.qty:
                    raise ValidationError(
                        f"Insufficient Stock on Unified Shelf: Product '{product.name}' only has "
                        f"{int(product.qty_on_hand)} units available. You requested {int(line.qty)}."
                    )
                # Deduct from the single shared shelf
                product.qty_on_hand -= line.qty

            if order.fulfillment_type == 'immediate':
                order.write({'state': 'completed'})
            else:
                order.write({'state': 'confirmed'})
        return True

    def action_ready_for_pickup(self):
        self.write({'state': 'ready'})
        return True

    def action_complete(self):
        self.write({'state': 'completed'})
        return True

    def action_cancel(self):
        """
        Cancels order and returns reserved inventory back to the unified shelf.
        """
        for order in self:
            if order.state in ['confirmed', 'ready']:
                # Restore stock to shared shelf
                for line in order.order_line_ids:
                    line.product_id.qty_on_hand += line.qty
            order.write({'state': 'cancelled'})
        return True


class ClubShopOrderLine(models.Model):
    _name = 'club.shop.order.line'
    _description = 'Pro Shop Order Line'

    order_id = fields.Many2one(
        'club.shop.order',
        string='Order Reference',
        required=True,
        ondelete='cascade'
    )
    product_id = fields.Many2one(
        'club.product',
        string='Product',
        required=True,
        domain="[('active', '=', True)]"
    )
    qty = fields.Float(
        string='Quantity',
        digits=(10, 0),
        default=1.0,
        required=True
    )
    unit_price = fields.Float(
        string='Unit Price (Configurable)',
        digits=(10, 2),
        required=True
    )
    subtotal = fields.Float(
        string='Subtotal',
        digits=(10, 2),
        compute='_compute_subtotal',
        store=True
    )

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if self.product_id:
            self.unit_price = self.product_id.list_price

    @api.depends('qty', 'unit_price')
    def _compute_subtotal(self):
        for line in self:
            line.subtotal = line.qty * line.unit_price

    @api.constrains('qty')
    def _check_qty_positive(self):
        for line in self:
            if line.qty <= 0:
                raise ValidationError("Order line quantity must be strictly greater than zero.")
