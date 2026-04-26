const DB_NAME = 'treno_local_db';
const DB_VERSION = 1;
const STORE_APP_STATE = 'app_state';

const STORAGE_KEY_RECORDS = 'treno_records_v1';
const STORAGE_KEY_EDITBUFFERS = 'treno_editBuffers_v1';
const STORAGE_KEY_MIGRATED = 'treno_db_migrated_v1';

let dbPromise;

const openDb = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_APP_STATE)) {
        db.createObjectStore(STORE_APP_STATE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const withStore = async (mode, callback) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APP_STATE, mode);
    const store = tx.objectStore(STORE_APP_STATE);

    let request;
    try {
      request = callback(store);
    } catch (error) {
      reject(error);
      return;
    }

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getState = async (key, fallback) => {
  const result = await withStore('readonly', (store) => store.get(key));
  return result ?? fallback;
};

const setState = async (key, value) => {
  await withStore('readwrite', (store) => store.put(value, key));
};

const parseJsonSafely = (raw, fallback) => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const pickFirstNonEmptyRecords = (primary, secondary) => {
  if (primary && typeof primary === 'object' && Object.keys(primary).length > 0) {
    return primary;
  }
  if (
    secondary &&
    typeof secondary === 'object' &&
    Object.keys(secondary).length > 0
  ) {
    return secondary;
  }
  return {};
};

const normalizeObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

export const initializeLocalDb = async () => {
  await openDb();
};

export const migrateFromLocalStorageIfNeeded = async ({ migrateRecords }) => {
  const migrated = await getState(STORAGE_KEY_MIGRATED, false);
  if (migrated) return;

  const rawRecords = localStorage.getItem(STORAGE_KEY_RECORDS);
  const legacyRawRecords = localStorage.getItem('records');
  const rawEditBuffers =
    localStorage.getItem(STORAGE_KEY_EDITBUFFERS) ||
    localStorage.getItem('editBuffers');

  const recordsCandidate = pickFirstNonEmptyRecords(
    migrateRecords(parseJsonSafely(rawRecords, null)),
    migrateRecords(parseJsonSafely(legacyRawRecords, null))
  );
  const editBuffersCandidate = normalizeObject(parseJsonSafely(rawEditBuffers, {}));

  await setState(STORAGE_KEY_RECORDS, recordsCandidate);
  await setState(STORAGE_KEY_EDITBUFFERS, editBuffersCandidate);
  await setState(STORAGE_KEY_MIGRATED, true);
};

export const loadRecords = async () => getState(STORAGE_KEY_RECORDS, {});

export const saveRecords = async (records) => {
  await setState(STORAGE_KEY_RECORDS, records);
};

export const loadEditBuffers = async () => getState(STORAGE_KEY_EDITBUFFERS, {});

export const saveEditBuffers = async (editBuffers) => {
  await setState(STORAGE_KEY_EDITBUFFERS, editBuffers);
};
