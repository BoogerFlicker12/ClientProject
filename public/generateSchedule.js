// generateSchedule.js
//We are assuming everythings in the format we want it to be
function generateSchedule(settings, studentData) {
  console.log("Generating schedules with", settings, studentData);
  const { scheduleCount, periods, rooms } = settings;

  if (!scheduleCount || !periods || !rooms || !studentData) {
    alert("Missing input data. Please check settings and student list.");
    return;
  }

  //Calculates frequent dates and periods combos
  const datePeriodFrequency = {};
  for (const student of studentData) {
    for (const entry of student.availabilityParsed) {
      const key = `${entry.date}|||${entry.period}`;
      datePeriodFrequency[key] = (datePeriodFrequency[key] || 0) + 1;
    }
  }
  //Calculate most frequent dates (ignoring period)
  const dateFrequency = {};
  for (const student of studentData) {
    for (const entry of student.availabilityParsed) {
      dateFrequency[entry.date] = (dateFrequency[entry.date] || 0) + 1;
    }
  }

  const totalStudents = studentData.length;
  const commonDates = [];

  for(const date in dateFrequency) {
    const count = dateFrequency[date];

    if (count === totalStudents) {
      commonDates.push(date);
    }
  }

  let selectedDates = []; 
  if (commonDates.length >= scheduleCount) {
    selectedDates = commonDates.slice(0, scheduleCount);
  } else {
    alert("");
    topEntries = Object.entries(dateFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, scheduleCount);
    
    selectedDates = [];
    for (const entry of topEntries) {
      selectedDates.push(entry[0]);
    }
  } 
  
  const selectedSlots = Object.entries(datePeriodFrequency)
    .map(([key, count]) => {
      const [date, period] = key.split("|||");
      return { date, period, count };
    })
    .filter(({ date }) => selectedDates.includes(date));

  // Group students by topic
const topicGroups = {};
for (const student of studentData) {
  const topic = (student["Project topic"] || "").toLowerCase();
  if (!topicGroups[topic]) topicGroups[topic] = [];
  topicGroups[topic].push(student);
}

console.log("DEBUG: Topic groups and student counts:");
for (const [topic, students] of Object.entries(topicGroups)) {
  console.log(`Topic "${topic}": ${students.length} student(s)`);
}


const topics = Object.keys(topicGroups);
const totalSlotsPerRoom = selectedSlots.length; // total periods across all dates for scheduling
const roomsCount = rooms.length;

// 1. Assign each topic a "primary" room (looping through rooms)
const topicRoomMap = {};
topics.forEach((topic, i) => {
  topicRoomMap[topic] = rooms[i % roomsCount];
});

// 2. Track how many presentations are assigned per room
const roomAssignmentsMap = {};
// Also track what topics are assigned to each room (as a Set to avoid duplicates)
const roomTopicsMap = {};
for (const room of rooms) {
  roomAssignmentsMap[room] = {
    capacity: totalSlotsPerRoom,
    assignedCount: 0,
    students: []
  };
  roomTopicsMap[room] = new Set();
}

// 3. Assign students to their topic's primary room first,
// but if the room is full, spill over into rooms with free capacity
for (const topic of topics) {
  const studentsForTopic = topicGroups[topic];
  const primaryRoom = topicRoomMap[topic];

  for (const student of studentsForTopic) {
    let assignedRoom = null;

    // Try to assign to primary room first
      // Try to assign to primary room first
    if (roomAssignmentsMap[primaryRoom].assignedCount < roomAssignmentsMap[primaryRoom].capacity) {
      roomAssignmentsMap[primaryRoom].students.push(student);
      roomAssignmentsMap[primaryRoom].assignedCount++;
      roomTopicsMap[primaryRoom].add(topic);
      assignedRoom = primaryRoom;
    } else {
      // Spillover: try to find any other room with available capacity
      const alternativeRoom = rooms.find(r => roomAssignmentsMap[r].assignedCount < roomAssignmentsMap[r].capacity);
      if (alternativeRoom) {
        roomAssignmentsMap[alternativeRoom].students.push(student);
        roomAssignmentsMap[alternativeRoom].assignedCount++;
        roomTopicsMap[alternativeRoom].add(topic);
        assignedRoom = alternativeRoom;
      } else {
        // No rooms available - handle as needed
        console.warn(`No available room slots for student ${student["First name"]} ${student["Last name"]} (topic: ${topic})`);
      }
    }
  }
}

// 4. Flatten roomAssignmentsMap into an array of room groups for scheduling
const roomAssignments = [];
for (const room of rooms) {
  roomAssignments.push(roomAssignmentsMap[room].students);
}

// Optional: Convert roomTopicsMap Sets to arrays for easier use/display
const roomTopics = {};
for (const room of rooms) {
  roomTopics[room] = Array.from(roomTopicsMap[room]);
}

// --- NEW nicely formatted console output ---

console.log("=== Room Topics Assigned ===");
for (const room of rooms) {
  const topicsList = roomTopics[room].length > 0 ? roomTopics[room].join(", ") : "(no topics assigned)";
  console.log(`${room}: ${topicsList}`);
}

console.log("\n=== Students Assigned Per Room ===");
for (const room of rooms) {
  const students = roomAssignmentsMap[room].students;
  console.log(`${room} (${students.length} students):`);
  if (students.length === 0) {
    console.log("  (no students assigned)");
  } else {
    for (const student of students) {
      console.log(`  - ${student["First name"]} ${student["Last name"]} (Topic: ${student["Project topic"] || "N/A"})`);
    }
  }
}

const totalPresentations = studentData.length;
const totalAvailableSlots = selectedSlots.length * rooms.length;

console.log("\nSummary:");
console.log("Total presentations:", totalPresentations);
console.log("Total selected slots:", selectedSlots.length);
console.log("Number of rooms:", rooms.length);
console.log("Total available slots (slots * rooms):", totalAvailableSlots);

if (totalAvailableSlots < totalPresentations) {
  alert(`Not enough room slots for all presentations.\nRequired: ${totalPresentations}, Available: ${totalAvailableSlots}`);
  return;
}

  const totalGroups = topics.length;
  // Step 3: If fewer rooms are actually needed, trim the rooms array to only what's needed
  const maxRoomsNeededPerSlot = Math.max(1, Math.ceil(totalGroups / selectedSlots.length));
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
          name: `${student["First name"]} ${student["Last name"]}`,
          topic: student["Project topic"] || "",
          projectName: student["Project name"] || "",
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
      const date = entries[i + 1]; // e.g., "December 19th"
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




