# คู่มือการตั้งค่าบัญชีผู้ใช้ระบบ (USER_SETUP.md)

เอกสารนี้ระบุรายละเอียดโครงสร้างบัญชีผู้ใช้ระบบจำลอง (Mock Users) ของระบบ **Den Modify Management System** และขั้นตอนการเปิดใช้งานบัญชีผ่าน Supabase เพื่อให้สอดคล้องกับมาตรการความปลอดภัยขั้นสูง (Best Practices) โดยหลีกเลี่ยงการสั่ง `INSERT` ลงตาราง `auth.users` ตรงๆ ในไฟล์ Seed หลัก ซึ่งช่วยขจัดปัญหาเรื่องสิทธิ์บนระบบ Supabase Cloud และปัญหาฟังก์ชันการเข้ารหัสรหัสผ่านล้มเหลว

---

## 1. รายการบัญชีผู้ใช้จำลองในระบบ (Mock Accounts)

ระบบของเรามีการใช้งานบัญชีผู้ใช้ทั้งหมด **7 บัญชี** แบ่งออกเป็น 3 บทบาทการทำงาน (Roles) เพื่อทดสอบสิทธิ์การเข้าถึงข้อมูลตามสาขา (Branch Isolation) และการเข้าถึงระบบตามระดับสิทธิ์ (RBAC):

| ลำดับ | อีเมลบัญชี (Email) | รหัสผ่าน (Password) | บทบาท (Role) | รหัสสาขาที่สังกัด (Branch ID) / ชื่อสาขา | รหัสบัญชีคงที่ (Predefined UUID) |
|---|---|---|---|---|---|
| **1** | `owner@denmodify.com` | `password123` | **Owner** (เจ้าของกิจการ) | *ไม่มี (เข้าถึงได้ทุกสาขา)* | `00000000-0000-0000-0000-000000000001` |
| **2** | `admin1@denmodify.com` | `password123` | **Admin** (ผู้จัดการสาขา) | `11111111-1111-1111-1111-111111111111` <br>*(Den Modify - Bangkok HQ)* | `00000000-0000-0000-0000-000000000011` |
| **3** | `admin2@denmodify.com` | `password123` | **Admin** (ผู้จัดการสาขา) | `22222222-2222-2222-2222-222222222222` <br>*(Den Modify - Pathum Thani Outpost)* | `00000000-0000-0000-0000-000000000021` |
| **4** | `tech1@denmodify.com` | `password123` | **Technician** (ช่างเทคนิค) | `11111111-1111-1111-1111-111111111111` <br>*(Den Modify - Bangkok HQ)* | `00000000-0000-0000-0000-000000000031` |
| **5** | `tech2@denmodify.com` | `password123` | **Technician** (ช่างเทคนิค) | `11111111-1111-1111-1111-111111111111` <br>*(Den Modify - Bangkok HQ)* | `00000000-0000-0000-0000-000000000032` |
| **6** | `tech3@denmodify.com` | `password123` | **Technician** (ช่างเทคนิค) | `22222222-2222-2222-2222-222222222222` <br>*(Den Modify - Pathum Thani Outpost)* | `00000000-0000-0000-0000-000000000041` |
| **7** | `tech4@denmodify.com` | `password123` | **Technician** (ช่างเทคนิค) | `22222222-2222-2222-2222-222222222222` <br>*(Den Modify - Pathum Thani Outpost)* | `00000000-0000-0000-0000-000000000042` |

---

## 2. ขั้นตอนการตั้งค่าบัญชี (Setup Instructions)

เนื่องจากตาราง `public.profiles` มีความสัมพันธ์แบบจำกัดคีย์ภายนอก (Foreign Key Constraint) ไปยังตารางระบบ `auth.users(id)` **คุณจำเป็นต้องสร้างบัญชีผู้ใช้ใน auth.users ก่อนที่จะรันสคริปต์ seed.sql** เพื่อหลีกเลี่ยงข้อผิดพลาดคีย์อ้างอิงไม่พบ (Foreign Key Violation) 

โดยผู้พัฒนาสามารถเลือกใช้วิธีใดวิธีหนึ่งจาก 2 ช่องทางด้านล่างนี้ตามความเหมาะสม:

---

### ช่องทางที่ A: การใช้ SQL Script ผ่าน SQL Editor (แนะนำสำหรับ Local Development & Quick Start)

นี่เป็นวิธีที่รวดเร็วและปลอดภัยที่สุดสำหรับเครื่องผู้พัฒนา โดยการใช้ค่าพาสเวิร์ดที่เข้ารหัสสำเร็จรูป (Pre-hashed bcrypt) ทำให้สคริปต์นี้เป็นอิสระ 100% จากฟังก์ชันเข้ารหัสระดับส่วนขยาย (เช่น `pgcrypto.crypt` หรือ `gen_salt`) ช่วยให้รันผ่านได้ทันทีบนทุกสภาพแวดล้อมรวมถึง Supabase Cloud

**ขั้นตอนปฏิบัติ:**
1. เข้าสู่ระบบไปยัง **Supabase Dashboard** ของโปรเจกต์คุณ
2. ไปที่เมนู **SQL Editor** จากแถบเมนูด้านซ้าย
3. คลิก **New query** (สร้างคิวรีใหม่)
4. คัดลอกโค้ด SQL ด้านล่างนี้ไปวางและคลิก **RUN**:

```sql
-- =========================================================================
-- SQL HELPER: SEED MOCK AUTH USERS WITH PREDEFINED UUIDS
-- =========================================================================

-- รหัสผ่านเริ่มต้นสำหรับทุกบัญชีคือ: password123 
-- (ใช้ค่า Pre-hashed Bcrypt: $2a$10$7EqJtq98hPqEX7fNZaFWkO88fJq5q95e26Qe157r6Q29fN7z2c2g2)

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES 
    -- 1. Owner
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@denmodify.com', '$2a$10$7EqJtq98hPqEX7fNZaFWkO88fJq5q95e26Qe157r6Q29fN7z2c2g2', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"role":"owner","full_name":"Kittisak Denowner"}', now(), now(), '', '', '', ''),
    
    -- 2. Admin - Branch 1
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'admin1@denmodify.com', '$2a$10$7EqJtq98hPqEX7fNZaFWkO88fJq5q95e26Qe157r6Q29fN7z2c2g2', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"role":"admin","branch_id":"11111111-1111-1111-1111-111111111111","full_name":"Somchai Branchone"}', now(), now(), '', '', '', ''),
    
    -- 3. Admin - Branch 2
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000021', 'authenticated', 'authenticated', 'admin2@denmodify.com', '$2a$10$7EqJtq98hPqEX7fNZaFWkO88fJq5q95e26Qe157r6Q29fN7z2c2g2', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"role":"admin","branch_id":"22222222-2222-2222-2222-222222222222","full_name":"Anong Branchtwo"}', now(), now(), '', '', '', ''),
    
    -- 4. Technician 1 - Branch 1
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000031', 'authenticated', 'authenticated', 'tech1@denmodify.com', '$2a$10$7EqJtq98hPqEX7fNZaFWkO88fJq5q95e26Qe157r6Q29fN7z2c2g2', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"role":"technician","branch_id":"11111111-1111-1111-1111-111111111111","full_name":"Prasert Wrapmaster"}', now(), now(), '', '', '', ''),
    
    -- 5. Technician 2 - Branch 1
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000032', 'authenticated', 'authenticated', 'tech2@denmodify.com', '$2a$10$7EqJtq98hPqEX7fNZaFWkO88fJq5q95e26Qe157r6Q29fN7z2c2g2', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"role":"technician","branch_id":"11111111-1111-1111-1111-111111111111","full_name":"Wichai Carbonfitter"}', now(), now(), '', '', '', ''),
    
    -- 6. Technician 3 - Branch 2
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000041', 'authenticated', 'authenticated', 'tech3@denmodify.com', '$2a$10$7EqJtq98hPqEX7fNZaFWkO88fJq5q95e26Qe157r6Q29fN7z2c2g2', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"role":"technician","branch_id":"22222222-2222-2222-2222-222222222222","full_name":"Nattapong Tuner"}', now(), now(), '', '', '', ''),
    
    -- 7. Technician 4 - Branch 2
    ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000042', 'authenticated', 'authenticated', 'tech4@denmodify.com', '$2a$10$7EqJtq98hPqEX7fNZaFWkO88fJq5q95e26Qe157r6Q29fN7z2c2g2', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"role":"technician","branch_id":"22222222-2222-2222-2222-222222222222","full_name":"Somsak Detailer"}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- หมายเหตุ: ทริกเกอร์ `on_auth_user_created` ในฐานข้อมูลจะตรวจจับการแทรกข้อมูลนี้ 
-- และเขียนบันทึกลงตาราง public.profiles ให้คุณโดยอัตโนมัติด้วยสิทธิ์ RLS/RBAC ที่สมบูรณ์แบบ
```

5. หลังจากรัน SQL สำเร็จแล้ว คุณสามารถใช้คำสั่งเปิดฐานข้อมูลจำลอง (Seed Database) อื่นๆ ได้อย่างปลอดภัย โดยใช้คำสั่ง:
   ```bash
   supabase db seed
   ```
   *(หรือคัดลอกส่วนที่เหลือของไฟล์ `supabase/seed.sql` ไปรันใน SQL Editor ได้เลย)*

---

### ช่องทางที่ B: การสร้างบัญชีผ่านหน้า Supabase Auth Dashboard (เหมาะสำหรับ Production / Cloud Deployment)

เมื่อนำระบบขึ้นใช้งานจริง (Production) การเพิ่มบัญชีผู้ใช้งานผ่านหน้ากราฟิก (GUI) ของ Supabase Authentication Dashboard จะเป็นแนวทางที่ปลอดภัยสูงสุด โดยระบบจะสร้างรหัส UUID แบบสุ่มให้อัตโนมัติ

**ขั้นตอนปฏิบัติ:**
1. ไปที่หน้า **Supabase Dashboard**
2. เลือกเมนู **Authentication** จากแถบเครื่องมือด้านซ้ายมือ
3. ในแท็บ **Users** ให้คลิกปุ่ม **Add user** ด้านบนขวา แล้วเลือก **Create user**
4. กรอกข้อมูลแต่ละบัญชีดังนี้:
   - **Email:** อีเมลของพนักงาน เช่น `admin1@denmodify.com`
   - **Password:** กำหนดรหัสผ่านที่ต้องการ (เช่น `password123`)
   - ปิดการทำงาน (Uncheck) ของตัวเลือก *Auto-confirm user?* หากต้องการให้ส่งอีเมลยืนยันตัวตนจริง หรือเปิดไว้ (Check) เพื่อข้ามการยืนยันตัวตนสำหรับการรันเดโม
5. **[สำคัญมาก - การตั้งค่า Metadata สำหรับ RBAC & Branch]:** 
   เนื่องจากระบบเรามีข้อบังคับความปลอดภัย RLS แบบแยกสาขา (Branch Isolation) และระบบทริกเกอร์ต้องการข้อมูลระบุตัวตนเพื่อทำงาน โปรดสอดแทรกคุณสมบัติเพิ่มเติมลงในกล่อง **User Metadata** (หากสร้างผ่าน API หรือ Supabase CLI) หรือทำการอัปเดตผ่าน SQL/Dashboard ในภายหลัง

   ตัวอย่างชุด JSON ของพนักงานแต่ละคนเมื่อสร้างผ่าน SDK/API:
   * **สำหรับ Owner:**
     ```json
     {
       "role": "owner",
       "full_name": "Kittisak Denowner"
     }
     ```
   * **สำหรับ Admin สาขาที่ 1:**
     ```json
     {
       "role": "admin",
       "branch_id": "11111111-1111-1111-1111-111111111111",
       "full_name": "Somchai Branchone"
     }
     ```
   * **สำหรับ Technician สาขาที่ 1:**
     ```json
     {
       "role": "technician",
       "branch_id": "11111111-1111-1111-1111-111111111111",
       "full_name": "Prasert Wrapmaster"
     }
     ```

6. เมื่อบัญชีถูกสร้างขึ้นแล้ว **ให้คัดลอกค่า UUID** ที่ได้จากการสุ่มของ Supabase ไปเขียนแทนที่ค่า UUID ในส่วนที่เกี่ยวข้องดังนี้:
   - อัปเดตตาราง `public.profiles` ด้วยคำสั่ง SQL ในคิวรี:
     ```sql
     UPDATE public.profiles 
     SET id = 'UUID_ใหม่_ที่ได้จากหน้า_Dashboard' 
     WHERE email = 'อีเมลของบัญชีนั้นๆ';
     ```
   - หากต้องการทดสอบ Seed ธุรกิจซ้ำด้วยไฟล์ `seed.sql` โปรดแก้ไขค่า UUID ของบัญชีดังกล่าวในหัวข้อ **"B. SEED PROFILES"** ในไฟล์ `supabase/seed.sql` ให้ตรงกับระบบจริงก่อนทำการ Seeding

---

## 3. ข้อมูลทางเทคนิคและสถาปัตยกรรม (Technical Background)

* **ความปลอดภัยของสิทธิ์ (Principle of Least Privilege):** 
  การแยกคำสั่งเพิ่มผู้ใช้ออกจากไฟล์ `seed.sql` หลัก ป้องกันปัญหาระบบไมเกรชันของโปรเจกต์ไปรบกวนโครงสร้างตารางระดับระบบของ Supabase (`auth.*`) ซึ่งต้องควบคุมโดยระบบความปลอดภัยของ Supabase เท่านั้น
* **ระบบซิงก์โปรไฟล์อัตโนมัติ (Trigger Sync):**
  ฟังก์ชัน `public.handle_new_user()` และทริกเกอร์ `on_auth_user_created` จะทำงานในฐานะตัวคอยดักจับแถวข้อมูลใหม่ในตาราง `auth.users` เพื่อดึงข้อมูล `role`, `branch_id`, และ `full_name` จากเมทาดาตาของผู้ใช้เพื่อส่งต่อไปสร้างแถวข้อมูลส่วนตัวในตาราง `public.profiles` ให้อัตโนมัติอย่างถูกต้องและแม่นยำ
* **Branch Isolation & Check Constraints:**
  การสมัครพนักงานในระบบ (Admin/Technician) ต้องส่งค่า `branch_id` ที่มีอยู่จริงเสมอ มิเช่นนั้นระบบจะเกิดข้อผิดพลาดด้านกฎควบคุมฐานข้อมูล (Constraint Validation Error) เนื่องจากมีข้อจำกัดสิทธิ์ห้ามไม่ให้พนักงานที่ไร้สาขาเข้าดำเนินการธุรกรรมใดๆ เพื่อความรัดกุมของข้อมูล
