import { Vector3, AbstractMesh } from '@babylonjs/core';

/**
 * Utility functions for the Babylon.js viewer
 */

/**
 * Calculate bounding box for a collection of meshes
 */
export const calculateBoundingBox = (meshes: AbstractMesh[]) => {
  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);

  console.log(`Calculating bounding box for ${meshes.length} meshes...`);
  let validMeshCount = 0;
  let skippedMeshCount = 0;

  meshes.forEach((mesh, index) => {
    // Skip root node
    if (mesh.name === '__root__') {
      skippedMeshCount++;
      return;
    }

    // Force update world matrix
    mesh.computeWorldMatrix(true);

    try {
      const boundingInfo = mesh.getBoundingInfo();

      if (!boundingInfo || !boundingInfo.boundingBox) {
        skippedMeshCount++;
        return;
      }

      const meshMin = boundingInfo.boundingBox.minimumWorld;
      const meshMax = boundingInfo.boundingBox.maximumWorld;

      // Debug first few meshes
      if (index < 5) {
        console.log(`Mesh ${index} (${mesh.name}): min=(${meshMin.x.toFixed(2)}, ${meshMin.y.toFixed(2)}, ${meshMin.z.toFixed(2)}), max=(${meshMax.x.toFixed(2)}, ${meshMax.y.toFixed(2)}, ${meshMax.z.toFixed(2)})`);
      }

      // Skip if bounding box is invalid
      if (meshMin.equals(meshMax)) {
        skippedMeshCount++;
        return;
      }

      min = Vector3.Minimize(min, meshMin);
      max = Vector3.Maximize(max, meshMax);
      validMeshCount++;
    } catch (error) {
      console.warn(`Error processing mesh ${index}:`, error);
      skippedMeshCount++;
    }
  });

  console.log(`Valid meshes: ${validMeshCount}, Skipped: ${skippedMeshCount}`);
  console.log(`Final bounding box: min=(${min.x.toFixed(2)}, ${min.y.toFixed(2)}, ${min.z.toFixed(2)}), max=(${max.x.toFixed(2)}, ${max.y.toFixed(2)}, ${max.z.toFixed(2)})`);

  return { min, max };
};

/**
 * Calculate center and maximum dimension from bounding box
 */
export const getBoundingBoxInfo = (min: Vector3, max: Vector3) => {
  const center = Vector3.Center(min, max);
  const size = max.subtract(min);
  const maxDim = Math.max(size.x, size.y, size.z);

  return { center, size, maxDim };
};

/**
 * Prevent default drag event behavior
 */
export const preventDragDefaults = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

/**
 * Check if file has valid extension
 */
export const isValidFileExtension = (filename: string, extension: string): boolean => {
  return filename.toLowerCase().endsWith(extension);
};
