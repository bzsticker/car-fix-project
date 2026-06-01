# รายงานการตรวจสอบเส้นทางการนำทางระบบ (ROUTE_AUDIT_REPORT.md)

**โครงการ:** Den Modify Management System  
**ประเภทรายงาน:** รายงานตรวจสอบเส้นทาง (Routing Audit Report)  
**ปัญหาที่พบ:** เมื่อเข้าสู่ระบบสำเร็จ หน้าต่างจะเปลี่ยนเส้นทางไปยัง `/dashboard/owner` แต่ระบบทำการดีดรายงานรหัสความผิดพลาด **`404 Not Found`**

---

## 1. บทวิเคราะห์ทางสถาปัตยกรรม (Architecture & Routing Analysis)

จากการตรวจสอบโครงสร้างโฟลเดอร์รันไทม์ภายใต้ไดเรกทอรี `src/app` พบความผิดพลาดในการแมปปิ้งเส้นทาง (Route Mapping Mismatch) ระหว่างสัญกรณ์การอ้างอิงรหัสโฟลเดอร์ และกฎการทำงานจริงของเฟรมเวิร์ก Next.js ดังนี้:

### โครงสร้างโฟลเดอร์จริงในระบบ:
```text
src/app/
├── (auth)               <-- Route Group สำหรับระบบสิทธิ์
├── (dashboard)          <-- Route Group สำหรับแดชบอร์ดหลัก
│   ├── branch           <-- ไดเรกทอรีแดชบอร์ดสำหรับแอดมินสาขา
│   ├── owner            <-- ไดเรกทอรีแดชบอร์ดสำหรับเจ้าของร้าน
│   └── tech             <-- ไดเรกทอรีแดชบอร์ดสำหรับช่างซ่อม
```

### กฎการทำงานของ Next.js Route Groups `(folder)`
ใน Next.js การตั้งชื่อโฟลเดอร์โดยมีวงเล็บครอบ เช่น `(dashboard)` หรือ `(auth)` จะทำหน้าที่เป็น **กลุ่มเส้นทาง (Route Groups)** เพื่อช่วยจัดสัดส่วนโครงสร้างของแอปพลิเคชันให้เป็นระเบียบ แต่ **จะถูกละเว้นและลบออกจาก URL เส้นทางจริงของเว็บไซต์โดยอัตโนมัติ**

* **เส้นทางตามสคริปต์ที่เข้าใจผิด:** `/dashboard/owner`, `/dashboard/branch`, `/dashboard/tech`
* **เส้นทางจริงของ Next.js (Actual Routes):**
  * โฟลเดอร์ `src/app/(dashboard)/owner/page.tsx` จะจับคู่กับ URL: **`/owner`** (ไม่ใช่ `/dashboard/owner`)
  * โฟลเดอร์ `src/app/(dashboard)/branch/page.tsx` จะจับคู่กับ URL: **`/branch`** (ไม่ใช่ `/dashboard/branch`)
  * โฟลเดอร์ `src/app/(dashboard)/tech/page.tsx` จะจับคู่กับ URL: **`/tech`** (ไม่ใช่ `/dashboard/tech`)

**ผลสรุปเหตุการณ์ (Verdict):**  
สคริปต์แอปพลิเคชันมีการเรียกใช้งานและส่งผู้ใช้งานเปลี่ยนหน้าไปยังพาร์ทที่มีคำว่า `/dashboard/...` นำหน้า ซึ่งไม่มีตำแหน่งที่ตั้งอยู่จริงในสารบบการจัดวางของ Next.js ส่งผลให้ฝั่งผู้ใช้งานได้รับรหัสความผิดพลาด **404 Not Found** หลังการเข้าสู่ระบบ

---

## 2. รายการจุดบกพร่องที่ตรวจพบในโค้ดเบส (Audit Findings)

จากการสแกนค้นหาเส้นทางแบบสากลภายใต้โค้ดเบส เราพบจุดบกพร่องที่ระบุค่านำทางไม่ถูกต้องทั้งหมด **5 กลุ่มหลัก** ดังนี้:

### 1) ตัวกรองความปลอดภัย Middleware (`src/middleware.ts`)
มิดเดิลแวร์มีการกำหนดสิทธิ์การตรวจสอบการเข้าถึงด้วยคำว่า `/dashboard` ซ้ำซ้อน ซึ่งหากปล่อยไว้จะทำให้ระบบดีดผู้ใช้กลับหน้าล็อกอินโดยไม่จำเป็น
* **บรรทัดที่ 32:** `return NextResponse.redirect(new URL("/dashboard/owner", request.url));`
* **บรรทัดที่ 34:** `return NextResponse.redirect(new URL("/dashboard/branch", request.url));`
* **บรรทัดที่ 36:** `return NextResponse.redirect(new URL("/dashboard/tech", request.url));`
* **บรรทัดที่ 41-43:** เงื่อนไขดักจับเริ่มต้นด้วย `/dashboard/owner`, `/dashboard/branch` และ `/dashboard/tech`

### 2) หน้าแรกเริ่มต้นของแอปพลิเคชัน (`src/app/page.tsx`)
หน้าดักเปลี่ยนเส้นทางหลักของเว็บไซต์ (Root Redirect) ป้อนค่าเส้นทางย้อนไปที่โฟลเดอร์กลุ่ม:
* **บรรทัดที่ 8:** `return "/dashboard/owner";`
* **บรรทัดที่ 12:** `return "/dashboard/branch";`
* **บรรทัดที่ 15:** `return "/dashboard/tech";`

### 3) หน้าล็อกอินหลัก (`src/app/(auth)/login/page.tsx`)
หน้าเข้าสู่ระบบเปลี่ยนเส้นทางหลังล็อกอินสำเร็จผิดพลาด:
* **บรรทัดที่ 51:** `router.push("/dashboard/owner");`
* **บรรทัดที่ 53:** `router.push("/dashboard/branch");`
* **บรรทัดที่ 55:** `router.push("/dashboard/tech");`

### 4) เมนูนำทางด้านข้างของแดชบอร์ด (`src/components/sidebar.tsx`)
ลิงก์ทั้งหมดบนไซด์บาร์นำทาง (Sidebar Links) ป้อนค่าเส้นทางผิดพลาด ทำให้เมื่อคลิกเมนูระบบจะนำผู้ใช้งานไปที่หน้า 404 ทันที:
* **ของ Owner (บรรทัด 43-47):** ชี้ไปที่ `/dashboard/owner`, `/dashboard/owner/branches`, `/dashboard/owner/roster`, `/dashboard/owner/stock`, `/dashboard/owner/reports`
* **ของ Branch (บรรทัด 51-56):** ชี้ไปที่ `/dashboard/branch`, `/dashboard/branch/appointments`, `/dashboard/branch/jobs` เป็นต้น

### 5) หน้าซับย่อยแดชบอร์ดสาขา (`src/app/(dashboard)/branch/...`)
หน้าจอระบบการทำงานของสาขา เช่น หน้าประวัติรถ ประวัติลูกค้า และหน้าระบบงาน มีการกำหนดปุ่มและลิงก์ความสัมพันธ์ภายในย้อนกลับไปหาโฟลเดอร์กลุ่มอย่างสมบูรณ์ เช่น:
* `href="/dashboard/branch/customers"` (ในหน้าประวัติลูกค้า)
* `href="/dashboard/branch/vehicles"` (ในหน้าประวัติรถยนต์)
* `href="/dashboard/branch/jobs"` (ในหน้าระบบงานช่าง)

---

## 3. ตารางเปรียบเทียบการแก้ไขเส้นทาง (Route Correction Mapping Table)

เพื่อแก้ไขปัญหานี้ให้สมบูรณ์แบบ เราต้องแปลงทุกเส้นทางในหน้าต่างโค้ดเบสโดยนำคำว่า `/dashboard` ออกไป เพื่อให้ตรงตามกลไก Route Group ดังแสดงในตารางนี้:

| ตำแหน่งไฟล์ที่พบปัญหา | เส้นทางที่ระบุผิดในปัจจุบัน (Wrong URL) | เส้นทางที่ถูกต้อง (Proposed URL) | บทบาทที่ใช้งาน (Role) |
|---|---|---|---|
| **Root Redirect (`src/app/page.tsx`)** | `/dashboard/owner` <br> `/dashboard/branch` <br> `/dashboard/tech` | `/owner` <br> `/branch` <br> `/tech` | *ทุกบทบาท* |
| **Login Redirect (`src/app/(auth)/login/page.tsx`)** | `/dashboard/owner` <br> `/dashboard/branch` <br> `/dashboard/tech` | `/owner` <br> `/branch` <br> `/tech` | *ทุกบทบาท* |
| **Sidebar Menu (`src/components/sidebar.tsx`)** | `/dashboard/owner/...` <br> `/dashboard/branch/...` <br> `/dashboard/tech/...` | `/owner/...` <br> `/branch/...` <br> `/tech/...` | *ทุกบทบาท* |
| **Customer Sub-pages (`src/app/(dashboard)/branch/customers/...`)** | `/dashboard/branch/customers` <br> `/dashboard/branch/customers/[id]` | `/branch/customers` <br> `/branch/customers/[id]` | *Admin / Owner* |
| **Vehicle Sub-pages (`src/app/(dashboard)/branch/vehicles/...`)** | `/dashboard/branch/vehicles` <br> `/dashboard/branch/vehicles/[id]` | `/branch/vehicles` <br> `/branch/vehicles/[id]` | *Admin / Owner* |
| **Job Sub-pages (`src/app/(dashboard)/branch/jobs/...`)** | `/dashboard/branch/jobs` <br> `/dashboard/branch/jobs/[id]` | `/branch/jobs` <br> `/branch/jobs/[id]` | *Admin / Owner* |

---

## 4. สรุปแผนการดำเนินการแก้ไข (Action Plan)

1. **เฟสที่ 1:** ปรับปรุงความปลอดภัยตัวกรองใน `src/middleware.ts` ให้นำค่านำหน้า `/dashboard` ออกให้หมด
2. **เฟสที่ 2:** แก้ไขฟังก์ชันกำหนดหน้าทางของ `src/app/page.tsx` และปุ่มล็อกอิน `src/app/(auth)/login/page.tsx` ให้ใช้เส้นทางถูกต้อง
3. **เฟสที่ 3:** ดำเนินการอัปเดตลิงก์เมนู Sidebar ใน `src/components/sidebar.tsx` เพื่อให้การกดนำทางภายในแดชบอร์ดลื่นไหล
4. **เฟสที่ 4:** เข้าแก้ไขลิงก์ย้อนกลับและปุ่มทั้งหมดในกลุ่มโฟลเดอร์แดชบอร์ดสาขา `src/app/(dashboard)/branch/...` ให้สมบูรณ์แบบ
5. **เฟสที่ 5:** ดำเนินการตรวจสอบด้วยคำสั่ง `npm run lint` และ `npm test` อีกครั้งเพื่อยืนยันว่าการเปลี่ยนลิงก์ไม่กระทบต่อชุดการรัน

*(ตามข้อจำกัดข้อกำหนดทางธุรกิจ ขณะนี้ยังไม่ได้ทำการเปลี่ยนโค้ดใดๆ เพื่อรอการอนุมัติแนวทางการแก้ไขเส้นทางนี้)*
