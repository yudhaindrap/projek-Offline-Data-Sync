const queueRepository = require('./queueRepository');
const connectivityService = require('./connectivityService');
const http = require('http');
const networkSimulatorService = require('../services/networkSimulatorService');
const metricsService = require('../services/metricsService');

class SyncWorker {
    constructor() {
        this.intervalMs = 30000; // 30 seconds
        this.timer = null;
        this.isRunning = false;
        
        // Metrics state
        this.successCount = 0;
        this.failureCount = 0;
        this.totalSyncTimeMs = 0;
        this.syncCycles = 0;
        this.dataLossCount = 0;
    }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => this.processQueue(), this.intervalMs);
        console.log("🔄 SyncWorker started. Running every 30 seconds.");
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async processQueue() {
        if (this.isRunning) return;

        // Only run when ONLINE physically, or simulated
        if (connectivityService.getStatus().status !== 'ONLINE') {
            return;
        }

        const simConfig = networkSimulatorService.getConfig();
        if (simConfig.status === 'offline') {
            return;
        }

        this.isRunning = true;

        try {
            const batch = queueRepository.getBatch(100);
            if (batch.length === 0) {
                this.isRunning = false;
                return;
            }

            console.log(`📤 SyncWorker: Found ${batch.length} items to sync.`);
            const startTime = Date.now();

            // Send payload to Cloud API
            const success = await this.sendToCloud(batch);
            
            const durationMs = Date.now() - startTime;
            this.totalSyncTimeMs += durationMs;
            this.syncCycles++;

            if (success) {
                this.successCount += batch.length;
                // Mark success for all
                batch.forEach(item => {
                    try {
                        queueRepository.markSuccess(item.id, item.entity_name, item.entity_id);
                    } catch (err) {
                        console.error(`❌ Error marking success for queue item ${item.id}:`, err);
                    }
                });
                console.log(`✅ SyncWorker: Successfully synced and removed ${batch.length} items.`);
                networkSimulatorService.recordSyncMetrics(durationMs, batch.length, 0);
                metricsService.record('sync_duration_ms', durationMs);
                const throughput = durationMs > 0 ? (batch.length / (durationMs / 1000)) : batch.length;
                metricsService.record('sync_throughput_rps', throughput);
            } else {
                this.failureCount += batch.length;
                // Mark failed for indefinite retry
                batch.forEach(item => {
                    queueRepository.markFailed(item.id);
                });
                console.log(`⚠️ SyncWorker: Sync failed. Marked ${batch.length} items for retry (Data Loss: 0).`);
                networkSimulatorService.recordSyncMetrics(durationMs, 0, batch.length);
            }

        } catch (error) {
            console.error("❌ SyncWorker Error:", error);
        } finally {
            this.isRunning = false;
        }
    }

    sendToCloud(batch) {
        return new Promise(async (resolve) => {
            const simConfig = networkSimulatorService.getConfig();
            
            // Simulate packet delay
            if (simConfig.packetDelay > 0) {
                await new Promise(r => setTimeout(r, simConfig.packetDelay));
            }

            // Simulate packet loss
            if (simConfig.packetLoss > 0) {
                const drop = Math.random() * 100 < simConfig.packetLoss;
                if (drop) return resolve(false);
            }

            const payload = JSON.stringify({ edgeData: batch });
            const port = process.env.PORT || 5000;
            
            const options = {
                hostname: 'localhost',
                port: port,
                path: '/api/sync',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };

            const req = http.request(options, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });

            req.on('error', (error) => {
                console.error("SyncWorker HTTP Request Error:", error.message);
                resolve(false);
            });

            req.setTimeout(5000, () => {
                req.destroy();
                resolve(false);
            });

            req.write(payload);
            req.end();
        });
    }

    triggerSyncNow() {
        if (!this.isRunning) {
            console.log("⚡ SyncWorker: Manually triggered sync.");
            this.processQueue();
        }
    }

    getMetrics() {
        const totalAttempts = this.successCount + this.failureCount;
        const successRate = totalAttempts > 0 ? ((this.successCount / totalAttempts) * 100).toFixed(2) : 100;
        const averageSyncTime = this.syncCycles > 0 ? (this.totalSyncTimeMs / this.syncCycles).toFixed(2) : 0;
        
        return {
            successRate: parseFloat(successRate),
            averageSyncTime: parseFloat(averageSyncTime),
            dataLoss: this.dataLossCount,
            totalSuccess: this.successCount,
            totalFailed: this.failureCount
        };
    }
}

const syncWorker = new SyncWorker();
module.exports = syncWorker;
