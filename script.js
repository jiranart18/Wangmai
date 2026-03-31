import { supabase } from './supabase-config.js';

// 1. รับ ID จาก URL
const params = new URLSearchParams(window.location.search);
const roomId = params.get('id');

// 2. เริ่มต้นหน้าเว็บ
async function initVotingPage() {
  if (!roomId) {
    alert("ไม่พบรหัสห้องประชุม");
    return;
  }

  // ดึงข้อมูลการนัดหมายจาก Supabase
  const { data: meeting, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error || !meeting) {
    console.error("Error fetching meeting:", error);
    document.getElementById('roomNameDisplay').innerText =
      "ไม่พบข้อมูลห้องประชุม";
    return;
  }

  // 3. แสดงชื่อห้องจริงแทน ID
  document.getElementById(
    'roomNameDisplay'
  ).innerText = `you are in the room: ${meeting.title}`;

  // 4. สร้างรายการวันที่ (Logic: วนลูปจาก Start Date ถึง End Date)
  const startDate = new Date(meeting.dates.start);
  const endDate = new Date(meeting.dates.end);
  const dateList = [];

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dateList.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 5. สั่งวาดตาราง
  renderGrid(dateList);
}

// ฟังก์ชันวาดตาราง HTML
function renderGrid(dateList) {
  const tableHeader = document.getElementById('tableHeader');
  const tableBody = document.getElementById('tableBody');

  tableHeader.innerHTML =  '';
  tableBody.innerHTML = '';

  // กำหนดช่วงเวลา 
  const timeSlots = [
    "07:00","08:00","09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00",
    "17:00", "18:00","19:00"
  ];

  // วาดหัวตาราง (วันที่)
  let headerHTML = '<th>เวลา</th>';

  dateList.forEach(date => {
    const dStr = date.toLocaleDateString('th-TH', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });

    headerHTML += `<th>${dStr}</th>`;
  });

  tableHeader.innerHTML = headerHTML;

  // วาดแถวเวลาและช่องโหวต
  let bodyHTML = '';

  timeSlots.forEach(time => {
    bodyHTML += `<tr><td class="time-label">${time}</td>`;

    dateList.forEach(date => {
      const dateISO = date.toISOString().split('T')[0];
      const slotId = `slot-${dateISO}-${time}`; // สร้าง ID เฉพาะตัว

      bodyHTML += `
        <td id="${slotId}" 
            class="vote-cell state-0"
            data-state="0"
            data-time="${time}"
            data-date="${dateISO}">
        </td>
      `;
    });
    bodyHTML += '</tr>';
  });

  tableBody.innerHTML = bodyHTML;

  // เมื่อวาดเสร็จ ให้เปิดใช้งานระบบคลิกเปลี่ยนสี
  attachVotingLogic();
}

// ฟังก์ชันเปลี่ยนสีเมื่อคลิก (Logic 0 -> 1 -> 2)
function attachVotingLogic() {
  const cells = document.querySelectorAll('.vote-cell');

  cells.forEach(cell => {
    cell.addEventListener('click', () => {
      let currentState = parseInt(cell.getAttribute('data-state'));
      let nextState = (currentState + 1) % 3;
      if (currentState === 0) {
        nextState = 2;   // คลิกแรก = 2 คะแนน
      } else if (currentState === 2) {
        nextState = 1;   // คลิกสอง = 1 คะแนน
      } else {
        nextState = 0;   // คลิกสาม = 0 คะแนน
      }

      cell.setAttribute('data-state', nextState);
      cell.className = `vote-cell state-${nextState}`;
    });
  });
}

// รันฟังก์ชันหลัก
initVotingPage();



// ผูกฟังก์ชันกับปุ่ม 
const btnShare = document.getElementById("btnShare");

if (btnShare) {
  btnShare.onclick = copyInviteLink;
}

async function submitAvailability() {
  const nameInput = document.getElementById("nickname"); // ตรวจสอบ ID ช่องกรอกชื่อใน HTML
  const userName = nameInput ? nameInput.value.trim() : "";

  // 1. ตรวจสอบว่ากรอกชื่อหรือยัง
  if (!userName) {
    alert("กรุณากรอกชื่อของคุณก่อนบันทึก");
    return;
  }

  // 2. รวบรวมข้อมูลการโหวตจากตาราง
  const voteData = {};
  const cells = document.querySelectorAll(".vote-cell");

  cells.forEach(cell => {
    const time = cell.getAttribute("data-time");
    const date = cell.getAttribute("data-date");
    const state = parseInt(cell.getAttribute("data-state"));

    // เก็บข้อมูลในรูปแบบ:
    // { "2026-02-20": { "09:00": 1, "10:00": 2 }, ... }
    if (!voteData[date]) {
      voteData[date] = {};
    }

    voteData[date][time] = state;
  });


try {
  // 1. ตรวจสอบค่าก่อนส่ง
  if (!userName) { alert("กรุณากรอกชื่อ"); return; }
  
  // 2. ส่งข้อมูล 
  const { error: insertError } = await supabase
    .from("votes")
    .insert([
      {
        meeting_id: roomId,
        user_name: userName,
        vote_data: voteData 
      }
    ]);

  if (insertError) {
    // ถ้า Error เพราะหาคอลัมน์ไม่เจอ ให้แจ้งเตือนชัดเจน
    if (insertError.message.includes("column")) {
      console.error("Database Mismatch: เช็คชื่อคอลัมน์ใน Supabase ว่าใช่ vote_data หรือไม่?");
    }
    throw insertError;
  }
    // 4. เมื่อบันทึกสำเร็จ ให้ไปหน้าแสดงผลลัพธ์
    alert("บันทึกข้อมูลเรียบร้อยแล้ว!");
    window.location.href = `results.html?id=${roomId}`;

  } catch (err) {
    console.error("Error submitting vote:", err.message);
    alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + err.message);
  }
}

// 5. ผูกฟังก์ชันกับปุ่ม Submit ในหน้า HTML
const btnSubmit = document.getElementById("btnSubmit"); // ตรวจสอบ ID ปุ่มใน HTML

if (btnSubmit) {
  btnSubmit.onclick = submitAvailability;
}

// 1. ฟังก์ชันโหลดข้อมูลโหวตและระบายสีตาราง
async function refreshVoteTable(roomId) {
    const { data: allVotes, error } = await supabase
        .from('votes') 
        .select('*')
        .eq('meeting_id', roomId);

    if (error) return;

    // 1. ล้าง Class ของคนอื่นออกก่อน (แต่เก็บ Class ที่เรากดเองไว้)
    document.querySelectorAll('.vote-cell').forEach(cell => {
        cell.classList.remove('voted-other', 'state-1', 'state-2');
        // คืนค่า state-0 (สีขาว) ให้ช่องที่ไม่มีใครโหวต
        if (!cell.getAttribute('data-my-choice')) { 
            cell.classList.add('state-0');
        }
    });

    // 2. วนลูปข้อมูลโหวตของทุกคน 
    allVotes.forEach(userVote => {
        const data = userVote.vote_data; 
        
        for (const date in data) {
            for (const time in data[date]) {
                const stateFromDB = data[date][time];
                
                if (stateFromDB > 0) { 
                    const targetId = `slot-${date}-${time}`;
                    const cell = document.getElementById(targetId);
                    
                    if (cell) {
                        // ระบายสีตาม State ที่เพื่อนส่งมา 
                        cell.classList.remove('state-0');
                        cell.classList.add(`state-${stateFromDB}`);
                        cell.classList.add('voted-other'); 
                    }
                }
            }
        }
    });
}

// 2. ตั้งค่า Realtime ให้หน้าโหวต
function setupVoteRealtime(roomId) {
    supabase
        .channel('live-votes')
        .on(
            'postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'votes', 
                filter: `meeting_id=eq.${roomId}` 
            }, 
            (payload) => {
                console.log('เพื่อนโหวตใหม่!', payload.new);
                refreshVoteTable(roomId); 
            }
        )
        .subscribe();
}

// เรียกใช้งานตอนโหลดหน้า
refreshVoteTable(roomId); 
setupVoteRealtime(roomId); 

async function handleVote(slotId) {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase
        .from('votes')
        .insert([{
            meeting_id: roomId,
            slot_id: slotId,
            user_id: user.id,
        }]);
}