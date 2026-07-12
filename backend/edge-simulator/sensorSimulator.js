function generateSensorData(boxCounter) {
    return {
        node_id: `ESP32_DEV_${boxCounter}`,
        lantai: boxCounter, // Mapped to room_number
        suhu: parseFloat((28 + Math.random() * 7).toFixed(2)), // 28-35°C
        kelembapan_udara: parseFloat((60 + Math.random() * 30).toFixed(2)), // 60-90%
        humidity_media: parseFloat((50 + Math.random() * 30).toFixed(2)) // 50-80%
    };
}

module.exports = { generateSensorData };
