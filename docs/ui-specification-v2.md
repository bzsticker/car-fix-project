# User Interface (UI) Specification V2

This document contains the production-grade UI Specification V2 for the **Den Modify Management System**. It aligns all visual components and layouts with the premium, high-performance **Den Modify brand identity**, utilizing a stealthy, sports-car-inspired color scheme.

---

## 1. Brand Identity & Design Tokens

### 1.1 Color Palette
- **Background (Stealth Matte Black)**: `#0B0B0B` (HSL `0 0% 4%`)
  - Deep matte black that minimizes screen glare in workshop environments and evokes high-end carbon fiber and matte automotive finishes.
- **Surface / Card (Deep Charcoal)**: `#111111` (HSL `0 0% 7%`)
  - Translucent surfaces with fine `#222222` borders to establish clean division of information.
- **Primary (Den Modify Red)**: `#C40000` (HSL `0 100% 38%`)
  - High-intensity crimson used exclusively for call-to-actions, active navigation highlights, and primary gauge needles. Reminiscent of a luxury sports car's redline tachometer.
- **Success (Forest Emerald)**: `#16A34A` (HSL `142 72% 36%`)
  - Used for paid invoices, completed jobs, and verified attendance.
- **Warning (Aggressive Amber)**: `#F59E0B` (HSL `38 92% 50%`)
  - Used for reorder stock alerts, late clock-ins, and pending claims.
- **Text**:
  - `Primary`: `#FFFFFF` (HSL `0 0% 100%`) - Crisp pure white.
  - `Muted`: `#888888` (HSL `0 0% 53%`) - Mid-tone gray for metadata.

### 1.2 Typography & Elements
- **Headers**: Google Font **Outfit** (Wide, geometric, bold, masculine automotive feel).
- **Body**: Google Font **Inter** (Ultra-sharp, high readability).
- **Interactions**: Red outlines glow on element focus (`focus:ring-2 focus:ring-brand-red`). Micro-shadow transitions on hover (`hover:shadow-red-700/5`).

---

## 2. Roster of UI Screens & Layouts

Below is the complete blueprint for all 14 screens in the system.

---

### 2.1 Owner Dashboard (Global Overview)
Provides the company Owner with cross-branch performance insights and financial tracking.
- **Features**: Cross-branch revenue totals, comparative branch analytics, and real-time clocked staff roster.

#### ASCII Wireframe: Owner Dashboard
```
=====================================================================================
[DEN MODIFY] GLOBAL HQ BOARD                                         [ Kittisak Owner ]
=====================================================================================
+----------------------+ +----------------------+ +----------------------+
| GLOBAL REVENUE (MTD) | | TOTAL JOBS (MTD)     | | STOCK ALERTS         |
| 385,450.00 THB       | | 42 Completed Jobs    | | 3 Low Stock Items    |
| [==================] | | (BKK: 28 | PT: 14)   | | [ View Warnings ]    |
+----------------------+ +----------------------+ +----------------------+

+-----------------------------------------------------------------------------------+
| COMPARATIVE REVENUE (Bangkok vs Pathum Thani)                                      |
| Bangkok [============================================] 260,000.00 THB             |
| Pathum  [====================] 125,450.00 THB                                     |
+-----------------------------------------------------------------------------------+

+------------------------------------------+ +--------------------------------------+
| EMPLOYEE SHIFT TRACKER                   | | MASTER STOCK ALERTS                  |
| * Prasert Wrapmaster  - BKK [Selfie] [Map] | | [!] AKRAP-EVO - BKK (Stock: 0/1)    |
| * Wichita Carbon      - BKK [Selfie] [Map] | | [!] WRAP-3M-SATIN - PT (Stock: 1/2)  |
| * Nattapong Tuner     - PT  [Selfie] [Map] | |                                    |
+------------------------------------------+ +--------------------------------------+
```

---

### 2.2 Admin Dashboard (Branch Operations)
Central workflow manager for branch admins.
- **Features**: Kanban board of active jobs, booking calendar, and quick links to POS/Invoicing.

#### ASCII Wireframe: Admin Dashboard
```
=====================================================================================
[DEN MODIFY] BANGKOK HQ CONTROL                                      [ Somchai Admin ]
=====================================================================================
+---------------------------+ +--------------------------+ +-------------------------+
| ACTIVE JOBS SCHEDULED: 4  | | IN-PROGRESS JOBS: 2      | | PENDING APPOINTMENTS: 2 |
+---------------------------+ +--------------------------+ +-------------------------+

[+] New Job Ticket   [+] New Appointment   [+] Launch POS Checkout

KANBAN PIPELINE:
+-------------------+ +-------------------+ +-------------------+ +-------------------+
| SCHEDULED         | | IN PROGRESS       | | QUALITY CONTROL   | | READY FOR PICKUP  |
+-------------------+ +-------------------+ +-------------------+ +-------------------+
| [Civic Type R]    | | [GR Yaris]        | | (Empty)           | | [BMW M4]          |
| Plate: กข 9999    | | Plate: รล 8888    | |                   | | Plate: ญญ 7777    |
| Time: 10:00 AM    | | Team: Tech1, Tech2| |                   | | [Create Invoice]  |
| [Assign Team]     | | [View Timeline]   | |                   | |                   |
+-------------------+ +-------------------+ +-------------------+ +-------------------+
```

---

### 2.3 Technician Dashboard (Mobile Workboard)
Mobile-optimized view for šhop floor technicians.
- **Features**: Camera-triggered clock-in, job task checklists, and parts allocation reports.

#### ASCII Wireframe: Technician Mobile Screen
```
+-----------------------------------+
| [DEN MODIFY] Prasert Wrapmaster   |
+-----------------------------------+
| [ CLOCK OUT ] - Bangkok HQ Branch |
+-----------------------------------+
| ASSIGNED VEHICLE:                 |
| > Honda Civic Type R [Plate: 9999]|
|                                   |
|   Active Service Checklist:       |
|   [x] Clean surfaces & trim removal|
|   [/] Install 3M Satin Black wrap |
|   [ ] Heat seal edges (90C audit) |
|                                   |
|   Parts Consumption Checklist:    |
|   * 3M Satin Black Roll [Qty: 1]  |
|   [ + Scan Barcode / Add Part ]   |
|                                   |
|   Camera Progress:                |
|   [ CAMERA: Take Progress Photo ] |
+-----------------------------------+
```

---

### 2.4 Customer Progress Portal (LINE OA WebView)
Opened from customer's LINE app to view modification updates.
- **Features**: Radial progress chart, live timeline carousels, quotation viewer, and warranty countdown gauges.

#### ASCII Wireframe: Customer WebView
```
+-----------------------------------+
|      DEN MODIFY LIVE PORTAL       |
+-----------------------------------+
| HELLO, APINAN SPEEDSTER           |
| Honda Civic Type R [Plate: กข 9999]|
+-----------------------------------+
|                                   |
|             ( 75% )               |
|          INSTALLATION             |
|     Applying Satin Black Wrap     |
|                                   |
+-----------------------------------+
| LIVE PROGRESS PHOTO HIGHLIGHTS    |
|  [Before Lip] < [Wrapping Hood] > |
+-----------------------------------+
| ACTIVE WARRANTY                   |
| Code: WRY-3MBLK-FL5-8821          |
| [====================] 35m left   |
+-----------------------------------+
```

---

### 2.5 POS Dashboard [NEW]
Retail operations overview for the branch cashiers.
- **Features**: Register status, daily sales, cashier name, and shift reports.

#### ASCII Wireframe: POS Dashboard
```
=====================================================================================
[DEN MODIFY] POS SYSTEM - BANGKOK HQ                                 [ Somchai Cashier ]
=====================================================================================
+----------------------+ +----------------------+ +----------------------+
| TODAY'S SALES VALUE  | | TRANSACTION COUNT    | | ACTIVE REGISTER      |
| 32,500.00 THB        | | 8 Checkouts          | | Reg #1 - Open        |
+----------------------+ +----------------------+ +----------------------+

[ >>> LAUNCH CHECKOUT TERMINAL <<< ]

RECENT TRANSACTIONS:
+---------------------+-------------------+-----------------+------------------------+
| Sales Number        | Customer          | Total Amount    | Payment Method         |
+---------------------+-------------------+-----------------+------------------------+
| POS-20260601-0004   | Apinan Speedster  | 4,815.00 THB    | Bank Transfer (Verified)|
| POS-20260601-0003   | Guest Walk-in     | 1,200.00 THB    | Cash                   |
| POS-20260601-0002   | Sompot Carbon     | 24,000.00 THB   | Credit Card            |
+---------------------+-------------------+-----------------+------------------------+
```

---

### 2.6 POS Checkout Terminal [NEW]
The checkout interface for ringing up parts, accessories, or detailing packages.
- **Features**: Live scan box, itemized shopping cart, customer link, discount codes, and payment methods.

#### ASCII Wireframe: POS Checkout Terminal
```
=====================================================================================
POS CHECKOUT                                                        [ Somchai Cashier ]
=====================================================================================
+------------------------------------------+ +--------------------------------------+
| SHOPPING CART                            | | CHECKOUT SUMMARY                     |
|                                          | |                                      |
| 1. WRAP-3M-SATINBLK [Qty: 1]             | | Customer: Apinan Speedster [Search]  |
|    Retail: 28,000.00 THB                 | | Invoice Link: INV-20260601-0001      |
|                                          | |                                      |
| 2. CERM-GYON-Q2M    [Qty: 1]             | | Subtotal:        32,500.00 THB       |
|    Retail: 4,500.00 THB                  | | VAT (7%):         2,275.00 THB       |
|                                          | | Discount:             0.00 THB       |
|                                          | | Total Due:       34,775.00 THB       |
|                                          | +--------------------------------------+
|                                          | | PAYMENT METHOD:                      |
|                                          | | [ CASH ]  [ CARD ]  [* BANK TRANSFER] |
|                                          | | Ref Code: TXN-KPLUS-9823412          |
| [ BARCODE SCANNER ENTRY: 8850123456789 ] | |                                      |
| [ + Search Catalog ]                     | | [ >>> COMPLETE TRANSACTION <<< ]     |
+------------------------------------------+ +--------------------------------------+
```

---

### 2.7 Inventory Dashboard [NEW]
Branch stock management hub.
- **Features**: Low-stock alert cards, branch transfer selectors, and catalog adjustments.

#### ASCII Wireframe: Inventory Dashboard
```
=====================================================================================
INVENTORY MANAGER - BANGKOK HQ                                       [ Somchai Admin ]
=====================================================================================
+--------------------+ +--------------------+ +--------------------+
| TOTAL ITEMS STOCKED| | LOW STOCK WARN     | | PENDING TRANSFERS  |
| 42 unique SKUs     | | 1 Alert Triggered  | | 1 Incoming Request |
+--------------------+ +--------------------+ +--------------------+

[+] Add Product to Catalog    [>>> Initiate Branch Transfer]

BRANCH STOCK GRID:
+-------------------+-----------------+-------------+----------------+---------------+
| Product Code (SKU)| Product Name    | Category    | Qty in Stock   | Status        |
+-------------------+-----------------+-------------+----------------+---------------+
| WRAP-3M-SATINBLK  | 3M Satin Wrap   | wraps       | 5 Rolls        | Good          |
| CERM-GYON-Q2M     | Gyeon Q2 Coating| coatings    | 15 Bottles     | Good          |
| EXH-AKRAP-EVO     | Akrapovic FL5   | exhausts    | 0 Units [!]    | OUT OF STOCK  |
+-------------------+-----------------+-------------+----------------+---------------+
```

---

### 2.8 Product Detail Screen [NEW]
Inspects specific catalog products, cost margins, and inventories across branches.
- **Features**: Product metadata, barcode, pricing sheets, and multi-branch stock levels.

#### ASCII Wireframe: Product Detail Screen
```
=====================================================================================
PRODUCT METADATA: WRAP-3M-SATINBLK                                   [ Somchai Admin ]
=====================================================================================
[ Back to Catalog ]                                                  [Edit Product]

+------------------------------------------+ +--------------------------------------+
| GENERAL SPECIFICATIONS                   | | STOCK LEVELS BY LOCATION             |
|                                          | |                                      |
| SKU: WRAP-3M-SATINBLK                    | | Bangkok HQ Branch:                   |
| Barcode: 8850123456789                   | | [|||||     ] 5 Rolls (Min: 2)        |
| Name: 3M Satin Black Vinyl Wrap Roll     | |                                      |
| Cat: wraps                               | | Pathum Thani Branch:                 |
|                                          | | [|         ] 1 Roll (Min: 2) [!]     |
| Cost Price:   18,000.00 THB              | |                                      |
| Retail Price: 28,000.00 THB              | |                                      |
| Gross Margin: 35.7% (10,000.00 THB)      | | [ Request Transfer from Bangkok ]    |
+------------------------------------------+ +--------------------------------------+
```

---

### 2.9 Stock Movement Ledger [NEW]
Historical changes audit database for parts.
- **Features**: Immutable transaction timeline, filters by branch/SKU, and creation details.

#### ASCII Wireframe: Stock Movement Ledger
```
=====================================================================================
STOCK TRANSIT & CONSUMPTION AUDIT                                    [ Somchai Admin ]
=====================================================================================
Filters: [ All Branches v ] [ All SKUs v ] [ All Movement Types v ]  [ Export CSV ]

IMMUTABLE AUDIT TRAIL:
+---------------------+------------------+--------+---------+------------------------+
| Timestamp           | Product SKU      | Change | Type    | Authorized By / Notes  |
+---------------------+------------------+--------+---------+------------------------+
| 2026-06-01 17:30:19 | WRAP-3M-SATINBLK | -1     | Job Cons| Tech Prasert (Job-1111)|
| 2026-06-01 10:15:00 | CERM-GYON-Q2M    | -1     | POS Sale| Cashier Somchai (POS-1)|
| 2026-05-30 08:00:00 | EXH-AKRAP-EVO    | +2     | Stock In| Admin Somchai (PO-928) |
+---------------------+------------------+--------+---------+------------------------+
```

---

### 2.10 Inventory Branch Transfer Sheet [NEW]
Spec to coordinate stock shipments from Bangkok HQ to the Pathum Thani branch.
- **Features**: Transfer ticket, source/destination branches, product picker, and status milestones.

#### ASCII Wireframe: Branch Transfer Sheet
```
=====================================================================================
INVENTORY TRANSFER TICKET #XFR-20260601-0002                         [ Somchai Admin ]
=====================================================================================
Status: [* IN TRANSIT ] (Authorized by: Kittisak Owner on 2026-06-01)

+-----------------------------------------------------------------------------------+
| ROUTING DETAILS                                                                   |
| Source Branch:      Bangkok HQ Branch                                             |
| Destination Branch: Pathum Thani Branch                                           |
+-----------------------------------------------------------------------------------+
| ITEMS LIST                                                                        |
| 1. CERM-GYON-Q2M  - Gyeon Ceramic Shield   [Qty: 3 Bottles]                       |
| 2. WRAP-3M-SATINBLK - 3M Satin Black Roll  [Qty: 1 Roll]                          |
+-----------------------------------------------------------------------------------+
| TRACKING MILESTONES                                                               |
| [x] Draft Created -> [x] Approved by Owner -> [/] In Transit -> [ ] Received      |
|                                                                                   |
| [ >>> RECEIVE SHIPMENT (Confirm Quantities & Update Local Stock) <<< ]             |
+-----------------------------------------------------------------------------------+
```

---

### 2.11 Invoice Detail View [NEW]
Comprehensive digital and printable receipt.
- **Features**: Tax invoice details, customer profiles, discount summaries, and print buttons.

#### ASCII Wireframe: Invoice Detail View
```
=====================================================================================
TAX INVOICE / RECEIPT: INV-20260601-0001                             [ Somchai Admin ]
=====================================================================================
[ Back to List ]            [ PDF Export ]            [ PRINT INVOICE ]

+-----------------------------------------------------------------------------------+
| DEN MODIFY - BANGKOK HQ                                                           |
| 123 Srinakarin Rd, Nong Bon, Prawet, Bangkok 10250                                |
+-----------------------------------------------------------------------------------+
| BILLED TO: Apinan Speedster (+6681-555-0199)                                      |
| VEHICLE:   Honda Civic Type R (กข 9999 กรุงเทพมหานคร)                             |
+-----------------------------------------------------------------------------------+
| ITEMS LIST                                                                        |
| 1. Full Body Satin Black Wrap Service           1 Unit            28,000.00 THB   |
| 2. Full Body Wrap Labor Fee                     1 Unit            15,000.00 THB   |
+-----------------------------------------------------------------------------------+
| Subtotal:        43,000.00 THB       Invoice Status: PAID (Bank Transfer)         |
| VAT (7%):         3,010.00 THB       Transaction Reference: TXN-KPLUS-9823412     |
| Discount:             0.00 THB       Due Date:              2026-06-08            |
| TOTAL PAID:      46,010.00 THB       Authorized Stamp:      [ DEN MODIFY SEAL ]   |
+-----------------------------------------------------------------------------------+
```

---

### 2.12 Warranty Certificates Database [NEW]
Displays all active warranties issued to cars.
- **Features**: Searchable filter options, status, code, and links to claim tickets.

#### ASCII Wireframe: Warranty Certificates Database
```
=====================================================================================
WARRANTY CERTIFICATES LEDGER                                         [ Somchai Admin ]
=====================================================================================
Filters: [ Search Code, Car, Phone ]   [ All Statuses v ]   [ All Categories v ]

ACTIVE CERTIFICATES:
+---------------------+-------------------+---------------+------------+------------+
| Warranty Code       | Customer          | Vehicle       | End Date   | Status     |
+---------------------+-------------------+---------------+------------+------------+
| WRY-3MBLK-FL5-8821  | Apinan Speedster  | Civic Type R  | 2029-06-01 | Active     |
| WRY-GYON-GRY-9912   | Chaiwat Drifter   | GR Yaris      | 2028-06-01 | Active     |
| WRY-AKRAP-M4-0012   | Somchai M-Power   | BMW M4        | 2027-06-01 | Expired    |
+---------------------+-------------------+---------------+------------+------------+
```

---

### 2.13 Warranty Claim Detail Panel [NEW]
Processes claims lodged under active warranties (e.g. bubbles in wrapping).
- **Features**: Claim logs, damage photos uploaded by chasers, resolution notes, and approvals.

#### ASCII Wireframe: Warranty Claim Detail Panel
```
=====================================================================================
WARRANTY CLAIM TICKET #CLM-20260601-0004                             [ Somchai Admin ]
=====================================================================================
Status: [/ PENDING REVIEW ]

+-----------------------------------------------------------------------------------+
| WARRANTY BASIS                                                                    |
| Code: WRY-3MBLK-FL5-8821 | Customer: Apinan Speedster | Vehicle: Civic Type R     |
+-----------------------------------------------------------------------------------+
| DEFECT DESCRIPTION & PHOTO EVIDENCE                                               |
| Defect reported: Wrap edge on passenger side rear spoiler lifting.                |
| Damage Photo: [ https://supabase.co/.../claims/defect1.jpg ]                      |
+-----------------------------------------------------------------------------------+
| RESOLUTION PANEL                                                                  |
| Assigned Technician: Prasert Wrapmaster                                           |
| Resolution Notes:    [ Cleaned dirt, applied heat seal adhesive.               ]  |
|                                                                                   |
| [ >>> APPROVE CLAIM & AUTHORIZE SERVICE WORKFLOW <<< ]  [ REJECT CLAIM ]          |
+-----------------------------------------------------------------------------------+
```

---

### 2.14 Attendance Dashboard [NEW]
HR dashboard for managers and owners to verify staff time sheets.
- **Features**: Shift clock registers, GPS coordinates validation, and selfie verification.

#### ASCII Wireframe: Attendance Dashboard
```
=====================================================================================
SHIFT CLOCK REGISTRY - BANGKOK HQ                                    [ Somchai Admin ]
=====================================================================================
Date: 2026-06-01                     [ Export Excel ]               [ Modify Logs ]

DAILY SHIFT LOGS:
+-------------------+----------+-----------+---------+----------------+-------------+
| Employee          | Clock In | Clock Out | Status  | GPS Match      | Selfie      |
+-------------------+----------+-----------+---------+----------------+-------------+
| Prasert Wrapmaster| 08:00 AM | 05:00 PM  | On Time | Mapped (BKK HQ)| [View Image]|
| Wichai Carbon     | 08:00 AM | 05:00 PM  | On Time | Mapped (BKK HQ)| [View Image]|
| Somchai Admin     | 07:30 AM | --:--     | Active  | Mapped (BKK HQ)| [View Image]|
+-------------------+----------+-----------+---------+----------------+-------------+
```
