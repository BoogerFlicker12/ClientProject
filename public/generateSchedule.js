// Modified generateSchedule.js with period capacity logic and schedule table rendering

function generateSchedule(settings, studentData) {
  console.log("Generating schedules with", settings, studentData);
  const { scheduleCount, periods, rooms } = settings;

  if (!scheduleCount || !periods || !rooms || !studentData) {
    alert("Missing input data. Please check settings and student list.");
    return;
  }

  const datePeriodFrequency = {};
  const dateFrequency = {};

  for (const student of studentData) {
    for (const entry of student.availabilityParsed) {
      const key = `${entry.date}|||${entry.period}`;
      datePeriodFrequency[key] = (datePeriodFrequency[key] || 0) + 1;
      dateFrequency[entry.date] = (dateFrequency[entry.date] || 0) + 1;
    }
  }

  const totalStudents = studentData.length;
  const commonDates = Object.entries(dateFrequency)
    .filter(([date, count]) => count === totalStudents)
    .map(([date]) => date);

  let selectedDates = [];
  if (commonDates.length >= scheduleCount) {
    selectedDates = commonDates.slice(0, scheduleCount);
  } else {
    selectedDates = Object.entries(dateFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, scheduleCount)
      .map(([date]) => date);
  }

  const selectedSlots = Object.entries(datePeriodFrequency)
    .map(([key, count]) => {
      const [date, period] = key.split("|||");
      return { date, period, count };
    })
    .filter(({ date }) => selectedDates.includes(date));

  const topicGroups = {};
  for (const student of studentData) {
    const topic = (student["Project topic"] || "").toLowerCase();
    if (!topicGroups[topic]) topicGroups[topic] = [];
    topicGroups[topic].push(student);
  }

  if (!confirm("Do you want to manually assign rooms to topics? Click 'Cancel' for automatic assignment.")) {
    const topicList = Object.keys(topicGroups);
    const autoAssignment = {};
    rooms.forEach(r => (autoAssignment[r] = []));
    for (let i = 0; i < topicList.length; i++) {
      const room = rooms[i % rooms.length];
      autoAssignment[room].push(topicList[i]);
    }
    finalizeSchedule(rooms, topicGroups, autoAssignment, studentData, selectedSlots, periods);
  } else {
    showRoomTopicAssignmentUI(rooms, topicGroups, selectedSlots.length, (userRoomTopicMap) => {
      finalizeSchedule(rooms, topicGroups, userRoomTopicMap, studentData, selectedSlots, periods);
    });
  }
}

function showRoomTopicAssignmentUI(rooms, topicGroups, slotCapacity, onConfirm) {
  const container = document.getElementById("roomTopicAssignmentContainer");
  container.innerHTML = "";
  const form = document.createElement("form");
  const topicList = Object.keys(topicGroups);

  for (const room of rooms) {
    const roomDiv = document.createElement("div");
    roomDiv.innerHTML = `<strong>${room}</strong> (Max: ${slotCapacity})<br/>`;
    for (const topic of topicList) {
      const id = `${room}_${topic}`;
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = id;
      input.name = room;
      input.value = topic;
      input.addEventListener("change", () => {
        const all = document.querySelectorAll(`input[value='${topic}']`);
        all.forEach(box => {
          if (box !== input) box.disabled = input.checked;
        });
      });
      label.appendChild(input);
      label.innerHTML += ` ${topic} (${topicGroups[topic].length})<br/>`;
      roomDiv.appendChild(label);
    }
    form.appendChild(roomDiv);
    form.appendChild(document.createElement("hr"));
  }

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.textContent = "Confirm Room Assignments";
  confirmBtn.onclick = () => {
    const userMap = {};
    for (const room of rooms) userMap[room] = [];
    for (const input of form.querySelectorAll("input[type=checkbox]:checked")) {
      userMap[input.name].push(input.value);
    }
    onConfirm(userMap);
  };

  form.appendChild(confirmBtn);
  container.appendChild(form);
  container.scrollIntoView({ behavior: "smooth" });
}

function finalizeSchedule(rooms, topicGroups, userRoomTopicMap, studentData, selectedSlots, periods) {
  const slotCapacity = periods.length * 2;
  const roomAssignmentsMap = {};
  const roomTopicsMap = {};
  for (const room of rooms) {
    roomAssignmentsMap[room] = {
      capacity: slotCapacity,
      assignedCount: 0,
      students: []
    };
    roomTopicsMap[room] = new Set(userRoomTopicMap[room] || []);
  }

  for (const [room, topics] of Object.entries(userRoomTopicMap)) {
    for (const topic of topics) {
      const studentsForTopic = topicGroups[topic];
      for (const student of studentsForTopic) {
        if (roomAssignmentsMap[room].assignedCount < roomAssignmentsMap[room].capacity) {
          roomAssignmentsMap[room].students.push(student);
          roomAssignmentsMap[room].assignedCount++;
        } else {
          for (const altRoom of rooms) {
            if (altRoom !== room && roomAssignmentsMap[altRoom].assignedCount < roomAssignmentsMap[altRoom].capacity) {
              roomAssignmentsMap[altRoom].students.push(student);
              roomAssignmentsMap[altRoom].assignedCount++;
              break;
            }
          }
        }
      }
    }
  }

  const roomAssignments = rooms.map(r => roomAssignmentsMap[r].students);
  const finalSchedule = [];
  let groupIndex = 0;

  for (const { date } of selectedSlots) {
    for (const period of periods) {
      for (const room of rooms) {
        const group = roomAssignments[groupIndex % roomAssignments.length];
        const pair = group.splice(0, 2);
        for (const student of pair) {
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
  }

  displaySchedule(finalSchedule, periods);
}

function displaySchedule(schedule, periods) {
  const table = document.getElementById("scheduleTable");
  table.innerHTML = "";

  const rooms = [...new Set(schedule.map(s => s.room))];
  const dates = [...new Set(schedule.map(s => s.date))];

  const headerRow = document.createElement("tr");
  headerRow.innerHTML = `<th>Period</th>` + dates.flatMap(d => rooms.map(r => `<th>${d} - ${r}</th>`)).join("");
  const thead = document.createElement("thead");
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const period of periods) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${period}</td>`;
    for (const date of dates) {
      for (const room of rooms) {
        const students = schedule.filter(s => s.date === date && s.room === room && s.period === period);
        const content = students.map(s => `${s.name}<br/><em>${s.projectName}</em>`).join("<hr/>") || "";
        const cell = document.createElement("td");
        cell.innerHTML = content;
        row.appendChild(cell);
      }
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  // Save generated schedule HTML to localStorage for editor.html
  localStorage.setItem("generatedScheduleHTML", table.innerHTML);

  // Show a message below the table
  let messageEl = document.getElementById("scheduleGeneratedMessage");
  if (!messageEl) {
    messageEl = document.createElement("p");
    messageEl.id = "scheduleGeneratedMessage";
    messageEl.style.marginTop = "1em";
    messageEl.style.fontWeight = "600";
    messageEl.style.color = "green";
    table.parentNode.appendChild(messageEl);
  }
  messageEl.textContent = "Schedule Generated, go to editor.";
}

