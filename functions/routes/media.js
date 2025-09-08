const express = require('express');
const formidable = require('formidable-serverless');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Helper functions to get Firebase instances
const getDb = () => admin.firestore();
const getBucket = () => admin.storage().bucket();

// File upload helper function based on your working implementation
async function uploadFile(file, folder, fileName, fileType) {
    try {
        console.log('File object:', file);
        console.log('File path:', file.path);

        if (!file.path) {
            throw new Error("File path is undefined. Ensure the file is correctly parsed.");
        }

        const filePath = `${folder}/${fileName}`;

        // Upload the file to Firebase Storage with appropriate metadata
        const [uploadedFile] = await getBucket().upload(file.path, {
            destination: filePath,
            metadata: {
                contentType: file.type,
                metadata: {
                    // Set Content-Disposition to 'inline' to open in the browser
                    'Content-Disposition': `inline; filename="${fileName}"`,
                },
            },
        });

        // Generate a signed URL for accessing the file
        const [signedUrl] = await uploadedFile.getSignedUrl({
            action: 'read',
            expires: Date.now() + 20 * 365 * 24 * 60 * 60 * 1000, // 20 years expiration
        });

        console.log('File uploaded successfully:', signedUrl);
        return signedUrl;
    } catch (error) {
        console.error("Error uploading file:", error);
        throw new Error(`Error uploading file: ${error.message}`);
    }
}

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;

// Upload media to Firebase Storage and save metadata to Firestore
router.post('/upload', async (req, res) => {
    try {
        console.log('Starting media upload process...');
        
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

        // Use formidable-serverless like in your working implementation
        const form = new formidable.IncomingForm();
        form.maxFileSize = MAX_FILE_SIZE;
        form.multiples = false; // Single file upload

        form.parse(req, async (err, fields, files) => {
            if (err) {
                if (err.message.includes("maxFileSize")) {
                    return res.status(400).json({ 
                        success: false,
                        message: `File size limit exceeded (max ${MAX_FILE_SIZE_MB} MB)` 
                    });
                }
                console.error("Error parsing form:", err);
                return res.status(400).json({ 
                    success: false,
                    message: "Error parsing form data" 
                });
            }

            console.log('Form parsed successfully');
            console.log('Fields:', fields);
            console.log('Files:', files);

            // Check if a file was uploaded
            if (!files.media) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded with name "media"'
                });
            }

            const file = Array.isArray(files.media) ? files.media[0] : files.media;
            console.log('File details:', {
                name: file.name,
                type: file.type,
                size: file.size,
                path: file.path
            });

            try {
                // Generate unique filename
                const fileExtension = path.extname(file.name || '');
                const fileName = `${uuidv4()}${fileExtension}`;

                // Upload file using the working approach
                const signedUrl = await uploadFile(file, 'wedding-media', fileName, file.type);

                // Gather uploader info from form fields
                const uploaderName = fields.uploaderName ? String(fields.uploaderName).trim() : '';
                const uploaderPhone = fields.uploaderPhone ? String(fields.uploaderPhone).trim() : '';
                const deviceId = fields.deviceId ? String(fields.deviceId).trim() : '';
                const category = fields.category ? String(fields.category) : 'uncategorized';

                console.log('Saving to Firestore...');
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
                    fileName: file.name || 'unknown',
                    storageUrl: signedUrl,
                    mimeType: file.type || 'application/octet-stream',
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

                console.log('Upload completed successfully');
                res.status(200).json({
                    success: true,
                    message: 'Media uploaded successfully!',
                    data: {
                        downloadUrl: signedUrl,
                        docId: docRef.id
                    }
                });

                // Clean up temporary file
                try {
                    if (file.path && fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                        console.log('Temporary file cleaned up');
                    }
                } catch (cleanupError) {
                    console.log('Cleanup error (non-critical):', cleanupError.message);
                }

            } catch (uploadError) {
                console.error('Upload error:', uploadError);
                res.status(500).json({
                    success: false,
                    message: 'Error uploading media',
                    error: uploadError.message
                });
            }
        });

    } catch (error) {
        console.error('General error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing upload request',
            error: error.message
        });
    }
});

// Get all media
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { limit = 50, offset = 0 } = req.query;
    
    const snapshot = await db.collection('media')
      .orderBy('uploadDate', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .get();

    const media = [];
    snapshot.forEach(doc => {
      media.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({
      success: true,
      data: media,
      count: media.length
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