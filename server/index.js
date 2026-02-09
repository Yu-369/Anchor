import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/database.js';
import anchorsRouter from './routes/anchors.js';
import approachVectorsRouter from './routes/approachVectors.js';
import magneticFingerprintsRouter from './routes/magneticFingerprints.js';
import arObjectsRouter from './routes/arObjects.js';
import guidanceRouter from './routes/guidance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/anchors', anchorsRouter);
app.use('/api/vectors', approachVectorsRouter);
app.use('/api/fingerprints', magneticFingerprintsRouter);
app.use('/api/objects', arObjectsRouter);
app.use('/api/guidance', guidanceRouter);

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Initialize database and start server
async function start() {
    try {
        await initDb();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`ANCHOR backend running on http://0.0.0.0:${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/api/health`);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();
