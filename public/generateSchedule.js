// generateSchedule.js

function generateSchedule(settings, studentData) {
  console.log("Generating schedules with", settings, studentData);
  const { scheduleCount, periods, rooms } = settings;

  if (!scheduleCount || !periods || !rooms || !studentData) {
    alert("Missing input data. Please check settings and student list.");
    return;
  }

  // 1. Extract all availability dates
  const datePeriodFrequency = {};
  for (const student of studentData) {
    for (const entry of student.availabilityParsed || []) {
      const key = `${entry.date}|||${entry.period}`;
      datePeriodFrequency[key] = (datePeriodFrequency[key] || 0) + 1;
    }
  } 


const totalStudents = studentData.length;

const viableSlots = Object.entries(datePeriodFrequency)
  .filter(([_, count]) => count === totalStudents)
  .map(([key]) => {
    const [date, period] = key.split("|||");
    return { date, period };
  });

const viableDates = [...new Set(viableSlots.map(slot => slot.date))];
const dateFrequency = {};

// Calculate total availability count per date (regardless of period)
for (const student of studentData) {
  for (const entry of student.availabilityParsed || []) {
    dateFrequency[entry.date] = (dateFrequency[entry.date] || 0) + 1;
  }
}

let selectedDates;
if (viableDates.length >= scheduleCount) {
  selectedDates = viableDates.slice(0, scheduleCount);
} else {
  alert("Full schedule not possible with given student availability. Displaying closest match.");
  selectedDates = Object.entries(dateFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, scheduleCount)
    .map(([date]) => date);
}
const selectedSlots = viableSlots.filter(slot => selectedDates.includes(slot.date));



  // 2. Group students by topic
  const topicGroups = {};
  for (const student of studentData) {
    const topic = (student.topic || "").toLowerCase();
    if (!topicGroups[topic]) topicGroups[topic] = [];
    topicGroups[topic].push(student);
  }

  // Flatten into flexible room groups
  const roomAssignments = [];
  const topics = Object.keys(topicGroups);

  // Step 1: Build room assignments (groups of students by topic)
  while (topics.length > 0) {
    const roomGroup = [];
    while (roomGroup.length < 3 && topics.length > 0) {
      const topic = topics.shift();
      roomGroup.push(...topicGroups[topic]);
    }
    roomAssignments.push(roomGroup);
  }

  // Step 2: Check if enough room-timeslots are available
  const totalGroups = roomAssignments.length;
  const totalAvailableSlots = selectedSlots.length * rooms.length;

  console.log({
    totalGroups,
    selectedSlots: selectedSlots.length,
    rooms: rooms.length,
    totalAvailableSlots
  });

  if (totalAvailableSlots < totalGroups) {
    alert(`Not enough rooms or time slots to schedule all groups.\nRequired: ${totalGroups}, Available: ${totalAvailableSlots}`);
    return;
  }

  // Step 3: If fewer rooms are actually needed, trim the rooms array to only what's needed
  const maxRoomsNeededPerSlot = Math.ceil(totalGroups / selectedSlots.length);
  const roomsToUse = rooms.slice(0, maxRoomsNeededPerSlot);


 // 3. Assign students to periods, rooms, and dates based on actual availability
  const finalSchedule = [];
  let groupIndex = 0;

  for (const { date, period } of selectedSlots) {
    for (let r = 0; r < roomsToUse.length; r++) {
      const room = roomsToUse[r];
      const group = roomAssignments[groupIndex % roomAssignments.length];

      for (const student of group) {
        const available = student.availabilityParsed.some(a => a.date === date && a.period === period);
        if (!available) continue;

        finalSchedule.push({
          name: `${student.firstName} ${student.lastName}`,
          topic: student.topic,
          projectName: student.projectName,
          date,
          period,
          room
        });
      }

      groupIndex++;
    }
  }
  console.log("Final Schedule Data:", finalSchedule);
  displaySchedule(finalSchedule);
}
// Helper Function 
function parseAvailability(rawAvailabilityString) {
  const entries = rawAvailabilityString.split(',').map(s => s.trim());
  const parsed = [];

  for (let i = 0; i < entries.length - 1; i++) {
    if (entries[i].startsWith("PD")) {
      const period = entries[i];
      const date = entries[i + 1]; // e.g., "Tuesday, December 19th"
      parsed.push({ period, date });
      i++; // Skip date for next loop
    }
  }

  return parsed;
}


// Helper to display the schedule as a matrix of Dates → Rooms → Periods
function displaySchedule(scheduleData) {
  const table = document.getElementById("csvTable");
  table.innerHTML = "";

  // Get unique periods sorted
  const allPeriods = Array.from(new Set(scheduleData.map(s => s.period))).sort((a, b) => a - b);
  // Get unique date-room combos
  const dateRoomCombos = [];
  const comboSet = new Set();
  for (const entry of scheduleData) {
    const comboKey = `${entry.date}|||${entry.room}`;
    if (!comboSet.has(comboKey)) {
      comboSet.add(comboKey);
      dateRoomCombos.push({ date: entry.date, room: entry.room });
    }
  }

  // Build table header: "Period" + each Date-Room combo
  let html = "<thead><tr><th>Period</th>";
  for (const { date, room } of dateRoomCombos) {
    html += `<th>${date}<br>${room}</th>`;
  }
  html += "</tr></thead><tbody>";

  // Create a map for quick lookup: date|room|period -> entry
  const scheduleMap = {};
  for (const entry of scheduleData) {
    const key = `${entry.date}|||${entry.room}|||${entry.period}`;
    scheduleMap[key] = entry;
  }

  // Build table rows for each period
  for (const period of allPeriods) {
    html += `<tr><td>${period}</td>`;
    for (const { date, room } of dateRoomCombos) {
      const key = `${date}|||${room}|||${period}`;
      const entry = scheduleMap[key];
      if (entry) {
        html += `<td><strong>${entry.name}</strong><br><em>${entry.projectName}</em></td>`;
      } else {
        html += `<td></td>`;
      }
    }
    html += "</tr>";
  }

  html += "</tbody>";
  table.innerHTML = html;
  document.getElementById("result").scrollIntoView({ behavior: "smooth" });
}




