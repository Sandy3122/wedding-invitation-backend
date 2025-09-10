const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const admin = require('firebase-admin');
const path = require('path');

const router = express.Router();

// Helper functions to get Firebase instances
const getDb = () => admin.firestore();
const getBucket = () => admin.storage().bucket();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Upload media to Firebase Storage and save metadata to Firestore
router.post('/upload', upload.single('media'), async (req, res) => {
  try {
    const db = getDb();
    const bucket = getBucket();
    
    // Check if Firebase Storage is available
    if (!bucket) {
      return res.status(500).json({
        success: false,
        message: 'Firebase Storage is not configured. Please check your environment variables and Firebase setup.',
        error: 'Storage bucket not available'
      });
    }

    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const file = req.file;
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const fileRef = bucket.file(fileName);

    // Upload the file to Firebase Storage
    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          'Content-Disposition': `inline; filename="${fileName}"`,
        },
      },
    });

    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-09-2030', // Set an expiration date for the URL
    });

    // Gather uploader info from request body
    const uploaderName = req.body && req.body.uploaderName ? String(req.body.uploaderName).trim() : '';
    const uploaderPhone = req.body && req.body.uploaderPhone ? String(req.body.uploaderPhone).trim() : '';
    const deviceId = req.body && req.body.deviceId ? String(req.body.deviceId).trim() : '';
    const category = (req.body && req.body.category ? String(req.body.category) : 'uncategorized');

    // Upsert guest profile keyed by deviceId if provided
    if (deviceId) {
      const guestRef = db.collection('guests').doc(deviceId);
      const guestSnap = await guestRef.get();
      const now = new Date();
      if (!guestSnap.exists) {
        await guestRef.set({
          deviceId,
          name: uploaderName || 'Guest',
          phoneNumber: uploaderPhone || '',
          createdAt: now,
          lastActive: now,
          uploadCount: 1,
        });
      } else {
        const prev = guestSnap.data() || {};
        await guestRef.set({
          deviceId,
          name: uploaderName || prev.name || 'Guest',
          phoneNumber: uploaderPhone || prev.phoneNumber || '',
          lastActive: now,
          uploadCount: (prev.uploadCount || 0) + 1,
          updatedAt: now,
        }, { merge: true });
      }
    }

    // Create a document in Firestore with the media information
    const docData = {
      fileName: file.originalname,
      storageUrl: url,
      mimeType: file.mimetype,
      size: file.size,
      uploadDate: new Date(),
      isApproved: true,
      likes: 0,
      category,
    };
    if (uploaderName) docData.uploaderName = uploaderName;
    if (uploaderPhone) docData.uploaderPhone = uploaderPhone;
    if (deviceId) docData.deviceId = deviceId;

    const docRef = await db.collection('media').add(docData);

    res.status(200).json({
      success: true,
      message: 'Media uploaded successfully!',
      data: {
        downloadUrl: url,
        docId: docRef.id
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading media',
      error: error.message
    });
  }
});

// Get all media
// router.get('/', async (req, res) => {
//   try {
//     const db = getDb();
//     const { limit = 50, offset = 0 } = req.query;
    
//     const snapshot = await db.collection('media')
//     .orderBy('uploadDate', 'desc')
//       .limit(parseInt(limit))
//       .offset(parseInt(offset))
//       .get();

//     const media = [];
//     snapshot.forEach(doc => {
//       media.push({
//         id: doc.id,
//         ...doc.data()
//       });
//     });

//     res.json({
//       success: true,
//       data: media,
//       count: media.length
//     });
//   } catch (error) {
//     console.error('Get media error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch media',
//       error: error.message
//     });
//   }
// });


router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { limit = 50, lastVisible } = req.query; // lastVisible = last document's uploadDate or ID

    let query = db.collection('media')
      .orderBy('likes', 'desc')
      .orderBy('uploadDate', 'desc')
      .limit(parseInt(limit));

    if (lastVisible) {
      const lastDoc = await db.collection('media').doc(lastVisible).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();

    const media = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({
      success: true,
      data: media,
      count: media.length,
      lastVisible: snapshot.docs.length
        ? snapshot.docs[snapshot.docs.length - 1].id
        : null
    });
  } catch (error) {
    console.error('Get media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media',
      error: error.message
    });
  }
});


// Get single media item
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const doc = await db.collection('media').doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
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
    console.error('Get media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media',
      error: error.message
    });
  }
});

// Update media
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const { fileName, description, isApproved, category } = req.body;

    const updateData = {
      updatedAt: new Date()
    };

    if (fileName) updateData.fileName = fileName;
    if (description !== undefined) updateData.description = description;
    if (isApproved !== undefined) updateData.isApproved = isApproved;
    if (category !== undefined) updateData.category = String(category);

    await db.collection('media').doc(req.params.id).update(updateData);

    const doc = await db.collection('media').doc(req.params.id).get();
    
    res.json({
      success: true,
      message: 'Media updated successfully',
      data: {
        id: doc.id,
        ...doc.data()
      }
    });
  } catch (error) {
    console.error('Update media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update media',
      error: error.message
    });
  }
});

// Delete media
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const bucket = getBucket();
    
    const doc = await db.collection('media').doc(req.params.id).get();
    
    if (!doc.exists) {
      console.log('Delete media: document not found, treating as already deleted', req.params.id)
      return res.status(200).json({
        success: true,
        message: 'Media already deleted (not found)'
      });
    }

    const mediaData = doc.data();
    
    // Delete from Firebase Storage if URL exists
    if (mediaData.storageUrl && bucket) {
      try {
        const fileName = mediaData.storageUrl.split('/').pop().split('?')[0];
        await bucket.file(fileName).delete();
      } catch (storageError) {
        console.log('Storage deletion error (continuing):', storageError.message);
      }
    }

    // Delete from Firestore
    await db.collection('media').doc(req.params.id).delete();

    res.json({
      success: true,
      message: 'Media deleted successfully'
    });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: error.message
    });
  }
});

// Like/Unlike media
router.post('/:id/like', async (req, res) => {
  try {
    const db = getDb();
    const { action } = req.body; // 'like' or 'unlike'
    const mediaId = req.params.id;
    
    const doc = await db.collection('media').doc(mediaId).get();
    
    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    const currentLikes = doc.data().likes || 0;
    const newLikes = action === 'like' ? currentLikes + 1 : Math.max(0, currentLikes - 1);

    await db.collection('media').doc(mediaId).update({
      likes: newLikes,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: `Media ${action}d successfully`,
      data: {
        likes: newLikes
      }
    });
  } catch (error) {
    console.error('Like media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like/unlike media',
      error: error.message
    });
  }
});

module.exports = router;
