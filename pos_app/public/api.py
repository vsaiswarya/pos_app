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


# @frappe.whitelist()
# def submit_pos_invoice(docname):
# 	"""Submit POS Invoice"""
# 	doc = frappe.get_doc("POS Invoice", docname)
# 	if doc.docstatus == 0:
# 		doc.submit()
# 	print_format,qz_siv,siv_printer = frappe.db.get_value("POS Profile", doc.pos_profile, ["print_format","custom_enable_siv_print_in_qztray","custom_siv_printer_name"])
# 	return {
# 		"doc": doc.as_dict(),
# 		"print_format": print_format,
# 		"qz_siv":qz_siv,
# 		"siv_printer": siv_printer
# 	}
@frappe.whitelist()
def submit_pos_invoice(docname, walkin_mobile=None, walkin_email=None):
    import frappe
    from pos_app.overrides.pos_invoice import (
        is_walkin_customer,
        normalize_phone,
        get_or_create_walkin_contact,
        clear_walkin_customer_master,
    )

    doc = frappe.get_doc("POS Invoice", docname)

    if doc.docstatus == 2:
        frappe.throw(f"POS Invoice {doc.name} is cancelled. Use a draft invoice.")

    customer = (doc.customer or "").strip()
    walkin_mobile = normalize_phone(walkin_mobile)
    walkin_email = (walkin_email or "").strip()

    # already submitted
    if doc.docstatus == 1:
        print_format, qz_siv, siv_printer = frappe.db.get_value(
            "POS Profile",
            doc.pos_profile,
            ["print_format", "custom_enable_siv_print_in_qztray", "custom_siv_printer_name"]
        )
        return {
            "doc": doc.as_dict(),
            "print_format": print_format,
            "qz_siv": qz_siv,
            "siv_printer": siv_printer
        }

    standalone_contact = None
    master_contact_name = ""

    if is_walkin_customer(customer):
        # If JS did not pass values, read them from the master walkin contact
        if not walkin_mobile or not walkin_email:
            master = get_walkin_master_details(customer)
            master_contact_name = master.get("contact_name") or ""

            if not walkin_mobile:
                walkin_mobile = normalize_phone(master.get("mobile"))

            if not walkin_email:
                walkin_email = (master.get("email") or "").strip()

        # Save onto invoice draft first
        doc.custom_whatsapp_number = walkin_mobile or doc.custom_whatsapp_number or ""
        doc.custom_email_address = walkin_email or doc.custom_email_address or ""
        doc.contact_mobile = walkin_mobile or ""
        doc.contact_email = walkin_email or ""
        doc.contact_person = ""
        doc.contact_display = walkin_mobile or walkin_email or ""

        doc.save(ignore_permissions=True)

        # Create/reuse separate standalone contact
        if walkin_mobile:
            standalone_contact = get_or_create_walkin_contact(
                customer=customer,
                mobile_no=walkin_mobile,
                email_id=walkin_email
            )
        if standalone_contact:
            frappe.db.set_value(
                "POS Invoice",
                doc.name,
                "contact_person",
                standalone_contact,
                update_modified=False
            )    

    if doc.docstatus == 0:
        doc.submit()

    # Force-write values back after submit so they stay visible
    if is_walkin_customer(customer):

        final_mobile = walkin_mobile or doc.custom_whatsapp_number or ""
        final_email = walkin_email or doc.custom_email_address or ""

        frappe.db.set_value("POS Invoice", doc.name, "custom_whatsapp_number", final_mobile, update_modified=False)
        frappe.db.set_value("POS Invoice", doc.name, "custom_email_address", final_email, update_modified=False)

        frappe.db.set_value("POS Invoice", doc.name, "contact_mobile", final_mobile, update_modified=False)
        frappe.db.set_value("POS Invoice", doc.name, "contact_email", final_email, update_modified=False)

        frappe.db.set_value(
            "POS Invoice",
            doc.name,
            "contact_display",
            final_mobile or final_email or "",
            update_modified=False
        )

        # DO NOT force empty — keep existing if any
        # frappe.db.set_value("POS Invoice", doc.name, "contact_person", "", update_modified=False)

        frappe.db.commit()

        # Clear the master walkin contact so dropdown stays blank next time
        clear_walkin_customer_master(customer)

        frappe.log_error(
            (
                f"docname: {doc.name}\n"
                f"master_contact_used: {master_contact_name}\n"
                f"walkin_mobile final: {walkin_mobile or ''}\n"
                f"walkin_email final: {walkin_email or ''}\n"
                f"standalone_contact_created: {standalone_contact or ''}"
            ),
            "Submit POS Walkin Final"
        )

    doc = frappe.get_doc("POS Invoice", doc.name)

    print_format, qz_siv, siv_printer = frappe.db.get_value(
        "POS Profile",
        doc.pos_profile,
        ["print_format", "custom_enable_siv_print_in_qztray", "custom_siv_printer_name"]
    )

    return {
        "doc": doc.as_dict(),
        "print_format": print_format,
        "qz_siv": qz_siv,
        "siv_printer": siv_printer
    }


def get_walkin_master_contact(customer="walkin customer"):
    rows = frappe.db.sql("""
        SELECT c.name
        FROM `tabContact` c
        INNER JOIN `tabDynamic Link` dl
            ON dl.parent = c.name
        WHERE dl.parenttype = 'Contact'
          AND dl.link_doctype = 'Customer'
          AND dl.link_name = %s
        ORDER BY c.modified DESC
        LIMIT 1
    """, (customer,), as_dict=True)

    if not rows:
        return None

    return frappe.get_doc("Contact", rows[0].name)


def get_walkin_master_details(customer="walkin customer"):
    contact = get_walkin_master_contact(customer)
    if not contact:
        return {"mobile": "", "email": "", "contact_name": ""}

    mobile = ""
    email = ""

    for p in contact.phone_nos or []:
        if p.phone:
            mobile = p.phone
            if getattr(p, "is_primary_mobile_no", 0) or getattr(p, "is_primary_phone", 0):
                break

    if not mobile:
        mobile = (contact.mobile_no or contact.phone or "").strip()

    for e in contact.email_ids or []:
        if e.email_id:
            email = e.email_id
            if getattr(e, "is_primary", 0):
                break

    if not email:
        email = (contact.email_id or "").strip()

    return {
        "mobile": mobile or "",
        "email": email or "",
        "contact_name": contact.name
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
	