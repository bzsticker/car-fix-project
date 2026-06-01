# User Interface (UI) Specification

This document defines the complete UI Specification for the **Den Modify Management System**. Designed around a high-end, responsive aesthetics workflow, this system utilizes **Next.js 15**, **TailwindCSS**, and **shadcn/ui** to deliver a premium, glassmorphic, and dynamic user experience.

---

## 1. Design System & Aesthetics Tokens

To achieve a state-of-the-art feel that matches the premium nature of luxury car modifications, we employ a unified, dark-themed styling token set.

### 1.1 Color Palette (HSL Tailored)
- **Backgrounds**:
  - `Base`: HSL `224 71% 4%` (Deep Obsidian Blue)
  - `Card / Surface`: HSL `224 71% 7%` (Translucent Obsidian with glassmorphism)
- **Accents**:
  - `Primary (Action/Highlights)`: HSL `190 95% 50%` (Neon Electric Cyan)
  - `Secondary`: HSL `263 70% 50%` (Vibrant Hyper Violet)
- **Status Indicators**:
  - `Success (Completed/Paid)`: HSL `142 70% 45%` (Emerald Green)
  - `Warning (Awaiting/Reorder)`: HSL `38 92% 50%` (Amber Gold)
  - `Destructive (QC Fail/Cancelled)`: HSL `346 84% 50%` (Crimson Neon Red)
- **Borders & Separators**:
  - `Border`: HSL `224 30% 18%` (Muted Steel Blue)

### 1.2 Typography & Glassmorphism
- **Headers**: Google Font **Outfit** (Wide, aggressive, premium automotive feel).
- **Body**: Google Font **Inter** (Highly legible, crisp).
- **Glassmorphism Spec**: Card backgrounds feature `backdrop-blur-md bg-opacity-65 border border-white/10 shadow-2xl shadow-cyan-950/20`.
- **Micro-Animations**: All interactive items feature `transition-all duration-300 ease-out hover:scale-[1.02]`.

---

## 2. Global Shell Layout

The global layout consists of a responsive sidebar layout featuring a sticky top header with global utility controls.

```
+-----------------------------------------------------------------------------------+
|  [Sidebar Logo]   | [Search everything...]                [Branch Select] [User Profile] |
+-------------------+---------------------------------------------------------------+
|  * Global Board   |                                                               |
|  * Appointments   |                                                               |
|  * Active Jobs    |                                                               |
|  * POS Sales      |                        MAIN CONTENT AREA                      |
|  * Inventory      |                                                               |
|  * Attendance     |                                                               |
|  * Roster/Logs    |                                                               |
|                   |                                                               |
|  [Logout]         |                                                               |
+-------------------+---------------------------------------------------------------+
```

---

## 3. Owner Dashboard (Global Operations)

### 3.1 Layout & Visual Hierarchy
- **Header**: High-level corporate overview featuring total cross-branch revenue and job counters with smooth sparkline indicators.
- **Branch Switcher**: Global toggle at the top right to filter reports/charts by "Bangkok HQ", "Pathum Thani Outpost", or "All Branches".

### 3.2 Dynamic Widgets
1. **Analytics Grid**: Interactive HSL gradient charts showing weekly revenue curves, average transaction value, and category-wise performance (e.g. wraps vs exhausts).
2. **Branch Comparison Ledger**: A side-by-side card component visualizing branch performance.
3. **Master Catalog Manager**: Renders the complete products list with barcode, retail pricing, margins, and inline inventory levels at each location.
4. **Live Employee Map & Roster**: Visual grid showing clocked-in employees. Clicking an employee opens a modal presenting their clock-in GPS coordinates on a micro-map and their verification selfie.

### 3.3 ASCII Wireframe: Owner Dashboard
```
=====================================================================================
[Owner Command Center]                            [All Branches v]  [Kittisak Owner]
=====================================================================================
+---------------------+ +---------------------+ +---------------------+
| TOTAL REVENUE       | | COMPLETED JOBS      | | ACTIVE CUSTOMERS    |
| 150,775.00 THB (+8%)| | 24 Jobs (Bangkok/PT)| | 128 Profiles        |
+---------------------+ +---------------------+ +---------------------+

+-----------------------------------------------------------------------------------+
| REVENUE PERFORMANCE (Weekly Trend Chart)                                           |
| [150k]  *-----*                                                                   |
| [100k] /       \       *                                                          |
| [50k ]/         *-----/ \                                                         |
|      Mon   Tue   Wed   Thu   Fri   Sat                                            |
+-----------------------------------------------------------------------------------+

+-----------------------------------------+ +-----------------------------------------+
| LIVE ROSTER (Clocked-In Employees)       | | PRODUCT CATALOG & STOCK LEVELS          |
| * Prasert Wrapmaster - Bangkok [Map Pin] | | WRAP-3M-SATINBLK [||||||] 5 Rolls (BKK) |
| * Wichita Carbon     - Bangkok [Map Pin] | | EXH-AKRAP-EVO   [||]    2 Units (PT)  |
| * Nattapong Tuner    - Pathum  [Map Pin] | | CERM-GYON-Q2M   [||||||] 15 Units (BKK) |
+-----------------------------------------+ +-----------------------------------------+
```

---

## 4. Admin Dashboard (Branch Command)

The primary control room for the branch administrators. Tied directly to the active `branch_id`.

### 4.1 Layout & Core Panels
- **Active Jobs Kanban Board**:
  - Columns: `Draft` | `Scheduled` | `In Progress` | `QC` | `Ready` | `Completed`.
  - Feature: Cards show license plate, customer name, primary service, and micro-team assigned. Drag-and-drop triggers instant status mutations.
- **Dispatch Control Modal**:
  - Triggered by clicking "Assign Staff" on a job card.
  - Allows selecting one `Lead Technician` and multiple `Assistant Technicians` from the available clocked-in branch staff.
- **Invoicing & POS Checkout Panel**:
  - Right-aligned panel for processing walk-ins or completing jobs.
  - Includes a **Barcode Scan input** (automatically maps barcode to the product database, adding the item to the bill) and tax/discount calculators.
- **Appointment Approval Center**:
  - Lists bookings calendar.
  - Admins can click "Approve Appointment" to send a LINE OA confirmation, or click "Convert to Job" to automatically register a new job ticket and duplicate customer/car metadata.

### 4.2 ASCII Wireframe: Admin Kanban Board
```
=====================================================================================
[Bangkok HQ Control]        [+ Booking]   [+ Job Checkout]        [Somchai Admin]
=====================================================================================
KANBAN WORKFLOW:
+-------------------+ +-------------------+ +-------------------+ +-------------------+
| SCHEDULED (1)     | | IN PROGRESS (1)   | | QUALITY CONTROL   | | READY FOR PICKUP  |
+-------------------+ +-------------------+ +-------------------+ +-------------------+
| [Civic Type R]    | | [GR Yaris]        | | (Empty)           | | [BMW M4]          |
| Plate: กข 9999    | | Plate: รล 8888    | |                   | | Plate: ญญ 7777    |
| Service: 3M Wrap  | | Service: Akrapovic| |                   | | Service: Gyeon QC |
| [Assign Techs]    | | Assigned: tech3   | |                   | | [Create Invoice]  |
+-------------------+ +-------------------+ +-------------------+ +-------------------+
```

---

## 5. Technician Dashboard (Mobile-First Workboard)

Technicians require a highly-focused, mobile-responsive layout designed for touch gestures in the workshop.

### 5.1 Layout & Action Flows
- **Clock-In/Out Overlay**:
  - Prompted on first load.
  - Accesses mobile GPS coordinates and camera stream to capture a visual confirmation selfie before opening the dashboard.
- **Assigned Job Checklist**:
  - Lists jobs assigned to the technician.
  - Clicking a job expands into a fullscreen work task checklist showing individual service stages. Tap to mark as completed (sends instant progress updates to Admin and LINE OA customer portal).
- **Part logs & Stock Allocation**:
  - Touch-friendly dropdown to search branch parts catalog.
  - Input field to report parts used (e.g. consumed 1 roll of wrap). Triggers auto-adjustments.
- **Camera Capture Engine**:
  - Clicking "Capture Progress Photo" opens the native phone camera.
  - Technician selects category (`Before Check-In`, `In-Progress`, `Completed`, `QC Defect`) and uploads the picture to the job timeline.

### 5.2 ASCII Wireframe: Technician Mobile Screen
```
+-----------------------------------+
| [Den Modify] [Prasert Wrapmaster] |
+-----------------------------------+
| [ CLOCK OUT ] - Srinakarin Branch |
+-----------------------------------+
| ASSIGNED WORK:                    |
| > Honda Civic Type R [Plate: 9999]|
|                                   |
|   Checklist:                      |
|   [x] Multi-stage Paint Prep      |
|   [/] Apply 3M Satin Black (Front)|
|   [ ] Door handles trim heat-seal |
|                                   |
|   PARTS CONSUMPTION LOG:          |
|   * Roll: WRAP-3M-SATINBLK [x1]   |
|   [ + Scan Barcode / Add Part ]   |
|                                   |
|   DOCUMENTATION:                  |
|   [ CAMERA: Take Progress Photo ] |
+-----------------------------------+
```

---

## 6. LINE OA Customer WebView Progress Portal

An ultra-sleek, lightweight responsive portal opened from the customer's LINE app.

### 6.1 Layout & Components
- **Progress Gauge**: Beautiful interactive ring progress indicator showing status (e.g., "75% Completed - Applying Wrap").
- **Live Image Timeline Carousel**: Allows the customer to swipe through photos uploaded by technicians showing their car during the modification process.
- **Interactive Quotation Approvals**:
  - Renders quotes in high-contrast mobile layout.
  - Featuring glowing "Approve & Start Modifications" and "Reject" buttons.
- **Warranty Certificate Hub**:
  - Displays the active certificate showing the unique code (e.g. `WRY-3MBLK-FL5-8821`).
  - Circular time-left gauge counting down the remaining months.

### 6.2 ASCII Wireframe: LINE OA Customer WebView
```
+-----------------------------------+
|  Den Modify Customer Live Portal  |
+-----------------------------------+
|  HELLO, APINAN SPEEDSTER          |
|  Car: Honda Civic Type R (กข 9999) |
+-----------------------------------+
|                                   |
|          (  75%  )                |
|        IN PROGRESS...             |
|    Applying Satin Black Wrap      |
|                                   |
+-----------------------------------+
|  LIVE TIMELINE PHOTOS             |
|  [Before Lip] < [Wrapping Hood] > |
+-----------------------------------+
|  WARRANTY CERTIFICATE ACTIVE      |
|  Code: WRY-3MBLK-FL5-8821         |
|  [||||||||||||||||||] 35 Months   |
+-----------------------------------+
```
