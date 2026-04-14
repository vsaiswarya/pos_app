import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def delete_if_exists(doctype, fieldname):
    name = frappe.db.get_value("Custom Field", {"dt": doctype, "fieldname": fieldname})
    if name:
        frappe.delete_doc("Custom Field", name, force=True)

def create_pos_invoice_contact_fields():
    # cleanup old helper fields if already created
    for fieldname in [
        "custom_invoice_contact_section",
        "custom_invoice_contact_col_break",
        "custom_contact_details_section",
        "custom_contact_col_break",
        "custom_pos_contact_section",
        "custom_pos_contact_col_break",
    ]:
        delete_if_exists("POS Invoice", fieldname)

    custom_fields = {
        "POS Invoice": [
            {
                "fieldname": "custom_pos_contact_section",
                "label": "Contact Details",
                "fieldtype": "Section Break",
                "insert_after": "due_date",
            },
            {
                "fieldname": "custom_whatsapp_number",
                "label": "WhatsApp Number",
                "fieldtype": "Data",
                "insert_after": "custom_pos_contact_section",
            },
            {
                "fieldname": "custom_pos_contact_col_break",
                "fieldtype": "Column Break",
                "insert_after": "custom_whatsapp_number",
            },
            {
                "fieldname": "custom_email_address",
                "label": "Email Address",
                "fieldtype": "Data",
                "options": "Email",
                "insert_after": "custom_pos_contact_col_break",
            }
        ]
    }

    create_custom_fields(custom_fields, update=True)
    frappe.clear_cache(doctype="POS Invoice")