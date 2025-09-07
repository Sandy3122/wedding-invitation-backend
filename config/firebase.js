// // const admin = require('firebase-admin');
// // const path = require('path');
// // require('dotenv').config();

// // let db, storage, bucket, firebaseConnected = false;

// // try {
// //   const serviceAccount = require('../serviceAccountKey.json'); // Correct path
  
// //   if (!admin.apps.length) {
// //     admin.initializeApp({
// //       credential: admin.credential.cert(serviceAccount),
// //       projectId: process.env.PROJECT_ID,
// //       storageBucket: process.env.STORAGE_BUCKET, // Ensure this is set
// //       databaseURL: process.env.FIREBASE_DATABASE_URL,
// //     });
// //   }

// //   db = admin.firestore();
// //   db.settings({ 
// //     databaseId: process.env.FIREBASE_DATABASE_ID || 'database',
// //   });
  
// //   try {
// //     storage = admin.storage();
// //     bucket = storage.bucket(process.env.STORAGE_BUCKET);
// //     console.log('🗄️ Storage Bucket:', process.env.STORAGE_BUCKET);
// //   } catch (storageError) {
// //     console.warn('⚠️ Firebase Storage not available:', storageError.message);
// //     storage = null;
// //     bucket = null;
// //   }

// //   firebaseConnected = true;
// //   console.log('🔥 Firebase initialized successfully');
// //   console.log('📊 Project ID:', process.env.PROJECT_ID);

// // } catch (error) {
// //   console.error('❌ Firebase initialization failed:', error.message);
// //   firebaseConnected = false;
// // }

// // module.exports = {
// //   admin,
// //   db,
// //   storage,
// //   bucket,
// //   firebaseConnected
// // };





// const admin = require('firebase-admin');
// const path = require('path');
// require('dotenv').config();


// let db, storage, bucket, firebaseConnected = false;

// try {
//   // Load service account key
//   const serviceAccount = require('./serviceAccountKey.json'); // Make sure this file exists!
//   console.log("serviceAccount: ", serviceAccount);

//   // if (!admin.apps.length) {
//   //   admin.initializeApp({
//   //     credential: admin.credential.cert(serviceAccount),
//   //     projectId: process.env.PROJECT_ID || 'safipraneeth-effbc',
//   //     storageBucket: process.env.STORAGE_BUCKET || 'safipraneeth-effbc.appspot.com',
//   //     databaseURL: "https://safipraneeth-effbc-default-rtdb.asia-southeast1.firebasedatabase.app"
//   //   });
//   // }


//   if (!admin.apps.length) {
//     admin.initializeApp({
//       credential: admin.credential.cert(serviceAccount),
//       projectId: process.env.PROJECT_ID,
//       storageBucket: process.env.STORAGE_BUCKET,
//     });
//   }

//   // Initialize Firestore
//   db = admin.firestore();
//   db.settings({
//     databaseId: process.env.FIREBASE_DATABASE_ID || 'database',
//   });

// // Initialize Storage
// try {
//   storage = admin.storage();
//   bucket = storage.bucket(process.env.STORAGE_BUCKET || `${process.env.PROJECT_ID}.appspot.com`);

//   if (!bucket.name) {
//     throw new Error('Bucket name not resolved');
//   }

//   console.log('🗄️ Firebase Storage Bucket Connected:', bucket.name);
// } catch (storageError) {
//   console.error('⚠️ Firebase Storage initialization failed:', storageError.message);
//   bucket = null;
// }

//   console.log('🔥 Firebase initialized successfully');
//   console.log('📊 Project ID:', process.env.PROJECT_ID || 'safipraneeth-effbc');
//   console.log('🗄️ Storage Bucket:', bucket.name);
//   console.log('🗃️ Firestore Database ID:', process.env.FIREBASE_DATABASE_ID || 'database');

//   firebaseConnected = true;
// } catch (error) {
//   console.error('❌ Firebase initialization failed:', error.message);
//   firebaseConnected = false;
// }

// module.exports = {
//   admin,
//   db,
//   storage,
//   bucket,
//   firebaseConnected
// };







const admin = require('firebase-admin');
require('dotenv').config();

let db, bucket, firebaseConnected = false;

// let serviceAccount;
// try {
//   serviceAccount = require('./serviceAccountKey.json');
// } catch (err) {
//   if (process.env.SERVICE_ACCOUNT) {
//     serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);
//   } else {
//     throw new Error("Service account key not found.");
//   }
// }

const serviceAccount = require('../serviceAccountKey.json');

try {

  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.PROJECT_ID,
      storageBucket: process.env.STORAGE_BUCKET,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }

  db = admin.firestore();
  db.settings({ databaseId: process.env.FIREBASE_DATABASE_ID || 'database' });

  const storage = admin.storage();
  bucket = storage.bucket(); // use default set during initializeApp

  if (!bucket) {
    throw new Error('Storage bucket is null');
  }

  console.log('🔥 Firebase initialized successfully');
  console.log('🗄️ Storage Bucket:', bucket.name);

  firebaseConnected = true;
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  firebaseConnected = false;
  bucket = null;
}

module.exports = { admin, db, bucket, firebaseConnected };