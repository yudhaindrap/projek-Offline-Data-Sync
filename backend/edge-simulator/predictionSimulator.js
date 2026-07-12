const crypto = require('crypto');
const { simulateOfflineInsertion } = require('./offlineStorageSimulator');

function simulatePrediction(boxId, tenantId, sData, cvData) {
    if (!sData || !cvData) return null;
    
    // Simple heuristic for mock prediction
    const predictionDays = Math.max(1, 14 - Math.floor(cvData.pupa_count / 2) - Math.floor(cvData.prepupa_count / 3));

    const data = {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        box_id: boxId,
        sensor_data_id: sData.id,
        cv_result_id: cvData.id,
        predicted_days: predictionDays,
        input_temperature: sData.temperature,
        input_humidity_air: sData.humidity_air,
        input_humidity_media: sData.humidity_media
    };

    simulateOfflineInsertion('harvest_predictions', data);
    return data;
}

module.exports = { simulatePrediction };
