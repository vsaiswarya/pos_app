import frappe
import base64

from frappe.utils import cint, flt
from erpnext.accounts.doctype.pos_invoice.pos_invoice import get_bin_qty, get_bundle_availability, get_pos_reserved_qty
from erpnext.selling.page.point_of_sale.point_of_sale import get_conditions, get_item_group_condition, search_by_term
from frappe.utils.nestedset import get_root_of
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from erpnext.accounts.doctype.pos_invoice.pos_invoice import get_stock_availability as get_item_stock_availability

@frappe.whitelist()
def get_stock_availability(item_code, warehouse):
	if frappe.db.get_value("Item", item_code, "is_stock_item"):
		is_stock_item = True
		if frappe.db.get_value("Item", item_code, "allow_negative_stock"):
			is_stock_item = False
		bin_qty = get_bin_qty(item_code, warehouse)
		pos_sales_qty = get_pos_reserved_qty(item_code, warehouse)
		return bin_qty - pos_sales_qty, is_stock_item
	else:
		is_stock_item = True
		if frappe.db.exists("Product Bundle", {"name": item_code, "disabled": 0}):
			return get_bundle_availability(item_code, warehouse), is_stock_item
		else:
			is_stock_item = False
			# Is a service item or non_stock item
			return 0, is_stock_item



@frappe.whitelist()
def get_past_order_list(search_term, status, pos_profile, table=None, limit=20):
	fields = ["name", "grand_total", "currency", "customer", "posting_time", "posting_date"]
	invoice_list = []

	if search_term and status:
		invoices_by_customer = frappe.db.get_all(
			"POS Invoice",
			filters={"customer": ["like", f"%{search_term}%"], "status": status, "custom_table": table, "pos_profile": pos_profile},
			fields=fields,
		)
		invoices_by_name = frappe.db.get_all(
			"POS Invoice",
			filters={"name": ["like", f"%{search_term}%"], "status": status, "custom_table": table, "pos_profile": pos_profile},
			fields=fields,
		)

		invoice_list = invoices_by_customer + invoices_by_name
	elif status:
		invoice_list = frappe.db.get_all("POS Invoice", filters={"status": status, "custom_table": table, "pos_profile": pos_profile}, fields=fields)

	return invoice_list


@frappe.whitelist()
def get_items(start, page_length, price_list, item_group, pos_profile, search_term=""):
	warehouse, hide_unavailable_items = frappe.db.get_value(
		"POS Profile", pos_profile, ["warehouse", "hide_unavailable_items"]
	)

	result = []
	page_length = 1000
	if search_term:
		result = search_by_term(search_term, warehouse, price_list) or []
		if result:
			return result

	if not frappe.db.exists("Item Group", item_group):
		item_group = get_root_of("Item Group")

	condition = get_conditions(search_term)
	condition += get_item_group_condition(pos_profile)

	lft, rgt = frappe.db.get_value("Item Group", item_group, ["lft", "rgt"])

	bin_join_selection, bin_join_condition = "", ""
	if hide_unavailable_items:
		bin_join_selection = ", `tabBin` bin"
		bin_join_condition = (
			"AND bin.warehouse = %(warehouse)s AND bin.item_code = item.name AND bin.actual_qty > 0"
		)

	items_data = frappe.db.sql(
		"""
		SELECT
			item.name AS item_code,
			item.item_name,
			item.description,
			item.stock_uom,
			item.image AS item_image,
			item.is_stock_item,
			item.item_group
		FROM
			`tabItem` item {bin_join_selection}
		WHERE
			item.disabled = 0
			AND item.has_variants = 0
			AND item.is_sales_item = 1
			AND item.is_fixed_asset = 0
			AND item.item_group in (SELECT name FROM `tabItem Group` WHERE lft >= {lft} AND rgt <= {rgt})
			AND {condition}
			{bin_join_condition}
		ORDER BY
			item.name asc
		LIMIT
			{page_length} offset {start}""".format(
			start=cint(start),
			page_length=cint(page_length),
			lft=cint(lft),
			rgt=cint(rgt),
			condition=condition,
			bin_join_selection=bin_join_selection,
			bin_join_condition=bin_join_condition,
		),
		{"warehouse": warehouse},
		as_dict=1,
	)

	if items_data:
		items = [d.item_code for d in items_data]
		item_prices_data = frappe.get_all(
			"Item Price",
			fields=["item_code", "price_list_rate", "currency"],
			filters={"price_list": price_list, "item_code": ["in", items]},
		)

		item_prices = {}
		for d in item_prices_data:
			item_prices[d.item_code] = d

		for item in items_data:
			item_code = item.item_code
			item_price = item_prices.get(item_code) or {}
			item_stock_qty, is_stock_item = get_stock_availability(item_code, warehouse)

			row = {}
			row.update(item)
			row.update(
				{
					"price_list_rate": item_price.get("price_list_rate"),
					"currency": item_price.get("currency"),
					"actual_qty": item_stock_qty,
				}
			)
			result.append(row)
	item_groups = frappe.get_all(
		"POS Restaurant Item Groups",
		fields=["item_group"],
		filters={"parent": pos_profile}
	)
	item_groups = [d.item_group for d in item_groups]
	result = [item for item in result if item.get("actual_qty") != 0 or item.get("item_group") in item_groups]
	# result = [item for item in result if item.get("item_group") in item_groups]
	return {"items": result}


def update_reserved_qty(doc, method):
	item_groups = frappe.get_all(
	"POS Restaurant Item Groups",
	fields=["item_group"],
	filters={"parent": doc.pos_profile}
	)
	item_groups = [d.item_group for d in item_groups]
	for item in doc.items:
		if item.item_group not in item_groups:
			if item.item_code and item.stock_qty:
				bin = frappe.get_doc("Bin", {"item_code": item.item_code, "warehouse": item.warehouse})
				bin.reserved_qty = flt(bin.reserved_qty) + flt(item.stock_qty)
				bin.save(ignore_permissions=True)

def update_reserved_qty_cancel(doc, method):
	item_groups = frappe.get_all(
	"POS Restaurant Item Groups",
	fields=["item_group"],
	filters={"parent": doc.pos_profile}
	)
	item_groups = [d.item_group for d in item_groups]
	for item in doc.items:
		if item.item_group not in item_groups:
			if item.item_code and item.stock_qty:
				bin = frappe.get_doc("Bin", {"item_code": item.item_code, "warehouse": item.warehouse})
				bin.reserved_qty = flt(bin.reserved_qty) - flt(item.stock_qty)
				bin.save(ignore_permissions=True)

def reverse_reserved_qty(doc, method):
	if not doc.is_consolidated:
		return
	item_groups = frappe.get_all(
		"POS Restaurant Item Groups",
		fields=["item_group"],
		filters={"parent": doc.pos_profile}
	)
	item_groups = [d.item_group for d in item_groups]
	for item in doc.items:
		if item.item_group not in item_groups:
			if item.item_code and item.stock_qty:
				if frappe.db.exists("Bin", {"item_code": item.item_code, "warehouse": item.warehouse}):
					bin = frappe.get_doc("Bin", {"item_code": item.item_code, "warehouse": item.warehouse})
					bin.reserved_qty = flt(bin.reserved_qty) - flt(item.stock_qty)
					bin.save(ignore_permissions=True)


@frappe.whitelist()
def get_kot_data(pos_profile):
	kot_prints = frappe.get_all(
		"KOT Print",
		filters={"pos_profile": pos_profile},
		fields=["name"]
	)
	if not kot_prints:
		return {}
	result = []
	for kot in kot_prints:
		kot_doc = frappe.get_doc("KOT Print", kot.name)
		item_groups = []
		# Adjust 'item_groups' to your actual child table name if different
		for row in kot_doc.kot_item_groups:
			item_groups.append(row.item_group)
		result.append({
			"printer_name": kot_doc.printer_name,
			"item_groups": item_groups
		})
	return result


@frappe.whitelist(allow_guest=True)
def sign_data(data):
	private_key_path = frappe.get_site_path("private", "files", "private-key.pem")
	with open(private_key_path, "rb") as key_file:
		private_key = serialization.load_pem_private_key(
			key_file.read(),
			password=None,
			backend=default_backend()
		)
	signature = private_key.sign(
		data.encode('utf-8'),
		padding.PKCS1v15(),
		hashes.SHA512()
	)
	return base64.b64encode(signature).decode('utf-8')

def set_kot_number(doc, method):
	if frappe.db.get_value("POS Profile", doc.pos_profile, "custom_enable_manufacturing"):
		validate_bom_items(doc)
	if not doc.custom_kot_number and doc.custom_room and doc.custom_table:
		doc.custom_kot_number = doc.custom_room + "-" + doc.custom_table + "-" + doc.name[-5:]

def validate_bom_items(doc):
	for row in doc.items:
		bom_item = frappe.db.get_value("Item", {"item_code": row.item_code}, "default_bom")
		if bom_item:
			stock_qty = get_item_stock_availability(row.item_code, row.warehouse)[0]

			if stock_qty < row.qty and not row.custom_stock_entry:
				se = create_stock_entry(row.item_code, row.qty - stock_qty, row.warehouse, bom_item)
				row.custom_stock_entry = se
			elif row.custom_stock_entry and frappe.get_value("Stock Entry", row.custom_stock_entry, "fg_completed_qty") != row.qty - stock_qty:
				print(stock_qty, row.qty, row.qty-stock_qty)
				se = create_stock_entry(row.item_code, row.qty - stock_qty, row.warehouse, bom_item, row.custom_stock_entry)

def create_stock_entry(item_code, qty, warehouse, bom_item, stock_entry=None):
	se = None
	if stock_entry:
		se = frappe.get_doc("Stock Entry", stock_entry)
		se.items = []
	else:
		se = frappe.new_doc("Stock Entry")
		se.stock_entry_type = "Manufacture"
		se.from_bom = True
	se.from_warehouse = warehouse
	se.bom_no = bom_item
	se.fg_completed_qty = qty
	se.process_loss_qty = 0
	se.get_items()
	if not stock_entry:
		se.append("items", {
			"item_code": item_code,
			"qty": qty,
			"is_finished_item": 1,
			"t_warehouse": warehouse
		})
	se.save()
	return se.name

def submit_stock_entry(doc, method):
	for row in doc.items:
		if row.custom_stock_entry:
			se = frappe.get_doc("Stock Entry", row.custom_stock_entry)
			se.submit()





def set_contact_details_in_pos_invoice(doc, method=None):
    if not doc.customer:
        return

    whatsapp_number = ""
    email_address = ""

   
    if doc.get("contact_mobile"):
        whatsapp_number = (doc.get("contact_mobile") or "").strip()
    elif doc.get("mobile_no"):
        whatsapp_number = (doc.get("mobile_no") or "").strip()
    elif doc.get("phone"):
        whatsapp_number = (doc.get("phone") or "").strip()

    if doc.get("contact_email"):
        email_address = (doc.get("contact_email") or "").strip()
    elif doc.get("email_id"):
        email_address = (doc.get("email_id") or "").strip()
    elif doc.get("email"):
        email_address = (doc.get("email") or "").strip()

   
    rows = frappe.db.sql("""
        SELECT c.name
        FROM `tabContact` c
        INNER JOIN `tabDynamic Link` dl
            ON dl.parent = c.name
        WHERE dl.link_doctype = 'Customer'
          AND dl.link_name = %s
        ORDER BY IFNULL(c.is_primary_contact, 0) DESC, c.modified DESC
        LIMIT 1
    """, (doc.customer,), as_dict=True)

    if rows:
        contact = frappe.get_doc("Contact", rows[0].name)

        latest_mobile = ""
        latest_email = ""

        for row in contact.phone_nos or []:
            if row.is_primary_mobile_no:
                latest_mobile = row.phone or ""
                break
        if not latest_mobile and contact.phone_nos:
            latest_mobile = contact.phone_nos[0].phone or ""

        for row in contact.email_ids or []:
            if row.is_primary:
                latest_email = row.email_id or ""
                break
        if not latest_email and contact.email_ids:
            latest_email = contact.email_ids[0].email_id or ""

       
        if latest_mobile:
            whatsapp_number = latest_mobile
        if latest_email:
            email_address = latest_email

    doc.custom_whatsapp_number = whatsapp_number
    doc.custom_email_address = email_address

    frappe.log_error(
        title="POS Invoice Contact Debug",
        message=(
            f"Invoice: {doc.name}\n"
            f"customer: {doc.customer}\n"
            f"final_custom_whatsapp_number: {doc.custom_whatsapp_number}\n"
            f"final_custom_email_address: {doc.custom_email_address}"
        )
    )