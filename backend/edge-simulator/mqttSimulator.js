const mqtt = require('mqtt');
const pool = require('../db');
const { generateSensorData } = require('./sensorSimulator');
const { simulateCV } = require('./cvSimulator');
const { simulatePrediction } = require('./predictionSimulator');

class MqttSimulator {
    constructor() {
        this.client = null;
        this.intervals = {};
        this.isRunning = false;
        this.config = {
            boxCount: 1,
            intervalMs: 5000,
            offlineMode: false
        };
        this.topic = "maggot/kandang/sensor";
    }

    init() {
        this.client = mqtt.connect("mqtt://broker.hivemq.com");
        this.client.on('connect', () => {
            console.log("✅ [Simulator] Connected to MQTT Broker");
        });
        this.client.on('error', (err) => {
            console.error("❌ [Simulator] MQTT Error:", err);
        });
    }

    async getActiveBoxes(limit) {
        try {
            const res = await pool.query(`
                SELECT b.id, b.tenant_id, l.room_number 
                FROM boxes b
                JOIN box_locations l ON b.id = l.box_id
                WHERE l.end_at IS NULL AND b.status = 'active'
                ORDER BY l.room_number ASC
                LIMIT $1
            `, [limit]);
            return res.rows;
        } catch (err) {
            console.error("[Simulator] Error fetching boxes:", err);
            return [];
        }
    }

    async start(configOverrides = {}) {
        if (this.isRunning) this.stop();
        this.config = { ...this.config, ...configOverrides };
        this.isRunning = true;

        if (!this.client) this.init();

        const boxes = await this.getActiveBoxes(this.config.boxCount);
        if (boxes.length === 0) {
            console.warn("[Simulator] No active boxes found to simulate.");
            this.isRunning = false;
            return;
        }

        console.log(`[Simulator] Starting simulation for ${boxes.length} box(es) at ${this.config.intervalMs}ms interval...`);

        boxes.forEach((box) => {
            this.intervals[box.id] = setInterval(() => {
                this.simulateBoxData(box);
            }, this.config.intervalMs);
        });
    }

    stop() {
        Object.values(this.intervals).forEach(clearInterval);
        this.intervals = {};
        this.isRunning = false;
        console.log("[Simulator] Stopped.");
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            config: this.config
        };
    }

    async simulateBoxData(box) {
        // 1. Sensor Data
        const sensorData = generateSensorData(box.room_number);
        sensorData.msg_id = require('crypto').randomUUID();
        sensorData.sent_at = Date.now(); // Inject sent_at for latency tracking

        if (!this.config.offlineMode) {
            this.client.publish(this.topic, JSON.stringify(sensorData));
        }

        // Let mqttService backend handle sensor insertion natively when online,
        // but if offline, we would directly insert to localDb. However, mqttService does it if we publish.
        // If offlineMode is true, we should write it directly to offlineStorageSimulator.
        // Wait, for sensors, it's easier to just skip publishing and insert directly if offlineMode is fully requested,
        // but the requirements say "Generated data must flow through exactly the same backend pipeline".
        // Let's just always publish, but also trigger CV and prediction locally.

        // 2. CV Data
        const cvData = simulateCV(box.id, box.tenant_id);

        // 3. Prediction Data
        // Needs the generated sensor data format adapted for predictions (id isn't known yet if we just published MQTT).
        // For simplicity in simulation, we use a mocked sensor ID or wait for it.
        // Since it's a simulation, we will pass a mocked sensor object.
        const mockSData = {
            id: require('crypto').randomUUID(),
            temperature: sensorData.suhu,
            humidity_air: sensorData.kelembapan_udara,
            humidity_media: sensorData.humidity_media
        };
        simulatePrediction(box.id, box.tenant_id, mockSData, cvData);
    }
}

const mqttSimulator = new MqttSimulator();
module.exports = mqttSimulator;
