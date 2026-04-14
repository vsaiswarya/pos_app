frappe.ui.form.on('Sales Invoice', {
    refresh: function(frm) {
        frm.add_custom_button(__('Create Purchase Order'),
        () =>
            frappe.prompt({
                    label: 'Supplier',
                    fieldname: 'supplier',
                    fieldtype: 'Link',
                    options: 'Supplier',
                    reqd: 1
                }, (values) => {
                    frm.events.make_purchase_order(frm, values.supplier);
                })
        );
    },

	make_purchase_order: function(frm, supplier) {
        frappe.model.open_mapped_doc({
            method: "pos_app.public.api.make_purchase_order",
            frm: frm,
            args: {
                pos_profile: frm.doc.pos_profile,
                supplier: supplier
            },
            // run_link_triggers: true
        });
	}
})
