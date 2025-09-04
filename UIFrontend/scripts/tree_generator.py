import bpy
import bmesh
import mathutils
import random


def create_procedural_tree():
    """
    Generates a realistic tree using procedural modeling techniques.
    Creates trunk, branches, and leaves with natural variation.
    """
    # Clear existing mesh
    bpy.ops.object.select_all(action="DESELECT")

    # Create trunk
    bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=4, location=(0, 0, 2))

    trunk = bpy.context.active_object
    trunk.name = "Tree_Trunk"

    # Enter edit mode for trunk modification
    bpy.ops.object.mode_set(mode="EDIT")

    # Add some taper to the trunk
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.transform.tosphere(value=0.3)

    # Add subdivision for detail
    bpy.ops.mesh.subdivide(number_cuts=3)

    # Return to object mode
    bpy.ops.object.mode_set(mode="OBJECT")

    # Create branches
    branch_count = random.randint(5, 8)

    for i in range(branch_count):
        # Random branch position and rotation
        height = random.uniform(2, 4)
        angle = (360 / branch_count) * i + random.uniform(-30, 30)

        bpy.ops.mesh.primitive_cylinder_add(
            radius=random.uniform(0.1, 0.3),
            depth=random.uniform(1.5, 3),
            location=(0, 0, height),
        )

        branch = bpy.context.active_object
        branch.name = f"Tree_Branch_{i+1}"

        # Rotate and position branch
        branch.rotation_euler = (
            random.uniform(-0.5, 0.5),
            random.uniform(0.3, 0.8),
            mathutils.radians(angle),
        )

        # Move branch outward
        branch.location.x += random.uniform(0.5, 1.5)
        branch.location.y += random.uniform(-0.5, 0.5)

    # Create leaves using icospheres
    leaf_count = random.randint(15, 25)

    for i in range(leaf_count):
        bpy.ops.mesh.primitive_ico_sphere_add(
            radius=random.uniform(0.3, 0.6),
            subdivisions=1,
            location=(
                random.uniform(-2, 2),
                random.uniform(-2, 2),
                random.uniform(3, 6),
            ),
        )

        leaf = bpy.context.active_object
        leaf.name = f"Tree_Leaf_{i+1}"

        # Scale leaves randomly
        leaf.scale = (
            random.uniform(0.8, 1.2),
            random.uniform(0.8, 1.2),
            random.uniform(0.6, 1.0),
        )

    # Select all tree parts
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.name.startswith("Tree_"):
            obj.select_set(True)

    # Set trunk as active
    bpy.context.view_layer.objects.active = trunk

    # Join all parts
    bpy.ops.object.join()

    # Rename final object
    bpy.context.active_object.name = "Procedural_Tree"

    print("Procedural tree generated successfully!")


# Run the function
if __name__ == "__main__":
    create_procedural_tree()
