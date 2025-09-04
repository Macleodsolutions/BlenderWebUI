import bpy
import bmesh


def auto_uv_unwrap():
    """
    Automatically unwraps UV coordinates for selected objects.
    Uses smart projection for optimal results.
    """
    # Get the active object
    obj = bpy.context.active_object

    if obj is None or obj.type != "MESH":
        print("Please select a mesh object")
        return

    # Enter edit mode
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")

    # Select all faces
    bpy.ops.mesh.select_all(action="SELECT")

    # Create bmesh instance
    bm = bmesh.from_edit_mesh(obj.data)

    # Ensure face indices are valid
    bm.faces.ensure_lookup_table()

    # Smart UV project
    bpy.ops.uv.smart_project(
        angle_limit=66.0,
        island_margin=0.02,
        area_weight=0.0,
        correct_aspect=True,
        scale_to_bounds=False,
    )

    # Update mesh
    bmesh.update_edit_mesh(obj.data)

    # Return to object mode
    bpy.ops.object.mode_set(mode="OBJECT")

    print(f"UV unwrapping completed for {obj.name}")


# Run the function
if __name__ == "__main__":
    auto_uv_unwrap()
