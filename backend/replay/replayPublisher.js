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
    async publishRecord(record, boxes, config = {}) {
        const offlineMode = config.offlineMode || false;
        const useNoise = config.useNoise !== false; // default true for realistic replay
        
        if (!this.isConnected && !offlineMode) {
            this.init();
        }

        boxes.forEach((box) => {
            let temperature = parseFloat(record.temp_air_in || record.suhu || record.temperature || 30.0);
            let humidityAir = parseFloat(record.rh_in || record.kelembapan_udara || record.humidity_air || record.humidity || 70.0);
            
            let humidityMedia = parseFloat(record.kelembapan_media || record.humidity_media || 50.0);
            if (record.soil_raw) {
                const soil = parseFloat(record.soil_raw);
                humidityMedia = Math.max(0, Math.min(100, 100 - (soil / 4095 * 100)));
            }

            // Simulate Sensor Noise
            if (useNoise) {
                temperature += (Math.random() * 0.4 - 0.2);
                humidityAir += (Math.random() * 2.0 - 1.0);
                humidityMedia += (Math.random() * 2.0 - 1.0);
                
                // Clamp limits
                humidityAir = Math.max(0, Math.min(100, humidityAir));
                humidityMedia = Math.max(0, Math.min(100, humidityMedia));
            }
            
            const timestamp = record.timestamp || record.recorded_at ? (isNaN(record.timestamp || record.recorded_at) ? new Date(record.timestamp || record.recorded_at).getTime() : parseInt(record.timestamp || record.recorded_at)) : Date.now();

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

            // Map Dataset Actuator logic for visualization
            if (record.fan_intake_pwm !== undefined) sensorData.fan_intake_pwm = parseInt(record.fan_intake_pwm);
            if (record.fan_exhaust_pwm !== undefined) sensorData.fan_exhaust_pwm = parseInt(record.fan_exhaust_pwm);
            if (record.heater_status !== undefined) sensorData.heater_status = record.heater_status.toLowerCase() === 'true' || record.heater_status === '1';

            if (!offlineMode && this.client) {
                if (config.useJitter !== false) {
                    const mqttDelay = Math.floor(Math.random() * (100 - 20 + 1) + 20); // 20-100ms
                    setTimeout(() => {
                        this.client.publish(this.topic, JSON.stringify(sensorData));
                    }, mqttDelay);
                } else {
                    this.client.publish(this.topic, JSON.stringify(sensorData));
                }
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
