import re
import json
import frappe
from frappe.utils import get_url, now
from twilio.rest import Client


def get_settings():
    return frappe.get_single("Twilio WhatsApp Settings")


def send_pos_invoice_whatsapp(doc, method=None):
    try:
        
        
        frappe.log_error(
            title="POS WhatsApp Debug",
            message=f"HOOK TRIGGERED\nDoc: {doc.doctype} {doc.name}\nDocstatus: {doc.docstatus}\nCustomer: {doc.customer}\nCustom WhatsApp: {getattr(doc, 'custom_whatsapp_number', '')}"
        )

        if doc.docstatus != 1:
            frappe.log_error(
                title="POS WhatsApp Debug",
                message=f"STOPPED: docstatus is not 1 for {doc.name}. Current docstatus={doc.docstatus}"
            )
            return

        customer_number = get_pos_invoice_whatsapp_number(doc)

        frappe.log_error(
            title="POS WhatsApp Debug",
            message=f"Resolved customer number for {doc.name}: {customer_number}"
        )
        
        if not customer_number:
            frappe.log_error(
                title="POS Invoice WhatsApp",
                message=f"No WhatsApp number found in POS Invoice {doc.name}"
            )
            return

        file_doc = create_invoice_pdf_file(
            doc,
            print_format="POS Invoice",
            no_letterhead=0,
            letterhead=None,
            lang="en"
        )

        frappe.log_error(
            title="POS WhatsApp Debug",
            message=f"PDF FILE RESULT for {doc.name}: file_doc={file_doc.name if file_doc else None}, file_url={file_doc.file_url if file_doc else None}"
        )

        if not file_doc or not file_doc.file_url:
            frappe.log_error(
                title="POS Invoice WhatsApp",
                message=f"PDF file was not created for POS Invoice {doc.name}"
            )
            return

        file_url = get_full_public_url(file_doc.file_url)

        frappe.log_error(
            title="POS WhatsApp Debug",
            message=f"Public PDF URL for {doc.name}: {file_url}"
        )
        company_name = doc.company or ""
        if not company_name and doc.pos_profile:
            company_name = frappe.db.get_value("POS Profile", doc.pos_profile, "company") or ""

        msg = send_whatsapp_with_pdf(
            to_number=customer_number,
            media_url=file_url,
            reference_doctype=doc.doctype,
            reference_name=doc.name,
            customer=doc.customer,
            company_name=company_name
        )

        frappe.log_error(
            title="POS WhatsApp Debug",
            message=f"TWILIO MESSAGE CREATED for {doc.name}: SID={getattr(msg, 'sid', '')}, STATUS={getattr(msg, 'status', '')}, TO={getattr(msg, 'to', '')}"
        )
        frappe.log_error(
        title="POS WhatsApp Number Debug",
        message=(
            f"Invoice: {doc.name}\n"
            f"custom_whatsapp_number: {doc.custom_whatsapp_number}\n"
            f"contact_mobile: {doc.contact_mobile}\n"
            f"customer: {doc.customer}\n"
            f"resolved_send_number: {get_pos_invoice_whatsapp_number(doc)}"
        )
    )

    except Exception:
        frappe.log_error(
            title="POS Invoice WhatsApp Error",
            message=frappe.get_traceback()
        )


def get_pos_invoice_whatsapp_number(doc):
    if getattr(doc, "custom_whatsapp_number", None):
        return normalize_number(doc.custom_whatsapp_number)

    if getattr(doc, "contact_mobile", None):
        return normalize_number(doc.contact_mobile)

    if getattr(doc, "mobile_no", None):
        return normalize_number(doc.mobile_no)

    if getattr(doc, "phone", None):
        return normalize_number(doc.phone)

    if doc.customer:
        return get_customer_whatsapp_number(doc.customer)

    return None


def get_customer_whatsapp_number(customer):
    contacts = frappe.db.sql("""
        SELECT
            c.name,
            c.mobile_no,
            c.phone
        FROM `tabContact` c
        INNER JOIN `tabDynamic Link` dl
            ON dl.parent = c.name
        WHERE dl.link_doctype = 'Customer'
          AND dl.link_name = %s
        ORDER BY c.is_primary_contact DESC, c.modified DESC
    """, (customer,), as_dict=True)

    for c in contacts:
        if c.mobile_no:
            return normalize_number(c.mobile_no)
        if c.phone:
            return normalize_number(c.phone)

        phone_rows = frappe.get_all(
            "Contact Phone",
            filters={"parent": c.name},
            fields=["phone", "is_primary_mobile_no", "is_primary_phone"],
            order_by="is_primary_mobile_no desc, is_primary_phone desc"
        )
        for p in phone_rows:
            if p.phone:
                return normalize_number(p.phone)

    return None


def create_invoice_pdf_file(doc, print_format=None, no_letterhead=0, letterhead=None, lang="en"):
    print_format = print_format or "Standard"

    pdf = frappe.get_print(
        doc.doctype,
        doc.name,
        print_format=print_format,
        as_pdf=True,
        no_letterhead=no_letterhead,
        letterhead=letterhead
    )

    file_name = f"{doc.name}.pdf"

    old_files = frappe.get_all(
        "File",
        filters={
            "attached_to_doctype": doc.doctype,
            "attached_to_name": doc.name,
            "file_name": file_name
        },
        fields=["name"]
    )
    for f in old_files:
        frappe.delete_doc("File", f.name, ignore_permissions=True, force=1)

    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_name": file_name,
        "attached_to_doctype": doc.doctype,
        "attached_to_name": doc.name,
        "is_private": 0,
        "content": pdf
    })
    file_doc.save(ignore_permissions=True)

    return file_doc


def get_full_public_url(file_url):
    base_url = get_url().rstrip("/")
    public_base_url = frappe.conf.get("public_base_url")

    if public_base_url:
        base_url = public_base_url.rstrip("/")

    return f"{base_url}{file_url}"


def send_whatsapp_with_pdf(
    to_number,
    message=None,
    media_url=None,
    reference_doctype=None,
    reference_name=None,
    customer=None,
    company_name=None
):
    settings = get_settings()

    if not settings.enabled:
        frappe.throw("Twilio WhatsApp Settings is disabled")

    account_sid = (settings.account_sid or "").strip()
    auth_token = settings.get_password("auth_token")
    messaging_service_sid = "MG7c93133f83bbb334b0a6a9a195d37e14"
    content_sid = "HX7c0930076d65f79de1b446f8f2f48559"

    from_number = normalize_number(settings.from_whatsapp_number)
    if from_number and not from_number.startswith("whatsapp:"):
        from_number = f"whatsapp:{from_number}"

    client = Client(account_sid, auth_token)

    to_number = normalize_number(to_number)
    if not to_number.startswith("whatsapp:"):
        to_number = f"whatsapp:{to_number}"

    invoice_name = reference_name or ""
    public_pdf_url = media_url or ""

    frappe.log_error(
        title="POS WhatsApp Debug",
        message=(
            f"SENDING TWILIO MESSAGE\n"
            f"FROM={from_number}\n"
            f"TO={to_number}\n"
            f"MSG_SERVICE={messaging_service_sid}\n"
            f"CONTENT_SID={content_sid}\n"
            f"PDF_URL={public_pdf_url}\n"
            f"INVOICE={invoice_name}"
        )
    )

    msg = client.messages.create(
        from_=from_number,
        messaging_service_sid=messaging_service_sid,
        to=to_number,
        content_sid=content_sid,
        content_variables=json.dumps({
            "1": invoice_name,
            "2": public_pdf_url,
            "3": company_name or ""
        })
    )

    # always create/update conversation for this number
    conversation = get_or_create_whatsapp_conversation(
        customer=customer,
        customer_number=to_number,
        twilio_number=from_number
    )

    try:
        display_body = (
            message
            or f"Dear Customer, your POS Invoice {invoice_name} is attached for your reference. "
               f"Please let us know if you need any assistance. Thank you."
               f"Regards,"
               f"{company_name or ''} Team."
        )

        frappe.get_doc({
            "doctype": "Twilio WhatsApp Message",
            "conversation": conversation,
            "direction": "Outbound",
            "to_number": to_number,
            "from_number": msg.from_ or from_number or "",
            "body": display_body,
            "media_url": public_pdf_url,
            "message_sid": msg.sid,
            "status": msg.status,
            "timestamp": now(),
            "reference_doctype": reference_doctype,
            "reference_name": reference_name,
            "raw_payload": frappe.as_json({
                "sid": msg.sid,
                "status": msg.status,
                "from": msg.from_,
                "to": msg.to,
                "content_sid": content_sid,
                "content_variables": {
                    "1": invoice_name,
                    "2": public_pdf_url,
                    "3": company_name or ""
                }
            })
        }).insert(ignore_permissions=True)

        frappe.db.set_value(
            "WhatsApp Conversation",
            conversation,
            "last_message_at",
            now()
        )

    except Exception:
        frappe.log_error(frappe.get_traceback(), "Twilio WhatsApp Message Log Error")

    return msg

def normalize_number(number):
    if not number:
        return ""

    number = str(number).strip()
    number = re.sub(r"[^\d+]", "", number)

    if number.startswith("00"):
        number = "+" + number[2:]

    if not number.startswith("+"):
        number = "+" + number

    return number

import requests

def validate_public_pdf_url(file_url):
    try:
        response = requests.head(file_url, allow_redirects=True, timeout=15)

        frappe.log_error(
            title="POS WhatsApp Media Check",
            message=frappe.as_json({
                "url": file_url,
                "status_code": response.status_code,
                "content_type": response.headers.get("Content-Type"),
                "final_url": response.url,
                "content_length": response.headers.get("Content-Length")
            }, indent=2)
        )

        if response.status_code != 200:
            return False

        content_type = (response.headers.get("Content-Type") or "").lower()
        if "application/pdf" not in content_type:
            return False

        return True
    except Exception:
        frappe.log_error(frappe.get_traceback(), "POS WhatsApp Media Check Error")
        return False
    

@frappe.whitelist()
def get_messages_by_phone(customer_phone=None, conversation=None, limit=50, start=0):
    limit = int(limit or 50)
    start = int(start or 0)

    filters = {}
    if conversation:
        filters["conversation"] = conversation

    data = frappe.get_all(
        "Twilio WhatsApp Message",
        filters=filters,
        fields=[
            "name",
            "direction",
            "body",
            "media_url",
            "timestamp",
            "creation",
            "status",
            "from_number",
            "to_number",
            "reference_name"
        ],
        order_by="timestamp desc, creation desc",
        limit_start=start,
        limit_page_length=limit
    )

    total = frappe.db.count("Twilio WhatsApp Message", filters=filters)

    return {
        "data": data,
        "total": total
    }


def get_or_create_whatsapp_conversation(customer, customer_number, twilio_number):
    customer_number = normalize_number(customer_number)
    twilio_number = normalize_number(twilio_number) if twilio_number else ""

    existing = frappe.db.get_value(
        "WhatsApp Conversation",
        {"customer_phone": customer_number},
        "name"
    )

    if existing:
        updates = {}
        if twilio_number:
            updates["twilio_phone"] = twilio_number
        if customer:
            updates["customer"] = customer
        if updates:
            frappe.db.set_value("WhatsApp Conversation", existing, updates)
        return existing

    rows = frappe.get_all(
        "WhatsApp Conversation",
        fields=["name", "customer_phone"],
        limit=500
    )

    for row in rows:
        try:
            if normalize_number(row.customer_phone) == customer_number:
                updates = {}
                if twilio_number:
                    updates["twilio_phone"] = twilio_number
                if customer:
                    updates["customer"] = customer
                if updates:
                    frappe.db.set_value("WhatsApp Conversation", row.name, updates)
                return row.name
        except Exception:
            pass

    conv = frappe.get_doc({
        "doctype": "WhatsApp Conversation",
        "customer": customer or None,
        "customer_phone": customer_number,
        "twilio_phone": twilio_number,
        "last_message_at": now()
    })
    conv.insert(ignore_permissions=True)
    return conv.name