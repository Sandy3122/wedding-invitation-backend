const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Get all settings
router.get('/', async (req, res) => {
  try {
    const settingsRef = admin.firestore().collection('settings');
    const snapshot = await settingsRef.get();
    
    if (snapshot.empty) {
      // Initialize with default settings if none exist
      const defaultSettings = {
        liveStreamUrl: 'https://youtube.com/watch?v=example2',
        weddingDate: 'October 11, 2025',
        weddingTime: '7 PM IST',
        coupleNames: 'Safalya & Praneet',
        isLiveStreamActive: false,
        streamTitle: 'Wedding Ceremony Live',
        streamDescription: 'Witness the sacred moment as Safalya & Praneet exchange vows in this beautiful ceremony. Join us virtually for this once-in-a-lifetime celebration of love.'
      };

      // Save default settings
      await settingsRef.doc('wedding').set(defaultSettings);

      return res.json({
        success: true,
        data: defaultSettings
      });
    }

    const settings = {};
    snapshot.forEach(doc => {
      settings[doc.id] = doc.data();
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
});

// Get specific setting category
router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const settingsRef = admin.firestore().collection('settings').doc(category);
    const doc = await settingsRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Settings category not found'
      });
    }

    res.json({
      success: true,
      data: doc.data()
    });
  } catch (error) {
    console.error('Error fetching setting category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch setting category',
      error: error.message
    });
  }
});

// Update settings
router.put('/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const updateData = req.body;

    // Add timestamp
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    const settingsRef = admin.firestore().collection('settings').doc(category);
    await settingsRef.set(updateData, { merge: true });

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
});

// Update specific setting field
router.patch('/:category/:field', async (req, res) => {
  try {
    const { category, field } = req.params;
    const { value } = req.body;

    const settingsRef = admin.firestore().collection('settings').doc(category);
    await settingsRef.update({
      [field]: value,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Setting updated successfully'
    });
  } catch (error) {
    console.error('Error updating setting field:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update setting field',
      error: error.message
    });
  }
});

module.exports = router;
