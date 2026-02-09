export function initSchema(db) {
  // Anchors table - core entity
  db.run(`
    CREATE TABLE IF NOT EXISTS anchors (
      id TEXT PRIMARY KEY,
      label TEXT,
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      gps_lat REAL NOT NULL,
      gps_lng REAL NOT NULL,
      gps_accuracy REAL,
      gps_altitude REAL,
      heading REAL,
      imageRef TEXT,
      tags TEXT,
      isIndoor INTEGER DEFAULT 0
    )
  `);

  // Approach vectors table - GPS trails leading to anchors
  db.run(`
    CREATE TABLE IF NOT EXISTS approach_vectors (
      id TEXT PRIMARY KEY,
      anchorId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      waypoints TEXT NOT NULL,
      totalDistance REAL,
      avgHeading REAL,
      FOREIGN KEY (anchorId) REFERENCES anchors(id) ON DELETE CASCADE
    )
  `);

  // Magnetic fingerprints table - indoor magnetic signatures
  db.run(`
    CREATE TABLE IF NOT EXISTS magnetic_fingerprints (
      id TEXT PRIMARY KEY,
      anchorId TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL,
      magnitude REAL NOT NULL,
      vector_x REAL NOT NULL,
      vector_y REAL NOT NULL,
      vector_z REAL NOT NULL,
      inclination REAL,
      deviceOrientation TEXT,
      sampleCount INTEGER,
      FOREIGN KEY (anchorId) REFERENCES anchors(id) ON DELETE CASCADE
    )
  `);

  // AR objects table - directional anchors (sensor-driven, NOT vision-based)
  db.run(`
    CREATE TABLE IF NOT EXISTS ar_objects (
      id TEXT PRIMARY KEY,
      anchorId TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      createdAt TEXT NOT NULL,
      
      -- Spatial: Relative to Parent Anchor
      bearingFromAnchor REAL NOT NULL,    -- Degrees (0-360), direction from anchor to object
      distanceFromAnchor REAL,            -- Meters (approximate: 0.5, 1, 2, 5)
      elevationHint TEXT,                 -- 'floor', 'eye', 'overhead'
      
      -- Capture Context
      captureHeading REAL NOT NULL,       -- Device heading when placed (absolute degrees)
      captureGps_lat REAL NOT NULL,
      captureGps_lng REAL NOT NULL,
      
      -- Room Context
      roomLabel TEXT,                     -- User-provided: "Bedroom 2"
      placementHeading REAL,              -- Device heading at placement for directional hints
      
      -- Optional Visual Hint (NOT for matching, just reminder)
      referencePhoto TEXT,
      
      FOREIGN KEY (anchorId) REFERENCES anchors(id) ON DELETE CASCADE
    )
  `);

  // WiFi fingerprints table - indoor location signatures
  db.run(`
    CREATE TABLE IF NOT EXISTS wifi_fingerprints (
      id TEXT PRIMARY KEY,
      objectId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      networks TEXT NOT NULL,             -- JSON: [{ssid, bssid, rssi}, ...]
      roomLabel TEXT,                     -- User-provided room name
      FOREIGN KEY (objectId) REFERENCES ar_objects(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for foreign key lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_approach_vectors_anchorId ON approach_vectors(anchorId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_magnetic_fingerprints_anchorId ON magnetic_fingerprints(anchorId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ar_objects_anchorId ON ar_objects(anchorId)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_wifi_fingerprints_objectId ON wifi_fingerprints(objectId)`);
}
