const mqtt = require('mqtt');
require('dotenv').config({ path: './backend/.env' });

const MQTT_URL = process.env.MQTT_URL || "mqtt://broker.hivemq.com";
const TOPIC = process.env.MQTT_SENSOR_TOPIC || "maggot/kandang/sensor";

const client = mqtt.connect(MQTT_URL);

console.log(`🛰️ Memulai Simulasi Multi-Box ESP32 via ${MQTT_URL}...`);

client.on('connect', () => {
    console.log("✅ Terhubung ke MQTT Broker");
    let boxCounter = 1;

    setInterval(() => {
        const dataSensor = {
            node_id: `ESP32_DEV_${boxCounter}`,
            lantai: boxCounter,
            suhu: parseFloat((25 + Math.random() * 5).toFixed(2)),
            kelembapan_udara: parseFloat((70 + Math.random() * 10).toFixed(2)),
            kelembapan_media: parseFloat((50 + Math.random() * 15).toFixed(2))
        };

        client.publish(TOPIC, JSON.stringify(dataSensor));
        console.log(`📤 MQTT Published - Box #${boxCounter} | Temp: ${dataSensor.suhu}°C`);

        boxCounter = boxCounter >= 3 ? 1 : boxCounter + 1;
    }, 5000);
});

client.on('error', (err) => {
    console.error("❌ MQTT Error:", err.message);
});