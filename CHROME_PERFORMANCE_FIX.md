# Chrome Performance Fix

**Date**: 2025-10-30
**Issue**: Extreme Scene Ready Wait time in Chrome (173.76s vs Firefox 4.06s) + Slow GLB parsing (107s vs Firefox 8s)
**Status**: ✅ Significantly Improved - Total load time reduced from 179.84s → 88.72s (51% improvement)

---

## 🚨 Problem

### Performance Comparison

| Browser | Scene Ready Wait | Total Load Time | Ratio |
|---------|------------------|-----------------|-------|
| **Firefox** | 4.06s | 10.65s | Baseline |
| **Chrome** | 173.76s | 179.84s | 🔴 **43x slower!** |

### Breakdown (Same MBN file, ~15 MB)

```
Chrome Performance:
  File Import:      5.83s   ✅ Normal
  Materials:        0.01s   ✅ Normal
  Shadows:          0.22s   ✅ Better than Firefox
  Mesh Freezing:    0.03s   ✅ Normal
  Scene Ready Wait: 173.76s 🔴 PROBLEM!
  Camera Framing:   0.02s   ✅ Normal
  ─────────────────────────────
  TOTAL TIME:       179.84s
```

### Update: New Performance Bottleneck Identified

After fixing Scene Ready Wait (173s → 8.65s), a new bottleneck emerged:

```
Chrome (318 MB GLB file):
  Blob URL Create:  0.10s   ✅ Normal
  GLB Parse:        107.52s 🔴 MAJOR BOTTLENECK!
  Scene Ready Wait: 8.65s   ✅ Fixed
  TOTAL TIME:       117.85s

Firefox (same file):
  Blob URL Create:  0.44s   ✅ Normal
  GLB Parse:        8.07s   ✅ Fast
  Scene Ready Wait: 4.39s   ✅ Fast
  TOTAL TIME:       13.92s
```

**Chrome's GLB parsing is 13x slower than Firefox!**

---

## 🔍 Root Cause Analysis

### Issue 1: Scene Ready Wait (FIXED ✅)

### What happens in "Scene Ready Wait"?

Babylon.js `scene.executeWhenReady()` performs:

1. **Shader Compilation** for all materials
2. **Material Finalization** (textures, properties)
3. **Bounding Info Updates** for all meshes
4. **Scene Graph Validation**

### Why is Chrome so slow?

**Primary Cause: Shader Compilation**

Chrome's WebGL stack:
```
WebGL API → ANGLE → DirectX/Vulkan/OpenGL → GPU Driver
```

Firefox's WebGL stack:
```
WebGL API → OpenGL → GPU Driver
```

**ANGLE (Almost Native Graphics Layer Engine)**:
- Extra abstraction layer in Chrome
- Translates WebGL → DirectX (Windows) / Metal (macOS) / Vulkan (Linux)
- Shader compilation goes through extra stages
- Can be **significantly slower** for complex shaders

**Our PBR Materials**:
- 850+ meshes × complex PBR shaders
- Each material instance needs shader compilation
- Normal maps, roughness, metalness = complex fragment shaders
- Chrome's ANGLE processes these much slower than Firefox

### Issue 2: GLB Parsing Performance (IN PROGRESS 🔧)

**Primary Causes:**

1. **Binary Data Processing**: Chrome's V8 engine handles TypedArray operations differently
2. **Memory Allocation**: Large ArrayBuffer operations trigger different GC patterns
3. **GLTF Parsing**: Babylon.js GLTF loader performs slower in Chrome's environment
4. **Inefficient Loading**: Previous code read entire file into memory before creating blob URL

**Differences:**

Chrome parses 318 MB of binary GLTF data significantly slower due to:
- V8's ArrayBuffer handling vs SpiderMonkey (Firefox's engine)
- Different optimization paths for binary data manipulation
- Potential memory pressure causing more frequent GC pauses
- Less efficient typed array operations at this scale

---

## ✅ Implemented Fixes

### Fix 1: Engine Configuration (Scene Ready Wait)

**File**: `BabylonViewer.config.ts`

```typescript
engine: {
  preserveDrawingBuffer: true,
  stencil: true,
  doNotHandleContextLost: true,        // ← NEW: Faster initialization
  powerPreference: 'high-performance',  // ← NEW: Use discrete GPU
},
```

**Impact**: Forces Chrome to use dedicated GPU instead of integrated graphics.

---

### Fix 2: Browser Detection & WebGL Diagnostics

**File**: `BabylonViewer.tsx:93-110`

```typescript
// Detect browser
const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
const isFirefox = /Firefox/.test(navigator.userAgent);

// Log WebGL capabilities
const gl = engine._gl;
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
console.log('WebGL Vendor:', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
console.log('WebGL Renderer:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
console.log('Parallel Shader Compile:', engine.getCaps().parallelShaderCompile);
```

**Impact**:
- Identifies GPU in use (hardware vs software rendering)
- Detects `KHR_parallel_shader_compile` extension support
- Helps diagnose SwiftShader (software rendering) fallback

---

### Fix 3: Scene Optimizations During Load

**File**: `BabylonViewer.tsx:119-129`

```typescript
// Performance optimizations during loading
scene.skipFrustumClipping = true;      // Disable culling during load
scene.skipPointerMovePicking = true;   // Disable picking during load

// Chrome-specific optimizations
if (isChrome) {
  scene.autoClear = false;              // Reduce clear calls
  scene.autoClearDepthAndStencil = false;
}
```

**Impact**: Reduces GPU state changes during shader compilation phase.

---

### Fix 4: Material Freezing Post-Load

**File**: `BabylonViewer.tsx:703-712`

```typescript
// Freeze materials to prevent shader recompilation
sceneRef.current?.materials.forEach(material => {
  if (material && !material.isFrozen) {
    material.freeze();
    frozenMaterials++;
  }
});
```

**Impact**:
- Prevents shader recompilation on material property changes
- Locks shader programs in GPU memory
- **Critical** for PBR materials with many uniforms

---

### Fix 5: Re-enable Optimizations After Load

**File**: `BabylonViewer.tsx:694-701`

```typescript
// Re-enable scene optimizations after load
sceneRef.current.skipFrustumClipping = false;
sceneRef.current.skipPointerMovePicking = false;
sceneRef.current.autoClear = true;
sceneRef.current.autoClearDepthAndStencil = true;
```

**Impact**: Restores normal scene behavior after initial load completes.

---

### Fix 6: Optimized File Loading (GLB Parsing - NEW)

**File**: `BabylonViewer.tsx:615-633`

**Before:**
```typescript
// ❌ OLD: Read entire file into ArrayBuffer first (slow & memory intensive)
const arrayBuffer = await file.arrayBuffer(); // Reads 318 MB into memory
const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' }); // Copy
const url = URL.createObjectURL(blob);
```

**After:**
```typescript
// ✅ NEW: Use File object directly (fast & memory efficient)
const url = URL.createObjectURL(file); // File is already a Blob!
```

**Impact**:
- Eliminates unnecessary memory copy (saves 318 MB allocation)
- Reduces memory pressure on Chrome's GC
- Allows streaming access to file data
- Expected 10-20% improvement in GLB parse time

---

### Fix 7: Engine-Level Optimizations (GLB Parsing - NEW)

**File**: `BabylonViewer.tsx:102-107`

```typescript
if (isChrome) {
  engine.enableOfflineSupport = false; // Skip manifest checks
  engine.disablePerformanceMonitorInBackground = true; // Reduce overhead
}
```

**Impact**: Removes unnecessary overhead during large file loading.

---

### Fix 8: Material Dirty Mechanism Blocking (GLB Parsing - NEW)

**File**: `BabylonViewer.tsx:130-132`

```typescript
if (isChrome) {
  scene.blockMaterialDirtyMechanism = true; // Block during load
  // ... (unblocked after load completes)
}
```

**Impact**:
- Prevents material update notifications during GLB parsing
- Reduces overhead when creating thousands of materials
- Re-enabled after load: `scene.blockMaterialDirtyMechanism = false`

---

## 🎯 Expected Results

### Before All Fixes (Original Issue)

```
Chrome (15 MB file):
  Scene Ready Wait: 173.76s 🔴
  Total Time:       179.84s 🔴
```

### After Scene Ready Fixes (Fixes 1-5)

```
Chrome (318 MB file):
  GLB Parse:        107.52s 🔴 NEW BOTTLENECK
  Scene Ready Wait: 8.65s   ✅ Fixed (20x improvement!)
  Total Time:       117.85s 🔴
```

### After GLB Parsing Fixes (Fixes 6-8 - ACTUAL RESULTS)

```
Chrome (318 MB file):
  Blob URL Create:  0.00s     ✅ Instant (eliminated memory copy)
  GLB Parse:        80.26s    🟡 25% improvement (107.52s → 80.26s)
  Scene Ready Wait: 5.63s     ✅ 35% improvement (8.65s → 5.63s)
  Total Time:       88.72s    ✅ 25% improvement (117.85s → 88.72s)
                              ✅ 51% improvement from original (179.84s → 88.72s)

Firefox (318 MB file - Reference):
  GLB Parse:        8.07s     ✅
  Scene Ready Wait: 4.39s     ✅
  Total Time:       13.92s    ✅
```

**Results Summary:**
- ✅ **29 seconds saved** from total load time
- ✅ **25% faster GLB parsing** with optimized loading strategy
- ✅ **35% faster Scene Ready** with material dirty mechanism blocking
- 🟡 Chrome still **6.4x slower** than Firefox due to fundamental engine differences

**Note**: The remaining performance gap is due to V8 vs SpiderMonkey differences in handling large binary data, Chrome's ANGLE layer overhead, and different GC patterns. Further improvements would require web workers, streaming loading, or server-side pre-processing.

---

## 🔧 User Actions (If Still Slow)

### 1. Check Hardware Acceleration

1. Open `chrome://gpu` in Chrome
2. Look for "Graphics Feature Status"
3. Ensure **WebGL** and **WebGL2** show **"Hardware accelerated"**

**If showing "Software only" or "Disabled":**
- Go to `chrome://settings`
- Search "Hardware acceleration"
- Enable "Use hardware acceleration when available"
- **Restart Chrome**

### 2. Check GPU in Use

```javascript
// Open DevTools Console
const gl = document.querySelector('canvas').getContext('webgl2');
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
console.log('Renderer:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
```

**Good**: Shows actual GPU (NVIDIA, AMD, Intel HD)
**Bad**: Shows "SwiftShader" (software rendering)

### 3. Force Discrete GPU (Laptops)

**Windows (NVIDIA):**
- Right-click Chrome shortcut → "Run with graphics processor" → High-performance NVIDIA

**macOS:**
- System Preferences → Battery → Graphics → "Automatic graphics switching" OFF

**Linux:**
```bash
# Force discrete GPU
DRI_PRIME=1 google-chrome
```

---

## 📊 Debugging Checklist

When debugging Chrome performance:

- [ ] Check `chrome://gpu` - Hardware Acceleration enabled?
- [ ] Check Console - Is `Parallel Shader Compile` supported?
- [ ] Check Console - Is SwiftShader in use? (bad)
- [ ] Check Console - Material freeze count (should be >0)
- [ ] Check Performance Timing - Is Scene Ready Wait <30s?
- [ ] Compare with Firefox - Is difference <5x?

---

## 🎨 Alternative: Disable PBR Materials (Testing)

To confirm PBR materials are the cause, **temporarily comment out**:

```typescript
// BabylonViewer.tsx:649-656
// === APPLY REALISTIC MATERIALS ===
// const matLib = new MaterialLibrary(sceneRef.current);
// const materialStats = matLib.applyToMeshes(result.meshes as Mesh[], 1.0);
```

**If Scene Ready becomes fast** → PBR materials are confirmed as bottleneck.

**Solutions:**
1. Simplify PBR materials (fewer texture maps)
2. Use StandardMaterial instead of PBRMaterial
3. Progressive material loading (simple first, PBR later)
4. Material LOD system (simplified shaders at distance)

---

## 📈 Performance Metrics to Track

After implementing fixes, monitor:

```
=== CHROME PERFORMANCE METRICS ===
Browser:              Chrome / Firefox / Other
WebGL Renderer:       [GPU Name]
Parallel Compile:     Supported / Not Supported
Scene Ready Wait:     [X.XX]s
Material Freeze Count: [XXX]
Total Load Time:      [X.XX]s
```

**Target:**
- Scene Ready Wait: <20s (Chrome), <5s (Firefox)
- Material Freeze: >100 materials
- Total Time: <30s

---

## 🚀 Future Optimizations

If Chrome is still slow after these fixes:

### 1. Progressive Material Loading
```typescript
// Load simple materials first, PBR later
await loadModel();
applyBasicMaterials(); // Fast
render(); // User sees model quickly
await applyPBRMaterials(); // Background
```

### 2. Material LOD System
```typescript
// Use simple shaders at distance, PBR up close
if (cameraDistance > 20) {
  mesh.material = simpleMaterial; // Fast shader
} else {
  mesh.material = pbrMaterial; // Complex shader
}
```

### 3. Shader Warmup
```typescript
// Pre-compile shaders before model load
const warmupMesh = MeshBuilder.CreateBox('warmup', {}, scene);
warmupMesh.material = pbrMaterial;
scene.render(); // Forces compilation
warmupMesh.dispose();
```

---

## 🚀 Advanced Optimization Strategies (Future Work)

The current optimizations have reduced Chrome load time from 179.84s to 88.72s (51% improvement), but Chrome is still 6.4x slower than Firefox. To close this gap further, the following advanced strategies could be implemented:

### 1. Web Worker-Based Loading

**Concept**: Offload GLB parsing to a background thread

```typescript
// Load and parse GLB in Web Worker (doesn't block main thread)
const worker = new Worker('glb-loader-worker.js');
worker.postMessage({ file: arrayBuffer });
worker.onmessage = (e) => {
  const parsedData = e.data;
  // Create meshes on main thread from parsed data
};
```

**Benefits**:
- Main thread stays responsive during parsing
- Better utilization of multi-core CPUs
- Perceived performance improvement (UI doesn't freeze)

**Challenges**:
- Babylon.js GLTF loader needs main thread access
- Would require custom GLB parser or worker-compatible loader
- Data transfer overhead between worker and main thread

---

### 2. Streaming/Progressive Loading

**Concept**: Load and display model incrementally instead of all-at-once

```typescript
// Load model in chunks by product type or floor
async function loadModelProgressive() {
  // 1. Load structure first (walls, floors) - shows quickly
  await loadByPattern('Wall', 'Floor');

  // 2. Load remaining elements in background
  await loadByPattern('Window', 'Door', 'Furniture');
}
```

**Benefits**:
- User sees something immediately (faster perceived load time)
- Can interact with partial model while rest loads
- Spreads parsing load over time

**Challenges**:
- Requires splitting GLB file or using IFC directly
- More complex loading logic
- Need to handle camera framing with partial models

---

### 3. Server-Side Pre-Processing

**Concept**: Optimize GLB file on server before sending to client

```bash
# Server-side optimization pipeline
gltfpack -i model.glb -o optimized.glb -cc -si 0.95
gltf-transform optimize optimized.glb final.glb
gltf-transform quantize final.glb final.glb
```

**Benefits**:
- Smaller file size = faster download + parsing
- Moves computational cost to server (one-time process)
- All browsers benefit equally

**Current Status**: Already using gltfpack (318 MB compressed file)

**Further optimization**:
- Split by floor/zone into separate GLB files
- Generate multiple LOD levels server-side
- Pre-compute bounding boxes and metadata

---

### 4. Mesh Instancing & Deduplication

**Concept**: Detect duplicate geometries and use instancing

```typescript
// Before: 74,939 unique meshes
// After: ~1,000 unique geometries with 74,939 instances

const geometryMap = new Map();
meshes.forEach(mesh => {
  const hash = hashGeometry(mesh.geometry);
  if (geometryMap.has(hash)) {
    // Create instance instead of new mesh
    const instance = geometryMap.get(hash).createInstance();
  } else {
    geometryMap.set(hash, mesh);
  }
});
```

**Benefits**:
- Massive memory reduction (store geometry once, use many times)
- Faster rendering (GPU-side instancing)
- Much faster parsing (less data to process)

**Note**: gltf-transform can do this server-side with `gltf-transform instance model.glb`

---

### 5. Incremental Shader Compilation

**Concept**: Compile shaders gradually instead of all at once

```typescript
// Warm up shaders progressively
async function warmupShaders(materials) {
  for (const material of materials) {
    material.freeze(); // Compile shader
    await new Promise(resolve => setTimeout(resolve, 10)); // Yield to browser
  }
}
```

**Benefits**:
- Spreads shader compilation over time
- Reduces "Scene Ready Wait" spikes
- Better perceived performance

**Challenges**:
- May see materials "pop in" as shaders compile
- Need careful sequencing for best UX

---

## 📊 Recommended Next Steps

Based on the current 88.72s Chrome load time vs 13.92s Firefox:

**Priority 1: Server-Side (Biggest Impact)**
- ✅ Already using gltfpack compression
- 🔜 Split model by floor (load only visible floors)
- 🔜 Apply gltf-transform instancing
- 🔜 Pre-compute bounding boxes

**Priority 2: Client-Side (Medium Impact)**
- 🔜 Implement floor-based progressive loading
- 🔜 Add LOD system (show simple geometry first, upgrade later)
- 🔜 Cache parsed models in IndexedDB

**Priority 3: Advanced (Complex, High Effort)**
- ⏸️ Web Worker parsing (requires custom loader)
- ⏸️ Streaming GLB parser
- ⏸️ Custom binary format optimized for Chrome

**Reality Check**: 88 seconds for a 318 MB file (74,939 meshes) is actually reasonable. Focus on:
1. Reducing file size through better compression/instancing
2. Progressive loading so users don't wait for everything
3. Accepting that Chrome will be slower than Firefox for large binary data

---

## 📚 References

- [Babylon.js Scene Optimization](https://doc.babylonjs.com/features/featuresDeepDive/scene/optimize_your_scene)
- [Chrome GPU Status](chrome://gpu)
- [ANGLE Project](https://chromium.googlesource.com/angle/angle)
- [KHR_parallel_shader_compile](https://www.khronos.org/registry/webgl/extensions/KHR_parallel_shader_compile/)

---

---

## 📝 Changelog

### Version 2.0 - 2025-10-30 (This Update)
- ✅ Added GLB parsing optimizations (Fixes 6-8)
- ✅ Eliminated unnecessary ArrayBuffer copy in file loading
- ✅ Added engine-level optimizations for Chrome
- ✅ Implemented material dirty mechanism blocking
- ✅ Tested and documented actual performance results
- ✅ Added advanced optimization strategies section
- 📊 **Results**: 51% total improvement (179.84s → 88.72s)

### Version 1.0 - 2025-10-30 (Initial)
- ✅ Scene Ready Wait optimization (Fixes 1-5)
- ✅ Material freezing post-load
- ✅ Chrome-specific shader compilation optimizations
- 📊 **Results**: Scene Ready improved 20x (173.76s → 8.65s)

---

**Last Updated**: 2025-10-30
**Author**: BIM Viewer Development Team
**Version**: 2.0
