const express = require('express');
const formidable = require('formidable-serverless');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
function normalizeCategory(value) {
  return (value || 'uncategorized')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

const router = express.Router();

// Helper functions to get Firebase instances
const getDb = () => admin.firestore();
const getBucket = () => admin.storage().bucket();

// Helper function to determine folder structure based on upload source and category
function getStorageFolder(deviceId, category) {
  // If deviceId is 'admin_portal', it's from admin panel - use category-based folder
  if (deviceId === 'admin_portal') {
    return `admin-uploads/${category.toLowerCase()}`;
  }
  
  // If category is 'captureYourMoments', it's from capture moments page
  if (category === 'captureYourMoments') {
    return 'capturedMoments';
  }
  
  // Default folder for other uploads
  return 'general-uploads';
}

// Robust video processing function with fallback mechanisms
async function processVideoWithFallbacks(inputPath, outputPath) {
    const strategies = [
        // Strategy 1: Basic conversion with flexible scaling
        {
            name: "basic",
            options: [
                "-vf", "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease:flags=lanczos",
                "-c:v", "libx264",
                "-preset", "medium", 
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                "-pix_fmt", "yuv420p"
            ]
        },
        // Strategy 2: Minimal processing (fallback)
        {
            name: "minimal", 
            options: [
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "28",
                "-c:a", "copy",
                "-movflags", "+faststart"
            ]
        },
        // Strategy 3: Direct copy (last resort)
        {
            name: "copy",
            options: ["-c", "copy"]
        }
    ];

    for (const strategy of strategies) {
        try {
            console.log('Attempting video processing with strategy: ' + strategy.name);
            
            await new Promise((resolve, reject) => {
                const command = ffmpeg(inputPath)
                    .outputOptions(strategy.options)
                    .save(outputPath)
                    .on("start", (commandLine) => {
                        console.log('FFmpeg command: ' + commandLine);
                    })
                    .on("progress", (progress) => {
                        if (progress.percent) {
                            console.log('Processing: ' + Math.round(progress.percent) + '% done');
                        }
                    })
                    .on("end", () => {
                        console.log('Video processing completed with strategy: ' + strategy.name);
                        resolve();
                    })
                    .on("error", (error) => {
                        console.error('Strategy ' + strategy.name + ' failed:', error.message);
                        reject(error);
                    });
            });
            
            // If we get here, the strategy worked
            return strategy.name;
            
        } catch (error) {
            console.warn('Strategy ' + strategy.name + ' failed, trying next strategy...');
            
            // Clean up failed output file
            try {
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
            } catch (cleanupError) {
                console.warn('Could not clean up failed output file:', cleanupError.message);
            }
            
            // If this was the last strategy, rethrow the error
            if (strategy === strategies[strategies.length - 1]) {
                throw error;
            }
        }
    }
}


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
                cacheControl: 'public, max-age=31536000, immutable',
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

const MAX_FILE_SIZE_MB = 100;
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

            // Variables for cleanup
            let compressedPath = null;
            let uploadPath = file.path;
            let finalFileName = null;

            try {
                // Generate unique filename
                const fileExtension = path.extname(file.name || '');
                const fileName = `${uuidv4()}${fileExtension}`;

                // Gather uploader info from form fields
                const uploaderName = fields.uploaderName ? String(fields.uploaderName).trim() : '';
                const uploaderPhone = fields.uploaderPhone ? String(fields.uploaderPhone).trim() : '';
                const deviceId = fields.deviceId ? String(fields.deviceId).trim() : '';
                const category = normalizeCategory(fields.category);
                
                // Determine the storage folder based on upload source and category
                const storageFolder = getStorageFolder(deviceId, category);

                // Compression logic based on file type
                console.log('Starting file compression check for type:', file.type);
                
                if (file.type && file.type.startsWith("image/")) {
                    console.log('Compressing image...');
                    compressedPath = path.join(path.dirname(file.path), `compressed-${fileName}`);
                    
                    await sharp(file.path)
                        .resize({ width: 1920, height: 1920, fit: "inside" })
                        .jpeg({ quality: 70 })
                        .toFile(compressedPath);
                    
                    uploadPath = compressedPath;
                    finalFileName = fileName.replace(fileExtension, '.jpg');
                    console.log('Image compression completed');
                    
                                } else if (file.type && file.type.startsWith("video/")) {
                    console.log('Compressing video...');
                    compressedPath = path.join(path.dirname(file.path), `compressed-${fileName.replace(fileExtension, '.mp4')}`);
                    
                    try {
                        // Use robust video processing with fallbacks
                        const strategy = await processVideoWithFallbacks(file.path, compressedPath);
                        console.log(`Video successfully processed using strategy: ${strategy}`);
                        
                        uploadPath = compressedPath;
                        finalFileName = fileName.replace(fileExtension, '.mp4');
                        console.log('Video compression completed');
                        
                    } catch (error) {
                        console.error('All video processing strategies failed:', error);
                        console.log('Uploading original video file without compression...');
                        
                        // Fallback: upload original file without compression
                        uploadPath = file.path;
                        finalFileName = fileName;
                    }
                }
                 else {
                    console.log('No compression needed for file type:', file.type);
                    uploadPath = file.path;
                    finalFileName = fileName;
                }

                // Upload file using the working approach
                const signedUrl = await uploadFile({ 
                    ...file, 
                    path: uploadPath 
                }, storageFolder, finalFileName, file.type);

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
                    storageFileName: finalFileName, // Store the actual storage filename (UUID-based)
                    storageUrl: signedUrl,
                    mimeType: file.type || 'application/octet-stream',
                    size: file.size,
                    uploadDate: new Date(),
                    isApproved: true,
                    likes: 0,
                    category,
                    storageFolder, // Add storage folder info for reference
                    compressed: compressedPath !== null, // Track if file was compressed
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
                        docId: docRef.id,
                        storageFolder,
                        compressed: compressedPath !== null
                    }
                });

            } catch (uploadError) {
                console.error('Upload error:', uploadError);
                res.status(500).json({
                    success: false,
                    message: 'Error uploading media',
                    error: uploadError.message
                });
            } finally {
                // Clean up temporary files
                try {
                    if (file.path && fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                        console.log('Original temporary file cleaned up');
                    }
                    if (compressedPath && fs.existsSync(compressedPath)) {
                        fs.unlinkSync(compressedPath);
                        console.log('Compressed temporary file cleaned up');
                    }
                } catch (cleanupError) {
                    console.log('Cleanup error (non-critical):', cleanupError.message);
                }
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
    if (category !== undefined) updateData.category = normalizeCategory(category);

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
        // First try to use the storageFolder and storageFileName fields (most reliable)
        if (mediaData.storageFolder && mediaData.storageFileName) {
          const fullPath = `${mediaData.storageFolder}/${mediaData.storageFileName}`;
          console.log('Attempting to delete file from path:', fullPath);
          await bucket.file(fullPath).delete();
          console.log('File deleted successfully from storage');
        } else {
          // For older records without storageFileName, extract from URL
          console.log('No storageFileName found, extracting from URL...');
          const url = new URL(mediaData.storageUrl);
          const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
          if (pathMatch) {
            const fullPath = decodeURIComponent(pathMatch[1]);
            console.log('Attempting to delete file from URL path:', fullPath);
            await bucket.file(fullPath).delete();
            console.log('File deleted successfully from storage');
          } else {
            // Last resort: try to extract filename from URL
            const fileName = mediaData.storageUrl.split('/').pop().split('?')[0];
            console.log('Attempting to delete file by filename only:', fileName);
            await bucket.file(fileName).delete();
            console.log('File deleted successfully from storage');
          }
        }
      } catch (storageError) {
        console.error('Storage deletion error:', storageError);
        
        // If it's a 404 error, the file might already be deleted or never existed
        if (storageError.code === 404) {
          console.log('File not found in storage (404) - might have been already deleted or never existed');
        } else {
          console.log('Other storage error occurred:', storageError.message);
        }
        
        // Don't fail the entire operation if storage deletion fails
        console.log('Continuing with Firestore deletion despite storage error');
      }
    } else {
      console.log('No storage URL found or bucket not available, skipping storage deletion');
    }

    // Delete from Firestore
    await db.collection('media').doc(req.params.id).delete();
    console.log('Document deleted from Firestore');

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
