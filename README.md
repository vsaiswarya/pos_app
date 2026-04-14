# POS App - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Installation](#installation)
3. [Architecture](#architecture)
4. [Core Features](#core-features)
5. [DocTypes](#doctypes)
6. [Pages](#pages)
7. [API Reference](#api-reference)
8. [Customizations](#customizations)
9. [Hooks & Overrides](#hooks--overrides)
10. [Manufacturing Integration](#manufacturing-integration)
11. [Kitchen Order Management](#kitchen-order-management)
12. [Configuration Guide](#configuration-guide)
13. [Development Guide](#development-guide)

---

## Overview

**POS App** is a comprehensive Frappe/ERPNext application designed to enhance and override the standard ERPNext Point of Sale functionality. It provides advanced restaurant management features including:

- Room and table-based order management
- Kitchen Order Ticket (KOT) printing system
- Real-time kitchen order tracking
- Manufacturing integration for food preparation
- Customer portal for bill viewing
- Multi-printer support with QZ Tray integration
- Enhanced POS closing with denomination tracking
- Restaurant-specific item grouping

### Meta Information
- **App Name**: pos_app
- **Title**: Pos App
- **Publisher**: Richmond
- **License**: MIT
- **Email**: erp@richmondcellar.com
- **Description**: Application to override ERPNext point of sale

---

## Installation

### Prerequisites
- Frappe Framework v15.0 or higher
- ERPNext (matching version)
- Python 3.10 or higher

### Installation Steps

1. **Get the app from repository:**
   ```bash
   cd ~/frappe-bench
   bench get-app pos_app [repository-url]
   ```

2. **Install on site:**
   ```bash
   bench --site [site-name] install-app pos_app
   ```

3. **Run migrations:**
   ```bash
   bench --site [site-name] migrate
   ```

4. **Build assets:**
   ```bash
   bench build --app pos_app
   ```

5. **Restart bench:**
   ```bash
   bench restart
   ```

---

## Architecture

### Directory Structure
```
pos_app/
├── pos_app/
│   ├── config/              # Configuration files
│   │   ├── desktop.py       # Desktop icons
│   │   └── docs.py          # Documentation config
│   ├── fixtures/            # Fixtures for custom fields
│   │   ├── custom_field.json
│   │   └── property_setter.json
│   ├── overrides/           # Override standard ERPNext logic
│   │   ├── pos_invoice.py
│   │   └── pos_closing_entry.py
│   ├── pos_app/             # Module directory
│   │   ├── doctype/         # Custom DocTypes
│   │   │   ├── kot_item_groups/
│   │   │   ├── kot_print/
│   │   │   ├── pos_restaurant_item_groups/
│   │   │   ├── pos_restaurant_item_summary/
│   │   │   ├── pos_room/
│   │   │   └── pos_table/
│   │   ├── page/            # Custom Pages
│   │   │   ├── customer_portal/
│   │   │   └── kitchen_orders/
│   │   └── workspace/       # Workspace definitions
│   ├── public/              # Public assets
│   │   ├── api.py           # Public API methods
│   │   ├── js/              # JavaScript files
│   │   └── dist/            # Built assets
│   ├── templates/           # Jinja templates
│   └── www/                 # Web pages
├── pyproject.toml           # Python project config
├── README.md
└── license.txt
```

---

## Core Features

### 1. **Room & Table Management**
- Organize POS locations by rooms and tables
- Track orders by specific table locations
- Filter past orders by table assignment
- Visual organization of restaurant floor plan

### 2. **Kitchen Order Ticket (KOT) System**
- Automatic KOT number generation: `{ROOM}-{TABLE}-{LAST_5_INVOICE_DIGITS}`
- Multiple printer support for different kitchen stations
- Item group-based printer routing
- Real-time order status tracking (New/Completed)
- KOT printing with QZ Tray integration

### 3. **Manufacturing Integration**
- Automatic BOM (Bill of Materials) validation
- Auto-create Stock Entries for manufactured items
- Stock availability checking with BOM consideration
- Finished goods tracking

### 4. **Enhanced POS Closing**
- Denomination entry support (₹1000, ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, ₹5, ₹1, ₹0.5, ₹0.25)
- Restaurant vs Liquor item segregation in closing summary
- Automatic tax amount calculation per category
- Payment mode reconciliation with denominations

### 5. **Stock Reservation System**
- Reserved quantity tracking for POS orders
- Automatic stock reservation on order creation
- Stock release on invoice submission/cancellation
- Negative stock prevention (configurable)

### 6. **Customer Portal**
- Guest-facing bill viewing interface
- Real-time order status updates
- Bill amount display

### 7. **Kitchen Order Display**
- Live kitchen order dashboard
- Filter orders by kitchen station
- Order completion workflow
- Item notes display for special instructions

---

## DocTypes

### 1. POS Room

**Purpose**: Define restaurant rooms/sections

**Fields:**
- `room_name` (Data, Unique): Name of the room

**Key Features:**
- Auto-naming by room_name
- Allows rename
- List view enabled

**Permissions:**
- System Manager: Full access
- Sales User: Read, Export, Print

**Usage:**
```python
# Create a new room
room = frappe.get_doc({
    "doctype": "POS Room",
    "room_name": "Main Dining Hall"
})
room.insert()
```

---

### 2. POS Table

**Purpose**: Define tables within rooms

**Fields:**
- `table_name` (Data, Unique): Name/number of the table
- `room` (Link to POS Room): Associated room

**Key Features:**
- Auto-naming by table_name
- Linked to POS Room
- Allows rename

**Permissions:**
- System Manager: Full access
- Sales User: Read, Export, Print

**Usage:**
```python
# Create a new table
table = frappe.get_doc({
    "doctype": "POS Table",
    "table_name": "Table-01",
    "room": "Main Dining Hall"
})
table.insert()
```

---

### 3. KOT Print

**Purpose**: Configure KOT printer routing for item groups

**Naming**: Auto-generated as `KOT-.#####`

**Fields:**
- `pos_profile` (Link to POS Profile): Associated POS profile
- `printer_name` (Data): Name of the printer
- `enable` (Check): Enable/disable this KOT printer
- `kot_item_groups` (Table): Child table of item groups

**Child Table: KOT Item Groups**
- `item_group` (Link to Item Group): Item group to print on this printer

**Key Features:**
- Route different item categories to different printers
- Multiple KOT printers per POS profile
- Enable/disable individual printers

**Permissions:**
- System Manager: Full access
- Sales Master Manager, Sales Manager, Sales User: Read access

**Usage:**
```python
# Create KOT printer configuration
kot = frappe.get_doc({
    "doctype": "KOT Print",
    "pos_profile": "Restaurant POS",
    "printer_name": "Kitchen-Main",
    "enable": 1
})
kot.append("kot_item_groups", {
    "item_group": "Main Course"
})
kot.append("kot_item_groups", {
    "item_group": "Appetizers"
})
kot.insert()
```

---

### 4. POS Restaurant Item Groups

**Purpose**: Child table to categorize restaurant-specific items (vs liquor)

**Fields:**
- `item_group` (Link to Item Group): Restaurant item category

**Usage:**
- Used in POS Profile to distinguish restaurant items from liquor
- Affects POS Closing Entry summary calculations
- Used in Purchase Order generation filtering

---

### 5. POS Restaurant Item Summary

**Purpose**: Child table to summarize restaurant vs liquor sales in POS Closing

**Fields:**
- `amount` (Currency): Total amount
- `tax_amount` (Currency): Total tax
- `net_amount` (Currency): Net amount after tax

**Usage:**
- Automatically populated during POS Closing Entry validation
- Separates restaurant and liquor item totals

---

### 6. KOT Item Groups

**Purpose**: Child table linking item groups to KOT printers

**Fields:**
- `item_group` (Link to Item Group): Item group for KOT routing

---

## Pages

### 1. Kitchen Orders Page

**Name**: kitchen-orders  
**Module**: Pos App  
**Title**: Kitchen Orders

**Purpose**: Display real-time kitchen orders that need preparation

**Roles with Access:**
- Sales Master Manager
- Sales Manager
- Sales User

**Features:**
- Filter orders by kitchen station (KOT printer)
- Display orders with "New" KOT status
- Show item details with special notes
- Mark orders as completed
- Real-time order refresh

**API Methods:**
- `get_orders(kitchen)`: Fetch orders for specific kitchen
- `update_order_status(name)`: Mark order as completed

**Workflow:**
1. Kitchen staff opens Kitchen Orders page
2. Selects their kitchen station
3. Views pending orders filtered by item groups
4. Marks orders as completed when prepared

---

### 2. Customer Portal Page

**Name**: customer-portal  
**Module**: Pos App  
**Title**: Biils (sic)

**Purpose**: Guest-facing interface to view bills

**Roles with Access:**
- Sales User
- Sales Manager

**Features:**
- Display current bills/invoices
- Customer-friendly view
- Real-time updates

---

## API Reference

### Public API Methods (`public/api.py`)

#### 1. `get_all_item_groups(pos_profile)`

**Description**: Retrieve item groups split into restaurant (kitchen) and liquor categories

**Parameters:**
- `pos_profile` (string): POS Profile name

**Returns:**
```python
{
    "liqr_groups": ["Whiskey", "Wine", "Beer"],
    "ktchn_groups": ["Main Course", "Appetizers", "Desserts"]
}
```

**Usage:**
```javascript
frappe.call({
    method: "pos_app.public.api.get_all_item_groups",
    args: {
        pos_profile: "Restaurant POS"
    },
    callback: function(r) {
        console.log(r.message);
    }
});
```

---

#### 2. `get_available_tables(room)`

**Description**: Get all tables in a specific room

**Parameters:**
- `room` (string): POS Room name

**Returns:**
```python
[
    {"table_name": "Table-01", "name": "Table-01"},
    {"table_name": "Table-02", "name": "Table-02"}
]
```

---

#### 3. `get_all_rooms()`

**Description**: Get all available rooms

**Returns:**
```python
[
    {"name": "Main Dining Hall"},
    {"name": "Private Dining"}
]
```

---

#### 4. `get_item_uoms(item_code)`

**Description**: Get all UOMs for an item

**Parameters:**
- `item_code` (string): Item code

**Returns:**
```python
[
    {"uom": "Nos"},
    {"uom": "Box"},
    {"uom": "Case"}
]
```

---

#### 5. `submit_pos_invoice(docname)`

**Description**: Submit a POS Invoice and return print settings

**Parameters:**
- `docname` (string): POS Invoice name

**Returns:**
```python
{
    "doc": {...},  # Invoice document as dict
    "print_format": "POS Invoice",
    "qz_siv": 1,  # QZ Tray enabled
    "siv_printer": "Printer-01"
}
```

**Authorization**: Whitelisted

---

#### 6. `submit_pos_closing(denominations)`

**Description**: Create and submit POS Closing Entry with denominations

**Parameters:**
- `denominations` (dict/json): Denomination details
  ```python
  {
      "pos_opening_entry": "POE-00001",
      "posting_date": "2026-02-02",
      "posting_time": "18:00:00",
      "denom_1000": 10,
      "denom_500": 20,
      "denom_100": 50,
      "denom_200": 30,
      "denom_50": 40,
      "denom_20": 100,
      "denom_10": 200,
      "denom_5": 50,
      "denom_1": 100,
      "denom_0.5": 20,
      "denom_0.25": 40,
      "denom_total": 50000,
      "Cash": 50000,
      "Card": 10000
  }
  ```

**Returns**: None (submits POS Closing Entry)

---

#### 7. `make_purchase_order(source_name, target_doc=None, args=None)`

**Description**: Create Purchase Order from Sales Invoice (for restaurant items)

**Parameters:**
- `source_name` (string): Sales Invoice name
- `target_doc` (dict, optional): Target PO document
- `args` (dict, optional): Additional arguments including supplier

**Returns:** Purchase Order document (mapped)

**Business Logic:**
- Filters only restaurant item groups (excludes liquor)
- Applies purchase order rate percentage from POS Profile
- Maps Sales Invoice items to Purchase Order items

---

### Override Methods (`overrides/pos_invoice.py`)

#### 1. `get_stock_availability(item_code, warehouse)`

**Description**: Override ERPNext stock availability check

**Parameters:**
- `item_code` (string): Item code
- `warehouse` (string): Warehouse name

**Returns:**
```python
(available_qty, is_stock_item)
```

**Key Features:**
- Considers POS reserved quantity
- Handles Product Bundles
- Checks allow_negative_stock setting

---

#### 2. `get_past_order_list(search_term, status, pos_profile, table=None, limit=20)`

**Description**: Override to filter past orders by table

**Parameters:**
- `search_term` (string): Customer name or invoice number
- `status` (string): Invoice status (Draft/Paid/Consolidated/Return)
- `pos_profile` (string): POS Profile name
- `table` (string, optional): Table name filter
- `limit` (int): Result limit (default: 20)

**Returns:** List of POS Invoices

---

#### 3. `get_items(start, page_length, price_list, item_group, pos_profile, search_term="")`

**Description**: Override to get items with custom filtering

**Parameters:**
- `start` (int): Pagination start
- `page_length` (int): Results per page (forced to 1000)
- `price_list` (string): Price list name
- `item_group` (string): Item group filter
- `pos_profile` (string): POS Profile name
- `search_term` (string): Search keyword

**Returns:** List of items with details

---

#### 4. `get_kot_data(pos_profile)`

**Description**: Get KOT printer configuration data

**Parameters:**
- `pos_profile` (string): POS Profile name

**Returns:**
```python
[
    {
        "printer_name": "Kitchen-Main",
        "item_groups": ["Main Course", "Appetizers"]
    },
    {
        "printer_name": "Kitchen-Grill",
        "item_groups": ["Grilled Items"]
    }
]
```

---

#### 5. `sign_data(data)`

**Description**: Cryptographically sign data using private key

**Parameters:**
- `data` (string): Data to sign

**Returns:** Base64 encoded signature (string)

**Authorization**: Allow guest

**Usage:** Used for QZ Tray certificate signing

---

### Kitchen Order Methods (`page/kitchen_orders/kitchen_orders.py`)

#### 1. `get_orders(kitchen)`

**Description**: Get pending orders for a specific kitchen station

**Parameters:**
- `kitchen` (string): KOT Print document name

**Returns:**
```python
[
    {
        "name": "POS-INV-00001",
        "custom_room": "Main Hall",
        "custom_table": "Table-01",
        "custom_kot_number": "Main-Table-01-00001",
        "items": [
            {
                "item_code": "ITEM-001",
                "item_name": "Grilled Chicken",
                "qty": 2,
                "custom_notes": "Well done",
                "item_group": "Main Course"
            }
        ]
    }
]
```

**Filters:**
- KOT Status = "New"
- Invoice Status = "Paid"
- DocStatus = 1 (Submitted)
- Manufacturing enabled
- Items belonging to kitchen's item groups

---

#### 2. `update_order_status(name)`

**Description**: Mark order as completed

**Parameters:**
- `name` (string): POS Invoice name

**Returns:** True on success

**Action:** Sets `custom_kot_status` to "Completed"

---

## Customizations

### Custom Fields on POS Invoice

| Field Name | Type | Label | Description |
|------------|------|-------|-------------|
| `custom_room` | Link | Room | Links to POS Room |
| `custom_table` | Link | Table | Links to POS Table |
| `custom_sales_person` | Link | Sales Person | Assigned sales person |
| `custom_kot_number` | Data | KOT Number | Auto-generated KOT identifier |
| `custom_kot_status` | Select | KOT Status | New/Completed |
| `custom_enable_manufacturing` | Check | Enable Manufacturing | Enable BOM processing |

### Custom Fields on POS Invoice Item

| Field Name | Type | Label | Description |
|------------|------|-------|-------------|
| `custom_notes` | Small Text | Notes | Special instructions for item |
| `custom_stock_entry` | Link | Stock Entry | Linked manufacturing stock entry |

### Custom Fields on POS Profile

| Field Name | Type | Label | Description |
|------------|------|-------|-------------|
| `custom_pos_room` | Link | POS Room | Default room |
| `custom_default_table` | Link | Default Table | Default table |
| `custom_pos_restaurant_item_groups` | Table | Restaurant Item Groups | Restaurant category items |
| `custom_enable_siv_print_in_qztray` | Check | Enable SIV Print in QZTray | QZ Tray printing |
| `custom_siv_printer_name` | Data | SIV Printer Name | Printer for invoices |
| `custom_purchase_order_rate_percentage` | Percent | PO Rate Percentage | Discount % for PO |
| `custom_restaurant_item_groups` | Table | Restaurant Item Groups | Same as above |
| `custom_enable_manufacturing` | Check | Enable Manufacturing | Enable BOM |
| `custom_is_video` | Check | Is Video | Enable video display |
| `custom_customer_display_media` | Attach | Customer Display Media | Media file for display |

### Custom Fields on POS Closing Entry

| Field Name | Type | Label | Description |
|------------|------|-------|-------------|
| `custom_1000` | Int | ₹1000 Notes | Count of ₹1000 notes |
| `custom_500` | Int | ₹500 Notes | Count of ₹500 notes |
| `custom_200` | Int | ₹200 Notes | Count of ₹200 notes |
| `custom_100` | Int | ₹100 Notes | Count of ₹100 notes |
| `custom_50` | Int | ₹50 Notes | Count of ₹50 notes |
| `custom_20` | Int | ₹20 Notes | Count of ₹20 notes |
| `custom_10` | Int | ₹10 Notes/Coins | Count of ₹10 |
| `custom_5` | Int | ₹5 Coins | Count of ₹5 coins |
| `custom_1` | Int | ₹1 Coins | Count of ₹1 coins |
| `custom_5_fills` | Int | ₹0.50 Coins | Count of 50 paise |
| `custom_25_fills` | Int | ₹0.25 Coins | Count of 25 paise |
| `custom_total_denominations` | Currency | Total Denominations | Calculated total |
| `custom_restaurant_item_summary` | Table | Restaurant Item Summary | Category-wise summary |

---

## Hooks & Overrides

### Document Events

#### POS Invoice Events

**1. validate**
- Method: `pos_app.overrides.pos_invoice.set_kot_number`
- Action: Generates KOT number if room and table are set
- Format: `{ROOM}-{TABLE}-{LAST_5_INVOICE_DIGITS}`
- Also validates BOM items if manufacturing is enabled

**2. on_submit**
- Methods:
  - `pos_app.overrides.pos_invoice.update_reserved_qty`: Updates bin reserved quantity
  - `pos_app.overrides.pos_invoice.submit_stock_entry`: Submits linked stock entries for manufactured items

**3. on_cancel**
- Method: `pos_app.overrides.pos_invoice.update_reserved_qty_cancel`
- Action: Releases reserved stock quantity

#### Sales Invoice Events

**on_submit**
- Method: `pos_app.overrides.pos_invoice.reverse_reserved_qty`
- Action: Reverse reserved quantities (for non-POS invoices)

#### POS Closing Entry Events

**validate**
- Method: `pos_app.overrides.pos_closing_entry.validate`
- Actions:
  - Calculate restaurant vs liquor item totals
  - Populate restaurant item summary child table
  - Segregate amounts and taxes by category

### Override Whitelisted Methods

| Original Method | Override Method |
|----------------|-----------------|
| `erpnext.accounts.doctype.pos_invoice.pos_invoice.get_stock_availability` | `pos_app.overrides.pos_invoice.get_stock_availability` |
| `erpnext.selling.page.point_of_sale.point_of_sale.get_past_order_list` | `pos_app.overrides.pos_invoice.get_past_order_list` |
| `erpnext.selling.page.point_of_sale.point_of_sale.get_items` | `pos_app.overrides.pos_invoice.get_items` |

### DocType JavaScript Overrides

| DocType | Script Path |
|---------|-------------|
| Sales Invoice | `public/js/sales_invoice.js` |

### App Include JavaScript

- Bundle: `pos_app.bundle.js`

---

## Manufacturing Integration

### Overview
The manufacturing integration allows automatic creation of Stock Entries for items with BOMs (Bill of Materials) when they are ordered in POS.

### Configuration

1. **Enable Manufacturing in POS Profile:**
   - Set `custom_enable_manufacturing` = 1

2. **Set Default BOM for Items:**
   - Go to Item master
   - Set "Default BOM" field

3. **Configure Warehouses:**
   - Set source warehouse in BOM
   - Set target warehouse in POS Profile

### Workflow

#### Order Creation (validate event)
```python
def validate_bom_items(doc):
    for row in doc.items:
        # Check if item has BOM
        bom_item = frappe.db.get_value("Item", row.item_code, "default_bom")
        
        if bom_item:
            # Check current stock
            stock_qty = get_item_stock_availability(row.item_code, row.warehouse)[0]
            
            # If insufficient stock, create Stock Entry
            if stock_qty < row.qty and not row.custom_stock_entry:
                se = create_stock_entry(row.item_code, row.qty - stock_qty, 
                                        row.warehouse, bom_item)
                row.custom_stock_entry = se
```

#### Stock Entry Creation
```python
def create_stock_entry(item_code, qty, warehouse, bom_item, stock_entry=None):
    se = frappe.new_doc("Stock Entry") if not stock_entry else frappe.get_doc("Stock Entry", stock_entry)
    
    se.stock_entry_type = "Manufacture"
    se.from_bom = True
    se.from_warehouse = warehouse
    se.bom_no = bom_item
    se.fg_completed_qty = qty
    se.get_items()  # Fetch raw materials from BOM
    
    se.append("items", {
        "item_code": item_code,
        "qty": qty,
        "is_finished_item": 1,
        "t_warehouse": warehouse
    })
    
    se.save()
    return se.name
```

#### Invoice Submission (on_submit event)
```python
def submit_stock_entry(doc, method):
    for row in doc.items:
        if row.custom_stock_entry:
            se = frappe.get_doc("Stock Entry", row.custom_stock_entry)
            se.submit()
```

### Stock Entry Details

**Type:** Manufacture  
**Purpose:** Transform raw materials to finished goods

**Fields Populated:**
- BOM No: From item's default BOM
- FG Completed Qty: Required quantity
- From BOM: Checked
- From Warehouse: Source warehouse
- Items: Raw materials (from BOM) + Finished item

### Benefits

1. **Automatic Stock Management**: No manual stock entry creation
2. **Real-time Stock Updates**: Stock levels updated immediately
3. **BOM Compliance**: Ensures proper raw material consumption
4. **Audit Trail**: Links POS Invoice Item to Stock Entry

---

## Kitchen Order Management

### System Flow

```
1. Order Placed in POS
   ↓
2. Invoice Submitted with Room & Table
   ↓
3. KOT Number Generated: {ROOM}-{TABLE}-{INV_NO}
   ↓
4. KOT Status Set to "New"
   ↓
5. Order Appears in Kitchen Orders Page
   ↓
6. Kitchen Staff Views Order (filtered by item groups)
   ↓
7. Order Prepared
   ↓
8. Kitchen Staff Marks as "Completed"
   ↓
9. Order Removed from Kitchen Orders Display
```

### KOT Printing Configuration

#### Setup Steps

1. **Create KOT Print records:**
   ```python
   # Kitchen Main - for main course items
   kot1 = frappe.get_doc({
       "doctype": "KOT Print",
       "pos_profile": "Restaurant POS",
       "printer_name": "Kitchen-Main",
       "enable": 1
   })
   kot1.append("kot_item_groups", {"item_group": "Main Course"})
   kot1.append("kot_item_groups", {"item_group": "Rice Items"})
   kot1.insert()
   
   # Kitchen Grill - for grilled items
   kot2 = frappe.get_doc({
       "doctype": "KOT Print",
       "pos_profile": "Restaurant POS",
       "printer_name": "Kitchen-Grill",
       "enable": 1
   })
   kot2.append("kot_item_groups", {"item_group": "Grilled Items"})
   kot2.insert()
   ```

2. **Configure QZ Tray (Optional):**
   - Enable `custom_enable_siv_print_in_qztray` in POS Profile
   - Set `custom_siv_printer_name`
   - QZ Tray will use signed certificates for printing

### Kitchen Orders Page Usage

#### For Kitchen Staff

1. **Open Kitchen Orders Page**
   - Navigate to: Desk → Pos App → Kitchen Orders

2. **Select Kitchen Station**
   - Choose from dropdown (based on KOT Print records)

3. **View Orders**
   - Orders are filtered by item groups assigned to selected kitchen
   - Display shows:
     - KOT Number
     - Room and Table
     - Item list with quantities
     - Special notes for each item

4. **Mark as Complete**
   - Click "Complete" button on order
   - Order status changes to "Completed"
   - Order disappears from display

#### API Integration

**JavaScript Example:**
```javascript
// Fetch orders for a kitchen
frappe.call({
    method: "pos_app.pos_app.page.kitchen_orders.kitchen_orders.get_orders",
    args: {
        kitchen: "KOT-00001"
    },
    callback: function(r) {
        let orders = r.message;
        // Display orders in UI
        orders.forEach(order => {
            console.log(`KOT: ${order.custom_kot_number}`);
            order.items.forEach(item => {
                console.log(`- ${item.item_name} x ${item.qty}`);
                if (item.custom_notes) {
                    console.log(`  Note: ${item.custom_notes}`);
                }
            });
        });
    }
});

// Mark order as completed
frappe.call({
    method: "pos_app.pos_app.page.kitchen_orders.kitchen_orders.update_order_status",
    args: {
        name: "POS-INV-00001"
    },
    callback: function(r) {
        frappe.show_alert("Order completed!");
    }
});
```

---

## Configuration Guide

### Initial Setup

#### 1. Configure POS Profile

```
Go to: POS Profile → [Your Profile]

Basic Settings:
- Warehouse: [Select warehouse]
- Company: [Your company]

POS App Settings:
- Custom POS Room: [Default room]
- Custom Default Table: [Default table]
- Custom Enable Manufacturing: ✓ (if using BOM)
- Custom Purchase Order Rate Percentage: [e.g., 10]

Printing Settings:
- Custom Enable SIV Print in QZTray: ✓ (if using QZ Tray)
- Custom SIV Printer Name: [Printer name]
- Print Format: [Your print format]

Item Groups:
- Add restaurant item groups in "Custom Restaurant Item Groups" table
```

#### 2. Setup Rooms and Tables

```python
# Create rooms
rooms = ["Main Dining", "Private Dining", "Bar Area"]
for room in rooms:
    frappe.get_doc({
        "doctype": "POS Room",
        "room_name": room
    }).insert()

# Create tables
tables = [
    {"table": "Table-01", "room": "Main Dining"},
    {"table": "Table-02", "room": "Main Dining"},
    {"table": "VIP-01", "room": "Private Dining"}
]
for t in tables:
    frappe.get_doc({
        "doctype": "POS Table",
        "table_name": t["table"],
        "room": t["room"]
    }).insert()
```

#### 3. Configure KOT Printers

```
Go to: POS App → KOT Print → New

Settings:
- POS Profile: [Select profile]
- Printer Name: Kitchen-Main
- Enable: ✓

KOT Item Groups:
- Add item groups that should print to this kitchen
- Examples: Main Course, Rice Items, Noodles
```

#### 4. Configure Item Groups

```
Restaurant Items (Kitchen):
- Main Course
- Appetizers
- Rice Items
- Desserts

Liquor Items (Bar):
- Whiskey
- Vodka
- Beer
- Wine
```

Add restaurant items to POS Profile → Custom Restaurant Item Groups

### User Permissions

#### POS User
- Read/Write: POS Invoice, Sales Invoice
- Read: POS Room, POS Table, Item, Customer

#### Kitchen User
- Read: POS Invoice, KOT Print
- Access: Kitchen Orders Page
- Can mark orders as completed

#### Manager
- Full access to all doctypes
- Can configure KOT Print
- Can setup rooms and tables

---

## Development Guide

### Adding New Features

#### Custom Field Addition

**Example: Add "Chef Name" to POS Invoice**

1. **Add to fixtures in hooks.py:**
```python
fixtures = [
    {
        "dt": "Custom Field",
        "filters": [
            ["name", "in", [
                "POS Invoice-custom_chef_name",  # Add this line
                # ... existing fields
            ]]
        ]
    }
]
```

2. **Create custom field:**
```python
frappe.get_doc({
    "doctype": "Custom Field",
    "dt": "POS Invoice",
    "fieldname": "custom_chef_name",
    "label": "Chef Name",
    "fieldtype": "Data",
    "insert_after": "custom_kot_number"
}).insert()
```

3. **Export fixture:**
```bash
bench --site [site-name] export-fixtures
```

#### Adding New API Method

**Example: Get orders by chef**

1. **Add method to public/api.py:**
```python
@frappe.whitelist()
def get_orders_by_chef(chef_name):
    """Get orders assigned to a specific chef"""
    orders = frappe.get_all(
        "POS Invoice",
        filters={"custom_chef_name": chef_name, "custom_kot_status": "New"},
        fields=["name", "customer", "grand_total", "custom_kot_number"]
    )
    return orders
```

2. **Call from client:**
```javascript
frappe.call({
    method: "pos_app.public.api.get_orders_by_chef",
    args: {
        chef_name: "John Doe"
    },
    callback: function(r) {
        console.log(r.message);
    }
});
```

#### Override ERPNext Method

**Example: Customize item search**

1. **Add override method in overrides/pos_invoice.py:**
```python
@frappe.whitelist()
def custom_search_items(search_term, warehouse):
    # Your custom logic
    return items
```

2. **Register in hooks.py:**
```python
override_whitelisted_methods = {
    "erpnext.path.to.original.method": "pos_app.overrides.pos_invoice.custom_search_items"
}
```

### Testing

#### Unit Tests

Create test files in doctype folders:

```python
# pos_app/pos_app/doctype/pos_room/test_pos_room.py
import frappe
import unittest

class TestPOSRoom(unittest.TestCase):
    def test_room_creation(self):
        room = frappe.get_doc({
            "doctype": "POS Room",
            "room_name": "Test Room"
        })
        room.insert()
        
        self.assertTrue(frappe.db.exists("POS Room", "Test Room"))
        
        # Cleanup
        frappe.delete_doc("POS Room", "Test Room")
```

#### Integration Tests

Test complete workflows:

```python
def test_kot_workflow(self):
    # Create invoice
    invoice = create_test_pos_invoice()
    
    # Verify KOT number generated
    self.assertIsNotNone(invoice.custom_kot_number)
    
    # Check KOT status
    self.assertEqual(invoice.custom_kot_status, "New")
    
    # Update status
    update_order_status(invoice.name)
    
    # Verify completed
    invoice.reload()
    self.assertEqual(invoice.custom_kot_status, "Completed")
```

### Build & Deployment

#### Development

```bash
# Watch for changes
bench watch

# Build assets
bench build --app pos_app

# Restart
bench restart
```

#### Production

```bash
# Build for production
bench build --app pos_app --production

# Clear cache
bench --site [site-name] clear-cache

# Migrate
bench --site [site-name] migrate

# Restart
sudo supervisorctl restart all
```

### Debugging

#### Enable Developer Mode

```bash
bench --site [site-name] set-config developer_mode 1
bench --site [site-name] clear-cache
```

#### Server-side Debugging

```python
# Add to your method
frappe.log_error(title="Debug Info", message=frappe.as_json(data))

# Or use print (visible in bench console)
print("Debug:", data)
```

#### Client-side Debugging

```javascript
// Console logging
console.log("Data:", data);

// Frappe alerts
frappe.show_alert({
    message: "Debug: " + JSON.stringify(data),
    indicator: "blue"
});

// Msgprint for detailed info
frappe.msgprint({
    title: "Debug Info",
    message: JSON.stringify(data, null, 2)
});
```

---

## Troubleshooting

### Common Issues

#### 1. KOT Number Not Generated

**Symptoms:** `custom_kot_number` is empty

**Solution:**
- Ensure Room and Table are set on POS Invoice
- Check if `set_kot_number` hook is properly configured
- Verify manufacturing is enabled if required

#### 2. Orders Not Showing in Kitchen Orders

**Symptoms:** Kitchen Orders page is empty

**Checks:**
- Invoice status must be "Paid"
- DocStatus must be 1 (Submitted)
- KOT Status must be "New"
- Manufacturing must be enabled
- Items must belong to kitchen's item groups

**Debug:**
```python
# Check order details
doc = frappe.get_doc("POS Invoice", "POS-INV-00001")
print("Status:", doc.status)
print("KOT Status:", doc.custom_kot_status)
print("Manufacturing:", doc.custom_enable_manufacturing)

# Check item groups
for item in doc.items:
    print(f"Item: {item.item_code}, Group: {item.item_group}")
```

#### 3. Stock Entry Not Created for Manufacturing

**Symptoms:** Items with BOM not triggering Stock Entry

**Solution:**
- Verify item has `default_bom` set
- Check `custom_enable_manufacturing` in POS Profile
- Ensure warehouse is set
- Verify BOM is active and has items

#### 4. POS Closing Summary Not Showing Restaurant/Liquor Split

**Symptoms:** `custom_restaurant_item_summary` table is empty

**Solution:**
- Add restaurant item groups to POS Profile
- Ensure items are categorized correctly
- Check validate hook is running

#### 5. QZ Tray Printing Issues

**Symptoms:** Invoices not printing via QZ Tray

**Checks:**
- QZ Tray application is running
- Certificate is valid and signed
- Printer name matches exactly
- `custom_enable_siv_print_in_qztray` is checked

**Generate new certificate:**
```bash
# Generate private key
openssl genrsa -out private-key.pem 2048

# Generate certificate
openssl req -new -x509 -key private-key.pem -out certificate.pem -days 365
```

---

## Performance Optimization

### Database Indexes

Key fields to index for better performance:

```sql
-- POS Invoice indexes
ALTER TABLE `tabPOS Invoice` ADD INDEX idx_kot_status (`custom_kot_status`);
ALTER TABLE `tabPOS Invoice` ADD INDEX idx_room_table (`custom_room`, `custom_table`);
ALTER TABLE `tabPOS Invoice` ADD INDEX idx_manufacturing (`custom_enable_manufacturing`);

-- POS Table indexes
ALTER TABLE `tabPOS Table` ADD INDEX idx_room (`room`);
```

### Query Optimization

**Bad:**
```python
# Fetches all invoices, then filters
invoices = frappe.get_all("POS Invoice")
filtered = [i for i in invoices if i.custom_kot_status == "New"]
```

**Good:**
```python
# Filters at database level
invoices = frappe.get_all("POS Invoice", 
                          filters={"custom_kot_status": "New"})
```

### Caching

Cache frequently accessed data:

```python
# Cache item groups for 1 hour
@frappe.whitelist()
def get_all_item_groups(pos_profile):
    cache_key = f"item_groups_{pos_profile}"
    result = frappe.cache().get_value(cache_key)
    
    if not result:
        # Fetch from database
        result = {
            "liqr_groups": [...],
            "ktchn_groups": [...]
        }
        frappe.cache().set_value(cache_key, result, expires_in_sec=3600)
    
    return result
```

---

## Security Considerations

### Permissions

- Always check permissions in whitelisted methods
- Use `ignore_permissions=True` carefully
- Validate user roles before sensitive operations

### Data Validation

```python
@frappe.whitelist()
def update_order_status(name):
    # Validate input
    if not frappe.db.exists("POS Invoice", name):
        frappe.throw("Invalid invoice")
    
    # Check permissions
    if not frappe.has_permission("POS Invoice", "write", name):
        frappe.throw("Insufficient permissions")
    
    # Update
    doc = frappe.get_doc("POS Invoice", name)
    doc.custom_kot_status = "Completed"
    doc.save()
```

### API Security

- Use authentication for sensitive endpoints
- Avoid exposing internal IDs
- Sanitize user input
- Rate limit API calls

---

## Changelog & Version History

### Version 1.0.0 (Latest)
- Initial release
- Room and table management
- KOT printing system
- Kitchen order tracking
- Manufacturing integration
- Enhanced POS closing with denominations
- Customer portal
- QZ Tray integration
- Restaurant vs liquor segregation

---

## Support & Contributing

### Getting Help

1. **Documentation**: Review this documentation thoroughly
2. **Frappe Forum**: Post questions at discuss.frappe.io
3. **GitHub Issues**: Report bugs on GitHub repository

### Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`
5. Create Pull Request

### Code Style

- Follow PEP 8 for Python code
- Use ESLint for JavaScript
- Add docstrings to all methods
- Write unit tests for new features

---

## License

MIT License - See license.txt for details

---

## Contact

**Publisher:** Richmond  
**Email:** erp@richmondcellar.com  
**App Name:** pos_app  
**Version:** 1.0.0

---

**Last Updated:** February 2, 2026  
**Documentation Version:** 1.0.0
