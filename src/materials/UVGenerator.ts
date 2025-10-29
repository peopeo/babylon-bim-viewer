import { Mesh } from '@babylonjs/core';

/**
 * Generates UV coordinates for meshes that don't have them
 * Uses planar projection based on mesh orientation
 */
export class UVGenerator {
  /**
   * Generate planar UV coordinates for a mesh
   *
   * @param mesh - The mesh to generate UVs for
   * @param scale - UV scale factor (smaller = larger texture pattern)
   */
  static generatePlanarUVs(mesh: Mesh, scale: number = 1.0): void {
    // Check if mesh already has UVs
    if (mesh.isVerticesDataPresent('uv')) {
      return;
    }

    const positions = mesh.getVerticesData('position');
    if (!positions) {
      console.warn(`Cannot generate UVs for mesh "${mesh.name}" - no position data`);
      return;
    }

    const vertexCount = positions.length / 3;
    const uvs = new Float32Array(vertexCount * 2);

    // Get mesh bounding box to determine best projection plane
    const boundingInfo = mesh.getBoundingInfo();
    const size = boundingInfo.maximum.subtract(boundingInfo.minimum);

    // Determine which plane to project onto based on mesh dimensions
    // Use the plane with the largest area (assumes walls are larger in XY, YZ, or XZ)
    let useXY = false, useXZ = false;

    const areaXY = size.x * size.y;
    const areaXZ = size.x * size.z;
    const areaYZ = size.y * size.z;

    if (areaXY >= areaXZ && areaXY >= areaYZ) {
      useXY = true; // Wall facing Z direction
    } else if (areaXZ >= areaXY && areaXZ >= areaYZ) {
      useXZ = true; // Floor/ceiling (horizontal)
    }
    // else: use YZ plane (for walls facing X direction)

    // Generate UVs based on world coordinates
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      let u: number, v: number;

      if (useXY) {
        // Project onto XY plane (for walls facing Z)
        u = x * scale;
        v = y * scale;
      } else if (useXZ) {
        // Project onto XZ plane (for floors/ceilings)
        u = x * scale;
        v = z * scale;
      } else {
        // Project onto YZ plane (for walls facing X)
        u = z * scale;
        v = y * scale;
      }

      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }

    // Apply UV data to mesh
    mesh.setVerticesData('uv', uvs);

    console.log(`✓ Generated planar UVs for mesh "${mesh.name}" (projection: ${useXY ? 'XY' : useXZ ? 'XZ' : 'YZ'})`);
  }

  /**
   * Generate box/cube mapping UVs (better for complex geometry)
   * Projects UVs from all 6 directions and picks the best one per face
   *
   * @param mesh - The mesh to generate UVs for
   * @param scale - UV scale factor
   */
  static generateBoxUVs(mesh: Mesh, scale: number = 1.0): void {
    // Check if mesh already has UVs
    if (mesh.isVerticesDataPresent('uv')) {
      return;
    }

    const positions = mesh.getVerticesData('position');
    const normals = mesh.getVerticesData('normal');

    if (!positions || !normals) {
      console.warn(`Cannot generate box UVs for mesh "${mesh.name}" - missing data`);
      return;
    }

    const vertexCount = positions.length / 3;
    const uvs = new Float32Array(vertexCount * 2);

    // For each vertex, use its normal to determine which plane to project onto
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];

      const nx = normals[i * 3];
      const ny = normals[i * 3 + 1];
      const nz = normals[i * 3 + 2];

      // Determine dominant axis from normal
      const absNx = Math.abs(nx);
      const absNy = Math.abs(ny);
      const absNz = Math.abs(nz);

      let u: number, v: number;

      if (absNx >= absNy && absNx >= absNz) {
        // Normal points mostly in X direction - use YZ plane
        u = z * scale;
        v = y * scale;
      } else if (absNy >= absNx && absNy >= absNz) {
        // Normal points mostly in Y direction - use XZ plane
        u = x * scale;
        v = z * scale;
      } else {
        // Normal points mostly in Z direction - use XY plane
        u = x * scale;
        v = y * scale;
      }

      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
    }

    // Apply UV data to mesh
    mesh.setVerticesData('uv', uvs);

    console.log(`✓ Generated box UVs for mesh "${mesh.name}"`);
  }
}
