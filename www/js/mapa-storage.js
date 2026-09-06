/**
 * IPI - Mapa Offline Storage (IndexedDB)
 * Armazena PMTiles fora do SQLite criptografado para evitar estouro do localStorage (5MB).
 * Fallback para SQLite (base64) para compatibilidade com dados antigos.
 */
var MAPA_DB_NAME = 'ipi_mapa_db';
var MAPA_STORE = 'pmtiles';
var MAPA_KEY = 'goias';

function _abrirMapaDB() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponível'));
        const req = indexedDB.open(MAPA_DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(MAPA_STORE)) db.createObjectStore(MAPA_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function salvarMapaIDB(buffer) {
    const db = await _abrirMapaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MAPA_STORE, 'readwrite');
        const store = tx.objectStore(MAPA_STORE);
        // Normaliza para Uint8Array
        const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const req = store.put({ dados: data, dataDownload: new Date().toISOString(), tamanho: data.byteLength }, MAPA_KEY);
        req.onsuccess = () => resolve({ tamanho: data.byteLength });
        req.onerror = () => reject(req.error);
    });
}

async function obterMapaIDB() {
    try {
        const db = await _abrirMapaDB();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(MAPA_STORE, 'readonly');
            const req = tx.objectStore(MAPA_STORE).get(MAPA_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    } catch { return null; }
}

async function temMapaIDB() {
    const r = await obterMapaIDB();
    return !!(r && r.dados && r.dados.byteLength > 0);
}

async function obterTamanhoMapaIDB() {
    const r = await obterMapaIDB();
    return r ? (r.tamanho || r.dados?.byteLength || 0) : 0;
}

async function deletarMapaIDB() {
    const db = await _abrirMapaDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(MAPA_STORE, 'readwrite');
        const req = tx.objectStore(MAPA_STORE).delete(MAPA_KEY);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

window.mapaStorage = {
    salvarMapaIDB,
    obterMapaIDB,
    temMapaIDB,
    obterTamanhoMapaIDB,
    deletarMapaIDB
};
