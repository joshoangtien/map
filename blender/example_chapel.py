# SPDX-License-Identifier: MIT
"""
Ví dụ: dựng một nhà nguyện nhỏ đúng quy ước của game để tham khảo.

Chạy trong Blender: tab Scripting → Open → chọn file này → Run Script.
Script xoá scene hiện tại rồi dựng:
  - tường (mỗi đoạn tường là một vật thể riêng, cửa chính ở mặt -Y),
  - mái, tháp chuông, bàn thờ trên bục,
  - khối va chạm `collider_*` cho từng đoạn tường / tháp / bàn thờ,
  - vùng sàn `floor_buc` cho bục cung thánh,
  - điểm xuất hiện `spawn` trước cửa.
Sau đó mở tab "Bản đồ VN" (phím N), chọn thư mục game và bấm "Xuất sang game".
"""

import math

import bpy


def mat(name, color, rough=0.8, emission=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if bpy.app.version < (5, 0, 0):
        m.use_nodes = True  # Từ Blender 5 vật liệu luôn dùng node.
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = rough
        if emission:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1)
            bsdf.inputs["Emission Strength"].default_value = 2.0
    return m


def box(name, size, loc, material, rot_z=0.0):
    """Hộp kích thước size=(x, y, z) mét, loc là tâm đáy."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(loc[0], loc[1], loc[2] + size[2] / 2))
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    o.rotation_euler.z = rot_z
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    return o


def gable_roof(name, width, length, rise, z, material):
    """Mái hai dốc chạy dọc trục Y."""
    w, l = width / 2, length / 2
    verts = [(-w, -l, z), (w, -l, z), (0, -l, z + rise), (-w, l, z), (w, l, z), (0, l, z + rise)]
    faces = [(0, 2, 1), (3, 4, 5), (0, 3, 5, 2), (1, 2, 5, 4), (0, 1, 4, 3)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(material)
    return o


def build():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    wall = mat("Tuong", (0.86, 0.82, 0.74))
    roof = mat("Mai", (0.35, 0.18, 0.14))
    wood = mat("Go", (0.35, 0.2, 0.1))
    gold = mat("Vang", (0.85, 0.65, 0.2), 0.3, emission=(0.3, 0.2, 0.0))
    floor = mat("San", (0.62, 0.55, 0.47))

    W, L, H, t = 10.0, 18.0, 6.0, 0.4  # rộng, dài, cao, dày tường
    door = 2.4
    front, back = -L / 2, L / 2  # mặt tiền ở phía -Y

    # Tường: mỗi đoạn một vật thể để làm khối va chạm riêng.
    side = (W - door) / 2
    walls = [
        box("tuong_truoc_trai", (side, t, H), (-(door / 2 + side / 2), front + t / 2, 0), wall),
        box("tuong_truoc_phai", (side, t, H), (door / 2 + side / 2, front + t / 2, 0), wall),
        box("tuong_tren_cua", (door, t, H - 3.2), (0, front + t / 2, 3.2), wall),
        box("tuong_sau", (W, t, H), (0, back - t / 2, 0), wall),
        box("tuong_trai", (t, L, H), (-W / 2 + t / 2, 0, 0), wall),
        box("tuong_phai", (t, L, H), (W / 2 - t / 2, 0, 0), wall),
    ]
    box("nen", (W, L, 0.05), (0, 0, 0), floor)
    gable_roof("mai", W + 1.0, L + 0.8, 3.2, H, roof)
    tx, ty = -W / 2 - 1.5, front + 1.5  # tháp đứng cạnh mặt tiền, bên trái
    tower = box("thap_chuong", (3.0, 3.0, 13.0), (tx, ty, 0), wall)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=2.3, depth=4.0, location=(tx, ty, 15.0), rotation=(0, 0, math.pi / 4))
    spire = bpy.context.active_object
    spire.name = "chop_thap"
    spire.data.materials.append(roof)
    buc = box("buc_cung_thanh", (W - 2 * t, 3.0, 0.35), (0, back - t - 1.5, 0), floor)
    altar = box("ban_tho", (2.4, 1.0, 1.0), (0, back - t - 1.6, 0.35), gold)
    for i in range(5):  # hàng ghế
        for s in (-1, 1):
            box(f"ghe_{i}_{s}", (2.6, 0.5, 0.45), (s * 2.2, front + 4 + i * 1.4, 0), wood)

    # Khối va chạm cho tường, tháp và bàn thờ (dùng nút của add-on nếu đã cài).
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in [*walls, tower, altar]:
        o.select_set(True)
    if hasattr(bpy.ops, "vnmap") and hasattr(bpy.ops.vnmap, "add_collider"):
        bpy.ops.vnmap.add_collider()
        for o in bpy.context.selected_objects:
            o.select_set(False)
        buc.select_set(True)
        bpy.ops.vnmap.add_floor()
        scene.cursor.location = (0, front - 6, 0)
        bpy.ops.vnmap.add_spawn()
        scene.vnmap_name = "Nhà nguyện mẫu"
        scene.vnmap_id = "nha-nguyen-mau"
    print("Đã dựng nhà nguyện mẫu.")


build()
