# -*- coding: utf-8 -*-
from odoo import models, fields

class ClubBarItem(models.Model):
    _name = 'club.bar.item'
    _description = 'Cafeteria & Bar Menu Item'
    _order = 'category, name'

    name = fields.Char(string='Item Name', required=True)
    category = fields.Selection([
        ('beverage', 'Beverages & Soft Drinks'),
        ('food', 'Food & Snacks'),
        ('nutrition', 'Sports Nutrition & Shakes')
    ], string='Menu Category', required=True, default='beverage')

    price = fields.Float(
        string='Price (Configurable)',
        digits=(10, 2),
        default=0.0,
        help="Configurable item selling price."
    )
    active = fields.Boolean(string='Active', default=True)
