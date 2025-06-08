console.log("eventListener.js loaded");
console.log("Logged in user on load:", localStorage.getItem("loggedInUser"));

const settingsModal = document.getElementById("settingsModal");
const errorDiv = document.getElementById('error');
const table = document.getElementById('csvTable');
const resultSection = document.getElementById('result');

let settings = {
  numberOfDays: 2,
  periods: [2, 3, 4, 5, 6],
  rooms: ['A', 'B', 'C'],
  numberOfSchedules: 3
};

let studentData = null;

function initLoginLogic() {
  const validUsers = [
    { username: "alice", password: "password123" },
    { username: "bob", password: "secure456" }
  ];

  const loginBtn = document.getElementById("loginBtn");
  const loginModal = document.getElementById("loginModal");
  const closeLoginBtn = document.getElementById("closeLoginBtn");
  const togglePassword = document.getElementById("togglePassword");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const submitLoginBtn = document.getElementById("submitLoginBtn");

  if (!loginBtn || !loginModal || !closeLoginBtn || !togglePassword || !usernameInput || !passwordInput || !submitLoginBtn)
    return;

  loginBtn.addEventListener("click", () => {
    loginModal.style.display = "block";
  });

  closeLoginBtn.addEventListener("click", () => {
    closeLogin();
  });

  togglePassword.addEventListener("click", () => {
    passwordInput.type = passwordInput.type === "password" ? "text" : "password";
  });

  submitLoginBtn.addEventListener("click", submitLogin);

  loginModal.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitLogin();
    }
  });

  window.addEventListener("click", function (event) {
    if (event.target === loginModal) {
      closeLogin();
    }
  });

  function closeLogin() {
    loginModal.style.display = "none";
    usernameInput.value = "";
    passwordInput.value = "";
  }

  function submitLogin() {
    const user = validUsers.find(
      u => u.username === usernameInput.value && u.password === passwordInput.value
    );
    if (user) {
      localStorage.setItem("loggedInUser", user.username);
      closeLogin();
      showWelcome(user.username);
    } else {
      alert("Invalid username or password.");
    }
  }

  function showWelcome(username) {
    document.getElementById("usernameDisplay").textContent = username;
    loginBtn.style.display = "none";
    document.getElementById("welcomeMsg").style.display = "inline-block";
  }

  function showLogin() {
    loginBtn.style.display = "inline-block";
    document.getElementById("welcomeMsg").style.display = "none";
  }

  const savedUser = localStorage.getItem("loggedInUser");
  if (savedUser) {
    showWelcome(savedUser);
  } else {
    showLogin();
  }
}

const REQUIRED_HEADERS = [
  'Email Address',
  'Last name',
  'First name',
  'Name of project',
  'Project topic',
  'Availability'
];

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('csvFile');
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  errorDiv.textContent = '';
  table.innerHTML = '';

  if (data.rows) {
    studentData = data.rows;
    const headers = Object.keys(data.rows[0]).map(h => h.trim());
    table.innerHTML = `
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>
        ${data.rows.map(row => `
          <tr>${headers.map(h => `<td>${row[h]}</td>`).join('')}</tr>
        `).join('')}
      </tbody>`;
    resultSection.scrollIntoView({ behavior: 'smooth' });

  } else if (data.invalidRows) {
    errorDiv.textContent = 'Some rows are missing required fields. Displaying invalid rows:';
    const allHeadersSet = new Set(['Row #']);
    data.invalidRows.forEach(row => {
      Object.keys(row.identifier || {}).forEach(h => allHeadersSet.add(h));
    });
    REQUIRED_HEADERS.forEach(h => allHeadersSet.add(h));
    const headers = [...REQUIRED_HEADERS];
    table.innerHTML = `
      <thead>
        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${data.invalidRows.map(row => {
      const cells = [];
      for (const h of REQUIRED_HEADERS) {
        const isMissing = row.missingFields.includes(h);
        const value = row.identifier[h] || '';
        cells.push(isMissing
          ? `<td style="color: red; font-weight: bold;">MISSING_INFORMATION</td>`
          : `<td>${value}</td>`);
      }
      return `<tr>${cells.join('')}</tr>`;
    }).join('')}
      </tbody>`;

    resultSection.scrollIntoView({ behavior: 'smooth' });
  } else {
    let errorText = `Error uploading file: ${data.error}`;
    if (data.missingHeaders) {
      errorText += `\nMissing fields: ${data.missingHeaders.join(', ')}`;
    }
    errorDiv.textContent = errorText;
  }
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  settingsModal.style.display = "block";
});
document.getElementById("closeSettingsBtn").addEventListener("click", () => {
  settingsModal.style.display = "none";
});

window.onclick = function (event) {
  if (loginModal && event.target === loginModal) {
    closeLogin();
  }
  if (settingsModal && event.target === settingsModal) {
    settingsModal.style.display = "none";
  }
};

document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);

function saveSettings() {
  const numberOfDaysInput = parseInt(document.getElementById("numberOfDays").value.trim());
  const periodInput = document.getElementById("periodRange").value;
  const roomsInput = document.getElementById("roomsList").value;
  const numberOfSchedulesInput = parseInt(document.getElementById("numberOfSchedules").value.trim());

  if (isNaN(numberOfDaysInput)) {
    settings.numberOfDays = 1;
  } else {
    settings.numberOfDays = numberOfDaysInput;
  }

  if (periodInput.includes('-')) {
    const [start, end] = periodInput.split('-').map(p => parseInt(p.trim()));
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      settings.periods = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    } else {
      alert("Invalid period range. Please enter it like '2-6'.");
    }
  }

  settings.rooms = roomsInput.split(',').map(r => r.trim()).filter(r => r);

  if (!isNaN(numberOfSchedulesInput) && numberOfSchedulesInput > 0 && numberOfSchedulesInput <= 100) {
    settings.numberOfSchedules = numberOfSchedulesInput;
  } else {
    alert("Invalid number of schedules. Please enter a number between 1 and 100.");
    settings.numberOfSchedules = 1;
  }

  const status = document.createElement('div');
  status.textContent = "Settings saved!";
  status.style.color = "green";
  settingsModal.querySelector('.modal-content').appendChild(status);
  setTimeout(() => status.remove(), 2000);

  console.log("Saved Settings:", settings);
  settingsModal.style.display = "none";
}

function parseAvailability(availabilityString) {
  if (!availabilityString || typeof availabilityString !== 'string') return [];

  const parts = availabilityString.split(',').map(p => p.trim());
  const entries = [];

  for (let i = 0; i < parts.length; i += 3) {
    if (parts.length < 3 || !parts[i] || !parts[i + 2]) continue;
    const pdMatch = parts[i]?.match(/PD\s*(\d+)/i);
    const period = pdMatch ? parseInt(pdMatch[1]) : null;
    const date = parts[i + 2] || null;

    if (period && date) {
      entries.push({ period, date });
    }
  }

  return entries;
}

document.getElementById("generateBtn").addEventListener("click", () => {
  if (!studentData) {
    alert("Please upload a CSV file first.");
    return;
  }

  table.innerHTML = "";
  errorDiv.textContent = "";
  resultSection.style.display = "none";

  if (typeof generateSchedule === "function") {
    for (const student of studentData) {
      student.availabilityParsed = parseAvailability(student.Availability);
    }
    console.log("Student Data being passed to generateSchedule:", studentData);
    generateSchedule(settings, studentData);
  } else {
    alert("generateSchedule function is not defined.");
  }
});
