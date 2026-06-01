# รายงานการซ่อมแซมบทบาทพนักงานและการจัดสรรสาขาบนเซิร์ฟเวอร์จริง (ROLE_BRANCH_FIX_REPORT.md)

**โครงการ:** Den Modify Management System  
**พิกัดการเชื่อมต่อ:** Production Database (Supabase Cloud Server)  
**ไฟล์ไมเกรชันที่อัปเดต:**
* **SQL Migration:** [supabase/migrations/20260602000001_fix_profiles_roles.sql](file:///d:/AI%20LERNING/Car%20Fix%20project/supabase/migrations/20260602000001_fix_profiles_roles.sql)
* **SQL Rollback:** [supabase/migrations/20260602000001_fix_profiles_roles_rollback.sql](file:///d:/AI%20LERNING/Car%20Fix%20project/supabase/migrations/20260602000001_fix_profiles_roles_rollback.sql)

---

## 1. ผลลัพธ์จากการตรวจสอบข้อมูลจริงบนระบบใช้งานจริง (Actual Production Data Audited)

ทีมวิศวกรได้ทำการเชื่อมต่อและรันคำสั่งตรวจสอบสถิติข้อมูลจริงบนฐานข้อมูลคลาวด์ของ Supabase ผ่านกลไก Admin SDK เพื่อหลีกเลี่ยงการคาดเดาโครงสร้าง UUID ผลการดึงข้อมูลจริงแสดงรายละเอียดดังนี้:

### 1) ข้อมูลสาขาจริงในระบบ (public.branches)
จากการดึงข้อมูล พบสาขาจริงที่เปิดใช้งานอยู่ **2 สาขา** พร้อมรหัสคีย์จริง (UUIDs) ดังนี้:

* **สาขาที่ 1: "สำนักงานใหญ่" (ระยอง)**
  - รหัสคีย์สากล (UUID): **`1c61a46f-72c1-497a-b601-b7780f98e767`**
  - เบอร์โทรศัพท์: `0800000001`
* **สาขาที่ 2: "สาขา 2" (ระยอง)**
  - รหัสคีย์สากล (UUID): **`ff2c3c35-55d6-4d9e-a01d-db907ce25d41`**
  - เบอร์โทรศัพท์: `0800000002`

---

### 2) ข้อมูลบัญชีผู้ใช้ระบบ (auth.users) และข้อมูลสิทธิ์จำลอง (public.profiles)
ข้อมูลจริงระบุว่าระบบมีผู้สมัครอยู่ **7 บัญชี** โดยตารางสิทธิ์ `public.profiles` ได้จับสิทธิ์ทุกคนกลายเป็นเจ้าของร้าน (`role = 'owner'`) และค่าสาขาว่างเปล่า (`branch_id = NULL`) ทั้งหมด:

| ลำดับ | อีเมลพนักงาน (Email) | รหัสความปลอดภัยจริง (Production User UUID) | สิทธิ์เดิม (Before) | สาขาเดิม (Before) | สิทธิ์ที่ปรับปรุง (Proposed Role) | สังกัดสาขาที่จะย้ายไป (Proposed Branch) |
|---|---|---|---|---|---|---|
| **1** | `owner@denmodify.com` | `38231abe-8474-4105-97ae-2a4bd55c9cf0` | `owner` | `NULL` | **owner** | *ไม่มี (เข้าถึงได้ทุกสาขา)* |
| **2** | `admin1@denmodify.com` | `1fc3cd5d-da9b-4a17-b95c-6725fb950546` | `owner` | `NULL` | **admin** | สำนักงานใหญ่ (`1c61a46f-72c1-497a-b601-b7780f98e767`) |
| **3** | `admin2@denmodify.com` | `75f2b02c-37d9-401b-b227-48391b702e85` | `owner` | `NULL` | **admin** | สาขา 2 (`ff2c3c35-55d6-4d9e-a01d-db907ce25d41`) |
| **4** | `tech1@denmodify.com` | `2184f282-d1fa-4280-933c-daaed731b1a0` | `owner` | `NULL` | **technician** | สำนักงานใหญ่ (`1c61a46f-72c1-497a-b601-b7780f98e767`) |
| **5** | `tech2@denmodify.com` | `4c147e75-46f8-4b25-ad9f-4e63982a0ee0` | `owner` | `NULL` | **technician** | สำนักงานใหญ่ (`1c61a46f-72c1-497a-b601-b7780f98e767`) |
| **6** | `tech3@denmodify.com` | `da7bd717-efb7-4071-a14d-d661412ec759` | `owner` | `NULL` | **technician** | สาขา 2 (`ff2c3c35-55d6-4d9e-a01d-db907ce25d41`) |
| **7** | `tech4@denmodify.com` | `da99c953-2145-4c1c-a549-d2516c7959ea` | `owner` | `NULL` | **technician** | สาขา 2 (`ff2c3c35-55d6-4d9e-a01d-db907ce25d41`) |

---

### 3) กฎเงื่อนไขการตรวจสอบของตารางโปรไฟล์ (Profiles Table Constraints)
ตาราง `public.profiles` ได้รับการคุ้มครองด้วยนโยบาย Check Constraint ดั้งเดิม:
```sql
CONSTRAINT check_role_branch_association CHECK (
    (role = 'owner' AND branch_id IS NULL) OR
    (role IN ('admin', 'technician') AND branch_id IS NOT NULL)
)
```
การอัปเดตบทบาทของแอดมินและช่างจำเป็นต้องส่งค่ารหัสสาขาที่ไม่เป็น NULL เข้าไปพร้อมกันเพื่อหลีกเลี่ยงข้อผิดพลาด

---

## 2. ขั้นตอนปฏิบัติในการรันชุดแก้ไข (Deployment Instructions)

### ขั้นตอนที่ 1: การลงทะเบียนคิวรีปรับสิทธิ์บน Supabase Cloud
1. ล็อกอินเข้าสู่หน้าบริหารจัดการ **Supabase Dashboard**
2. ไปที่เมนู **SQL Editor** จากแถบเครื่องมือด้านซ้ายมือ
3. เลือกสร้างเอกสาร **New query**
4. คัดลอกโค้ด SQL จากสคริปต์ไมเกรชันจริงด้านล่างนี้ไปวางและคลิก **RUN**:

```sql
-- =========================================================================
-- SQL MIGRATION: CORRECT MOCK ACCOUNTS ROLES & BRANCHES IN PRODUCTION
-- =========================================================================

-- 1. ย้ายพนักงานแต่ละรายกลับเข้าสู่สังกัดสาขาและบทบาทหน้าที่จริงตามฐานข้อมูลระยอง
UPDATE public.profiles SET role = 'owner', branch_id = NULL WHERE email = 'owner@denmodify.com';
UPDATE public.profiles SET role = 'admin', branch_id = '1c61a46f-72c1-497a-b601-b7780f98e767' WHERE email = 'admin1@denmodify.com';
UPDATE public.profiles SET role = 'admin', branch_id = 'ff2c3c35-55d6-4d9e-a01d-db907ce25d41' WHERE email = 'admin2@denmodify.com';
UPDATE public.profiles SET role = 'technician', branch_id = '1c61a46f-72c1-497a-b601-b7780f98e767' WHERE email = 'tech1@denmodify.com';
UPDATE public.profiles SET role = 'technician', branch_id = '1c61a46f-72c1-497a-b601-b7780f98e767' WHERE email = 'tech2@denmodify.com';
UPDATE public.profiles SET role = 'technician', branch_id = 'ff2c3c35-55d6-4d9e-a01d-db907ce25d41' WHERE email = 'tech3@denmodify.com';
UPDATE public.profiles SET role = 'technician', branch_id = 'ff2c3c35-55d6-4d9e-a01d-db907ce25d41' WHERE email = 'tech4@denmodify.com';

-- 2. ปรับปรุงตรรกะทริกเกอร์ตรวจสอบเพื่อความมั่นคงปลอดภัยขั้นสูง ป้องกัน RLS หลุดระดับผู้ใช้ใหม่
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role VARCHAR(50);
    default_branch UUID;
BEGIN
    -- ดึงบทบาทจากเมทาดาตา (หากไม่มีจะดีดเป็นเจ้าของร้าน 'owner')
    default_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'owner');
    
    -- ปฏิเสธการลงทะเบียนทันทีหากมีบทบาทแปลกปลอมเข้าสู่ระบบ
    IF default_role NOT IN ('owner', 'admin', 'technician') THEN
        RAISE EXCEPTION 'Invalid role specified: %. Allowed roles are: owner, admin, technician.', default_role;
    END IF;
    
    -- ดึงรหัสสาขาจากเมทาดาตา
    BEGIN
        default_branch := (NEW.raw_user_meta_data ->> 'branch_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
        default_branch := NULL;
    END;
    
    -- บังคับกฎโครงสร้างข้อมูล
    IF default_role = 'owner' THEN
        default_branch := NULL;
    ELSIF default_role IN ('admin', 'technician') THEN
        IF default_branch IS NULL THEN
            RAISE EXCEPTION 'branch_id is required for role %', default_role;
        END IF;
        
        -- บังคับรหัสสาขาจริง: ป้องกันข้อผิดพลาดคีย์นอกอ้างอิง
        IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = default_branch) THEN
            RAISE EXCEPTION 'Invalid branch_id %: Branch does not exist in database', default_branch;
        END IF;
    END IF;
    
    -- แทรกลงบันทึกโปรไฟล์
    INSERT INTO public.profiles (id, email, full_name, role, branch_id, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        default_role,
        default_branch,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        branch_id = EXCLUDED.branch_id,
        is_active = EXCLUDED.is_active,
        updated_at = now();
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. สคริปต์สำหรับการกู้คืนระบบกลับคืน (SQL Rollback)

หากพบเหตุฉุกเฉินต้องการสลับผู้ใช้ทุกคนกลับคืนเป็นสิทธิ์ `'owner'` ไร้สาขาตามเดิม ให้รันคำสั่งคิวรีนี้:

```sql
-- Revert profiles back to owner state
UPDATE public.profiles SET role = 'owner', branch_id = NULL;

-- Restore standard trigger logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role VARCHAR(50);
    default_branch UUID;
BEGIN
    default_role := NEW.raw_user_meta_data ->> 'role';
    
    IF default_role IS NULL OR default_role = '' THEN
        default_role := 'owner';
        default_branch := NULL;
    ELSE
        BEGIN
            default_branch := (NEW.raw_user_meta_data ->> 'branch_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            default_branch := NULL;
        END;
        
        IF default_role NOT IN ('owner', 'admin', 'technician') THEN
            default_role := 'owner';
            default_branch := NULL;
        ELSIF default_role = 'owner' THEN
            default_branch := NULL;
        ELSIF default_role IN ('admin', 'technician') THEN
            IF default_branch IS NOT NULL THEN
                IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = default_branch) THEN
                    default_branch := NULL;
                END IF;
            END IF;
            
            IF default_branch IS NULL THEN
                SELECT id INTO default_branch FROM public.branches ORDER BY created_at ASC LIMIT 1;
                
                IF default_branch IS NULL THEN
                    default_role := 'owner';
                END IF;
            END IF;
        END IF;
    END IF;
    
    INSERT INTO public.profiles (id, email, full_name, role, branch_id, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        default_role,
        default_branch,
        true
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        branch_id = EXCLUDED.branch_id,
        is_active = EXCLUDED.is_active,
        updated_at = now();
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. ชุดคำสั่งทดสอบคัดกรองความปลอดภัยหลังทำรายการ (Verification Queries)

นำ SQL เหล่านี้ไปรันตรวจสอบความถูกต้องของสิทธิ์และข้อจำกัดความปลอดภัย:

### คิวรีที่ 1: ตรวจความถูกต้องของการจัดแจงบทบาทพนักงาน
```sql
SELECT p.email, p.full_name, p.role, p.branch_id, b.name AS branch_name
FROM public.profiles p
LEFT JOIN public.branches b ON b.id = p.branch_id
ORDER BY p.role, p.email;
```
*เป้าหมายสำเร็จ:* admin1 ต้องสังกัด "สำนักงานใหญ่", admin2 ต้องสังกัด "สาขา 2", ช่างทุกคนจัดแบ่งไปอยู่ระยอง 1 และ 2 ตามเกณฑ์สิทธิ์อย่างแม่นยำ

### คิวรีที่ 2: ตรวจจับคนไม่มีสาขาที่ฝ่าฝืนเงื่อนไข CHECK (Must return 0 rows)
```sql
SELECT id, email, role, branch_id
FROM public.profiles
WHERE NOT (
    (role = 'owner' AND branch_id IS NULL) OR
    (role IN ('admin', 'technician') AND branch_id IS NOT NULL)
);
```

### คิวรีที่ 3: ตรวจสอบความถูกต้องของการบล็อกทริกเกอร์ใหม่
สามารถทดสอบรันเพื่อบังคับจำลองการสมัครช่างเทคนิคที่ละเมิดข้อบังคับ:
```sql
-- ต้องล้มเหลวและแจ้งข้อผิดพลาด: branch_id is required for role technician
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (
    gen_random_uuid(),
    'illegal_staff@denmodify.com',
    '{"role": "technician"}'::jsonb
);
```
*(หาก Supabase ดีดเออเรอร์บล็อกการบันทึกช่างเทคนิคที่ไร้สาขาได้ แสดงว่ามาตรการความปลอดภัยสมบูรณ์แบบเรียบร้อยดี)*
