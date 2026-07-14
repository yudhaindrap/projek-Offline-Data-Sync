const queueRepository = require('./queueRepository');
const connectivityService = require('./connectivityService');
const http = require('http');
const networkSimulatorService = require('../services/networkSimulatorService');
const metricsService = require('../services/metricsService');
const os = require('os');

// Helper for CPU calculation
function getCpuUsage() {
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    for (let cpu of cpus) {
        user += cpu.times.user;
        nice += cpu.times.nice;
        sys += cpu.times.sys;
        idle += cpu.times.idle;
        irq += cpu.times.irq;
    }
    const total = user + nice + sys + idle + irq;
    return Math.round(((total - idle) / total) * 100);
}

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
        const isOffline = connectivityService.getStatus().status !== 'ONLINE' || networkSimulatorService.getConfig().status === 'offline';
        
        if (isOffline) {
            // Baseline 1: No Offline Sync Simulation
            if (process.env.ENABLE_OFFLINE_SYNC === 'false') {
                const batchToDrop = queueRepository.getBatch(100);
                if (batchToDrop.length > 0) {
                    batchToDrop.forEach(item => {
                        try {
                            // Delete from queue but do NOT mark as synced in source table to simulate data loss
                            const deleteStmt = queueRepository.db.prepare(`DELETE FROM sync_queue WHERE id = ?`);
                            deleteStmt.run(item.id);
                        } catch (err) {
                            console.error(`❌ Error dropping queue item ${item.id}:`, err);
                        }
                    });
                    this.dataLossCount += batchToDrop.length;
                    console.log(`⚠️ Baseline 1 active (ENABLE_OFFLINE_SYNC=false). Dropped ${batchToDrop.length} items during offline period (Simulated Data Loss).`);
                }
            }
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
            const startCpu = getCpuUsage();
            const startMem = process.memoryUsage().heapUsed;
            
            const payloadString = JSON.stringify({ edgeData: batch });
            const payloadSizeBytes = Buffer.byteLength(payloadString);

            // Send payload to Cloud API
            const success = await this.sendToCloud(payloadString);
            
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
                
                // New Expanded Metrics
                const endCpu = getCpuUsage();
                const endMem = process.memoryUsage().heapUsed;
                metricsService.record('sync_payload_size_bytes', payloadSizeBytes);
                metricsService.record('edge_cpu_spike', Math.abs(endCpu - startCpu));
                metricsService.record('edge_mem_spike', Math.abs((endMem - startMem) / 1024 / 1024)); // in MB

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

    sendToCloud(payloadString) {
        return new Promise(async (resolve) => {
            const simConfig = networkSimulatorService.getConfig();
            
            // Simulate packet delay
            let delay = simConfig.packetDelay || 0;
            
            try {
                const replayManager = require('../replay/replayManager');
                if (replayManager && replayManager.engine) {
                    delay += Math.floor(Math.random() * (300 - 50 + 1) + 50); // 50-300ms
                }
            } catch (e) {
                // Ignore if replayManager not available
            }

            if (delay > 0) {
                await new Promise(r => setTimeout(r, delay));
            }

            // Simulate packet loss
            if (simConfig.packetLoss > 0) {
                const drop = Math.random() * 100 < simConfig.packetLoss;
                if (drop) return resolve(false);
            }

            const payload = payloadString;
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
