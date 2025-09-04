import bpy
import bmesh


def cleanup_mesh():
    """
    Cleans up mesh geometry by removing doubles, fixing normals,
    and optimizing topology for better performance.
    """
    # Get the active object
    obj = bpy.context.active_object

    if obj is None or obj.type != "MESH":
        print("Please select a mesh object")
        return

    # Enter edit mode
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")

    # Select all geometry
    bpy.ops.mesh.select_all(action="SELECT")

    # Create bmesh instance
    bm = bmesh.from_edit_mesh(obj.data)

    # Store original stats
    original_verts = len(bm.verts)
    original_faces = len(bm.faces)

    # Remove doubles/merge vertices
    bpy.ops.mesh.remove_doubles(threshold=0.0001)

    # Remove degenerate geometry
    bpy.ops.mesh.delete_loose()

    # Fill holes
    bpy.ops.mesh.fill_holes(sides=4)

    # Recalculate normals
    bpy.ops.mesh.normals_make_consistent(inside=False)

    # Remove interior faces
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.select_interior_faces()
    bpy.ops.mesh.delete(type="FACE")

    # Select all again for final cleanup
    bpy.ops.mesh.select_all(action="SELECT")

    # Triangulate faces for better compatibility
    bpy.ops.mesh.quads_convert_to_tris(quad_method="BEAUTY", ngon_method="BEAUTY")

    # Update bmesh
    bmesh.update_edit_mesh(obj.data)

    # Get new stats
    new_verts = len(bm.verts)
    new_faces = len(bm.faces)

    # Return to object mode
    bpy.ops.object.mode_set(mode="OBJECT")

    # Calculate improvements
    verts_removed = original_verts - new_verts
    faces_changed = new_faces - original_faces

    print(f"Mesh cleanup completed for {obj.name}:")
    print(f"  - Vertices: {original_verts} → {new_verts} ({verts_removed} removed)")
    print(f"  - Faces: {original_faces} → {new_faces} ({faces_changed:+d})")
    print("  - Normals recalculated")
    print("  - Doubles removed")
    print("  - Holes filled")


# Run the function
if __name__ == "__main__":
    cleanup_mesh()
