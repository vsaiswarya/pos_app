import frappe
import json

from erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry import make_closing_entry_from_opening
from frappe.model.mapper import get_mapped_doc

@frappe.whitelist()
def get_all_item_groups(pos_profile):
	groups = [ i.item_group for i in frappe.get_all("POS Item Group", fields=["item_group"], filters={"parent": pos_profile}, order_by="name asc") ]
	ktchn_groups = [ i.item_group for i in frappe.get_all("POS Restaurant Item Groups", fields=["item_group"], filters={"parent": pos_profile}, order_by="name asc") ]
	liqr_groups = [g for g in groups if g not in ktchn_groups]

	return {
		"liqr_groups": liqr_groups,
		"ktchn_groups": ktchn_groups
	}

@frappe.whitelist()
def get_available_tables(room):
	tables = frappe.get_all(
		"POS Table",
		fields=["table_name","name"],
		filters={"room": room},
		order_by="table_name asc"
	)
	return tables

@frappe.whitelist()
def get_all_rooms():
	rooms = frappe.get_all(
		"POS Room",
		fields=["name"],
		order_by="name asc"
	)
	return rooms

@frappe.whitelist()
def get_item_uoms(item_code):
	uoms = frappe.get_all("UOM Conversion Detail",
		fields=["uom"],
		filters={"parent": item_code, "parenttype": "Item"},
		order_by="conversion_factor asc"
	)   
	return uoms


@frappe.whitelist()
def submit_pos_invoice(docname):
	"""Submit POS Invoice"""
	doc = frappe.get_doc("POS Invoice", docname)
	if doc.docstatus == 0:
		doc.submit()
	print_format,qz_siv,siv_printer = frappe.db.get_value("POS Profile", doc.pos_profile, ["print_format","custom_enable_siv_print_in_qztray","custom_siv_printer_name"])
	return {
		"doc": doc.as_dict(),
		"print_format": print_format,
		"qz_siv":qz_siv,
		"siv_printer": siv_printer
	}

@frappe.whitelist()
def submit_pos_closing(denominations):
	if isinstance(denominations, str):
		denominations = json.loads(denominations)
	poe_doc = frappe.get_doc("POS Opening Entry", denominations.get("pos_opening_entry"))
	pce_doc = make_closing_entry_from_opening(poe_doc)
	pce_doc.update({
		"posting_date": denominations.get("posting_date"),
		"posting_time": denominations.get("posting_time"),
		"custom_1000": denominations.get("denom_1000"),
		"custom_500": denominations.get("denom_500"),
		"custom_100": denominations.get("denom_100"),
		"custom_200": denominations.get("denom_200"),
		"custom_50": denominations.get("denom_50"),
		"custom_20": denominations.get("denom_20"),
		"custom_10": denominations.get("denom_10"),
		"custom_5": denominations.get("denom_5"),
		"custom_1": denominations.get("denom_1"),
		"custom_5_fills": denominations.get("denom_0.5"),
		"custom_25_fills": denominations.get("denom_0.25"),
		"custom_total_denominations": denominations.get("denom_total"),
	})
	for p in pce_doc.payment_reconciliation:
		if p.mode_of_payment in list(denominations.keys()):
			p.closing_amount = denominations.get(p.mode_of_payment)
	pce_doc.save(ignore_permissions=True)
	pce_doc.submit()

@frappe.whitelist()
def make_purchase_order(source_name, target_doc=None, args=None):
	per = frappe.db.get_value("POS Profile",frappe.flags.args.pos_profile, "custom_purchase_order_rate_percentage")
	if not per:
		frappe.throw(frappe._("Please set Purchase Order Rate Percentage in POS Profile."))
	def set_missing_values(source, target):
		doc = frappe.get_doc(target)
		doc.buying_price_list = ""

	def update_item(obj, target, source_parent):
		target.rate = obj.rate - ((obj.rate * per) / 100)

	def filter_item(obj):
		return True if frappe.db.get_value("Item", obj.item_code, "item_group") in item_groups else False

	source_doc = frappe.get_doc("Sales Invoice", source_name)

	pos_doc = frappe.get_doc("POS Profile", source_doc.pos_profile)
	item_groups = pos_doc.custom_pos_restaurant_item_groups
	
	# If it's a list of dicts (child table), extract values:
	if item_groups and isinstance(item_groups, list) and item_groups[0].get('name'):
		item_groups = [frappe.db.get_value("POS Restaurant Item Groups", row.name, "item_group") for row in item_groups]

	doclist = get_mapped_doc(
		"Sales Invoice",
		source_name,
		{
			"Sales Invoice": {
				"doctype": "Purchase Order",				
				"validation": {"docstatus": ["=", 1]},
			},
			"Sales Invoice Item": {
				"doctype": "Purchase Order Item",
				"field_map": {
					"uom", "stock_uom",
					"uom", "uom",
				},
				"postprocess": update_item,
				"condition": filter_item
			},
		},
		target_doc,
		set_missing_values
	)
	doclist.supplier = frappe.flags.args.supplier
	doclist.set_onload("load_after_mapping", False)
	return doclist
	