# -*- coding: utf-8 -*-
from odoo import models, fields

class ClubBarTable(models.Model):
    _name = 'club.bar.table'
    _description = 'Cafeteria & Bar Table'
    _order = 'table_number, name'

    name = fields.Char(string='Table Name', required=True, help="e.g. Table 1, Table 2, Lounge Booth 1")
    table_number = fields.Integer(string='Table Number', required=True, default=1)
    capacity = fields.Integer(string='Seating Capacity', default=4)
    state = fields.Selection([
        ('available', 'Available'),
        ('occupied', 'Occupied / In Service'),
        ('reserved', 'Reserved')
    ], string='Status', default='available', required=True)

    active = fields.Boolean(string='Active', default=True)
