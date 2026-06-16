# ปฏิทินจองห้อง LRC

โปรเจกต์นี้แยกออกมาจาก `public/lrc-bk/index.html` เพื่อเปิดดูปฏิทินจองห้อง LRC แบบ standalone โดยไม่ต้องผ่านหน้า login ของระบบจองหลัก

## ไฟล์

- `index.html` หน้าเว็บปฏิทิน
- `style.css` style เฉพาะปฏิทินและ responsive mobile
- `script.js` โหลดข้อมูลจาก Apps Script action `listCalendarBookings`
- `Code.gs` Apps Script backend แบบ public สำหรับปฏิทิน ไม่ต้อง login
- `logo.png` โลโก้ที่คัดมาจากระบบจองห้องเดิม

## การตั้งค่า API

1. เปิด Apps Script project ใหม่
2. วาง `Code.gs` ทั้งไฟล์
3. Deploy เป็น Web app
   - Execute as: Me
   - Who has access: Anyone
4. นำ Web App URL ที่ได้มาใส่ใน `script.js`

```js
const API_URL = '.../exec';
```

ไม่ควรใช้ URL ของ backend ระบบจองหลัก ถ้า backend นั้นยังบังคับ session/token อยู่
