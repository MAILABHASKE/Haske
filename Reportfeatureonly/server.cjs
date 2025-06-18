const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const https = require('https');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8090;
const ORTHANC_URL = process.env.ORTHANC_URL || "https://haske.online:5000";

// Configure directories
const reportsDir = path.join(__dirname, 'reports');
const publicReportsDir = path.join(__dirname, 'public', 'reports');
const tempDir = path.join(__dirname, 'temp');

// Create required directories
[reportsDir, publicReportsDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Report endpoints
app.post('/save-report', (req, res) => {
  const { orthancId, reportData } = req.body;

  if (!orthancId || !reportData) {
    return res.status(400).send({ message: 'Missing orthancId or reportData' });
  }

  const filePath = path.join(reportsDir, `report_${orthancId}.json`);

  fs.writeFile(filePath, JSON.stringify(reportData, null, 2), (err) => {
    if (err) {
      console.error('Error saving report:', err);
      return res.status(500).send({ message: 'Failed to save report.' });
    }
    res.status(200).send({ message: 'Report saved successfully!' });
  });
});

app.get('/load-report/:orthancId', (req, res) => {
  const { orthancId } = req.params;
  const filePath = path.join(reportsDir, `report_${orthancId}.json`);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error loading report:', err);
      return res.status(500).send({ message: 'Failed to load report, fill in your reports.' });
    }

    try {
      const reportData = JSON.parse(data);
      res.status(200).send(reportData);
    } catch (parseError) {
      console.error('Error parsing report:', parseError);
      res.status(500).send({ message: 'Error parsing report data.' });
    }
  });
});

// PDF upload endpoint
app.post('/upload-pdf', upload.single('pdf'), (req, res) => {
  const { orthancId } = req.body;
  
  if (!req.file) {
    return res.status(400).send({ message: 'No PDF file uploaded' });
  }

  if (!orthancId) {
    return res.status(400).send({ message: 'Missing orthancId' });
  }

  const newPath = path.join(publicReportsDir, `${orthancId}.pdf`);
  
  fs.rename(req.file.path, newPath, (err) => {
    if (err) {
      console.error('Error saving PDF:', err);
      return res.status(500).send({ message: 'Failed to save PDF' });
    }
    
    const pdfUrl = `${ORTHANC_URL}/reports/${orthancId}.pdf`;
    res.status(200).send({ url: pdfUrl });
  });
});

// PDF download endpoint
app.get('/reports/:orthancId.pdf', (req, res) => {
  const { orthancId } = req.params;
  const filePath = path.join(publicReportsDir, `${orthancId}.pdf`);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('PDF report not found');
  }
  
  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(filePath);
});

// HTTPS server configuration
const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/haske.online/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/haske.online/cert.pem'),
};

// Start server
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`Secure report server running on port ${PORT}`);
});
