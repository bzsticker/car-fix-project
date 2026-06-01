# User Interface (UI) Specification V3

This document contains the comprehensive UI Specification V3 for the **Den Modify Management System**. All modules and layouts are fully aligned with the high-performance **Den Modify brand identity**, featuring a stealthy stealth-matte black, carbon-inspired visual language.

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

## 2. Complete Roster of UI Screens & Layouts

Below is the complete blueprint for all 24 screens in the system.

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
Mobile-optimized view for shop floor technicians.
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

### 2.5 POS Dashboard
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

### 2.6 POS Checkout Terminal
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

### 2.7 Inventory Dashboard
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

### 2.8 Product Detail Screen
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

### 2.9 Stock Movement Ledger
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

### 2.10 Inventory Branch Transfer Sheet
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

### 2.11 Invoice Detail View
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

### 2.12 Warranty Certificates Database
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

### 2.13 Warranty Claim Detail Panel
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

### 2.14 Attendance Dashboard
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

---

### 2.15 Customer List Screen [NEW]
Searchable database ledger containing all registered customer accounts mapped by branch.
- **Features**: Global fuzzy search, branch filters, LINE OA linking badges, and quick checkout actions.

#### ASCII Wireframe: Customer List Screen
```
=====================================================================================
CUSTOMER ACCOUNTS DATABASE                                           [ Somchai Admin ]
=====================================================================================
Search: [ Search by name, phone, email... ]    [ Branch: All v ]   [ LINE Sync: All v ]

[+] Add Customer Account

+----------------------+----------------+--------------------+-------------+--------+
| Name                 | Primary Phone  | LINE OA Account    | Reg Branch  | Actions|
+----------------------+----------------+--------------------+-------------+--------+
| Apinan Speedster     | +6681-555-0199 | [x] Connected      | Bangkok HQ  | [View] |
| Chaiwat Drifter      | +6689-777-2244 | [x] Connected      | Pathum Thani| [View] |
| Guest Walk-in        | --             | [ ] Unlinked       | Bangkok HQ  | [View] |
+----------------------+----------------+--------------------+-------------+--------+
```

---

### 2.16 Customer Detail Screen [NEW]
Deep dive dashboard presenting customer coordinates, cars list, and quick service notes.
- **Features**: User details, linked cars card registry, and shortcut buttons to launch quotes or invoices.

#### ASCII Wireframe: Customer Detail Screen
```
=====================================================================================
CUSTOMER PROFILE: APINAN SPEEDSTER                                   [ Somchai Admin ]
=====================================================================================
[ Back to Accounts List ]                                [ Edit Info ] [ Delete User ]

+------------------------------------------+ +--------------------------------------+
| ACCOUNT COORDINATES                      | | REGISTERED VEHICLES (CARS)           |
|                                          | |                                      |
| Full Name: Apinan Speedster              | | * Honda Civic Type R (กข 9999 BKK)   |
| Phone:    +6681-555-0199                 | |   Color: Championship White          |
| Email:    apinan@gmail.com               | |   [ View Car History ]               |
| LINE OA:  [x] Active (U1234567890abc...) | |                                      |
| Mapped:   Bangkok HQ Branch              | | [ + Register New Vehicle for User ]  |
+------------------------------------------+ +--------------------------------------+
| ACTION PORTS                             | | TIMELINE HIGHLIGHT                   |
| [ >>> Create Estimate/Quote ]            | | Mapped MTD Jobs: 1 Active           |
| [ >>> Open Active POS Checkout ]         | | [ >>> View Full Activity Timeline ]  |
+------------------------------------------+ +--------------------------------------+
```

---

### 2.17 Customer Timeline [NEW]
Interactive chronological history tracking all quotes, invoices, payments, and appointments for a customer.
- **Features**: Flow timeline, details breakdown, and timestamp indicators.

#### ASCII Wireframe: Customer Timeline Screen
```
=====================================================================================
ACTIVITY LEDGER TIMELINE: APINAN SPEEDSTER                           [ Somchai Admin ]
=====================================================================================
[ Back to Profile ]                                                 [ Export Ledger ]

TIMELINE PROGRESS FLOW:
  o [2026-06-01 17:30] Mapped Bank Payment: 46,010.00 THB for Invoice #INV-20260601-0001
  |
  o [2026-06-01 17:28] Invoice #INV-20260601-0001 Issued by Somchai Admin (Value: 46k THB)
  |
  o [2026-06-01 15:30] Job #j1111111 created for Civic Type R (Satin Black Wrap)
  |
  o [2026-05-28 10:00] Estimate / Quote #q1111111 APPROVED via Customer LINE OA
  |
  o [2026-05-27 14:00] Customer account created at Bangkok HQ Branch
```

---

### 2.18 Vehicle List Screen [NEW]
Searchable register of cars detailed by license plate, make, model, and owner profiles.
- **Features**: License plate lookups, VIN filters, and quick check-in actions.

#### ASCII Wireframe: Vehicle List Screen
```
=====================================================================================
VEHICLE REGISTRY DATABASE                                            [ Somchai Admin ]
=====================================================================================
Search: [ Search plate, VIN, make, owner... ]              [ Category Filter: All v ]

[+] Add Vehicle Profile

+--------------------+----------------------+---------------+------------------------+
| License Plate      | Make / Model         | Owner         | VIN                    |
+--------------------+----------------------+---------------+------------------------+
| กข 9999 (Bangkok)  | Honda Civic Type R   | A. Speedster  | MRHFL5380NP000001      |
| รล 8888 (Pathum)   | Toyota GR Yaris      | C. Drifter    | JT1A1E52000000002      |
| ญญ 7777 (Bangkok)  | BMW M4 Competition   | S. M-Power    | WBA31AZ05G8202391      |
+--------------------+----------------------+---------------+------------------------+
```

---

### 2.19 Vehicle Detail Screen [NEW]
Extended detail view for specific vehicles, showcasing custom mod logs, specs, and past jobs.
- **Features**: Specs cards, active warranty certificates status, and modification history tree.

#### ASCII Wireframe: Vehicle Detail Screen
```
=====================================================================================
VEHICLE DATA SHEET: HONDA CIVIC TYPE R                               [ Somchai Admin ]
=====================================================================================
[ Back to Vehicles ]                                                [ Create Job Card ]

+------------------------------------------+ +--------------------------------------+
| VEHICLE SPECIFICATIONS                   | | MODIFICATION HISTORY & ACTIVE JOBS   |
|                                          | |                                      |
| Plate:   กข 9999 (กรุงเทพมหานคร)         | | * [ACTIVE] Job #j1111111             |
| Owner:   Apinan Speedster [Profile Link] | |   Status: In Progress                |
| Make:    Honda  | Model: Civic Type R    | |   Service: Satin Black Wrap          |
| Year:    2023   | Color: Champ White     | |                                      |
| VIN:     MRHFL5380NP000001               | | * [COMPLETED] 2026-05-15             |
|                                          | |   Service: Gyeon Ceramic Coating     |
+------------------------------------------+ +--------------------------------------+
| WARRANTY COVERAGE                        | | CAR PHOTOS LOG                       |
| Code: WRY-3MBLK-FL5-8821                 | | [Before Check-in Photo]              |
| Status: [* ACTIVE ] (Expires: 2029-06-01)| | [Completed Lip Photo]                |
+------------------------------------------+ +--------------------------------------+
```

---

### 2.20 Job Detail Screen [NEW]
Deep dive dashboard mapping out technician work teams, billing statuses, and service milestones.
- **Features**: Service team list, parts used log, photo logs timeline, and invoice links.

#### ASCII Wireframe: Job Detail Screen
```
=====================================================================================
JOB CONTROL SHEET: #j1111111                                         [ Somchai Admin ]
=====================================================================================
Status: [/ IN PROGRESS ]

+------------------------------------------+ +--------------------------------------+
| SERVICE & ASSIGNED TEAM                  | | PARTS CONSUMPTION LEDGER             |
|                                          | |                                      |
| Vehicle: Civic Type R [กข 9999]          | | * WRAP-3M-SATINBLK [Qty: 1 Roll]     |
| Owner:   Apinan Speedster                | |   Unit price: 28,000.00 THB          |
|                                          | |   Status: Confirmed                  |
| Team:                                    | |                                      |
| - Prasert Wrapmaster (Lead Tech)         | | [ + Add Custom Material/Part ]       |
| - Wichai Carbon (Assistant Tech)         | |                                      |
+------------------------------------------+ +--------------------------------------+
| SERVICE TASKS CHECKLIST                  | | FINANCIAL BINDINGS                   |
| [x] Paint Prep Correction                | | Est Cost: 43,000.00 THB              |
| [/] Install Satin Wrap (Front Lip)       | | Invoice:  #INV-20260601-0001 [PAID]  |
| [ ] Heat-seal trims                      | |                                      |
+------------------------------------------+ +--------------------------------------+
```

---

### 2.21 Job Timeline Screen [NEW]
Visual chronological logs tracking progress updates, QC checks, and photos uploaded for a job.
- **Features**: Before/after image carousel and chronological progress milestones.

#### ASCII Wireframe: Job Timeline Screen
```
=====================================================================================
JOB MILESTONE TIMELINE: #j1111111                                    [ Somchai Admin ]
=====================================================================================
[ Back to Job Detail ]                                              [ Push LINE Alert ]

TIMELINE HIGHLIGHTS:
  o [17:30] Q90 Heat Audit Seal Completed by Lead Tech Prasert [QC PASS]
  |
  o [15:45] Progress Photo Uploaded: Gyeon Primer Base coat.
  |  [ https://supabase.co/storage/.../civic_prep.jpg ]
  |
  o [14:00] Paint Prep checklist stage marked COMPLETED by assistant Tech Wichai.
  |
  o [12:30] Check-in Photo Uploaded: Vehicle check-in condition documentation.
  |  [ https://supabase.co/storage/.../civic_before.jpg ]
  |
  o [12:00] Job ticket scheduled & team assigned.
```

---

### 2.22 Quotation List Screen [NEW]
Master database catalog of quotations and validity tracking.
- **Features**: Validity alarms, status indicators, and quick duplicate actions.

#### ASCII Wireframe: Quotation List Screen
```
=====================================================================================
ESTIMATES & QUOTATIONS DATABASE                                      [ Somchai Admin ]
=====================================================================================
Search: [ Search customer, plate, quote #... ]             [ Status: All v ]

[+] Create New Estimate

+-------------------+------------------+---------------+-------------+---------------+
| Quote Number      | Customer         | Vehicle       | Total Cost  | Status        |
+-------------------+------------------+---------------+-------------+---------------+
| QTE-20260528-0001 | Apinan Speedster | Civic Type R  | 32,500.00   | [x] Approved  |
| QTE-20260601-0002 | Chaiwat Drifter  | GR Yaris      | 115,000.00  | [ ] Sent      |
| QTE-20260520-0003 | Somchai M-Power  | BMW M4        | 18,000.00   | [!] Expired   |
+-------------------+------------------+---------------+-------------+---------------+
```

---

### 2.23 Quotation Detail Screen [NEW]
Premium, high-contrast, printable quote sheet featuring digital signature logs.
- **Features**: PDF exports, print triggers, itemized estimates, and approval triggers.

#### ASCII Wireframe: Quotation Detail Screen
```
=====================================================================================
ESTIMATE SHEET: #QTE-20260528-0001                                   [ Somchai Admin ]
=====================================================================================
[ Back to List ]             [ PDF Export ]             [ Approve & Convert to Job ]

+-----------------------------------------------------------------------------------+
| DEN MODIFY ESTIMATE                                                               |
+-----------------------------------------------------------------------------------+
| Customer: Apinan Speedster | Vehicle: Civic Type R | Valid Until: 2026-06-28       |
+-----------------------------------------------------------------------------------+
| ITEMIZED SERVICES & PARTS                                                         |
| 1. Full Body Satin Black Wrap Service           1 Unit            28,000.00 THB   |
| 2. Prep Detail & Paint Correction               1 Unit             4,500.00 THB   |
+-----------------------------------------------------------------------------------+
| Total Cost:  32,500.00 THB (Prices exclude VAT)                                   |
| Status:      APPROVED (Digital Approval via Customer LINE OA)                     |
| Sign-off:    [ Kittisak Denowner ]                     [ Digital Cust Approval ]  |
+-----------------------------------------------------------------------------------+
```

---

### 2.24 Reports Dashboard [NEW]
Interactive analytics terminal tracking financial KPIs and operational performance.
- **Features**: Revenue/Expense trends chart, branch-to-branch comparative widgets, and CSV export action buttons.

#### ASCII Wireframe: Reports Dashboard
```
=====================================================================================
BUSINESS ANALYTICS TERMINAL                                          [ Kittisak Owner ]
=====================================================================================
Period: [ Current Month v ]        [ Export Excel Report ]        [ Export CSV Data ]

+----------------------+ +----------------------+ +----------------------+
| MONTHLY NET PROFIT   | | AVERAGE ORDER VALUE  | | LABOR UTILIZATION    |
| 185,450.00 THB       | | 28,500.00 THB        | | 82% Efficiency       |
| (+12% vs last month) | | (+5% vs last month)  | | [ View Timesheets ]  |
+----------------------+ +----------------------+ +----------------------+

+-----------------------------------------------------------------------------------+
| MONTHLY REVENUE & PRODUCT CONSUMPTION (Weekly Flow Chart)                         |
|                                                                                   |
|  * REVENUE:  185k (Bangkok HQ) / 125k (Pathum Thani)                              |
|  * Wraps:    12 rolls used | Ceramic Coatings: 23 units used                      |
+-----------------------------------------------------------------------------------+
| COMPARATIVE MARGIN ANALYTICS BY CATEGORY                                          |
| Wraps      [=============================================] 55% Margin             |
| Exhausts   [================================] 35% Margin                          |
| Coatings   [============================================] 50% Margin              |
+-----------------------------------------------------------------------------------+
```
