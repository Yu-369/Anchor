import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, '..', 'uploads');
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mime = allowedTypes.test(file.mimetype);
        if (ext && mime) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Helper to format anchor from DB row
function formatAnchor(row) {
    if (!row) return null;
    return {
        id: row.id,
        label: row.label,
        description: row.description,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        gps: {
            lat: row.gps_lat,
            lng: row.gps_lng,
            accuracy: row.gps_accuracy,
            altitude: row.gps_altitude
        },
        heading: row.heading,
        imageRef: row.imageRef,
        tags: row.tags ? JSON.parse(row.tags) : [],
        isIndoor: Boolean(row.isIndoor)
    };
}

// GET /api/anchors - List all anchors
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM anchors ORDER BY createdAt DESC').all();
        res.json(rows.map(formatAnchor));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/anchors/:id - Get single anchor
router.get('/:id', (req, res) => {
    try {
        const db = getDb();
        const row = db.prepare('SELECT * FROM anchors WHERE id = ?').get(req.params.id);
        if (!row) {
            return res.status(404).json({ error: 'Anchor not found' });
        }
        res.json(formatAnchor(row));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/anchors - Create anchor
router.post('/', upload.single('image'), (req, res) => {
    try {
        const db = getDb();
        const id = uuidv4();
        const now = new Date().toISOString();

        // Parse body (may come as JSON string if multipart)
        let body = req.body;
        if (typeof body.data === 'string') {
            body = JSON.parse(body.data);
        }

        const { label, description, gps, heading, tags, isIndoor } = body;

        if (!gps || typeof gps.lat !== 'number' || typeof gps.lng !== 'number') {
            return res.status(400).json({ error: 'GPS coordinates (lat, lng) are required' });
        }

        const imageRef = req.file ? `uploads/${req.file.filename}` : null;

        db.prepare(`
      INSERT INTO anchors (id, label, description, createdAt, updatedAt, gps_lat, gps_lng, gps_accuracy, gps_altitude, heading, imageRef, tags, isIndoor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id,
            label || null,
            description || null,
            now,
            now,
            gps.lat,
            gps.lng,
            gps.accuracy || null,
            gps.altitude || null,
            heading || null,
            imageRef,
            tags ? JSON.stringify(tags) : null,
            isIndoor ? 1 : 0
        );

        const created = db.prepare('SELECT * FROM anchors WHERE id = ?').get(id);
        res.status(201).json(formatAnchor(created));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/anchors/:id - Update anchor
router.put('/:id', upload.single('image'), (req, res) => {
    try {
        const db = getDb();
        const existing = db.prepare('SELECT * FROM anchors WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Anchor not found' });
        }

        let body = req.body;
        if (typeof body.data === 'string') {
            body = JSON.parse(body.data);
        }

        const { label, description, gps, heading, tags, isIndoor } = body;
        const now = new Date().toISOString();

        let imageRef = existing.imageRef;
        if (req.file) {
            // Delete old image if exists
            if (existing.imageRef) {
                const oldPath = path.join(__dirname, '..', existing.imageRef);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            imageRef = `uploads/${req.file.filename}`;
        }

        db.prepare(`
      UPDATE anchors SET
        label = COALESCE(?, label),
        description = COALESCE(?, description),
        updatedAt = ?,
        gps_lat = COALESCE(?, gps_lat),
        gps_lng = COALESCE(?, gps_lng),
        gps_accuracy = COALESCE(?, gps_accuracy),
        gps_altitude = COALESCE(?, gps_altitude),
        heading = COALESCE(?, heading),
        imageRef = ?,
        tags = COALESCE(?, tags),
        isIndoor = COALESCE(?, isIndoor)
      WHERE id = ?
    `).run(
            label,
            description,
            now,
            gps?.lat,
            gps?.lng,
            gps?.accuracy,
            gps?.altitude,
            heading,
            imageRef,
            tags ? JSON.stringify(tags) : null,
            isIndoor !== undefined ? (isIndoor ? 1 : 0) : null,
            req.params.id
        );

        const updated = db.prepare('SELECT * FROM anchors WHERE id = ?').get(req.params.id);
        res.json(formatAnchor(updated));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/anchors/:id - Delete anchor (cascades to related entities)
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        const existing = db.prepare('SELECT * FROM anchors WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: 'Anchor not found' });
        }

        // Delete associated image file
        if (existing.imageRef) {
            const imagePath = path.join(__dirname, '..', existing.imageRef);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        // Delete anchor (cascade will handle related records)
        db.prepare('DELETE FROM anchors WHERE id = ?').run(req.params.id);

        res.json({ message: 'Anchor deleted', id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Nested routes for related entities
// GET /api/anchors/:anchorId/vectors
router.get('/:anchorId/vectors', (req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM approach_vectors WHERE anchorId = ? ORDER BY createdAt DESC').all(req.params.anchorId);
        res.json(rows.map(row => ({
            ...row,
            waypoints: JSON.parse(row.waypoints)
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/anchors/:anchorId/vectors
router.post('/:anchorId/vectors', (req, res) => {
    try {
        const db = getDb();
        const anchor = db.prepare('SELECT id FROM anchors WHERE id = ?').get(req.params.anchorId);
        if (!anchor) {
            return res.status(404).json({ error: 'Anchor not found' });
        }

        const id = uuidv4();
        const now = new Date().toISOString();
        const { waypoints, totalDistance, avgHeading } = req.body;

        if (!waypoints || !Array.isArray(waypoints)) {
            return res.status(400).json({ error: 'Waypoints array is required' });
        }

        db.prepare(`
      INSERT INTO approach_vectors (id, anchorId, createdAt, waypoints, totalDistance, avgHeading)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.params.anchorId, now, JSON.stringify(waypoints), totalDistance || null, avgHeading || null);

        const created = db.prepare('SELECT * FROM approach_vectors WHERE id = ?').get(id);
        res.status(201).json({
            ...created,
            waypoints: JSON.parse(created.waypoints)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/anchors/:anchorId/fingerprint
router.get('/:anchorId/fingerprint', (req, res) => {
    try {
        const db = getDb();
        const row = db.prepare('SELECT * FROM magnetic_fingerprints WHERE anchorId = ?').get(req.params.anchorId);
        if (!row) {
            return res.status(404).json({ error: 'Fingerprint not found' });
        }
        res.json({
            id: row.id,
            anchorId: row.anchorId,
            createdAt: row.createdAt,
            magnitude: row.magnitude,
            vector: {
                x: row.vector_x,
                y: row.vector_y,
                z: row.vector_z
            },
            inclination: row.inclination,
            deviceOrientation: row.deviceOrientation ? JSON.parse(row.deviceOrientation) : null,
            sampleCount: row.sampleCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/anchors/:anchorId/fingerprint (upsert)
router.post('/:anchorId/fingerprint', (req, res) => {
    try {
        const db = getDb();
        const anchor = db.prepare('SELECT id FROM anchors WHERE id = ?').get(req.params.anchorId);
        if (!anchor) {
            return res.status(404).json({ error: 'Anchor not found' });
        }

        const { magnitude, vector, inclination, deviceOrientation, sampleCount } = req.body;

        if (typeof magnitude !== 'number' || !vector || typeof vector.x !== 'number') {
            return res.status(400).json({ error: 'Magnitude and vector (x, y, z) are required' });
        }

        // Delete existing fingerprint if any
        db.prepare('DELETE FROM magnetic_fingerprints WHERE anchorId = ?').run(req.params.anchorId);

        const id = uuidv4();
        const now = new Date().toISOString();

        db.prepare(`
      INSERT INTO magnetic_fingerprints (id, anchorId, createdAt, magnitude, vector_x, vector_y, vector_z, inclination, deviceOrientation, sampleCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id,
            req.params.anchorId,
            now,
            magnitude,
            vector.x,
            vector.y,
            vector.z,
            inclination || null,
            deviceOrientation ? JSON.stringify(deviceOrientation) : null,
            sampleCount || null
        );

        const created = db.prepare('SELECT * FROM magnetic_fingerprints WHERE id = ?').get(id);
        res.status(201).json({
            id: created.id,
            anchorId: created.anchorId,
            createdAt: created.createdAt,
            magnitude: created.magnitude,
            vector: {
                x: created.vector_x,
                y: created.vector_y,
                z: created.vector_z
            },
            inclination: created.inclination,
            deviceOrientation: created.deviceOrientation ? JSON.parse(created.deviceOrientation) : null,
            sampleCount: created.sampleCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/anchors/:anchorId/objects
router.get('/:anchorId/objects', (req, res) => {
    try {
        const db = getDb();
        const rows = db.prepare('SELECT * FROM ar_objects WHERE anchorId = ? ORDER BY createdAt DESC').all(req.params.anchorId);
        res.json(rows.map(row => ({
            id: row.id,
            anchorId: row.anchorId,
            label: row.label,
            description: row.description,
            createdAt: row.createdAt,
            offset: {
                forward: row.offset_forward,
                right: row.offset_right,
                up: row.offset_up
            },
            triggerRadius: row.triggerRadius,
            revealCondition: row.revealCondition,
            metadata: row.metadata ? JSON.parse(row.metadata) : null
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/anchors/:anchorId/objects
router.post('/:anchorId/objects', (req, res) => {
    try {
        const db = getDb();
        const anchor = db.prepare('SELECT id FROM anchors WHERE id = ?').get(req.params.anchorId);
        if (!anchor) {
            return res.status(404).json({ error: 'Anchor not found' });
        }

        const { label, description, offset, triggerRadius, revealCondition, metadata } = req.body;

        if (!label) {
            return res.status(400).json({ error: 'Label is required' });
        }

        const id = uuidv4();
        const now = new Date().toISOString();

        db.prepare(`
      INSERT INTO ar_objects (id, anchorId, label, description, createdAt, offset_forward, offset_right, offset_up, triggerRadius, revealCondition, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id,
            req.params.anchorId,
            label,
            description || null,
            now,
            offset?.forward || null,
            offset?.right || null,
            offset?.up || null,
            triggerRadius || null,
            revealCondition || null,
            metadata ? JSON.stringify(metadata) : null
        );

        const created = db.prepare('SELECT * FROM ar_objects WHERE id = ?').get(id);
        res.status(201).json({
            id: created.id,
            anchorId: created.anchorId,
            label: created.label,
            description: created.description,
            createdAt: created.createdAt,
            offset: {
                forward: created.offset_forward,
                right: created.offset_right,
                up: created.offset_up
            },
            triggerRadius: created.triggerRadius,
            revealCondition: created.revealCondition,
            metadata: created.metadata ? JSON.parse(created.metadata) : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
