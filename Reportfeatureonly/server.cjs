const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8090;

// Configure directories
const reportsDir = path.join(__dirname, 'reports');
const publicReportsDir = path.join(__dirname, 'public', 'reports');

// Create required directories
[reportsDir, publicReportsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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

// Start server
app.listen(PORT, () => {
  console.log(`Report server running on port ${PORT}`);
});
