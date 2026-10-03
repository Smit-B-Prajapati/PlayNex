# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError
from datetime import date, datetime

class ClubTax(models.Model):
    _name = 'club.tax'
    _description = 'Sports Club Tax Configuration'
    _order = 'sequence, name'

    name = fields.Char(string='Tax Name / Description', required=True)
    sequence = fields.Integer(string='Sequence', default=10)
    tax_type = fields.Selection([
        ('percent', 'Percentage (%)'),
        ('fixed', 'Fixed Amount')
    ], string='Tax Calculation Type', required=True, default='percent')
    
    amount = fields.Float(
        string='Tax Rate (Configurable)',
        digits=(10, 2),
        required=True,
        default=0.0,
        help="Configurable tax rate. Standard Odoo tax rules apply without hardcoded assumptions."
    )
    
    type_tax_use = fields.Selection([
        ('sale', 'Sales & Invoicing'),
        ('purchase', 'Procurement & Purchases'),
        ('none', 'None')
    ], string='Tax Scope', default='sale', required=True)

    active = fields.Boolean(string='Active', default=True)
    description = fields.Text(string='Tax Notes / Statutory Reference')


class ClubInvoice(models.Model):
    _name = 'club.invoice'
    _description = 'Sports Club Customer & Corporate Invoice'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'invoice_date desc, id desc'

    name = fields.Char(string='Invoice Number', readonly=True, copy=False, default='Draft')
    
    invoice_type = fields.Selection([
        ('membership', 'Membership Subscription & Renewal'),
        ('court_corporate', 'Corporate Court / Tournament Hire'),
        ('shop', 'Pro Shop Goods / Wholesale Order'),
        ('bar_event', 'Cafeteria Banquet & Event Catering'),
        ('general', 'General Business Client Invoice')
    ], string='Invoice Category', required=True, default='membership', tracking=True)

    partner_id = fields.Many2one(
        'res.partner',
        string='Customer / Business Client',
        required=True,
        tracking=True,
        help="Related partner entity (Member contact or Corporate entity)"
    )
    member_id = fields.Many2one('club.member', string='Related Member Profile', tracking=True)
    booking_id = fields.Many2one('club.booking', string='Linked Court Booking', tracking=True)
    shop_order_id = fields.Many2one('club.shop.order', string='Linked Shop Order', tracking=True)
    bar_order_id = fields.Many2one('club.bar.order', string='Linked Bar Order', tracking=True)

    invoice_date = fields.Date(string='Invoice Date', default=fields.Date.context_today, required=True, tracking=True)
    due_date = fields.Date(string='Due Date', default=fields.Date.context_today, required=True, tracking=True)

    line_ids = fields.One2many('club.invoice.line', 'invoice_id', string='Invoice Lines', copy=True)
    payment_ids = fields.One2many('club.payment', 'invoice_id', string='Registered Payments')

    # Computed Financial Totals
    amount_untaxed = fields.Float(
        string='Untaxed Subtotal',
        digits=(10, 2),
        compute='_compute_totals',
        store=True,
        tracking=True
    )
    amount_tax = fields.Float(
        string='Configured Tax Amount',
        digits=(10, 2),
        compute='_compute_totals',
        store=True,
        tracking=True
    )
    amount_total = fields.Float(
        string='Total Amount',
        digits=(10, 2),
        compute='_compute_totals',
        store=True,
        tracking=True
    )
    amount_paid = fields.Float(
        string='Total Paid',
        digits=(10, 2),
        compute='_compute_payment_totals',
        store=True
    )
    amount_residual = fields.Float(
        string='Amount Due / Residual',
        digits=(10, 2),
        compute='_compute_payment_totals',
        store=True,
        tracking=True
    )

    state = fields.Selection([
        ('draft', 'Draft'),
        ('posted', 'Posted / Open'),
        ('paid', 'Paid & Settled'),
        ('cancelled', 'Cancelled')
    ], string='Invoice Status', default='draft', required=True, tracking=True)

    payment_state = fields.Selection([
        ('not_paid', 'Not Paid'),
        ('partial', 'Partially Paid'),
        ('paid', 'Fully Settled')
    ], string='Payment Status', compute='_compute_payment_totals', store=True, tracking=True)

    notes = fields.Text(string='Payment Terms & Notes')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'Draft') == 'Draft':
                seq = self.env['ir.sequence'].next_by_code('club.invoice')
                if not seq:
                    count = self.search_count([]) + 1
                    seq = f"CC-INV-{date.today().year}-{count:04d}"
                vals['name'] = seq
        return super(ClubInvoice, self).create(vals_list)

    @api.depends('line_ids.price_subtotal', 'line_ids.price_tax')
    def _compute_totals(self):
        for inv in self:
            untaxed = sum(inv.line_ids.mapped('price_subtotal'))
            tax = sum(inv.line_ids.mapped('price_tax'))
            inv.amount_untaxed = untaxed
            inv.amount_tax = tax
            inv.amount_total = untaxed + tax

    @api.depends('amount_total', 'payment_ids.state', 'payment_ids.amount')
    def _compute_payment_totals(self):
        for inv in self:
            valid_payments = inv.payment_ids.filtered(lambda p: p.state == 'posted')
            paid = sum(valid_payments.mapped('amount'))
            inv.amount_paid = paid
            residual = max(0.0, inv.amount_total - paid)
            inv.amount_residual = residual

            if inv.state == 'draft':
                inv.payment_state = 'not_paid'
            elif residual <= 0.001 and inv.amount_total > 0:
                inv.payment_state = 'paid'
                if inv.state == 'posted':
                    inv.state = 'paid'
            elif paid > 0:
                inv.payment_state = 'partial'
            else:
                inv.payment_state = 'not_paid'

    def action_post(self):
        for inv in self:
            if inv.state != 'draft':
                raise UserError("Only draft invoices can be posted.")
            if not inv.line_ids:
                raise ValidationError("Cannot post an invoice with no line items.")
            inv.write({'state': 'posted'})
        return True

    def action_register_payment(self, amount, payment_method, memo='', transaction_ref=''):
        """Registers a payment against this invoice and reconciles residual balance."""
        self.ensure_one()
        if self.state not in ['posted', 'paid']:
            raise UserError("Payments can only be registered on posted invoices.")
        if amount <= 0:
            raise ValidationError("Payment amount must be greater than zero.")
        if amount > self.amount_residual:
            raise ValidationError(f"Payment amount (₹{amount:,.2f}) exceeds outstanding residual (₹{self.amount_residual:,.2f}).")

        payment = self.env['club.payment'].create({
            'invoice_id': self.id,
            'partner_id': self.partner_id.id,
            'member_id': self.member_id.id if self.member_id else False,
            'source_type': self._map_source_type(),
            'booking_id': self.booking_id.id if self.booking_id else False,
            'shop_order_id': self.shop_order_id.id if self.shop_order_id else False,
            'bar_order_id': self.bar_order_id.id if self.bar_order_id else False,
            'amount': amount,
            'payment_method': payment_method,
            'transaction_ref': transaction_ref,
            'notes': memo,
            'state': 'posted'
        })
        # Recompute totals and status
        self._compute_payment_totals()
        return payment

    def _map_source_type(self):
        if self.invoice_type == 'membership':
            return 'membership'
        elif self.invoice_type == 'court_corporate':
            return 'court'
        elif self.invoice_type == 'shop':
            return 'shop'
        elif self.invoice_type == 'bar_event':
            return 'bar'
        return 'corporate_invoice'

    def action_cancel(self):
        for inv in self:
            if any(p.state == 'posted' for p in inv.payment_ids):
                raise UserError("Cannot cancel an invoice with posted payments. Void payments first.")
            inv.write({'state': 'cancelled'})
        return True


class ClubInvoiceLine(models.Model):
    _name = 'club.invoice.line'
    _description = 'Sports Club Invoice Line Item'

    invoice_id = fields.Many2one('club.invoice', string='Invoice Reference', required=True, ondelete='cascade')
    name = fields.Char(string='Description', required=True)
    quantity = fields.Float(string='Quantity', default=1.0, digits=(10, 2), required=True)
    price_unit = fields.Float(string='Unit Price', digits=(10, 2), required=True, default=0.0)
    
    tax_id = fields.Many2one(
        'club.tax',
        string='Configured Tax',
        domain="[('type_tax_use', '=', 'sale'), ('active', '=', True)]",
        help="Tax configuration applied from system settings."
    )

    price_subtotal = fields.Float(
        string='Subtotal (Untaxed)',
        digits=(10, 2),
        compute='_compute_line_amounts',
        store=True
    )
    price_tax = fields.Float(
        string='Tax Amount',
        digits=(10, 2),
        compute='_compute_line_amounts',
        store=True
    )
    price_total = fields.Float(
        string='Total (Inc. Tax)',
        digits=(10, 2),
        compute='_compute_line_amounts',
        store=True
    )

    @api.depends('quantity', 'price_unit', 'tax_id.amount', 'tax_id.tax_type')
    def _compute_line_amounts(self):
        for line in self:
            subtotal = line.quantity * line.price_unit
            tax_amount = 0.0
            if line.tax_id and line.tax_id.active:
                if line.tax_id.tax_type == 'percent':
                    tax_amount = (subtotal * line.tax_id.amount) / 100.0
                elif line.tax_id.tax_type == 'fixed':
                    tax_amount = line.tax_id.amount * line.quantity
            
            line.price_subtotal = subtotal
            line.price_tax = tax_amount
            line.price_total = subtotal + tax_amount


class ClubPayment(models.Model):
    _name = 'club.payment'
    _description = 'Sports Club Inbound Payment Transaction'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'payment_date desc, id desc'

    name = fields.Char(string='Payment Reference', readonly=True, copy=False, default='New')
    invoice_id = fields.Many2one('club.invoice', string='Reconciled Invoice', tracking=True)
    
    partner_id = fields.Many2one('res.partner', string='Payer / Customer', required=True, tracking=True)
    member_id = fields.Many2one('club.member', string='Member Account', tracking=True)

    source_type = fields.Selection([
        ('membership', 'Membership Fee Collection'),
        ('court', 'Court Booking / Facility Fee'),
        ('shop', 'Pro Shop Counter / Online Sale'),
        ('bar', 'Bar & Cafeteria Settlement'),
        ('corporate_invoice', 'Corporate Client Invoice Payment')
    ], string='Revenue Stream', required=True, default='membership', tracking=True)

    booking_id = fields.Many2one('club.booking', string='Court Booking Ref')
    shop_order_id = fields.Many2one('club.shop.order', string='Shop Order Ref')
    bar_order_id = fields.Many2one('club.bar.order', string='Bar Order Ref')

    amount = fields.Float(string='Paid Amount', digits=(10, 2), required=True, tracking=True)

    payment_method = fields.Selection([
        ('cash', 'Cash Payment'),
        ('card', 'Credit / Debit Card POS'),
        ('upi', 'UPI / Online Transfer')
    ], string='Payment Method', required=True, default='upi', tracking=True, help="""
    Payment verification methods:
    - Cash: Handover at cashier desk.
    - Card: Swiped at physical EDC terminal.
    - UPI: Verified via banking transaction UTR / QR receipt.
    """)

    transaction_ref = fields.Char(
        string='Transaction Reference / UTR',
        help="Bank transaction reference number, card auth code, or cash receipt number"
    )

    payment_date = fields.Datetime(
        string='Payment Timestamp',
        default=fields.Datetime.now,
        required=True,
        tracking=True
    )

    state = fields.Selection([
        ('draft', 'Draft'),
        ('posted', 'Posted / Completed'),
        ('cancelled', 'Cancelled')
    ], string='Status', default='posted', required=True, tracking=True)

    notes = fields.Text(string='Payment Memo')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                seq = self.env['ir.sequence'].next_by_code('club.payment')
                if not seq:
                    count = self.search_count([]) + 1
                    seq = f"CC-PAY-{date.today().year}-{count:04d}"
                vals['name'] = seq
        return super(ClubPayment, self).create(vals_list)

    def action_post(self):
        self.write({'state': 'posted'})
        if self.invoice_id:
            self.invoice_id._compute_payment_totals()
        return True

    def action_cancel(self):
        self.write({'state': 'cancelled'})
        if self.invoice_id:
            self.invoice_id._compute_payment_totals()
        return True
