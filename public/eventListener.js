console.log("eventListener.js loaded");
console.log("Logged in user on load:", localStorage.getItem("loggedInUser"));

const validUsers = [
  { username: "alice", password: "password123" },
  { username: "bob", password: "secure456" }
];

const settingsModal = document.getElementById("settingsModal");
const errorDiv = document.getElementById('error');
const table = document.getElementById('csvTable');
const resultSection = document.getElementById('result');

let settings = {
  scheduleCount: 1,
  periods: [2, 3, 4, 5, 6],
  rooms: []
};

let studentData = null;

const loginBtn = document.getElementById("loginBtn");
const loginModal = document.getElementById("loginModal");
const closeLoginBtn = document.getElementById("closeLoginBtn");
const togglePassword = document.getElementById("togglePassword");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const submitLoginBtn = document.getElementById("submitLoginBtn");

if (loginBtn && loginModal && closeLoginBtn && togglePassword && usernameInput && passwordInput && submitLoginBtn) {
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

}

function showWelcome(username) {
  document.getElementById("loginBtn").style.display = "none";
  const welcomeMsg = document.getElementById("welcomeMsg");
  document.getElementById("usernameDisplay").textContent = username;
  welcomeMsg.style.display = "block";
}

function showLogin() {
  document.getElementById("loginBtn").style.display = "inline-block";
  document.getElementById("welcomeMsg").style.display = "none";
}



const REQUIRED_HEADERS = [
  'Email Address',
  'Last name',
  'First name',
  'Name of project',
  'Project topic',
  'Availability'
];

// File Upload Logic
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
    const headers = Object.keys(data.rows[0]);
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


// Settings modal open/close
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

// Save settings
document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);

function saveSettings() {
  const scheduleCountInput = parseInt(document.getElementById("scheduleCount").value.trim());
  const periodInput = document.getElementById("periodRange").value;
  const roomsInput = document.getElementById("roomsList").value;

  if (isNaN(scheduleCountInput)) {
    settings.scheduleCount = 1;
  } else {
    settings.scheduleCount = scheduleCountInput;
  }

  if (periodInput.includes('-')) {
    const [start, end] = periodInput.split('-').map(p => parseInt(p.trim()));
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      settings.periods = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }
  }

  settings.rooms = roomsInput.split(',').map(r => r.trim()).filter(r => r);

  console.log("Saved Settings:", settings);
  settingsModal.style.display = "none";
}


document.getElementById("generateBtn").addEventListener("click", () => {
  if (!studentData) {
    alert("Please upload a CSV file first.");
    return;
  }
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

window.addEventListener('DOMContentLoaded', () => {
  const loggedInUser = localStorage.getItem("loggedInUser");
  if (loggedInUser) {
    showWelcome(loggedInUser);
  } else {
    showLogin();
  }
});
