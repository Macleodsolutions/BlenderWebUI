import bpy
import os


def batch_render_setup():
    """
    Sets up batch rendering for multiple cameras with different output paths.
    Creates render jobs for each camera in the scene.
    """
    scene = bpy.context.scene
    cameras = [obj for obj in scene.objects if obj.type == "CAMERA"]

    if not cameras:
        print("No cameras found in the scene")
        return

    # Get the current output path
    base_path = bpy.context.scene.render.filepath
    if not base_path:
        base_path = "//renders/"

    # Ensure the base directory exists
    base_dir = bpy.path.abspath(base_path)
    os.makedirs(base_dir, exist_ok=True)

    print(f"Found {len(cameras)} cameras for batch rendering:")

    for i, camera in enumerate(cameras):
        # Set active camera
        scene.camera = camera

        # Set output path for this camera
        camera_name = camera.name.replace(" ", "_")
        output_path = os.path.join(base_dir, f"{camera_name}_")
        scene.render.filepath = output_path

        print(f"  {i+1}. {camera.name} -> {output_path}")

        # Render the current frame
        bpy.ops.render.render(write_still=True)

    # Reset to original path
    scene.render.filepath = base_path

    print("Batch rendering completed!")


# Run the function
if __name__ == "__main__":
    batch_render_setup()
