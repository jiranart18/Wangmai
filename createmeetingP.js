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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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
        required_voters: parseInt(requiredVoters) || 1,
        status: "open",
        creator_id: user.id
    };

    try {
        // 4. ส่งข้อมูลเข้าตาราง 'rooms' 
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


//6.
async function saveRoomToDatabase() {
    // 1. ดึง ID ของคนที่กำลังล็อกอินอยู่ตอนนี้
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        alert("กรุณาล็อกอินก่อนสร้างห้อง!");
        return;
    }

    // 2. ส่งข้อมูลไปเก็บ พร้อมระบุว่าใครเป็นคนสร้าง (creator_id)
    const { error } = await supabase
        .from('rooms')
        .insert([{
        
            meeting_name: roomName, 
            start_date: startDate, 
            end_date: endDate,
            creator_id: user.id 
        
        }]);
}

// ดึงปุ่มทั้งหมดมาสร้าง Event การคลิก
document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', function() {
        // 1. เช็กก่อนว่าปุ่มที่กด "ไม่ใช่" ปุ่ม Continue 
        if (this.id === 'continue-btn') return;

        // 2. ลบสีจากปุ่มอื่นออกให้หมด
        document.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
        
        // 3. เติมสีให้ปุ่มที่เพิ่งกดค้างไว้
        this.classList.add('selected');
    });
});

// เรียกใช้งาน Flatpickr

flatpickr("#startDate", {
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
    minDate: "today",
    disableMobile: true
});

flatpickr("#endDate", {
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
    minDate: "today",
    disableMobile: true
});