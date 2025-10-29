# BIM Viewer Material System Guide

## Overview

This guide explains the realistic material system implemented in the Babylon BIM Viewer. The system automatically applies physically-based rendering (PBR) materials with realistic textures to BIM models, replacing simple colored materials with detailed, photorealistic textures.

## Key Features

- **Automatic Material Replacement**: Detects material names in GLB files and applies realistic PBR textures
- **UV Coordinate Generation**: Automatically generates UV coordinates for meshes that lack them (common in IFC→GLB conversions)
- **PBR Textures**: Uses high-quality textures from [ambientCG](https://ambientcg.com) with full PBR maps (albedo, normal, roughness, metalness, ambient occlusion)
- **Smart Matching**: Pattern-based material name matching supports multiple languages
- **Extensible**: Easy to add new material types

## Architecture

### File Structure

```
src/materials/
├── BrickMaterial.ts        # Brick texture material creator
├── MetalMaterial.ts        # Metal texture material creator
├── MaterialLibrary.ts      # Main material management system
└── UVGenerator.ts          # UV coordinate generation utilities

public/textures/
├── bricks/
│   └── ambientcg-bricks-051/
│       ├── Bricks051_2K-JPG_Color.jpg
│       ├── Bricks051_2K-JPG_NormalGL.jpg
│       ├── Bricks051_2K-JPG_Roughness.jpg
│       └── ... (other texture maps)
└── metal/
    └── ambientcg-corrugated-steel-007-a/
        ├── CorrugatedSteel007A_2K-JPG_Color.jpg
        ├── CorrugatedSteel007A_2K-JPG_NormalGL.jpg
        ├── CorrugatedSteel007A_2K-JPG_Metalness.jpg
        └── ... (other texture maps)
```

### How It Works

1. **Model Loading**: When a GLB file is loaded, all meshes are analyzed
2. **Material Detection**: Original material names are examined (e.g., "Masonry - Brick", "Metal - Steel")
3. **Pattern Matching**: Material names are matched against known patterns
4. **UV Check**: System checks if mesh has UV coordinates
5. **UV Generation**: If missing, UV coordinates are automatically generated using box mapping
6. **Material Application**: Realistic PBR material with textures is applied to the mesh

## Implemented Materials

### 1. Bricks (Bricks051)

**Texture Source**: ambientCG - Bricks051
**Type**: Terracotta/orange brick with light grey mortar
**Resolution**: 2K JPG (optimized for web)

**Material Properties**:
- Metallic: 0.0 (non-metallic)
- Roughness: 0.9 (very rough surface)
- Albedo: Orange-red brick color
- Normal map: Brick surface detail and mortar gaps
- Roughness map: Varying roughness across surface

**Pattern Matching**:
- `brick` (English)
- `ziegel` (German)

**Example Matches**:
- "Masonry - Brick"
- "Brick, Common"
- "Brick Soldier Course"
- "Ziegel"

### 2. Corrugated Steel (CorrugatedSteel007A)

**Texture Source**: ambientCG - CorrugatedSteel007A
**Type**: Light grey corrugated metal sheet
**Resolution**: 2K JPG (optimized for web)

**Material Properties**:
- Metallic: 1.0 (fully metallic)
- Roughness: 0.5 (semi-rough metal)
- Albedo: Grey metal color
- Normal map: Corrugation detail
- Metalness map: Defines metallic areas
- Roughness map: Varying roughness
- Ambient Occlusion: Depth in corrugation grooves

**Pattern Matching**:
- `metal` (English)
- `steel` (English)
- `stahl` (German)
- `iron` (English)
- `aluminum`, `aluminium` (English)

**Example Matches**:
- "Metal - Steel"
- "Structural Steel"
- "Aluminum Panel"

## UV Coordinate Generation

### The Problem

IFC files often don't include UV coordinates (texture mapping information). When converted to GLB, meshes may lack the data needed to apply textures correctly. Without UVs, textures won't display properly.

### The Solution: UVGenerator

The system includes an automatic UV generator with two projection methods:

#### Box Mapping (Primary Method)

Uses vertex normals to determine the best projection plane for each vertex:

```typescript
UVGenerator.generateBoxUVs(mesh, scale);
```

- Analyzes each vertex's normal direction
- Projects from 6 directions (±X, ±Y, ±Z)
- Picks the best projection based on surface orientation
- Works well for complex geometry like walls at different angles

**Scale Parameter**:
- Higher values = smaller texture pattern (more repetition)
- Lower values = larger texture pattern (less repetition)
- Current default: 0.5
- Typical range: 0.1 - 2.0

#### Planar Mapping (Alternative Method)

Projects entire mesh onto a single plane:

```typescript
UVGenerator.generatePlanarUVs(mesh, scale);
```

- Analyzes mesh bounding box
- Chooses XY, XZ, or YZ plane based on largest area
- Simpler but less accurate for complex geometry

### UV Scale Adjustment

Current UV scale: **0.5**

To adjust globally for all materials:

```typescript
// In MaterialLibrary.ts, line 98
UVGenerator.generateBoxUVs(mesh, 0.5); // Change this value

// Examples:
// 0.1 = very large bricks/pattern
// 0.5 = current size
// 1.0 = smaller bricks (more repetition)
// 2.0 = very small bricks (high repetition)
```

## Lighting Configuration

The scene lighting has been optimized to show PBR materials properly:

**Hemispheric Light**:
- Intensity: 1.2 (provides ambient/fill lighting)
- Direction: Upward (0, 1, 0)

**Directional Light**:
- Intensity: 1.5 (main light source)
- Direction: (-1, -2, -1)
- Position: (20, 40, 20)
- Casts shadows

**Environment Intensity**:
- Value: 1.5
- Crucial for PBR reflections and ambient lighting
- Makes materials appear less dull and more realistic

**Background Color**:
- RGB: (0.5, 0.5, 0.55)
- Light grey to provide better contrast

## Adding New Materials

### Step 1: Download Textures

1. Visit [ambientCG.com](https://ambientcg.com)
2. Search for desired material (concrete, wood, metal, etc.)
3. Download **2K-JPG** version (best balance of quality/performance)
4. Extract to `public/textures/{category}/{material-name}/`

**Required Texture Maps**:
- `*_Color.jpg` - Base color/albedo
- `*_NormalGL.jpg` - Surface detail (use GL, not DX)
- `*_Roughness.jpg` - Surface roughness

**Optional but Recommended**:
- `*_AmbientOcclusion.jpg` - Shadows in crevices
- `*_Metalness.jpg` - For metallic materials
- `*_Displacement.jpg` - Height information (performance cost)

### Step 2: Create Material Function

Create `src/materials/{MaterialType}Material.ts`:

```typescript
import { Scene, PBRMaterial, Texture } from '@babylonjs/core';

export function createYourMaterial(scene: Scene, uvScale: number = 1.0): PBRMaterial {
  const material = new PBRMaterial('YourMaterial_PBR', scene);
  const basePath = '/textures/category/your-material-name';

  // Albedo/Base Color
  material.albedoTexture = new Texture(
    `${basePath}/YourMaterial_2K-JPG_Color.jpg`,
    scene,
    false, // noMipmap
    true,  // invertY
    Texture.TRILINEAR_SAMPLINGMODE,
    () => console.log('✓ Albedo loaded'),
    (message) => console.error('✗ Albedo failed:', message)
  );

  // Normal Map
  material.bumpTexture = new Texture(
    `${basePath}/YourMaterial_2K-JPG_NormalGL.jpg`,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => console.log('✓ Normal loaded'),
    (message) => console.error('✗ Normal failed:', message)
  );

  // Roughness
  material.metallicTexture = new Texture(
    `${basePath}/YourMaterial_2K-JPG_Roughness.jpg`,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => console.log('✓ Roughness loaded'),
    (message) => console.error('✗ Roughness failed:', message)
  );
  material.useRoughnessFromMetallicTextureAlpha = false;
  material.useRoughnessFromMetallicTextureGreen = true;

  // Material properties
  material.metallic = 0.0;   // 0.0 = non-metal, 1.0 = fully metallic
  material.roughness = 0.8;  // 0.0 = mirror, 1.0 = completely rough

  // Apply UV scaling
  const textures = [
    material.albedoTexture,
    material.bumpTexture,
    material.metallicTexture
  ];

  textures.forEach(texture => {
    if (texture && texture instanceof Texture) {
      texture.uScale = uvScale;
      texture.vScale = uvScale;
    }
  });

  console.log(`Created YourMaterial with UV scale: ${uvScale}`);
  return material;
}
```

### Step 3: Register in MaterialLibrary

Edit `src/materials/MaterialLibrary.ts`:

```typescript
// 1. Import your material function
import { createYourMaterial } from './YourMaterialMaterial';

// 2. Add getter method
getYourMaterial(uvScale: number = 1.0): PBRMaterial {
  const key = `YourMaterial_${uvScale}`;
  if (!this.materials.has(key)) {
    const material = createYourMaterial(this.scene, uvScale);
    this.materials.set(key, material);
  }
  return this.materials.get(key)!;
}

// 3. Add pattern matching in getMaterialForName()
getMaterialForName(originalName: string, uvScale: number = 1.0): PBRMaterial | null {
  const lowerName = originalName.toLowerCase();

  // ... existing matches ...

  // Your new material patterns
  if (lowerName.includes('concrete') ||
      lowerName.includes('beton') ||
      lowerName.includes('cement')) {
    return this.getYourMaterial(uvScale);
  }

  return null;
}
```

### Step 4: Test

1. Reload the viewer
2. Load a GLB file with materials matching your patterns
3. Check browser console for:
   - Material replacement messages
   - Texture loading confirmation
   - UV generation warnings/confirmations

## Texture Organization Best Practices

### Directory Structure

```
public/textures/
├── bricks/
│   ├── ambientcg-bricks-051/
│   ├── ambientcg-bricks-013/
│   └── ambientcg-bricks-027/
├── concrete/
│   ├── ambientcg-concrete-001/
│   └── ambientcg-concrete-rough-001/
├── wood/
│   ├── ambientcg-wood-planks-001/
│   └── ambientcg-wood-floor-007/
└── metal/
    ├── ambientcg-corrugated-steel-007-a/
    └── ambientcg-metal-rusty-001/
```

### Naming Conventions

- Use lowercase with hyphens
- Include source prefix (e.g., `ambientcg-`)
- Include material name and variant
- Keep texture file names unchanged from download

### File Size Considerations

**Recommended Resolution: 2K-JPG**
- Good quality-to-size ratio
- Typical size: 1-8 MB per texture
- Fast loading on modern connections
- Sufficient detail for web viewing

**When to use other resolutions**:
- 1K-JPG: Mobile devices, slower connections (smaller pattern)
- 4K-JPG: Very close-up views, high-end displays (larger files)

## Performance Optimization

### Texture Loading

- Textures load asynchronously (non-blocking)
- Mipmaps generated automatically for distance rendering
- Trilinear sampling for smooth appearance

### Material Sharing

The MaterialLibrary caches materials:
```typescript
// Same material instance reused across multiple meshes
const material = matLib.getBricks051(1.0);
// Uses cached instance if already created
```

This saves GPU memory when many meshes use the same material.

### UV Generation Performance

UV generation happens once per mesh during load:
- Fast: ~1ms per mesh typically
- Only runs if UVs are missing
- Results stored in mesh vertex data

## Troubleshooting

### Textures Not Displaying

**Problem**: Materials show solid color instead of texture

**Solutions**:
1. Check browser console for texture loading errors
2. Verify texture file paths are correct
3. Ensure textures are in `public/textures/` directory
4. Check that dev server is running and serving files
5. Look for UV generation warnings in console

### Textures Too Large/Small

**Problem**: Brick pattern appears wrong size

**Solution**: Adjust UV scale in `MaterialLibrary.ts`:
```typescript
// Line 98 - increase for smaller pattern, decrease for larger
UVGenerator.generateBoxUVs(mesh, 0.5); // Try 1.0, 0.2, etc.
```

### Materials Look Dull

**Problem**: Materials appear flat and lifeless

**Solutions**:
1. Increase lighting intensity in `BabylonViewer.config.ts`
2. Adjust `scene.environmentIntensity` in `BabylonViewer.tsx`
3. Check that normal maps are loading (look for ✓ messages)
4. Verify using `*_NormalGL.jpg` not `*_NormalDX.jpg`

### Wrong Material Applied

**Problem**: Steel texture applied to wood elements

**Solution**: Add more specific pattern matching:
```typescript
// More specific patterns first
if (lowerName.includes('wood floor')) {
  return this.getWoodFloor(uvScale);
}
// Less specific patterns after
if (lowerName.includes('wood')) {
  return this.getWood(uvScale);
}
```

### Performance Issues with Large Models

**Solutions**:
1. Reduce texture resolution (use 1K instead of 2K)
2. Disable displacement maps (commented out by default)
3. Reduce lighting intensity
4. Enable Scene Optimizer (already active)

## Console Output Reference

### Successful Material Application

```
=== APPLYING REALISTIC MATERIALS ===
Created Bricks051 PBR material with UV scale: 1
Replacing "Masonry - Brick" with Bricks051_PBR
⚠️ Mesh "1IjDNnD1b6tenKMZR0qHo2" has no UV coordinates! Generating planar UVs...
✓ Generated box UVs for mesh "1IjDNnD1b6tenKMZR0qHo2"
✓ Albedo texture loaded
✓ Normal texture loaded
✓ Roughness texture loaded
=== MATERIAL APPLICATION COMPLETE ===
Total meshes with materials: 5600
Materials replaced: 34
Material usage:
  Bricks051_PBR: 34 meshes
```

### Texture Loading Errors

```
✗ Albedo texture failed: 404 Not Found
```
**Fix**: Check file path and ensure file exists in `public/textures/`

## Future Enhancements

### Planned Materials
- Concrete (smooth and rough variants)
- Wood (planks and flooring)
- Glass (transparent materials)
- Painted surfaces
- Tile/ceramic
- Stone

### Advanced Features
- User-selectable material variants (light/dark brick, etc.)
- Material editor UI for runtime adjustments
- Custom texture upload capability
- Material presets/themes
- Displacement mapping toggle
- Per-material UV scale adjustment

## Technical Details

### PBR Material Properties

**Albedo (Base Color)**:
- RGB color values
- No lighting information baked in
- Pure material color

**Normal Map**:
- RGB channels encode surface normals
- Creates illusion of 3D detail
- OpenGL format (Y+ up)

**Roughness**:
- Single channel (0.0 - 1.0)
- 0.0 = perfect mirror
- 1.0 = completely diffuse
- Often stored in green channel of metallic texture

**Metallic**:
- Single channel (0.0 - 1.0)
- 0.0 = dielectric (non-metal)
- 1.0 = conductor (metal)
- Affects how light reflects

**Ambient Occlusion**:
- Single channel darkening
- Simulates shadows in crevices
- Multiplied with final lighting

### BabylonJS Integration

Materials integrate with:
- Shadow system (all materials cast/receive shadows)
- Scene optimizer (texture optimization pass)
- Inspector (material properties visible in debug mode)
- Lighting system (PBR lighting model)

## Resources

- [ambientCG](https://ambientcg.com) - Free PBR texture library
- [BabylonJS PBR Materials](https://doc.babylonjs.com/features/featuresDeepDive/materials/using/masterPBR)
- [PBR Theory](https://learnopengl.com/PBR/Theory)

## Credits

**Textures**: [ambientCG](https://ambientcg.com) by Lennart Demes (CC0 License)

**Texture Sets Used**:
- Bricks051 (Terracotta brick)
- CorrugatedSteel007A (Light grey corrugated metal)

## License

Material system code: Project license (check repository)
Textures: CC0 (Public Domain) from ambientCG
