const mqtt = require('mqtt');
const crypto = require('crypto');
const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

// Edge Database (SQLite)
const localDb = require('./localDatabase');
const queueService = require('./queueService');
const experimentService = require('../services/experimentService');
const metricsService = require('../services/metricsService');
const automationService = require('../services/automationService');

function initMQTT(io, pgPool) {
    mqttClient.on("connect", () => {
        console.log("✅ Backend (Edge Layer) terhubung ke MQTT Broker");
        mqttClient.subscribe("maggot/kandang/sensor", (err) => {
            if (!err) console.log("📡 Subscribe topic: maggot/kandang/sensor");
            else console.error("❌ Gagal subscribe:", err.message);
        });
    });

    mqttClient.on("message", async (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log("📩 Data MQTT diterima di Edge Layer:", data);

            if (data.sent_at) {
                const latency = Date.now() - data.sent_at;
                metricsService.record('mqtt_latency_ms', latency);
            }

            let boxId = data.box_id;
            let tenantId = data.tenant_id;
            
            // If it's a hardware ESP32, it sends 'lantai', so we look up box_id and tenant_id
            if (!boxId || !tenantId) {
                const roomNumber = data.lantai || data.room_number;
                const boxLookup = await pgPool.query(`
                    SELECT b.id, b.tenant_id 
                    FROM boxes b
                    JOIN box_locations l ON b.id = l.box_id
                    WHERE l.room_number = $1 AND l.end_at IS NULL AND b.status = 'active'
                    LIMIT 1
                `, [roomNumber]);

                if (boxLookup.rows.length === 0) {
                    console.log(`⚠️ Box for room_number ${roomNumber} not found. Skipping MQTT data.`);
                    return;
                }
                boxId = boxLookup.rows[0].id;
                tenantId = boxLookup.rows[0].tenant_id;
            }

            const sensorDataId = crypto.randomUUID();
            const temperature = data.temperature !== undefined ? data.temperature : data.suhu;
            const humidityAir = data.humidity_air !== undefined ? data.humidity_air : data.kelembapan_udara;
            const humidityMedia = data.humidity_media !== undefined ? data.humidity_media : data.kelembapan_media;
            const source = data.source || "MQTT";

            const insertData = {
                id: sensorDataId,
                tenant_id: tenantId,
                box_id: boxId,
                temperature: temperature,
                humidity_air: humidityAir,
                humidity_media: humidityMedia,
                source: source,
                experiment_session_id: experimentService.getActiveExperimentId() || null
            };

            // Transaction: Insert Sensor Data AND Queue Record atomically
            const insertTransaction = localDb.transaction((sensorData) => {
                const stmt = localDb.prepare(`
                    INSERT INTO sensor_data 
                    (id, tenant_id, box_id, temperature, humidity_air, humidity_media, source, experiment_session_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                stmt.run(
                    sensorData.id,
                    sensorData.tenant_id,
                    sensorData.box_id,
                    sensorData.temperature,
                    sensorData.humidity_air,
                    sensorData.humidity_media,
                    sensorData.source,
                    sensorData.experiment_session_id
                );
                
                // Enqueue the sync record
                queueService.enqueueSync('sensor_data', sensorData.id, 'INSERT', sensorData);
            });

            // Execute transaction
            insertTransaction(insertData);

            console.log(`✅ Data tersimpan di Edge Database SQLite & Sync Queue (ID: ${sensorDataId})`);

            // Phase 3: Evaluate Automation (Thresholds, Actuators, Notifications)
            const floorLevel = data.lantai || data.room_number || 1; 
            const automationResult = await automationService.evaluate(insertData, parseInt(floorLevel));
            const actuators = automationResult.actuators;

            io.emit("telemetry_update", {
                box_id: parseInt(data.lantai || data.room_number || boxId),
                temperature: temperature,
                humidity: humidityAir,
                media_humidity: humidityMedia,
                phase: ["Larva", "Prepupa", "Pupa"][Math.floor(Math.random() * 3)],
                confidence: Math.floor(Math.random() * 10) + 90,
                fan_in: actuators.fan_in,
                pump: actuators.pump,
                heater: actuators.heater,
                harvest_est: Math.floor(Math.random() * 7),
                node_id: data.node_id || "replay_node",
                timestamp: new Date(data.timestamp || Date.now())
            });
        } catch (err) {
            console.error("❌ Error processing MQTT message at Edge Layer:", err.message);
        }
    });
}

module.exports = { mqttClient, initMQTT };
