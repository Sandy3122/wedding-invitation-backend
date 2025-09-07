const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();

const getDb = () => admin.firestore();

// Get guest by deviceId
router.get('/:deviceId', async (req, res) => {
  try {
    const db = getDb();
    const deviceId = String(req.params.deviceId);
    if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId is required' });

    const doc = await db.collection('guests').doc(deviceId).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: 'Guest not found' });
    }

    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error('Get guest error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch guest', error: err.message });
  }
});

// Upsert guest by deviceId
router.put('/:deviceId', async (req, res) => {
  try {
    const db = getDb();
    const deviceId = String(req.params.deviceId);
    const { name, phoneNumber } = req.body || {};
    if (!deviceId) return res.status(400).json({ success: false, message: 'deviceId is required' });

    const now = new Date();
    const guestRef = db.collection('guests').doc(deviceId);
    const snap = await guestRef.get();
    const payload = {
      deviceId,
      name: (name || '').trim() || (snap.exists ? (snap.data().name || 'Guest') : 'Guest'),
      phoneNumber: (phoneNumber || '').trim() || (snap.exists ? (snap.data().phoneNumber || '') : ''),
      lastActive: now,
      updatedAt: now,
      ...(snap.exists ? {} : { createdAt: now, uploadCount: 0 })
    };

    await guestRef.set(payload, { merge: true });
    const updated = await guestRef.get();

    res.json({ success: true, data: { id: updated.id, ...updated.data() } });
  } catch (err) {
    console.error('Upsert guest error:', err);
    res.status(500).json({ success: false, message: 'Failed to upsert guest', error: err.message });
  }
});

module.exports = router; 