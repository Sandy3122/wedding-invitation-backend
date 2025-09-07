const express = require('express');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
// Helper function to get Firestore instance
const getDb = () => admin.firestore();

const router = express.Router();

// Submit email for reminders
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const { email, schedule } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Create reminder data
    const reminderData = {
      id: uuidv4(),
      email: email.trim(),
      schedule: schedule || 'T-1day,T-6hours',
      sentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to Firestore
    await db.collection('reminders').doc(reminderData.id).set(reminderData);

    res.status(201).json({
      success: true,
      message: 'Reminder email registered successfully',
      data: reminderData
    });

  } catch (error) {
    console.error('Submit reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register reminder',
      error: error.message
    });
  }
});

// Get all reminders
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('reminders')
      .orderBy('createdAt', 'desc')
      .get();

    const reminders = [];
    snapshot.forEach(doc => {
      reminders.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      data: reminders,
      count: reminders.length
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminders',
      error: error.message
    });
  }
});

// Delete reminder
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection('reminders').doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    await db.collection('reminders').doc(req.params.id).delete();

    res.json({
      success: true,
      message: 'Reminder deleted successfully'
    });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reminder',
      error: error.message
    });
  }
});

module.exports = router;
