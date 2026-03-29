// --- หน้า dashboard.js ---
import { supabase } from './supabase-config.js';

// --- 1. ตรวจสอบการเข้าถึง และเริ่มทำงาน ---
async function initializeDashboard() {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
        window.location.replace("login.html");
        return;
    }

    const userId = session.user.id; 
    console.log("Logged in as:", session.user.email);

    // เริ่มโหลดข้อมูลครั้งแรก
    loadMyMeetings(userId);
    
    // เริ่มระบบ Realtime (อัปเดตอัตโนมัติ)
    startRealtime(userId);
}

// --- 2. ฟังก์ชันโหลดข้อมูล ---
async function loadMyMeetings(userId) {
    const activeCountEl = document.getElementById('activeCount');
    const activeContainer = document.getElementById('activeMeetings'); // เช็กว่าใน HTML มี ID นี้ไหม
    const completedContainer = document.getElementById('completedMeetings');
    const mainContainer = document.getElementById('meetingsContainer');

    try {
        const { data: rooms, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('creator_id', userId) 
            .order('created_at', { ascending: false });

        if (error) throw error;

        // กรณีไม่มีข้อมูลเลย
        if (!rooms || rooms.length === 0) {
            if (activeCountEl) activeCountEl.innerText = "0";
            if (mainContainer) {
                mainContainer.innerHTML = `<div class="empty-state"><p>ยังไม่มีห้องประชุมที่คุณสร้างไว้</p></div>`;
            }
            return;
        }

        // แยกกลุ่มข้อมูลตาม Status
        const activeRooms = rooms.filter(r => r.status === 'open' || !r.status);
        const completedRooms = rooms.filter(r => r.status === 'finalized' || r.status === 'completed');

        // อัปเดตตัวเลข Active Meetings
        if (activeCountEl) {
            activeCountEl.innerText = activeRooms.length;
        }

        // ฟังก์ชันสร้าง HTML Card
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

        // นำข้อมูลลง Container
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

        // ซ่อนข้อความ Loading
        if (mainContainer && rooms.length > 0) {
             // ถ้าคุณต้องการซ่อน mainContainer เมื่อมีข้อมูลในกล่องแยก ให้เปิดบรรทัดล่าง
             // mainContainer.style.display = 'none'; 
        }

    } catch (err) {
        console.error("Error loading meetings:", err.message);
    }
}

// --- 3. ระบบ Realtime ---
function startRealtime(userId) {
    supabase
      .channel('rooms-follow')
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'rooms',
          filter: `creator_id=eq.${userId}` // ตามเฉพาะห้องที่เราเป็นเจ้าของ
      }, (payload) => {
          console.log('Change detected:', payload);
          loadMyMeetings(userId); // โหลดใหม่ทันที
      })
      .subscribe();
}

// --- 4. ระบบ Logout ---
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        if (!confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) return;
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.replace("login.html");
    };
}

// เริ่มการทำงาน
initializeDashboard();