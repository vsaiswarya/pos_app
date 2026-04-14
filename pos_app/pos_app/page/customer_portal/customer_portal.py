


import random
import frappe
import json


@frappe.whitelist()
def customer_portal_page(customer,invoice_,pos_profile,date,items,taxes,grand_total,net_total,total_item_qty):
	# Parse items if it's a JSON string
	if isinstance(items, str):
		items = json.loads(items)
	
	# Map items to the required format
	mapped_items = [
		{
			'name': item.get('item_name', item.get('item_code', '')),
			'qty': item.get('qty', 0),
			'uom': item.get('uom', ''),
			'rate': item.get('rate', 0),
			'tax_rate': item.get('tax_rate', 0),
			'amount': item.get('amount', 0)
		}
		for item in items
	]
	# get customer phone number need to mfetchbit from caontact linked with cutomer
	customer_phone = ""
	customer_phone = frappe.db.sql("""
		SELECT c.phone
		FROM `tabContact` c
		INNER JOIN `tabDynamic Link` dl
			ON dl.parent = c.name
		WHERE dl.link_doctype = 'Customer'
			AND dl.link_name = %s
	""", customer, as_dict=True)
	if customer_phone:
		customer_phone = customer_phone[0].get("phone", "")
	
	frappe.publish_realtime(
		event="customer_portal",
		message={
			'invoice': invoice_,
			'date': date,
			'customer_phone': customer_phone,
			'customer': customer,
			'items': mapped_items,
			'taxes': taxes,
			'grand_total': grand_total,
			'net_total': net_total,
			'total_item_qty': total_item_qty,

		},
		user=frappe.session.user,
	)
	


@frappe.whitelist()
def pos_profile_and_media():
	user = frappe.session["user"]
	company =  frappe.defaults.get_user_default("company")

	args = {
		"user": user,
		"company": company,
	}

	pos_profile = frappe.db.sql(
		"""select pf.name
		from
			`tabPOS Profile` pf, `tabPOS Profile User` pfu
		where
			pfu.parent = pf.name and pfu.user = %(user)s and pf.company = %(company)s
			and pf.disabled = 0 """,
		args,
	)

	if not pos_profile:
		del args["user"]

		pos_profile = frappe.db.sql(
			"""select pf.name
			from
				`tabPOS Profile` pf left join `tabPOS Profile User` pfu
			on
				pf.name = pfu.parent
			where
				ifnull(pfu.user, '') = ''
				and pf.company = %(company)s
				and pf.disabled = 0""",
			args,
	
		)
	pos_profile_name = pos_profile[0][0] if pos_profile else None
	if pos_profile_name:
		media_url, is_video = frappe.db.get_value("POS Profile", pos_profile_name, ["custom_customer_display_media", "custom_is_video"])
		return {"media_url": media_url, "is_video": is_video}
	else:
		return {"media_url": None, "is_video": None}