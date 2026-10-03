# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError

class ClubEmployee(models.Model):
    _name = 'club.employee'
    _description = 'Champions Club Staff Member'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'name'

    name = fields.Char(string='Staff Name', required=True, tracking=True)
    employee_code = fields.Char(string='Staff ID', readonly=True, copy=False, default='New')
    user_id = fields.Many2one('res.users', string='Related User Account', tracking=True)
    
    role = fields.Selection([
        ('front_desk', 'Front Desk & Reception'),
        ('bar_cafe', 'Bar & Cafeteria Staff'),
        ('court_marshal', 'Court Operations & Equipment'),
        ('coach', 'Sports Coach / Trainer'),
        ('management', 'Club Management / Operations')
    ], string='Role / Department', required=True, default='front_desk', tracking=True)

    phone = fields.Char(string='Phone / WhatsApp', tracking=True)
    email = fields.Char(string='Email Address', tracking=True)
    active = fields.Boolean(string='Active Staff', default=True)

    # Linked Shifts and Leave records
    schedule_ids = fields.One2many('club.staff.schedule', 'employee_id', string='Assigned Schedules')
    bar_shift_ids = fields.One2many('club.bar.shift', 'employee_id', string='Bar Shifts')
    leave_ids = fields.One2many('club.employee.leave', 'employee_id', string='Leave Requests')
    
    notes = fields.Text(string='Staff Notes')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('employee_code', 'New') == 'New':
                seq = self.env['ir.sequence'].next_by_code('club.employee')
                if not seq:
                    # Fallback sequence count
                    count = self.search_count([]) + 1
                    seq = f"CC-EMP-{count:03d}"
                vals['employee_code'] = seq
        return super(ClubEmployee, self).create(vals_list)


class ClubStaffSchedule(models.Model):
    _name = 'club.staff.schedule'
    _description = 'Champions Club Staff Operational Schedule / Shift'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'shift_date desc, start_time asc'

    name = fields.Char(string='Schedule Reference', required=True, copy=False, default='New')
    employee_id = fields.Many2one('club.employee', string='Staff Member', required=True, tracking=True)
    
    operation_type = fields.Selection([
        ('front_desk', 'Front Desk & Reception Duty'),
        ('bar_cafe', 'Bar & Cafeteria POS Operations'),
        ('court_marshal', 'Court Monitoring & Equipment')
    ], string='Operation Area', required=True, default='front_desk', tracking=True)

    shift_date = fields.Date(string='Schedule Date', required=True, default=fields.Date.context_today, tracking=True)
    start_time = fields.Datetime(string='Shift Start Time', required=True, tracking=True)
    end_time = fields.Datetime(string='Shift End Time', required=True, tracking=True)

    state = fields.Selection([
        ('draft', 'Scheduled'),
        ('confirmed', 'Confirmed'),
        ('active', 'On Duty'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled')
    ], string='Status', default='confirmed', tracking=True)

    notes = fields.Text(string='Shift Instructions / Handover Notes')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                seq = self.env['ir.sequence'].next_by_code('club.staff.schedule')
                if not seq:
                    count = self.search_count([]) + 1
                    seq = f"CC-SCHED-{count:04d}"
                vals['name'] = seq
        return super(ClubStaffSchedule, self).create(vals_list)

    @api.constrains('start_time', 'end_time')
    def _check_shift_times(self):
        for rec in self:
            if rec.start_time and rec.end_time and rec.end_time <= rec.start_time:
                raise ValidationError("Shift end time must be after shift start time.")

    def action_start_shift(self):
        self.write({'state': 'active'})
        return True

    def action_complete_shift(self):
        self.write({'state': 'completed'})
        return True


class ClubEmployeeLeave(models.Model):
    _name = 'club.employee.leave'
    _description = 'Champions Club Employee Leave Request'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'start_date desc, id desc'

    employee_id = fields.Many2one('club.employee', string='Staff Member', required=True, tracking=True)
    
    leave_type = fields.Selection([
        ('casual', 'Casual Leave'),
        ('sick', 'Medical / Sick Leave'),
        ('annual', 'Annual Paid Leave'),
        ('unpaid', 'Unpaid Leave')
    ], string='Leave Category', required=True, default='casual', tracking=True)

    start_date = fields.Date(string='Leave Start Date', required=True, default=fields.Date.context_today)
    end_date = fields.Date(string='Leave End Date', required=True, default=fields.Date.context_today)
    reason = fields.Text(string='Leave Reason', required=True)
    
    state = fields.Selection([
        ('draft', 'Draft'),
        ('requested', 'Pending Approval'),
        ('approved', 'Approved'),
        ('refused', 'Refused')
    ], string='Status', default='requested', tracking=True)

    approver_id = fields.Many2one('res.users', string='Approved / Reviewed By', readonly=True, tracking=True)
    approval_date = fields.Datetime(string='Decision Date', readonly=True)

    @api.constrains('start_date', 'end_date')
    def _check_dates(self):
        for leave in self:
            if leave.start_date and leave.end_date and leave.end_date < leave.start_date:
                raise ValidationError("Leave end date cannot be earlier than leave start date.")

    def action_submit(self):
        self.write({'state': 'requested'})
        return True

    def action_approve(self):
        if not self.env.user.has_group('champions_club.group_club_manager') and not self.env.user.has_group('champions_club.group_club_administrator'):
            raise UserError("Only Club Managers and Administrators are authorized to approve leave requests.")
        self.write({
            'state': 'approved',
            'approver_id': self.env.user.id,
            'approval_date': fields.Datetime.now()
        })
        return True

    def action_refuse(self):
        if not self.env.user.has_group('champions_club.group_club_manager') and not self.env.user.has_group('champions_club.group_club_administrator'):
            raise UserError("Only Club Managers and Administrators are authorized to refuse leave requests.")
        self.write({
            'state': 'refused',
            'approver_id': self.env.user.id,
            'approval_date': fields.Datetime.now()
        })
        return True
