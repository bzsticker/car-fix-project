"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Language = "th" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Thai translation dictionary. If key is not found here, it defaults to the English key itself.
const translationDict: Record<string, string> = {
  // Navigation
  "Overview": "ภาพรวมแดชบอร์ด",
  "Branches": "การจัดการสาขา",
  "Customers": "ทะเบียนรายชื่อลูกค้า",
  "Vehicles": "ข้อมูลทะเบียนรถยนต์",
  "Active Jobs": "ตั๋วและคิวงานซ่อม",
  "Invoices": "ใบแจ้งหนี้/ใบเสร็จ",
  "Roster Logs": "บันทึกเวลาทำงานช่าง",
  "Global Stock": "คลังสินค้าส่วนกลาง",
  "Reports": "รายงานผลประกอบการ",
  "Settings": "ตั้งค่าข้อมูลสาขา",
  "POS Cashier": "ขายหน้าร้าน (POS)",
  "Active Tasks": "คิวงานรับซ่อมของฉัน",
  "Logout Shift": "ออกจากกะปฏิบัติงาน",

  // Dashboard Stats / HQ Cards
  "OWNER HQ BOARD": "บอร์ดควบคุมเจ้าของกิจการ HQ",
  "Global operations and multi-branch performance dashboard": "ภาพรวมการดำเนินงานและสถิติประเมินผลประสิทธิภาพแยกรายสาขา",
  "Global Revenue (MTD)": "รายรับรวมสะสมเดือนนี้ (MTD)",
  "Total Active Jobs": "ใบงานซ่อมที่กําลังดําเนินการ",
  "Staff Shift Clocks": "ช่างที่สแกนเข้าเวรวันนี้",
  "Stock Alerts": "รายการแจ้งเตือนคลังวิกฤต",
  "Across 2 active branches": "จากอู่สาขาทุกแห่งที่เปิดทำการ",
  "Today's active timesheet logs": "สถิติช่างเทคนิคลงกะเวลาปัจจุบัน",
  "Low inventory stock level thresholds": "จำนวนสินค้าคงเหลือใกล้เคียงสต็อกขั้นต่ำ",
  "BRANCH PERFORMANCE OVERVIEW": "สรุปสถิติผลงานแยกรายสาขา",
  "TODAY'S SHIFT CLOCKS": "ช่างเทคนิคที่ปฏิบัติงานในวันนี้",
  "No active attendance logs yet.": "ยังไม่มีช่างเทคนิคสแกนลงเวลาเข้าเวรในวันนี้",
  "STOCK LEVEL WARNINGS": "รายการเตือนภัยสินค้าสต็อกคงคลัง",
  "Out of Stock": "สินค้าหมดคลัง",
  "Low Stock": "สต็อกเหลือน้อย",

  // CustomersHQ Directory Page
  "CUSTOMER HQ DIRECTORY": "ทำเนียบประวัติลูกค้าส่วนกลาง",
  "Global management of customers and LINE OA sync across all branches": "การบริหารลูกค้าสะสมและระบบเชื่อมข้อมูล LINE OA ข้ามทุกสาขา",
  "Register Customer": "ลงทะเบียนเปิดบัญชีลูกค้า",
  "Search by name, phone, email...": "ค้นหาด้วยชื่อผู้ติดต่อ, เบอร์โทรศัพท์ หรืออีเมล...",
  "All Branches": "สาขาทั้งหมดของแบรนด์",
  "Name": "ชื่อ-นามสกุล",
  "Branch": "สาขาสังกัด",
  "Phone": "เบอร์โทรติดต่อ",
  "Email": "อีเมลติดต่อ",
  "LINE OA Account": "สถานะเชื่อมบัญชี LINE",
  "Actions": "ดำเนินการ",
  "View Detail": "ดูรายละเอียดเจาะลึก",
  "Timeline": "ดูประวัติช่วงเวลา",
  "Loading directory records...": "กำลังดึงข้อมูลสารบบประวัติ...",
  "No customer accounts found matching search filters.": "ไม่พบข้อมูลบัญชีลูกค้าตรงตามตัวกรองค้นหาปัจจุบัน",
  "Synced": "เชื่อมต่อเรียบร้อย",
  "Unlinked": "ยังไม่ได้เชื่อม",
  
  // Create Customer Modal
  "REGISTER CUSTOMER ACCOUNT": "ลงทะเบียนสร้างโปรไฟล์ลูกค้าใหม่",
  "Target Branch": "สาขาปลายทางที่รองรับการจดทะเบียน",
  "Select a Branch...": "เลือกสาขาอู่ซ่อม...",
  "Full Name": "ชื่อ - นามสกุลจริง",
  "e.g. Apinan Speedster": "เช่น อภินันท์ สปีดเตอร์",
  "Phone Number": "หมายเลขเบอร์โทรศัพท์",
  "e.g. +6681-555-0199": "เช่น 081-555-0199",
  "Email Address": "ที่อยู่อีเมลติดต่อ",
  "e.g. apinan@gmail.com": "เช่น apinan@gmail.com",
  "LINE User ID (Optional)": "พิกัดรหัสผู้ใช้ LINE (ถ้ามี)",
  "e.g. U1234567890abcdef...": "เช่น U1234567890abcdef...",
  "Cancel": "ยกเลิกการบันทึก",
  "Register Account": "บันทึกและเปิดบัญชี"
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("th");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("den_modify_lang") as Language;
    const timer = setTimeout(() => {
      if (savedLang === "th" || savedLang === "en") {
        setLanguageState(savedLang);
      }
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("den_modify_lang", lang);
  };

  const t = (key: string): string => {
    if (language === "en") {
      return key;
    }
    return translationDict[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {mounted ? children : <div className="invisible">{children}</div>}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
