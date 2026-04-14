frappe.ui.form.on("WhatsApp Conversation", {
	refresh(frm) {
		frm.__chat_state = frm.__chat_state || {
			start: 0,
			limit: 50,
			total: 0,
			loading: false
		};

		frm.__user_reading_old = frm.__user_reading_old || false;

		if (!frm.__chat_ui_built) {
			render_chat_shell(frm);
			frm.__chat_ui_built = true;
		}

		reload_latest(frm);

		if (frm.__wa_timer) clearInterval(frm.__wa_timer);
		frm.__wa_timer = setInterval(() => {
			if (cur_frm && cur_frm.doc && cur_frm.doc.name === frm.doc.name) {
				if (!frm.__user_reading_old) {
					reload_latest(frm);
				}
			}
		}, 5000);
	},

	on_unload(frm) {
		if (frm.__wa_timer) clearInterval(frm.__wa_timer);
		frm.__chat_ui_built = false;
	}
});

function escape_html(value) {
	return frappe.utils.escape_html(value == null ? "" : String(value));
}

function format_message_time(timestamp) {
	if (!timestamp) return "";
	try {
		return frappe.datetime.str_to_user(timestamp);
	} catch (e) {
		return timestamp || "";
	}
}

function render_pdf_card(url, title) {
	return `
		<div style="
			margin-top:8px;
			border:1px solid rgba(0,0,0,.08);
			border-radius:10px;
			padding:10px 12px;
			background:rgba(255,255,255,.55);
			max-width:100%;
		">
			<div style="
				font-size:13px;
				font-weight:600;
				color:#111b21;
				margin-bottom:6px;
				word-break:break-word;
			">
				📄 ${escape_html(title || "POS Invoice")}
			</div>
			<a href="${escape_html(url)}"
				target="_blank"
				style="
					color:#0b57d0;
					text-decoration:underline;
					word-break:break-word;
					overflow-wrap:anywhere;
					display:block;
					line-height:1.35;
					font-size:13px;
				">
				Open PDF
			</a>
		</div>
	`;
}

function render_chat_shell(frm) {
	const wrap = frm.fields_dict.chat_html?.$wrapper;
	if (!wrap) return;

	if (!frm.doc.customer_phone) {
		wrap.html(`<div style="padding:12px; opacity:.7;">Set Customer Phone to view chat.</div>`);
		return;
	}

	const customer_label = frm.doc.customer || frm.doc.customer_name || "Customer";
	const phone_label = frm.doc.customer_phone || "";

	wrap.html(`
		<div style="display:flex; flex-direction:column; gap:10px;">

			<div style="
				padding:12px 14px;
				border:1px solid #e5e7eb;
				border-radius:12px;
				background:#ffffff;
			">
				<div style="font-weight:600; font-size:14px; color:#111b21;">
					${escape_html(customer_label)}
				</div>
				<div style="font-size:12px; color:#667781; margin-top:2px;">
					${escape_html(phone_label)}
				</div>
			</div>

			<div id="wa_box" style="
				padding:14px;
				background:#efeae2;
				border-radius:12px;
				max-height:520px;
				min-height:420px;
				overflow:auto;
				border:1px solid #dfe5e7;
				display:flex;
				flex-direction:column;
				gap:8px;
			">
				<div style="padding:10px; opacity:.7; text-align:center;">Loading…</div>
			</div>

			<div style="display:flex; justify-content:space-between; align-items:center;">
				<button class="btn btn-default btn-sm" id="wa_load_more">Load older</button>
				<div id="wa_meta" style="font-size:12px; color:#667781;"></div>
			</div>
		</div>
	`);

	const box = wrap.find("#wa_box");

	box.off("scroll").on("scroll", function () {
		const el = this;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		frm.__user_reading_old = distanceFromBottom > 120;
	});

	wrap.find("#wa_load_more").off("click").on("click", () => {
		load_messages(frm, { append_older: true });
	});
}

function reload_latest(frm) {
	const wrap = frm.fields_dict.chat_html?.$wrapper;
	if (!wrap) return;

	frm.__chat_state.start = 0;
	wrap.find("#wa_box").data("rendered", false);

	load_messages(frm, { append_older: false });
}

function load_messages(frm, { append_older }) {
	const wrap = frm.fields_dict.chat_html?.$wrapper;
	if (!wrap) return;

	const box = wrap.find("#wa_box");
	const meta = wrap.find("#wa_meta");
	const state = frm.__chat_state;

	if (state.loading) return;
	state.loading = true;

	frappe.call({
		method: "pos_app.pos_invoice_whatsapp.get_messages_by_phone",
		args: {
			customer_phone: frm.doc.customer_phone || frm.doc.name,
			conversation: frm.doc.name,
			limit: state.limit,
			start: state.start
		},
		callback: (r) => {
			const resp = r.message || {};
			const msgs = resp.data || [];
			state.total = resp.total || 0;

			const oldScrollHeight = box[0]?.scrollHeight || 0;
			const oldScrollTop = box[0]?.scrollTop || 0;
			const existing = box.data("rendered") ? box.html() : "";

			let html = "";

			if (!msgs.length && !box.data("rendered")) {
				html = `<div style="padding:16px; opacity:.7; text-align:center;">No messages</div>`;
			} else {
				const ordered = msgs.slice().reverse();

				ordered.forEach((m) => {
					const inbound = (m.direction || "").toLowerCase().includes("inbound");
					const timeValue = m.timestamp || m.creation || "";
					const time = format_message_time(timeValue);

					const rowJustify = inbound ? "flex-start" : "flex-end";
					const bubbleBg = inbound ? "#ffffff" : "#d9fdd3";
					const bubbleRadius = inbound ? "12px 12px 12px 4px" : "12px 12px 4px 12px";

					const senderName = inbound
						? (frm.doc.customer || frm.doc.customer_name || "Customer")
						: "You";

					let content_html = "";

					if (m.body) {
						content_html += `
							<div style="
								white-space:pre-wrap;
								word-break:break-word;
								overflow-wrap:anywhere;
							">
								${escape_html(m.body)}
							</div>
						`;
					}

					if (m.media_url) {
						content_html += render_pdf_card(m.media_url, m.reference_name || "POS Invoice");
					}

					html += `
						<div style="
							display:flex;
							justify-content:${rowJustify};
							width:100%;
							margin:4px 0;
						">
							<div style="
								display:inline-flex;
								flex-direction:column;
								align-items:flex-start;
								background:${bubbleBg};
								border-radius:${bubbleRadius};
								padding:7px 10px 6px;
								box-shadow:0 1px 1px rgba(0,0,0,.08);
								font-size:14px;
								line-height:1.42;
								color:#111b21;
								width:auto;
								max-width:62%;
								min-width:0;
							">
								<div style="
									font-size:12px;
									font-weight:600;
									color:${inbound ? "#0b57d0" : "#128c7e"};
									margin-bottom:4px;
								">
									${escape_html(senderName)}
								</div>

								<div style="max-width:100%;">
									${content_html}
								</div>

								<div style="
									font-size:11px;
									color:#667781;
									align-self:flex-end;
									margin-top:4px;
									white-space:nowrap;
								">
									${escape_html(time)}
								</div>
							</div>
						</div>
					`;
				});
			}

			if (!box.data("rendered")) {
				box.html(html);
				box.data("rendered", true);
			} else if (append_older) {
				box.html(html + existing);
			} else {
				box.html(html);
			}

			state.start += msgs.length;
			meta.text(`Showing ${Math.min(state.start, state.total)} of ${state.total}`);
			wrap.find("#wa_load_more").prop("disabled", state.start >= state.total);

			if (!append_older) {
				if (!frm.__user_reading_old) {
					box[0].scrollTop = box[0].scrollHeight;
				}
			} else {
				const newScrollHeight = box[0].scrollHeight;
				box[0].scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);
			}
		},
		always: () => {
			state.loading = false;
		}
	});
}