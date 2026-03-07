// --- หน้า dashboard.html (My Meetings) ---
import { supabase } from './supabase-config.js';

const { data } = await supabase.auth.getSession();
if (!data.session) {
    window.location.href = "login.html"; // ถ้าไม่มี session ให้ไล่กลับไปหน้า login
}

// --- 1. ตรวจสอบการเข้าถึง (Access Control) ---
async function initializeDashboard() {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
        window.location.replace("login.html");
        return;
    }

    const userId = session.user.id; // เก็บ ID ของผู้ใช้ปัจจุบันไว้
    console.log("Logged in as:", session.user.email);

    // เริ่มโหลดข้อมูลห้องประชุม
    loadMyMeetings(userId);
}

async function loadMyMeetings(userId) {
    // ดึง Element จาก HTML
    const activeContainer = document.getElementById('activeMeetings'); 
    const completedContainer = document.getElementById('completedMeetings');
    const mainContainer = document.getElementById('meetingsContainer'); // สำหรับกรณีไม่มีห้องเลย

    try {
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('creator_id', userId) 
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 1. ถ้าไม่มีข้อมูลเลย ให้แสดงข้อความว่างเปล่าใน Container หลัก
        if (!rooms || rooms.length === 0) {
            mainContainer.innerHTML = `<div class="empty-state"><p>ยังไม่มีห้องประชุมที่คุณสร้างไว้</p></div>`;
            return;
        }

        // 2. แยกกลุ่มข้อมูลตาม Status
        const activeRooms = rooms.filter(r => r.status === 'open' || !r.status); // รวมค่าว่างให้เป็น open
        const completedRooms = rooms.filter(r => r.status === 'finalized' || r.status === 'completed');

        // ใส่ไว้หลังจากที่ filter ข้อมูลแล้ว
        document.getElementById('activeCount').innerText = activeRooms.length;
        // 3. ฟังก์ชันสร้าง HTML Card
        const createCardHTML = (room, isCompleted) => `
            <div class="meeting-card ${isCompleted ? 'completed' : ''}">
                <div class="card-header">
                    <h3>${room.meeting_name || room.title || 'ไม่มีชื่อห้อง'}</h3>
                    <span class="badge ${isCompleted ? 'badge-done' : 'badge-active'}">
                        ${isCompleted ? '✅ สรุปผลแล้ว' : '🔥 กำลังเปิดโหวต'}
                    </span>
                </div>
                <div class="card-body">
                    <p>📅 ${room.start_date || room.dates?.start} - ${room.end_date || room.dates?.end}</p>
                </div>
                <div class="card-footer">
                    ${isCompleted 
                        ? `<button class="btn-result" onclick="location.href='results.html?id=${room.id}'">ดูผลสรุปท้ายสุด</button>`
                        : `<button class="btn-primary" onclick="location.href='results.html?id=${room.id}'">ดูผลเรียลไทม์</button>
                           <button class="btn-secondary" onclick="location.href='vote.html?id=${room.id}'">ไปหน้าโหวต</button>`
                    }
                </div>
            </div>
        `;

        // 4. นำข้อมูลไปใส่ในแต่ละ Container
        if (activeContainer) {
            activeContainer.innerHTML = activeRooms.length > 0 
                ? activeRooms.map(r => createCardHTML(r, false)).join('') 
                : '<p class="empty-text">ไม่มีรายการที่กำลังโหวต</p>';
        }

        if (completedContainer) {
            completedContainer.innerHTML = completedRooms.length > 0 
                ? completedRooms.map(r => createCardHTML(r, true)).join('') 
                : '<p class="empty-text">ไม่มีรายการที่สรุปผลแล้ว</p>';
        }

        // ซ่อนตัว Container หลักถ้ามีการแยกส่วนแล้ว
        if (mainContainer) mainContainer.style.display = 'none';

    } catch (err) {
        console.error("Error loading meetings:", err.message);
        if (mainContainer) mainContainer.innerHTML = `<p style="color:red;">เกิดข้อผิดพลาด: ${err.message}</p>`;
    }
}
// --- 3. ระบบ Logout ---
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        if (!confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) return;
        
        try {
            await supabase.auth.signOut();
            localStorage.clear();
            window.location.replace("login.html");
        } catch (err) {
            console.error("Logout error:", err);
            window.location.replace("login.html");
        }
    };
}

// รันฟังก์ชันหลักเมื่อโหลดหน้า
initializeDashboard();