import bpy
import os


def batch_export_manager():
    """
    Exports selected objects to multiple formats (OBJ, FBX, STL, PLY).
    Creates organized output directory structure.
    """
    # Get selected objects
    selected_objects = [
        obj for obj in bpy.context.selected_objects if obj.type == "MESH"
    ]

    if not selected_objects:
        print("No mesh objects selected for export")
        return

    # Get export directory
    blend_filepath = bpy.data.filepath
    if blend_filepath:
        export_dir = os.path.join(os.path.dirname(blend_filepath), "exports")
    else:
        export_dir = os.path.join(os.path.expanduser("~"), "Desktop", "blender_exports")

    # Create export directories
    formats = ["obj", "fbx", "stl", "ply"]
    for fmt in formats:
        fmt_dir = os.path.join(export_dir, fmt)
        os.makedirs(fmt_dir, exist_ok=True)

    exported_files = []

    for obj in selected_objects:
        # Clean object name for filename
        obj_name = obj.name.replace(" ", "_").replace(".", "_")

        # Deselect all and select only current object
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

        # Export OBJ
        obj_path = os.path.join(export_dir, "obj", f"{obj_name}.obj")
        bpy.ops.export_scene.obj(
            filepath=obj_path,
            use_selection=True,
            use_materials=True,
            use_uvs=True,
            use_normals=True,
        )
        exported_files.append(obj_path)

        # Export FBX
        fbx_path = os.path.join(export_dir, "fbx", f"{obj_name}.fbx")
        bpy.ops.export_scene.fbx(
            filepath=fbx_path,
            use_selection=True,
            use_mesh_modifiers=True,
            use_armature_deform_only=True,
        )
        exported_files.append(fbx_path)

        # Export STL
        stl_path = os.path.join(export_dir, "stl", f"{obj_name}.stl")
        bpy.ops.export_mesh.stl(
            filepath=stl_path, use_selection=True, use_mesh_modifiers=True
        )
        exported_files.append(stl_path)

        # Export PLY
        ply_path = os.path.join(export_dir, "ply", f"{obj_name}.ply")
        bpy.ops.export_mesh.ply(
            filepath=ply_path,
            use_selection=True,
            use_mesh_modifiers=True,
            use_normals=True,
            use_uv_coords=True,
            use_colors=True,
        )
        exported_files.append(ply_path)

        print(f"Exported {obj.name} to 4 formats")

    # Restore original selection
    bpy.ops.object.select_all(action="DESELECT")
    for obj in selected_objects:
        obj.select_set(True)

    print(f"\nBatch export completed!")
    print(f"Exported {len(selected_objects)} objects to {len(exported_files)} files")
    print(f"Export directory: {export_dir}")

    # Open export directory in file explorer (Windows)
    if os.name == "nt":
        os.startfile(export_dir)


# Run the function
if __name__ == "__main__":
    batch_export_manager()
