const pool = require('../db');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const queueRepository = require('../edge/queueRepository');
const experimentService = require('./experimentService');

class MetricsService {
    constructor() {
        this.buffers = {
            mqtt_latency_ms: [],
            ws_latency_ms: [],
            webrtc_latency_ms: [],
            sync_duration_ms: [],
            sync_throughput_rps: [],
            pg_insert_time_ms: [],
            mqtt_packets: [],
            ws_packets: [],
            webrtc_packets: []
        };
        this.interval = null;
    }

    start() {
        if (this.interval) return;
        this.interval = setInterval(() => this.flushMetrics(), 5000);
        console.log("📈 MetricsService started. Sampling every 5 seconds.");
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
    }

    record(metric, value) {
        if (this.buffers[metric] !== undefined) {
            this.buffers[metric].push(value);
        }
    }

    getAverage(bufferName) {
        const arr = this.buffers[bufferName];
        if (!arr || arr.length === 0) return null;
        const sum = arr.reduce((a, b) => a + b, 0);
        const avg = sum / arr.length;
        this.buffers[bufferName] = []; // Clear buffer after reading
        return parseFloat(avg.toFixed(2));
    }

    getCpuUsage() {
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

    getMemoryUsage() {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        return parseFloat((used / 1024 / 1024).toFixed(2)); // MB
    }

    getDiskUsage() {
        // Mock disk usage for cross-platform simplicity if statfsSync is unavailable,
        // but let's try to simulate a static number + random variance to mimic edge disk
        // A real edge device has ~16GB SD card.
        // Let's just return a generic value for the prototype.
        return parseFloat((2048 + Math.random() * 10).toFixed(2)); // 2GB used
    }

    getSqliteSize() {
        try {
            const dbPath = path.resolve(__dirname, '../sense-maggot-edge.db');
            if (fs.existsSync(dbPath)) {
                const stats = fs.statSync(dbPath);
                return parseFloat((stats.size / 1024).toFixed(2)); // KB
            }
        } catch (e) {
            console.error("Error checking sqlite size:", e);
        }
        return null;
    }

    async flushMetrics() {
        const activeExpId = experimentService.getActiveExperimentId();
        if (!activeExpId) {
            // Clear buffers if not active to avoid memory leak
            this.buffers.mqtt_packets = [];
            this.buffers.ws_packets = [];
            this.buffers.webrtc_packets = [];
            return;
        }

        try {
            const queueStats = queueRepository.getQueueStats();
            
            const metrics = {
                id: crypto.randomUUID(),
                experiment_session_id: activeExpId,
                mqtt_latency_ms: this.getAverage('mqtt_latency_ms'),
                ws_latency_ms: this.getAverage('ws_latency_ms'),
                webrtc_latency_ms: this.getAverage('webrtc_latency_ms'),
                sync_duration_ms: this.getAverage('sync_duration_ms'),
                sync_throughput_rps: this.getAverage('sync_throughput_rps'),
                queue_size: queueStats.total || 0,
                cpu_usage_pct: this.getCpuUsage(),
                memory_usage_mb: this.getMemoryUsage(),
                disk_usage_mb: this.getDiskUsage(),
                sqlite_size_kb: this.getSqliteSize(),
                pg_insert_time_ms: this.getAverage('pg_insert_time_ms')
            };

            await pool.query(`
                INSERT INTO performance_metrics 
                (id, experiment_session_id, mqtt_latency_ms, ws_latency_ms, webrtc_latency_ms, sync_duration_ms, sync_throughput_rps, queue_size, cpu_usage_pct, memory_usage_mb, disk_usage_mb, sqlite_size_kb, pg_insert_time_ms, recorded_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
            `, [
                metrics.id,
                metrics.experiment_session_id,
                metrics.mqtt_latency_ms,
                metrics.ws_latency_ms,
                metrics.webrtc_latency_ms,
                metrics.sync_duration_ms,
                metrics.sync_throughput_rps,
                metrics.queue_size,
                metrics.cpu_usage_pct,
                metrics.memory_usage_mb,
                metrics.disk_usage_mb,
                metrics.sqlite_size_kb,
                metrics.pg_insert_time_ms
            ]);

            // Flush MQTT Packets
            const mqttPackets = [...this.buffers.mqtt_packets];
            this.buffers.mqtt_packets = [];
            for (const pkt of mqttPackets) {
                await pool.query(`
                    INSERT INTO mqtt_latency_logs 
                    (id, experiment_session_id, msg_id, sent_at, broker_received_at, backend_received_at, latency_ms)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `, [crypto.randomUUID(), activeExpId, pkt.msg_id, pkt.sent_at, pkt.broker_received_at || null, pkt.backend_received_at, pkt.latency_ms]);
            }

            // Flush WS Packets
            const wsPackets = [...this.buffers.ws_packets];
            this.buffers.ws_packets = [];
            for (const pkt of wsPackets) {
                await pool.query(`
                    INSERT INTO websocket_latency_logs 
                    (id, experiment_session_id, server_send_at, browser_receive_at, browser_render_at, broadcast_latency_ms, render_latency_ms, e2e_latency_ms)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [crypto.randomUUID(), activeExpId, pkt.server_send_at, pkt.browser_receive_at, pkt.browser_render_at, pkt.broadcast_latency_ms, pkt.render_latency_ms, pkt.e2e_latency_ms]);
            }

            // Flush WebRTC Packets
            const webrtcPackets = [...this.buffers.webrtc_packets];
            this.buffers.webrtc_packets = [];
            for (const pkt of webrtcPackets) {
                await pool.query(`
                    INSERT INTO webrtc_latency_logs 
                    (id, experiment_session_id, frame_id, capture_time, encode_time, transmit_time, decode_time, display_time, latency_ms, fps, bitrate, jitter)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                `, [crypto.randomUUID(), activeExpId, pkt.frame_id, pkt.capture_time, pkt.encode_time, pkt.transmit_time, pkt.decode_time, pkt.display_time, pkt.latency_ms, pkt.fps, pkt.bitrate, pkt.jitter]);
            }

            // Sync and Network Metrics (Insert to Phase 7 experiment_metrics_log)
            const syncWorker = require('../edge/syncWorker');
            const connectivityService = require('../edge/connectivityService');
            
            const syncStats = syncWorker.getMetrics();
            const connStats = connectivityService.getStatus();
            const networkSimConfig = require('./networkSimulatorService').getConfig();
            
            const networkPayload = {
                wifi_rssi: -50 - Math.floor(Math.random() * 30), // Simulated RSSI (-50 to -80 dBm)
                internet_rtt_ms: networkSimConfig.packetDelay || 15,
                bandwidth_mbps: 10 + Math.random() * 40, // Simulated bandwidth
                packet_loss_pct: networkSimConfig.packetLoss || 0,
                status: connStats.status,
                duration_secs: connStats.durationSeconds
            };

            const syncPayload = {
                average_sync_time_ms: syncStats.averageSyncTime,
                success_rate_pct: syncStats.successRate,
                total_success: syncStats.totalSuccess,
                total_failed: syncStats.totalFailed,
                data_loss: syncStats.dataLoss,
                queue_size: queueStats.total || 0,
                pending_queue: queueStats.pending || 0
            };

            await pool.query(`
                INSERT INTO experiment_metrics_log (id, experiment_session_id, metric_type, payload)
                VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
            `, [
                crypto.randomUUID(), activeExpId, 'network', networkPayload,
                crypto.randomUUID(), activeExpId, 'sync', syncPayload
            ]);

        } catch (err) {
            console.error("❌ Metrics flush error:", err.message);
        }
    }
}

const metricsService = new MetricsService();
module.exports = metricsService;
