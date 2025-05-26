// generateSchedule.js

function generateSchedule(settings, studentData) {
  console.log("Generating schedules with", settings, studentData);
  const { scheduleCount, periods, rooms } = settings;

  if (!scheduleCount || !periods || !rooms || !studentData) {
    alert("Missing input data. Please check settings and student list.");
    return;
  }

  // 1. Extract all availability dates
  const dateFrequency = {};
  for (const student of studentData) {
    for (const date of student.availability || []) {
      dateFrequency[date] = (dateFrequency[date] || 0) + 1;
    }
  }

  const totalStudents = studentData.length;
  const viableDates = Object.entries(dateFrequency)
    .filter(([_, count]) => count === totalStudents)
    .map(([date]) => date);

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

  // 2. Group students by topic
  const topicGroups = {};
  for (const student of studentData) {
    const topic = student.topic.toLowerCase();
    if (!topicGroups[topic]) topicGroups[topic] = [];
    topicGroups[topic].push(student);
  }

  // Flatten into flexible room groups
  const roomAssignments = [];
  const topics = Object.keys(topicGroups);

  while (topics.length > 0) {
    const roomGroup = [];
    while (roomGroup.length < 3 && topics.length > 0) {
      const topic = topics.shift();
      roomGroup.push(...topicGroups[topic]);
    }
    roomAssignments.push(roomGroup);
  }

  // 3. Assign students to periods, rooms, and dates
  const finalSchedule = [];
  let groupIndex = 0;

  for (let d = 0; d < selectedDates.length; d++) {
    const date = selectedDates[d];
    for (let r = 0; r < rooms.length; r++) {
      const room = rooms[r];
      const group = roomAssignments[groupIndex % roomAssignments.length];

      let periodIndex = 0;
      for (let i = 0; i < group.length; i++) {
        const student = group[i];
        if (!student.availability.includes(date)) continue; // skip if not available that day

        const period = periods[periodIndex % periods.length];

        finalSchedule.push({
          name: `${student.firstName} ${student.lastName}`,
          topic: student.topic,
          projectName: student.projectName,
          date,
          period,
          room
        });

        periodIndex++;
      }
      groupIndex++;
    }
  }

  displaySchedule(finalSchedule);
}

// Helper to display the schedule as a matrix of Dates → Rooms → Periods
function displaySchedule(scheduleData) {
  const table = document.getElementById("csvTable");
  table.innerHTML = "";

  const byDate = {};
  for (const entry of scheduleData) {
    if (!byDate[entry.date]) byDate[entry.date] = {};
    if (!byDate[entry.date][entry.room]) byDate[entry.date][entry.room] = {};
    byDate[entry.date][entry.room][entry.period] = entry;
  }

  const allPeriods = Array.from(new Set(scheduleData.map(s => s.period))).sort((a, b) => a - b);
  const allDates = Object.keys(byDate);
  const allRooms = Array.from(new Set(scheduleData.map(s => s.room)));

  let html = "<thead><tr><th>Period</th>";
  for (const date of allDates) {
    for (const room of allRooms) {
      html += `<th>${date}<br>${room}</th>`;
    }
  }
  html += "</tr></thead><tbody>";

  for (const period of allPeriods) {
    html += `<tr><td>${period}</td>`;
    for (const date of allDates) {
      for (const room of allRooms) {
        const entry = byDate[date]?.[room]?.[period];
        if (entry) {
          html += `<td><strong>${entry.name}</strong><br><em>${entry.projectName}</em></td>`;
        } else {
          html += "<td></td>";
        }
      }
    }
    html += "</tr>";
  }

  html += "</tbody>";
  table.innerHTML = html;
  document.getElementById("result").scrollIntoView({ behavior: "smooth" });
}
