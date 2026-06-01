# แผนการพัฒนาโมดูลขายหน้าร้านและคลังสินค้า (POS & Inventory Implementation Plan)

แผนงานนี้จัดทำขึ้นสำหรับสถาปัตยกรรมระบบ **Den Modify Management System** เพื่อพัฒนาโมดูล **Inventory (ระบบบริหารคลังสินค้า)** และ **POS (ระบบขายหน้าร้าน)** ถัดจากโมดูลใบเสร็จและการชำระเงิน (Phase 3) ทั้งนี้การออกแบบจะเป็นไปตามข้อกำหนด Database Schema, UI Specification V3 และ API Specification V3 ทั้งหมดโดยไม่มีการปรับเปลี่ยนโครงสร้างหลักของระบบ

---

## User Review Required

> [!IMPORTANT]
> **การบริหารสต็อกในการโอนย้ายข้ามสาขา (Inventory Transfers)**
> เนื่องจากฐานข้อมูลไม่มีตาราง `transfers` โดยตรง เราจะออกแบบระบบโดยใช้คอลัมน์ `notes` และ `reference_id` ของตาราง `stock_movements` ในการบันทึกคิวของการขนส่งสินค้าระหว่างสาขาแบบ 2 ขั้นตอน (2-Step Verification) เพื่อความเสถียรและไม่ต้องปรับเปลี่ยนโครงสร้างตารางเดิมในฐานข้อมูล

> [!WARNING]
> **การลงทะเบียนสินค้าใน POS Checkout**
> ในขั้นตอนการทำรายการชำระเงินหน้าร้านค้าปลีก (POS Checkout) จำเป็นต้องมีระบบควบคุมความปลอดภัยสูง (Atomic Database Transaction) เพื่อรับรองว่าระดับสต็อกสินค้าคงคลังจะไม่ติดลบ และรายการทางการเงินทั้งหมด (Invoice, Payments, PosSale, PosSaleItems, StockMovements) จะเสร็จสมบูรณ์พร้อมกัน หากมีขั้นตอนใดล้มเหลว ระบบจะทำการ Rollback ทันที

---

## Open Questions

> [!NOTE]
> **ทางเลือกสำหรับสินค้าแค็ตตาล็อกกลางที่ไม่มีบาร์โค้ด**
> สินค้าหรือบริการบางประเภท (เช่น ค่าแรงช่างเทคนิค หรือการแร็ปสีรถเฉพาะจุดแบบกำหนดเอง) จะไม่มีบาร์โค้ดจากโรงงาน ระบบจะอำนวยความสะดวกโดยจำลองการค้นหาจากชื่อในระบบ POS แคชเชียร์สามารถพิมพ์ค้นหาได้จากหน้าจอโดยตรง

---

## Proposed Changes

### [Component: POS & Inventory APIs]

ระบบฝั่งหลังบ้านจะเพิ่มเติม Route Handlers 5 ชุด เพื่อรองรับการทำงานของเครื่องขายและคลังสินค้า

#### [NEW] [route.ts (Products API)](file:///d:/AI%20LERNING/Car%20Fix%20project/src/app/api/v1/products/route.ts)
* **`GET /api/v1/products`**: รายชื่อสินค้าทั้งหมดพร้อมตัวกรองคำค้นหาและหมวดหมู่
* **`POST /api/v1/products`**: เพิ่มแค็ตตาล็อกสินค้าใหม่ (จำกัดสิทธิ์เฉพาะ Owner เท่านั้น)

#### [NEW] [route.ts (Inventory API)](file:///d:/AI%20LERNING/Car%20Fix%20project/src/app/api/v1/inventory/route.ts)
* **`GET /api/v1/inventory`**: แสดงสต็อกคงคลังรายสาขา พร้อมควบคุม Branch Isolation ให้ Admin/Technician เห็นเฉพาะคลังตนเอง

#### [NEW] [route.ts (Stock Adjustment API)](file:///d:/AI%20LERNING/Car%20Fix%20project/src/app/api/v1/inventory/adjust/route.ts)
* **`PUT /api/v1/inventory/adjust`**: การอัปเดตจำนวนสต็อกด้วยมือ โดยบันทึกประวัติการเดินสต็อกลงตาราง `stock_movements` (สิทธิ์เฉพาะ Owner, Admin)

#### [NEW] [route.ts (Transfers API)](file:///d:/AI%20LERNING/Car%20Fix%20project/src/app/api/v1/inventory/transfers/route.ts)
* **`POST /api/v1/inventory/transfers`**: เริ่มต้นคำสั่งโอนย้ายสินค้าข้ามสาขา (ลดสต็อกต้นทางและบันทึกประวัติ `transfer_out`)
* **`PUT /api/v1/inventory/transfers/[id]`**: ยืนยันการรับสินค้าที่คลังปลายทาง (เพิ่มสต็อกปลายทางและบันทึกประวัติ `transfer_in` ผูก `reference_id`)

#### [NEW] [route.ts (POS Checkout Engine)](file:///d:/AI%20LERNING/Car%20Fix%20project/src/app/api/v1/pos/checkout/route.ts)
* **`POST /api/v1/pos/checkout`**: ระบบปิดบิลชำระเงินปลีกหน้าร้าน (Composite Transaction) ดำเนินการตรวจสอบสต็อก ปรับยอดคลัง บันทึก `pos_sales`, `pos_sale_items`, `invoices` ( paid ), `payments` และบันทึก `audit_logs` ภายในคลิกเดียว

---

### [Component: POS & Inventory Frontend Screens]

ระบบอินเตอร์เฟสผู้ใช้งาน ออกแบบด้วย Outfit และ Inter สไตล์ Carbon ดำแดงสุดพรีเมียมตามข้อกำหนด UI Specification V3

#### [NEW] [page.tsx (Inventory Dashboard)](file:///d:/AI%20LERNING/Car%20Fix%20project/src/app/(dashboard)/branch/inventory/page.tsx)
* หน้ารายการสต็อกสินค้าคงคลัง แสดงยอด SKUs, จำนวนของใกล้หมดสต็อก และแถวรายการสินค้าพร้อมตัวกรอง/สไลเดอร์ปรับเปลี่ยน
* ลิงก์คำสั่งลัด: [+] Add Product, Adjust Stock, Manage Transfers

#### [NEW] [[id]/page.tsx (Product Detail & Ledger)](file:///d:/AI%20LERNING/Car%20Fix%20project/src/app/(dashboard)/branch/inventory/[id]/page.tsx)
* หน้ารายละเอียดแสดงต้นทุน กำไรสุทธิ ข้อมูลบาร์โค้ด และระดับคลังสินค้าในทุกสาขาทั่วประเทศ พร้อมแสดงตารางประวัติความเคลื่อนไหว (Stock Movement Ledger) ของสินค้านั้นย้อนหลัง

#### [NEW] [page.tsx (POS Home)](file:///d:/AI%20LERNING/Car%20Fix%20project/src/app/(dashboard)/branch/pos/page.tsx)
* หน้าสรุปยอดธุรกรรมการขายปลีกประจำวัน และตารางบันทึกการรับชำระเงินล่าสุด
* ปุ่มขนาดใหญ่ **[ >>> LAUNCH CHECKOUT TERMINAL <<< ]** เพื่อเปิดส่วนทำงานเครื่องคิดเงิน

#### [NEW] [page.tsx (POS Checkout Terminal)](file:///d:/AI%20LERNING/Car%20Fix%20project/src/app/(dashboard)/branch/pos/checkout/page.tsx)
* หน้าขายหน้าร้านแยกช่องทาง: คอลัมน์เลือกสินค้า/จำลองการสแกนบาร์โค้ดด้านซ้าย และข้อมูลตระกร้าชำระเงิน เชื่อมโยงประวัติลูกค้า และเลือกช่องทางเงินสด/โอนผ่านธนาคารด้านขวา

---

## Verification Plan

### Automated Tests
* ทดสอบลินท์เตอร์และโครงสร้างความสอดคล้องของโปรเจกต์ด้วยชุดคำสั่ง:
  * `npm run lint` - ต้องไม่มีความบกพร่องใดๆ (Zero warnings/errors)
  * `npx tsc --noEmit` - ตรวจสอบการแปลงประเภทข้อมูลและ TypeScript
  * `npm test` - ทดสอบ mock unit tests ทั้งหมด

### Manual Verification
* การเข้าสิทธิ์และแยกข้อมูล (Isolation): เข้าระบบด้วย Admin สาขา Bangkok เพื่อเช็คว่าคลังสินค้าถูกกรองเหลือเฉพาะสาขาตนเองเท่านั้น และไม่สามารถมองเห็นประวัติเงินสดของสาขาอื่นได้
* การชำระเงินหน้าร้าน (Checkout): กดทดลองขายสินค้าที่มีจำนวน 1 ชิ้นในคลัง ยืนยันว่าสต็อกของสาขาลดลงเหลือ 0 และพยายามทำการสั่งซื้อสินค้าชิ้นนั้นซ้ำในทันทีเพื่อตรวจสอบว่าระบบปฏิเสธคำสั่งซื้อ `ERR_LOW_STOCK` อย่างถูกต้อง
