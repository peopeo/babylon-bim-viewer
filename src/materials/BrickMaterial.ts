import { Scene, PBRMaterial, Texture } from '@babylonjs/core';

/**
 * Creates a realistic brick PBR material using the ambientCG Bricks051 texture set
 *
 * @param scene - The Babylon scene
 * @param uvScale - UV tiling scale (default: 1.0, larger = more repetition)
 * @returns Configured PBRMaterial for bricks
 */
export function createBricks051Material(scene: Scene, uvScale: number = 1.0): PBRMaterial {
  const material = new PBRMaterial('Bricks051_PBR', scene);

  const basePath = '/textures/bricks/ambientcg-bricks-051';

  // Albedo/Base Color - the actual brick color and appearance
  material.albedoTexture = new Texture(
    `${basePath}/Bricks051_2K-JPG_Color.jpg`,
    scene,
    false, // noMipmap
    true,  // invertY
    Texture.TRILINEAR_SAMPLINGMODE,
    () => console.log('✓ Albedo texture loaded'),
    (message) => console.error('✗ Albedo texture failed:', message)
  );

  // Normal Map - creates 3D surface detail and depth
  // Note: Using NormalGL (OpenGL format) - BabylonJS uses OpenGL convention
  material.bumpTexture = new Texture(
    `${basePath}/Bricks051_2K-JPG_NormalGL.jpg`,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => console.log('✓ Normal texture loaded'),
    (message) => console.error('✗ Normal texture failed:', message)
  );

  // Roughness Map - controls how rough/smooth the surface appears
  // stored in the metallic texture's green channel
  material.metallicTexture = new Texture(
    `${basePath}/Bricks051_2K-JPG_Roughness.jpg`,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
    () => console.log('✓ Roughness texture loaded'),
    (message) => console.error('✗ Roughness texture failed:', message)
  );
  material.useRoughnessFromMetallicTextureAlpha = false;
  material.useRoughnessFromMetallicTextureGreen = true;

  // Optional: Displacement/Height map for parallax effect
  // Uncomment for extra depth (slight performance cost)
  /*
  const displacementTexture = new Texture(
    `${basePath}/Bricks051_2K-JPG_Displacement.jpg`,
    scene
  );
  material.bumpTexture = displacementTexture;
  material.useParallax = true;
  material.useParallaxOcclusion = true;
  material.parallaxScaleBias = 0.05;
  */

  // Material physical properties
  material.metallic = 0.0;  // Bricks are not metallic
  material.roughness = 0.9; // Bricks are rough (adjust 0.0-1.0 for more/less shininess)

  // Apply UV scaling to all texture maps
  // Smaller values = larger brick pattern (less repetition)
  // Larger values = smaller brick pattern (more repetition)
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

  console.log(`Created Bricks051 PBR material with UV scale: ${uvScale}`);

  return material;
}
