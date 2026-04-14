import frappe
from frappe.model.document import Document
from frappe.utils import get_url


class TwilioWhatsAppSettings(Document):
    def validate(self):
        self.incoming_webhook_url = get_url(
            "/api/method/pos_app.api.incoming_webhook"
        )
        self.status_callback_url = get_url(
            "/api/method/pos_app.api.status_callback"
        )