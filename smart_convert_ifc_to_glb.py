#!/usr/bin/env python3
"""
Smart IFC to GLB converter that automatically detects if centering is needed
"""

import sys
import subprocess
import ifcopenshell
import ifcopenshell.util.geolocation as geolocation
from pathlib import Path

def check_needs_centering(ifc_path):
    """
    Check if IFC file needs --center-model-geometry flag
    Uses proper IFC georeferencing detection via IfcMapConversion/IfcProjectedCRS
    Returns True if model uses map coordinates (GPS/georeferencing)
    """
    print("\n" + "=" * 80)
    print("ANALYZING IFC FILE FOR COORDINATE SYSTEM")
    print("=" * 80)

    ifc = ifcopenshell.open(str(ifc_path))

    print(f"\nIFC Schema: {ifc.schema}")
    print(f"IFC File: {Path(ifc_path).name}")

    # Method 1: Check for proper georeferencing (IFC4 IfcMapConversion or IFC2X3 ePSet)
    print("\n1. Checking for IFC Georeferencing (IfcMapConversion/IfcProjectedCRS)...")

    try:
        coords = geolocation.get_helmert_transformation_parameters(ifc)

        if coords is not None:
            print("   ✓ Found georeferencing transformation parameters!")
            print(f"   Eastings:  {coords.get('Eastings', 'N/A')}")
            print(f"   Northings: {coords.get('Northings', 'N/A')}")
            print(f"   OrthogonalHeight: {coords.get('OrthogonalHeight', 'N/A')}")
            print(f"   Scale: {coords.get('Scale', 'N/A')}")

            # Check if offsets are significant
            eastings = coords.get('Eastings', 0)
            northings = coords.get('Northings', 0)

            if abs(eastings) > 1000 or abs(northings) > 1000:
                print(f"\n   ⚠️  Large coordinate offsets detected:")
                print(f"   Eastings={eastings:.2f}, Northings={northings:.2f}")
                print("\n   🎯 DECISION: Model uses MAP COORDINATES (georeferenced)")
                print("   🎯 Will use --center-model-geometry flag")
                return True
            else:
                print(f"\n   ℹ️  Small offsets: Eastings={eastings:.2f}, Northings={northings:.2f}")
                print("   May not need centering, checking IfcSite...")
        else:
            print("   ℹ️  No IfcMapConversion/ePSet_MapConversion found")

    except Exception as e:
        print(f"   ⚠️  Could not read georeferencing: {e}")

    # Method 2: Check IfcSite Latitude/Longitude (fallback)
    print("\n2. Checking IfcSite Latitude/Longitude...")

    sites = ifc.by_type("IfcSite")
    if sites:
        for site in sites:
            site_name = site.Name if hasattr(site, 'Name') else "Unnamed"
            print(f"   Site: {site_name}")

            has_coords = False
            if hasattr(site, 'RefLatitude') and site.RefLatitude:
                lat = site.RefLatitude
                if lat != (0, 0, 0) and lat != (0, 0, 0, 0):
                    print(f"   ✓ Latitude: {lat}")
                    has_coords = True

            if hasattr(site, 'RefLongitude') and site.RefLongitude:
                lon = site.RefLongitude
                if lon != (0, 0, 0) and lon != (0, 0, 0, 0):
                    print(f"   ✓ Longitude: {lon}")
                    has_coords = True

            if has_coords:
                print("\n   🎯 DECISION: GPS coordinates found in IfcSite")
                print("   🎯 Will use --center-model-geometry flag")
                return True
            else:
                print(f"   ℹ️  No GPS coordinates (Lat/Lon are zero or not set)")
    else:
        print("   ℹ️  No IfcSite found in model")

    # Method 3: Check world coordinate system
    print("\n3. Checking World Coordinate System...")
    try:
        wcs = geolocation.get_wcs(ifc)
        if wcs is not None:
            print("   ✓ World Coordinate System found")
            # WCS being present doesn't necessarily mean large offsets
            print("   ℹ️  WCS present but doesn't indicate large offsets alone")
        else:
            print("   ℹ️  No explicit WCS found")
    except Exception as e:
        print(f"   ℹ️  Could not check WCS: {e}")

    # Final decision
    print("\n" + "=" * 80)
    print("✓ DECISION: Model uses LOCAL COORDINATES (not georeferenced)")
    print("✓ NO centering needed - will NOT use --center-model-geometry")
    print("=" * 80)
    return False

def convert_ifc_to_glb(ifc_path, output_path=None, force_centering=None):
    """
    Convert IFC to GLB with smart centering detection

    Args:
        ifc_path: Path to IFC file
        output_path: Output GLB path (optional)
        force_centering: Override auto-detection (True/False/None)
    """
    ifc_path = Path(ifc_path)

    if not ifc_path.exists():
        print(f"ERROR: File not found: {ifc_path}")
        return False

    if output_path is None:
        output_path = ifc_path.with_suffix('.glb')
    else:
        output_path = Path(output_path)

    print("\n" + "=" * 80)
    print("SMART IFC TO GLB CONVERTER")
    print("=" * 80)
    print(f"\nInput:  {ifc_path}")
    print(f"Output: {output_path}")
    print(f"Size:   {ifc_path.stat().st_size / (1024**2):.2f} MB")

    # Determine if centering is needed
    if force_centering is None:
        needs_centering = check_needs_centering(ifc_path)
    else:
        needs_centering = force_centering
        print(f"\n⚠️  Centering FORCED to: {needs_centering}")

    # Build IfcConvert command
    ifcconvert_path = Path('./IfcConvert')
    if not ifcconvert_path.exists():
        print("\nERROR: IfcConvert not found in current directory")
        return False

    # Use absolute path to avoid subprocess PATH issues
    cmd = [str(ifcconvert_path.absolute())]

    if needs_centering:
        cmd.append('--center-model-geometry')
        print("\n✓ Using flag: --center-model-geometry")
    else:
        print("\n✓ NOT using --center-model-geometry (not needed)")

    cmd.extend([str(ifc_path), str(output_path)])

    # Execute conversion
    print("\n" + "=" * 80)
    print("RUNNING IFCCONVERT")
    print("=" * 80)
    print(f"Command: {' '.join(cmd)}")
    print()

    try:
        result = subprocess.run(cmd, capture_output=False, text=True)

        if result.returncode == 0:
            output_size = output_path.stat().st_size / (1024**2)
            print("\n" + "=" * 80)
            print("CONVERSION COMPLETE")
            print("=" * 80)
            print(f"✓ Output: {output_path}")
            print(f"✓ Size: {output_size:.2f} MB")
            print(f"✓ Centering used: {needs_centering}")
            return True
        else:
            print("\n❌ Conversion failed")
            return False

    except Exception as e:
        print(f"\n❌ Error during conversion: {e}")
        return False

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description='Smart IFC to GLB converter with automatic centering detection',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Auto-detect centering need
  python smart_convert_ifc_to_glb.py input.ifc

  # Specify output path
  python smart_convert_ifc_to_glb.py input.ifc -o output.glb

  # Force centering ON
  python smart_convert_ifc_to_glb.py input.ifc --force-centering

  # Force centering OFF
  python smart_convert_ifc_to_glb.py input.ifc --no-centering
        """
    )

    parser.add_argument('input', help='Input IFC file')
    parser.add_argument('-o', '--output', help='Output GLB file (default: input.glb)')
    parser.add_argument('--force-centering', action='store_true',
                       help='Force use of --center-model-geometry')
    parser.add_argument('--no-centering', action='store_true',
                       help='Force NOT using --center-model-geometry')

    args = parser.parse_args()

    # Handle force flags
    force_centering = None
    if args.force_centering and args.no_centering:
        print("ERROR: Cannot use both --force-centering and --no-centering")
        sys.exit(1)
    elif args.force_centering:
        force_centering = True
    elif args.no_centering:
        force_centering = False

    success = convert_ifc_to_glb(args.input, args.output, force_centering)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
