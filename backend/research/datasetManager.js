const { scanAllDatasets } = require('./datasetScanner');

let datasetsCache = [];
let currentDatasetId = null;
let lastScanTime = null;

class DatasetManager {
    /**
     * Initializes the manager, scanning the datasets directory.
     */
    async init() {
        console.log("Initializing Dataset Manager...");
        datasetsCache = await scanAllDatasets();
        lastScanTime = Date.now();
        console.log(`Loaded ${datasetsCache.length} datasets.`);
        
        // Auto-select first dataset if none selected
        if (datasetsCache.length > 0 && !currentDatasetId) {
            currentDatasetId = datasetsCache[0].id;
        }
    }

    /**
     * Retrieves all scanned datasets metadata
     */
    async getDatasets() {
        // Optionally rescan if it's been a while, or just return cache.
        // For now, return cache. A manual rescan endpoint could be added if needed.
        return datasetsCache;
    }

    /**
     * Retrieves metadata for a specific dataset by ID
     */
    async getDatasetById(id) {
        return datasetsCache.find(d => d.id === id) || null;
    }

    /**
     * Selects a dataset to be the active one
     */
    async selectDataset(id) {
        const dataset = await this.getDatasetById(id);
        if (!dataset) {
            throw new Error(`Dataset with ID ${id} not found.`);
        }
        currentDatasetId = id;
        return dataset;
    }

    /**
     * Gets the currently selected dataset metadata
     */
    async getCurrentDataset() {
        if (!currentDatasetId) return null;
        return this.getDatasetById(currentDatasetId);
    }
    
    /**
     * Force a rescan of the datasets directory
     */
    async rescan() {
        datasetsCache = await scanAllDatasets();
        lastScanTime = Date.now();
        
        // Validate current dataset still exists
        if (currentDatasetId) {
            const exists = datasetsCache.find(d => d.id === currentDatasetId);
            if (!exists) {
                currentDatasetId = datasetsCache.length > 0 ? datasetsCache[0].id : null;
            }
        }
        
        return datasetsCache;
    }
}

module.exports = new DatasetManager();
