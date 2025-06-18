const https = require('https');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const multer = require('multer');
const { exec } = require('child_process');
const axios = require('axios')
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const Docker = require('dockerode');
const docker = new Docker();
const FormData = require('form-data');
const { Buffer } = require('buffer');

const { PassThrough } = require('stream');


require('dotenv').config({ path: '/home/ubuntu/Haske/Explorer-2/WebApplication/.env' });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        'apikey': process.env.SUPABASE_KEY
      }
    }
  }
);

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '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');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8090;
const ORTHANC_URL = process.env.ORTHANC_URL || "https://haske.online:5000";

// Configure directories
const reportsDir = path.join(__dirname, 'reports');
const usersDir = path.join(__dirname, 'users');
const logsDir = path.join(__dirname, 'logs');
const publicReportsDir = path.join(__dirname, 'public', 'reports');
const tempDir = path.join(__dirname, 'temp'); // Added missing tempDir
const logsFile = path.join(logsDir, 'activity_logs.json');

// Create required directories
[reportsDir, usersDir, logsDir, publicReportsDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer storage for file uploads
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
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' || 
        file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed'));
    }
  }
});

// Create institutions.json if it doesn't exist
const institutionsFile = path.join(__dirname, 'institutions.json');
if (!fs.existsSync(institutionsFile)) {
  fs.writeFileSync(institutionsFile, JSON.stringify([], null, 2));
  console.log('Created empty institutions.json file');
}

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS configuration
// Replace the existing CORS config with this:
const allowedOrigins = [
  'https://www.haske.online',
  'https://haske.online',
  'https://haske.online:5000',
  'https://50.17.224.101:3000',
  'http://haske.online:3000'
];

// Update your CORS middleware configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Make sure this comes before your routes
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions)); // Include before other routes



// Request logging middleware
// Add detailed request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
  });
  next();
});


// Helper function for promise-based exec
function execPromise(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

// Add this to your server initialization
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_LOG_FILES = 5;

function rotateLogsIfNeeded() {
  try {
    const stats = fs.statSync(logsFile);
    if (stats.size > MAX_LOG_SIZE) {
      // Rotate logs
      for (let i = MAX_LOG_FILES - 1; i > 0; i--) {
        const oldFile = `${logsFile}.${i}`;
        const newFile = `${logsFile}.${i + 1}`;
        if (fs.existsSync(oldFile)) {
          fs.renameSync(oldFile, newFile);
        }
      }
      fs.renameSync(logsFile, `${logsFile}.1`);
      fs.writeFileSync(logsFile, JSON.stringify([], null, 2));
    }
  } catch (error) {
    console.error('Error rotating logs:', error);
  }
}

// Background scanning and caching system
const INSTITUTIONS_CACHE = {
  lastUpdated: null,
  data: [],
  isScanning: false
};




app.get('/env-test', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY ? '*****' : 'MISSING',
    envPath: require('path').resolve('.env'),
    envContent: require('fs').existsSync('.env') 
      ? require('fs').readFileSync('.env', 'utf-8') 
      : 'FILE NOT FOUND'
  });
  
});


// Add to server.cjs
app.get('/proxy/orthanc/*', async (req, res) => {
  try {
    const path = req.params[0];
    const response = await axios.get(`${ORTHANC_URL}/${path}`, {
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to proxy Orthanc request' });
  }
});

// Background scan all studies (runs periodically)
// Update the scanAllInstitutions function to handle connection errors

async function scanAllInstitutions() {
  if (INSTITUTIONS_CACHE.isScanning) return;
  INSTITUTIONS_CACHE.isScanning = true;
  
  try {
    console.log('Starting full institution scan...');
    
    // Add timeout and better error handling
    const { data: studyIds } = await axios.get(`${ORTHANC_URL}/studies`, {
      timeout: 5000,
      httpsAgent: new https.Agent({ 
        rejectUnauthorized: false // Only if using self-signed certs
      })
    }).catch(err => {
      console.error('Failed to connect to Orthanc:', err.message);
      throw new Error('Orthanc server unavailable');
    });

    // Rest of your function remains the same...
    const institutions = new Set();
    
    const BATCH_SIZE = 10;
    for (let i = 0; i < studyIds.length; i += BATCH_SIZE) {
      const batch = studyIds.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async studyId => {
        try {
          const { data: study } = await axios.get(`${ORTHANC_URL}/studies/${studyId}`, {
            timeout: 3000,
            httpsAgent: new https.Agent({ 
              rejectUnauthorized: false 
            })
          });
          if (study?.MainDicomTags?.InstitutionName) {
            institutions.add(study.MainDicomTags.InstitutionName.trim());
          }
        } catch (error) {
          console.error(`Error processing study ${studyId}:`, error.message);
        }
      }));
      
      if (i % 100 === 0) {
        console.log(`Scan progress: ${Math.min(i + BATCH_SIZE, studyIds.length)}/${studyIds.length}`);
      }
    }
    
    INSTITUTIONS_CACHE.data = Array.from(institutions).map((name, index) => ({
      id: 10000 + index,
      name,
      address: '',
      contactEmail: '',
      contactPhone: '',
      source: 'dicom'
    }));
    
    INSTITUTIONS_CACHE.lastUpdated = new Date();
    console.log(`Institution scan completed. Found ${INSTITUTIONS_CACHE.data.length} institutions.`);
    
  } catch (error) {
    console.error('Full institution scan failed:', error);
    // You could implement a retry mechanism here
  } finally {
    INSTITUTIONS_CACHE.isScanning = false;
  }
}


// Start periodic scanning (every 6 hours)
setInterval(scanAllInstitutions, 6 * 60 * 60 * 1000);
scanAllInstitutions(); // Initial scan

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test connection

async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase
  .from('models')
  .select('*')
  .limit(1);
    
    if (error) throw error;
    console.log('✅ Supabase connected. Postgres version:', data);
    return true;
  } catch (err) {
    console.error('❌ Supabase connection failed:', {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint
    });
    return false;
  }
}

testSupabaseConnection();

// Verify Docker connection at startup
async function verifyDockerConnection() {
  try {
    await docker.ping();
    console.log('Docker connection verified');
  } catch (err) {
    console.error('Docker connection failed:', err);
    process.exit(1);
  }
}

verifyDockerConnection();

// AI Model Endpoint
const rateLimit = require('express-rate-limit');

// Configure rate limiting for AI endpoints
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many AI requests from this IP, please try again later'
});



// Add this near the top with other requires
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const Bull = require('bull');

// Add after other middleware setup
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const analyticsQueue = new Bull('analytics', {
  redis: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

createBullBoard({
  queues: [new BullAdapter(analyticsQueue)],
  serverAdapter
});

app.use('/admin/queues', serverAdapter.getRouter());

// Enhanced analytics endpoints

app.post('/api/analytics/logs', async (req, res) => {
  try {
    const { userId, email, action, metadata = {}, deviceInfo = {} } = req.body;
    
    if (!email || !action) {
      return res.status(400).json({ error: 'Email and action are required' });
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      userId,
      email,
      action,
      timestamp,
      metadata: {
        ...metadata,
        deviceInfo // Include device info in metadata
      },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      // Add simplified device info for easier querying
      deviceType: deviceInfo.deviceType || 'desktop',
      browser: deviceInfo.browser || 'Unknown',
      os: deviceInfo.os || 'Unknown'
    };

    await analyticsQueue.add(logEntry);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error logging analytics:', error);
    res.status(500).json({ error: 'Failed to log analytics' });
  }
});

// Process analytics jobs
analyticsQueue.process(async (job) => {
  const logEntry = job.data;
  
  try {
    // Save to database/file
    const logFilePath = path.join(logsDir, 'analytics_logs.json');
    
    let logs = [];
    if (fs.existsSync(logFilePath)) {
      const fileContent = fs.readFileSync(logFilePath, 'utf8');
      if (fileContent.trim()) {
        logs = JSON.parse(fileContent);
      }
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2));
    
    // Also save to Supabase if configured
    if (process.env.SUPABASE_URL) {
      const { error } = await supabase
        .from('analytics')
        .insert({
          user_id: logEntry.userId,
          email: logEntry.email,
          action: logEntry.action,
          metadata: logEntry.metadata,
          ip_address: logEntry.ip,
          user_agent: logEntry.userAgent,
          timestamp: logEntry.timestamp
        });
      
      if (error) throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error processing analytics job:', error);
    throw error;
  }
});


// Enhanced analytics endpoint
app.get('/api/analytics/logs', async (req, res) => {
  try {
    const { startDate, endDate, action, email } = req.query;
    
    let logs = [];
    
    if (process.env.SUPABASE_URL) {
      // Query from Supabase
      let query = supabase
        .from('analytics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);
      
      if (startDate) query = query.gte('timestamp', startDate);
      if (endDate) query = query.lte('timestamp', endDate);
      if (action) query = query.eq('action', action);
      if (email) query = query.ilike('email', `%${email}%`);
      
      const { data, error } = await query;
      
      if (error) throw error;
      logs = data;
    } else {
      // Fallback to file system
      const logFilePath = path.join(logsDir, 'analytics_logs.json');
      
      if (fs.existsSync(logFilePath)) {
        const fileContent = fs.readFileSync(logFilePath, 'utf8');
        if (fileContent.trim()) {
          logs = JSON.parse(fileContent);
        }
      }
      
      // Apply filters
      if (startDate) {
        logs = logs.filter(log => new Date(log.timestamp) >= new Date(startDate));
      }
      if (endDate) {
        logs = logs.filter(log => new Date(log.timestamp) <= new Date(endDate));
      }
      if (action) {
        logs = logs.filter(log => log.action === action);
      }
      if (email) {
        logs = logs.filter(log => log.email.toLowerCase().includes(email.toLowerCase()));
      }
    }
    
    // Generate chart data
    const chartData = generateChartData(logs);
    
    res.json({
      logs: logs.map(log => ({
        ...log,
        // Ensure metadata exists
        metadata: log.metadata || {},
        // Simplify user agent display
        userAgent: log.browser || log.userAgent?.split(' ')[0] || 'Unknown'
      })),
      chartData,
      stats: generateStats(logs)
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Helper functions
function generateChartData(logs) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Initialize date map
  const dateMap = {};
  for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dateMap[dateStr] = {
      date: dateStr,
      signIns: 0,
      signOuts: 0,
      pageViews: 0,
      otherActions: 0
    };
  }
  
  // Count actions by date
  logs.forEach(log => {
    const dateStr = log.timestamp.split('T')[0];
    if (!dateMap[dateStr]) return;
    
    if (log.action.toLowerCase().includes('sign in')) {
      dateMap[dateStr].signIns++;
    } else if (log.action.toLowerCase().includes('sign out')) {
      dateMap[dateStr].signOuts++;
    } else if (log.action.toLowerCase().includes('view')) {
      dateMap[dateStr].pageViews++;
    } else {
      dateMap[dateStr].otherActions++;
    }
  });
  
  return Object.values(dateMap);
}
function generateStats(logs) {
  const userActivity = {};
  const actionCounts = {};
  const userAgents = {};
  const devices = {};
  const operatingSystems = {};
  
  logs.forEach(log => {
    // User activity
    if (!userActivity[log.email]) {
      userActivity[log.email] = {
        firstSeen: log.timestamp,
        lastSeen: log.timestamp,
        actions: 0
      };
    }
    
    userActivity[log.email].actions++;
    if (new Date(log.timestamp) > new Date(userActivity[log.email].lastSeen)) {
      userActivity[log.email].lastSeen = log.timestamp;
    }
    
    // Action counts
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    
    // User agents
    const ua = log.metadata?.deviceInfo?.browser || log.browser || 'Unknown';
    userAgents[ua] = (userAgents[ua] || 0) + 1;
    
    // Devices
    const deviceType = log.deviceType || 'desktop';
    devices[deviceType] = (devices[deviceType] || 0) + 1;
    
    // OS
    const os = log.metadata?.deviceInfo?.os || log.os || 'Unknown';
    operatingSystems[os] = (operatingSystems[os] || 0) + 1;
  });
  
  return {
    totalLogs: logs.length,
    uniqueUsers: Object.keys(userActivity).length,
    mostActiveUser: Object.entries(userActivity)
      .sort((a, b) => b[1].actions - a[1].actions)[0],
    mostCommonAction: Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])[0],
    actionCounts, // Add this line to include the raw action counts
    userAgentStats: Object.entries(userAgents)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    deviceStats: Object.entries(devices)
      .sort((a, b) => b[1] - a[1]),
    osStats: Object.entries(operatingSystems)
      .sort((a, b) => b[1] - a[1])
  };
}

// Track ongoing uploads
const UPLOAD_TRACKER = {};

// Create temp directory if it doesn't exist
const TEMP_UPLOAD_DIR = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

// Configure larger timeouts
const ORTHANC_TIMEOUT = 600000; // 10 minutes
const STREAMLIT_TIMEOUT = 600000; // 10 minutes

// Add to server.cjs

// MRIQC Processing Endpoint
// Simplified MRIQC processing endpoint
app.post('/mriqc/process', async (req, res) => {
  console.log('MRIQC Process Request Received:', req.body);
  
  try {
      const { orthancId, patientID } = req.body;
      
      if (!orthancId) {
          return res.status(400).json({ 
              error: 'Orthanc ID is required'
          });
      }

      // 1. Verify study exists
      const studyUrl = `${ORTHANC_URL}/studies/${orthancId}`;
      console.log('Verifying study at:', studyUrl);
      
      try {
          await axios.get(studyUrl, {
              httpsAgent: new https.Agent({ rejectUnauthorized: false }),
              timeout: 5000
          });
      } catch (err) {
          console.error('Orthanc API Error:', err.response?.data || err.message);
          return res.status(404).json({ 
              error: 'Study not found in Orthanc',
              orthancError: err.response?.data || err.message 
          });
      }

      // 2. Return the direct Orthanc archive URL
      res.json({
          success: true,
          patientID: patientID || orthancId.substring(0, 8), // Fallback to partial Orthanc ID
          archiveUrl: `${ORTHANC_URL}/studies/${orthancId}/archive`,
          directDownload: true
      });

  } catch (error) {
      console.error('MRIQC processing error:', error);
      res.status(500).json({ 
          error: 'Failed to process study',
          details: error.message
      });
  }
});


// Model Management Endpoints
app.get('/api/ai/models', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    res.json(data || []);
  } catch (err) {
    console.error('Models fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});


app.post('/api/ai/models', async (req, res) => {
  try {
    const { name, description, modality, body_part, docker_image, entry_point, github_link } = req.body;
    
    if (!name || !docker_image || !entry_point) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('models')
      .insert({
        name,
        description,
        modality: Array.isArray(modality) ? modality : [modality],
        body_part: Array.isArray(body_part) ? body_part : [body_part],
        docker_image,
        entry_point,
        github_link,
        is_active: true
      })
      .select();

    if (error) throw error;
    
    res.status(201).json(data[0]);
  } catch (err) {
    console.error('Model creation error:', err);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

app.put('/api/ai/models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('models')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;
    
    res.json(data[0]);
  } catch (err) {
    console.error('Model update error:', err);
    res.status(500).json({ error: 'Failed to update model' });
  }
});

app.delete('/api/ai/models/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('models')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    res.status(204).end();
  } catch (err) {
    console.error('Model deletion error:', err);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// Update your Orthanc request configuration
async function verifyOrthancStudy(orthancId) {
  try {
    const response = await axios.get(`${ORTHANC_URL}/studies/${orthancId}`, {
      timeout: 3000,
      httpsAgent: new https.Agent({ 
        rejectUnauthorized: false,
        keepAlive: true
      }),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Orthanc verification error:', error);
    throw error;
  }
}

// AI Analysis Endpoint
app.post('/api/ai/analyze', aiLimiter, async (req, res) => {
  try {
    console.log('AI Analysis request received:', req.body); // Log incoming request
    
    // 1. Enhanced input validation with better error messages
    const { orthancId, modality, bodyPart, callbackUrl } = req.body;
    
    if (!orthancId || !modality || !bodyPart) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: {
          orthancId: 'string (DICOM study ID)',
          modality: 'string (e.g., CT, MRI)',
          bodyPart: 'string (e.g., HEAD, CHEST)'
        },
        received: {
          orthancId: orthancId?.length ? 'present' : 'missing',
          modality: modality?.length ? 'present' : 'missing',
          bodyPart: bodyPart?.length ? 'present' : 'missing'
        }
      });
    }

    // 2. Verify Supabase connection
    const { error: connError } = await supabase
      .from('models')
      .select('*')
      .limit(1);
    if (connError) throw new Error('Supabase connection failed');

    // 3. Verify Orthanc resource exists and get study info
    let studyInfo;
    try {
      const response = await axios.get(`${ORTHANC_URL}/studies/${orthancId}`, {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 5000
      });
      studyInfo = response.data;
    } catch (orthancError) {
      console.error('Orthanc API error:', orthancError);
      if (orthancError.response?.status === 404) {
        return res.status(404).json({
          error: 'DICOM study not found in Orthanc',
          orthancId,
          suggestion: 'Verify the study exists and is accessible'
        });
      }
      return res.status(502).json({
        error: 'Orthanc server unavailable',
        details: process.env.NODE_ENV === 'development' ? orthancError.message : undefined
      });
    }

    // 4. Find matching models (case-insensitive with fallback)
    const upperModality = modality.toUpperCase();
    const upperBodyPart = bodyPart.toUpperCase();
    
    const { data: models, error: queryError } = await supabase
      .from('models')
      .select('id, name, description, docker_image, entry_point, github_link')
      .contains('modality', [upperModality])
      .contains('body_part', [upperBodyPart])
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .limit(5);

    if (queryError) throw new Error('Model database query failed');
    
    console.log(`Found ${models?.length} models for ${upperModality}/${upperBodyPart}`);
    
    if (!models?.length) {
      return res.status(200).json({
        status: 'no_model',
        message: `No suitable model found for ${modality} ${bodyPart} scans`,
        availableModels: await getAvailableModels(),
        studyInfo: { // Provide basic study info to help frontend
          patientName: studyInfo?.MainDicomTags?.PatientName || 'Unknown',
          studyDate: studyInfo?.MainDicomTags?.StudyDate || 'Unknown',
          modalities: studyInfo?.ModalitiesInStudy || []
        }
      });
    }

    // 5. Create job record
    const jobId = uuidv4();
    const model = models[0];
    const archiveUrl = `${ORTHANC_URL}/studies/${orthancId}/archive`;
    
    const { error: insertError } = await supabase
      .from('jobs')
      .insert({
        id: jobId,
        model_id: model.id,
        orthanc_id: orthancId,
        status: 'pending',
        parameters: { 
          modality, 
          bodyPart,
          archiveUrl // Store the archive URL for the worker
        },
        study_info: { // Store study metadata for reference
          patientName: studyInfo?.MainDicomTags?.PatientName,
          studyDate: studyInfo?.MainDicomTags?.StudyDate,
          modalities: studyInfo?.ModalitiesInStudy
        }
      });

    if (insertError) throw new Error('Failed to register job');

    // 6. Add to processing queue
    await addToJobQueue({
      jobId,
      orthancId,
      model,
      archiveUrl, // Pass the archive URL directly to the worker
      callbackUrl,
      auth: { // Include Orthanc credentials for the worker
        orthancUrl: ORTHANC_URL,
        username: process.env.ORTHANC_USER,
        password: process.env.ORTHANC_PASSWORD
      }
    });

    // 7. Return response with all relevant information
    res.json({
      status: 'queued',
      jobId,
      archiveUrl, // For direct download if needed
      model: {
        id: model.id,
        name: model.name,
        description: model.description,
        githubLink: model.github_link
      },
      studyInfo: {
        patientName: studyInfo?.MainDicomTags?.PatientName || 'Unknown',
        studyDate: studyInfo?.MainDicomTags?.StudyDate || 'Unknown',
        modalities: studyInfo?.ModalitiesInStudy || []
      },
      estimatedTime: '5-15 minutes' // Give user an expectation
    });

  } catch (err) {
    console.error('AI analysis error:', {
      error: err.message,
      stack: err.stack,
      requestBody: req.body,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      error: 'Analysis failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      suggestion: 'Please try again later or contact support'
    });
  }
});

// Helper function to get available models
async function getAvailableModels() {
  const { data } = await supabase
    .from('models')
    .select('name, modality, body_part')
    .eq('is_active', true);
  return data || [];
}

// Job queue implementation
async function addToJobQueue(job) {
  if (process.env.REDIS_URL) {
    const queue = new Bull('ai-jobs', process.env.REDIS_URL);
    await queue.add(job, {
      jobId: job.jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    });
  } else {
    processJobInBackground(job.jobId, job.orthancId, job.model)
      .catch(err => console.error(`Job ${job.jobId} failed:`, err));
  }
}

// Job processing function
async function processJobInBackground(jobId, orthancId, model) {
  try {
    await supabase
      .from('jobs')
      .update({ status: 'running' })
      .eq('id', jobId);
    
    await new Promise((resolve, reject) => {
      docker.pull(model.docker_image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, onFinished);
        function onFinished(err) {
          err ? reject(err) : resolve();
        }
      });
    });
    
    const container = await docker.createContainer({
      Image: model.docker_image,
      Cmd: [model.entry_point, orthancId],
      HostConfig: { AutoRemove: true }
    });
    
    await container.start();
    const output = await container.wait();
    const logs = await container.logs({ stdout: true, stderr: true });
    
    await supabase
      .from('jobs')
      .update({ 
        status: 'completed',
        results: JSON.parse(logs.toString()),
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
  } catch (err) {
    console.error('Job processing failed:', err);
    await supabase
      .from('jobs')
      .update({ 
        status: 'failed',
        results: { error: err.message }
      })
      .eq('id', jobId);
  }
}

// Job status endpoint
app.get('/api/ai/job/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    res.json(job);
  } catch (err) {
    console.error('Job status error:', err);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Config endpoint
app.get('/api/ai/config', async (req, res) => {
  try {
    const { data: models } = await supabase
      .from('models')
      .select('id, name, description, modality, body_part, github_link');
    
    res.json({
      models: models || [],
      githubRepo: process.env.GITHUB_REPO || 'https://github.com/MAILABHASKE/mailab-models' // General repo link
    });
  } catch (err) {
    console.error('Config fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

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

// PDF handling endpoints
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

app.get('/reports/:orthancId.pdf', (req, res) => {
  const { orthancId } = req.params;
  const filePath = path.join(publicReportsDir, `${orthancId}.pdf`);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('PDF report not found');
  }
  
  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(filePath);
});

// Report sharing endpoint
app.post('/send-report', async (req, res) => {
  const { orthancId, studyInstanceUID, sendType, senderName, doctorEmail, message } = req.body;

  if (!orthancId || !studyInstanceUID || !sendType || !senderName || !doctorEmail) {
    return res.status(400).send({ message: 'Missing required fields' });
  }

  try {
    const viewerUrl = `${ORTHANC_URL}/ohif/viewer?StudyInstanceUIDs=${studyInstanceUID}`;
    const pdfUrl = `${ORTHANC_URL}/reports/${orthancId}.pdf`;
    const pdfExists = fs.existsSync(path.join(publicReportsDir, `${orthancId}.pdf`));

    const emailContent = `
      <h2>Medical Report Shared With You - Haske</h2>
      <p><strong>From:</strong> ${senderName}</p>
      <p>${message || 'A colleague has shared a medical report with you.'}</p>
      
      ${sendType === 'both' || sendType === 'image' ? `
        <h3>Viewing Options:</h3>
        <ul>
          <li><a href="${viewerUrl}">View Images Online (OHIF Viewer)</a></li>
        </ul>
      ` : ''}
      
      ${pdfExists ? `
        <h3>Download Report:</h3>
        <ul>
          <li><a href="${pdfUrl}">Download PDF Report</a></li>
        </ul>
      ` : ''}
      
      <p style="margin-top: 20px; color: #666; font-size: 0.9em;">
        This email was sent via Haske Medical Platform
      </p>
    `;

    const msg = {
      to: doctorEmail,
      from: 'haske@mailab.io',
      subject: `Medical Report Shared by ${senderName}`,
      html: emailContent,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    };

    await sgMail.send(msg);
    
    // Log the activity
    const logEntry = {
      timestamp: new Date().toISOString(),
      sender: senderName,
      recipient: doctorEmail,
      orthancId,
      studyInstanceUID,
      sendType,
      pdfUrl: pdfExists ? pdfUrl : null
    };
    
    fs.appendFileSync(logsFile, JSON.stringify(logEntry) + '\n');

    res.status(200).send({ 
      message: 'Report sent successfully!',
      links: {
        viewer: sendType !== 'report' ? viewerUrl : undefined,
        pdf: pdfExists ? pdfUrl : undefined
      }
    });
    
  } catch (error) {
    console.error('Error sending report:', error);
    res.status(500).send({ 
      message: 'Failed to send report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get("/api/dicom-stats", async (req, res) => {
  try {
    // First get all studies
    const { data: studies } = await axios.get(`${ORTHANC_URL}/studies`, {
      timeout: 5000
    });

    if (!Array.isArray(studies)) {
      throw new Error("Invalid studies data received from Orthanc");
    }

    const stats = { 
      bodyParts: {},
      studyDescriptions: {},
      modalities: {},
      institutions: {},
      modalitiesPerInstitution: {}, // New field
      totalStudies: studies.length
    };

    // Process studies in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < studies.length; i += BATCH_SIZE) {
      const batch = studies.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (studyId) => {
        try {
          // Get study metadata
          const { data: study } = await axios.get(`${ORTHANC_URL}/studies/${studyId}`, {
            timeout: 3000
          });

          // Count study descriptions
          if (study?.MainDicomTags?.StudyDescription) {
            const desc = study.MainDicomTags.StudyDescription.trim();
            stats.studyDescriptions[desc] = (stats.studyDescriptions[desc] || 0) + 1;
          }

          // Count institutions
          const institutionName = study?.MainDicomTags?.InstitutionName?.trim() || 'Unknown';
          stats.institutions[institutionName] = (stats.institutions[institutionName] || 0) + 1;

          // Get series for this study
          const { data: seriesList } = await axios.get(`${ORTHANC_URL}/studies/${studyId}/series`, {
            timeout: 3000
          });

          // Process each series
          await Promise.all(seriesList.map(async (series) => {
            try {
              const seriesId = typeof series === "string" ? series : series.ID;
              const { data: seriesData } = await axios.get(`${ORTHANC_URL}/series/${seriesId}`, {
                timeout: 3000
              });
              
              // Count body parts
              if (seriesData?.MainDicomTags?.BodyPartExamined) {
                const bodyPart = seriesData.MainDicomTags.BodyPartExamined.trim().toUpperCase();
                stats.bodyParts[bodyPart] = (stats.bodyParts[bodyPart] || 0) + 1;
              }
              
              // Count modalities
              if (seriesData?.MainDicomTags?.Modality) {
                const modality = seriesData.MainDicomTags.Modality.trim();
                stats.modalities[modality] = (stats.modalities[modality] || 0) + 1;
                
                // Track modality per institution
                const key = `${institutionName}|${modality}`;
                stats.modalitiesPerInstitution[key] = (stats.modalitiesPerInstitution[key] || 0) + 1;
              }
            } catch (seriesError) {
              console.error(`Error processing series ${seriesId}:`, seriesError.message);
            }
          }));
        } catch (studyError) {
          console.error(`Error processing study ${studyId}:`, studyError.message);
        }
      }));
    }

    // Convert to arrays for easier charting
    const result = {
      bodyParts: Object.entries(stats.bodyParts).map(([name, count]) => ({ name, count })),
      studyDescriptions: Object.entries(stats.studyDescriptions).map(([name, count]) => ({ name, count })),
      modalities: Object.entries(stats.modalities).map(([name, count]) => ({ name, count })),
      institutions: Object.entries(stats.institutions).map(([name, count]) => ({ name, count })),
      modalitiesPerInstitution: Object.entries(stats.modalitiesPerInstitution).map(([key, count]) => {
        const [institution, modality] = key.split('|');
        return { 
          name: `${institution} - ${modality}`,
          institution,
          modality,
          count 
        };
      }),
      totalStudies: stats.totalStudies
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching DICOM data:", error.message);
    res.status(500).json({ 
      error: "Failed to fetch DICOM statistics",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

const createDefaultSuperAdmin = () => {
  const defaultSuperAdminEmail = 'haske@mailab.io';
  const userFiles = fs.readdirSync(usersDir);
  
  const superAdminExists = userFiles.some(file => {
    const userData = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf8'));
    return userData.email === defaultSuperAdminEmail && userData.role === 'super_admin';
  });

  if (!superAdminExists) {
    const userId = Date.now();
    const superAdmin = {
      id: userId,
      first_name: "Super",
      last_name: "Admin",
      institution_name: "N/A",
      institution_address: "N/A",
      role: "super_admin",
      email: defaultSuperAdminEmail,
      phone_number: "",
      approved: true
    };

    const filePath = path.join(usersDir, `user_${userId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(superAdmin, null, 2));
    console.log("Default super admin created:", defaultSuperAdminEmail);
  }
};

app.get('/api/verification/check-verification', (req, res) => {
  const { email } = req.query;

  try {
    const files = fs.readdirSync(usersDir);
    const user = files
      .map((file) => {
        const filePath = path.join(usersDir, file);
        const userData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(userData);
      })
      .find((user) => user.email === email);

    if (user) {
      res.status(200).send({
        isVerified: user.approved || false,
        institutionName: user.institution_name || '',
        isAdmin: user.role === 'admin' || user.role === 'super_admin',
        isDeactivated: user.deactivated || false,
      });
    } else {
      res.status(404).send({ message: 'User not found.' });
    }
  } catch (error) {
    console.error('Error checking verification:', error);
    res.status(500).send({ message: 'Error checking verification.' });
  }
});

// User management endpoints
app.post('/api/verification/submit-verification', async (req, res) => {
  try {
    const { first_name, last_name, institution_name, institution_address, role, email, phone_number } = req.body;
    
    if (!first_name || !last_name || !email || !role) {
      return res.status(400).send({ message: 'Missing required fields' });
    }

    const userId = Date.now();
    const user = {
      id: userId,
      first_name,
      last_name,
      institution_name: institution_name || 'N/A',
      institution_address: institution_address || 'N/A',
      role,
      email,
      phone_number: phone_number || '',
      approved: false,
    };

    const filePath = path.join(usersDir, `user_${userId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(user, null, 2));
    
    res.status(201).send({ message: 'Verification request submitted successfully!', user });
  } catch (error) {
    console.error('Error submitting verification:', error);
    res.status(500).send({ message: 'Error submitting verification.' });
  }
});

// Get institutions from DICOM metadata
app.get('/api/institutions/from-dicom', async (req, res) => {
  try {
    const institutions = await scanAllInstitutions();
    res.json(institutions.map((name, index) => ({
      id: 10000 + index,
      name,
      address: '',
      contactEmail: '',
      contactPhone: ''
    })));
  } catch (error) {
    console.error('Error fetching DICOM institutions:', error);
    res.status(500).json({ error: 'Failed to fetch institutions from DICOM' });
  }
});

app.get('/api/institutions', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, search = '', source = 'all' } = req.query;
    const institutionsFile = path.join(__dirname, 'institutions.json');
    let manualInstitutions = [];
    
    // Read manual institutions
    if (fs.existsSync(institutionsFile)) {
      try {
        manualInstitutions = JSON.parse(fs.readFileSync(institutionsFile, 'utf8'));
      } catch (fileError) {
        console.error('Error reading institutions file:', fileError);
        fs.writeFileSync(institutionsFile, JSON.stringify([], null, 2));
      }
    }

    // Get DICOM institutions if needed
    let dicomInstitutions = [];
    if (source === 'all' || source === 'dicom') {
      try {
        const { data: studies } = await axios.get(`${ORTHANC_URL}/studies`);
        const institutionsSet = new Set();

        // Sample studies (first, last, and random samples)
        const sampleIndices = new Set([0, studies.length - 1]);
        while (sampleIndices.size < Math.min(20, studies.length)) {
          sampleIndices.add(Math.floor(Math.random() * studies.length));
        }

        await Promise.all(Array.from(sampleIndices).map(async i => {
          try {
            const { data: study } = await axios.get(`${ORTHANC_URL}/studies/${studies[i]}`);
            if (study?.MainDicomTags?.InstitutionName) {
              institutionsSet.add(study.MainDicomTags.InstitutionName.trim());
            }
          } catch (error) {
            console.error(`Error processing study ${studies[i]}:`, error.message);
          }
        }));

        dicomInstitutions = Array.from(institutionsSet).map((name, index) => ({
          id: 10000 + index,
          name,
          address: '',
          contactEmail: '',
          contactPhone: ''
        }));
      } catch (dicomError) {
        console.error('Error fetching DICOM institutions:', dicomError.message);
      }
    }

    // Combine and filter
    let allInstitutions = [];
    const nameSet = new Set();
    
    if (source === 'all' || source === 'manual') {
      allInstitutions = [...manualInstitutions];
      manualInstitutions.forEach(i => nameSet.add(i.name.toLowerCase()));
    }
    
    if (source === 'all' || source === 'dicom') {
      for (const inst of dicomInstitutions) {
        const lowerName = inst.name.toLowerCase();
        if (!nameSet.has(lowerName)) {
          allInstitutions.push(inst);
          nameSet.add(lowerName);
        }
      }
    }

    // Apply search filter
    const filteredInstitutions = search 
      ? allInstitutions.filter(inst => 
          inst.name.toLowerCase().includes(search.toLowerCase()))
      : allInstitutions;

    // Apply pagination
    const startIndex = (page - 1) * pageSize;
    const paginatedInstitutions = filteredInstitutions.slice(
      startIndex, 
      startIndex + pageSize
    );

    res.json({
      success: true,
      institutions: paginatedInstitutions,
      totalCount: filteredInstitutions.length
    });
  } catch (error) {
    console.error('Error in institutions endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institutions'
    });
  }
});

app.post('/api/institutions', async (req, res) => {
  try {
    const { name, address, contactEmail, contactPhone } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Institution name is required' });
    }

    const institutionsFile = path.join(__dirname, 'institutions.json');
    let institutions = [];

    if (fs.existsSync(institutionsFile)) {
      institutions = JSON.parse(fs.readFileSync(institutionsFile, 'utf8'));
    }

    const newId = institutions.length > 0 
      ? Math.max(...institutions.map(i => i.id)) + 1 
      : 1;

    const newInstitution = {
      id: newId,
      name,
      address: address || '',
      contactEmail: contactEmail || '',
      contactPhone: contactPhone || ''
    };

    institutions.push(newInstitution);
    fs.writeFileSync(institutionsFile, JSON.stringify(institutions, null, 2));

    res.json({
      success: true,
      institution: newInstitution
    });
  } catch (error) {
    console.error('Error adding institution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add institution'
    });
  }
});

app.post('/api/institutions/scan', async (req, res) => {
  if (INSTITUTIONS_CACHE.isScanning) {
    return res.json({ 
      status: 'scan_already_in_progress',
      lastUpdated: INSTITUTIONS_CACHE.lastUpdated
    });
  }
  
  try {
    scanAllInstitutions(); // Trigger async scan
    res.json({ 
      status: 'scan_initiated',
      lastUpdated: INSTITUTIONS_CACHE.lastUpdated
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start scan' });
  }
});
app.get('/api/verification/get-users', (req, res) => {
  try {
    const files = fs.readdirSync(usersDir);
    const users = files.map(file => {
      const filePath = path.join(usersDir, file);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });

    res.status(200).send(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send({ message: 'Error fetching users.' });
  }
});

// Delete User
app.delete('/api/verification/delete-user/:id', (req, res) => {
  const { id } = req.params;
  const userFile = path.join(usersDir, `user_${id}.json`);

  try {
    if (!fs.existsSync(userFile)) {
      return res.status(404).send({ message: 'User not found.' });
    }

    fs.unlinkSync(userFile);
    res.status(200).send({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).send({ message: 'Error deleting user.' });
  }
});

// Function to deactivate or activate a user
app.post('/api/verification/deactivate-user/:id', (req, res) => {
  const { id } = req.params;
  const { deactivated } = req.body;
  const userFile = path.join(usersDir, `user_${id}.json`);

  try {
    if (!fs.existsSync(userFile)) {
      return res.status(404).send({ message: 'User not found.' });
    }

    const user = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    user.deactivated = deactivated;

    // Save the updated user file
    fs.writeFileSync(userFile, JSON.stringify(user, null, 2));

    const statusMessage = deactivated
      ? 'User deactivated successfully.'
      : 'User activated successfully.';

    res.status(200).send({ message: statusMessage, user });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).send({ message: 'Error updating user status.' });
  }
});


// API to fetch stats for users, admins, and institutions
app.get('/api/verification/stats', (req, res) => {
  try {
    const files = fs.readdirSync(usersDir);
    const users = files.map(file => {
      const filePath = path.join(usersDir, file);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    });

    const stats = {
      users: users.length,
      admins: users.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
      institutions: new Set(users.map(u => u.institution_name)).size
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.post('/api/verification/approve-user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userFile = path.join(usersDir, `user_${id}.json`);

    if (!fs.existsSync(userFile)) {
      return res.status(404).send({ message: 'User not found.' });
    }

    const user = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    user.approved = true;

    fs.writeFileSync(userFile, JSON.stringify(user, null, 2));

    const msg = {
      to: user.email,
      from: 'haske@mailab.io',
      subject: 'Verification Approved - Welcome to Haske!',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
          <h2 style="color: #007BFF;">Account Creation Successful!</h2>
          <p>Dear <strong>${user.first_name}</strong>,</p>
          <p>Congratulations! We are pleased to inform you that your account has been created and approved/activated.</p>
          <p>
            <a href="https://www.haske.online/signin" style="display: inline-block; padding: 10px 20px; background-color: #007BFF; color: #fff; text-decoration: none; border-radius: 5px;">Sign in to your Account</a>
          </p>
          <p>If you have any questions, feel free to reach out to us at <a href="mailto:haske.support@mailab.io">haske.support@mailab.io</a>.</p>
          <p>Best regards,</p>
          <p><strong>The Haske Team</strong></p>
        </div>
      `,
    };

    await sgMail.send(msg);

    res.status(200).send({ message: 'User approved and notified.', user });
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).send({ message: 'Error approving user.' });
  }
});

// Logs endpoints
// Update the /api/verification/logs endpoint
// Update the logs endpoint with better error handling
app.get('/api/verification/logs', (req, res) => {
  const logsFilePath = path.join(logsDir, 'activity_logs.json');
  
  try {
    // Initialize if file doesn't exist
    if (!fs.existsSync(logsFilePath)) {
      fs.writeFileSync(logsFilePath, '[]');
      return res.json({ logs: [] });
    }

    const fileContent = fs.readFileSync(logsFilePath, 'utf8').trim();
    
    // Handle empty file
    if (!fileContent) {
      return res.json({ logs: [] });
    }

    // Parse logs
    let logs = [];
    try {
      logs = JSON.parse(fileContent);
      if (!Array.isArray(logs)) {
        throw new Error('Logs file does not contain an array');
      }
    } catch (parseError) {
      console.error('Error parsing logs:', parseError);
      return res.status(500).json({ error: 'Failed to parse logs file' });
    }

    // Filter and format logs for analytics
    const formattedLogs = logs.map(log => ({
      email: log.email || 'unknown',
      action: log.action || 'unknown',
      timestamp: log.timestamp || new Date().toISOString()
    }));

    res.json({ 
      logs: formattedLogs,
      chartData: [] // Frontend will process this
    });

  } catch (error) {
    console.error('Failed to process logs:', error);
    res.status(500).json({ 
      error: 'Failed to load logs',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

const validateLogAction = (req, res, next) => {
  const { email, action } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ error: 'Invalid action' });
  }
  
  next();
};

app.post('/api/verification/log-action', (req, res) => {
  try {
    const { email, action } = req.body;
    
    if (!email || !action) {
      return res.status(400).json({ message: 'Missing email or action' });
    }

    const timestamp = new Date().toISOString();
    const newLog = { email, action, timestamp };
    const logsFilePath = path.join(logsDir, 'activity_logs.json');

    // Read existing logs or initialize
    let logs = [];
    if (fs.existsSync(logsFilePath)) {
      try {
        const fileContent = fs.readFileSync(logsFilePath, 'utf8');
        if (fileContent.trim()) {
          logs = JSON.parse(fileContent);
        }
      } catch (error) {
        console.error('Error reading logs file:', error);
      }
    }

    // Add new log entry
    logs.push(newLog);

    // Write back to file with proper formatting
    fs.writeFileSync(logsFilePath, JSON.stringify(logs, null, 2));

    res.status(200).json({ message: 'Action logged successfully' });
  } catch (error) {
    console.error('Error logging action:', error);
    res.status(500).json({ message: 'Error logging action' });
  }
});

// Create default super admin on startup
createDefaultSuperAdmin();

// Update User Role (Only by Super Admin)
app.post('/api/verification/update-role/:id', (req, res) => {
  const { id } = req.params;
  const { role, requesterEmail } = req.body;
  const userFile = path.join(usersDir, `user_${id}.json`);

  try {
    if (!fs.existsSync(userFile)) {
      return res.status(404).send({ message: 'User not found.' });
    }

    const userFiles = fs.readdirSync(usersDir);
    const requester = userFiles.map(file => {
      const filePath = path.join(usersDir, file);
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }).find(user => user.email === requesterEmail);

    if (!requester || requester.role !== 'super_admin') {
      return res.status(403).send({ message: 'Only a super admin can update roles.' });
    }

    const user = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    user.role = role;

    fs.writeFileSync(userFile, JSON.stringify(user, null, 2));

    res.status(200).send({ message: 'User role updated successfully.', user });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).send({ message: 'Error updating user role.' });
  }
});




// HTTPS server configuration
const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/haske.online/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/haske.online/cert.pem'),
};

// Start server
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`Secure server running on port ${PORT}`);
});

// Error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
