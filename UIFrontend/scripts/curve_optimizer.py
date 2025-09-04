import bpy


def optimize_animation_curves():
    """
    Optimizes animation curves by removing redundant keyframes
    and smoothing curve interpolation.
    """
    # Get the active object
    obj = bpy.context.active_object

    if not obj or not obj.animation_data or not obj.animation_data.action:
        print("No animation data found on active object")
        return

    action = obj.animation_data.action
    fcurves = action.fcurves

    if not fcurves:
        print("No animation curves found")
        return

    optimized_count = 0

    for fcurve in fcurves:
        keyframes = fcurve.keyframe_points

        if len(keyframes) < 3:
            continue

        # Store original keyframe count
        original_count = len(keyframes)

        # Select all keyframes
        for keyframe in keyframes:
            keyframe.select_control_point = True

        # Set the fcurve as active
        fcurve.select = True

        # Decimate keyframes (remove redundant ones)
        bpy.ops.graph.decimate(mode="RATIO", factor=0.1)

        # Smooth the curve
        bpy.ops.graph.smooth()

        # Set interpolation to bezier for smoother curves
        for keyframe in keyframes:
            keyframe.interpolation = "BEZIER"
            keyframe.handle_left_type = "AUTO"
            keyframe.handle_right_type = "AUTO"

        new_count = len(keyframes)
        removed = original_count - new_count

        if removed > 0:
            optimized_count += 1
            print(f"Optimized {fcurve.data_path}: removed {removed} keyframes")

    # Update the scene
    bpy.context.scene.frame_set(bpy.context.scene.frame_current)

    print(f"Animation optimization completed! Optimized {optimized_count} curves.")


# Run the function
if __name__ == "__main__":
    optimize_animation_curves()
