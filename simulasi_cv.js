require('dotenv').config({ path: './backend/.env' });
const pool = require('./backend/db');

console.log("📹 Memulai Simulasi Computer Vision YOLOv8 (PostgreSQL)...");

let boxCounter = 1;
const phases = ["baby larva", "adult larva", "prepupa", "pupa"];

setInterval(async () => {
    try {
        const dominantPhase = phases[Math.floor(Math.random() * phases.length)];
        const confidenceScore = parseFloat((75 + Math.random() * 24).toFixed(2)); // 75.00 - 99.00

        const counts = {
            baby_larva: Math.floor(Math.random() * 50),
            adult_larva: Math.floor(Math.random() * 50),
            prepupa: Math.floor(Math.random() * 20),
            pupa: Math.floor(Math.random() * 10)
        };

        const query = `
            INSERT INTO cv_detections (box_id, image_url, dominant_phase, confidence_score, detection_counts, detected_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *;
        `;
        const imageUrl = `http://dummy.url/images/box_${boxCounter}_${Date.now()}.jpg`;
        await pool.query(query, [
            boxCounter,
            imageUrl,
            dominantPhase,
            confidenceScore,
            JSON.stringify(counts)
        ]);

        console.log(`📸 CV Simulated - Box #${boxCounter} | Phase: ${dominantPhase.toUpperCase()}`);

        boxCounter = boxCounter >= 3 ? 1 : boxCounter + 1;
    } catch (err) {
        console.error("❌ Error simulasi CV:", err.message);
    }
}, 10000);
