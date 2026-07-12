const mqtt = require('mqtt');
const pool = require('../db');
const { simulateCV } = require('../edge-simulator/cvSimulator');
const { simulatePrediction } = require('../edge-simulator/predictionSimulator');
const crypto = require('crypto');

class ReplayPublisher {
    constructor() {
        this.client = null;
        this.topic = "maggot/kandang/sensor";
        this.isConnected = false;
    }

    init() {
        if (!this.client) {
            this.client = mqtt.connect("mqtt://broker.hivemq.com");
            this.client.on('connect', () => {
                console.log("✅ [ReplayPublisher] Connected to MQTT Broker");
                this.isConnected = true;
            });
            this.client.on('error', (err) => {
                console.error("❌ [ReplayPublisher] MQTT Error:", err);
            });
        }
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
            console.error("[ReplayPublisher] Error fetching boxes:", err);
            return [];
        }
    }

    /**
     * Publishes a replayed record to all active boxes
     */
    async publishRecord(record, boxes, offlineMode = false) {
        if (!this.isConnected && !offlineMode) {
            this.init();
        }

        boxes.forEach((box) => {
            const temperature = parseFloat(record.suhu || record.temperature || 30.0);
            const humidityAir = parseFloat(record.kelembapan_udara || record.humidity_air || record.humidity || 70.0);
            const humidityMedia = parseFloat(record.kelembapan_media || record.humidity_media || 50.0);
            const timestamp = record.timestamp ? (isNaN(record.timestamp) ? new Date(record.timestamp).getTime() : parseInt(record.timestamp)) : Date.now();

            const sensorData = {
                temperature: temperature,
                humidity_air: humidityAir,
                humidity_media: humidityMedia,
                box_id: box.id,
                tenant_id: box.tenant_id,
                timestamp: timestamp,
                source: "dataset",
                sent_at: Date.now()
            };

            if (!offlineMode && this.client) {
                this.client.publish(this.topic, JSON.stringify(sensorData));
            }

            // Simulate CV based on box
            const cvData = simulateCV(box.id, box.tenant_id);

            // Simulate prediction based on replayed data
            const mockSData = {
                id: crypto.randomUUID(),
                temperature: temperature,
                humidity_air: humidityAir,
                humidity_media: humidityMedia
            };
            
            simulatePrediction(box.id, box.tenant_id, mockSData, cvData);
        });
    }
}

module.exports = new ReplayPublisher();
