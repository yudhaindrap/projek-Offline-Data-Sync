const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATASETS_DIR = path.join(__dirname, 'datasets', 'raw');

/**
 * Scans a single CSV file and extracts metadata
 */
async function scanCsvFile(filePath, filename) {
    return new Promise((resolve, reject) => {
        const metadata = {
            id: filename.replace('.csv', ''),
            name: filename.replace('.csv', '').replace(/_/g, ' '),
            filename: filename,
            totalRecords: 0,
            startTimestamp: null,
            endTimestamp: null,
            durationMs: 0,
            availableColumns: [],
            notes: "Scanned dataset"
        };

        let isFirstLine = true;
        let lastLine = null;
        let firstDataLine = null;
        let delimiter = ',';

        const rl = readline.createInterface({
            input: fs.createReadStream(filePath),
            crlfDelay: Infinity
        });

        rl.on('line', (line) => {
            if (!line.trim()) return;

            if (isFirstLine) {
                if (line.includes(';')) {
                    delimiter = ';';
                }
                // Parse headers
                const headers = line.split(delimiter).map(h => h.trim());
                metadata.availableColumns = headers;
                isFirstLine = false;
            } else {
                metadata.totalRecords++;
                lastLine = line;
                if (!firstDataLine) {
                    firstDataLine = line;
                }
            }
        });

        rl.on('close', () => {
            if (metadata.totalRecords > 0 && firstDataLine && lastLine) {
                try {
                    // Try to extract timestamp from the first column assuming it's usually timestamp/time/recorded_at
                    const headers = metadata.availableColumns;
                    const timestampIdx = headers.findIndex(h => h.toLowerCase().includes('timestamp') || h.toLowerCase() === 'time' || h.toLowerCase() === 'recorded_at');
                    
                    if (timestampIdx !== -1) {
                        const firstParts = firstDataLine.split(delimiter);
                        const lastParts = lastLine.split(delimiter);
                        
                        let startStr = firstParts[timestampIdx].trim();
                        let endStr = lastParts[timestampIdx].trim();

                        let start = new Date(startStr).getTime();
                        let end = new Date(endStr).getTime();
                        
                        // Handle epoch strings (numbers) if Date parsing results in NaN but it's purely digits
                        if (isNaN(start) && /^\d+$/.test(startStr)) {
                            start = parseInt(startStr, 10);
                        }
                        if (isNaN(end) && /^\d+$/.test(endStr)) {
                            end = parseInt(endStr, 10);
                        }
                        
                        if (!isNaN(start) && !isNaN(end)) {
                            metadata.startTimestamp = start;
                            metadata.endTimestamp = end;
                            metadata.durationMs = end - start;
                        }
                    }
                } catch (e) {
                    console.error(`Error parsing timestamps for ${filename}:`, e);
                }
            }
            resolve(metadata);
        });

        rl.on('error', (err) => reject(err));
    });
}

/**
 * Scans the entire datasets directory
 */
async function scanAllDatasets() {
    if (!fs.existsSync(DATASETS_DIR)) {
        fs.mkdirSync(DATASETS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(DATASETS_DIR);
    const csvFiles = files.filter(f => f.endsWith('.csv'));
    const datasets = [];

    for (const file of csvFiles) {
        try {
            const filePath = path.join(DATASETS_DIR, file);
            const metadata = await scanCsvFile(filePath, file);
            datasets.push(metadata);
        } catch (error) {
            console.error(`Failed to scan dataset ${file}:`, error);
        }
    }

    return datasets;
}

module.exports = {
    scanAllDatasets,
    scanCsvFile
};
