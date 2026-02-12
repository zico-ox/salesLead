// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, set, get } from 'firebase/database';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCBfouDHPL1U7f1FAywMk9gm2Ow7Ynaj2c",
  authDomain: "waste-3291b.firebaseapp.com",
  databaseURL: "https://waste-3291b-default-rtdb.firebaseio.com",
  projectId: "waste-3291b",
  storageBucket: "waste-3291b.firebasestorage.app",
  messagingSenderId: "683605244664",
  appId: "1:683605244664:web:60aea5998962e97e85590d",
  measurementId: "G-ERH4277NFR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
try {
  // Initialize analytics if available (may fail in non-browser envs)
  getAnalytics(app);
} catch (err) {
  console.warn('Analytics not initialized:', err);
}

// Initialize Realtime Database
export const database = getDatabase(app);

// Save full sales array to 'sales' node
export const saveSalesToFirebase = async (sales: any[]) => {
  try {
    const dbRef = ref(database, 'sales');
    await set(dbRef, sales);
    console.log('✅ Data saved to Firebase successfully');
    return true;
  } catch (error) {
    console.error('❌ Error saving to Firebase:', error);
    return false;
  }
};

// Load sales array from 'sales' node
export const loadSalesFromFirebase = async () => {
  try {
    const dbRef = ref(database, 'sales');
    const snapshot = await get(dbRef);
    if (snapshot.exists()) {
      console.log('✅ Data loaded from Firebase');
      return snapshot.val();
    } else {
      console.log('ℹ️ No data found in Firebase');
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading from Firebase:', error);
    return null;
  }
};

// Add a single sale (read-modify-write) to avoid overwriting when multiple clients write
export const addSaleToFirebase = async (sale: any) => {
  try {
    const dbRef = ref(database, 'sales');
    const snapshot = await get(dbRef);
    const val = snapshot.exists() ? snapshot.val() : null;
    const arr = val && Array.isArray(val) ? val : [];
    // prepend new sale
    const next = [sale, ...arr];
    console.debug('Firebase addSale: currentSnapshot=', val);
    console.debug('Firebase addSale: newEntry=', sale, 'nextLength=', next.length);
    await set(dbRef, next);
    console.log('✅ Sale added to Firebase', { addedId: sale.id, nextLength: next.length });
    return true;
  } catch (error) {
    console.error('❌ Error adding sale to Firebase:', error);
    // surface error details for client debugging
    return false;
  }
};

// Update a single sale by id
export const updateSaleInFirebase = async (id: number, updates: any) => {
  try {
    const dbRef = ref(database, 'sales');
    const snapshot = await get(dbRef);
    const val = snapshot.exists() ? snapshot.val() : null;
    const arr = val && Array.isArray(val) ? val : [];
    const next = arr.map((s: any) => s.id === id ? { ...s, ...updates } : s);
    console.debug('Firebase updateSale: currentSnapshot=', val);
    console.debug('Firebase updateSale: id=', id, 'updates=', updates);
    await set(dbRef, next);
    console.log('✅ Sale updated in Firebase', { id });
    return true;
  } catch (error) {
    console.error('❌ Error updating sale in Firebase:', error);
    return false;
  }
};

// Delete a sale by id
export const deleteSaleFromFirebase = async (id: number) => {
  try {
    const dbRef = ref(database, 'sales');
    const snapshot = await get(dbRef);
    const val = snapshot.exists() ? snapshot.val() : null;
    const arr = val && Array.isArray(val) ? val : [];
    const next = arr.filter((s: any) => s.id !== id);
    console.debug('Firebase deleteSale: currentSnapshot=', val);
    console.debug('Firebase deleteSale: deleting id=', id, 'remaining=', next.length);
    await set(dbRef, next);
    console.log('✅ Sale deleted from Firebase', { id });
    return true;
  } catch (error) {
    console.error('❌ Error deleting sale from Firebase:', error);
    return false;
  }
};

// --- Subjects ---

// Save subjects object to 'subjects' node
export const saveSubjectsToFirebase = async (subjects: Record<string, any>) => {
  try {
    const dbRef = ref(database, 'subjects');
    await set(dbRef, subjects);
    console.log('✅ Subjects saved to Firebase successfully');
    return true;
  } catch (error) {
    console.error('❌ Error saving subjects to Firebase:', error);
    return false;
  }
};

// Load subjects object from 'subjects' node
export const loadSubjectsFromFirebase = async () => {
  try {
    const dbRef = ref(database, 'subjects');
    const snapshot = await get(dbRef);
    if (snapshot.exists()) {
      console.log('✅ Subjects loaded from Firebase');
      return snapshot.val();
    } else {
      console.log('ℹ️ No subjects found in Firebase');
      return null;
    }
  } catch (error) {
    console.error('❌ Error loading subjects from Firebase:', error);
    return null;
  }
};
