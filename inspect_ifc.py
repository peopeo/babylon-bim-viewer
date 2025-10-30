#!/usr/bin/env python3
"""
Inspect IFC file to understand coordinate system and structure
"""

import sys
import ifcopenshell
import ifcopenshell.geom
from pathlib import Path

def inspect_ifc(ifc_path):
    """Inspect IFC file and report key information"""

    print("=" * 80)
    print(f"INSPECTING: {ifc_path}")
    print("=" * 80)

    # Load file
    print("\n1. Loading IFC file...")
    ifc = ifcopenshell.open(str(ifc_path))

    # Basic info
    print(f"\n2. Basic Information:")
    print(f"   Schema: {ifc.schema}")
    file_size_mb = Path(ifc_path).stat().st_size / (1024**2)
    print(f"   File size: {file_size_mb:.2f} MB")

    # Count elements
    print(f"\n3. Element Counts:")
    products = ifc.by_type("IfcProduct")
    print(f"   Total IfcProduct: {len(products)}")

    # Key building elements
    element_types = [
        "IfcWall", "IfcSlab", "IfcBeam", "IfcColumn",
        "IfcDoor", "IfcWindow", "IfcSpace", "IfcBuildingStorey"
    ]
    for elem_type in element_types:
        count = len(ifc.by_type(elem_type))
        if count > 0:
            print(f"   {elem_type}: {count}")

    # Site location (GPS coordinates)
    print(f"\n4. Site Location (GPS Coordinates):")
    sites = ifc.by_type("IfcSite")
    if sites:
        for site in sites:
            print(f"   Site: {site.Name}")
            if hasattr(site, 'RefLatitude') and site.RefLatitude:
                print(f"   Latitude: {site.RefLatitude}")
            if hasattr(site, 'RefLongitude') and site.RefLongitude:
                print(f"   Longitude: {site.RefLongitude}")
            if hasattr(site, 'RefElevation') and site.RefElevation:
                print(f"   Elevation: {site.RefElevation}")
    else:
        print("   No IfcSite found")

    # Project info
    print(f"\n5. Project Information:")
    projects = ifc.by_type("IfcProject")
    if projects:
        project = projects[0]
        print(f"   Name: {project.Name}")
        print(f"   Description: {project.Description}")

    # Geometric representation context
    print(f"\n6. Geometric Representation Context:")
    contexts = ifc.by_type("IfcGeometricRepresentationContext")
    for ctx in contexts:
        print(f"   Context Type: {ctx.ContextType}")
        if hasattr(ctx, 'WorldCoordinateSystem'):
            wcs = ctx.WorldCoordinateSystem
            if hasattr(wcs, 'Location'):
                loc = wcs.Location
                if hasattr(loc, 'Coordinates'):
                    print(f"   World Origin: {loc.Coordinates}")

    # Calculate bounding box
    print(f"\n7. Analyzing Geometry Extents...")
    print("   (This may take a minute...)")

    try:
        # Configure geometry settings
        settings = ifcopenshell.geom.settings()
        settings.set('use-world-coords', True)

        # Sample some elements to get coordinate ranges
        min_x = min_y = min_z = float('inf')
        max_x = max_y = max_z = float('-inf')

        sample_size = min(100, len(products))  # Sample first 100 products
        print(f"   Sampling {sample_size} elements...")

        for i, product in enumerate(products[:sample_size]):
            if i % 20 == 0:
                print(f"   Progress: {i}/{sample_size}...", end='\r')

            try:
                shape = ifcopenshell.geom.create_shape(settings, product)

                # Get transformation matrix
                m = shape.transformation.matrix.data
                # Translation is in the last column
                x, y, z = m[3], m[7], m[11]

                min_x = min(min_x, x)
                min_y = min(min_y, y)
                min_z = min(min_z, z)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
                max_z = max(max_z, z)
            except:
                continue

        print(f"\n   Bounding Box (sampled):")
        print(f"   Min: ({min_x:.2f}, {min_y:.2f}, {min_z:.2f})")
        print(f"   Max: ({max_x:.2f}, {max_y:.2f}, {max_z:.2f})")
        print(f"   Center: ({(min_x+max_x)/2:.2f}, {(min_y+max_y)/2:.2f}, {(min_z+max_z)/2:.2f})")
        print(f"   Size: ({max_x-min_x:.2f}, {max_y-min_y:.2f}, {max_z-min_z:.2f})")

        # Check if coordinates are far from origin
        center_dist = ((min_x+max_x)/2)**2 + ((min_y+max_y)/2)**2 + ((min_z+max_z)/2)**2
        center_dist = center_dist ** 0.5

        print(f"\n8. Coordinate System Analysis:")
        print(f"   Distance from origin: {center_dist:.2f} units")

        if center_dist > 10000:
            print(f"   ⚠️  WARNING: Model is FAR from origin!")
            print(f"   ⚠️  This will cause precision issues in WebGL")
            print(f"   ⚠️  SOLUTION: Use --center-model-geometry flag")
        elif center_dist > 1000:
            print(f"   ⚠️  CAUTION: Model is moderately far from origin")
            print(f"   ⚠️  Recommend: Use --center-model-geometry flag")
        else:
            print(f"   ✓ Model is reasonably close to origin")
            print(f"   ✓ --center-model-geometry optional (but still recommended)")

    except Exception as e:
        print(f"   Error analyzing geometry: {e}")

    print("\n" + "=" * 80)
    print("INSPECTION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python inspect_ifc.py <ifc_file>")
        sys.exit(1)

    inspect_ifc(sys.argv[1])
