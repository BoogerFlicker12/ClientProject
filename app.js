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

app.use(express.static('public'));;
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

function filterAndValidateRows(rows) {
  const validRows = [];
  const invalidRows = [];

  for (const [i, row] of rows.entries()) {
    const filtered = {};
    const missingFields = [];
    let isValid = true;

    for (const h of REQUIRED_HEADERS) {
      const key = Object.keys(row).find(k => normalize(k) === normalize(h));
      const value = key ? row[key] : '';
      filtered[h] = value;

      if (!value || value.trim() === '') {
        isValid = false;
        missingFields.push(h);
      }
    }

    if (isValid) {
      validRows.push(filtered);
    } else {
      // Build full identifier object for all REQUIRED_HEADERS with values or empty strings
      const identifier = {};
      for (const h of REQUIRED_HEADERS) {
        const key = Object.keys(row).find(k => normalize(k) === normalize(h));
        identifier[h] = key ? row[key] : '';
      }

      invalidRows.push({
        row: i + 1, // 1-based row number
        missingFields,
        identifier
      });
    }
  }

  return { validRows, invalidRows };
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
      .on('headers', function(headers) {
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
        const { validRows, invalidRows } = filterAndValidateRows(results);
        if (invalidRows.length > 0) {
          return res.status(400).json({
            error: 'Some rows are missing required fields.',
            invalidRows
          });
        }
        res.json({ rows: validRows });
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

      const { validRows, invalidRows } = filterAndValidateRows(rows);
      if (invalidRows.length > 0) {
        return res.status(400).json({
          error: 'Some rows are missing required fields.',
          invalidRows
        });
      }
      res.json({ rows: validRows });
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
