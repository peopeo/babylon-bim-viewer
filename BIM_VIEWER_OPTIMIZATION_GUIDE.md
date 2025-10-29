# BIM Viewer Optimization Guide

## Table of Contents
- [Problem Overview](#problem-overview)
- [IFC to GLB Conversion Pipeline](#ifc-to-glb-conversion-pipeline)
- [Compression Testing](#compression-testing)
- [GPU Instancing Investigation](#gpu-instancing-investigation)
- [Final Recommendations](#final-recommendations)
- [Performance Metrics](#performance-metrics)
- [Usage Guide](#usage-guide)

---

## Problem Overview

### Initial Issue: Invisible Models
When loading large IFC files (3.3GB) converted to GLB format into the Babylon.js viewer, models were completely invisible despite successful loading.

**Root Cause:**
- IFC files contain real-world GPS coordinates (e.g., Boston: 42°24'N, 71°15'W)
- This results in meshes positioned millions of units from origin (e.g., `x=1782893.91, z=2959881.26`)
- WebGL uses single-precision floats, causing severe precision loss at large coordinates
- Camera frustum culling treats distant geometry as out of view

### Solution
Use IfcOpenShell's `--center-model-geometry` flag during conversion to transform GPS coordinates to local coordinates centered at origin.

---

## IFC to GLB Conversion Pipeline

### Step 1: IFC to GLB with Centering

**Tool:** IfcOpenShell / IfcConvert 0.8.3

**Command:**
```bash
./IfcConvert --center-model-geometry input.ifc output.glb
```

**Example:**
```bash
time ./IfcConvert --center-model-geometry \
  bilton-B_c3_9c-TGA-3D-XX-3p01.ifc \
  public/models/bilton_centered_test.glb
```

**Results:**
- Input: 3.3GB IFC file
- Output: 630MB GLB file (centered at origin)
- Time: ~33 minutes
- All geometry preserved with correct local coordinates

**Key Parameters:**
- `--center-model-geometry`: Transforms all geometry to center at origin
- This flag is **CRITICAL** for large-scale BIM models with GPS coordinates

---

## Compression Testing

After centering, we tested multiple compression approaches to reduce file size from 630MB.

### Approach 1: gltfpack Compression

**Tool:** gltfpack 0.25

**Test Script:** `test_gltfpack_compression.sh`

**Three compression levels tested:**

#### Level 1: Low Compression (Fast)
```bash
gltfpack -i input.glb -o output.glb -c -v
```
- **Flags:** `-c` (basic compression)
- **Result:** 78MB
- **Compression ratio:** 8.1x
- **Time:** Fastest

#### Level 2: Medium Compression (Balanced) ⭐ RECOMMENDED
```bash
gltfpack -i input.glb -o output.glb -cc -v
```
- **Flags:** `-cc` (higher compression)
- **Result:** 70MB
- **Compression ratio:** 9.0x
- **Time:** Moderate
- **Best balance** of size vs quality

#### Level 3: High Compression (Aggressive)
```bash
gltfpack -i input.glb -o output.glb -cc -si 0.95 -v
```
- **Flags:** `-cc` (higher compression), `-si 0.95` (5% mesh simplification)
- **Result:** 65MB
- **Compression ratio:** 9.7x
- **Time:** Slowest
- **Trade-off:** Slight geometry simplification (may affect detail)

### Compression Summary

| File | Size | Compression | Vertices | Selection | Recommendation |
|------|------|-------------|----------|-----------|----------------|
| Original IFC | 3.3GB | 1.0x | All | N/A | Source file |
| Centered GLB | 630MB | 5.2x | All | Yes | Uncompressed baseline |
| Level 1 Low | 78MB | 42.3x | All | Yes | Fast compression |
| Level 2 Medium | 70MB | 47.1x | All | Yes | ⭐ **RECOMMENDED** |
| Level 3 High | 65MB | 50.8x | 95% | Yes | Smallest with simplification |

---

## GPU Instancing Investigation

### Motivation
GPU instancing can significantly improve rendering performance by:
- Reducing draw calls (batch identical geometry)
- Lowering memory usage (one mesh, many transforms)
- Improving FPS for scenes with repeated elements

### Approach 1: gltf-transform optimize (FAILED)

**Command:**
```bash
gltf-transform optimize input.glb output.glb \
  --instance true \
  --instance-min 2 \
  --compress meshopt \
  --prune true \
  --join true \
  --weld true
```

**Results:**
- ❌ **Lost 32 million vertices** (32.6% of geometry)
- ❌ Many elements completely invisible
- ❌ Individual element selection broken (all merged into one mesh)

**Root Cause:**
- `--join` flag: Merges thousands of meshes into one giant mesh (13.6M vertices)
- `--weld` flag: Aggressively merges nearby vertices, discarding valid geometry
- `--prune` flag: Incorrectly removes "unused" nodes that are actually needed

**Stats Comparison:**
```
Non-instanced: 98,689,854 render vertices
Instanced:     66,543,336 render vertices
LOST:          32,146,518 vertices (32.6%)
```

### Approach 2: gltf-transform instance only (FAILED)

**Command:**
```bash
gltf-transform instance input.glb output.glb --min 2 --verbose
```

**Process:**
1. Apply GPU instancing only (no join/weld/prune)
2. Re-compress with meshopt

**Results:**
- ✅ All vertices preserved (98.6M)
- ✅ File size reduced to 47MB
- ✅ Created 3,510 batches with 29,092 instances
- ❌ **Nearly all geometry disappeared in viewer**

**Root Cause:**
- gltf-transform removed 57,368 "unused" nodes during instancing
- For complex BIM hierarchies, this breaks critical transform chains
- Babylon.js glTF loader couldn't reconstruct proper scene graph

### Why Instancing Fails for BIM Models

**Complex Scene Hierarchies:**
BIM models have deep nested hierarchies:
```
Building
├── Floor_01
│   ├── Wall_A
│   │   ├── Window_001
│   │   └── Window_002
│   └── Wall_B
└── Floor_02
    └── ...
```

**The Problem:**
1. Instancing algorithms try to detect duplicate geometry
2. They restructure the scene graph to create master meshes + instances
3. This breaks parent-child transform chains
4. Elements lose their world positions or get culled incorrectly

**Conclusion:**
GPU instancing via `EXT_mesh_gpu_instancing` is **not suitable** for complex BIM models requiring:
- Complete geometry preservation
- Individual element selection
- Reliable spatial relationships

---

## Final Recommendations

### For BIM Workflows with Element Selection

Use **non-instanced compressed files** from gltfpack:

#### Primary Recommendation: Level 2 Medium
```bash
File: compressed_level2_medium.glb
Size: 70MB
Vertices: 98.6M (100% preserved)
Selection: Individual elements ✓
FPS: Good
```

**Use when:**
- You need reliable individual element selection (walls, doors, windows, etc.)
- Geometry accuracy is critical
- File size ~70MB is acceptable

#### Alternative: Level 1 Low
```bash
File: compressed_level1_low.glb
Size: 78MB
Vertices: 98.6M (100% preserved)
Selection: Individual elements ✓
FPS: Good
```

**Use when:**
- Fastest compression time needed
- Slightly larger file acceptable

#### Alternative: Level 3 High
```bash
File: compressed_level3_high.glb
Size: 65MB
Vertices: ~93.6M (5% simplified)
Selection: Individual elements ✓
FPS: Good
```

**Use when:**
- Smallest file size is priority
- 5% mesh simplification acceptable
- Visual quality still high

### Avoid Instanced Files

❌ **Do NOT use GPU instanced files** for BIM workflows:
- Geometry disappears or gets corrupted
- Individual element selection breaks
- Complex hierarchies can't be reliably reconstructed

---

## Performance Metrics

### File Size Comparison

```
Original IFC:        3,300 MB  (100.0%)
Centered GLB:          630 MB  ( 19.1%)
Compressed Level 1:     78 MB  (  2.4%)
Compressed Level 2:     70 MB  (  2.1%) ⭐ RECOMMENDED
Compressed Level 3:     65 MB  (  2.0%)
```

**Overall Size Reduction:** 47-51x compression from IFC to final GLB

### Loading Performance

| File | Size | Load Time* | FPS** |
|------|------|-----------|-------|
| Centered GLB | 630MB | ~15-20s | 30-45 |
| Level 2 Medium | 70MB | ~3-5s | 30-45 |

*Approximate, depends on network/disk speed
**Depends on hardware and scene complexity

### Rendering Stats (Level 2 Medium)

```
Render Vertices:  98,689,854
Upload Vertices:  17,863,197
Meshes:           ~3,500
Materials:        78
Draw Calls:       Thousands (no instancing)
```

---

## Usage Guide

### Complete Pipeline

#### 1. Convert IFC to Centered GLB
```bash
# Takes ~33 minutes for 3.3GB IFC
time ./IfcConvert --center-model-geometry \
  your-model.ifc \
  public/models/your-model-centered.glb
```

#### 2. Compress with gltfpack (Level 2 Medium)
```bash
# Takes ~5-10 minutes for 630MB GLB
time gltfpack \
  -i public/models/your-model-centered.glb \
  -o public/models/your-model-compressed.glb \
  -cc \
  -v
```

#### 3. Load in Babylon.js Viewer
```typescript
// React component or vanilla JS
const result = await SceneLoader.ImportMeshAsync(
  '',
  '/models/',
  'your-model-compressed.glb',
  scene
);
```

### Testing Scripts

#### Run Compression Tests
```bash
# Tests all 3 compression levels
./test_gltfpack_compression.sh
```

**Output:**
- `compressed_level1_low.glb` (78MB)
- `compressed_level2_medium.glb` (70MB)
- `compressed_level3_high.glb` (65MB)

### Loading in the Viewer

The viewer supports:
- **Drag & Drop:** Drop GLB files onto the canvas
- **Programmatic Loading:** Use `loadModelFromPath()` function
- **Auto-centering:** Models far from origin are automatically centered
- **Auto-framing:** Camera automatically frames loaded models (with proper timing)

### Element Selection

With non-instanced compressed files:
1. Click any element to select it
2. Selection info panel shows: name, ID, vertices, material
3. Green highlight indicates selected element
4. Press ESC or click "Deselect" to clear selection
5. Click empty space to deselect

---

## Technical Details

### IfcConvert Centering Algorithm

The `--center-model-geometry` flag:
1. Calculates the bounding box of all geometry
2. Computes the center point: `(bbox_min + bbox_max) / 2`
3. Translates all vertices by `-center` offset
4. Results in model centered at world origin (0, 0, 0)

**Example:**
```
Before centering:
  Center: (1782893.91, -18.60, 2959881.26)

After centering:
  Center: (0.00, -18.60, 0.00)
```

### gltfpack Compression

gltfpack uses:
- **Mesh quantization:** Reduce vertex attribute precision (KHR_mesh_quantization)
- **Meshopt compression:** Efficient binary encoding (EXT_meshopt_compression)
- **Index optimization:** Reorder indices for better GPU cache usage
- **Vertex deduplication:** Merge identical vertices

**Flags:**
- `-c`: Basic compression
- `-cc`: Higher compression (more aggressive quantization)
- `-si N`: Simplify meshes to N ratio (0.95 = 95% of original)
- `-v`: Verbose output

### Babylon.js Auto-Framing Fix

**Problem:** Auto-framing didn't work reliably on model load - only worked when manually pressing "Fit to View" button.

**Root Cause:** Camera framing was called immediately after `SceneLoader.ImportMeshAsync()` completed, but before Babylon.js had fully:
- Computed world matrices
- Updated bounding info
- Processed scene graph transformations

**Solution:** Wrap `fitToView()` call in `scene.executeWhenReady()`:

```typescript
// Wait for scene to be ready before framing
sceneRef.current.executeWhenReady(() => {
  console.log('Scene ready, framing model...');
  fitToView(result.meshes);
});
```

This ensures all scene updates are processed before camera framing occurs.

---

## Troubleshooting

### Model is Invisible

**Cause:** Model uses real-world GPS coordinates, positioned millions of units from origin.

**Solution:** Use `--center-model-geometry` flag during IFC conversion.

### Model Won't Auto-Frame

**Cause:** Timing issue - camera framing happens before scene is ready.

**Solution:** Already fixed in `BabylonViewer.tsx` with `scene.executeWhenReady()`.

### Elements Can't Be Selected Individually

**Cause:** Using an instanced GLB file with joined meshes.

**Solution:** Use non-instanced compressed files (`compressed_level2_medium.glb`).

### Geometry is Missing

**Cause:** Using instanced files where the instancing algorithm removed critical nodes.

**Solution:** Use non-instanced compressed files. GPU instancing doesn't work reliably for complex BIM models.

### File is Too Large

**Cause:** Using uncompressed or lightly compressed file.

**Solutions (in order of preference):**
1. Use `compressed_level2_medium.glb` (70MB, no simplification)
2. Use `compressed_level3_high.glb` (65MB, 5% simplification)
3. Consider streaming/LOD approaches for very large models

### Poor Performance / Low FPS

**Solutions:**
1. Enable Scene Optimizer (⚡ button in toolbar)
2. Use Level 3 compression with simplification
3. Implement frustum culling for large scenes
4. Consider mesh merging for static background geometry (non-selectable)
5. Use hardware with better GPU

---

## Lessons Learned

### What Works

✅ **IfcConvert with `--center-model-geometry`**
- Solves invisible model issues caused by GPS coordinates
- Essential for large-scale BIM models
- No geometry loss

✅ **gltfpack compression**
- Reliable 9-10x compression
- All geometry preserved
- Individual element selection maintained
- Good balance of size, quality, and performance

✅ **Non-instanced approach for BIM**
- Predictable behavior
- Individual element selection works
- No geometry loss
- Scene hierarchy preserved

### What Doesn't Work

❌ **GPU Instancing for Complex BIM**
- Breaks scene hierarchies
- Loses geometry (millions of vertices)
- Can't reliably reconstruct transforms
- Not suitable for element selection workflows

❌ **gltf-transform optimize with aggressive flags**
- `--join`: Merges all elements into one mesh
- `--weld`: Discards valid vertices
- `--prune`: Removes needed nodes
- Results in missing/invisible geometry

❌ **Framing before scene is ready**
- Causes unreliable auto-framing
- Must use `scene.executeWhenReady()` callback

### Best Practices

1. **Always center models** during IFC conversion
2. **Use compression** to reduce file size 9-10x
3. **Avoid GPU instancing** for BIM with element selection
4. **Test compression levels** to find best size/quality balance
5. **Use Level 2 Medium** as default recommendation
6. **Wait for scene ready** before camera operations
7. **Preserve scene hierarchies** for complex models

---

## Future Improvements

### Potential Optimizations

1. **Selective Instancing**
   - Instance only simple, repeated elements (e.g., screws, bolts)
   - Keep complex/unique elements non-instanced
   - Requires custom processing pipeline

2. **Level of Detail (LOD)**
   - Generate multiple LOD levels during conversion
   - Use high-poly for close-up, low-poly for distance
   - Switch based on camera distance

3. **Streaming / Progressive Loading**
   - Split large models into spatial chunks
   - Load visible areas first
   - Stream additional geometry as needed

4. **Occlusion Culling**
   - Don't render elements hidden inside buildings
   - Requires preprocessing to mark interior elements

5. **Material Merging**
   - Reduce draw calls by merging similar materials
   - May impact individual element selection

6. **Texture Atlas Generation**
   - Combine multiple textures into atlases
   - Reduces texture switches during rendering

### Tools to Investigate

- **Draco Compression:** Additional geometry compression (may break selection)
- **Basis Universal Textures:** Highly compressed texture format
- **glTF-Pipeline:** Alternative optimization tool
- **Three.js LWOQ:** Level-of-detail generation
- **Cesium 3D Tiles:** For very large models, spatial tiling

---

## References

### Tools

- **IfcOpenShell 0.8.3:** https://ifcopenshell.org/
- **gltfpack 0.25:** https://github.com/zeux/meshoptimizer/tree/master/gltf
- **gltf-transform v4.2.1:** https://gltf-transform.dev/
- **Babylon.js 8.33.4:** https://www.babylonjs.com/

### Documentation

- **IFC Format:** https://technical.buildingsmart.org/standards/ifc/
- **glTF 2.0 Spec:** https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- **EXT_mesh_gpu_instancing:** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_mesh_gpu_instancing
- **KHR_mesh_quantization:** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_mesh_quantization
- **EXT_meshopt_compression:** https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Vendor/EXT_meshopt_compression

---

## Conclusion

For BIM workflows requiring individual element selection:

1. **Convert IFC with centering:** `IfcConvert --center-model-geometry`
2. **Compress with gltfpack Level 2:** `gltfpack -i input.glb -o output.glb -cc`
3. **Use non-instanced files:** `compressed_level2_medium.glb`
4. **Result:** 70MB file with 100% geometry, individual selection, good FPS

**Trade-offs:**
- GPU instancing would give better FPS but breaks geometry and selection
- For BIM viewers, **correctness > raw performance**
- 70MB file size is acceptable for most use cases
- Users get reliable, predictable behavior

This pipeline reduces a 3.3GB IFC file to 70MB (47x compression) while preserving all geometry and selection capabilities.
