// server.js

// Import necessary libraries
const express = require('express');
const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors'); // Adding cors for cross-origin requests
const cookieParser = require('cookie-parser');
require('dotenv').config(); // Add this line

// // Import routes
// const wishesRouter = require('./routes/wishes');
// const mediaRouter = require('./routes/media');
// const remindersRouter = require('./routes/reminders');
// const eventsRouter = require("./routes/events");

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000; // Use environment variable or default to 3000

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: '*' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "font-src 'self' data:;");
  next();
});

// Load the Firebase service account key with error handling
let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
  console.log('✅ Service account key loaded successfully');
} catch (error) {
  console.error('❌ Failed to load service account key:', error.message);
  process.exit(1);
}

// Initialize Firebase Admin SDK with better error handling
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id, // Use from service account
      storageBucket: 'gs://safipraneeth-2c6f8.firebasestorage.app', // Use correct bucket
    });
    console.log('✅ Firebase Admin SDK initialized and connected successfully!');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    process.exit(1);
  }
}

// Get Firestore and Storage instances
const db = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket();

// Test Firebase connection
db.collection('test').limit(1).get()
  .then(() => console.log('✅ Firestore connection verified'))
  .catch(error => {
    console.error('❌ Firestore connection failed:', error.message);
  });

// Configure Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for files
  },
});

const DEFAULT_COLLECTION = 'wedding-data';

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend API is running',
    firebase: admin.apps.length > 0 ? 'connected' : 'disconnected'
  });
});

// Firebase status check
app.get('/firebase-status', async (req, res) => {
  try {
    await db.collection('test').limit(1).get();
    res.json({ status: 'connected', message: 'Firestore is accessible' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// List documents from default collection
app.get('/docs', async (req, res) => {
  try {
    const snapshot = await db.collection(DEFAULT_COLLECTION).limit(50).get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ docs, count: docs.length });
  } catch (error) {
    console.error('Error fetching docs:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// API endpoint for media upload
app.post('/upload-media', upload.single('media'), async (req, res) => {
  try {
    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).send('No file uploaded.');
    }

    const file = req.file;
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const fileRef = bucket.file(fileName);

    // Upload the file to Firebase Storage
    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-09-2030', // Set an expiration date for the URL
    });

    // Create a document in Firestore with the media information
    const docRef = await db.collection('media').add({
      fileName: file.originalname,
      storageUrl: url,
      mimeType: file.mimetype,
      size: file.size,
      uploadDate: new Date(),
    });

    res.status(200).json({
      message: 'Media uploaded successfully!',
      downloadUrl: url,
      docId: docRef.id
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    if (error.response && error.response.status === 404 && error.response.data.error.message === 'The specified bucket does not exist.') {
      return res.status(404).json({
        message: 'Firebase Storage bucket not found. Please navigate to the "Storage" section in your Firebase console to initialize it.',
        error: error.response.data.error
      });
    }
    res.status(500).send('Error uploading media.');
  }
});

// API endpoint for form submission
app.post('/submit-form', async (req, res) => {
  try {
    const formData = req.body;

    // Check if form data is provided
    if (!formData || Object.keys(formData).length === 0) {
      return res.status(400).send('No form data provided.');
    }

    // Add form data to a new document in the 'submissions' collection
    const docRef = await db.collection('submissions').add({
      ...formData,
      submissionDate: new Date(),
    });

    res.status(201).json({
      message: 'Form submitted successfully!',
      docId: docRef.id
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).send('Error submitting form.');
  }
});

// CRUD Operations

// CREATE: Endpoint to create a new item
app.post('/items', async (req, res) => {
  try {
    const newItem = req.body;
    if (!newItem || Object.keys(newItem).length === 0) {
      return res.status(400).send('No data provided to create an item.');
    }
    const docRef = await db.collection('items').add(newItem);
    res.status(201).json({ message: 'Item created successfully!', docId: docRef.id });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).send('Error creating item.');
  }
});

// READ: Endpoint to get all items
app.get('/items', async (req, res) => {
  try {
    const snapshot = await db.collection('items').get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(items);
  } catch (error) {
    console.error('Error reading items:', error);
    res.status(500).send('Error reading items.');
  }
});

// READ: Endpoint to get a single item by ID
app.get('/items/:id', async (req, res) => {
  try {
    const docRef = db.collection('items').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send('Item not found.');
    }
    res.status(200).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error reading item:', error);
    res.status(500).send('Error reading item.');
  }
});

// UPDATE: Endpoint to update an item by ID
app.put('/items/:id', async (req, res) => {
  try {
    const updatedItem = req.body;
    if (!updatedItem || Object.keys(updatedItem).length === 0) {
      return res.status(400).send('No data provided to update an item.');
    }
    const docRef = db.collection('items').doc(req.params.id);
    await docRef.update(updatedItem);
    res.status(200).json({ message: 'Item updated successfully!' });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).send('Error updating item.');
  }
});

// DELETE: Endpoint to delete an item by ID
app.delete('/items/:id', async (req, res) => {
  try {
    const docRef = db.collection('items').doc(req.params.id);
    await docRef.delete();
    res.status(200).json({ message: 'Item deleted successfully!' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).send('Error deleting item.');
  }
});

// Uncomment and use the modular routes
app.use('/api/wishes', require('./routes/wishes'));
app.use('/api/media', require('./routes/media'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/events', require('./routes/events'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sections', require('./routes/sections'));
app.use('/api/guests', require('./routes/guests'));
app.use('/api/settings', require('./routes/settings'));

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});


// Start the server with better error handling
app.listen(port, (error) => {
  if (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
  console.log(`✅ Server is running on http://localhost:${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
