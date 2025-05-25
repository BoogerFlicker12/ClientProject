// app.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

// File upload setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({ storage, fileFilter });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const REQUIRED_HEADERS = [
  'Email Address',
  'Last name',
  'First name',
  'Name of project',
  'Project topic',
  'Availability'
];

function normalize(header) {
  return header.trim().toLowerCase();
}

function validateHeaders(headers) {
  const normalizedHeaders = headers.map(normalize);
  const missing = REQUIRED_HEADERS.filter(req =>
    !normalizedHeaders.includes(normalize(req))
  );
  return missing;
}

function filterAndMapRows(rows) {
  return rows.map(row => {
    const filtered = {};
    REQUIRED_HEADERS.forEach(h => {
      // Try matching keys ignoring case and whitespace
      const key = Object.keys(row).find(k => normalize(k) === normalize(h));
      filtered[h] = key ? row[key] : '';
    });
    return filtered;
  });
}

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded or invalid file type.' });

  const ext = path.extname(req.file.originalname).toLowerCase();

  if (ext === '.csv') {
    const results = [];
    let headersChecked = false;
    let missingHeaders = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('headers', (headers) => {
        missingHeaders = validateHeaders(headers);
        headersChecked = true;
        if (missingHeaders.length > 0) {
          this.destroy();
        }
      })
      .on('data', (data) => results.push(data))
      .on('end', () => {
        fs.unlinkSync(req.file.path);
        if (missingHeaders.length > 0) {
          return res.status(400).json({
            error: 'File contains insufficient information.',
            missingHeaders
          });
        }
        const filtered = filterAndMapRows(results);
        res.json({ rows: filtered });
      })
      .on('error', (err) => {
        res.status(500).json({ error: 'Failed to parse CSV file.', details: err.message });
      });

  } else if (ext === '.xlsx' || ext === '.xls') {
    try {
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      fs.unlinkSync(req.file.path);
      if (!rows.length) {
        return res.status(400).json({ error: 'Excel file contains no rows.' });
      }

      const headers = Object.keys(rows[0]);
      const missingHeaders = validateHeaders(headers);
      if (missingHeaders.length > 0) {
        return res.status(400).json({
          error: 'File contains insufficient information.',
          missingHeaders
        });
      }

      const filtered = filterAndMapRows(rows);
      res.json({ rows: filtered });

    } catch (err) {
      res.status(500).json({ error: 'Failed to parse Excel file.', details: err.message });
    }

  } else {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ error: 'Unsupported file type.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
