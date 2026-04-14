frappe.pages['customer-portal'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		// title: 'POS Invoice',
		single_column: true	
	});

	// Append the template to page.main
	$(frappe.render_template('customer_portal', {})).appendTo(page.main);
	// Initialize the page logic
	var pos_page = new POSDisplayPage(page);
};

class POSDisplayPage {
	constructor(page) {
		this.page = page;
		this.init();
	}

	init() {
		// this.set_invoice_date();
		this.show_placeholder();
		this.add_fullscreen_button();
		this.hide_navbar();
		
		// Subscribe to the socket room
		
		frappe.realtime.on("customer_portal", (data) => {
			if (data && data.items && data.items.length > 0) {
				this.render_invoice_details(data);
				this.render_items(data.items);
				this.calculate_totals(data);
			} 
			// else if (data && data.message && data.message.items && data.message.items.length > 0) {
			// 	debugger;
			// 	const items = data.message.items;
			// 	this.render_items(items);
			// 	this.calculate_totals(data.message);
			// } 
			else {
				this.show_placeholder();
			}
		});

	}

	show_placeholder() {
		const emptyState = document.getElementById('empty-state');
		const dataContent = document.getElementById('data-content');
		
		if (emptyState && dataContent) {
			// Apply fullscreen styles using CSS classes
			document.documentElement.classList.add('fullscreen-active');
			document.body.classList.add('fullscreen-active');
			frappe.call({
			method: 'pos_app.pos_app.page.customer_portal.customer_portal.pos_profile_and_media',
			args: {
				company: frappe.defaults.get_default("company"),
			},
			callback: function(r) {
				if (r.message) {
					const media_url = r.message.media_url;
					const is_video = r.message.is_video;
					console.log("media_url", media_url, "is_video", is_video);
					if (is_video===1) {
						emptyState.innerHTML = `
							<video width="100%" height="100%" autoplay muted loop style="object-fit: cover;">
								<source src="${media_url}" type="video/mp4">
								Your browser does not support the video tag.
							</video>
						`;
					} else {
						emptyState.innerHTML = `<img src="${media_url}" alt="No data" style="width: 100%; height: 100%; object-fit: cover;" />`;
					}
				
					// You can use media_url and is_video to customize the placeholder content
				}
			}
		});
			// Option 1: Display Image (uncomment to use)
			// emptyState.innerHTML = `<img src="/files/PBB_4588.JPG" alt="No data" />`;
			
			// Option 2: Display Video with controls (uncomment to use)
			// emptyState.innerHTML = `
			// 	<video width="100%" height="100%" controls autoplay muted style="object-fit: cover;">
			// 		<source src="/files/3333.mov" type="video/mp4">
			// 		Your browser does not support the video tag.
			// 	</video>
			// `;
			
			// Option 3: Display Video without controls (uncomment to use)
			// emptyState.innerHTML = `
			// 	<video width="100%" height="100%" autoplay muted loop style="object-fit: cover;">
			// 		<source src="/files/file_example_MP4_640_3MG.mp4" type="video/mp4">
			// 		Your browser does not support the video tag.
			// 	</video>
			// `;
			
			emptyState.classList.add('active');
			dataContent.classList.remove('active');
		}
	}

	// set_invoice_date() {
	// 	document.getElementById('invoice-date').textContent = frappe.datetime.nowdate();
	// }

	render_invoice_details(data) {
		// Update invoice number if present
		if (data.invoice) {
			const invoiceNumberEl = document.getElementById('invoice-number');
			if (invoiceNumberEl) {
				invoiceNumberEl.textContent = data.invoice;
			}
		}
		// Display customer name
		if (data.customer) {
			const customerNameEl = document.getElementById('invoice-customer');
			if (customerNameEl) {
				customerNameEl.textContent = data.customer;
			}
		}
		// Display customer phone number
		if (data.customer_phone) {
			const customerPhoneEl = document.getElementById('invoice-phone');
			if (customerPhoneEl) {
				customerPhoneEl.textContent = data.customer_phone;
			}
		}
		if (data.date) {
			const invoiceDateEl = document.getElementById('invoice-date');
			if (invoiceDateEl) {
				invoiceDateEl.textContent = data.date;
			}
		}
	}

	add_fullscreen_button() {
		const button = document.createElement('button');
		button.id = 'fullscreen-btn';
		button.className = 'btn btn-default btn-sm fullscreen-btn';
		button.innerHTML = '<i class="fa fa-expand"></i>';
		
		button.addEventListener('click', () => this.toggle_fullscreen());
		document.body.appendChild(button);
		
		// Listen for fullscreen change events
		document.addEventListener('fullscreenchange', () => {
			if (!document.fullscreenElement && button) {
				button.style.display = 'block';
			}
		});
	}

	hide_navbar() {
		const navbar = document.querySelector('.navbar');
		if (navbar) {
			navbar.classList.add('navbar');
		}
	}

	toggle_fullscreen() {
		const elem = document.documentElement;
		const btn = document.getElementById('fullscreen-btn');
		
		if (!document.fullscreenElement) {
			// Enter fullscreen
			if (elem.requestFullscreen) {
				elem.requestFullscreen();
			} else if (elem.webkitRequestFullscreen) {
				elem.webkitRequestFullscreen();
			} else if (elem.mozRequestFullScreen) {
				elem.mozRequestFullScreen();
			} else if (elem.msRequestFullscreen) {
				elem.msRequestFullscreen();
			}
			
			if (btn) {
				btn.style.display = 'none';
			}
		} else {
			// Exit fullscreen
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen();
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen();
			}
			
			if (btn) {
				btn.style.display = 'block';
			}
		}
	}


	render_items(items) {
		const emptyState = document.getElementById('empty-state');
		const dataContent = document.getElementById('data-content');
		const tbody = document.getElementById('items-tbody');
		const itemsSection = document.querySelector('.items-section');
		
		if (!tbody) {
			console.error('tbody element not found');
			return;
		}
		
		// Apply fullscreen styles using CSS classes
		document.documentElement.classList.add('fullscreen-active');
		document.body.classList.add('fullscreen-active');
		
		// Hide empty state and show data
		if (emptyState && dataContent) {
			emptyState.classList.remove('active');
			dataContent.classList.add('active');
		}
		
		tbody.innerHTML = '';

		items.forEach((item) => {
			const row = document.createElement('tr');
			row.className = 'item-row';
			row.innerHTML = `
				<td class="item-name">${item.name}</td>
				<td class="item-qty">${item.qty}</td>
				<td style="text-align: right;" class="item-uom">${item.uom}</td>
				<td class="item-rate">${item.rate}</td>
				<td class="item-amount">${item.amount}</td>
			`;
			tbody.appendChild(row);
		});
		
		// Scroll to bottom of items section
		if (itemsSection) {
			setTimeout(() => {
				itemsSection.scrollTop = itemsSection.scrollHeight;
			}, 0);
		}
	}

	calculate_totals(data) {
		let total_tax = 0;
		
		const subtotalEl = document.getElementById('subtotal');
		const taxEl = document.getElementById('tax-amount');
		const grandTotalEl = document.getElementById('grand-total');
		if (subtotalEl) subtotalEl.textContent = data.net_total;
		if (taxEl) taxEl.textContent = (data.grand_total - data.net_total).toFixed(3);
		if (grandTotalEl) grandTotalEl.textContent = data.grand_total;
	}
}
