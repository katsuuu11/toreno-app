const DB_NAME = 'treno_local_db';
const DB_VERSION = 2;
const STORE_APP_STATE = 'app_state';
const STORE_IMAGES = 'images';

const STORAGE_KEY_RECORDS = 'treno_records_v1';
const STORAGE_KEY_EDITBUFFERS = 'treno_editBuffers_v1';
const STORAGE_KEY_SUGGESTIONS = 'treno_suggestions_v1';
const BACKUP_STORAGE_KEYS = [
  STORAGE_KEY_RECORDS,
  STORAGE_KEY_EDITBUFFERS,
  STORAGE_KEY_SUGGESTIONS,
];
const STORAGE_KEY_MIGRATED = 'treno_db_migrated_v1';
const BACKUP_IMAGES_KEY = '__treno_images_v1';

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
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const withStore = async (storeName, mode, callback) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

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
  const result = await withStore(STORE_APP_STATE, 'readonly', (store) =>
    store.get(key)
  );
  return result ?? fallback;
};

const setState = async (key, value) => {
  await withStore(STORE_APP_STATE, 'readwrite', (store) => store.put(value, key));
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

const createImageId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `image_${Date.now()}_${Math.random().toString(36).slice(2)}`;
};

const dataUrlToBlob = async (dataUrl) => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const isDataUrlImage = (value) =>
  typeof value === 'string' && value.startsWith('data:image/');

export const initializeLocalDb = async () => {
  await openDb();
};

export const saveImageBlob = async (blob, imageId = createImageId()) => {
  await withStore(STORE_IMAGES, 'readwrite', (store) => store.put(blob, imageId));
  return imageId;
};

export const loadImageBlob = async (imageId) => {
  if (!imageId) return null;
  return withStore(STORE_IMAGES, 'readonly', (store) => store.get(imageId));
};

export const deleteImageBlob = async (imageId) => {
  if (!imageId) return;
  await withStore(STORE_IMAGES, 'readwrite', (store) => store.delete(imageId));
};

export const migrateRecordImagesToBlobs = async (records) => {
  let changed = false;
  const migrated = {};

  for (const [ymd, value] of Object.entries(normalizeObject(records))) {
    const dayRecords = Array.isArray(value?.records) ? value.records : [];
    migrated[ymd] = {
      records: await Promise.all(
        dayRecords.map(async (record) => {
          if (!record || typeof record !== 'object') return record;

          const nextRecord = { ...record };
          const legacyImages = Array.isArray(nextRecord.images)
            ? nextRecord.images
            : [];
          const legacyImage = legacyImages.find(isDataUrlImage);

          if (!nextRecord.imageId && legacyImage) {
            const blob = await dataUrlToBlob(legacyImage);
            nextRecord.imageId = await saveImageBlob(blob);
            changed = true;
          }

          if ('images' in nextRecord) {
            delete nextRecord.images;
            changed = true;
          }

          return nextRecord;
        })
      ),
    };
  }

  return { records: migrated, changed };
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
  const { records: migratedRecords } = await migrateRecordImagesToBlobs(
    recordsCandidate
  );

  await setState(STORAGE_KEY_RECORDS, migratedRecords);
  await setState(STORAGE_KEY_EDITBUFFERS, editBuffersCandidate);
  await setState(STORAGE_KEY_MIGRATED, true);
};

export const loadRecords = async () => getState(STORAGE_KEY_RECORDS, {});

const parseStorageValue = (raw) => {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const isNonEmptyBackupValue = (value) => {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.length > 0;
  return true;
};

const chooseBackupValue = (indexedDbValue, localStorageValue) => {
  if (isNonEmptyBackupValue(indexedDbValue)) return indexedDbValue;
  if (isNonEmptyBackupValue(localStorageValue)) return localStorageValue;
  return indexedDbValue ?? localStorageValue ?? null;
};

const collectImageIdsFromRecords = (records) => {
  const imageIds = new Set();

  Object.values(normalizeObject(records)).forEach((value) => {
    const dayRecords = Array.isArray(value) ? value : value?.records;
    if (!Array.isArray(dayRecords)) return;

    dayRecords.forEach((record) => {
      if (typeof record?.imageId === 'string' && record.imageId) {
        imageIds.add(record.imageId);
      }
    });
  });

  return [...imageIds];
};

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const loadBackupImages = async (records) => {
  const imageEntries = await Promise.all(
    collectImageIdsFromRecords(records).map(async (imageId) => {
      const blob = await loadImageBlob(imageId);
      if (!blob) return null;
      return [imageId, await blobToDataUrl(blob)];
    })
  );

  return Object.fromEntries(imageEntries.filter(Boolean));
};

const restoreBackupImages = async (backupImages) => {
  const images = normalizeObject(backupImages);
  await Promise.all(
    Object.entries(images).map(async ([imageId, dataUrl]) => {
      if (!isDataUrlImage(dataUrl)) return;
      await saveImageBlob(await dataUrlToBlob(dataUrl), imageId);
    })
  );
};

export const createBackupData = async () => {
  const entries = await Promise.all(
    BACKUP_STORAGE_KEYS.map(async (key) => {
      const indexedDbValue = await getState(key, undefined);
      const localStorageValue = parseStorageValue(localStorage.getItem(key));
      return [key, chooseBackupValue(indexedDbValue, localStorageValue)];
    })
  );
  const backupData = Object.fromEntries(entries);

  backupData[BACKUP_IMAGES_KEY] = await loadBackupImages(
    backupData[STORAGE_KEY_RECORDS]
  );

  return backupData;
};

export const restoreBackupData = async (backupData) => {
  if (!backupData || typeof backupData !== 'object' || Array.isArray(backupData)) {
    throw new Error('Invalid backup data');
  }
  if (!BACKUP_STORAGE_KEYS.some((key) => key in backupData)) {
    throw new Error('Invalid backup data');
  }
  if (
    backupData[STORAGE_KEY_RECORDS] !== undefined &&
    backupData[STORAGE_KEY_RECORDS] !== null &&
    typeof backupData[STORAGE_KEY_RECORDS] !== 'object'
  ) {
    throw new Error('Invalid records data');
  }
  if (
    backupData[STORAGE_KEY_EDITBUFFERS] !== undefined &&
    backupData[STORAGE_KEY_EDITBUFFERS] !== null &&
    typeof backupData[STORAGE_KEY_EDITBUFFERS] !== 'object'
  ) {
    throw new Error('Invalid edit buffer data');
  }

  const previousValues = Object.fromEntries(
    BACKUP_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)])
  );
  const previousIndexedDbValues = Object.fromEntries(
    await Promise.all(
      BACKUP_STORAGE_KEYS.map(async (key) => [key, await getState(key, null)])
    )
  );
  const nextValues = Object.fromEntries(
    BACKUP_STORAGE_KEYS.map((key) => [
      key,
      key in backupData ? backupData[key] ?? null : previousIndexedDbValues[key],
    ])
  );
  const serializedValues = Object.fromEntries(
    BACKUP_STORAGE_KEYS.map((key) => [key, JSON.stringify(nextValues[key])])
  );

  try {
    await restoreBackupImages(backupData[BACKUP_IMAGES_KEY]);
    await Promise.all(
      BACKUP_STORAGE_KEYS.map((key) => setState(key, nextValues[key]))
    );
    BACKUP_STORAGE_KEYS.forEach((key) => {
      localStorage.setItem(key, serializedValues[key]);
    });
  } catch (error) {
    await Promise.all(
      BACKUP_STORAGE_KEYS.map((key) => setState(key, previousIndexedDbValues[key]))
    );
    BACKUP_STORAGE_KEYS.forEach((key) => {
      if (previousValues[key] === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, previousValues[key]);
      }
    });
    throw error;
  }
};

export const saveRecords = async (records) => {
  await setState(STORAGE_KEY_RECORDS, records);
};

export const loadEditBuffers = async () => getState(STORAGE_KEY_EDITBUFFERS, {});

export const saveEditBuffers = async (editBuffers) => {
  await setState(STORAGE_KEY_EDITBUFFERS, editBuffers);
};
