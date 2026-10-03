# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError

class ClubProduct(models.Model):
    _name = 'club.product'
    _description = 'Champions Club Pro Shop Product & Unified Inventory'
    _order = 'category, name'

    name = fields.Char(string='Product Name', required=True)
    default_code = fields.Char(string='SKU / Barcode', copy=False)
    
    # Products strictly restricted to problem statement categories
    category = fields.Selection([
        ('rackets', 'Rackets'),
        ('balls', 'Balls'),
        ('shoes', 'Shoes'),
        ('accessories', 'Accessories'),
        ('apparel', 'Apparel')
    ], string='Category', required=True, default='rackets')

    # Configurable Selling Price
    list_price = fields.Float(
        string='Sales Price (Configurable)',
        digits=(10, 2),
        default=0.0,
        help="Standard retail selling price for counter and online purchases."
    )

    # Unified Shared Inventory Shelf
    qty_on_hand = fields.Float(
        string='Stock On Hand (Unified Shelf)',
        digits=(10, 0),
        default=0.0,
        help="Shared physical stock available for both counter sales and online orders."
    )

    # Low-Stock Awareness (Configurable Threshold)
    min_stock_alert_level = fields.Float(
        string='Low Stock Alert Threshold (Configurable)',
        digits=(10, 0),
        default=5.0,
        help="When stock on hand drops to or below this quantity, a low stock alert is triggered."
    )

    is_low_stock = fields.Boolean(
        string='Is Low Stock',
        compute='_compute_low_stock',
        store=True,
        help="Automatically flags products running low on the shared shelf."
    )

    description = fields.Text(string='Product Specifications')
    active = fields.Boolean(string='Active', default=True)

    @api.depends('qty_on_hand', 'min_stock_alert_level')
    def _compute_low_stock(self):
        for product in self:
            product.is_low_stock = (product.qty_on_hand <= product.min_stock_alert_level)

    def action_update_stock(self, new_qty):
        """Staff action to update unified physical inventory level."""
        for product in self:
            if new_qty < 0:
                raise ValidationError("Stock on hand cannot be negative.")
            product.qty_on_hand = new_qty
