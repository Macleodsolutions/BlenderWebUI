import bpy
import mathutils


def create_studio_lighting():
    """
    Creates a professional 3-point lighting setup with key, fill, and rim lights.
    Includes HDRI environment lighting for realistic reflections.
    """
    # Clear existing lights
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type == "LIGHT":
            obj.select_set(True)
    bpy.ops.object.delete()

    # Key Light (Main light)
    bpy.ops.object.light_add(type="AREA", location=(4, -4, 6))
    key_light = bpy.context.active_object
    key_light.name = "Key_Light"
    key_light.data.energy = 100
    key_light.data.size = 2
    key_light.data.color = (1.0, 0.95, 0.8)  # Warm white

    # Point the key light at origin
    constraint = key_light.constraints.new(type="TRACK_TO")
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"

    # Fill Light (Softer secondary light)
    bpy.ops.object.light_add(type="AREA", location=(-3, -2, 4))
    fill_light = bpy.context.active_object
    fill_light.name = "Fill_Light"
    fill_light.data.energy = 40
    fill_light.data.size = 3
    fill_light.data.color = (0.8, 0.9, 1.0)  # Cool white

    # Point the fill light at origin
    constraint = fill_light.constraints.new(type="TRACK_TO")
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"

    # Rim Light (Back light for edge definition)
    bpy.ops.object.light_add(type="SPOT", location=(0, 4, 5))
    rim_light = bpy.context.active_object
    rim_light.name = "Rim_Light"
    rim_light.data.energy = 80
    rim_light.data.spot_size = mathutils.radians(45)
    rim_light.data.spot_blend = 0.2
    rim_light.data.color = (1.0, 1.0, 1.0)  # Pure white

    # Point the rim light at origin
    constraint = rim_light.constraints.new(type="TRACK_TO")
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"

    # Set up world environment
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("Studio_World")
        bpy.context.scene.world = world

    world.use_nodes = True
    world_nodes = world.node_tree.nodes
    world_links = world.node_tree.links

    # Clear existing nodes
    world_nodes.clear()

    # Add environment texture node
    env_node = world_nodes.new(type="ShaderNodeTexEnvironment")
    env_node.location = (-300, 0)

    # Add background shader
    bg_node = world_nodes.new(type="ShaderNodeBackground")
    bg_node.location = (0, 0)
    bg_node.inputs["Strength"].default_value = 0.3

    # Add output node
    output_node = world_nodes.new(type="ShaderNodeOutputWorld")
    output_node.location = (300, 0)

    # Link nodes
    world_links.new(env_node.outputs["Color"], bg_node.inputs["Color"])
    world_links.new(bg_node.outputs["Background"], output_node.inputs["Surface"])

    # Create empty target for lights to track
    bpy.ops.object.empty_add(location=(0, 0, 1))
    target = bpy.context.active_object
    target.name = "Light_Target"

    # Set target for all lights
    for light_name in ["Key_Light", "Fill_Light", "Rim_Light"]:
        light = bpy.data.objects.get(light_name)
        if light:
            constraint = light.constraints.get("Track To")
            if constraint:
                constraint.target = target

    print("Studio lighting setup completed!")
    print("- Key Light: Main illumination (warm)")
    print("- Fill Light: Shadow fill (cool)")
    print("- Rim Light: Edge definition")
    print("- Environment: Low-intensity HDRI ready")


# Run the function
if __name__ == "__main__":
    create_studio_lighting()
