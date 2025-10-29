#!/usr/bin/env python3
"""
Ultra-fast IFC splitter by storey
Pre-builds lookup dictionaries for instant relationship queries
"""

import sys
import argparse
from pathlib import Path
from collections import defaultdict


def build_relationship_maps(ifc_file, verbose=False):
    """Build fast lookup dictionaries for all relationships"""
    
    if verbose:
        print("Building relationship lookup tables...")
    
    # Element -> Type
    element_to_type = {}
    for rel in ifc_file.by_type("IfcRelDefinesByType"):
        for element in rel.RelatedObjects:
            element_to_type[element.id()] = rel.RelatingType
    
    # Element -> Materials
    element_to_materials = defaultdict(list)
    for rel in ifc_file.by_type("IfcRelAssociatesMaterial"):
        for element in rel.RelatedObjects:
            element_to_materials[element.id()].append(rel.RelatingMaterial)
    
    # Element -> Property Sets
    element_to_psets = defaultdict(list)
    for rel in ifc_file.by_type("IfcRelDefinesByProperties"):
        for element in rel.RelatedObjects:
            element_to_psets[element.id()].append(rel.RelatingPropertyDefinition)
    
    # Storey -> Elements (spatial containment)
    storey_to_elements = defaultdict(set)
    for rel in ifc_file.by_type("IfcRelContainedInSpatialStructure"):
        storey_to_elements[rel.RelatingStructure.id()].update(rel.RelatedElements)
    
    # Storey -> Aggregated elements
    for rel in ifc_file.by_type("IfcRelAggregates"):
        if rel.RelatingObject.is_a("IfcBuildingStorey"):
            storey_to_elements[rel.RelatingObject.id()].update(rel.RelatedObjects)
    
    if verbose:
        print(f"  Indexed {len(element_to_type)} type relationships")
        print(f"  Indexed {len(element_to_materials)} material relationships")
        print(f"  Indexed {len(element_to_psets)} property set relationships")
    
    return {
        'element_to_type': element_to_type,
        'element_to_materials': element_to_materials,
        'element_to_psets': element_to_psets,
        'storey_to_elements': storey_to_elements
    }


def collect_dependencies(entity, visited, ifc_file):
    """Recursively collect entity dependencies (non-root entities only)"""
    if entity is None or not hasattr(entity, 'id'):
        return
    
    entity_id = entity.id()
    if entity_id in visited:
        return
    
    visited.add(entity_id)
    
    # Get attributes
    try:
        info = entity.get_info()
        for value in info.values():
            if hasattr(value, 'id'):
                # Don't follow root entities (products, types, etc) - only geometry/materials
                if not value.is_a("IfcRoot"):
                    collect_dependencies(value, visited, ifc_file)
            elif isinstance(value, (list, tuple)):
                for item in value:
                    if hasattr(item, 'id') and not item.is_a("IfcRoot"):
                        collect_dependencies(item, visited, ifc_file)
    except:
        pass


def split_ifc_ultrafast(input_path, output_dir=None, verbose=True):
    """
    Ultra-fast split with pre-built lookup tables
    """
    
    try:
        import ifcopenshell
    except ImportError as e:
        print(f"Error: ifcopenshell not found: {e}")
        print("Please install: pip install ifcopenshell --break-system-packages")
        return False
    
    input_path = Path(input_path)
    if not input_path.exists():
        print(f"Error: File not found: {input_path}")
        return False
    
    if output_dir:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
    else:
        output_dir = input_path.parent
    
    base_name = input_path.stem
    
    if verbose:
        print(f"Loading IFC file: {input_path}")
    
    try:
        ifc_file = ifcopenshell.open(str(input_path))
    except Exception as e:
        print(f"Error opening IFC file: {e}")
        return False
    
    if verbose:
        print(f"IFC Schema: {ifc_file.schema}")
    
    # Build lookup tables once
    maps = build_relationship_maps(ifc_file, verbose)
    
    # Get core entities
    project = ifc_file.by_type("IfcProject")[0] if ifc_file.by_type("IfcProject") else None
    storeys = ifc_file.by_type("IfcBuildingStorey")
    
    if not storeys:
        print("Warning: No building storeys found")
        return False
    
    if verbose:
        print(f"Found {len(storeys)} storey(s)")
        print("-" * 60)
    
    original_size = input_path.stat().st_size / (1024 * 1024)
    
    # Get spatial hierarchy once
    site = None
    building = None
    
    if project:
        for rel in ifc_file.by_type("IfcRelAggregates"):
            if rel.RelatingObject == project:
                for obj in rel.RelatedObjects:
                    if obj.is_a("IfcSite"):
                        site = obj
                        break
    
    if site:
        for rel in ifc_file.by_type("IfcRelAggregates"):
            if rel.RelatingObject == site:
                for obj in rel.RelatedObjects:
                    if obj.is_a("IfcBuilding"):
                        building = obj
                        break
    
    # Process each storey
    for idx, storey in enumerate(storeys):
        storey_name = storey.Name or f"Storey_{idx}"
        safe_name = "".join(c for c in storey_name if c.isalnum() or c in (' ', '-', '_')).strip().replace(' ', '_')
        
        output_filename = f"{base_name}_{safe_name}.ifc"
        output_path = output_dir / output_filename
        
        if verbose:
            print(f"\n[{idx + 1}/{len(storeys)}] {storey_name}")
        
        try:
            # Get elements using fast lookup
            elements = maps['storey_to_elements'].get(storey.id(), set())
            
            if verbose:
                print(f"  Elements: {len(elements)}")
            
            # Collect what we need using fast lookups
            entities_to_copy = set()
            
            # Core structure
            if project:
                entities_to_copy.add(project.id())
            if site:
                entities_to_copy.add(site.id())
            if building:
                entities_to_copy.add(building.id())
            entities_to_copy.add(storey.id())
            
            # Elements
            for element in elements:
                entities_to_copy.add(element.id())
                
                # Type (fast lookup)
                if element.id() in maps['element_to_type']:
                    type_obj = maps['element_to_type'][element.id()]
                    entities_to_copy.add(type_obj.id())
                
                # Materials (fast lookup)
                if element.id() in maps['element_to_materials']:
                    for material in maps['element_to_materials'][element.id()]:
                        entities_to_copy.add(material.id())
                
                # Property sets (fast lookup)
                if element.id() in maps['element_to_psets']:
                    for pset in maps['element_to_psets'][element.id()]:
                        entities_to_copy.add(pset.id())
            
            if verbose:
                print(f"  Root entities to copy: {len(entities_to_copy)}")
                print(f"  Collecting geometry dependencies...")
            
            # Collect non-root dependencies (geometry, etc.)
            non_root_deps = set()
            for entity_id in entities_to_copy:
                entity = ifc_file.by_id(entity_id)
                collect_dependencies(entity, non_root_deps, ifc_file)
            
            if verbose:
                print(f"  Non-root dependencies: {len(non_root_deps)}")
                print(f"  Total entities: {len(entities_to_copy) + len(non_root_deps)}")
                print(f"  Creating new file...")
            
            # Create new file
            new_file = ifcopenshell.file(schema=ifc_file.schema)
            
            # Combine all entity IDs
            all_entity_ids = entities_to_copy | non_root_deps
            
            # Copy all entities in order (sorted by ID to maintain references)
            for entity_id in sorted(all_entity_ids):
                try:
                    entity = ifc_file.by_id(entity_id)
                    new_file.add(entity)
                except Exception as e:
                    if verbose:
                        print(f"    Warning: Could not copy entity #{entity_id}: {e}")
            
            if verbose:
                print(f"  Writing: {output_filename}")
            
            new_file.write(str(output_path))
            
            file_size = output_path.stat().st_size / (1024 * 1024)
            reduction = ((original_size - file_size) / original_size) * 100
            
            if verbose:
                print(f"  ✓ {file_size:.2f} MB ({reduction:.1f}% smaller than original)")
        
        except Exception as e:
            print(f"  ✗ Error: {e}")
            import traceback
            traceback.print_exc()
            continue
    
    if verbose:
        print("\n" + "=" * 60)
        print("Complete!")
        
        output_files = list(output_dir.glob(f"{base_name}_*.ifc"))
        if output_files:
            total_size = sum(f.stat().st_size for f in output_files) / (1024 * 1024)
            print(f"\nOriginal: {original_size:.2f} MB")
            print(f"Total output: {total_size:.2f} MB")
            print(f"Average per storey: {total_size/len(output_files):.2f} MB")
            
            if total_size < original_size:
                savings = ((original_size - total_size) / original_size) * 100
                print(f"✓ Saved {savings:.1f}% in total size")
    
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Ultra-fast IFC splitter using pre-built lookup tables',
        epilog='Builds relationship indices once for instant lookups'
    )
    
    parser.add_argument('input', help='Input IFC file')
    parser.add_argument('-o', '--output-dir', help='Output directory')
    parser.add_argument('-q', '--quiet', action='store_true', help='Quiet mode')
    
    args = parser.parse_args()
    
    success = split_ifc_ultrafast(
        args.input,
        output_dir=args.output_dir,
        verbose=not args.quiet
    )
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()