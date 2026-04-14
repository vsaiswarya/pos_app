# import frappe

# def create_kitchen_orders_from_invoice(pos_invoice, method=None):
#     if getattr(pos_invoice, "doctype", None) == "POS Invoice":
#         invoice = pos_invoice
#     else:
#         invoice = frappe.get_doc("POS Invoice", pos_invoice)

#     if invoice.custom_kot_status != "New":
#         return

#     if not invoice.custom_enable_manufacturing:
#         return

#     item_groups_by_kitchen = {}
#     for row in frappe.get_all("KOT Item Groups", fields=["parent", "item_group"]):
#         item_groups_by_kitchen.setdefault(row.parent, []).append(row.item_group)

#     for kitchen, groups in item_groups_by_kitchen.items():
#         kitchen_items = [item for item in invoice.items if item.item_group in groups]
#         if not kitchen_items:
#             continue

#         if frappe.db.exists("Kitchen Order", {"pos_invoice": invoice.name, "kitchen": kitchen}):
#             continue

#         kot = frappe.new_doc("Kitchen Order")
#         kot.pos_invoice = invoice.name
#         kot.kitchen = kitchen
#         kot.custom_room = invoice.custom_room
#         kot.custom_table = invoice.custom_table
#         kot.custom_kot_number = invoice.custom_kot_number
#         kot.custom_kot_status = invoice.custom_kot_status or "New"
#         kot.custom_enable_manufacturing = invoice.custom_enable_manufacturing

#         for item in kitchen_items:
#             kot.append("items", {
#                 "item_code": item.item_code,
#                 "item_name": item.item_name,
#                 "qty": item.qty,
#                 "custom_notes": item.custom_notes,
#                 "item_group": item.item_group,
#             })

#         kot.insert(ignore_permissions=True)

# # def update_kitchen_orders_status(pos_invoice_name, status="Completed"):
# #     kitchen_orders = frappe.get_all("Kitchen Order", filters={"pos_invoice": pos_invoice_name}, fields=["name"])
# #     for ko in kitchen_orders:
# #         frappe.db.set_value("Kitchen Order", ko.name, "custom_kot_status", status)

# def update_kitchen_orders_status(pos_invoice_name, status="Completed"):
#     kitchen_orders = frappe.get_all(
#         "Kitchen Order",
#         filters={"pos_invoice": pos_invoice_name},
#         fields=["name"]
#     )
#     for ko in kitchen_orders:
#         frappe.db.set_value("Kitchen Order", ko.name, "custom_kot_status", status)