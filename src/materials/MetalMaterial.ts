import { Scene, PBRMaterial, Texture } from '@babylonjs/core';

/**
 * Creates a realistic corrugated steel PBR material using the ambientCG CorrugatedSteel007A texture set
 *
 * @param scene - The Babylon scene
 * @param uvScale - UV tiling scale (default: 1.0, larger = more repetition)
 * @returns Configured PBRMaterial for corrugated steel
 */
export function createCorrugatedSteel007Material(scene: Scene, uvScale: number = 1.0): PBRMaterial {
  const material = new PBRMaterial('CorrugatedSteel007_PBR', scene);

  const basePath = '/textures/metal/ambientcg-corrugated-steel-007-a';

  // Albedo/Base Color - the actual metal color
  material.albedoTexture = new Texture(
    `${basePath}/CorrugatedSteel007A_2K-JPG_Color.jpg`,
    scene,
    false, // noMipmap
    true,  // invertY
    Texture.TRILINEAR_SAMPLINGMODE,
    () => console.log('✓ Metal Color texture loaded'),
    (message) => console.error('✗ Metal Color texture failed:', message)
  );

  // Normal Map - creates 3D surface detail (corrugation)
  material.bumpTexture = new Texture(
    `${basePath}/CorrugatedSteel007A_2K-JPG_NormalGL.jpg`,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => console.log('✓ Metal Normal texture loaded'),
    (message) => console.error('✗ Metal Normal texture failed:', message)
  );

  // Metalness Map - defines which parts are metallic
  // For metal, we use the metalness texture directly
  material.metallicTexture = new Texture(
    `${basePath}/CorrugatedSteel007A_2K-JPG_Metalness.jpg`,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => console.log('✓ Metal Metalness texture loaded'),
    (message) => console.error('✗ Metal Metalness texture failed:', message)
  );

  // Roughness texture - separate from metalness for this material
  material.metallicTexture = new Texture(
    `${basePath}/CorrugatedSteel007A_2K-JPG_Roughness.jpg`,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => console.log('✓ Metal Roughness texture loaded'),
    (message) => console.error('✗ Metal Roughness texture failed:', message)
  );
  material.useRoughnessFromMetallicTextureAlpha = false;
  material.useRoughnessFromMetallicTextureGreen = true;

  // Ambient Occlusion - adds depth to corrugation grooves
  material.ambientTexture = new Texture(
    `${basePath}/CorrugatedSteel007A_2K-JPG_AmbientOcclusion.jpg`,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => console.log('✓ Metal AO texture loaded'),
    (message) => console.error('✗ Metal AO texture failed:', message)
  );
  material.useAmbientInGrayScale = true;

  // Material physical properties for metal
  material.metallic = 1.0;   // Fully metallic
  material.roughness = 0.5;  // Semi-rough metal (adjust 0.0-1.0 for shinier/rougher)

  // Apply UV scaling to all texture maps
  const textures = [
    material.albedoTexture,
    material.bumpTexture,
    material.metallicTexture,
    material.ambientTexture
  ];

  textures.forEach(texture => {
    if (texture && texture instanceof Texture) {
      texture.uScale = uvScale;
      texture.vScale = uvScale;
    }
  });

  console.log(`Created CorrugatedSteel007 PBR material with UV scale: ${uvScale}`);

  return material;
}
