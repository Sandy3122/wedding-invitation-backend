const express = require('express');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
// Helper function to get Firestore instance
const getDb = () => admin.firestore();

const router = express.Router();

// Log event
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const { 
      eventType, 
      eventName, 
      timestamp, 
      userId, 
      sessionId, 
      page, 
      metadata 
    } = req.body;

    // Create event data
    const eventData = {
      id: uuidv4(),
      eventType: eventType || 'user_interaction',
      eventName: eventName || 'unknown',
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      userId: userId || null,
      sessionId: sessionId || uuidv4(),
      page: page || 'unknown',
      metadata: metadata || {},
      createdAt: new Date(),
    };

    // Save to Firestore
    await db.collection('events').doc(eventData.id).set(eventData);

    res.status(201).json({
      success: true,
      message: 'Event logged successfully',
      data: eventData
    });

  } catch (error) {
    console.error('Log event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log event',
      error: error.message
    });
  }
});

// Get events with optional filtering
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { eventType, page, userId, sessionId, limit = 100, offset = 0 } = req.query;
    
    let query = db.collection('events');
    
    if (eventType) {
      query = query.where('eventType', '==', eventType);
    }
    
    if (page) {
      query = query.where('page', '==', page);
    }
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    if (sessionId) {
      query = query.where('sessionId', '==', sessionId);
    }
    
    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    const events = [];
    snapshot.forEach(doc => {
      events.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: error.message
    });
  }
});

// Get event statistics
router.get('/stats', async (req, res) => {
  try {
    const db = getDb();
    const { startDate, endDate } = req.query;
    
    let query = db.collection('events');
    
    if (startDate) {
      query = query.where('createdAt', '>=', new Date(startDate));
    }
    
    if (endDate) {
      query = query.where('createdAt', '<=', new Date(endDate));
    }
    
    const snapshot = await query.get();
    
    const stats = {
      totalEvents: snapshot.size,
      eventTypes: {},
      pages: {},
      sessions: new Set(),
      users: new Set(),
    };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Count event types
      stats.eventTypes[data.eventType] = (stats.eventTypes[data.eventType] || 0) + 1;
      
      // Count pages
      stats.pages[data.page] = (stats.pages[data.page] || 0) + 1;
      
      // Count unique sessions
      if (data.sessionId) {
        stats.sessions.add(data.sessionId);
      }
      
      // Count unique users
      if (data.userId) {
        stats.users.add(data.userId);
      }
    });
    
    res.json({
      success: true,
      data: {
        ...stats,
        uniqueSessions: stats.sessions.size,
        uniqueUsers: stats.users.size,
      }
    });
  } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event statistics',
      error: error.message
    });
  }
});

module.exports = router;
