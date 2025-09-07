const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

// Get all sections configuration
router.get('/', async (req, res) => {
  try {
    const sectionsRef = admin.firestore().collection('sections');
    const snapshot = await sectionsRef.get();
    
    if (snapshot.empty) {
      // Initialize with default sections if none exist
      const defaultSections = {
        hero: { id: 'hero', name: 'Hero Section', visible: true, order: 1 },
        countdown: { id: 'countdown', name: 'Countdown Timer', visible: true, order: 2 },
        wishes: { id: 'wishes', name: 'Wishbook', visible: true, order: 3 },
        wishesWall: { id: 'wishes-wall', name: 'Beautiful Wishes Wall', visible: true, order: 4 },
        wishesArtwork: { id: 'wishes-artwork', name: 'Wish Artwork Generation', visible: true, order: 5 },
        events: { id: 'events', name: 'Wedding Events', visible: true, order: 6 },
        eventsGallery: { id: 'events-gallery', name: 'Events Gallery', visible: true, order: 7 },
        capturedGallery: { id: 'captured-gallery', name: 'Captured Moments', visible: true, order: 8 },
        streaming: { id: 'streaming', name: 'Live Streaming', visible: true, order: 9 },
        invitation: { id: 'invitation', name: 'Digital Invitation', visible: true, order: 10 },
        footer: { id: 'footer', name: 'Footer', visible: true, order: 11 }
      };

      // Save default sections
      const batch = admin.firestore().batch();
      Object.values(defaultSections).forEach(section => {
        const sectionRef = sectionsRef.doc(section.id);
        batch.set(sectionRef, section);
      });
      await batch.commit();

      return res.json({
        success: true,
        data: Object.values(defaultSections)
      });
    }

    const sections = [];
    snapshot.forEach(doc => {
      sections.push({ id: doc.id, ...doc.data() });
    });

    // Sort by order
    sections.sort((a, b) => (a.order || 0) - (b.order || 0));

    res.json({
      success: true,
      data: sections
    });
  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sections',
      error: error.message
    });
  }
});

// Update section visibility
router.put('/:sectionId', async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { visible, order, name } = req.body;

    const sectionRef = admin.firestore().collection('sections').doc(sectionId);
    const updateData = {};

    if (typeof visible === 'boolean') {
      updateData.visible = visible;
    }
    if (typeof order === 'number') {
      updateData.order = order;
    }
    if (typeof name === 'string') {
      updateData.name = name;
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await sectionRef.update(updateData);

    res.json({
      success: true,
      message: 'Section updated successfully'
    });
  } catch (error) {
    console.error('Error updating section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update section',
      error: error.message
    });
  }
});

// Bulk update sections (for reordering)
router.put('/', async (req, res) => {
  try {
    const { sections } = req.body;

    if (!Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        message: 'Sections must be an array'
      });
    }

    const batch = admin.firestore().batch();
    const sectionsRef = admin.firestore().collection('sections');

    sections.forEach(section => {
      const sectionRef = sectionsRef.doc(section.id);
      batch.update(sectionRef, {
        visible: section.visible,
        order: section.order,
        name: section.name,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    res.json({
      success: true,
      message: 'Sections updated successfully'
    });
  } catch (error) {
    console.error('Error bulk updating sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sections',
      error: error.message
    });
  }
});

// Reset sections to default
router.post('/reset', async (req, res) => {
  try {
    const defaultSections = {
      hero: { id: 'hero', name: 'Hero Section', visible: true, order: 1 },
      countdown: { id: 'countdown', name: 'Countdown Timer', visible: true, order: 2 },
      wishes: { id: 'wishes', name: 'Wishbook', visible: true, order: 3 },
      wishesWall: { id: 'wishes-wall', name: 'Beautiful Wishes Wall', visible: true, order: 4 },
      wishesArtwork: { id: 'wishes-artwork', name: 'Wish Artwork Generation', visible: true, order: 5 },
      events: { id: 'events', name: 'Wedding Events', visible: true, order: 6 },
      eventsGallery: { id: 'events-gallery', name: 'Events Gallery', visible: true, order: 7 },
      capturedGallery: { id: 'captured-gallery', name: 'Captured Moments', visible: true, order: 8 },
      streaming: { id: 'streaming', name: 'Live Streaming', visible: true, order: 9 },
      invitation: { id: 'invitation', name: 'Digital Invitation', visible: true, order: 10 },
      footer: { id: 'footer', name: 'Footer', visible: true, order: 11 }
    };

    const batch = admin.firestore().batch();
    const sectionsRef = admin.firestore().collection('sections');

    // Clear existing sections
    const snapshot = await sectionsRef.get();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add default sections
    Object.values(defaultSections).forEach(section => {
      const sectionRef = sectionsRef.doc(section.id);
      batch.set(sectionRef, section);
    });

    await batch.commit();

    res.json({
      success: true,
      message: 'Sections reset to default',
      data: Object.values(defaultSections)
    });
  } catch (error) {
    console.error('Error resetting sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset sections',
      error: error.message
    });
  }
});

module.exports = router;
