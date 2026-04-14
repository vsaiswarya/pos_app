import frappe

@frappe.whitelist()
def get_orders(kitchen):
    item_groups = [i.item_group for i in frappe.get_all("KOT Item Groups",
                                 filters={"parent": kitchen},
                                 fields=["item_group"])]
    orders = frappe.get_all(
        "POS Invoice",
        fields=["name", "custom_room", "custom_table", "custom_kot_number"],
        filters={"custom_kot_status": ["=", "New"], "status": ["=", "Paid"], "docstatus": 1, "custom_enable_manufacturing": 1},
        order_by="creation desc"
    )
    filtered_orders = []
    for o in orders:
        items = frappe.get_all(
            "POS Invoice Item",
            fields=["item_code", "item_name", "qty", "custom_notes", "item_group"],
            filters={"parent": o["name"]}
        )
        # Only keep items where item_group is in item_groups
        filtered_items = [item for item in items if item.get("item_group") in item_groups]
        if filtered_items:
            o["items"] = filtered_items
            filtered_orders.append(o)
    return filtered_orders

@frappe.whitelist()
def update_order_status(name):
    doc = frappe.get_doc("POS Invoice", name)
    doc.custom_kot_status = "Completed"
    doc.save(ignore_permissions=True)
    return True
