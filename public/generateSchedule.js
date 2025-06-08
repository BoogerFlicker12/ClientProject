function getColorForTopic(topic, colorMap = {}) {
  if (!colorMap[topic]) {
    const hue = Object.keys(colorMap).length * 137.5 % 360;
    colorMap[topic] = `hsl(${hue}, 70%, 85%)`;
  }
  return colorMap[topic];
}

// 1. Add new entry point to generate multiple schedules
function generateSchedule(settings, studentData) {
  const numberOfSchedules = settings.numberOfSchedules || 1;

  for (let i = 0; i < numberOfSchedules; i++) {
    generateSingleSchedule(settings, studentData, i + 1);
  }
}

// 2. Refactor logic into generateSingleSchedule()
function generateSingleSchedule(settings, studentData, scheduleIndex) {
  console.log(`Generating Schedule #${scheduleIndex}`);
  console.log("Generating schedules with:", settings, "Student count:", studentData.length);

  const { numberOfDays, periods, rooms } = settings;
  if (!numberOfDays || !periods || !rooms || !studentData) {
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
    .filter(([date, count]) => count >= totalStudents * 0.9)
    .map(([date]) => date);

  let selectedDates = [];
  if (commonDates.length >= numberOfDays) {
    selectedDates = commonDates.slice(0, numberOfDays);
  } else {
    selectedDates = Object.entries(dateFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, numberOfDays)
      .map(([date]) => date);
  }

  console.log("Selected dates for scheduling:", selectedDates);
  console.log("All date frequencies:", dateFrequency);
  console.log("Common (90%+) available dates:", commonDates);

  const selectedSlots = Object.entries(datePeriodFrequency)
    .map(([key, count]) => {
      const [date, period] = key.split("|||");
      return { date, period, count };
    })
    .filter(({ date }) => selectedDates.includes(date));

  console.log("Filtered date+period slots for selected dates:", selectedSlots);

  const totalAvailableSlots = periods.length * rooms.length * numberOfDays * 2;
  console.log("Total available slots:", totalAvailableSlots, "| Total students:", totalStudents);

  if (totalStudents > totalAvailableSlots) {
    alert(`Not enough room capacity! ${totalStudents} students vs ${totalAvailableSlots} slots.`);
    return;
  }

  const topicGroups = {};
  for (const student of studentData) {
    const topic = (student["Project topic"] || "No Topic").toLowerCase();
    if (!topicGroups[topic]) topicGroups[topic] = [];
    topicGroups[topic].push(student);
  }

  //console.log("Grouped topics and student counts:", Object.fromEntries(Object.entries(topicGroups).map(([k, v]) => [k, v.length]));

  if (!confirm("Do you want to manually assign rooms to topics? Click Cancel for automatic assignment.")) {
    // 6. Slight Randomization for Variety
    const topicList = Object.keys(topicGroups).sort(() => Math.random() - 0.5);
    const autoMap = {};
    rooms.forEach(r => (autoMap[r] = []));
    for (let i = 0; i < topicList.length; i++) {
      const room = rooms[i % rooms.length];
      autoMap[room].push(topicList[i]);
    }
    console.log("Auto-assigned room to topic mapping:", autoMap);
    finalizeSchedule(rooms, topicGroups, autoMap, studentData, selectedSlots, periods, selectedDates, scheduleIndex);
  } else {
    showRoomTopicAssignmentUI(rooms, topicGroups, selectedSlots.length, (userMap) => {
      console.log("Manual user room-topic map:", userMap);
      finalizeSchedule(rooms, topicGroups, userMap, studentData, selectedSlots, periods, selectedDates, scheduleIndex);
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

function finalizeSchedule(rooms, topicGroups, roomTopicMap, studentData, selectedSlots, periods, selectedDates, scheduleIndex) {
  console.log("---- Finalizing Schedule ----");
  const roomAssignmentsMap = {};
  const roomAssignments = {};

  for (const room of rooms) {
    roomAssignmentsMap[room] = {
      capacity: periods.length * selectedDates.length * 2,
      assignedCount: 0,
      students: []
    };
    roomAssignments[room] = [];
  }

  for (const [room, topics] of Object.entries(roomTopicMap)) {
    for (const topic of topics) {
      const students = topicGroups[topic] || [];
      for (const student of students) {
        if (roomAssignmentsMap[room].assignedCount < roomAssignmentsMap[room].capacity) {
          roomAssignments[room].push(student);
          roomAssignmentsMap[room].assignedCount++;
        } else {
          let placed = false;
          for (const alt of rooms) {
            if (roomAssignmentsMap[alt].assignedCount < roomAssignmentsMap[alt].capacity) {
              roomAssignments[alt].push(student);
              roomAssignmentsMap[alt].assignedCount++;
              placed = true;
              break;
            }
          }
          if (!placed) {
            console.warn("❌ Student couldn't be placed:", student["First name"], student["Last name"]);
          }
        }
      }
    }
  }

  console.log("Room assignments by room:", roomAssignments);
  console.log("Assigned counts:", Object.fromEntries(rooms.map(r => [r, roomAssignmentsMap[r].assignedCount])));

  const finalSchedule = [];
  let roomIndex = 0;

  for (const date of selectedDates) {
    for (const period of periods) {
      for (const room of rooms) {
        const group = roomAssignments[room];
        const pair = group.splice(0, 2);
        for (const student of pair) {
          if (!student) continue;
          finalSchedule.push({
            name: `${student["First name"]} ${student["Last name"]}`,
            topic: student["Project topic"] || "No Topic",
            projectName: student["Project name"] || "",
            date,
            period,
            room
          });
        }
        roomIndex++;
      }
    }
  }

  console.log("✅ Final schedule generated with", finalSchedule.length, "entries");
  displaySchedule(finalSchedule, periods, scheduleIndex);
}

// 3. Update displaySchedule() to label and isolate each schedule
function displaySchedule(schedule, periods, scheduleIndex = 1) {
  const container = document.getElementById("scheduleTable");
  
  const wrapper = document.createElement("div");
  wrapper.classList.add("schedule-wrapper");
  wrapper.style.borderTop = "3px solid #ccc";
  wrapper.style.marginTop = "2em";

  const title = document.createElement("h2");
  title.textContent = `Schedule #${scheduleIndex}`;
  wrapper.appendChild(title);

  const rooms = [...new Set(schedule.map(s => s.room))];
  const dates = [...new Set(schedule.map(s => s.date))];
  const topicColors = {};

  console.log("DATES IN SCHEDULE:", dates);

  for (const date of dates) {
    const subheading = document.createElement("h3");
    subheading.textContent = `Schedule for ${date}`;
    wrapper.appendChild(subheading);

    const table = document.createElement("table");
    table.classList.add("daily-schedule-table");
    table.style.marginBottom = "2em";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headerCells = [`<th>Period</th>`];
    for (const room of rooms) {
      headerCells.push(`<th>${room}</th>`);
    }
    headerRow.innerHTML = headerCells.join("");
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (const period of periods) {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${period}</td>`;

      for (const room of rooms) {
        const students = schedule.filter(s => s.date === date && s.room === room && s.period === period);
        const cell = document.createElement("td");
        cell.classList.add("schedule-slot");
        cell.setAttribute("data-period", period);
        cell.setAttribute("data-date", date);
        cell.setAttribute("data-room", room);
        cell.style.minWidth = "180px";
        cell.style.minHeight = "60px";

        for (const student of students) {
          const topicColor = getColorForTopic(student.topic, topicColors);
          const slot = document.createElement("div");
          slot.className = "student-entry";
          slot.draggable = true;
          slot.style.backgroundColor = topicColor;
          slot.style.border = "1px solid #aaa";
          slot.style.margin = "4px 0";
          slot.style.padding = "4px";
          slot.style.borderRadius = "4px";

          slot.innerHTML = `<strong>${student.name}</strong><br/><em>${student.projectName}</em>`;
          addDragAndDropEvents(slot);
          cell.appendChild(slot);
        }

        row.appendChild(cell);
      }

      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    wrapper.appendChild(table);
  }

  localStorage.setItem(`scheduleData_${scheduleIndex}`, JSON.stringify(schedule));
  localStorage.setItem("periods", JSON.stringify(periods));
  localStorage.setItem(`topicColors_${scheduleIndex}`, JSON.stringify(topicColors));
  
  // 4. Render color key per schedule
  renderColorKey(topicColors, wrapper);

  // 5. Add CSV download for each schedule
  const downloadBtn = createDownloadButton(schedule, scheduleIndex);
  wrapper.appendChild(downloadBtn);

  container.appendChild(wrapper);

  let messageEl = document.getElementById("scheduleGeneratedMessage");
  if (!messageEl) {
    messageEl = document.createElement("p");
    messageEl.id = "scheduleGeneratedMessage";
    messageEl.style.marginTop = "1em";
    messageEl.style.fontWeight = "600";
    messageEl.style.color = "green";
    container.appendChild(messageEl);
  }
  messageEl.textContent = "Schedule Generated.";
}

// 4. Updated renderColorKey()
function renderColorKey(topicColors, parentEl) {
  const keyContainer = document.createElement("div");
  keyContainer.classList.add("color-key");
  keyContainer.style.marginTop = "1em";
  keyContainer.style.display = "flex";
  keyContainer.style.flexWrap = "wrap";
  keyContainer.style.gap = "10px";

  keyContainer.innerHTML = "<strong>Project Topic Colors:</strong><br/>";
  for (const [topic, color] of Object.entries(topicColors)) {
    const entry = document.createElement("div");
    entry.style.backgroundColor = color;
    entry.style.padding = "5px 10px";
    entry.style.border = "1px solid #aaa";
    entry.style.borderRadius = "4px";
    entry.style.fontSize = "0.9em";
    entry.style.whiteSpace = "nowrap";
    entry.textContent = topic || "No Topic";
    keyContainer.appendChild(entry);
  }

  parentEl.appendChild(keyContainer);
}

// 5. Add CSV download for each schedule
function createDownloadButton(schedule, scheduleIndex) {
  const button = document.createElement("button");
  button.textContent = `Download CSV for Schedule #${scheduleIndex}`;
  button.style.marginTop = "1em";

  button.onclick = () => {
    // Get the current version from storage (which may have drag-and-drop updates)
    const currentSchedule = JSON.parse(localStorage.getItem(`scheduleData_${scheduleIndex}`)) || schedule;
    
    const rows = [["Date", "Period", "Room", "Student Name", "Project Title", "Topic"]];
    const grouped = {};

    for (const entry of currentSchedule) {
      const key = `${entry.date}|||${entry.period}|||${entry.room}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(entry);
    }

    for (const [key, entries] of Object.entries(grouped)) {
      const [date, period, room] = key.split("|||");
      for (let i = 0; i < 2; i++) {
        const e = entries[i] || {};
        rows.push([
          date,
          period,
          room,
          e.name || "",
          e.projectName || "",
          e.topic || ""
        ]);
      }
    }

    const csvContent = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule_${scheduleIndex}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return button;
}

let draggedEl = null;

function addDragAndDropEvents(el) {
  el.addEventListener("dragstart", (e) => {
    draggedEl = el;
    el.classList.add("dragging");
    setTimeout(() => el.style.display = "none", 0);
  });

  el.addEventListener("dragend", () => {
    if (draggedEl) {
      draggedEl.classList.remove("dragging");
      draggedEl.style.display = "";
      draggedEl = null;
    }
  });
}

document.getElementById("scheduleTable").addEventListener("dragover", e => {
  e.preventDefault();
});

document.getElementById("scheduleTable").addEventListener("drop", e => {
  e.preventDefault();
  const dropTarget = e.target.closest("td");

  if (dropTarget && dropTarget.classList.contains("schedule-slot") && draggedEl) {
    // Get the schedule wrapper that contains this drop target
    const scheduleWrapper = dropTarget.closest('.schedule-wrapper');
    const scheduleIndex = scheduleWrapper ? 
      parseInt(scheduleWrapper.querySelector('h2').textContent.replace('Schedule #', '')) : 
      1;

    draggedEl.style.display = "";
    dropTarget.appendChild(draggedEl);

    const updatedSchedule = [];
    const tables = scheduleWrapper.querySelectorAll(".daily-schedule-table");

    tables.forEach(table => {
      const date = table.previousElementSibling.textContent.replace("Schedule for ", "").trim();
      const periods = Array.from(table.querySelectorAll("tbody > tr"));

      periods.forEach(row => {
        const period = row.querySelector("td").textContent.trim();
        const cells = row.querySelectorAll("td.schedule-slot");

        cells.forEach(cell => {
          const room = cell.getAttribute("data-room");
          const studentDivs = cell.querySelectorAll(".student-entry");

          studentDivs.forEach(div => {
            const nameLine = div.querySelector("strong")?.textContent || "";
            const projectLine = div.querySelector("em")?.textContent || "";
            const topicColors = JSON.parse(localStorage.getItem(`topicColors_${scheduleIndex}`)) || {};
            const topic = Object.entries(topicColors)
              .find(([_, color]) => color === div.style.backgroundColor)?.[0] || "";

            updatedSchedule.push({
              name: nameLine,
              topic: topic,
              projectName: projectLine,
              date: date,
              period: period,
              room: room
            });
          });
        });
      });
    });

    // Save to the correct schedule-specific storage key
    localStorage.setItem(`scheduleData_${scheduleIndex}`, JSON.stringify(updatedSchedule));
    
    // Also update the global scheduleData for backward compatibility
    localStorage.setItem("scheduleData", JSON.stringify(updatedSchedule));
  }
});

function downloadCSVFromScheduleData() {
  const schedule = JSON.parse(localStorage.getItem("scheduleData")) || [];
  const grouped = {};
  for (const entry of schedule) {
    const key = `${entry.date}|||${entry.period}|||${entry.room}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }

  const rows = [["Date", "Period", "Room", "Student Name", "Project Title", "Topic"]];
  for (const [key, entries] of Object.entries(grouped)) {
    const [date, period, room] = key.split("|||");
    for (let i = 0; i < 2; i++) {
      const e = entries[i] || {};
      rows.push([
        date,
        period,
        room,
        e.name || "",
        e.projectName || "",
        e.topic || ""
      ]);
    }
  }

  const csvContent = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "schedule.csv";
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("downloadCSVBtn").addEventListener("click", downloadCSVFromScheduleData);