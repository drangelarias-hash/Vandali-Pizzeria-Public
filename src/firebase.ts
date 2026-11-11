import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  Firestore,
  Unsubscribe,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { OrderRecord, AdminConfig, PizzaItem, MenuItem, UserProfile } from './types';

// ==========================================================
// ERROR HANDLING & LOGGING TYPES
// ==========================================================

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  timestamp: number;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    timestamp: Date.now(),
  };
  console.error('🔥 Firestore Error:', JSON.stringify(errInfo));
}

// Deep clean helper: strips undefined values and functions to guarantee 100% Firestore payload compatibility
export function cleanForFirestore<T>(data: T): T {
  if (data === undefined || data === null) return data;
  return JSON.parse(JSON.stringify(data));
}

// ==========================================================
// FIREBASE INITIALIZATION
// ==========================================================

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
} else {
  app = getApp();
}

// Initialize Firestore with configured databaseId
export const db: Firestore =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

console.log('🔥 Firebase Firestore initialized with project:', firebaseConfig.projectId, 'database:', firebaseConfig.firestoreDatabaseId);

// Test Firestore connection on initialization
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system_settings', 'ping'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline warning:', error.message);
    }
    return false;
  }
}
testFirestoreConnection().catch(() => {});

// ==========================================================
// FIRESTORE ORDER STORAGE & REAL-TIME REPOSITORY
// ==========================================================

const ORDERS_COLLECTION = 'orders';
const SETTINGS_COLLECTION = 'system_settings';

/**
 * Real-time listener for all orders ordered by timestamp descending.
 * This guarantees orders are synchronized in real time across ALL devices:
 * - Admin POS comandas
 * - Client web delivery orders
 * - Kitchen display & thermal receipts
 */
export function subscribeToFirestoreOrders(
  onUpdate: (orders: OrderRecord[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  try {
    const ordersRef = collection(db, ORDERS_COLLECTION);
    const q = query(ordersRef, orderBy('timestamp', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const orders: OrderRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as OrderRecord;
          orders.push({
            ...data,
            id: docSnap.id,
          });
        });
        onUpdate(orders);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, ORDERS_COLLECTION);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, ORDERS_COLLECTION);
    return () => {};
  }
}

/**
 * Save or insert an order directly into cloud Firestore.
 */
export async function saveOrderToFirestore(order: OrderRecord): Promise<boolean> {
  if (!order || !order.id) return false;
  const cleanId = String(order.id).trim();
  const path = `${ORDERS_COLLECTION}/${cleanId}`;

  try {
    const orderDocRef = doc(db, ORDERS_COLLECTION, cleanId);

    // Deep sanitize to prevent any undefined field error from blocking the write
    const sanitizedOrder = cleanForFirestore({
      id: cleanId,
      date: order.date || new Date().toLocaleString('es-VE'),
      customerName: order.customerName || 'Cliente',
      customerPhone: order.customerPhone || '',
      customerEmail: order.customerEmail || '',
      deliveryType: order.deliveryType || 'pickup',
      tableNumber: order.tableNumber || '',
      address: order.address || order.zone || '',
      paymentMethod: order.paymentMethod || 'pagomovil',
      paymentRef: order.paymentRef || '',
      itemsSummary: order.itemsSummary || '',
      rawItems: Array.isArray(order.rawItems) ? order.rawItems : [],
      subtotalUSD: Number(order.subtotalUSD) || Number(order.totalUSD) || 0,
      discountUSD: Number(order.discountUSD) || 0,
      employeeDiscountUSD: Number(order.employeeDiscountUSD) || 0,
      employeeDiscountPercent: Number(order.employeeDiscountPercent) || 0,
      deliveryCostUSD: Number(order.deliveryCostUSD) || 0,
      tipUSD: Number(order.tipUSD) || 0,
      totalUSD: Number(order.totalUSD) || 0,
      totalBs: Number(order.totalBs) || 0,
      status: order.status || 'recibido',
      origin: order.origin || 'web_online',
      timestamp: Number(order.timestamp) || Date.now(),
      updatedAt: Date.now(),
    });

    await setDoc(orderDocRef, sanitizedOrder, { merge: true });
    console.log('✅ Order saved to Firestore:', cleanId);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Update an existing order in Firestore (e.g. status, items edit, employee discount)
 */
export async function updateOrderInFirestore(
  orderId: string,
  updates: Partial<OrderRecord>
): Promise<boolean> {
  if (!orderId) return false;
  const cleanId = String(orderId).trim();
  const path = `${ORDERS_COLLECTION}/${cleanId}`;

  try {
    const orderDocRef = doc(db, ORDERS_COLLECTION, cleanId);
    const sanitizedUpdates = cleanForFirestore({
      ...updates,
      updatedAt: Date.now(),
    });
    await setDoc(orderDocRef, sanitizedUpdates, { merge: true });
    console.log('✅ Order updated in Firestore:', cleanId, updates);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
    return false;
  }
}

/**
 * Delete an order from Firestore
 */
export async function deleteOrderFromFirestore(orderId: string): Promise<boolean> {
  if (!orderId) return false;
  const cleanId = String(orderId).trim();
  const path = `${ORDERS_COLLECTION}/${cleanId}`;

  try {
    const orderDocRef = doc(db, ORDERS_COLLECTION, cleanId);
    await deleteDoc(orderDocRef);
    console.log('🗑️ Order deleted from Firestore:', cleanId);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
    return false;
  }
}

/**
 * Fetch all historical orders from Firestore once
 */
export async function fetchAllOrdersFromFirestore(): Promise<OrderRecord[]> {
  try {
    const ordersRef = collection(db, ORDERS_COLLECTION);
    const q = query(ordersRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const orders: OrderRecord[] = [];
    snapshot.forEach((docSnap) => {
      orders.push({
        ...(docSnap.data() as OrderRecord),
        id: docSnap.id,
      });
    });
    return orders;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, ORDERS_COLLECTION);
    return [];
  }
}

// ==========================================================
// FIRESTORE CONFIG & MENU CATALOG SYNC
// ==========================================================

export function subscribeToFirestoreConfig(
  onUpdate: (config: AdminConfig) => void
): Unsubscribe {
  const path = `${SETTINGS_COLLECTION}/config`;
  try {
    const configDocRef = doc(db, SETTINGS_COLLECTION, 'config');
    return onSnapshot(
      configDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate(docSnap.data() as AdminConfig);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}

export async function saveConfigToFirestore(config: AdminConfig, forceAdminOverride = false): Promise<boolean> {
  const path = `${SETTINGS_COLLECTION}/config`;
  try {
    const configDocRef = doc(db, SETTINGS_COLLECTION, 'config');

    // Protect manual mode: If existing document in Firestore is in manual mode,
    // do NOT let automatic processes or background clients downgrade it to auto
    if (!forceAdminOverride && !config.forceAdminOverride && config.exchangeRateMode !== 'manual') {
      try {
        const snap = await getDoc(configDocRef);
        if (snap.exists()) {
          const existing = snap.data();
          if (existing?.exchangeRateMode === 'manual') {
            console.log('🛡️ Firestore config is locked in manual mode. Rejecting automatic mode overwrite.');
            // Preserve the manual exchange rate and mode
            config = {
              ...config,
              exchangeRateMode: 'manual',
              exchangeRateBs: existing.exchangeRateBs || config.exchangeRateBs,
              rateSource: 'manual',
              lastRateUpdate: existing.lastRateUpdate || 'Fijada manualmente por el administrador',
            };
          }
        }
      } catch (checkErr) {
        console.warn('Could not verify existing config manual lock:', checkErr);
      }
    }

    const sanitized = cleanForFirestore({
      ...config,
      updatedAt: Date.now(),
    });
    await setDoc(configDocRef, sanitized, { merge: true });
    console.log('✅ Config saved to Firestore (mode:', config.exchangeRateMode, ')');
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

export function subscribeToFirestoreMenu(
  onUpdate: (menu: {
    pizzas?: PizzaItem[];
    drinks?: MenuItem[];
    salsas?: MenuItem[];
    extras?: MenuItem[];
  }) => void
): Unsubscribe {
  const path = `${SETTINGS_COLLECTION}/menu`;
  try {
    const menuDocRef = doc(db, SETTINGS_COLLECTION, 'menu');
    return onSnapshot(
      menuDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate(docSnap.data() as any);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}

export async function saveMenuToFirestore(menu: {
  pizzas?: PizzaItem[];
  drinks?: MenuItem[];
  salsas?: MenuItem[];
  extras?: MenuItem[];
}): Promise<boolean> {
  const path = `${SETTINGS_COLLECTION}/menu`;
  try {
    const menuDocRef = doc(db, SETTINGS_COLLECTION, 'menu');
    const sanitized = cleanForFirestore({
      ...menu,
      lastUpdated: Date.now(),
    });
    await setDoc(menuDocRef, sanitized, { merge: true });
    console.log('✅ Menu saved to Firestore');
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Ensures initial Firestore data exists so all new devices and clients
 * automatically receive the catalog and configuration upon opening.
 */
export async function seedInitialFirestoreData(defaults: {
  config: AdminConfig;
  pizzas: PizzaItem[];
  drinks: MenuItem[];
  salsas: MenuItem[];
  extras: MenuItem[];
}) {
  try {
    const menuDocRef = doc(db, SETTINGS_COLLECTION, 'menu');
    const menuSnap = await getDoc(menuDocRef);
    if (!menuSnap.exists() || !menuSnap.data()?.pizzas || menuSnap.data()?.pizzas.length === 0) {
      await setDoc(
        menuDocRef,
        cleanForFirestore({
          pizzas: defaults.pizzas,
          drinks: defaults.drinks,
          salsas: defaults.salsas,
          extras: defaults.extras,
          lastUpdated: Date.now(),
        }),
        { merge: true }
      );
      console.log('🌱 Initial menu seeded to Firestore');
    }

    const configDocRef = doc(db, SETTINGS_COLLECTION, 'config');
    const configSnap = await getDoc(configDocRef);
    if (!configSnap.exists()) {
      await setDoc(
        configDocRef,
        cleanForFirestore({
          ...defaults.config,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
      console.log('🌱 Initial config seeded to Firestore');
    }
  } catch (err) {
    console.warn('Initial Firestore seed check error:', err);
  }
}

// ==========================================================
// FIRESTORE CUSTOMER ACCOUNTS (LOGIN & REGISTRATION)
// ==========================================================

const USERS_COLLECTION = 'users';

/**
 * Save or update a customer user profile in Firestore
 */
export async function saveUserProfileToFirestore(user: UserProfile): Promise<boolean> {
  if (!user || !user.email) return false;
  const cleanEmailKey = user.email.trim().toLowerCase().replace(/[^a-zA-Z0-9_.-]/g, '_');
  const path = `${USERS_COLLECTION}/${cleanEmailKey}`;

  try {
    const userDocRef = doc(db, USERS_COLLECTION, cleanEmailKey);
    const sanitized = cleanForFirestore({
      ...user,
      email: user.email.trim().toLowerCase(),
      updatedAt: Date.now(),
    });
    await setDoc(userDocRef, sanitized, { merge: true });
    console.log('✅ Customer account saved to Firestore:', cleanEmailKey);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Retrieve a customer user profile from Firestore by email
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  if (!email) return null;
  const cleanEmailKey = email.trim().toLowerCase().replace(/[^a-zA-Z0-9_.-]/g, '_');
  const path = `${USERS_COLLECTION}/${cleanEmailKey}`;

  try {
    const userDocRef = doc(db, USERS_COLLECTION, cleanEmailKey);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}


