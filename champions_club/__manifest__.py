# -*- coding: utf-8 -*-
{
    'name': 'Champions Club — Sports Club Management System',
    'version': '1.0.0',
    'category': 'Sports & Recreation',
    'summary': 'Digital backbone for sports club: Enquiries, Memberships, Courts, Pro Shop, and Cafe/Bar',
    'description': """
CHAMPIONS CLUB Management System
================================
Authoritative implementation of Sports Club Management:
- Visitor Enquiries & CRM Pipeline: New Enquiry -> Contacted -> Follow-up -> Converted
- Lead Assignment to Staff, Follow-up Logging, Quotations, and Member Conversion
- Sports Facilities: Tennis, Cricket, and Badminton courts
- 1-Hour Court Bookings with 30-Minute Staggered Slots
- Pro Shop Shared Inventory: Rackets, Balls, Shoes, Accessories, and Apparel
- Cafe & Bar POS: Orders, Tables, Member Running Tabs, Shifts
- Multi-Payment Support: Cash, Card, and UPI
- Membership Plans: Gold, Silver, Junior with Configurable Entitlements
    """,
    'author': 'Champions Club Development Team',
    'website': 'https://www.championsclub.example',
    'depends': ['base', 'mail'],
    'data': [
        'security/club_security.xml',
        'security/ir.model.access.csv',
        'data/club_membership_data.xml',
        'data/club_court_data.xml',
        'data/club_product_data.xml',
        'data/club_bar_data.xml',
        'data/club_enquiry_data.xml',
        'data/club_employee_data.xml',
        'data/club_finance_data.xml',
        'views/club_enquiry_views.xml',
        'views/club_membership_plan_views.xml',
        'views/club_member_views.xml',
        'views/club_court_views.xml',
        'views/club_booking_views.xml',
        'views/club_product_views.xml',
        'views/club_shop_order_views.xml',
        'views/club_bar_views.xml',
        'views/club_employee_views.xml',
        'views/club_finance_views.xml',
        'views/club_dashboard_views.xml',
        'views/club_menus.xml',
    ],
    'demo': [],
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
