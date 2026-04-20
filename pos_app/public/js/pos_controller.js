function is_walkin_customer_name(customer) {
	return ["walkin customer", "walk in customer", "walk-in customer"].includes(
		(customer || "").trim().toLowerCase()
	);
}

function get_walkin_contact_from_customer_card() {
	const selectors = [
		".customer-section",
		".customer-name-section",
		".customer-details",
		".customer-name",
		".customer-info",
		".pos-bill-item",
		".pos-bill"
	];

	let text = "";

	selectors.forEach((sel) => {
		document.querySelectorAll(sel).forEach((el) => {
			const t = (el.innerText || "").trim();
			if (t) text += " " + t;
		});
	});

	// fallback: read whole page text if still empty
	if (!text.trim()) {
		text = document.body ? (document.body.innerText || "") : "";
	}

	const email_match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
	const phone_match = text.match(/\+?\d[\d\s-]{7,}\d/);

	return {
		email: email_match ? email_match[0].trim() : "",
		mobile: phone_match ? phone_match[0].replace(/\s+/g, "") : "",
		raw_text: text
	};
}

function ensure_walkin_cache() {
	if (!window.cur_pos_walkin_cache) {
		window.cur_pos_walkin_cache = { mobile: "", email: "" };
	}
	return window.cur_pos_walkin_cache;
}
function get_walkin_contact_from_sidebar() {
	let email = "";
	let mobile = "";

	$("input").each(function () {
		const placeholder = (this.placeholder || "").toLowerCase();
		const val = ($(this).val() || "").trim();

		if (!val) return;

		if (placeholder.includes("customer's email") || placeholder.includes("email")) {
			email = val;
		}

		if (placeholder.includes("customer's phone") || placeholder.includes("phone number") || placeholder.includes("phone")) {
			mobile = val.replace(/\s+/g, "");
		}
	});

	return { email, mobile };
}

function get_input_by_label_text(labelText) {
	let found = "";

	$("label, .control-label, .frappe-control label, .form-column label").each(function () {
		const txt = ($(this).text() || "").trim().toLowerCase();
		if (txt !== labelText.toLowerCase()) return;

		// try same control wrapper first
		let input = $(this).closest(".frappe-control, .form-group, .control-input-wrapper, .field-area").find("input").first();

		// fallback: nearest sibling input
		if (!input.length) {
			input = $(this).parent().find("input").first();
		}

		// fallback: next input in same panel
		if (!input.length) {
			input = $(this).nextAll("input").first();
		}

		if (input.length) {
			found = (input.val() || "").trim();
		}
	});

	return found;
}

function get_walkin_contact_from_contact_panel() {
	const email = get_input_by_label_text("Email");
	const mobile = get_input_by_label_text("Phone Number").replace(/\s+/g, "");
	return { email, mobile };
}

frappe.provide("erpnext.PointOfSale");

frappe.require('point-of-sale.bundle.js', () => {
	erpnext.PointOfSale.Controller = class CustomPOSController extends (erpnext.PointOfSale.Controller) {

		prepare_dom() {

			$('.navbar').css('display', 'none');
			this.wrapper.closest('.page-container').find('.page-head').css('display', 'none');
			super.prepare_dom();
			const groupButtons = `
							<button class="btn btn-outline-primary" id="select-liqr-group" style="margin-right:8px;">Liquor Groups</button>
							<button class="btn btn-outline-primary" id="select-ktchn-group">Kitchen Groups</button>
						`;
			const $bar = $(`
							<div style="
								display: flex; 
								justify-content: flex-end; 
								margin:8px;
								">
								<div style="
									font-weight: 700;
									padding: 4px 16px;
									border-radius: 16px;
									background: #64e6a4;
									color: #1b4d2b;
									font-size: 15px;
									box-shadow: 0 1px 4px rgba(0,0,0,0.04);
									display: inline-block;
								">
									${cur_pos.pos_profile}
								</div>
							</div>
							<div style="display: flex; gap: 16px; margin-bottom: 8px; margin-top: 8px;">
								<div class="custom-pos-bar" style="
									flex: 1 1 0;
									display: flex;
									align-items: center;
									background: #ffffff;
									padding: 10px 16px;
									border-radius: 12px;
									box-shadow: 0px 4px 8px rgba(25, 39, 52, 0.06), 0px 0px 4px rgba(25, 39, 52, 0.12);
									overflow-x: auto;
									white-space: nowrap;
									border: 1px solid #ddd;
								">
									${groupButtons}
								</div>
								<div class="custom-pos-bar" style="
									flex: 0 0 550px;
									display: flex;
									align-items: center;
									justify-content: flex-end;
									background: #fff;
									padding: 10px 16px;
									border-radius: 12px;
									box-shadow: 0px 4px 8px rgba(25, 39, 52, 0.06), 0px 0px 4px rgba(25, 39, 52, 0.12);
									gap: 10px;
									border: 1px solid #ddd;
								">
									<div style="padding: 6px;
										background-color: color(srgb 0.3941 0.9014 0.6426);
										border-radius: 5px;" id="table">${cur_pos.settings.custom_default_table}
									</div>
									<button class="btn btn-primary" id="select-table">Table</button>
									<button class="btn btn-primary" id="goto-draft">Orders</button>
									<button class="btn btn-primary" id="goto-close">Closing</button>
									<button class="btn btn-primary" id="new-order">New</button>
								</div>
							</div>
							<div style="display: flex; gap: 16px; margin-bottom: 8px; 
									margin-top: 8px; background: #f9fafa; padding: 5px;
									border-radius: 8px; box-shadow: 0px 4px 8px rgba(25, 39, 52, 0.06), 0px 0px 4px rgba(25, 39, 52, 0.12);">
								<div id="item-group-btn" style="width:100%; overflow-x:auto; white-space:nowrap;"></div>
							</div>
			
						`);
			this.wrapper.prepend($bar);
			cur_pos.$bar = $bar;
			frappe.call({
				method: "pos_app.public.api.get_all_item_groups",
				args: {
					pos_profile: cur_pos.pos_profile
				},
				callback: (r) => {
					if (!r.exc && r.message) {
						this.liqr_groups = r.message.liqr_groups;
						this.ktchn_groups = r.message.ktchn_groups;
						// $('.page-head .container').append($bar);
					}
				}
			});
			$bar.find('.item-group').hover(
				function () { $(this).css('background', '#d1e3f8'); },
				function () { $(this).css('background', 'rgb(249 250 250)'); }
			);
			$bar.find('#select-liqr-group').on('click', () => {
				// Remove any previous group buttons
				$bar.find('#item-group-btn').empty();
				const group_buttons_html = this.liqr_groups.map(group =>
					`<button class="btn btn-sm btn-primary group-btn" style="margin: 4px;" data-group="${group}">${group}</button>`
				).join("");
				$bar.find('#item-group-btn').html(group_buttons_html);
				$bar.find('#item-group-btn .group-btn').on('click', function () {
					const selected_group = $(this).data('group');
					if (cur_pos.item_selector && cur_pos.item_selector.item_group_field) {
						cur_pos.item_selector.item_group_field.set_value(selected_group);
					}
				});
			});

			$bar.find('#select-ktchn-group').on('click', () => {
				// Remove any previous group buttons
				$bar.find('#item-group-btn').empty();
				const group_buttons_html = this.ktchn_groups.map(group =>
					`<button class="btn btn-sm btn-primary group-btn" style="margin: 4px;" data-group="${group}">${group}</button>`
				).join("");
				$bar.find('#item-group-btn').html(group_buttons_html);
				$bar.find('#item-group-btn .group-btn').on('click', function () {
					const selected_group = $(this).data('group');
					if (cur_pos.item_selector && cur_pos.item_selector.item_group_field) {
						cur_pos.item_selector.item_group_field.set_value(selected_group);
					}
				});
			});

			$bar.find('#select-table').on('click', () => {
				const rooms = cur_frm.doc.custom_room || cur_pos.settings.custom_pos_room
				if (rooms.length === 0) {
					frappe.show_alert({ message: "No Rooms Available!", indicator: "red" });
					return;
				}
				const current_room = rooms

				


				function render_table_buttons(selected_room, dialog) {
					frappe.call({
						method: "pos_app.public.api.get_available_tables",
						args: {
							room: selected_room
						},
						callback: (tableRes) => {
							const tables = tableRes.message || [];
							let table_buttons_html = "";
							if (tables.length === 0) {
								table_buttons_html = `<div style="color:red;margin:8px 0;">No Tables Available for this Room!</div>`;
							} else if (tables.length > 5) {
								// Show first 5 tables, hide the rest initially
								const firstTables = tables.slice(0, 30);
								const restTables = tables.slice(30);
								table_buttons_html = firstTables.map(table =>
									`<button class="btn btn-sm btn-primary table-btn" style="margin: 4px;" data-table="${table.name}">${table.table_name}</button>`
								).join("");
								table_buttons_html += `<button class="btn btn-sm btn-secondary more-tables-btn" style="margin: 4px;">More...</button>`;
								table_buttons_html += `<div class="more-tables-container" style="display:none; margin-top:8px;">` +
									restTables.map(table =>
										`<button class="btn btn-sm btn-primary table-btn" style="margin: 4px;" data-table="${table.name}">${table.table_name}</button>`
									).join("") + `</div>`;
							} else {
								table_buttons_html = tables.map(table =>
									`<button class="btn btn-sm btn-primary table-btn" style="margin: 4px;" data-table="${table.name}">${table.table_name}</button>`
								).join("");
							}
							dialog.set_value("table_buttons", `<div style="display:flex; flex-wrap:wrap;">${table_buttons_html}</div>`);
							$(dialog.$wrapper).find('.table-btn').off('click').on('click', function () {
								const selected_table = $(this).data('table');
								const selected_table_name = $(this).text();
								frappe.show_alert({ message: `Selected Table: ${selected_table_name}`, indicator: "blue" });
								frappe.model.set_value(
									cur_frm.doc.doctype,
									cur_frm.doc.name,
									"custom_room",
									selected_room
								);
								frappe.model.set_value(
									cur_frm.doc.doctype,
									cur_frm.doc.name,
									"custom_table",
									selected_table
								);
								$bar.find('#table').text(selected_table_name);
								dialog.hide();
							});
							$(dialog.$wrapper).find('.more-tables-btn').off('click').on('click', function () {
								$(dialog.$wrapper).find('.more-tables-container').slideToggle();
								$(this).hide();
							});
						}
					});
				}
				const room_options =
					`<option value="${current_room}" >${current_room}</option>`
				const dialog = new frappe.ui.Dialog({
					title: 'Select Room & Table',
					fields: [
						{
							fieldtype: 'HTML',
							fieldname: 'room_select',
							options: `<label style="font-weight:600;">Room</label>
													<select id="room-select" class="form-control" style="margin-bottom:12px;">${room_options}</select>`
						},
						{
							fieldtype: 'HTML',
							fieldname: 'table_buttons',
							options: `<div style="display:flex; flex-wrap:wrap;"></div>`
						}
					]
				});
				dialog.show();

				// Initial render of tables for the default/current room
				render_table_buttons(current_room, dialog);

				// Handle room change
				$(dialog.$wrapper).find('#room-select').on('change', function () {
					const selected_room = $(this).val();
					render_table_buttons(selected_room, dialog);
				});
			});
			$bar.find('#goto-draft').on('click', () => {
				this.toggle_recent_order.bind(this)();
			});
			$bar.find('#goto-close').on('click', () => {
				const denominations = [1000, 500, 200, 100, 50, 20, 10, 5, 1, 0.5, 0.25];
				const mid = Math.ceil(denominations.length / 2);
				const fields = [
					{ fieldtype: 'Data', fieldname: 'pos_profile', label: 'POS Profile', default: this.frm.doc.pos_profile, read_only: 1 },
					{ fieldtype: 'Data', fieldname: 'company', label: 'Company', default: this.frm.doc.company, read_only: 1 },
					{ fieldtype: 'Data', fieldname: 'user', label: 'User', default: frappe.session.user, read_only: 1 },
					{ fieldtype: 'Column Break' },
					{ fieldtype: 'Data', fieldname: 'pos_opening_entry', label: 'POS Opening Entry', default: this.pos_opening, read_only: 1 },
					{ fieldtype: 'Time', fieldname: 'posting_time', label: 'Posting Time', default: frappe.datetime.now_datetime() },
					{ fieldtype: 'Date', fieldname: 'posting_date', label: 'Posting Date', default: frappe.datetime.now_date()},
					{ fieldtype: 'Section Break', label: 'Enter Denominations' },
					{ fieldtype: 'Column Break' },
					...denominations.slice(0, mid).map(denom => ({
						fieldtype: 'Int', label: `${denom} x`, fieldname: `denom_${denom}`, default: 0
					})),
					{ fieldtype: 'Column Break' },
					...denominations.slice(mid).map(denom => ({
						fieldtype: 'Int', label: `${denom} x`, fieldname: `denom_${denom}`, default: 0
					})),
					{ fieldtype: 'Section Break' },
					{ fieldtype: 'Float', fieldname: 'denom_total', label: 'Total Denominations', read_only: 1, default: 0.00}
				];

				// Dynamically add payment fields for each payment in the array
				const payments = Array.isArray(this.frm.doc.payments) ? this.frm.doc.payments : [];
				payments.forEach((payment, idx) => {
					fields.push(
						{ fieldtype: 'Float', fieldname: payment.mode_of_payment, label: payment.mode_of_payment},
					);
				});
				const dialog = new frappe.ui.Dialog({
					title: 'POS Closing',
					fields,
					primary_action_label: 'Submit',
					primary_action(values) {
						debugger;
						frappe.call({
							method: 'pos_app.public.api.submit_pos_closing',
							args: {
								denominations: values
							},
							freeze: true,
							freeze_message: 'Submitting POS Closing...',
							callback: (r) => {
								frappe.show_alert({message: 'Submitted! Total: ' + values.denom_total, indicator: 'green'});
								dialog.hide();
							}
						});
					}
				});
				dialog.show();
				denominations.forEach(denom => {
					dialog.fields_dict[`denom_${denom}`].$input.on('input', function() {
						let total = denominations.reduce((sum, d) => {
							let val = parseInt(dialog.fields_dict[`denom_${d}`].get_value()) || 0;
							return sum + val * d;
						}, 0);
						dialog.set_value('denom_total', parseFloat(total.toFixed(2)));
					});
				});
			});
			$bar.find('#new-order').on('click', () => {
				// this.order_summary.events.new_order();
				this.make_sales_invoice_frm().then(() => {
					this.order_summary.events.new_order();
				});
			});
			$bar.find('.item-group').on('click', function () {
				const selected_group = $(this).data('group');
				if (cur_pos.item_selector && cur_pos.item_selector.item_group_field) {
					cur_pos.item_selector.item_group_field.set_value(selected_group);
				}
			});
			setTimeout(() => {
				this.set_customer_for_walkin_fix();
			}, 800);
		}

		set_customer_for_walkin_fix() {
			if (!this.customer_selector || !this.customer_selector.set_customer) return;

			const original_set_customer = this.customer_selector.set_customer.bind(this.customer_selector);

			this.customer_selector.set_customer = async (...args) => {
				const result = await original_set_customer(...args);

				const customer = (this.frm?.doc?.customer || "").trim().toLowerCase();
				const is_walkin = ["walkin customer", "walk in customer", "walk-in customer"].includes(customer);

				if (is_walkin) {
					await this.frm.set_value("contact_person", "");
					await this.frm.set_value("contact_display", "");

					this.customer_details = {};
					if (window.cur_pos) {
						cur_pos.customer_details = {};
					}
					window.cur_pos_walkin_cache = { mobile: "", email: "" };
				}

				return result;
			};
		}
		make_sales_invoice_frm() {
			const doctype = "POS Invoice";
			return new Promise((resolve) => {
				if (this.frm) {
					this.frm = this.get_new_frm(this.frm);
					this.frm.doc.items = [];
					this.frm.doc.is_pos = 1;
					this.frm.doc.custom_room = cur_pos.settings.custom_pos_room;
					this.frm.doc.custom_table = cur_pos.settings.custom_default_table;
                    this.frm.doc.custom_email_address = "";
			        this.frm.doc.custom_whatsapp_number = "";
					resolve();
				} else {
					frappe.model.with_doctype(doctype, () => {
						this.frm = this.get_new_frm();
						this.frm.doc.items = [];
						this.frm.doc.is_pos = 1;
						this.frm.doc.custom_room = cur_pos.settings.custom_pos_room;
						this.frm.doc.custom_table = cur_pos.settings.custom_default_table;
                        this.frm.doc.custom_email_address = "";
				        this.frm.doc.custom_whatsapp_number = "";
						resolve();
					});
				}
			});
		}
		print_receipt(r) {
			debugger;
			this.kot_print(r.message.doc);
			if (r.message.qz_siv===0) {
				frappe.utils.print(
					r.message.doc.doctype,
					r.message.doc.name,
					r.message.print_format,
					r.message.doc.letter_head,
					r.message.doc.language || frappe.boot.lang
				);
			}
			else{
				this.siv_print(r.message);
			}
		}
		siv_print(data_doc){
			debugger;
			let qzPrinter = null;
			qz.security.setCertificatePromise(function (resolve, reject) {
				fetch("/files/public-cert.pem")
					.then(response => response.text())
					.then(resolve)
					.catch(err => reject("Failed to load certificate: " + err));
			});
			qz.security.setSignatureAlgorithm("SHA512");
			qz.security.setSignaturePromise(function (toSign) {
				return function (resolve, reject) {
					frappe.call({
						method: 'pos_app.overrides.pos_invoice.sign_data',
						args: { data: toSign },
						callback: function (r) {
							if (r.message) {
								resolve(r.message);
							} else {
								reject("Failed to sign the raw print commands");
							}
						}
					});
				};
			});
			const startsivPrinting = () => {
				let escposContent = '';
				// ESC/POS INIT
				escposContent += '\x1B\x40'; // Initialize
				escposContent += '\x1B\x61\x01'; // Center align
				escposContent += '\x1B\x21\x30'; // Double height + width
				escposContent += `${data_doc.doc.company || 'COMPANY NAME'}\n`;
				escposContent += '\x1B\x21\x00';
				escposContent += 'Tax Invoice\n';
				escposContent += 'TRN: 100611919000003\n';
				escposContent += '------------------------------------------\n';
				escposContent += '\x1B\x61\x00'; // Left align
				

				// Header details
				escposContent += `Receipt No : ${data_doc.doc.name}\n`;
				escposContent += `Cashier    : ${data_doc.doc.owner}\n`;
				escposContent += `Customer   : ${data_doc.doc.customer_name}\n`;
				escposContent += `Date       : ${data_doc.doc.posting_date}\n`;
				escposContent += `Time       : ${data_doc.doc.posting_time}\n`;
				

				// Table Header
				escposContent += '\x1B\x61\x01'; // Center align
				escposContent += '------------------------------------------\n';
				escposContent += '\x1B\x21\x08'; // Bold on
				escposContent += ' Item           Qty   Rate   Disc   Amount\n';
				escposContent += '\x1B\x21\x00'; // Normal
				escposContent += '------------------------------------------\n';

				// Items
				(data_doc.doc.items || []).forEach(item => {
				let itemCode = (item.item_code || '').substring(0, 14).padEnd(14, ' ');
				let itemName = (item.item_name || '').padStart(2, ' ');
				let qty = String(item.qty || '').padStart(4, ' ');
				let rate = Number(item.price_list_rate || 0).toFixed(2).padStart(6, ' ');
				let disc = Number(item.discount_amount || 0).toFixed(2).padStart(6, ' ');
				let amt = Number(item.amount || 0).toFixed(2).padStart(8, ' ');
				escposContent += `${itemCode}${qty}${rate}${disc}${amt}\n`;
				escposContent += '\x1B\x61\x00'; // Left align
				escposContent += `   ${itemName}\n`;
				escposContent += '\x1B\x61\x01'; // Center align

				});
				escposContent += '------------------------------------------\n';
				escposContent += '\x1B\x61\x02'; // Right align
				// Totals
				if (data_doc.doc.flags && data_doc.doc.flags.show_inclusive_tax_in_print) {
				escposContent += `Total Excl. Tax  ${Number(data_doc.doc.net_total || 0).toFixed(2)}\n`;
				} else {
				escposContent += `Total  ${Number(data_doc.doc.total || 0).toFixed(2)}\n`;
				}

				// Taxes
				(data_doc.doc.taxes || []).forEach(row => {
				escposContent += `${(row.description || '').substring(0, 10)} ${Number(row.tax_amount || 0).toFixed(2).padStart(5, ' ')}\n`;
				});

				// Discount
				if (data_doc.doc.discount_amount) {
				escposContent += `Discount  ${Number(data_doc.doc.discount_amount)}\n`;
				}

				// Grand total
				escposContent += '\x1B\x21\x08'; // Bold
				escposContent += `Grand Total  ${Number(data_doc.doc.grand_total || 0)}\n`;
				escposContent += '\x1B\x21\x00';

				// Payments
				(data_doc.doc.payments || []).forEach(row => {
				escposContent += `${(row.mode_of_payment || '').substring(0, 20).padEnd(20, ' ')} ${Number(row.amount || 0)}\n`;
				});
				escposContent += '\x1B\x21\x08'; // Bold
				escposContent += `Paid Amount  ${Number(data_doc.doc.paid_amount || 0)}\n`;
				escposContent += '\x1B\x21\x00';
				// if (data_doc.doc.change_amount) {
				// escposContent += `Change Amount  ${Number(data_doc.doc.change_amount || 0)}\n`;
				// }

				
				escposContent += '\x1B\x61\x01'; // Center
				escposContent += '------------------------------------------\n';
				escposContent += '**Taxes are included in Total\n';
				escposContent += 'Thank you, please visit again.\n';
				escposContent += '\x1B\x64\x03'; // Feed 3 lines
				escposContent += '\x1D\x56\x41'; // Partial cut
				const data = [escposContent];
				const printer_name = data_doc.siv_printer;
				console.log("" + data);
				qz.printers.find(printer_name)
					.then(printer => {
						let config = qz.configs.create(printer);
						return qz.print(config, data);
					})
					.then(() => {
						frappe.show_alert({
							message: __("Print Sent to the printer!"),
							indicator: "green",
						});
					})
					.catch(err => frappe.msgprint("QZ Print Error: " + err));
			}
			if (!qz.websocket.isActive()) {
				qz.websocket.connect()
					.then(startsivPrinting)
					.catch(err => frappe.msgprint("QZ Connection Error: " + err));
			} else {
				startsivPrinting();
			}
		}
		kot_print(inv) {
			debugger;
			frappe.call({
				method: "pos_app.overrides.pos_invoice.get_kot_data",
				args: {
					pos_profile: inv.pos_profile,
				},
				callback: (r) => {
					if (r.message) {
						const kot_data = r.message;
						if (kot_data.length) {
							this.get_kot_data(inv, kot_data);
						}
					}
				},
			});
		}
		get_kot_data(inv, kot_data) {
			let qzPrinter = null;
			qz.security.setCertificatePromise(function (resolve, reject) {
				fetch("/files/public-cert.pem")
					.then(response => response.text())
					.then(resolve)
					.catch(err => reject("Failed to load certificate: " + err));
			});
			qz.security.setSignatureAlgorithm("SHA512");
			qz.security.setSignaturePromise(function (toSign) {
				return function (resolve, reject) {
					frappe.call({
						method: 'pos_app.overrides.pos_invoice.sign_data',
						args: { data: toSign },
						callback: function (r) {
							if (r.message) {
								resolve(r.message);
							} else {
								reject("Failed to sign the raw print commands");
							}
						}
					});
				};
			});
			const startPrinting = () => {
				kot_data.forEach((kot) => {
					let escposContent = '';
					escposContent += '\x1B\x40';
					escposContent += '\x1B\x61\x01'; // Align center
					escposContent += '\x1B\x21\x30'; // Double height & width
					escposContent += 'KOT Print\n';
					escposContent += '\x1B\x21\x08'; // Bold
					escposContent += `${inv.custom_kot_number}\n`;
					escposContent += `${inv.pos_profile}\n`;
					escposContent += '\x1B\x21\x00'; // Normal
					escposContent += `Date: ${frappe.format(inv.posting_date, { "fieldtype": "Date" })}\n`;
					escposContent += `Order No: ${inv.name}\n`;
					escposContent += `Room: ${inv.custom_room}\nTable No:${inv.custom_table}\n`;
					escposContent += '\nItem              Qty   Amount\n';
					escposContent += '-------------------------------------\n';

					let matchedItems = [];
					inv.items.forEach(item => {
						if (kot.item_groups.includes(item.item_group)) {
							matchedItems.push(item);
							let itemName = item.item_name.padEnd(15).slice(0, 15);
							let qty = String(item.qty).padStart(3);
							let amt = String(item.amount.toFixed(2)).padStart(8);
							let notes = item.custom_notes || '';
							escposContent += `${itemName}${qty} ${amt}\n`;
							let code = item.item_code ? item.item_code.slice(0, 30) : '';
							escposContent += `  Code: ${code}\n`;
							escposContent += `  NB: ${notes}\n`;
						}
					});

					escposContent += '-------------------------------------\n';
					escposContent += `Time: ${frappe.format(inv.posting_time, { "fieldtype": "Time" })}   Waiter:\n`;
					escposContent += '\n\n\n';
					escposContent += '\x1D\x56\x41\x10'; // Cut

					const printer_name = kot.printer_name;
					const data = [escposContent];
					console.log("" + data);
					// console.log("Printing to printer: " + matchedItems);
										// Skip printing if there are no matched items
					if (matchedItems.length === 0) {
						return; // Continue to next kot in forEach
					}
					qz.printers.find(printer_name)
						.then(printer => {
							let config = qz.configs.create(printer);
							return qz.print(config, data);
						})
						.then(() => {
							frappe.show_alert({
								message: __("Print Sent to the printer!"),
								indicator: "green",
							});
						})
						.catch(err => frappe.msgprint("QZ Print Error: " + err));
				});
			};

			if (!qz.websocket.isActive()) {
				qz.websocket.connect()
					.then(startPrinting)
					.catch(err => frappe.msgprint("QZ Connection Error: " + err));
			} else {
				startPrinting();
			}
		}


		init_payments() {
			this.payment = new erpnext.PointOfSale.Payment({
				wrapper: this.$components_wrapper,
				events: {
					get_frm: () => this.frm || {},

					// get_customer_details: () => this.customer_details || {},
					get_customer_details: () => {
						return this.customer_details || {};
					},
					toggle_other_sections: (show) => {
						if (show) {
							this.item_details.$component.is(":visible")
								? this.item_details.$component.css("display", "none")
								: "";
							this.item_selector.toggle_component(false);
						} else {
							this.item_selector.toggle_component(true);
						}
					},

					submit_invoice: (print) => {
						const doc = this.frm.doc || {};
						const customer = (doc.customer || "").trim().toLowerCase();
						const is_walkin = ["walkin customer", "walk in customer", "walk-in customer"].includes(customer);

						const ui_mobile =
							$('input[data-fieldname="contact_mobile"]').val() ||
							$('input[data-fieldname="mobile_no"]').val() ||
							$('input[data-fieldname="phone"]').val() ||
							"";

						const ui_email =
							$('input[data-fieldname="contact_email"]').val() ||
							$('input[data-fieldname="email_id"]').val() ||
							$('input[data-fieldname="email"]').val() ||
							"";

						let whatsapp_number = "";
						let email_address = "";

						if (is_walkin) {
							const phone_prompt = window.prompt("Enter Walk In Customer Phone Number", this.frm.doc.custom_whatsapp_number || "");
							if (phone_prompt === null) return;

							const email_prompt = window.prompt("Enter Walk In Customer Email", this.frm.doc.custom_email_address || "");
							if (email_prompt === null) return;

							whatsapp_number = (phone_prompt || "").trim();
							email_address = (email_prompt || "").trim();

							this.frm.doc.custom_whatsapp_number = whatsapp_number || "";
							this.frm.doc.custom_email_address = email_address || "";
							this.frm.doc.contact_mobile = whatsapp_number || "";
							this.frm.doc.contact_email = email_address || "";
							this.frm.doc.contact_person = "";
							this.frm.doc.contact_display = whatsapp_number || email_address || "";

							this.frm.refresh_field("custom_whatsapp_number");
							this.frm.refresh_field("custom_email_address");
							this.frm.refresh_field("contact_mobile");
							this.frm.refresh_field("contact_email");






						} else {
							const customer_details = this.customer_details || {};

							whatsapp_number =
								ui_mobile ||
								doc.custom_whatsapp_number ||
								doc.contact_mobile ||
								doc.mobile_no ||
								doc.phone ||
								customer_details.contact_mobile ||
								customer_details.mobile_no ||
								customer_details.mobile ||
								customer_details.phone ||
								"";

							email_address =
								ui_email ||
								doc.custom_email_address ||
								doc.contact_email ||
								doc.email_id ||
								doc.email ||
								customer_details.contact_email ||
								customer_details.email_id ||
								customer_details.email ||
								"";
						}

						this.frm.doc.custom_whatsapp_number = whatsapp_number || "";
						this.frm.doc.custom_email_address = email_address || "";
						this.frm.doc.contact_mobile = whatsapp_number || "";
						this.frm.doc.contact_email = email_address || "";

						this.frm.refresh_field("custom_whatsapp_number");
						this.frm.refresh_field("custom_email_address");
						this.frm.refresh_field("contact_mobile");
						this.frm.refresh_field("contact_email");

						console.log("IS WALKIN:", is_walkin);
						console.log("FINAL WHATSAPP:", whatsapp_number);
						console.log("FINAL EMAIL:", email_address);





						this.frm.save(null, null, null, () => (save_error = true)).then(() => {
							console.log("SUBMIT POS INVOICE ARGS", {
							docname: this.frm.doc.name,
							is_walkin,
							walkin_mobile: is_walkin ? (
								$('input[data-fieldname="contact_mobile"]').val() ||
								$('input[data-fieldname="mobile_no"]').val() ||
								$('input[data-fieldname="phone"]').val() ||
								this.frm.doc.contact_mobile ||
								this.frm.doc.custom_whatsapp_number ||
								""
							) : "",
							walkin_email: is_walkin ? (
								$('input[data-fieldname="contact_email"]').val() ||
								$('input[data-fieldname="email_id"]').val() ||
								$('input[data-fieldname="email"]').val() ||
								this.frm.doc.contact_email ||
								this.frm.doc.custom_email_address ||
								""
							) : ""
						});
							// const card_values = is_walkin ? get_walkin_contact_from_customer_card() : { mobile: "", email: "" };
							// frappe.call({
							// 	method: "pos_app.public.api.submit_pos_invoice",
								// args: {
								// 	docname: this.frm.doc.name,
								// },
								
							frappe.msgprint({
								title: "Walkin Debug",
								message: `
									docname: ${this.frm.doc.name}<br>
									is_walkin: ${is_walkin}<br>
									walkin_mobile: ${whatsapp_number || ""}<br>
									walkin_email: ${email_address || ""}
								`
							});
							const panel_values = is_walkin ? get_walkin_contact_from_contact_panel() : { mobile: "", email: "" };

							frappe.call({
								method: "pos_app.public.api.submit_pos_invoice",
								args: {
									docname: this.frm.doc.name,
									walkin_mobile: is_walkin ? (whatsapp_number || "") : "",
									walkin_email: is_walkin ? (email_address || "") : ""
								},
								freeze: true,
								freeze_message: __("Creating POS Invoice..."),
								callback: (r) => {
									if (!r.exc) {
										this.toggle_components(false);
										frappe.show_alert({
											indicator: "green",
											message: __("POS invoice {0} created succesfully", [r.message.doc.name]),
										});
										if (print) {
											this.print_receipt(r);
										}
										// this.order_summary.toggle_component(false);
										this.make_sales_invoice_frm().then(() => {
											this.order_summary.events.new_order();
										});
									}
									else {
										frappe.show_alert({
											indicator: "red",
											message: __("Error Submitting POS invoice")
										});
									}
								}
							});
						});
					},
				},
			});
		}
	}

	erpnext.PointOfSale.PastOrderList = class CustomPastOrderList extends erpnext.PointOfSale.PastOrderList {
		make_filter_section() {
			super.make_filter_section();
			this.status_field.df.options = `Draft\nPaid\nReturn`
			// Remove the old table field if it exists
			if (this.table_field) {
				this.table_field.$wrapper.remove();
			}

			// Fetch all tables and render as buttons
			frappe.call({
				method: "pos_app.public.api.get_available_tables",
				args: {
					room: cur_pos.settings.custom_pos_room || null
				},
				callback: (r) => {
					const tables = r.message || [];
					const $btnContainer = $('<div class="table-btn-group" style="margin: 8px 0; display: flex; flex-wrap: wrap; gap: 8px;"></div>');
					tables.forEach(table => {
						const $btn = $(`<button class="btn btn-sm btn-outline-primary" data-table="${table.name}">${table.table_name}</button>`);
						$btn.on('click', () => {
							this.selected_table = table.name;
							// Optionally, highlight the selected button
							$btnContainer.find('button').removeClass('active');
							$btn.addClass('active');
							this.refresh_list();
						});
						$btnContainer.append($btn);
					});
					// Append to filter section
					this.$component.find(".status-field").parent().append($btnContainer);
				}
			});
		}

		// Override refresh_list to use selected_table
		refresh_list() {
			frappe.dom.freeze();
			this.events.reset_summary();
			const search_term = this.search_field.get_value();
			const status = this.status_field.get_value();
			const table = this.selected_table || null;
			this.$invoices_container.html("");

			return frappe.call({
				method: "erpnext.selling.page.point_of_sale.point_of_sale.get_past_order_list",
				freeze: true,
				args: { search_term, status, table, pos_profile: cur_pos.pos_profile },
				callback: (response) => {
					frappe.dom.unfreeze();
					response.message.forEach((invoice) => {
						const invoice_html = this.get_invoice_html(invoice);
						this.$invoices_container.append(invoice_html);
					});
				},
			});
		}
	}

	erpnext.PointOfSale.ItemDetails = class CustomPOSItemDetails extends (erpnext.PointOfSale.ItemDetails) {
		bind_custom_control_change_event() {
			const me = this;
			if (this.warehouse_control) {
				this.warehouse_control.df.read_only = 1;
			}
			if (this.item_code_control) {
				this.item_code_control.df.label = __("Item Code");
				this.item_code_control.df.read_only = 1;
				this.item_code_control.refresh();
			}
			super.bind_custom_control_change_event();

		}
		get_form_fields(item) {
			const fields = [
				"item_code",
				"custom_notes",
				"qty",
				"uom",
				"rate",
				"conversion_factor",
				"discount_percentage",
				"warehouse",
				"actual_qty",
				"price_list_rate",
			];
			if (item.has_serial_no) fields.push("serial_no");
			if (item.has_batch_no) fields.push("batch_no");
			return fields;
		}
		render_form(item) {
			const fields_to_display = this.get_form_fields(item);
			this.$form_container.html("");

			fields_to_display.forEach((fieldname, idx) => {
				// Insert Show UOMs button before UOM control
				if (fieldname === "uom") {
					this.$form_container.append('<div style="margin:4px; padding-top: 16px; align-content: center; text-align:center;"><button class="btn btn-sm btn-primary show-uoms-btn">Show UOMs</button></div>');
				}
				this.$form_container.append(
					`<div class="${fieldname}-control" data-fieldname="${fieldname}"></div>`
				);

				const field_meta = this.item_meta.fields.find((df) => df.fieldname === fieldname);
				fieldname === "discount_percentage" ? (field_meta.label = __("Discount (%)")) : "";
				const me = this;

				this[`${fieldname}_control`] = frappe.ui.form.make_control({
					df: {
						...field_meta,
						onchange: function () {
							me.events.form_updated(me.current_item, fieldname, this.value);
						},
					},
					parent: this.$form_container.find(`.${fieldname}-control`),
					render_input: true,
				});
				this[`${fieldname}_control`].set_value(item[fieldname]);
			});

			this.$form_container.find('.show-uoms-btn').on('click', () => {
				frappe.call({
					method: "pos_app.public.api.get_item_uoms",
					args: {
						item_code: item.item_code,
					},
					callback: (r) => {
						let uoms = (r.message || []).map(u => u.uom);
						if (uoms.length) {
							let btns_html = uoms.map(uom =>
								`<button class='btn btn-sm btn-primary uom-btn' style='margin:4px;' data-uom='${uom}'>${uom}</button>`
							).join("");
							let dialog_html = `<div style='margin-bottom:8px;'></div><div>${btns_html}</div>`;
							const uom_dialog = new frappe.ui.Dialog({
								title: __('Select UOM'),
								fields: [
									{
										fieldtype: 'HTML',
										fieldname: 'uom_buttons',
										options: dialog_html
									}
								],
								primary_action: null
							});
							uom_dialog.show();
							setTimeout(() => {
								uom_dialog.$wrapper.find('.uom-btn').on('click', (e) => {
									const selected_uom = $(e.currentTarget).data('uom');
									this.uom_control.set_value(selected_uom);
									uom_dialog.hide();
								});
							}, 100);
						} else {
							frappe.show_alert({ message: __('No UOMs found for this item.'), indicator: 'red' });
						}
					}
				});
			});
			this.make_auto_serial_selection_btn(item);

			this.bind_custom_control_change_event();
		}
	};

	erpnext.PointOfSale.PastOrderSummary = class CustomPOSPastOrderSummary extends (erpnext.PointOfSale.PastOrderSummary) {
		print_receipt() {
			const frm = this.events.get_frm();
			this.get_kot_data(frm)
			frappe.utils.print(
				this.doc.doctype,
				this.doc.name,
				frm.pos_print_format,
				this.doc.letter_head,
				this.doc.language || frappe.boot.lang
			);
		}
		get_kot_data(frm) {
			frappe.call({
				method: "pos_app.overrides.pos_invoice.get_kot_data",
				args: {
					pos_profile: this.doc.pos_profile,
				},
				callback: (r) => {
					if (r.message) {
						const kot_data = r.message;
						if (kot_data.length) {
							this.kot_print(frm, kot_data);
						}
					}
				},
			});
		}
		kot_print(frm, kot_data) {
			let qzPrinter = null;
			qz.security.setCertificatePromise(function (resolve, reject) {
				fetch("/files/public-cert.pem")
					.then(response => response.text())
					.then(resolve)
					.catch(err => reject("Failed to load certificate: " + err));
			});
			qz.security.setSignatureAlgorithm("SHA512");
			qz.security.setSignaturePromise(function (toSign) {
				return function (resolve, reject) {
					frappe.call({
						method: 'pos_app.overrides.pos_invoice.sign_data',
						args: { data: toSign },
						callback: function (r) {
							if (r.message) {
								resolve(r.message);
							} else {
								reject("Failed to sign the raw print commands");
							}
						}
					});
				};
			});
			kot_data.forEach((kot) => {
				let escposContent = '';
				escposContent += '\x1B\x40';
				escposContent += '\x1B\x61\x01'; // Align center
				escposContent += '\x1B\x21\x30'; // Double height & width
				escposContent += 'KOT Print\n';
				escposContent += '\x1B\x21\x08'; // Bold
				escposContent += `${this.doc.custom_kot_number}\n`;
				escposContent += `${this.doc.pos_profile}\n`;
				escposContent += '\x1B\x21\x00'; // Normal
				escposContent += '\x1B\x61\x00'; // Align left
				escposContent += `Date: ${frappe.format(this.doc.posting_date, { "fieldtype": "Date" })}\n`;
				escposContent += `Order No: ${this.doc.name}\n`;
				escposContent += `Room: ${this.doc.custom_room}\nTable No:${this.doc.custom_table}\n`;
				escposContent += '\x1B\x61\x01'; // Align center
				escposContent += '\nItem              Qty   Amount\n';
				escposContent += '-------------------------------------\n';

				this.doc.items.forEach(item => {
					if (kot.item_groups.includes(item.item_group)) {
						let itemName = item.item_name.padEnd(15).slice(0, 15);
						let qty = String(item.qty).padStart(3);
						let amt = String(item.amount.toFixed(2)).padStart(8);
						let notes = item.custom_notes ? item.custom_notes : '';
						escposContent += `${itemName}${qty} ${amt}\n`;
						let code = item.item_code ? item.item_code.slice(0, 30) : '';
						escposContent += `  Code: ${code}\n`;
						escposContent += `  NB: ${notes}\n`;
					}
				});

				escposContent += '-------------------------------------\n';
				escposContent += `Time: ${frappe.format(this.doc.posting_time, { "fieldtype": "Time" })}   Waiter:\n`;
				escposContent += '\n\n\n';
				escposContent += '\x1D\x56\x41\x10'; // Cut
				const printer_name = kot.printer_name;
				const data = [escposContent]; // RAW string inside array
				// console.log("" + data);
				if (!qz.websocket.isActive()) {
					qz.websocket.connect().then(() => {
						return qz.printers.find(printer_name);
					}).then(printer => {
						qzPrinter = printer;
						let config = qz.configs.create(qzPrinter);
						qz.print(config, data).catch(err => frappe.msgprint("QZ Print Error: " + err));;
						frappe.show_alert({
							message: __("Print Sent to the printer!"),
							indicator: "green",
						});
					})
				} else {
					if (qzPrinter) {
						let config = qz.configs.create(qzPrinter);
						qz.print(config, data).catch(err => frappe.msgprint("QZ Print Error: " + err));
						frappe.show_alert({
							message: __("Print Sent to the printer!"),
							indicator: "green",
						});
					} else {
						qz.printers.find(printer_name).then(printer => {
							qzPrinter = printer;
							let config = qz.configs.create(qzPrinter);
							qz.print(config, data).catch(err => frappe.msgprint("QZ Print Error: " + err));
						}).catch(err => frappe.msgprint("QZ Tray Print Error: " + err));
					}
				}

			});
		}
	};
	erpnext.PointOfSale.Payment = class CustomPOSPayment extends (erpnext.PointOfSale.Payment) {
		constructor(options) {
        // Ensure frappe.sys_defaults exists before parent init
        if (!frappe.sys_defaults) {
            frappe.sys_defaults = {};
        }
        if (typeof frappe.sys_defaults.disable_grand_total_to_default_mop === 'undefined') {
            frappe.sys_defaults.disable_grand_total_to_default_mop = 0;
        }
        if (typeof frappe.sys_defaults.disable_rounded_total === 'undefined') {
            frappe.sys_defaults.disable_rounded_total = 0;
        }
        super(options);
    }
		prepare_dom() {
			this.wrapper.append(
				`<section class="payment-container">
				<div class="section-label payment-section">${__("Payment Method")}</div>
				<div class="payment-modes"></div>
				<div class="fields-numpad-container">
					<div class="fields-section">
						<div class="section-label">${__("Additional Information")}</div>
						<div class="invoice-fields"></div>
					</div>
					<div class="number-pad"></div>
				</div>
				<div class="totals-section">
					<div class="totals"></div>
				</div>
			   <div class="pos-payment-btn-row" style="display:flex; gap:12px; justify-content:center; margin-top:16px;">
					<button class="btn btn-info print-draft-btn" style="flex: 1; font-size: 16px;"><b>${__("Print Draft")}</b></button>
					<button class="btn btn-success submit-btn" style="flex: 1;font-size: 16px;"><b>${__("Submit")}</b></button>
  					<button class="btn btn-primary submit-order-btn" style="margin-top: 0; flex: 1;">${__("Submit and Print")}</button>
				</div>
			</section>`
			);
			this.$component = this.wrapper.find(".payment-container");
			this.$payment_modes = this.$component.find(".payment-modes");
			this.$totals_section = this.$component.find(".totals-section");
			this.$totals = this.$component.find(".totals");
			this.$numpad = this.$component.find(".number-pad");
			this.$invoice_fields_section = this.$component.find(".fields-section");
		}


		bind_events() {
			const me = this;
			

			const attach_walkin_popup_capture = () => {
			$(document).off(".walkin_popup_capture");

			$(document).on("input.walkin_popup_capture blur.walkin_popup_capture", ".modal.show input, .frappe-dialog.show input", function () {
				const customer = ((me.events.get_frm().doc.customer) || "").trim().toLowerCase();
				if (!is_walkin_customer_name(customer)) return;

				const cache = extract_walkin_from_open_dialog();
				console.log("WALKIN CACHE UPDATED", cache);
			});

			$(document).on("click.walkin_popup_capture", ".modal.show .btn-primary, .frappe-dialog.show .btn-primary", function () {
				const customer = ((me.events.get_frm().doc.customer) || "").trim().toLowerCase();
				if (!is_walkin_customer_name(customer)) return;

				setTimeout(() => {
					const cache = extract_walkin_from_open_dialog();
					console.log("WALKIN CACHE AFTER DIALOG SAVE", cache);
				}, 200);
			});
		};

		setTimeout(() => {
			attach_walkin_popup_capture();
		}, 500);
			this.$payment_modes.on("click", ".mode-of-payment", function (e) {
				const mode_clicked = $(this);
				// if clicked element doesn't have .mode-of-payment class then return
				if (!$(e.target).is(mode_clicked)) return;

				const scrollLeft =
					mode_clicked.offset().left - me.$payment_modes.offset().left + me.$payment_modes.scrollLeft();
				me.$payment_modes.animate({ scrollLeft });

				const mode = mode_clicked.attr("data-mode");

				// hide all control fields and shortcuts
				$(`.mode-of-payment-control`).css("display", "none");
				$(`.cash-shortcuts`).css("display", "none");
				me.$payment_modes.find(`.pay-amount`).css("display", "inline");
				me.$payment_modes.find(`.loyalty-amount-name`).css("display", "none");

				// remove highlight from all mode-of-payments
				$(".mode-of-payment").removeClass("border-primary");

				if (mode_clicked.hasClass("border-primary")) {
					// clicked one is selected then unselect it
					mode_clicked.removeClass("border-primary");
					me.selected_mode = "";
				} else {
					// clicked one is not selected then select it
					mode_clicked.addClass("border-primary");
					mode_clicked.find(".mode-of-payment-control").css("display", "flex");
					mode_clicked.find(".cash-shortcuts").css("display", "grid");
					me.$payment_modes.find(`.${mode}-amount`).css("display", "none");
					me.$payment_modes.find(`.${mode}-name`).css("display", "inline");

					me.selected_mode = me[`${mode}_control`];
					me.selected_mode && me.selected_mode.$input.get(0).focus();
					me.auto_set_remaining_amount();
				}
			});

			// frappe.ui.form.on("POS Invoice", "contact_mobile", (frm) => {
			// 	const contact = frm.doc.contact_mobile;
			// 	const request_button = $(this.request_for_payment_field?.$input[0]);
			// 	if (contact) {
			// 		request_button.removeClass("btn-default").addClass("btn-primary");
			// 	} else {
			// 		request_button.removeClass("btn-primary").addClass("btn-default");
			// 	}
			// });
            // frappe.ui.form.on("POS Invoice", "contact_mobile", (frm) => {
            //     const contact = frm.doc.contact_mobile || "";
            //     const request_button = $(this.request_for_payment_field?.$input[0]);

            //     frm.set_value("custom_whatsapp_number", contact);

            //     if (contact) {
            //         request_button.removeClass("btn-default").addClass("btn-primary");
            //     } else {
            //         request_button.removeClass("btn-primary").addClass("btn-default");
            //     }
            // });

            // frappe.ui.form.on("POS Invoice", "contact_email", (frm) => {
            //     frm.set_value("custom_email_address", frm.doc.contact_email || "");
            // });

            // frappe.ui.form.on("POS Invoice", "email_id", (frm) => {
            //     frm.set_value("custom_email_address", frm.doc.email_id || "");
            // });


			frappe.ui.form.on("POS Invoice", {
				contact_mobile(frm) {
					if (!is_walkin_customer_name(frm.doc.customer)) return;
					frm.doc.custom_whatsapp_number = frm.doc.contact_mobile || "";
					frm.refresh_field("custom_whatsapp_number");
				},

				contact_email(frm) {
					if (!is_walkin_customer_name(frm.doc.customer)) return;
					frm.doc.custom_email_address = frm.doc.contact_email || "";
					frm.refresh_field("custom_email_address");
				},

				email_id(frm) {
					if (!is_walkin_customer_name(frm.doc.customer)) return;
					frm.doc.custom_email_address = frm.doc.email_id || "";
					frm.refresh_field("custom_email_address");
				}
			});

			
			frappe.ui.form.on("POS Invoice", "coupon_code", (frm) => {
				if (frm.doc.coupon_code && !frm.applying_pos_coupon_code) {
					if (!frm.doc.ignore_pricing_rule) {
						frm.applying_pos_coupon_code = true;
						frappe.run_serially([
							() => (frm.doc.ignore_pricing_rule = 1),
							() => frm.trigger("ignore_pricing_rule"),
							() => (frm.doc.ignore_pricing_rule = 0),
							() => frm.trigger("apply_pricing_rule"),
							() => frm.save(),
							() => this.update_totals_section(frm.doc),
							() => (frm.applying_pos_coupon_code = false),
						]);
					} else if (frm.doc.ignore_pricing_rule) {
						frappe.show_alert({
							message: __("Ignore Pricing Rule is enabled. Cannot apply coupon code."),
							indicator: "orange",
						});
					}
				}
			});

			this.setup_listener_for_payments();

			this.$payment_modes.on("click", ".shortcut", function () {
				const value = $(this).attr("data-value");
				me.selected_mode.set_value(value);
			});

			this.$component.on("click", ".submit-order-btn", () => {
				const doc = this.events.get_frm().doc;
				const paid_amount = doc.paid_amount;
				const items = doc.items;

				if (paid_amount == 0 || !items.length) {
					const message = items.length
						? __("You cannot submit the order without payment.")
						: __("You cannot submit empty order.");
					frappe.show_alert({ message, indicator: "orange" });
					frappe.utils.play_sound("error");
					return;
				}

				this.events.submit_invoice(true);
			});

			this.$component.on("click", ".submit-btn", () => {
				const doc = this.events.get_frm().doc;
				const paid_amount = doc.paid_amount;
				const items = doc.items;

				if (paid_amount == 0 || !items.length) {
					const message = items.length
						? __("You cannot submit the order without payment.")
						: __("You cannot submit empty order.");
					frappe.show_alert({ message, indicator: "orange" });
					frappe.utils.play_sound("error");
					return;
				}

				this.events.submit_invoice(false);
			});

			this.$component.on("click", ".print-draft-btn", () => {
				const siv = this.events.get_frm();
				frappe.utils.print(
					siv.doc.doctype,
					siv.doc.name,
					siv.pos_print_format,
					siv.doc.letter_head,
					siv.doc.language || frappe.boot.lang
				);
			});

			frappe.ui.form.on("POS Invoice", "paid_amount", (frm) => {
				this.update_totals_section(frm.doc);

				// need to re calculate cash shortcuts after discount is applied
				const is_cash_shortcuts_invisible = !this.$payment_modes.find(".cash-shortcuts").is(":visible");
				this.attach_cash_shortcuts(frm.doc);
				!is_cash_shortcuts_invisible &&
					this.$payment_modes.find(".cash-shortcuts").css("display", "grid");
				this.render_payment_mode_dom();
			});

			frappe.ui.form.on("POS Invoice", "loyalty_amount", (frm) => {
				const formatted_currency = format_currency(frm.doc.loyalty_amount, frm.doc.currency);
				this.$payment_modes.find(`.loyalty-amount-amount`).html(formatted_currency);
			});

			frappe.ui.form.on("Sales Invoice Payment", "amount", (frm, cdt, cdn) => {
				// for setting correct amount after loyalty points are redeemed
				const default_mop = locals[cdt][cdn];
				const mode = this.sanitize_mode_of_payment(default_mop.mode_of_payment);
				if (this[`${mode}_control`] && this[`${mode}_control`].get_value() != default_mop.amount) {
					this[`${mode}_control`].set_value(default_mop.amount);
				}
			});
		}
		sanitize_mode_of_payment(mode_of_payment) {
		return mode_of_payment
			.replace(/ +/g, "_")
			.replace(/[^\p{L}\p{N}_-]/gu, "")
			.replace(/^[^_a-zA-Z\p{L}]+/u, "")
			.toLowerCase();
		}

	};

	erpnext.PointOfSale.ItemCart = class CustomPOSItemCart extends (erpnext.PointOfSale.ItemCart) {
		update_totals_section(frm) {
			if (!frm) frm = this.events.get_frm();

			this.render_net_total(frm.doc.net_total);
			this.render_total_item_qty(frm.doc.items);
			const grand_total = cint(frappe.sys_defaults.disable_rounded_total)
				? frm.doc.grand_total
				: frm.doc.rounded_total;
			this.render_grand_total(grand_total);

			this.render_taxes(frm.doc.taxes);

			frappe.call({
				method: 'pos_app.pos_app.page.customer_portal.customer_portal.customer_portal_page',
				args: {
					customer: frm.doc.customer,
					pos_profile: frm.doc.pos_profile,
					invoice_: frm.doc.name,
					date: frm.doc.posting_date,
					items: frm.doc.items,
					taxes: frm.doc.taxes,
					grand_total: grand_total,
					net_total: frm.doc.net_total,
					total_item_qty:this.total_item_qty ||0
				},
				callback: function(response) {
				
				}
			});
		}
	
	}
})



