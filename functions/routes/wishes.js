const express = require('express');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
// Helper functions to get Firestore and Storage instances
const getDb = () => admin.firestore();

const router = express.Router();

// Submit a new wish
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const { 
      name, 
      relation, 
      email, 
      wish, 
      tone, 
      artworkStyle, 
      artworkPrompt, 
      language 
    } = req.body;

    // Validate required fields
    if (!name || !wish) {
      return res.status(400).json({
        success: false,
        message: 'Name and wish are required'
      });
    }

    // Create wish data
    const wishData = {
      id: uuidv4(),
      name: name.trim(),
      relation: relation?.trim() || '',
      email: email?.trim() || '',
      originalWish: wish.trim(),
      enhancedWish: wish.trim(), // Will be enhanced by AI later
      tone: tone || 'heartfelt',
      artworkStyle: artworkStyle || 'cartoon',
      artworkPrompt: artworkPrompt?.trim() || '',
      language: language || 'en-IN',
      likes: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isApproved: true // Auto-approve for now
    };

    // Save to Firestore
    await db.collection('wishes').doc(wishData.id).set(wishData);

    res.status(201).json({
      success: true,
      message: 'Wish submitted successfully',
      data: wishData
    });

  } catch (error) {
    console.error('Submit wish error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit wish',
      error: error.message
    });
  }
});

// Get all wishes
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { limit = 50, offset = 0, approved = true } = req.query;
    
    let query = db.collection('wishes');
    
    if (approved === 'true') {
      query = query.where('isApproved', '==', true);
    }
    
    const snapshot = await query
      .where('isApproved', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    const wishes = [];
    snapshot.forEach(doc => {
      wishes.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      data: wishes,
      count: wishes.length
    });
  } catch (error) {
    console.error('Get wishes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wishes',
      error: error.message
    });
  }
});

// Get single wish
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection('wishes').doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Wish not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data()
      }
    });
  } catch (error) {
    console.error('Get wish error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wish',
      error: error.message
    });
  }
});

// Update wish
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const { 
      name, 
      relation, 
      email, 
      wish, 
      tone, 
      artworkStyle, 
      artworkPrompt, 
      language,
      isApproved 
    } = req.body;

    const updateData = {
      updatedAt: new Date()
    };

    if (name) updateData.name = name.trim();
    if (relation !== undefined) updateData.relation = relation.trim();
    if (email !== undefined) updateData.email = email.trim();
    if (wish) updateData.originalWish = wish.trim();
    if (tone) updateData.tone = tone;
    if (artworkStyle) updateData.artworkStyle = artworkStyle;
    if (artworkPrompt !== undefined) updateData.artworkPrompt = artworkPrompt.trim();
    if (language) updateData.language = language;
    if (isApproved !== undefined) updateData.isApproved = isApproved;

    await db.collection('wishes').doc(req.params.id).update(updateData);

    const doc = await db.collection('wishes').doc(req.params.id).get();
    
    res.json({
      success: true,
      message: 'Wish updated successfully',
      data: {
        id: doc.id,
        ...doc.data()
      }
    });
  } catch (error) {
    console.error('Update wish error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update wish',
      error: error.message
    });
  }
});

// Delete wish
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection('wishes').doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Wish not found'
      });
    }

    await db.collection('wishes').doc(req.params.id).delete();

    res.json({
      success: true,
      message: 'Wish deleted successfully'
    });
  } catch (error) {
    console.error('Delete wish error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete wish',
      error: error.message
    });
  }
});

// Like/Unlike wish
router.post('/:id/like', async (req, res) => {
  try {
    const db = getDb();
    const { action } = req.body; // 'like' or 'unlike'
    const wishId = req.params.id;
    
    const doc = await db.collection('wishes').doc(wishId).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Wish not found'
      });
    }

    const currentLikes = doc.data().likes || 0;
    const newLikes = action === 'like' ? currentLikes + 1 : Math.max(0, currentLikes - 1);

    await db.collection('wishes').doc(wishId).update({
      likes: newLikes,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: `Wish ${action}d successfully`,
      data: {
        likes: newLikes
      }
    });
  } catch (error) {
    console.error('Like wish error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like/unlike wish',
      error: error.message
    });
  }
});

// Get wishes statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const db = getDb();
    const totalWishes = await db.collection('wishes').get();
    const approvedWishes = await db.collection('wishes').where('isApproved', '==', true).get();
    
    // Sum likes from wishes
    const wishesLikes = totalWishes.docs.reduce((sum, doc) => {
      return sum + (doc.data().likes || 0);
    }, 0);

    // Sum likes from media
    const mediaSnapshot = await db.collection('media').get();
    const mediaLikes = mediaSnapshot.docs.reduce((sum, doc) => {
      const data = doc.data();
      return sum + (data && typeof data.likes === 'number' ? data.likes : 0);
    }, 0);

    const totalLikes = wishesLikes + mediaLikes;

    const toneStats = {};
    const languageStats = {};
    
    totalWishes.docs.forEach(doc => {
      const data = doc.data();
      toneStats[data.tone] = (toneStats[data.tone] || 0) + 1;
      languageStats[data.language] = (languageStats[data.language] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalWishes: totalWishes.size,
        approvedWishes: approvedWishes.size,
        totalLikes,
        toneStats,
        languageStats
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

module.exports = router;
