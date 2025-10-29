# BabylonJS Large IFC PoC - Überarbeiteter Implementierungsplan

**Erstellt:** 2025-10-29
**Status:** In Arbeit - 30% abgeschlossen (3/10 Punkte)
**Strategie:** Single-File Optimierung → Multi-File Strategie → End-to-End Test

---

## Strategie-Änderung

### ❌ Alte Strategie
Phasenweise Implementierung nach dem ursprünglichen 10-Punkte-Plan:
- Phase 1: Quick Wins
- Phase 2: Strukturelle Optimierungen (mit Splitting)
- Phase 3: Progressive Loading
- Phase 4: Validierung

### ✅ Neue Strategie
**Single-File Optimierung zuerst, dann Multi-File:**

1. **Phase A: Single-File Optimierungen**
   - Alle Optimierungstechniken an EINEM GLB-File testen
   - Baseline etablieren und messbare Verbesserungen dokumentieren
   - Maximum Performance aus einem einzelnen File herausholen

2. **Phase B: Multi-File Strategie**
   - Erst DANACH: IFC-Splitting und Progressive Loading
   - Wenn Single-File optimiert ist, können wir Multi-File-Strategie aufbauen

3. **Phase C: End-to-End Validierung**
   - Finale Tests mit großen Dateien (3.5 GB)

**Vorteil:** Wir verstehen genau, welche Optimierungen wie viel bringen, bevor wir die Komplexität von Multi-File-Loading hinzufügen.

---

## Phase A: Single-File Optimierungen (Priorität 1)

### ✅ A1: Basis-Optimierungen (ABGESCHLOSSEN)

#### gltfpack Compression
**Status:** ✅ Abgeschlossen
**Ziel:** 50-70% Größenreduktion
**Erreicht:** 17x Kompression (38 MB → 2.2 MB)

**Ergebnisse:**
- Level 1 (-c): 2.3 MB, 16.47x
- Level 2 (-cc): 2.2 MB, 17.27x ⭐ EMPFOHLEN
- Level 3 (-cc -si 0.95): 425 KB, 89.88x (mit Geometrie-Vereinfachung)

**Files:**
- `test_gltfpack_compression.sh`
- `COMPRESSION_TEST_RESULTS.md`

#### BabylonJS SceneOptimizer
**Status:** ✅ Abgeschlossen
**Ziel:** 30 FPS Target erreichen
**Erreicht:** 30 FPS mit Auto-Optimierung

**Features:**
- Hardware Scaling (max 2x)
- Shadow Quality Reduction
- Post-Processing Toggle
- Texture Optimization
- Mesh Freezing (20-40% CPU Einsparung)

**Files:**
- `SCENE_OPTIMIZER_IMPLEMENTATION.md`
- `BabylonViewer.tsx:359-431`

---

### 🔧 A2: Baseline-Messung etablieren (NÄCHSTER SCHRITT)

**Ziel:** Quantifizierbare Baseline für alle weiteren Optimierungen

**Aufgaben:**
1. Test-Datei auswählen (500 MB - 1 GB IFC)
2. Konvertierung: IFC → GLB (Standard IfcConvert)
3. Systematische Messung OHNE Optimierungen:
   - Initial Load Time
   - FPS (Average, Min, Max)
   - Memory Usage (Heap, GPU)
   - Draw Calls
   - Active Meshes
   - Total Triangles
   - File Size

**Messungen durchführen:**
```bash
# 1. IFC zu GLB konvertieren (Baseline)
IfcConvert input.ifc baseline.glb

# 2. GLB im Viewer laden und Metriken aufzeichnen
# Performance Monitor ist bereits implementiert

# 3. Ergebnisse dokumentieren
```

**Erwartete Metriken-Tabelle:**
| Metrik | Baseline (Unoptimiert) | Nach Compression | Nach Instancing | Nach LOD | Nach Octree | Final |
|--------|----------------------|------------------|-----------------|----------|-------------|-------|
| File Size | X GB | ? | ? | ? | - | ? |
| Load Time | X s | ? | ? | ? | ? | ? |
| FPS | X | ? | ? | ? | ? | ? |
| Memory | X MB | ? | ? | ? | ? | ? |
| Draw Calls | X | ? | ? | ? | ? | ? |
| Triangles | X | ? | ? | ? | ? | ? |

**Output:**
- `BASELINE_MEASUREMENTS.md` - Dokumentation aller Baseline-Metriken
- Screenshot/Video der Performance

**Erfolgskriterium:**
- Alle Baseline-Metriken dokumentiert
- Vergleichbare Test-Datei für alle weiteren Optimierungen

**Geschätzte Zeit:** 2-3 Stunden

---

### 🔧 A3: glTF-Transform Instancing Pipeline

**Ziel:** 40-60% weitere Reduktion durch GPU Instancing

**Was ist Instancing?**
Wiederholte Objekte (Fenster, Türen, Möbel) werden nur EINMAL gespeichert und mehrfach instanziiert. Massive Einsparung bei Draw Calls und Memory.

**Installation:**
```bash
npm install -g @gltf-transform/cli
```

**Implementierung:**

1. **Test-Script erstellen** (`test_gltftransform_instancing.sh`):
```bash
#!/bin/bash

INPUT_FILE="compressed_level2_medium.glb"
OUTPUT_FILE="compressed_level2_instanced.glb"

echo "Running glTF-Transform Instancing..."
gltf-transform optimize "$INPUT_FILE" \
  --instance \
  --deduplicate \
  --prune \
  --compress \
  -o "$OUTPUT_FILE"

# Stats
echo "Original:  $(stat -c%s "$INPUT_FILE" | numfmt --to=iec-i --suffix=B)"
echo "Instanced: $(stat -c%s "$OUTPUT_FILE" | numfmt --to=iec-i --suffix=B)"
```

2. **Viewer-Integration:**
   - Neuer Test-Button: "Level 2 + Instancing"
   - Performance-Vergleich im UI

3. **Messungen:**
   - File Size Reduktion
   - Draw Calls Reduktion (erwartet: 50-80% weniger)
   - FPS Verbesserung
   - Memory Usage

**Erwartete Ergebnisse:**
- File Size: 2.2 MB → 1.0-1.5 MB (30-50% Reduktion)
- Draw Calls: 2,001 → 500-1,000 (50-75% Reduktion)
- FPS: 30 → 45-60 FPS
- Memory: 30-50% Reduktion bei identischen Meshes

**Output:**
- `test_gltftransform_instancing.sh`
- `INSTANCING_RESULTS.md`
- Button im Viewer: "Instanced (1.2 MB)"

**Erfolgskriterium:**
- Messbare Draw Call Reduktion
- FPS-Verbesserung dokumentiert
- File Size < 1.5 MB

**Geschätzte Zeit:** 3-4 Stunden

---

### 🔧 A4: LOD-System Implementation

**Ziel:** 30% Performance-Gewinn bei großen Szenen durch Distance-based Level of Detail

**Was ist LOD?**
Verschiedene Geometrie-Detailstufen basierend auf Kamera-Distanz:
- Nahe Objekte: Volle Details
- Mittlere Distanz: 50% Geometrie
- Weite Distanz: 25% Geometrie

**LOD-Generierung mit gltfpack:**

1. **LOD-Varianten erstellen:**
```bash
#!/bin/bash
# test_lod_generation.sh

INPUT="compressed_level2_instanced.glb"

# LOD0: Original (High Detail, 0-10m)
cp "$INPUT" "model_lod0.glb"

# LOD1: 50% Simplification (Medium Detail, 10-30m)
gltfpack -i "$INPUT" -o "model_lod1.glb" -si 0.5 -cc

# LOD2: 75% Simplification (Low Detail, >30m)
gltfpack -i "$INPUT" -o "model_lod2.glb" -si 0.25 -cc

echo "LOD0 (High):   $(stat -c%s "model_lod0.glb" | numfmt --to=iec-i --suffix=B)"
echo "LOD1 (Medium): $(stat -c%s "model_lod1.glb" | numfmt --to=iec-i --suffix=B)"
echo "LOD2 (Low):    $(stat -c%s "model_lod2.glb" | numfmt --to=iec-i --suffix=B)"
```

2. **BabylonJS LOD-Integration:**

```typescript
// BabylonViewer.tsx - LOD Implementation

interface LODLevel {
  distance: number;
  meshes: AbstractMesh[];
}

const loadModelWithLOD = async () => {
  // Load all LOD levels
  const lod0 = await SceneLoader.ImportMeshAsync('', '/models/', 'model_lod0.glb', scene);
  const lod1 = await SceneLoader.ImportMeshAsync('', '/models/', 'model_lod1.glb', scene);
  const lod2 = await SceneLoader.ImportMeshAsync('', '/models/', 'model_lod2.glb', scene);

  // Setup LOD for each mesh group
  const rootMesh = lod0.meshes[0];

  // BabylonJS automatic LOD
  lod1.meshes.forEach(mesh => {
    rootMesh.addLODLevel(10, mesh); // Switch at 10m
  });

  lod2.meshes.forEach(mesh => {
    rootMesh.addLODLevel(30, mesh); // Switch at 30m
  });

  // Hide lower LODs initially
  lod1.meshes.forEach(m => m.setEnabled(false));
  lod2.meshes.forEach(m => m.setEnabled(false));
};
```

3. **UI-Controls:**
   - Toggle: "Enable LOD System"
   - Debug Overlay: Current LOD Level anzeigen
   - Distanz-Threshold Controls (optional)

**Messungen:**
- FPS bei verschiedenen Kamera-Distanzen
- Memory Usage (alle LODs geladen)
- LOD-Switch Performance (Frame Drops?)
- Visuelle Qualität bei verschiedenen Distanzen

**Erwartete Ergebnisse:**
- FPS bei weiter Distanz: +50-80% (nur LOD2 aktiv)
- Memory: +20-30% (3 LOD Levels geladen)
- Visuelle Qualität: Keine merkbaren Unterschiede > 10m

**Output:**
- `test_lod_generation.sh`
- `LOD_IMPLEMENTATION.md`
- UI Toggle im Viewer
- 3 GLB Files (LOD0, LOD1, LOD2)

**Erfolgskriterium:**
- Automatisches LOD-Switching funktioniert
- FPS-Verbesserung messbar
- Keine sichtbaren "Pop-In" Artefakte

**Geschätzte Zeit:** 6-8 Stunden

---

### 🔧 A5: Frustum Culling + OctTree

**Ziel:** Nur sichtbare Objekte rendern, Rest cullen

**Was ist Frustum Culling?**
Objekte außerhalb des Kamera-Sichtfelds (Frustum) werden nicht gerendert. OctTree beschleunigt die Sichtbarkeits-Tests massiv.

**Implementation:**

1. **OctTree Setup:**
```typescript
// BabylonViewer.tsx - OctTree Implementation

const setupOctree = () => {
  if (!sceneRef.current) return;

  console.log('Creating OctTree...');

  // Create or update octree
  // Parameters: maxCapacity, maxDepth
  sceneRef.current.createOrUpdateSelectionOctree(256, 2);

  console.log('OctTree created successfully');
};

// Call after model load
const handleModelLoaded = (meshes: AbstractMesh[]) => {
  // ... existing code ...

  // Setup octree for fast culling
  setupOctree();

  // Optional: Freeze active meshes for static scenes
  // sceneRef.current.freezeActiveMeshes();
};
```

2. **Culling Optimizations:**
```typescript
// Enable aggressive culling
scene.autoClear = false; // Don't clear every frame
scene.autoClearDepthAndStencil = false;

// For static models: freeze active meshes
scene.freezeActiveMeshes(); // AFTER octree creation

// Unfreeze when camera moves significantly
camera.onViewMatrixChangedObservable.add(() => {
  if (cameraMovedSignificantly()) {
    scene.unfreezeActiveMeshes();
    // Re-freeze after render
    scene.registerAfterRender(() => {
      scene.freezeActiveMeshes();
    });
  }
});
```

3. **UI Controls:**
   - Toggle: "Enable OctTree Culling"
   - Debug Overlay:
     - Active Meshes (rendered)
     - Total Meshes
     - Culling Efficiency (%)

4. **Performance Monitor Enhancement:**
```typescript
// Add to PerformanceMonitor.tsx
const activeMeshes = scene.getActiveMeshes().length;
const totalMeshes = scene.meshes.length;
const cullingEfficiency = ((totalMeshes - activeMeshes) / totalMeshes * 100).toFixed(1);

// Display
<div>Active Meshes: {activeMeshes} / {totalMeshes} ({cullingEfficiency}% culled)</div>
```

**Messungen:**
- FPS mit vs. ohne Octree
- Active Meshes bei verschiedenen Kamera-Winkeln
- Culling Efficiency (% nicht gerenderte Meshes)
- Frame Time Reduktion

**Erwartete Ergebnisse:**
- FPS: +20-40% bei komplexen Szenen
- Active Meshes: 30-50% des Totals (abhängig von Kamera-Position)
- Frame Time: -15-25% bei großen Modellen

**Output:**
- `OCTREE_CULLING_IMPLEMENTATION.md`
- UI Toggle + Debug Overlay
- Performance-Vergleich dokumentiert

**Erfolgskriterium:**
- OctTree wird korrekt erstellt
- Culling funktioniert (Active Meshes < Total Meshes)
- FPS-Verbesserung messbar

**Geschätzte Zeit:** 4-6 Stunden

---

### 🔧 A6: Properties-DB Integration

**Ziel:** IFC-Semantik erhalten und abrufbar machen

**Architektur:**
```
IFC File
  ↓ (IfcOpenShell)
Properties Extraction
  ↓
PostgreSQL Database
  ↑ (REST API)
BabylonViewer
  ↓ (Click Event)
Property Panel UI
```

**Implementation Steps:**

#### 1. Properties Extraction (Python)
```python
# extract_ifc_properties.py

import ifcopenshell
import psycopg2
import json

def extract_properties(ifc_path):
    """Extract all IFC properties to JSON"""
    ifc = ifcopenshell.open(ifc_path)
    properties = {}

    for product in ifc.by_type("IfcProduct"):
        global_id = product.GlobalId
        properties[global_id] = {
            'name': product.Name,
            'type': product.is_a(),
            'properties': {}
        }

        # Get property sets
        for rel in product.IsDefinedBy:
            if rel.is_a("IfcRelDefinesByProperties"):
                pset = rel.RelatingPropertyDefinition
                if pset.is_a("IfcPropertySet"):
                    for prop in pset.HasProperties:
                        if prop.is_a("IfcPropertySingleValue"):
                            properties[global_id]['properties'][prop.Name] = str(prop.NominalValue)

    return properties

def save_to_postgres(properties, conn_string):
    """Save properties to PostgreSQL"""
    conn = psycopg2.connect(conn_string)
    cur = conn.cursor()

    # Create table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS ifc_properties (
            global_id VARCHAR(22) PRIMARY KEY,
            name TEXT,
            ifc_type TEXT,
            properties JSONB
        )
    """)

    # Insert properties
    for global_id, data in properties.items():
        cur.execute("""
            INSERT INTO ifc_properties (global_id, name, ifc_type, properties)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (global_id) DO UPDATE SET
                name = EXCLUDED.name,
                ifc_type = EXCLUDED.ifc_type,
                properties = EXCLUDED.properties
        """, (global_id, data['name'], data['type'], json.dumps(data['properties'])))

    conn.commit()
    conn.close()
```

#### 2. GlobalID Mapping (IfcConvert)
```bash
# During GLB conversion, preserve GlobalID as metadata
# IfcConvert should maintain GlobalID in GLB node names or metadata

# Mapping: GLB Node Name → IFC GlobalID
# Example: "IfcWall_0AbCdEfGhIjKlMnOpQrSt" → "0AbCdEfGhIjKlMnOpQrSt"
```

#### 3. Properties API (Node.js/Express)
```typescript
// properties-api/server.ts

import express from 'express';
import { Pool } from 'pg';

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Get properties by GlobalID
app.get('/api/properties/:globalId', async (req, res) => {
  const { globalId } = req.params;
  const result = await pool.query(
    'SELECT * FROM ifc_properties WHERE global_id = $1',
    [globalId]
  );
  res.json(result.rows[0] || null);
});

app.listen(3001, () => console.log('Properties API listening on :3001'));
```

#### 4. Viewer Integration
```typescript
// BabylonViewer.tsx - Property Click Handler

const [selectedProperties, setSelectedProperties] = useState<any>(null);

const setupClickHandler = () => {
  if (!sceneRef.current) return;

  sceneRef.current.onPointerDown = async (evt, pickInfo) => {
    if (pickInfo.hit && pickInfo.pickedMesh) {
      const meshName = pickInfo.pickedMesh.name;

      // Extract GlobalID from mesh name
      // Example: "IfcWall_0AbCdEfGhIjKlMnOpQrSt" → "0AbCdEfGhIjKlMnOpQrSt"
      const globalIdMatch = meshName.match(/[0-9A-Za-z_]{22}$/);

      if (globalIdMatch) {
        const globalId = globalIdMatch[0];

        // Fetch properties from API
        try {
          const response = await fetch(`http://localhost:3001/api/properties/${globalId}`);
          const properties = await response.json();
          setSelectedProperties(properties);
        } catch (error) {
          console.error('Error fetching properties:', error);
        }
      }
    }
  };
};
```

#### 5. Property Panel UI
```typescript
// PropertyPanel.tsx

interface PropertyPanelProps {
  properties: any;
  onClose: () => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({ properties, onClose }) => {
  if (!properties) return null;

  return (
    <div style={{
      position: 'absolute',
      right: '20px',
      top: '20px',
      background: 'rgba(30, 30, 30, 0.95)',
      padding: '20px',
      borderRadius: '8px',
      maxWidth: '400px',
      maxHeight: '80vh',
      overflow: 'auto'
    }}>
      <h3>{properties.name}</h3>
      <p><strong>Type:</strong> {properties.ifc_type}</p>

      <h4>Properties:</h4>
      <table>
        {Object.entries(properties.properties).map(([key, value]) => (
          <tr key={key}>
            <td><strong>{key}:</strong></td>
            <td>{value}</td>
          </tr>
        ))}
      </table>

      <button onClick={onClose}>Close</button>
    </div>
  );
};
```

**Messungen:**
- Property Lookup Zeit (< 100ms)
- Database Size
- API Response Time
- GlobalID Mapping Accuracy (%)

**Erwartete Ergebnisse:**
- Properties abrufbar per Click
- < 100ms Latenz für Property Fetch
- 100% GlobalID Mapping (alle Meshes identifizierbar)

**Output:**
- `extract_ifc_properties.py`
- `properties-api/` (Node.js Server)
- `PropertyPanel.tsx`
- `PROPERTIES_DB_INTEGRATION.md`
- PostgreSQL Schema

**Erfolgskriterium:**
- Click auf Mesh → Properties werden angezeigt
- IFC-Semantik vollständig erhalten
- Schnelle Property-Abfrage

**Geschätzte Zeit:** 8-12 Stunden

---

## Phase B: Multi-File Strategie (Priorität 2)

**Startet erst NACHDEM Phase A komplett abgeschlossen ist.**

### 🔧 B1: IFC Geschoss-Splitting Validierung

**Status:** Script vorhanden (`split_ifc_by_storey.py`), nicht getestet

**Aufgaben:**
1. Test-IFC-Datei beschaffen (500 MB - 1 GB, mehrere Geschosse)
2. Splitting durchführen:
```bash
python split_ifc_by_storey.py large_building.ifc -o output/storeys/
```
3. Validierung der Ausgabe:
   - Anzahl Geschoss-IFCs korrekt?
   - Dependencies vollständig?
   - Dateigrößen plausibel?

4. Konvertierung zu GLB:
```bash
for ifc in output/storeys/*.ifc; do
  IfcConvert "$ifc" "${ifc%.ifc}.glb"
done
```

5. Kompression mit gltfpack:
```bash
for glb in output/storeys/*.glb; do
  gltfpack -i "$glb" -o "${glb%.glb}_compressed.glb" -cc
done
```

6. Optional: Instancing:
```bash
for glb in output/storeys/*_compressed.glb; do
  gltf-transform optimize "$glb" --instance -o "${glb%.glb}_instanced.glb"
done
```

**Output:**
- Geschoss-IFC Files
- Geschoss-GLB Files (komprimiert + instanced)
- Validierungs-Report

**Erfolgskriterium:**
- Alle Geschosse korrekt extrahiert
- GLB-Konvertierung erfolgreich
- Gesamt-Dateigröße < Original

**Geschätzte Zeit:** 4-6 Stunden

---

### 🔧 B2: Multi-File Loading Strategy

**Ziel:** Initial Load < 10 Sekunden

**Loading-Strategie:**

1. **Priority-basiertes Loading:**
```typescript
// LoadingManager.tsx

interface LoadingPriority {
  priority: number;
  files: string[];
  onComplete?: () => void;
}

const loadingQueue: LoadingPriority[] = [
  {
    priority: 1, // IMMEDIATE
    files: ['building_shell.glb', 'floor_ground.glb']
  },
  {
    priority: 2, // BACKGROUND
    files: ['floor_1.glb', 'floor_-1.glb'] // Adjacent floors
  },
  {
    priority: 3, // ON-DEMAND
    files: ['floor_2.glb', 'floor_3.glb', ...] // Rest
  }
];
```

2. **Progressive Loading Implementation:**
```typescript
const loadModelProgressive = async () => {
  // Phase 1: Critical (immediate)
  await loadPriority1Files(); // Building shell + current floor
  setInitialLoadComplete(true); // User can now interact

  // Phase 2: Background (async)
  loadPriority2FilesInBackground(); // Adjacent floors

  // Phase 3: On-Demand (lazy)
  // Load when user navigates to that floor
};
```

3. **Floor Visibility Management:**
```typescript
interface FloorContainer {
  name: string;
  meshes: AbstractMesh[];
  visible: boolean;
  loaded: boolean;
}

const floors: FloorContainer[] = [];

const setFloorVisibility = (floorIndex: number, visible: boolean) => {
  if (!floors[floorIndex].loaded && visible) {
    // Lazy load floor
    loadFloor(floorIndex);
  }

  floors[floorIndex].meshes.forEach(mesh => {
    mesh.setEnabled(visible);
  });
};
```

4. **UI Controls:**
   - Floor Selector (Dropdown or Slider)
   - "Show All Floors" Toggle
   - Loading Progress per Floor
   - Memory Usage per Floor

**Messungen:**
- Initial Load Time (Priority 1 only)
- Total Load Time (all floors)
- FPS with 1 floor vs. all floors visible
- Memory per floor
- Floor switching time

**Erwartete Ergebnisse:**
- Initial Load: < 10 Sekunden
- Floor Switch: < 2 Sekunden
- Memory: Linear scaling pro Geschoss

**Output:**
- `LoadingManager.tsx`
- `FloorSelector.tsx`
- `MULTI_FILE_LOADING.md`

**Erfolgskriterium:**
- Initial Load < 10s
- Smooth floor switching
- Memory usage under control

**Geschätzte Zeit:** 10-12 Stunden

---

## Phase C: End-to-End Validierung (Priorität 3)

### 🔧 C1: End-to-End Test mit 3.5 GB File

**Ziel:** Vollständiger Pipeline-Test

**Pipeline:**
```
3.5 GB IFC File
  ↓
[IFC Splitting]
  ↓
10-15 Geschoss-IFCs (200-300 MB each)
  ↓
[IfcConvert]
  ↓
10-15 GLBs (uncompressed)
  ↓
[gltfpack -cc]
  ↓
10-15 Compressed GLBs (10-20 MB each)
  ↓
[gltf-transform --instance]
  ↓
10-15 Instanced GLBs (5-10 MB each)
  ↓
[LOD Generation]
  ↓
30-45 GLBs (3 LOD levels × 10-15 floors)
  ↓
[BabylonViewer Multi-File Loading]
```

**Erfolgskriterien:**
| Metrik | Baseline | Ziel | Gemessen | Status |
|--------|----------|------|----------|--------|
| File Size | 3.5 GB | < 500 MB | ? | ❌ |
| Initial Load | > 120s | < 15s | ? | ❌ |
| FPS | < 10 | > 30 | ? | ❌ |
| Memory | > 8 GB | < 4 GB | ? | ❌ |
| Properties | - | Verfügbar | ? | ❌ |

**Test-Ablauf:**
1. Pipeline durchlaufen (dokumentieren)
2. Metriken messen
3. Vergleich mit Baseline
4. Identifikation von Bottlenecks
5. Weitere Optimierung falls nötig

**Output:**
- `END_TO_END_TEST_RESULTS.md`
- Video/Screenshots
- Performance-Report
- Lessons Learned

**Erfolgskriterium:**
- Alle Metriken im Ziel-Bereich
- Pipeline reproduzierbar
- Dokumentation vollständig

**Geschätzte Zeit:** 12-16 Stunden

---

## Zeitplan

### Gesamt-Übersicht
| Phase | Punkte | Geschätzte Zeit | Status |
|-------|--------|-----------------|--------|
| **Phase A** | 6 Punkte | 35-45 Stunden | 🔄 In Arbeit (2/6) |
| **Phase B** | 2 Punkte | 14-18 Stunden | ❌ Nicht begonnen |
| **Phase C** | 1 Punkt | 12-16 Stunden | ❌ Nicht begonnen |
| **TOTAL** | 9 Punkte | **61-79 Stunden** | **~30% abgeschlossen** |

### Phase A: Single-File Optimierungen (35-45h)
- ✅ A1: Basis-Optimierungen (8h) - **ABGESCHLOSSEN**
- 🔧 A2: Baseline-Messung (2-3h) - **NÄCHSTER SCHRITT**
- ⏳ A3: glTF-Transform Instancing (3-4h)
- ⏳ A4: LOD-System (6-8h)
- ⏳ A5: Frustum Culling + OctTree (4-6h)
- ⏳ A6: Properties-DB Integration (8-12h)

### Phase B: Multi-File Strategie (14-18h)
- ⏳ B1: IFC Geschoss-Splitting (4-6h)
- ⏳ B2: Multi-File Loading (10-12h)

### Phase C: End-to-End Validierung (12-16h)
- ⏳ C1: End-to-End Test (12-16h)

**Realistischer Zeitrahmen:** 2-3 Wochen (bei 20-30h/Woche)

---

## Erfolgsmessung

### Phase A: Single-File Ziele
| Optimierung | Metrik | Baseline | Ziel | Priorität |
|-------------|--------|----------|------|-----------|
| Compression | File Size | 38 MB | < 5 MB | ✅ Erreicht (2.2 MB) |
| Instancing | Draw Calls | 2,001 | < 1,000 | 🔧 Ausstehend |
| LOD System | FPS (distant) | 30 | > 50 | 🔧 Ausstehend |
| Octree | Active Meshes | 100% | < 50% | 🔧 Ausstehend |
| Properties | Lookup Time | - | < 100ms | 🔧 Ausstehend |

### Phase B: Multi-File Ziele
| Metrik | Einzeln | Multi-File Ziel |
|--------|---------|-----------------|
| Initial Load | 5s | < 10s (nur 1-2 Geschosse) |
| Total Load | - | < 60s (alle Geschosse background) |
| Floor Switch | - | < 2s |
| Memory per Floor | - | < 400 MB |

### Phase C: End-to-End Ziele
| Metrik | Original | Ziel | Kritisch? |
|--------|----------|------|-----------|
| File Size | 3.5 GB | < 500 MB | ✅ Ja |
| Initial Load | > 120s | < 15s | ✅ Ja |
| FPS | < 10 | > 30 | ✅ Ja |
| Memory | > 8 GB | < 4 GB | ⚠️ Wichtig |
| Properties | - | Verfügbar | ⚠️ Nice-to-have |

---

## Risiken & Mitigation

### Phase A Risiken
| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Instancing funktioniert nicht gut | Niedrig | Mittel | Alternative: Manuelle Instancing-Logik |
| LOD Pop-In zu sichtbar | Mittel | Niedrig | LOD-Distanzen tunen, Blending |
| Properties-Mapping komplex | Mittel | Mittel | Simplified mapping, nur kritische Props |

### Phase B Risiken
| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| IFC Splitting verliert Daten | Mittel | Hoch | Validierung mit original IFC vergleichen |
| Multi-File Loading zu langsam | Niedrig | Mittel | Web Workers, besseres Caching |

### Phase C Risiken
| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| 3.5 GB File nicht verfügbar | Mittel | Hoch | Synthetisches Test-File generieren |
| Performance-Ziele nicht erreichbar | Niedrig | Hoch | Weitere Optimierungen, LOD aggressiver |

---

## Nächste Aktionen (in Reihenfolge)

### Sofort (diese Woche)
1. ✅ Plan dokumentieren - **ABGESCHLOSSEN**
2. 🔧 A2: Baseline-Messung durchführen - **NÄCHSTER SCHRITT**
3. 🔧 A3: glTF-Transform Instancing implementieren

### Nächste Woche
4. A4: LOD-System implementieren
5. A5: Frustum Culling + OctTree
6. A6: Properties-DB Integration (Start)

### Übernächste Woche
7. A6: Properties-DB Integration (Abschluss)
8. B1: IFC Splitting validieren
9. B2: Multi-File Loading implementieren

### Finale Woche
10. C1: End-to-End Test
11. Dokumentation finalisieren
12. Präsentation vorbereiten

---

## Zusammenfassung

### ✅ Was ist neu?
- **Fokus auf Single-File Optimierung zuerst**
- Multi-File-Strategie erst nach bewährten Optimierungen
- Klare Metriken und Erfolgskriterien
- Realistische Zeitschätzungen

### 🎯 Warum diese Strategie?
1. **Verstehen**: Welche Optimierung bringt wie viel?
2. **Isolieren**: Probleme pro Optimierung identifizieren
3. **Validieren**: Messbare Erfolge dokumentieren
4. **Kombinieren**: Erst dann Multi-File-Komplexität hinzufügen

### 📊 Erwartete Gesamt-Ergebnisse
Wenn alles nach Plan läuft:
- **File Size**: 3.5 GB → 150-300 MB (10-20x Reduktion)
- **Initial Load**: 120s → < 10s (12x schneller)
- **FPS**: 10 → 30+ (3x besser)
- **Memory**: 8 GB → 2-3 GB (60-70% Reduktion)

**Status:** Ready to continue with A2 (Baseline-Messung)

---

**Dokument-Ende**
