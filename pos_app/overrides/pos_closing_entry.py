import frappe

def validate(doc, method):
	pos_doc = frappe.get_doc("POS Profile", doc.pos_profile)
	item_groups = pos_doc.custom_pos_restaurant_item_groups
	res_itm_grp = []
	pos_inv_query = ""
	grp_res_query = ""
	grp_liq_query = ""
	if item_groups and isinstance(item_groups, list) and item_groups[0].get('name'):
		res_itm_grp = [frappe.db.get_value("POS Restaurant Item Groups", row.name, "item_group") for row in item_groups]
	pos_invoices = [i.pos_invoice for i in doc.pos_transactions if i.pos_invoice]
	pos_inv_query = "IN {0}".format(tuple(pos_invoices)) if len(pos_invoices) > 1 else "= '{0}'".format(pos_invoices[0])
	if res_itm_grp:
		grp_res_query = "IN {0}".format(tuple(res_itm_grp)) if len(res_itm_grp) > 1 else "= '{0}'".format(res_itm_grp[0])
		grp_liq_query = "NOT IN {0}".format(tuple(res_itm_grp)) if len(res_itm_grp) > 1 else "!= '{0}'".format(res_itm_grp[0])
	else:
		grp_liq_query = "!= ''"
	restaurant_items = frappe.db.sql("""
		SELECT 
			SUM(POSII.amount) AS amount, SUM(POSII.net_amount) AS net_amount, SUM(POSII.amount) - SUM(POSII.net_amount) AS tax_amount
		FROM 
			`tabPOS Invoice Item` POSII
		INNER JOIN 
			`tabItem` ITM
		ON 
			POSII.item_code = ITM.name
		WHERE
			POSII.parent {0} AND
			ITM.item_group {1}
	""".format(pos_inv_query, grp_res_query), as_dict=1)
	liquor_items = frappe.db.sql("""
		SELECT 
			SUM(POSII.amount) AS amount, SUM(POSII.net_amount) AS net_amount, SUM(POSII.amount) - SUM(POSII.net_amount) AS tax_amount
		FROM 
			`tabPOS Invoice Item` POSII
		INNER JOIN 
			`tabItem` ITM
		ON 
			POSII.item_code = ITM.name
		WHERE
			POSII.parent {0} AND
			ITM.item_group {1}
	""".format(pos_inv_query, grp_liq_query), as_dict=1)
	doc.custom_restaurant_item_summary = []
	if restaurant_items and pos_inv_query and res_itm_grp:
		doc.append("custom_restaurant_item_summary", {
			"amount": restaurant_items[0].amount,
			"tax_amount": restaurant_items[0].tax_amount,
			"net_amount": restaurant_items[0].net_amount,
			"item": "Restaurant Items"
		})
	if liquor_items and grp_liq_query and pos_inv_query:
		doc.append("custom_restaurant_item_summary", {
			"amount": liquor_items[0].amount,
			"tax_amount": liquor_items[0].tax_amount,
			"net_amount": liquor_items[0].net_amount,
			"item": "Liquor Items"
		})

	# Update difference in POS Closing Shift Chairs table
	update_closing_shift_chairs_difference(doc)


def update_closing_shift_chairs_difference(doc):
	from frappe.utils import flt
	for row in doc.payment_reconciliation:
		row.difference = flt(row.closing_amount) - flt(row.expected_amount)
