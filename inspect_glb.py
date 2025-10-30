#!/usr/bin/env python3
"""
Quick GLB inspection to check bounding box and mesh count
"""

import sys
import json
import struct
from pathlib import Path

def inspect_glb(glb_path):
    """Inspect GLB file structure"""

    print("=" * 80)
    print(f"INSPECTING GLB: {glb_path}")
    print("=" * 80)

    file_size = Path(glb_path).stat().st_size
    print(f"\nFile Size: {file_size / (1024**2):.2f} MB")

    with open(glb_path, 'rb') as f:
        # Read GLB header
        magic = f.read(4)
        version = struct.unpack('<I', f.read(4))[0]
        length = struct.unpack('<I', f.read(4))[0]

        print(f"GLB Version: {version}")
        print(f"Total Length: {length:,} bytes")

        # Read JSON chunk
        chunk_length = struct.unpack('<I', f.read(4))[0]
        chunk_type = f.read(4)

        if chunk_type == b'JSON':
            json_data = f.read(chunk_length).decode('utf-8')
            gltf = json.loads(json_data)

            print(f"\n=== GLTF STRUCTURE ===")

            # Meshes
            if 'meshes' in gltf:
                print(f"Meshes: {len(gltf['meshes'])}")
                total_primitives = sum(len(mesh.get('primitives', [])) for mesh in gltf['meshes'])
                print(f"Total Primitives: {total_primitives}")

            # Materials
            if 'materials' in gltf:
                print(f"Materials: {len(gltf['materials'])}")

            # Nodes
            if 'nodes' in gltf:
                print(f"Nodes: {len(gltf['nodes'])}")

            # Accessors (vertex data)
            if 'accessors' in gltf:
                print(f"Accessors: {len(gltf['accessors'])}")

                # Count total vertices
                total_vertices = 0
                for accessor in gltf['accessors']:
                    if accessor.get('type') == 'VEC3':
                        total_vertices += accessor.get('count', 0)
                print(f"Approximate Vertices: {total_vertices:,}")

            # Extensions
            if 'extensionsUsed' in gltf:
                print(f"\nExtensions Used:")
                for ext in gltf['extensionsUsed']:
                    print(f"  - {ext}")

            # Check for scene bounds in nodes
            print(f"\n=== CHECKING COORDINATE BOUNDS ===")

            # Sample some mesh translations
            if 'nodes' in gltf:
                translations = []
                for node in gltf['nodes'][:100]:  # Sample first 100
                    if 'translation' in node:
                        translations.append(node['translation'])

                if translations:
                    min_x = min(t[0] for t in translations)
                    max_x = max(t[0] for t in translations)
                    min_y = min(t[1] for t in translations)
                    max_y = max(t[1] for t in translations)
                    min_z = min(t[2] for t in translations)
                    max_z = max(t[2] for t in translations)

                    print(f"Translation Bounds (sampled {len(translations)} nodes):")
                    print(f"  X: {min_x:.2f} to {max_x:.2f}")
                    print(f"  Y: {min_y:.2f} to {max_y:.2f}")
                    print(f"  Z: {min_z:.2f} to {max_z:.2f}")

                    center_x = (min_x + max_x) / 2
                    center_y = (min_y + max_y) / 2
                    center_z = (min_z + max_z) / 2

                    print(f"\nApproximate Center: ({center_x:.2f}, {center_y:.2f}, {center_z:.2f})")

                    distance = (center_x**2 + center_y**2 + center_z**2) ** 0.5
                    print(f"Distance from Origin: {distance:.2f} units")

                    if distance < 100:
                        print("✓ Model is well-centered (close to origin)")
                    elif distance < 1000:
                        print("⚠️ Model is moderately far from origin")
                    else:
                        print("❌ Model is very far from origin - may have visibility issues")
                else:
                    print("No node translations found (meshes may use identity transforms)")

    print("\n" + "=" * 80)
    print("INSPECTION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inspect_glb.py <glb_file>")
        sys.exit(1)

    inspect_glb(sys.argv[1])
