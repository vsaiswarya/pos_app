frappe.pages['kitchen-orders'].on_page_load = function (wrapper) {
    window.kitchenOrdersInstance = new KitchenOrders(wrapper);
};

class KitchenOrders {
    constructor(wrapper) {
        this.selectedKitchen = null;
        this.orders = [];
        this.refreshInterval = null;

        this.page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'Kitchen Orders',
            single_column: true
        });

        $(this.page.parent).find('.page-head').remove(); // Remove default header

        frappe.prompt(
            {
                label: 'Select Kitchen',
                fieldname: 'kitchen',
                fieldtype: 'Link',
                options: 'KOT Print',
                reqd: 1
            },
            (values) => {
                this.selectedKitchen = values.kitchen;
                this.initPage();
            },
            'Kitchen Selection',
            'Proceed'
        );
    }

    initPage() {
        this.$app = $(frappe.render_template("kitchen_orders", {}));
        $(this.page.body).append(this.$app);

        this.grid = this.$app.find('#orders-grid');
        this.searchInput = this.$app.find('#search-orders');

        // Debounced search to reduce re-renders
        this.searchInput.on('input', this.debounce(() => this.render(), 300));

        // Refresh button
        this.$app.find('#refresh-orders').on('click', () => this.loadOrders());

        // Event delegation for status button
        this.grid.on('click', '.update-status-btn', (e) => {
            const orderName = $(e.currentTarget).data('order');
            this.updateOrderStatus(orderName);
        });

        this.loadOrders();
        this.refreshInterval = setInterval(() => this.loadOrders(), 10000);
    }

    loadOrders() {
        if (!this.selectedKitchen) return;

        frappe.call({
            method: "pos_app.pos_app.page.kitchen_orders.kitchen_orders.get_orders",
            args: { kitchen: this.selectedKitchen },
            freeze: true,
            callback: (r) => {
                if (r.message) {
                    this.orders = r.message;
                    this.render();
                }
            }
        });
    }

    render() {
        const query = (this.searchInput.val() || '').toLowerCase();
        let html = '';

        this.orders
            .filter(o => {
                const itemText = o.items.map(i =>
                    `${i.item_code} ${i.item_name} ${i.qty} ${i.rate} ${i.amount}`
                ).join(' ');
                const searchText = `${o.name} ${o.custom_table || ''} ${itemText}`.toLowerCase();
                return searchText.includes(query);
            })
            .forEach(o => {
                html += `
                    <div class="order-card" style="padding: 16px; background: #f8f9fa; border-radius: 10px; box-shadow: 0 4px 16px 0 rgba(0,0,0,0.07), 0 1.5px 4px 0 rgba(255,193,7,0.10); margin-bottom: 18px; display: flex; flex-direction: column; min-height: 320px;">
                        <div style="text-align: center;" class="order-header">
                            <strong>${o.name}</strong>
                            <div>${o.custom_kot_number || ''}</div>
                            <div>Room: ${o.custom_room || ''} Table: ${o.custom_table || ''}</div>
                            <div class="status-text">${o.status ? o.status.toUpperCase() : ''}</div>
                        </div>
                        <table class="order-table" style="width:100%; border-radius:6px; border:1px solid #e0e0e0; background:#fff; margin:12px 0 8px 0; overflow:hidden; box-shadow:0 1px 2px 0 rgba(0,0,0,0.03);">
                            <thead>
                                <tr style="background:#e9ecef;">
                                    <th style="padding:6px 10px; text-align:left; font-size:13px;">Item</th>
                                    <th class="right" style="padding:6px 10px; text-align:right; font-size:13px;">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${o.items.map((i, idx) => `
                                    <tr style="background:${idx%2===0?'#fff':'#f6f6f6'};">
                                        <td style="padding:6px 10px;">${i.item_name} <br> <strong>${i.custom_notes || ''}</strong></td>
                                        <td class="right" style="padding:6px 10px; text-align:right;">${i.qty}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div class="order-footer" style="margin-top:auto; display:flex; justify-content:center; align-items:end; min-height:48px;">
                            <button class="btn btn-sm btn-primary update-status-btn" data-order="${o.name}">Complete Order</button>
                        </div>
                    </div>
                `;
            });

        this.grid.html(html);
    }

    updateOrderStatus(orderName) {
        frappe.call({
            method: "pos_app.pos_app.page.kitchen_orders.kitchen_orders.update_order_status",
            args: { name: orderName },
            callback: () => {
                this.loadOrders();
                frappe.show_alert("Status updated");
            }
        });
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
}
