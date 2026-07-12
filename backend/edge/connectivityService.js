const http = require('http');
const networkSimulatorService = require('../services/networkSimulatorService');

class ConnectivityService {
    constructor() {
        this.isOnline = true; // Assume online initially
        this.lastStateChange = new Date();
        this.io = null;
        this.checkInterval = null;
    }

    init(io) {
        this.io = io;
        this.startChecking();
    }

    startChecking() {
        if (this.checkInterval) return;

        // Check every 10 seconds
        this.checkInterval = setInterval(async () => {
            const isReachable = await this.pingCloudServer();
            this.updateStatus(isReachable);
        }, 10000);
    }

    async pingCloudServer() {
        const simConfig = networkSimulatorService.getConfig();
        if (simConfig.status === 'offline') {
            return false;
        }

        // Simulate packet delay
        if (simConfig.packetDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, simConfig.packetDelay));
        }

        // Simulate packet loss
        if (simConfig.packetLoss > 0) {
            const drop = Math.random() * 100 < simConfig.packetLoss;
            if (drop) return false;
        }

        return new Promise((resolve) => {
            const port = process.env.PORT || 5000;
            const req = http.get(`http://localhost:${port}/api/health`, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => {
                resolve(false);
            });

            // Set a timeout of 5 seconds for the health check
            req.setTimeout(5000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    updateStatus(isReachable) {
        if (this.isOnline !== isReachable) {
            const now = new Date();
            const durationMs = now.getTime() - this.lastStateChange.getTime();
            const durationSecs = Math.round(durationMs / 1000);
            
            this.isOnline = isReachable;
            this.lastStateChange = now;

            if (this.isOnline) {
                console.log(`[CONNECTIVITY] Connection restored. Previous offline duration: ${durationSecs}s`);
            } else {
                console.log(`[CONNECTIVITY] Connection lost. Previous online duration: ${durationSecs}s`);
            }

            // Broadcast change via Socket.IO
            if (this.io) {
                this.io.emit('connectivity_status', this.getStatus());
            }
        }
    }

    getStatus() {
        const now = new Date();
        const durationMs = now.getTime() - this.lastStateChange.getTime();
        return {
            status: this.isOnline ? 'ONLINE' : 'OFFLINE',
            durationSeconds: Math.round(durationMs / 1000),
            lastStateChange: this.lastStateChange
        };
    }
}

// Export a singleton instance
module.exports = new ConnectivityService();
