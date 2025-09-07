/**
 * Ensure a default collection exists.
 * Simply checks if the collection is accessible without adding dummy data.
 */
module.exports = async function ensureInit(db, collectionName = 'default') {
    if (!db) throw new Error('Firestore db instance required');
  
    console.log(`Checking collection '${collectionName}' accessibility...`);
    
    try {
      // Just test if we can access the collection
      await db.collection(collectionName).limit(1).get();
      console.log(`Collection '${collectionName}' is accessible and ready.`);
      return { accessible: true, message: 'collection_ready' };
    } catch (error) {
      console.error(`Error accessing collection '${collectionName}':`, error.message);
      throw error;
    }
};
