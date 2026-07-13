const fs = require('fs');
const readline = require('readline');
const EventEmitter = require('events');
const path = require('path');

class DatasetReplay extends EventEmitter {
    constructor(datasetId, speed = 1) {
        super();
        this.datasetId = datasetId;
        this.speed = speed;
        this.filePath = path.join(__dirname, '../research/datasets/raw', `${datasetId}.csv`);
        
        this.state = 'idle'; // idle, running, paused, stopped, finished
        this.rl = null;
        this.headers = [];
        this.currentRecordCount = 0;
        this.lastRecordTimestamp = null;
        this.nextTimeoutId = null;
        this.delimiter = ',';
        
        this.shouldStop = false;
        this.isPaused = false;
    }

    async start() {
        if (!fs.existsSync(this.filePath)) {
            this.emit('error', new Error(`Dataset file not found: ${this.filePath}`));
            return;
        }

        this.state = 'running';
        this.shouldStop = false;
        this.isPaused = false;
        this.currentRecordCount = 0;
        this.lastRecordTimestamp = null;

        const fileStream = fs.createReadStream(this.filePath);
        this.rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        this.emit('started');

        try {
            let isFirst = true;
            for await (const line of this.rl) {
                if (this.shouldStop) break;
                
                while (this.isPaused && !this.shouldStop) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                if (this.shouldStop) break;
                if (!line.trim()) continue;

                if (isFirst) {
                    if (line.includes(';')) {
                        this.delimiter = ';';
                    }
                    this.headers = line.split(this.delimiter).map(h => h.trim());
                    isFirst = false;
                    continue;
                }

                const parts = line.split(this.delimiter);
                const record = {};
                this.headers.forEach((h, i) => {
                    record[h] = parts[i] ? parts[i].trim() : null;
                });

                // Find timestamp
                const tsKey = this.headers.find(h => h.toLowerCase().includes('timestamp') || h.toLowerCase() === 'time');
                let currentTs = null;
                
                if (tsKey && record[tsKey]) {
                    let tsStr = record[tsKey];
                    currentTs = new Date(tsStr).getTime();
                    if (isNaN(currentTs) && /^\d+$/.test(tsStr)) {
                        currentTs = parseInt(tsStr, 10);
                    }
                }

                if (currentTs && this.lastRecordTimestamp) {
                    const diffMs = currentTs - this.lastRecordTimestamp;
                    if (diffMs > 0) {
                        const waitTime = diffMs / this.speed;
                        if (waitTime > 0) {
                            await this.sleep(waitTime);
                        }
                    }
                }

                if (currentTs) {
                    this.lastRecordTimestamp = currentTs;
                }

                this.currentRecordCount++;
                this.emit('record', record);
            }
        } catch (err) {
            this.emit('error', err);
        } finally {
            if (this.state !== 'stopped') {
                this.state = 'finished';
                this.emit('finished');
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => {
            this.nextTimeoutId = setTimeout(resolve, Math.min(ms, 2147483647)); // Handle large ms safely
        });
    }

    pause() {
        if (this.state === 'running') {
            this.isPaused = true;
            this.state = 'paused';
            this.emit('paused');
        }
    }

    resume() {
        if (this.state === 'paused') {
            this.isPaused = false;
            this.state = 'running';
            this.emit('resumed');
        }
    }

    stop() {
        this.shouldStop = true;
        this.isPaused = false;
        this.state = 'stopped';
        if (this.nextTimeoutId) {
            clearTimeout(this.nextTimeoutId);
        }
        if (this.rl) {
            this.rl.close();
        }
        this.emit('stopped');
    }

    setSpeed(speed) {
        this.speed = speed;
        // If currently sleeping, the time to sleep won't be recalculated until next record.
        // For a more advanced implementation we could interrupt sleep, but this is acceptable for now.
    }
}

module.exports = DatasetReplay;
