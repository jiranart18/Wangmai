import { supabase } from './supabase-config.js';

// -------------------
// Setup
// -------------------
const params = new URLSearchParams(window.location.search);
const roomId = params.get("id");
let fullShareMessage = "";
const bestTimeContainer = document.getElementById("bestTimeResult");
const participantList = document.getElementById("participantList");
const participantCount = document.getElementById("participantCount");
const roomDisplay = document.getElementById("roomDisplay");

if (!roomId) {
  bestTimeContainer.innerText = "ไม่พบรหัสห้องประชุม";
} else {
  roomDisplay.innerText = roomId;
  init();
}

// -------------------
// INIT
// -------------------
async function init() {
  await loadResults();
  setupRealtime();
}

// -------------------
// Check Creator
// -------------------
async function isCreator() {
  // 1. ดึงข้อมูล User ที่กำลัง Login อยู่ใน Browser นี้ (ถ้ามี)
  const { data: { session } } = await supabase.auth.getSession();
  const currentUser = session?.user;

  // 2. ดึงข้อมูลห้องเพื่อดูว่าใครคือเจ้าของ (เช็คจากคอลัมน์ creator_id)
  const { data: room } = await supabase
    .from("rooms")
    .select("creator_id") // เปลี่ยนจาก creator_token เป็น creator_id
    .eq("id", roomId)
    .single();

  if (!room) return false;

  // 3. ถ้าไม่ได้ Login เลย ให้ซ่อนปุ่มจัดการ
  if (!currentUser) return false;

  // 4. เทียบ ID: ถ้าคนเปิดคือคนเดียวกับคนสร้าง ให้คืนค่า true
  return room.creator_id === currentUser.id;
}
// -------------------
// Load Results 
// -------------------
async function loadResults() {
  // 1. ดึงข้อมูลห้อง (ดึงครั้งเดียวให้คุ้ม)
  const { data: meeting, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (roomError || !meeting) {
    console.error("Room not found");
    return;
  }

  // 2. ดึงข้อมูลการโหวต
  const { data: votes, error: voteError } = await supabase
    .from("votes")
    .select("user_name, vote_data")
    .eq("meeting_id", roomId);

  if (voteError) {
    console.error("Error fetching votes");
    return;
  }

  // 3. แสดงรายชื่อคนโหวตและ Progress Bar
  displayParticipants(votes || []);
  renderProgressBar(votes.length, meeting.required_voters || 1, meeting.status);

  // --- แทรกโค้ดจัดการปุ่มคัดลอกตรงนี้ ---
  const copyBtn = document.getElementById("btnCopyVoteLink"); 
  if (copyBtn) {
      if (meeting.status === "finalized") {
          copyBtn.style.display = "none"; // ถ้าสรุปแล้ว ซ่อนปุ่ม
      } else {
          copyBtn.style.display = "block"; // ถ้ายังไม่สรุป โชว์ปุ่ม
      }
  }

  // 4. เช็คสถานะ: ถ้าสรุปผลแล้ว (Finalized)
  if (meeting.status === "finalized" && meeting.selected_time) {
    renderFinalized(meeting.selected_time);
    return;
  }

  // 5. เช็คสถานะ: ถ้ายังไม่มีใครโหวต
  if (!votes || votes.length === 0) {
    bestTimeContainer.innerHTML = "<p>No votes yet</p>";
    return;
  }

 // 6. เช็คสิทธิ์ Creator: ใช้ฟังก์ชันเช็คจากระบบ Login (async/await)
  const creator = await isCreator();

  if (creator) {
    // ถ้าเป็นเจ้าของ: ให้คำนวณ Top 3 และโชว์ปุ่มเลือกเวลา
    calculateTop3(votes, meeting.type);
  } else {
    // ถ้าเป็นเพื่อน: ให้โชว์ข้อความรอเจ้าของสรุป 
    bestTimeContainer.innerHTML = `
      <div class="waiting-card">
        <span class="icon">⏳</span>
        <p class="status-text">Waiting for the creator to choose an appointment time...</p>
        <span class="vote-count">(There are currently ${votes.length} people voting.)</span>
      </div>
    `;
  }
}

// ฟังก์ชันแยกสำหรับวาด Progress Bar (ช่วยให้โค้ดสะอาดขึ้น)
function renderProgressBar(current, target, meetingStatus) { // เพิ่ม parameter meetingStatus
  const percent = Math.min((current / target) * 100, 100);
  const statusEl = document.getElementById("voteStatus");
  
  if (!statusEl) return;

  // 1. แสดง Progress Bar โดยใช้ Class
  statusEl.innerHTML = `
      <div class="vote-status-container">
          <div class="vote-status-text">
              Voting status: ${current} people out of  ${target} people
          </div>
          <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${percent}%;"></div>
          </div>
      </div>
  `;

  // 2. เช็คเงื่อนไขโหวตครบ
  if (meetingStatus !== "finalized" && current >= target) {
      statusEl.innerHTML += `
          <div class="complete-badge">
              <span>⭐</span> The amount is complete! Select summary time
          </div>
          <button class="btn-copy-link" onclick="copyVoteLink()">
              Link for friends to vote.
          </button>
      `;
  }
}



// -------------------
// Display Participants
// -------------------
function displayParticipants(votes) {
  participantCount.innerText = votes.length;

  participantList.innerHTML = votes.map(v => `
    <div class="participant-badge">
      ${v.user_name}
    </div>
  `).join('');
}

// -------------------
// Calculate Top 3
// -------------------
function buildScoreMap(votes) {
  const scoreMap = {};
  const unavailableCount = {};

  votes.forEach(vote => {
    let voteData = vote.vote_data;

    if (typeof voteData === "string") {
      voteData = JSON.parse(voteData);
    }

    Object.keys(voteData).forEach(date => {
      Object.keys(voteData[date]).forEach(time => {

        const key = `${date} ${time}`;
        const state = voteData[date][time];

        if (!scoreMap[key]) {
          scoreMap[key] = 0;
          unavailableCount[key] = 0;
        }

        scoreMap[key] += state;

        if (state === 0) {
          unavailableCount[key]++;
        }
      });
    });
  });

  return { scoreMap, unavailableCount };
}
function applyTypeRules(type, scoreMap, unavailableCount, totalPeople) {

  if (type === "Group Work") {

    Object.keys(scoreMap).forEach(key => {
      if (unavailableCount[key] / totalPeople > 0.3) {
        scoreMap[key] -= 5;
      }
    });

  } else if (type === "TA Meeting") {

    const taVote = votes.find(v => v.user_id === meeting.creator_id || v.user_name === "เจ้าของห้อง");
    
    Object.keys(scoreMap).forEach(key => {
        //เช็คตัว TA ---
        if (taVote) {
            const taFreeTimes = taVote.vote_data.free || [];
            if (!taFreeTimes.includes(key)) {
                // ถ้า TA ไม่ว่าง หักไปเลย 100 แต้ม (ให้ร่วงไปท้ายตาราง)
                scoreMap[key] -= 100;
            }
        }

        // ช็คจำนวนนักเรียน ---
        const missingStudents = unavailableCount[key] || 0;
        // หักคะแนนตามจำนวนนักเรียนที่หายไป คนละ 5 แต้ม
        scoreMap[key] -= (missingStudents * 5);
    });

  } else if (type === "Tutoring Session") {

   const tutorVote = votes.find(v => v.user_id === meeting.creator_id || v.user_name === "เจ้าของห้อง");

    if (tutorVote) {
        // ดึงรายการเวลาที่ติวเตอร์เลือกไว้ (สมมติเก็บใน vote_data.free)
        const tutorFreeTimes = tutorVote.vote_data.free || []; 

        Object.keys(scoreMap).forEach(key => {
            if (tutorFreeTimes.includes(key)) {
                // ถ้าติวเตอร์ว่าง ให้คะแนนความสำคัญเป็น 3 เท่า!
                scoreMap[key] = scoreMap[key] * 3;
            } else {
                // ถ้าติวเตอร์ไม่ว่าง ช่วงเวลานั้นแทบจะไร้ความหมาย (หักคะแนนหนัก)
                scoreMap[key] = -9999;
            }
        });
    } else {
        // กรณีติวเตอร์ยังไม่ได้โหวต ให้ใช้การคูณปกติไปก่อน
        Object.keys(scoreMap).forEach(key => {
            scoreMap[key] = scoreMap[key] * 1.5;
        });
    }

  }
  
  return scoreMap;
}
function calculateTop3(votes, meetingType) {

  const totalPeople = votes.length;

  const { scoreMap, unavailableCount } =
    buildScoreMap(votes);

  const finalScores =
    applyTypeRules(meetingType, scoreMap, unavailableCount, totalPeople);

  const sorted = Object.entries(finalScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  renderTop3(sorted);
}

// -------------------
// Render Top 3 (Creator Only)
// -------------------
function renderTop3(top3) {

  bestTimeContainer.innerHTML = `
    <h3>Top 3 Best Times</h3>
    ${top3.map(([datetime, score], createmeetP) => `
      <div class="best-time-card">
        <br>
        ${formatDateTime(datetime)}<br>
        คะแนนรวม: ${score}
        <br>
        <button onclick="selectTime('${datetime}')">
          Choose this time
        </button>
      </div>
    `).join('')}
  `;
}

// -------------------
// Select Time (Creator Only)
// -------------------
window.selectTime = async function(datetime) {
    const confirmSelect = confirm("ยืนยันเลือกเวลานี้?");
    if (!confirmSelect) return;

    console.log("กำลังเริ่มบันทึกเวลาที่เลือก...");

    try {
        // ส่งข้อมูลไป Update
        const { data, error } = await supabase
            .from("rooms")
            .update({
                selected_time: datetime,
                status: "finalized"
            })
            .eq("id", roomId)
            .select(); // เพิ่ม .select() เพื่อเช็คว่ามี data กลับมาไหม

        if (error) {
            console.error("Update Error:", error.message);
            alert("บันทึกไม่สำเร็จ (RLS หรือ Database error): " + error.message);
            return;
        }

        console.log("บันทึกสำเร็จ!", data);
        
        // บังคับโหลดใหม่เพื่อให้ loadResults ทำงานใหม่
        window.location.reload(); 

    } catch (err) {
        console.error("Unexpected Error:", err);
        alert("เกิดข้อผิดพลาดที่ไม่คาดคิด");
    }
};
// -------------------
// Render Finalized
// -------------------
async function renderFinalized(datetime) {
  const { data: meeting } = await supabase
    .from("rooms")
    .select("title")
    .eq("id", roomId)
    .single();

  const [date, time] = datetime.split(" ");
  
  // คำนวณเวลาจบ (บวกไป 1 ชม. สำหรับไฟล์ ICS)
  const startTime = `${date} ${time}`;
  const dEnd = new Date(`${date}T${time}:00`);
  dEnd.setHours(dEnd.getHours() + 1);
  const endTime = `${date} ${dEnd.toTimeString().split(' ')[0].substring(0, 5)}`;

  const googleLink = generateGoogleCalendarLink(meeting.title, date, time);

  const currentUrl = new URL(window.location.href);
  const pathParts = currentUrl.pathname.split('/');
  pathParts[pathParts.length - 1] = 'ics.html';
  const icsLink = `${currentUrl.origin}${pathParts.join('/')}?id=${roomId}`;
  
  window.fullShareMessage = `นัดหมาย: ${meeting.title}\n\n🟢 สำหรับ Google Calendar:\n${googleLink}\n\n🔵 สำหรับ Apple / อื่น ๆ:\n${icsLink}\n\nกดเพิ่มเข้าปฏิทินได้เลย!`;
  bestTimeContainer.innerHTML = `
    <div class="finalized-card">
      
      <div class="final-time">${formatDateTime(datetime)}</div>
      
      <div class="calendar-buttons">
        <button class="btn-google" onclick="window.open('${googleLink}','_blank')">
          Google Calendar
        </button>
        
        <button class="btn-ics" onclick="generateICS('${meeting.title}', '${startTime}', '${endTime}')">
          Add to iPhone / Other (ICS)
        </button>
      </div>

      <hr>
      <button class="btn-share" onclick="window.handleFastCopy()">
        Link to add calendar appointment times for friends
      </button>
    </div>
  `;
}

// -------------------
// ฟังก์ชันคัดลอกแบบความเร็วสูง (รองรับทุกเครื่อง)
// -------------------
window.handleFastCopy = function() {
  if (!fullShareMessage) {
    alert("กำลังเตรียมข้อมูล กรุณาลองอีกครั้งในครู่เดียว");
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = fullShareMessage;
  
  // ตั้งค่าให้ซ่อนแต่ยัง Focus ได้ (สำคัญสำหรับ iOS)
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, 99999); // บังคับคลุมดำบน iPhone

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      alert("✅ คัดลอกข้อความส่งเพื่อนสำเร็จ!");
    } else {
      alert("❌ คัดลอกไม่สำเร็จ");
    }
  } catch (err) {
    alert("❌ เบราว์เซอร์ไม่รองรับการคัดลอก");
  }

  document.body.removeChild(textArea);
};
  


// -------------------
// Format Date
// -------------------
function formatDateTime(datetime) {
  const [date, time] = datetime.split(" ");
  const d = new Date(`${date}T${time}:00`);

  return d.toLocaleString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// -------------------
// Realtime
// -------------------
function setupRealtime() {
  // 1. ดักฟังห้อง (เมื่อเจ้าของกดสรุปเวลา)
  supabase
    .channel("room-updates")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      () => { 
        console.log("Room updated!");
        loadResults(); 
      }
    )
    .subscribe();

  // 2. ดักฟังการโหวต (เมื่อเพื่อนกดโหวต)
  supabase
    .channel("votes-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "votes", filter: `meeting_id=eq.${roomId}` },
      () => { 
        console.log("New vote detected!");
        loadResults(); // ต้องมั่นใจว่าฟังก์ชันนี้มีการดึง data ใหม่และสั่งวาดตารางใหม่ (Render)
      }
    )
    .subscribe();
}
/*------------------ส่งลิ้งโหวตให้เพื่อน-----------*/
window.copyVoteLink = function() {
  // 1. ดึง URL ปัจจุบัน (หน้า Results)
  const currentUrl = new URL(window.location.href);
  
  // 2. เปลี่ยนแค่ชื่อไฟล์จาก results.html เป็นหน้าที่มีตารางเลือกเวลาของคุณ
  
  currentUrl.pathname = currentUrl.pathname.replace("results.html", "vote.html");

  // 3. คัดลอก URL ที่สมบูรณ์ (ซึ่งจะมี ?id=... ติดไปด้วยแน่นอน)
  const finalLink = currentUrl.toString();

  navigator.clipboard.writeText(finalLink).then(() => {
    alert("คัดลอกลิงก์สำหรับส่งให้เพื่อนมาโหวตแล้ว! ");
  }).catch(err => {
    console.error("Copy error:", err);
    alert("ก๊อปปี้ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
  });
};

/*------------------google-----------*/
window.generateGoogleCalendarLink = function(title, date, time) {
  const [hours, minutes] = time.split(":");

  const start = new Date(date);
  start.setHours(hours);
  start.setMinutes(minutes);

  const end = new Date(start);
  end.setHours(start.getHours() + 1);

  const format = (d) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  return (
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent(title) +
    "&dates=" + format(start) + "/" + format(end) +
    "&details=Scheduled via GroupSync" +
    "&location=Online"
  );
}

window.copyGoogleLink = function(title, date, time) {
  const link = generateGoogleCalendarLink(title, date, time);

  navigator.clipboard.writeText(link).then(() => {
    alert("คัดลอกลิงก์ Google Calendar แล้ว!");
  });
}

function generateICS(meetingTitle, startTime, endTime) {
    // 1. จัดฟอร์แมตวันที่ให้ iPhone อ่านออก 
    const formatDate = (dateStr) => {
        return dateStr.replace(/[-:]/g, '').replace(' ', 'T') + '00';
        // ผลลัพธ์จะได้เป็น: 20260320T090000
    };

    const start = formatDate(startTime);
    const end = formatDate(endTime);

    // 2. โครงสร้างไฟล์ที่ iOS ยอมรับ
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//GroupSync//NONSGML v1.0//EN',
        'METHOD:PUBLISH', // สำคัญ: ช่วยให้ iOS เด้งหน้า Add Event
        'BEGIN:VEVENT',
        `UID:${Date.now()}@groupsync.com`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${meetingTitle}`,
        'DESCRIPTION:นัดหมาย',
        'LOCATION:Online',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n'); // ใช้ \r\n เพื่อความเป๊ะบน iOS

    // 3. สร้างการดาวน์โหลด
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${meetingTitle}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
window.generateICS = generateICS;
/*
window.copyShareMessage = async function(datetime) {
  // 1. ดึงข้อมูลห้อง (ดึงมารอก่อน)
  const { data: meeting } = await supabase
    .from("rooms")
    .select("title")
    .eq("id", roomId)
    .single();

  if (!meeting) {
    alert("ไม่พบข้อมูลห้องประชุม");
    return;
  }

  const [date, time] = datetime.split(" ");
  const googleLink = window.generateGoogleCalendarLink(meeting.title, date, time);
  
  const currentUrl = new URL(window.location.href);
  const pathParts = currentUrl.pathname.split('/');
  pathParts[pathParts.length - 1] = 'ics.html';
  const icsLink = `${currentUrl.origin}${pathParts.join('/')}?id=${roomId}`;

  const message = `นัดหมาย\n\n🟢 คนใช้ Google Calendar:\n${googleLink}\n\n🔵 คนใช้ Apple / Outlook / อื่น ๆ:\n${icsLink}\n\nกดแล้วเพิ่มเข้าปฏิทินได้เลย`;

};*/
