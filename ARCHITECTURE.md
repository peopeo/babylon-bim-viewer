# Babylon BIM Viewer - Complete Architecture Overview

**Version:** Refactored Service Layer Architecture
**Date:** 2025-10-31
**Repository:** https://github.com/peopeo/babylon-bim-viewer

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Backend Architecture](#backend-architecture)
3. [Frontend Architecture](#frontend-architecture)
4. [Data Flow Pipeline](#data-flow-pipeline)
5. [Design Patterns](#design-patterns)
6. [Performance Characteristics](#performance-characteristics)
7. [Technology Stack](#technology-stack)

---

## System Overview

The Babylon BIM Viewer is a **full-stack web application** for visualizing Building Information Modeling (BIM) data in 3D using web technologies. The system transforms massive IFC files (3+ GB) into optimized web-ready GLB files (20-40 MB) and renders them using WebGPU/WebGL.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                          │
│  - Drop IFC file or GLB file                                │
│  - Select meshes, view properties                           │
│  - Navigate 3D scene with camera controls                   │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  FRONTEND (React + Babylon.js)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ UI Layer (React Components)                          │   │
│  │  - BabylonViewer.tsx, PerformanceMonitor.tsx        │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       ↓                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Service Layer (Business Logic)                       │   │
│  │  - EngineFactory, SceneManager, ModelLoaderFactory  │   │
│  │  - CameraController, ResourceDisposer               │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       ↓                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Core Interfaces (Abstractions)                       │   │
│  │  - IEngine, ISceneManager, IModelLoader             │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       ↓                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Babylon.js Rendering Engine                          │   │
│  │  - WebGPU / WebGL                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                  GLB FILE (Optimized 3D Model)               │
│  - 20-40 MB compressed GLB                                  │
│  - WebGPU-ready format                                      │
│  - PBR materials, GPU instancing                            │
└──────────────────────┬──────────────────────────────────────┘
                       ↑
┌─────────────────────────────────────────────────────────────┐
│            BACKEND (Python + C++ + Node.js)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Python Scripts (Orchestration)                       │   │
│  │  - smart_convert_ifc_to_glb.py                      │   │
│  │  - split_ifc_by_storey.py                           │   │
│  │  - inspect_ifc.py, inspect_glb.py                   │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       ↓                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ IfcConvert (C++ Binary)                              │   │
│  │  - IFC → GLB conversion                              │   │
│  │  - Geometry tessellation                             │   │
│  │  - Coordinate system handling                        │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       ↓                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ gltfpack (C++ Binary)                                │   │
│  │  - Mesh quantization                                 │   │
│  │  - Binary compression (meshopt)                      │   │
│  │  - Material deduplication                            │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       ↓                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ gltf-transform (Node.js)                             │   │
│  │  - GPU instancing                                    │   │
│  │  - Mesh deduplication                                │   │
│  │  - Advanced optimizations                            │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       ↑
┌─────────────────────────────────────────────────────────────┐
│                    IFC FILE (Source Data)                    │
│  - 3+ GB industry standard BIM format                       │
│  - Contains geometry, materials, metadata                   │
│  - May use local or GPS coordinates                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture

### Purpose
Transform massive IFC BIM files into web-optimized GLB files suitable for real-time 3D visualization in browsers.

### Core Components

#### 1. Python Orchestration Layer

##### **smart_convert_ifc_to_glb.py** (234 lines)
**Purpose:** Intelligent IFC to GLB converter with automatic coordinate system detection

**Key Features:**
- Auto-detects whether IFC uses local (project) or GPS (map) coordinates
- Applies `--center-model-geometry` only for GPS-coordinated models
- Prevents WebGL precision issues with large coordinate values

**Detection Strategy:**
1. Check for `IfcMapConversion` (IFC4) or `ePSet_MapConversion` (IFC2X3)
2. Check `IfcSite` GPS coordinates (Latitude/Longitude)
3. Check World Coordinate System as supplementary

**Usage:**
```bash
~/anaconda3/envs/bim/bin/python smart_convert_ifc_to_glb.py building.ifc -o output.glb
```

**Why Critical:**
- WebGL uses 32-bit floats (precision issues beyond ±16M units)
- GPS coordinates (millions of units) MUST be centered
- Local coordinates (±500 units) MUST NOT be centered
- Wrong choice causes invisible models or corrupted bounding boxes

##### **split_ifc_by_storey.py** (297 lines)
**Purpose:** Ultra-fast IFC file splitter by building storey

**Key Features:**
- Pre-built lookup tables for instant relationship queries
- Preserves spatial hierarchy
- Enables progressive loading strategies

**Use Cases:**
- Split 100-storey building into 100 separate IFC files
- Load only visible storeys for better performance
- Reduce initial load time for massive buildings

##### **inspect_ifc.py** (152 lines)
**Purpose:** Analyze IFC file structure and coordinate system

**Outputs:**
- IFC schema version
- Element counts by type (walls, slabs, windows, etc.)
- GPS coordinates (if present)
- Geometry extents and coordinate system

##### **inspect_glb.py** (122 lines)
**Purpose:** Analyze GLB file structure

**Outputs:**
- Mesh counts, material counts
- Vertex/face statistics
- Coordinate bounds
- Extension usage

##### **compare_glb.py** (161 lines)
**Purpose:** Deep comparison of two GLB files

**Use Cases:**
- Validate optimization doesn't corrupt geometry
- Compare different optimization strategies
- Debug coordinate system transformations

#### 2. IfcConvert (C++ Binary)

**Location:** `/home/peo/pogonal/labor/react/babylon-bim-viewer/IfcConvert`
**Source:** IfcOpenShell project (https://ifcopenshell.org)
**Language:** C++ (high-performance)

**Responsibilities:**
- Parse IFC file structure (STEP format)
- Extract building element geometry
- Tessellate curved surfaces into triangles
- Convert materials and colors
- Export as GLB (binary glTF)

**Key Flag:**
- `--center-model-geometry` - Moves all geometry to world origin

**Performance:**
- ~200 MB/minute for IFC conversion
- Multi-threaded geometry processing

**Example:**
```bash
./IfcConvert --center-model-geometry input.ifc output.glb
```

#### 3. gltfpack (C++ Binary)

**Location:** `/home/peo/pogonal/labor/react/babylon-bim-viewer/gltfpack`
**Source:** meshoptimizer project (https://github.com/zeux/meshoptimizer)
**Language:** C++

**Responsibilities:**
- Mesh quantization (float32 → int16 for positions)
- Binary compression (meshopt codec)
- Material deduplication
- Unused resource pruning
- Vertex welding

**Key Flags:**
- `-c` - Basic compression
- `-cc` - Higher compression (recommended)
- `-si <ratio>` - Mesh simplification (0.0-1.0)
- `-v` - Verbose output

**Performance:**
- ~110 MB/second for compression
- Typical compression ratio: 15-20x

**Example:**
```bash
gltfpack -i input.glb -o output.glb -cc -v
```

**Extensions Generated:**
- `KHR_mesh_quantization` - Reduced vertex precision
- `EXT_meshopt_compression` - Binary compression

#### 4. gltf-transform (Node.js Tool)

**Location:** `node_modules/.bin/gltf-transform`
**Source:** glTF-Transform project (https://gltf-transform.donmccurdy.com)
**Language:** JavaScript/TypeScript

**Responsibilities:**
- GPU instancing (detect repeated geometries)
- Mesh deduplication
- Material palette optimization
- Vertex welding
- Mesh joining (optional, disabled for BIM)

**Key Flags:**
```bash
gltf-transform optimize input.glb output.glb \
  --instance true \           # Enable GPU instancing
  --instance-min 2 \          # Minimum 2 instances to batch
  --compress meshopt \        # Use meshopt compression
  --join false \              # CRITICAL: Preserve individual meshes for BIM
  --weld true \               # Merge duplicate vertices
  --prune true                # Remove unused resources
```

**Why `--join false` is Critical:**
- BIM requires individual element selection (click wall → show properties)
- Mesh joining merges multiple elements into one mesh
- Preserving individual meshes enables IFC GUID → mesh mapping
- Trade-off: Slightly larger file size but maintains functionality

**Performance:**
- ~0.8 MB/second (slower due to complex analysis)
- Typical compression ratio: 1.5x

**Extensions Generated:**
- `EXT_mesh_gpu_instancing` - Shared geometry with transforms

#### 5. Shell Scripts

##### **test_gltfpack_compression.sh** (64 lines)
Tests 3 compression levels:
1. Level 1 (Low): `-c` - Fast, basic optimization
2. Level 2 (Medium): `-cc` - Balanced (recommended)
3. Level 3 (High): `-cc -si 0.95` - Aggressive with 5% mesh simplification

##### **test_gltftransform_instancing.sh** (89 lines)
Applies GPU instancing optimization to compressed GLB files.

### Backend Data Flow Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ IFC File (3.3 GB)                                            │
│  - Industry standard BIM format                             │
│  - Contains geometry, materials, metadata                   │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Python Orchestration                                 │
│  smart_convert_ifc_to_glb.py                                │
│  - Detects coordinate system (local vs GPS)                 │
│  - Decides whether to center geometry                       │
│  - Invokes IfcConvert with appropriate flags                │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: IfcConvert (C++)                                     │
│  ./IfcConvert [--center-model-geometry] input.ifc output.glb│
│  - Parses IFC structure                                     │
│  - Tessellates geometry                                     │
│  - Converts materials                                       │
│  Time: 2-33 minutes (depending on size)                     │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ GLB Baseline (630 MB)                                        │
│  - 5.2x compression from IFC                                │
│  - Unoptimized float32 vertices                             │
│  - Uncompressed binary data                                 │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: gltfpack (C++)                                       │
│  gltfpack -i input.glb -o output.glb -cc                    │
│  - Quantizes vertices (float32 → int16)                     │
│  - Compresses binary data (meshopt codec)                   │
│  - Deduplicates materials                                   │
│  Time: 5-10 seconds                                         │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ GLB Compressed (34 MB)                                       │
│  - 18.5x compression from baseline                          │
│  - KHR_mesh_quantization extension                          │
│  - EXT_meshopt_compression extension                        │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: gltf-transform (Node.js) [OPTIONAL]                 │
│  gltf-transform optimize input.glb output.glb --instance    │
│  - Detects repeated geometries                              │
│  - Creates GPU instancing batches                           │
│  - Further optimizations                                    │
│  Time: 40-60 seconds                                        │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ GLB Final (23 MB)                                            │
│  - 143x total compression from original IFC                 │
│  - EXT_mesh_gpu_instancing extension                        │
│  - Ready for web delivery                                   │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ DEPLOYED: public/models/                                     │
│  - Served via Vite dev server or static hosting             │
│  - Loaded by frontend via drag-and-drop or URL              │
└─────────────────────────────────────────────────────────────┘
```

### Backend Performance Benchmarks

#### Bilton Model (3.3 GB IFC → 23 MB GLB)

| Stage | Input | Output | Ratio | Time | Speed |
|-------|-------|--------|-------|------|-------|
| IFC → GLB | 3,300 MB | 630 MB | 5.2x | 16m 25s | 200 MB/min |
| GLB → Compressed | 630 MB | 34 MB | 18.5x | 5.7s | 110 MB/s |
| Compressed → Instanced | 34 MB | 23 MB | 1.5x | 43.6s | 0.8 MB/s |
| **TOTAL** | **3,300 MB** | **23 MB** | **143x** | **17m 14s** | - |

**Key Results:**
- 2,597 instance batches created from 29,081 instances
- 70-95% draw call reduction
- Individual mesh identity preserved for BIM element selection

---

## Frontend Architecture

### Purpose
Render optimized GLB files in real-time 3D using WebGPU/WebGL with professional BIM viewer features.

### Core Layers

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: React Components (UI)                              │
│  - BabylonViewer.tsx (890 lines) - Main viewer component   │
│  - PerformanceMonitor.tsx - FPS and metrics display        │
│  - App.tsx - Root application component                    │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Service Layer (Business Logic)                     │
│  - EngineFactory - Create WebGPU/WebGL engines             │
│  - SceneManager - Scene lifecycle management                │
│  - ModelLoaderFactory - Create appropriate loaders          │
│  - FileModelLoader - Load GLB from File objects            │
│  - CameraController - Camera manipulation                   │
│  - ResourceDisposer - Memory cleanup                        │
│  - MaterialLibrary - PBR material management                │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: Core Interfaces (Abstractions)                     │
│  - IEngine - Unified engine interface                       │
│  - ISceneManager - Scene management contract                │
│  - IModelLoader - Model loading strategies                  │
│  - SceneContext - Scene object bundle                       │
│  - ModelSource - Loading source types                       │
│  - LoadedModel - Loading result                             │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: Configuration (Single Source of Truth)             │
│  - viewer.config.ts (694 lines) - All settings documented  │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ LAYER 5: Babylon.js (3D Engine)                             │
│  - WebGPU / WebGL rendering                                 │
│  - Scene graph management                                   │
│  - Material system, shadows, post-processing                │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/
├── components/              # React UI Components
│   ├── BabylonViewer.tsx   # Main viewer (890 lines)
│   ├── PerformanceMonitor.tsx
│   ├── App.tsx
│   ├── BabylonViewer.config.ts
│   ├── BabylonViewer.styles.ts
│   └── BabylonViewer.types.ts
│
├── services/                # Service Layer (Business Logic)
│   ├── engine/
│   │   ├── EngineFactory.ts      # Create WebGPU/WebGL engines
│   │   ├── EngineAdapter.ts      # Wrap engines with IEngine
│   │   └── index.ts
│   ├── scene/
│   │   ├── SceneFactory.ts       # Create complete scenes
│   │   ├── SceneManager.ts       # Scene lifecycle management
│   │   └── index.ts
│   ├── model/
│   │   ├── FileModelLoader.ts    # Load from File objects
│   │   ├── ModelLoaderFactory.ts # Create appropriate loader
│   │   └── index.ts
│   ├── camera/
│   │   ├── CameraController.ts   # Camera manipulation
│   │   └── index.ts
│   ├── cleanup/
│   │   ├── ResourceDisposer.ts   # Memory management
│   │   └── index.ts
│   └── index.ts
│
├── core/                    # Core Abstractions
│   └── interfaces/
│       ├── IEngine.ts              # Engine abstraction
│       ├── ISceneManager.ts        # Scene management contract
│       ├── IModelLoader.ts         # Model loading strategies
│       └── index.ts
│
├── config/                  # Configuration
│   └── viewer.config.ts     # Centralized config (694 lines)
│
├── materials/               # Material System
│   ├── MaterialLibrary.ts   # Centralized material management
│   ├── BrickMaterial.ts     # PBR brick material
│   └── UVGenerator.ts       # UV coordinate generation
│
└── babylon/                 # Legacy (to be removed)
    └── scene/
        └── sceneInitializer.ts  # Old scene setup (deprecated)
```

### Core Interfaces

#### **IEngine** (/src/core/interfaces/IEngine.ts)
```typescript
// Unified interface for WebGPU and WebGL engines
interface IEngine {
  type: 'WebGPU' | 'WebGL';
  isFallback: boolean;
  startRenderLoop(callback: () => void): void;
  stopRenderLoop(): void;
  resize(): void;
  dispose(): void;
  getFps(): number;
  setHardwareScalingLevel(level: number): void;
}
```

**Design Pattern:** Adapter Pattern
**Purpose:** Abstract away engine differences

#### **ISceneManager** (/src/core/interfaces/ISceneManager.ts)
```typescript
// Scene lifecycle management
interface ISceneManager {
  initialize(engine: IEngine, canvas: HTMLCanvasElement): Promise<SceneContext>;
  dispose(): Promise<void>;
  getContext(): SceneContext | null;
  updateConfig(config: SceneConfigUpdate): void;
}

// Complete scene with all objects
interface SceneContext {
  scene: Scene;
  camera: ArcRotateCamera;
  shadowGenerator: ShadowGenerator;
  ground: Mesh;
  axesViewer: AxesViewer | null;
  gizmoManager: GizmoManager;
  instrumentation: SceneInstrumentation;
  highlightLayer: HighlightLayer;
}
```

**Design Pattern:** Facade Pattern
**Purpose:** Simplify complex scene setup

#### **IModelLoader** (/src/core/interfaces/IModelLoader.ts)
```typescript
// Model loading abstraction
interface IModelLoader {
  load(source: ModelSource, options?: ModelLoadOptions): Promise<LoadedModel>;
  cancel(): void;
}

// Extensible source types
type ModelSource =
  | { type: 'file'; file: File }
  | { type: 'path'; path: string; name?: string }
  | { type: 'url'; url: string; name?: string }
  | { type: 'server'; id: string; name?: string };

// Detailed result
interface LoadedModel {
  meshes: AbstractMesh[];
  name: string;
  timing: LoadTimingBreakdown;
  stats: ModelStats;
}
```

**Design Pattern:** Strategy Pattern
**Purpose:** Swappable loading implementations

### Key Services

#### **EngineFactory** (/src/services/engine/EngineFactory.ts)
```typescript
class EngineFactory {
  static async create(
    canvas: HTMLCanvasElement | null,
    config?: EngineConfig
  ): Promise<IEngine>
}
```

**Responsibilities:**
- Try WebGPU first, fallback to WebGL if unsupported
- Apply browser-specific optimizations
- Filter known harmless console warnings
- Wrap engine with EngineAdapter

**Chrome Optimizations:**
- `doNotHandleContextLost: true` (~10% faster init)
- `enableOfflineSupport: false` (faster resource loading)
- `disablePerformanceMonitorInBackground: true`

#### **SceneFactory** (/src/services/scene/SceneFactory.ts)
```typescript
class SceneFactory {
  static create(engine: IEngine, canvas: HTMLCanvasElement): SceneContext
  static applyBrowserOptimizations(scene: Scene, isChrome: boolean): void
  static restoreOptimizations(scene: Scene, isChrome: boolean): void
}
```

**Responsibilities:**
- Create complete scene with camera, lights, ground, etc.
- Apply browser-specific optimizations during loading
- Restore normal behavior after loading

**Chrome Loading Optimizations:**
- `blockMaterialDirtyMechanism = true` (~30% faster)
- Disable auto-clear during load
- Restore after loading complete

#### **FileModelLoader** (/src/services/model/FileModelLoader.ts)
```typescript
class FileModelLoader implements IModelLoader {
  async load(
    source: ModelSource,
    options?: ModelLoadOptions
  ): Promise<LoadedModel>
}
```

**Loading Pipeline:**
1. Babylon Import (ImportMeshAsync)
2. Material Application (PBR materials)
3. Shadow Setup (add to shadow generator)
4. Bounding Box Calculation
5. Model Centering (if > 1000 units from origin)
6. Camera Fitting (auto-frame to show full model)
7. Mesh Freezing (freeze world matrices for 20-30% FPS boost)

**Critical Performance Note:**
```typescript
// ✅ CORRECT: Pass undefined for progress callback
await SceneLoader.ImportMeshAsync('', '', url, scene, undefined, extension);

// ❌ WRONG: Empty callback causes huge performance penalty
await SceneLoader.ImportMeshAsync('', '', url, scene, () => {}, extension);
```

**Timing Breakdown:**
```typescript
interface LoadTimingBreakdown {
  total: number;           // Total time
  babylonLoad: number;     // Babylon.js import time
  materialSetup: number;   // Material application
  shadowSetup: number;     // Shadow configuration
  boundingBox: number;     // Bounding box calculation
  optimization: number;    // Mesh freezing
}
```

#### **ResourceDisposer** (/src/services/cleanup/ResourceDisposer.ts)
```typescript
class ResourceDisposer {
  async disposeModel(
    meshes: AbstractMesh[],
    optimizer?: SceneOptimizer | null
  ): Promise<void>
}
```

**Disposal Order (Critical for preventing memory leaks):**
1. Stop scene optimizer
2. Remove shadow casters
3. Collect all materials & textures (using Set to deduplicate)
4. Dispose meshes (without disposing materials/textures yet)
5. Dispose materials
6. Dispose textures
7. **WebGPU Only:** Force GPU flush via `scene.render()`
8. Wait 100ms for garbage collection

**Why This Order?**
- Prevents double-disposal errors
- Ensures proper reference cleanup
- WebGPU requires explicit flush to release GPU memory

#### **MaterialLibrary** (/src/materials/MaterialLibrary.ts)
```typescript
class MaterialLibrary {
  applyToMeshes(meshes: Mesh[], uvScale?: number): void
}
```

**Responsibilities:**
- Smart name matching (detects "brick", "ziegel", "metal", "steel", etc.)
- Material reuse (Flyweight pattern)
- UV generation for meshes without UVs
- PBR material creation

**Smart Matching:**
```typescript
// Detects brick materials
if (name.includes('brick') || name.includes('ziegel')) {
  return this.getBricks051(uvScale);
}

// Detects metal materials
if (name.includes('metal') || name.includes('steel') ||
    name.includes('stahl') || name.includes('iron') ||
    name.includes('aluminum')) {
  return this.getCorrugatedSteel007(uvScale);
}
```

### Configuration System (/src/config/viewer.config.ts)

**694 lines** of extensively documented configuration.

**Categories:**
- **Engine:** WebGPU preference, fallback, optimizations
- **Scene:** Clear color, environment intensity
- **Camera:** Position, controls, limits
- **Lighting:** Hemispheric + directional lights
- **Shadows:** Map size, blur, thresholds
- **Ground/Grid:** Dimensions, spacing, colors
- **Model Loading:** Options, defaults
- **Materials:** PBR defaults
- **Optimization:** Scene optimizer settings
- **UI:** Colors, spacing, text strings

**Documentation Format:**
```typescript
/**
 * Camera wheel precision
 *
 * What: Controls zoom speed with mouse wheel
 * Why: 50 provides smooth, precise zoom control
 * Default: 3 (too sensitive for BIM models)
 * Impact: Lower = faster zoom, higher = slower zoom
 * Browser: Same across all browsers
 */
wheelPrecision: 50,
```

### BabylonViewer Component (/src/components/BabylonViewer.tsx)

**890 lines** - Main orchestrator component

#### **State Management**

**Service Refs (useRef):**
```typescript
const engineRef = useRef<IEngine | null>(null);
const sceneManagerRef = useRef<SceneManager | null>(null);
const sceneContextRef = useRef<SceneContext | null>(null);
const cameraControllerRef = useRef<CameraController | null>(null);
const resourceDisposerRef = useRef<ResourceDisposer | null>(null);
const sceneOptimizerRef = useRef<SceneOptimizer | null>(null);
```

**UI State (useState):**
```typescript
const [isDragging, setIsDragging] = useState(false);
const [loadedModel, setLoadedModel] = useState<AbstractMesh[] | null>(null);
const [showGrid, setShowGrid] = useState(true);
const [showAxes, setShowAxes] = useState(false);
const [showGizmo, setShowGizmo] = useState(false);
const [isLoading, setIsLoading] = useState(false);
const [selectedMesh, setSelectedMesh] = useState<AbstractMesh | null>(null);
const [showUI, setShowUI] = useState(true);
const [optimizerEnabled, setOptimizerEnabled] = useState(false);
```

#### **Complete User Interaction Flow**

```
USER DROPS GLB FILE
    ↓
handleDrop() event handler
    ↓ Validate file extension
    ↓ Check engine ready
    ↓
loadModel({ type: 'file', file })
    ↓
ResourceDisposer.disposeModel() [if previous model exists]
    ↓
SceneFactory.applyBrowserOptimizations()
    ↓ Enable Chrome loading optimizations
    ↓
ModelLoaderFactory.create()
    ↓ Returns FileModelLoader
    ↓
FileModelLoader.load()
    ↓ Create ObjectURL from File
    ↓ SceneLoader.ImportMeshAsync()
    ↓   ↓ Babylon.js parses GLB
    ↓   ↓ Creates meshes, materials, textures
    ↓   ↓ Applies extensions (quantization, compression, instancing)
    ↓
MaterialLibrary.applyToMeshes()
    ↓ Smart name matching
    ↓ UV generation if needed
    ↓ Apply PBR materials
    ↓
Setup shadows (add meshes to shadow generator)
    ↓
Calculate bounding box
    ↓
Center at origin (if > 1000 units away)
    ↓
CameraController.fitToView()
    ↓ Auto-frame camera to show full model
    ↓
Freeze meshes (freeze world matrices)
    ↓
Return LoadedModel with timing breakdown
    ↓
SceneFactory.restoreOptimizations()
    ↓ Restore normal scene behavior
    ↓
Start scene optimizer (if enabled)
    ↓
Update React state
    ↓ setLoadedModel(meshes)
    ↓ setLoadTime(timing)
    ↓
RENDER LOOP (continuous)
    ↓ Engine.startRenderLoop()
    ↓ scene.render() every frame
    ↓ Instrumentation collects metrics
    ↓ PerformanceMonitor displays FPS
```

---

## Data Flow Pipeline

### Complete End-to-End Flow

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: SOURCE DATA                                         │
│  IFC File (3.3 GB)                                          │
│  - Industry standard BIM format (ISO 16739)                 │
│  - Contains: geometry, materials, properties, hierarchy     │
│  - May use local (±500 units) or GPS (millions) coordinates│
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: BACKEND CONVERSION (Manual/On-Demand)              │
│                                                              │
│  Step 1: Coordinate Detection (Python)                      │
│   smart_convert_ifc_to_glb.py                              │
│   - Analyzes IFC coordinate system                         │
│   - Decides centering strategy                             │
│   Time: < 1 second                                         │
│                                                              │
│  Step 2: IFC → GLB Baseline (C++)                           │
│   IfcConvert [--center-model-geometry] input.ifc output.glb│
│   - Geometry tessellation                                  │
│   - Material conversion                                    │
│   Output: 630 MB (5.2x compression)                        │
│   Time: 16m 25s                                            │
│                                                              │
│  Step 3: GLB Compression (C++)                              │
│   gltfpack -i input.glb -o output.glb -cc                  │
│   - Vertex quantization                                    │
│   - Binary compression                                     │
│   Output: 34 MB (18.5x compression)                        │
│   Time: 5.7s                                               │
│                                                              │
│  Step 4: GPU Instancing (Node.js) [Optional]                │
│   gltf-transform optimize --instance --join false          │
│   - Detects repeated geometries                            │
│   - Creates instance batches                               │
│   Output: 23 MB (143x total compression)                   │
│   Time: 43.6s                                              │
│                                                              │
│  Manual: Move GLB to public/models/                         │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: WEB DELIVERY                                        │
│  GLB File (23 MB)                                           │
│  - Served via Vite dev server (http://localhost:5173)      │
│  - Or static hosting (CDN, S3, etc.)                        │
│  - User downloads via drag-and-drop or URL                  │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: FRONTEND LOADING (Automatic)                        │
│                                                              │
│  Step 1: Engine Initialization                              │
│   EngineFactory.create()                                    │
│   - Try WebGPU, fallback to WebGL                          │
│   - Apply browser optimizations                             │
│   Time: 100-200ms                                          │
│                                                              │
│  Step 2: Scene Initialization                               │
│   SceneManager.initialize()                                 │
│   - Create camera, lights, ground, etc.                    │
│   Time: 50-100ms                                           │
│                                                              │
│  Step 3: Model Loading                                      │
│   FileModelLoader.load()                                    │
│   - Babylon.js parses GLB (100-500ms)                      │
│   - Applies materials (50-200ms)                           │
│   - Sets up shadows (10-50ms)                              │
│   - Centers model (1-5ms)                                  │
│   - Fits camera (1-5ms)                                    │
│   - Freezes meshes (10-30ms)                               │
│   Time: 200-800ms total                                    │
│                                                              │
│  Step 4: First Render                                       │
│   scene.render()                                            │
│   - Shader compilation (200-500ms first frame)             │
│   - GPU upload (50-200ms)                                  │
│   Time: 300-700ms                                          │
│                                                              │
│  Total Frontend Load Time: 0.7 - 1.8 seconds                │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: RUNTIME RENDERING (Continuous)                     │
│  Render Loop (60 FPS)                                       │
│  - Camera updates (user input)                             │
│  - Frustum culling (discard off-screen meshes)             │
│  - Shadow map rendering (1024×1024 texture)                │
│  - Main scene rendering                                    │
│  - Post-processing (highlight layer)                       │
│  - Present to screen                                       │
│  Frame Time: ~16ms (60 FPS)                                │
└─────────────────────────────────────────────────────────────┘
```

### Performance Summary

| Phase | Duration | Bottleneck |
|-------|----------|------------|
| Backend Conversion | 17m 14s | IfcConvert tessellation (CPU) |
| Web Delivery | 1-5s | Network bandwidth |
| Frontend Loading | 0.7-1.8s | GLB parsing + shader compilation |
| Runtime Rendering | 16ms/frame | GPU rendering |

**Total Time (First View):**
- Cold start (with conversion): ~17 minutes (one-time)
- Warm start (GLB cached): ~5 seconds (typical)

---

## Design Patterns

The architecture employs multiple design patterns for maintainability and scalability:

### 1. Factory Pattern (3 factories)

**EngineFactory**
- Creates WebGPU or WebGL engines
- Encapsulates browser detection
- Handles WebGPU initialization complexity

**SceneFactory**
- Creates complete scenes with all objects
- Encapsulates scene setup complexity
- Provides browser-specific optimizations

**ModelLoaderFactory**
- Creates appropriate loader for source type
- Extensible for new source types (URL, server)

**Benefits:**
- Encapsulates creation logic
- Supports multiple implementations
- Easy to extend with new types

### 2. Adapter Pattern (1 adapter)

**EngineAdapter**
- Wraps Babylon.js engines with IEngine interface
- Provides consistent API across WebGPU/WebGL
- Hides implementation differences

**Benefits:**
- Consistent API
- Technology independence
- Easy to swap backends

### 3. Strategy Pattern (model loading)

**IModelLoader + FileModelLoader**
- Interface for loading strategies
- FileModelLoader implements file-based loading
- Extensible for URL, server, streaming, etc.

**Benefits:**
- Swappable algorithms
- Open for extension
- Testable in isolation

### 4. Facade Pattern (2 facades)

**SceneManager**
- Simplifies complex scene operations
- Hides SceneFactory complexity
- Provides lifecycle management

**MaterialLibrary**
- Simplifies material management
- Hides PBR complexity
- Provides smart matching

**Benefits:**
- Simple interface to complex subsystems
- Reduces coupling
- Easier to use

### 5. Service Pattern (multiple services)

**CameraController, ResourceDisposer, MaterialLibrary**
- Encapsulate business logic
- Stateless or minimal state
- Reusable across components

**Benefits:**
- Separation of concerns
- Testable logic
- Reusable

### 6. Flyweight Pattern (material reuse)

**MaterialLibrary**
- Shares material instances across meshes
- Reduces memory usage
- Better performance

**Benefits:**
- Lower memory usage
- Fewer GPU resources
- Consistent appearance

### 7. Dependency Inversion Principle (architecture-wide)

**All services depend on interfaces, not implementations**
- IEngine, ISceneManager, IModelLoader
- Services use abstractions
- Components use service interfaces

**Benefits:**
- Loose coupling
- Easy testing (mocks)
- Flexible architecture

---

## Performance Characteristics

### Backend Performance

**Bilton Model: 3.3 GB → 23 MB (143x compression)**

| Metric | Value |
|--------|-------|
| IFC Elements | 21,643 building products |
| GLB Meshes | 6,872 individual meshes |
| Vertices | ~50 million |
| Triangles | ~80 million |
| Instance Batches | 2,597 batches (29,081 instances) |
| Materials | 500+ unique materials |
| Conversion Time | 17m 14s |
| Final File Size | 23 MB |

**Draw Call Reduction:** 70-95% via GPU instancing

### Frontend Performance

**Loading Performance (23 MB GLB)**

| Phase | Chrome | Firefox |
|-------|--------|---------|
| Download | 1-5s | 1-5s |
| GLB Parse | 200-400ms | 300-500ms |
| Material Setup | 50-150ms | 50-150ms |
| Shadow Setup | 10-30ms | 10-30ms |
| Optimization | 10-20ms | 10-20ms |
| First Render | 300-500ms | 400-600ms |
| **Total** | **0.7-1.3s** | **0.9-1.5s** |

**Runtime Performance (60 FPS target)**

| Metric | WebGPU | WebGL |
|--------|--------|-------|
| Draw Calls | 2,597 | 2,597 |
| Active Meshes | 6,872 | 6,872 |
| Frame Time | 14-16ms | 16-18ms |
| FPS | 60 | 55-60 |
| GPU Memory | ~800 MB | ~1.2 GB |

**Memory Management:**
- Proper disposal prevents leaks
- WebGPU requires explicit GPU flush
- ResourceDisposer ensures clean shutdown

### Optimization Techniques

**Backend:**
- Mesh quantization (float32 → int16): 50% smaller
- Binary compression (meshopt): 70-80% smaller
- GPU instancing: 40-60% fewer draw calls
- Material deduplication: 30% fewer materials
- Vertex welding: 10-20% fewer vertices

**Frontend:**
- Mesh freezing: 20-30% FPS boost
- Frustum culling: 40-60% fewer meshes rendered
- Chrome loading optimizations: 30% faster load
- Shadow size threshold: Only large objects cast shadows
- Lazy shader compilation: Faster initial load

---

## Technology Stack

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.x | Orchestration, analysis |
| ifcopenshell | Latest | IFC parsing |
| IfcConvert | Latest | IFC → GLB (C++) |
| gltfpack | Latest | GLB compression (C++) |
| gltf-transform | 4.x | GLB optimization (Node.js) |
| Bash | - | Shell scripts |

**Python Environment:** Anaconda `bim` environment
**Installation:** `pip install ifcopenshell --break-system-packages`

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| TypeScript | 5.x | Type safety |
| Babylon.js | 7.x | 3D engine |
| Vite | 5.x | Build tool, dev server |
| WebGPU | Latest | GPU API (primary) |
| WebGL 2.0 | Latest | GPU API (fallback) |

**Browser Support:**
- **WebGPU:** Chrome 113+, Edge 113+, Opera 99+
- **WebGL 2.0:** All modern browsers (fallback)

### File Formats

| Format | Purpose | Characteristics |
|--------|---------|-----------------|
| IFC | Source BIM data | ISO 16739 standard, text-based STEP format |
| GLB | Optimized 3D | Binary glTF, self-contained, web-optimized |
| PNG | Textures | PBR texture maps (albedo, normal, roughness) |

**GLB Extensions Used:**
- `KHR_mesh_quantization` - Reduced vertex precision
- `EXT_meshopt_compression` - Binary compression
- `EXT_mesh_gpu_instancing` - Shared geometry batching

---

## Summary

This architecture demonstrates **production-grade software engineering**:

### Backend Strengths
- **Intelligent Automation:** Smart coordinate system detection
- **High Performance:** 143x compression with C++ tools
- **Flexible Pipeline:** Scripts work independently or chained
- **Comprehensive Analysis:** Multiple inspection tools

### Frontend Strengths
- **Clean Architecture:** Service layer, interfaces, separation of concerns
- **Type Safety:** Full TypeScript with strict typing
- **Performance:** WebGPU support, browser optimizations, instrumentation
- **Maintainability:** Centralized config, extensive documentation
- **Extensibility:** Factory patterns, strategy pattern, open for extension

### System Strengths
- **End-to-End Optimization:** From 3.3 GB IFC to 23 MB GLB to 60 FPS rendering
- **Professional Features:** Mesh selection, PBR materials, shadows, performance metrics
- **Production Ready:** Memory management, error handling, fallback strategies

### Current Limitations
1. **Manual Backend Pipeline:** No automated build integration
2. **No Web API:** Backend tools are command-line only
3. **No Progressive Loading:** Loads entire model at once
4. **Limited Material Library:** Only 2 PBR materials currently

### Future Enhancements
1. **Automated Backend Pipeline:** Web-based conversion API
2. **Progressive Loading:** Load storeys/spaces on demand
3. **LOD Pipeline:** Multiple detail levels for distant objects
4. **Expanded Material Library:** Full BIM material set
5. **IFC Property Display:** Show element properties on selection
6. **Measurement Tools:** Distance, area, volume calculations
7. **Section Planes:** Cut-away views for interior inspection

---

**Document Version:** 1.0
**Last Updated:** 2025-10-31
**Maintained By:** Development Team
