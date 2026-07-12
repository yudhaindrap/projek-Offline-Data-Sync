const crypto = require('crypto');
const { simulateOfflineInsertion } = require('./offlineStorageSimulator');

const phases = ["baby larva", "adult larva", "prepupa", "pupa"];

function simulateCV(boxId, tenantId) {
    const dominantPhase = phases[Math.floor(Math.random() * phases.length)];
    const confidenceScore = parseFloat((75 + Math.random() * 24).toFixed(2));
    
    const data = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        box_id: boxId,
        baby_larva_count: Math.floor(Math.random() * 50),
        adult_larva_count: Math.floor(Math.random() * 50),
        prepupa_count: Math.floor(Math.random() * 20),
        pupa_count: Math.floor(Math.random() * 10),
        dominant_phase: dominantPhase,
        confidence: confidenceScore,
        image_path: `/images/simulated/box_${boxId}_${Date.now()}.jpg`
    };

    simulateOfflineInsertion('cv_results', data);
    return data;
}

module.exports = { simulateCV };
