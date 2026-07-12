const crypto = require('crypto');
const queueRepository = require('./queueRepository');

class QueueService {
    enqueueSync(entityName, entityId, operation, payloadObj) {
        const id = crypto.randomUUID();
        const payloadStr = JSON.stringify(payloadObj);
        
        // This is called from within a transaction in mqttService.js,
        // so it will use the same database connection implicitly because 
        // better-sqlite3 handles transactions synchronously.
        queueRepository.addQueueItem(id, entityName, entityId, operation, payloadStr);
        
        return id;
    }
}

module.exports = new QueueService();
