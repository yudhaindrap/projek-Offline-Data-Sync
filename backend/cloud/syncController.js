// This controller handles incoming sync requests from the Edge Layer.

const syncService = require('./syncService');

const handleSyncRequest = async (req, res) => {
    try {
        const { edgeData } = req.body;
        
        if (!edgeData) {
            return res.status(400).json({ error: 'Missing edgeData in payload' });
        }

        const metrics = await syncService.processSyncData(edgeData);
        
        res.status(200).json({ 
            message: 'Sync processed',
            accepted: metrics.accepted,
            duplicates: metrics.duplicates,
            failed: metrics.failed
        });
    } catch (error) {
        console.error('Sync Error:', error);
        res.status(500).json({ error: 'Sync failed completely' });
    }
};

module.exports = {
    handleSyncRequest
};
