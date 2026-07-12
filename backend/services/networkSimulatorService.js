class NetworkSimulatorService {
    constructor() {
        this.status = 'online'; // 'online', 'offline'
        this.packetDelay = 0; // ms
        this.packetLoss = 0; // percentage 0-100
        
        // Metrics
        this.metrics = {
            syncDurationMs: 0,
            recordsUploaded: 0,
            recordsFailed: 0
        };
    }

    getConfig() {
        return {
            status: this.status,
            packetDelay: this.packetDelay,
            packetLoss: this.packetLoss,
            metrics: this.metrics
        };
    }

    updateConfig(config) {
        if (config.status !== undefined) this.status = config.status;
        if (config.packetDelay !== undefined) this.packetDelay = config.packetDelay;
        if (config.packetLoss !== undefined) this.packetLoss = config.packetLoss;
    }

    recordSyncMetrics(durationMs, uploaded, failed) {
        this.metrics.syncDurationMs = durationMs;
        this.metrics.recordsUploaded += uploaded;
        this.metrics.recordsFailed += failed;
    }

    resetMetrics() {
        this.metrics = {
            syncDurationMs: 0,
            recordsUploaded: 0,
            recordsFailed: 0
        };
    }
}

const networkSimulatorService = new NetworkSimulatorService();
module.exports = networkSimulatorService;
