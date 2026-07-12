const DatasetReplay = require('./datasetReplay');
const replayPublisher = require('./replayPublisher');
const datasetManager = require('../research/datasetManager');

class ReplayManager {
    constructor() {
        this.engine = null;
        this.config = {
            boxCount: 1,
            offlineMode: false
        };
        this.activeBoxes = [];
        this.speed = 1;
        this.progress = 0;
        this.estimatedCompletionTime = null;
        this.startTime = null;
    }

    async start(configOverrides = {}) {
        this.config = { ...this.config, ...configOverrides };
        
        const currentDataset = await datasetManager.getCurrentDataset();
        if (!currentDataset) {
            throw new Error("No dataset selected for replay.");
        }

        if (this.engine) {
            this.engine.stop();
        }

        this.activeBoxes = await replayPublisher.getActiveBoxes(this.config.boxCount);
        if (this.activeBoxes.length === 0) {
            console.warn("[ReplayManager] No active boxes found.");
        }

        this.engine = new DatasetReplay(currentDataset.id, this.speed);
        
        this.engine.on('record', (record) => {
            replayPublisher.publishRecord(record, this.activeBoxes, this.config.offlineMode);
            
            // Calculate progress
            if (currentDataset.totalRecords > 0) {
                this.progress = (this.engine.currentRecordCount / currentDataset.totalRecords) * 100;
                
                // Estimate completion time
                const elapsed = Date.now() - this.startTime;
                const rate = this.engine.currentRecordCount / elapsed;
                const remainingRecords = currentDataset.totalRecords - this.engine.currentRecordCount;
                if (rate > 0) {
                    this.estimatedCompletionTime = Date.now() + (remainingRecords / rate);
                }
            }
        });

        this.engine.on('finished', () => {
            console.log("[ReplayManager] Dataset replay finished.");
            this.progress = 100;
            this.estimatedCompletionTime = null;
        });

        this.engine.on('error', (err) => {
            console.error("[ReplayManager] Engine error:", err);
        });

        this.startTime = Date.now();
        this.progress = 0;
        await this.engine.start();
        return this.getStatus();
    }

    stop() {
        if (this.engine) {
            this.engine.stop();
        }
        return this.getStatus();
    }

    pause() {
        if (this.engine) {
            this.engine.pause();
        }
        return this.getStatus();
    }

    resume() {
        if (this.engine) {
            this.engine.resume();
        }
        return this.getStatus();
    }

    reset() {
        if (this.engine) {
            this.engine.stop();
        }
        this.engine = null;
        this.progress = 0;
        this.estimatedCompletionTime = null;
        return this.getStatus();
    }

    setSpeed(speed) {
        this.speed = speed;
        if (this.engine) {
            this.engine.setSpeed(speed);
        }
        return this.getStatus();
    }

    async getStatus() {
        const currentDataset = await datasetManager.getCurrentDataset();
        
        let remainingRecords = 0;
        let replayThroughput = 0;
        if (currentDataset && this.engine) {
            remainingRecords = Math.max(0, currentDataset.totalRecords - this.engine.currentRecordCount);
            if (this.startTime) {
                const elapsedSeconds = (Date.now() - this.startTime) / 1000;
                if (elapsedSeconds > 0) {
                    replayThroughput = (this.engine.currentRecordCount / elapsedSeconds).toFixed(2);
                }
            }
        }

        // To maintain frontend compatibility, we keep isRunning and config
        // but also supply new replay statistics.
        return {
            isRunning: this.engine ? ['running', 'paused'].includes(this.engine.state) : false,
            config: this.config,
            
            // New Replay Statistics
            replayState: this.engine ? this.engine.state : 'idle',
            currentRecord: this.engine ? this.engine.currentRecordCount : 0,
            progress: this.progress,
            remainingRecords: remainingRecords,
            replaySpeed: this.speed,
            estimatedCompletionTime: this.estimatedCompletionTime,
            currentTimestamp: Date.now(),
            replayThroughput: parseFloat(replayThroughput)
        };
    }
}

module.exports = new ReplayManager();
