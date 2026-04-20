app_name = "pos_app"
app_title = "Pos App"
app_publisher = "Richmond"
app_description = "app to override erpnext point of sale"
app_email = "erp@richmondcellar.com"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/pos_app/css/pos_app.css"
app_include_js = "pos_app.bundle.js"
# app_include_js = ["/assets/pos_app/dist/js/pos_app.bundle.TSWUR43L.js"]
# page_js = {
#     "point-of-sale": "public/js/pos_controller.js"
# }

# include js, css files in header of web template
# web_include_css = "/assets/pos_app/css/pos_app.css"
# web_include_js = "/assets/pos_app/js/pos_app.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "pos_app/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
	"Sales Invoice": "public/js/sales_invoice.js",
}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "pos_app.utils.jinja_methods",
# 	"filters": "pos_app.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "pos_app.install.before_install"
# after_install = "pos_app.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "pos_app.uninstall.before_uninstall"
# after_uninstall = "pos_app.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "pos_app.utils.before_app_install"
# after_app_install = "pos_app.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "pos_app.utils.before_app_uninstall"
# after_app_uninstall = "pos_app.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "pos_app.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"POS Invoice": {
        # "validate": "pos_app.overrides.pos_invoice.set_kot_number",
        "validate": [
            "pos_app.overrides.pos_invoice.set_kot_number",
            "pos_app.overrides.pos_invoice.set_contact_details_in_pos_invoice"
        ],
		"on_submit": ["pos_app.overrides.pos_invoice.update_reserved_qty",
					  "pos_app.overrides.pos_invoice.submit_stock_entry",
                       "pos_app.pos_invoice_whatsapp.send_pos_invoice_whatsapp",
                       "pos_app.overrides.pos_invoice.cleanup_walkin_customer_after_submit"
					#   "pos_app.pos_app.doctype.kitchen_order.kitchen_order.create_kitchen_orders_from_invoice"
],
		"on_cancel": "pos_app.overrides.pos_invoice.update_reserved_qty_cancel",

	},
    "Sales Invoice": {
		"on_submit": "pos_app.overrides.pos_invoice.reverse_reserved_qty",
	},
	"POS Closing Entry": {
		"validate": "pos_app.overrides.pos_closing_entry.validate",
	}
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"pos_app.tasks.all"
# 	],
# 	"daily": [
# 		"pos_app.tasks.daily"
# 	],
# 	"hourly": [
# 		"pos_app.tasks.hourly"
# 	],
# 	"weekly": [
# 		"pos_app.tasks.weekly"
# 	],
# 	"monthly": [
# 		"pos_app.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "pos_app.install.before_tests"

# Overriding Methods
# ------------------------------
#
override_whitelisted_methods = {
	"erpnext.accounts.doctype.pos_invoice.pos_invoice.get_stock_availability": "pos_app.overrides.pos_invoice.get_stock_availability",
	"erpnext.selling.page.point_of_sale.point_of_sale.get_past_order_list": "pos_app.overrides.pos_invoice.get_past_order_list",
    "erpnext.selling.page.point_of_sale.point_of_sale.get_items": "pos_app.overrides.pos_invoice.get_items",

}

# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "pos_app.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["pos_app.utils.before_request"]
# after_request = ["pos_app.utils.after_request"]

# Job Events
# ----------
# before_job = ["pos_app.utils.before_job"]
# after_job = ["pos_app.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"pos_app.auth.validate"
# ]

fixtures = [
	{
		"dt": "Custom Field",
		"filters": [
			["name", "in", [
				"POS Invoice-custom_room",
				"POS Invoice-custom_table",
                "POS Invoice-custom_sales_person",
				"POS Profile-custom_pos_room",
                "POS Profile-custom_default_table",
                "POS Profile-custom_pos_restaurant_item_groups",
                "POS Invoice Item-custom_notes",
                "POS Invoice-custom_kot_number",
				"POS Closing Entry-custom_column_break_k0hvq",
				"POS Closing Entry-custom_1000",
				"POS Closing Entry-custom_column_break_q23uc",
				"POS Closing Entry-custom_denominations",
				"POS Closing Entry-custom_total_denominations",
				"POS Closing Entry-custom_25_fills",
				"POS Closing Entry-custom_5_fills",
				"POS Closing Entry-custom_1",
				"POS Closing Entry-custom_5",
				"POS Closing Entry-custom_10",
				"POS Closing Entry-custom_20",
				"POS Closing Entry-custom_50",
				"POS Closing Entry-custom_100",
				"POS Closing Entry-custom_200",
				"POS Closing Entry-custom_500",
                "POS Invoice-custom_kot_status",
                "POS Profile-custom_enable_siv_print_in_qztray",
                "POS Profile-custom_siv_printer_name",
				"POS Profile-custom_purchase_order_rate_percentage",
                "POS Profile-custom_restaurant_item_groups",
				"POS Invoice Item-custom_stock_entry",
				"POS Profile-custom_enable_manufacturing",
				"POS Invoice-custom_enable_manufacturing",
				"POS Closing Entry-custom_restaurant_item_summary",
                "POS Profile-custom_is_video",
                "POS Profile-custom_customer_display_media"
                
			]]
		]
	},
    {
		"dt": "Property Setter",
		"filters": [
			["name", "in", [
				"POS Closing Entry-main-field_order",
                "POS Profile-main-field_order"
			]]
		]
	},
]

after_migrate = [
    "pos_app.customization.pos_invoice_custom_fields.create_pos_invoice_contact_fields"
]


