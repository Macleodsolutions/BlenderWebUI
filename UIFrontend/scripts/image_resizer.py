import bpy
import bmesh
from mathutils import Vector


def resize_all_images(
    target_width=1024, target_height=1024, maintain_aspect_ratio=True
):
    """
    Resize all images in the current Blender scene to the specified resolution.

    Parameters:
    - target_width: Target width in pixels (default: 1024)
    - target_height: Target height in pixels (default: 1024)
    - maintain_aspect_ratio: Whether to maintain the original aspect ratio (default: True)
    """

    # Get all images in the scene
    images = bpy.data.images

    if not images:
        print("No images found in the scene.")
        return

    resized_count = 0
    skipped_count = 0

    print(f"Starting image resize operation...")
    print(f"Target resolution: {target_width}x{target_height}")
    print(f"Maintain aspect ratio: {maintain_aspect_ratio}")
    print("-" * 50)

    for image in images:
        # Skip render results and viewer nodes
        if image.type in ["RENDER_RESULT", "COMPOSITING"]:
            print(f"Skipping {image.name} (type: {image.type})")
            skipped_count += 1
            continue

        # Skip images that don't have pixel data
        if not hasattr(image, "size") or len(image.size) < 2:
            print(f"Skipping {image.name} (no size data)")
            skipped_count += 1
            continue

        original_width, original_height = image.size[0], image.size[1]

        # Skip if image is already the target size
        if original_width == target_width and original_height == target_height:
            print(f"Skipping {image.name} (already target size)")
            skipped_count += 1
            continue

        new_width = target_width
        new_height = target_height

        # Calculate new dimensions while maintaining aspect ratio
        if maintain_aspect_ratio and original_width > 0 and original_height > 0:
            aspect_ratio = original_width / original_height

            if aspect_ratio > 1:  # Landscape
                new_height = int(target_width / aspect_ratio)
                if new_height > target_height:
                    new_height = target_height
                    new_width = int(target_height * aspect_ratio)
            else:  # Portrait or square
                new_width = int(target_height * aspect_ratio)
                if new_width > target_width:
                    new_width = target_width
                    new_height = int(target_width / aspect_ratio)

        try:
            # Resize the image
            print(
                f"Resizing {image.name}: {original_width}x{original_height} -> {new_width}x{new_height}"
            )

            # Scale the image
            image.scale(new_width, new_height)

            # Mark the image as dirty to ensure it gets updated
            image.update()

            resized_count += 1

        except Exception as e:
            print(f"Error resizing {image.name}: {str(e)}")
            skipped_count += 1

    print("-" * 50)
    print(f"Resize operation completed!")
    print(f"Images resized: {resized_count}")
    print(f"Images skipped: {skipped_count}")
    print(f"Total images processed: {resized_count + skipped_count}")

    # Update the viewport to reflect changes
    for area in bpy.context.screen.areas:
        if area.type in ["IMAGE_EDITOR", "VIEW_3D"]:
            area.tag_redraw()


def main():
    """
    Main function to execute the image resizing script.
    This function will be called when the script is executed from the UI.
    """
    # Default parameters - these will be overridden by the UI
    target_width = 1024
    target_height = 1024
    maintain_aspect_ratio = True

    resize_all_images(target_width, target_height, maintain_aspect_ratio)


if __name__ == "__main__":
    main()
