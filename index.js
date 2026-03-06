import { supabase } from './supabase-config.js';

// 1. โลจิคเลือกประเภทการประชุม (Toggle Active State)
const typeButtons = document.querySelectorAll('.type-btn');
let selectedType = "Group Work";

typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // ลบ class active จากปุ่มอื่น
        typeButtons.forEach(b => b.classList.remove('active'));
        // เพิ่ม class active ให้ปุ่มที่คลิก
        btn.classList.add('active');
        selectedType = btn.innerText;
    });
});

// 2. โลจิคส่งข้อมูลไป Database เมื่อกด Continue
const btnContinue = document.getElementById('btnContinue');

btnContinue.addEventListener('click', async () => {
    // 1. ดึงค่าจาก Input ให้ครบ
    const name = document.getElementById('meetingName').value.trim();
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    const requiredVoters = document.getElementById("requiredVoters").value;

    // 2. Error Handling
    if (!name || !start || !end) {
        alert("Please fill in all fields!");
        return;
    }

    // 3. รวมข้อมูลที่จะส่ง (เตรียม Object เดียวให้เรียบร้อย)
    const meetingData = {
        title: name,              // ใช้ name ที่ดึงมาด้านบน
        type: selectedType,
        dates: { start: start, end: end },
        required_voters: parseInt(requiredVoters) || 1, // เพิ่มตัวนี้เข้าไป
        status: "open"
    };

    try {
        // 4. ส่งข้อมูลเข้าตาราง 'rooms' (ส่งครั้งเดียวพอครับ)
        const { data, error } = await supabase
            .from('rooms')
            .insert([meetingData])
            .select();

        if (error) throw error;

        // 5. เมื่อบันทึกสำเร็จ ย้ายไปหน้าโหวต
        if (data && data.length > 0) {
            window.location.href = `vote.html?id=${data[0].id}`;
        }
    } catch (err) {
        console.error("Error creating meeting:", err.message);
        alert("Failed to create meeting: " + err.message);
    }
});

const today = new Date();

// แปลงให้อยู่ในรูปแบบ YYYY-MM-DD
const formattedDate = today.toISOString().split("T")[0];

document.getElementById("startDate").value = formattedDate;
document.getElementById("endDate").value = formattedDate;