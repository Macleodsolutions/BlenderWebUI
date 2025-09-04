import bpy
import os


def import_material_library():
    """
    Imports and organizes materials from a library.
    Creates basic PBR materials with common properties.
    """
    # Material definitions
    materials = [
        {
            "name": "Metal_Steel",
            "base_color": (0.7, 0.7, 0.8, 1.0),
            "metallic": 1.0,
            "roughness": 0.2,
        },
        {
            "name": "Wood_Oak",
            "base_color": (0.6, 0.4, 0.2, 1.0),
            "metallic": 0.0,
            "roughness": 0.8,
        },
        {
            "name": "Plastic_Red",
            "base_color": (0.8, 0.1, 0.1, 1.0),
            "metallic": 0.0,
            "roughness": 0.4,
        },
        {
            "name": "Glass_Clear",
            "base_color": (1.0, 1.0, 1.0, 0.1),
            "metallic": 0.0,
            "roughness": 0.0,
            "transmission": 1.0,
        },
        {
            "name": "Concrete_Gray",
            "base_color": (0.5, 0.5, 0.5, 1.0),
            "metallic": 0.0,
            "roughness": 0.9,
        },
    ]

    created_materials = []

    for mat_data in materials:
        # Create new material
        mat = bpy.data.materials.new(name=mat_data["name"])
        mat.use_nodes = True

        # Get the principled BSDF node
        bsdf = mat.node_tree.nodes.get("Principled BSDF")

        if bsdf:
            # Set base color
            bsdf.inputs["Base Color"].default_value = mat_data["base_color"]

            # Set metallic
            bsdf.inputs["Metallic"].default_value = mat_data["metallic"]

            # Set roughness
            bsdf.inputs["Roughness"].default_value = mat_data["roughness"]

            # Set transmission if specified
            if "transmission" in mat_data:
                bsdf.inputs["Transmission"].default_value = mat_data["transmission"]

        created_materials.append(mat.name)
        print(f"Created material: {mat.name}")

    # Apply materials to selected objects
    selected_objects = [
        obj for obj in bpy.context.selected_objects if obj.type == "MESH"
    ]

    if selected_objects:
        for i, obj in enumerate(selected_objects):
            if i < len(created_materials):
                mat_name = created_materials[i]
                mat = bpy.data.materials.get(mat_name)

                if mat:
                    # Clear existing materials
                    obj.data.materials.clear()

                    # Assign new material
                    obj.data.materials.append(mat)
                    print(f"Applied {mat_name} to {obj.name}")

    print(
        f"Material library import completed! Created {len(created_materials)} materials."
    )


# Run the function
if __name__ == "__main__":
    import_material_library()
