# รายงานการวิเคราะห์และวินิจฉัยจุดบกพร่องระบบลงทะเบียนผู้ใช้งาน (AUTH_TRIGGER_DEBUG_REPORT.md)

**โครงการ:** Den Modify Management System  
**ประเภทรายงาน:** รายงานวิเคราะห์ข้อผิดพลาดวิกฤต (Critical Production Debug Report)  
**ปัญหาที่พบ:** ผู้ใช้งานใหม่ไม่สามารถลงทะเบียนเข้าใช้งานระบบได้ โดยเกิดข้อผิดพลาดระดับระบบหน้าต่างว่า `Failed to create user: Database error creating new user`

---

## 1. ผลสรุปการวิเคราะห์สาเหตุหลัก (Root Cause Analysis Summary)

จากการตรวจสอบฟังก์ชันดักจับธุรกรรมการสมัครสมาชิก ค่านโยบายความปลอดภัย RLS และกฎข้อบังคับเงื่อนไขระดับตาราง (Table Constraints) พบว่าสาเหตุของปัญหาเกิดจากการทำงานที่ขัดแย้งกันอย่างรุนแรงระหว่าง **ฟังก์ชันทริกเกอร์สร้างโปรไฟล์อัตโนมัติ (`public.handle_new_user`)** และ **เงื่อนไขบังคับสัญญลักษณ์ของสิทธิ์สาขาในตารางโปรไฟล์ (`check_role_branch_association`)** 

เมื่อมีการสมัครใช้งานบัญชีผ่าน Supabase Auth ฟังก์ชันจะดักจับข้อมูลและพยายามสั่งรัน SQL เพื่อป้อนข้อมูลพนักงานใหม่เป็นบทบาท `'technician'` โดยไม่มีรหัสสาขาป้อนเข้ามาด้วย ส่งผลให้การสมัครแทรกลงฐานข้อมูลถูกยกเลิกทันที (SQL Constraint Transaction Aborted)

---

## 2. ขั้นตอนการวิเคราะห์เชิงลึก (Deep-Dive Investigation)

### 1) การวิเคราะห์พฤติกรรมฟังก์ชันทริกเกอร์ `public.handle_new_user()`
สคริปต์ทริกเกอร์ปัจจุบันถูกดีไซน์ไว้ดังนี้:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role VARCHAR(50);
    default_branch UUID;
BEGIN
    -- 1. ตรวจสอบ Role จาก Metadata ของผู้ใช้ หากไม่มีจะตั้งต้นเป็น 'technician'
    default_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'technician');
    
    -- 2. ดึงค่ารหัสสาขา หากการแปลง UUID ผิดพลาดจะแปลงเป็น NULL
    BEGIN
        default_branch := (NEW.raw_user_meta_data ->> 'branch_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
        default_branch := NULL;
    END;
    
    -- 3. สั่ง INSERT บันทึกข้อมูลลงตาราง public.profiles
    INSERT INTO public.profiles (id, email, full_name, role, branch_id, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        default_role,
        default_branch,
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**สิ่งที่เกิดขึ้นเมื่อสมัครสมาชิกปกติ:**
* เมื่อผู้ใช้สมัครสมาชิกผ่านหน้าเว็บไซต์หลัก หรือสมัครผ่าน Dashboard โดยไม่ได้ระบุเมทาดาตา (เช่น การกดยืนยันผ่านอีเมลแบบทั่วไป)
* `NEW.raw_user_meta_data` จะมีค่าเป็น **`NULL`** หรือไม่มีฟิลด์ข้อมูล
* ทำให้ตัวแปร `default_role` ได้รับค่าเริ่มต้นเป็น **`'technician'`**
* และตัวแปร `default_branch` ได้รับค่าเป็น **`NULL`**

---

### 2) การวิเคราะห์ข้อจำกัดความสอดคล้องระดับตาราง (profiles constraints)
เมื่อย้อนกลับมาดูการประกาศสร้างตาราง `public.profiles` ในฐานข้อมูลหลัก:
```sql
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'technician')),
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- กฎข้อบังคับเรื่องสิทธิ์และสาขา (CHECK Constraint)
    CONSTRAINT check_role_branch_association CHECK (
        (role = 'owner' AND branch_id IS NULL) OR
        (role IN ('admin', 'technician') AND branch_id IS NOT NULL)
    )
);
```

จะพบว่าตารางมีกฎข้อบังคับเข้มงวดคือ **`check_role_branch_association`** ซึ่งกำหนดนโยบายทางธุรกิจว่า:
1. หากเป็นบทบาทเจ้าของร้าน (`'owner'`) -> จะต้อง **ไม่มี** รหัสสาขา (`branch_id IS NULL`)
2. หากเป็นผู้ดูแลสาขาหรือช่างเทคนิค (`'admin'` หรือ `'technician'`) -> จะต้อง **มี** รหัสสาขาเสมอ (`branch_id IS NOT NULL`)

---

### 3) จุดล้มเหลววิกฤตเมื่อรันคำสั่ง (The Critical Failure Point)
เมื่อผู้สมัครปกติกรอกข้อมูลสมัครเข้ามา สคริปต์ทริกเกอร์จะรันคำสั่ง SQL จริงนี้เพื่อลงบันทึก:

```sql
-- EXACT SQL ที่รันล้มเหลว
INSERT INTO public.profiles (id, email, full_name, role, branch_id, is_active)
VALUES (
    'รหัส-UUID-ผู้ใช้งานใหม่',
    'user@example.com',
    'user@example.com',
    'technician', -- ได้รับบทบาท Technician เป็นดีฟอลต์
    NULL,         -- ได้รับค่าสาขาเป็น NULL เนื่องจากไม่มีส่งมาในเมทาดาตา
    true
);
```

เมื่อ PostgreSQL รันคำสั่งแทรกข้างต้น จะทำการตรวจสอบความถูกต้องตามกฎของตาราง:
```text
ตรวจสอบความถูกต้องของกฎ: check_role_branch_association
สูตรการประเมิน: (role = 'owner' AND branch_id IS NULL) OR (role IN ('admin', 'technician') AND branch_id IS NOT NULL)

แทนค่าจริงจากคำสั่ง SQL:
= ('technician' = 'owner' AND NULL IS NULL) OR ('technician' IN ('admin', 'technician') AND NULL IS NOT NULL)
= (FALSE AND TRUE) OR (TRUE AND FALSE)
= FALSE OR FALSE
= FALSE
```

**ผลลัพธ์:** การตรวจสอบเงื่อนไขได้ค่าเป็น **`FALSE`** ฐานข้อมูล PostgreSQL จึงทำการดีดการทำรายการออกและแจ้งข้อผิดพลาด **`CHECK Constraint Violation`** ทันที ทำให้ขั้นตอนสร้างข้อมูลผู้ใช้ในตารางระบบ `auth.users` แท้งและยกเลิกกระบวนการทั้งหมด ส่งผลให้หน้าจอรายงานว่า `Database error creating new user`

---

## 3. สรุปความขัดแย้งของข้อจำกัด (Constraint Flaw Matrix)

| ปัจจัยที่ตรวจสอบ | ข้อมูลที่ส่งเข้ามาจริง | ข้อบังคับเงื่อนไขของระบบ | สถานะการประเมินผล | ผลการทำงาน |
|---|---|---|---|---|
| **บทบาทผู้ใช้ (Role)** | `'technician'` (ค่าดีฟอลต์จากทริกเกอร์) | ต้องเป็น `owner`, `admin` หรือ `technician` | **ผ่าน (PASS)** | ตรงตามค่าใน CHECK list |
| **รหัสสาขา (Branch ID)** | `NULL` (เนื่องจากไม่มีส่งมาใน metadata) | หากเป็น technician จะต้องเป็นคีย์นอกอ้างอิงตารางสาขาจริง | **ผ่าน (PASS)** | สามารถเป็น NULL ได้ถ้าไม่มีสัญญลักษณ์ข้อห้ามอื่น |
| **ความสัมพันธ์ของบทบาท (check_role_branch_association)** | `role='technician'` พร้อม `branch_id=NULL` | ห้ามช่างเทคนิคไม่มีสังกัดสาขาเด็ดขาด เพื่อความปลอดภัย RLS แยกสาขา | **ล้มเหลว (FAIL)** | **ละเมิดกฎข้อบังคับ (Constraint Violation)** |

---

## 4. แนะนำแนวทางแก้ไขปัญหาขั้นถัดไป (Proposed Technical Solutions)

เพื่อขจัดปัญหานี้โดยไม่รบกวนนโยบายความปลอดภัยระดับสาขา (Branch Isolation) มีทางเลือกหลัก 2 แนวทางในการแก้ไขเมื่อได้รับอนุญาตให้ดัดแปลงสคริปต์:

### แนวทางที่ A: แก้ไขที่ตรรกะของ Trigger Function (แนะนำสูงสุด - ปลอดภัย ไม่กระทบโครงสร้างหลัก)
ปรับปรุงเงื่อนไขในฟังก์ชัน `public.handle_new_user()` ให้มีความยืดหยุ่นขึ้น โดยหากไม่มีรหัสสาขาเข้ามา ให้เปลี่ยนบทบาทเริ่มต้นเป็น `'owner'` ชั่วคราว หรือทำการค้นหารหัสสาขาหลัก (Bangkok HQ) มาสวมสิทธิ์ให้อัตโนมัติ แทนการปล่อยให้ล้มเหลว
*ตัวอย่างตรรกะแก้ไข:*
```sql
-- ค้นหารหัสสาขาแรกของร้านมาเป็นสาขาเริ่มต้น ป้องกันข้อมูลขัดแย้ง
SELECT id INTO default_branch FROM public.branches ORDER BY created_at ASC LIMIT 1;
```

### แนวทางที่ B: ปรับเปลี่ยนเงื่อนไขระดับตาราง (Table Constraint Modification)
ปรับข้อจำกัดเงื่อนไขให้ยอมรับค่าช่างเทคนิคที่รออนุมัติสังกัดสาขาได้ชั่วคราว เช่น ยอมให้ `branch_id` เป็น NULL ในขั้นตอนแรกเริ่ม แล้วค่อยทำการจำกัดสิทธิ์ใช้งานผ่านค่านโยบาย RLS แทน
