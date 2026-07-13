const fs = require('fs');

const files = [
    'frontend/src/pages/research/ResearchMetrics.jsx',
    'frontend/src/pages/research/ResearchDatasetExport.jsx',
    'frontend/src/pages/research/ResearchDashboard.jsx',
    'frontend/src/pages/research/ResearchComparison.jsx',
    'frontend/src/pages/Monitoring.jsx',
    'frontend/src/pages/AdminSync.jsx'
];

files.forEach(f => {
    try {
        let c = fs.readFileSync(f, 'utf8');
        if (c.includes('<ResponsiveContainer width="100%" height="100%">')) {
            c = c.replace(/<ResponsiveContainer width="100%" height="100%">/g, '<ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>');
            fs.writeFileSync(f, c, 'utf8');
            console.log('Fixed', f);
        }
    } catch (e) {
        console.error(e.message);
    }
});
