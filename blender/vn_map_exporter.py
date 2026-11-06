# SPDX-License-Identifier: MIT
"""
Add-on Blender: xuất model địa điểm sang game "Bản đồ Việt Nam".

Cài đặt: Edit → Preferences → Add-ons → (mũi tên ⌄ góc phải) Install from Disk…
→ chọn file này → bật "Bản đồ VN – Xuất model".
Bảng điều khiển: trong khung 3D, nhấn N → tab "Bản đồ VN".

Quy ước (game đọc theo tên vật thể):
  collider…  khối va chạm (ẩn trong game). Mỗi khối được tính theo bao lồi nhìn từ trên
             xuống, nên tường có cửa phải tách thành nhiều khối hai bên cửa.
             Khối có đáy cao hơn 2 m (vd. tường trên khung cửa) không chặn đường.
  floor…     sàn / bục cao hơn mặt đất: nhân vật đứng lên mặt trên (ẩn trong game).
  spawn      điểm xuất hiện (Empty mũi tên); nhân vật nhìn theo hướng mũi tên.
Đơn vị là mét, gốc toạ độ ở tâm công trình trên mặt đất, mặt tiền quay về phía -Y
(phía người nhìn trong Front view, phím Numpad 1).
"""

bl_info = {
    "name": "Bản đồ VN – Xuất model",
    "author": "Bản đồ Việt Nam",
    "version": (1, 0, 0),
    "blender": (4, 2, 0),
    "location": "3D Viewport → Sidebar (N) → Bản đồ VN",
    "description": "Xuất model địa điểm (.glb) và đăng ký vào game Bản đồ Việt Nam",
    "category": "Import-Export",
}

import json
import math
import os
import re
import unicodedata
from datetime import datetime, timezone

import bpy
from bpy.props import BoolProperty, FloatProperty, StringProperty
from mathutils import Vector

# ---------------------------------------------------------------- Tiện ích


def slugify(text):
    """'Nhà thờ Lớn Hà Nội' -> 'nha-tho-lon-ha-noi'."""
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "dia-diem"


def parse_coords(text):
    """Đọc toạ độ từ '21.0287, 105.849', link Google Maps (@lat,lng) hoặc link OpenStreetMap (#map=z/lat/lng)."""
    if not text:
        return None
    m = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", text)  # Google Maps
    if not m:
        m = re.search(r"map=\d+(?:\.\d+)?/(-?\d+\.\d+)/(-?\d+\.\d+)", text)  # OpenStreetMap
    if not m:
        m = re.search(r"(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)", text)
    if not m:
        return None
    a, b = float(m.group(1)), float(m.group(2))
    # Thường dán theo thứ tự "vĩ độ, kinh độ" (như Google Maps). Số nào > 90 thì chắc chắn là kinh độ.
    lat, lng = (b, a) if abs(a) > 90 else (a, b)
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    return lat, lng


def models_dir(scene):
    root = bpy.path.abspath(scene.vnmap_project_dir or "")
    return os.path.join(root, "public", "models")


def is_tagged(obj, prefix):
    o = obj
    while o is not None:
        if o.name.lower().startswith(prefix):
            return True
        o = o.parent
    return False


def world_bbox(objs):
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def content_objects(scene):
    """Các mesh hiển thị trong game (không phải collider / floor)."""
    return [o for o in scene.objects if o.type == "MESH" and not is_tagged(o, "collider") and not is_tagged(o, "floor")]


def make_box(name, lo, hi, collection, color):
    """Tạo hộp (dạng khung dây) từ góc lo đến góc hi trong toạ độ thế giới."""
    mesh = bpy.data.meshes.new(name)
    xs, ys, zs = (lo.x, hi.x), (lo.y, hi.y), (lo.z, hi.z)
    verts = [(x, y, z) for x in xs for y in ys for z in zs]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.display_type = "WIRE"
    obj.show_in_front = True
    obj.color = color
    obj.hide_render = True
    return obj


def helper_collection(scene, name):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
        scene.collection.children.link(coll)
    return coll


# ---------------------------------------------------------------- Kiểm tra


def check_scene(scene):
    """Trả về danh sách (mức, nội dung). Mức: 'ERROR' chặn xuất, 'WARNING' chỉ nhắc."""
    out = []
    if not scene.vnmap_project_dir:
        out.append(("ERROR", "Chưa chọn thư mục game (thư mục chứa package.json)."))
    elif not os.path.isdir(os.path.join(bpy.path.abspath(scene.vnmap_project_dir), "public")):
        out.append(("ERROR", "Thư mục game không có thư mục public/. Chọn đúng thư mục gốc của game."))
    if not scene.vnmap_id.strip():
        out.append(("ERROR", "Chưa đặt mã model."))
    if not scene.vnmap_name.strip() and not scene.vnmap_use_coords:
        out.append(("ERROR", "Cần ít nhất tên địa điểm hoặc toạ độ để game biết gắn model vào đâu."))

    us = scene.unit_settings
    if us.system != "METRIC" or abs(us.scale_length - 1.0) > 1e-6:
        out.append(("WARNING", "Đơn vị của scene không phải mét (Unit Scale = 1). Game hiểu 1 đơn vị = 1 m."))

    objs = content_objects(scene)
    if not objs:
        out.append(("ERROR", "Không có vật thể nào để xuất."))
        return out
    lo, hi = world_bbox(objs)
    size = hi - lo
    if max(size) > 400:
        out.append(("WARNING", f"Model rất lớn ({size.x:.0f}×{size.y:.0f}×{size.z:.0f} m). Có nhầm đơn vị không?"))
    if max(size) < 1:
        out.append(("WARNING", f"Model rất nhỏ ({size.x:.2f}×{size.y:.2f}×{size.z:.2f} m). Có nhầm đơn vị không?"))
    cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
    if math.hypot(cx, cy) > max(size.x, size.y):
        out.append(("WARNING", f"Gốc toạ độ cách xa công trình ({cx:.0f}, {cy:.0f} m). Nên đặt gốc ở tâm công trình."))
    if lo.z < -0.5 or lo.z > 0.5:
        out.append(("WARNING", f"Đáy công trình ở cao độ {lo.z:.2f} m, nên đặt sát mặt đất (Z = 0)."))

    colliders = [o for o in scene.objects if o.type == "MESH" and is_tagged(o, "collider")]
    if not colliders:
        out.append(("WARNING", "Chưa có khối 'collider…': trong game cả model là khối đặc, không vào trong được."))
    if not any(o.name.lower().startswith("spawn") for o in scene.objects):
        out.append(("INFO", "Chưa có điểm 'spawn': nhân vật sẽ xuất hiện trước mặt tiền (phía -Y)."))

    tris = 0
    for o in objs:
        if o.data:
            tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris > 600_000:
        out.append(("WARNING", f"Nhiều tam giác ({tris:,}). Trên điện thoại sẽ nặng, nên giảm (Decimate)."))
    big = sorted({img.name for img in bpy.data.images if img.users and max(img.size) > 2048})
    if big:
        out.append(("WARNING", "Ảnh texture lớn hơn 2048 px: " + ", ".join(big[:5])))
    return out


# ---------------------------------------------------------------- Toán tử


class VNMAP_OT_add_collider(bpy.types.Operator):
    bl_idname = "vnmap.add_collider"
    bl_label = "Thêm khối va chạm"
    bl_description = (
        "Tạo khối 'collider' bao quanh từng vật thể đang chọn (tường, cột...). "
        "Không chọn gì: tạo một khối 1×1×3 m tại con trỏ 3D"
    )
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        coll = helper_collection(context.scene, "Game – va chạm")
        sel = [o for o in context.selected_objects if o.type == "MESH" and not is_tagged(o, "collider")]
        made = []
        if sel:
            for o in sel:
                lo, hi = world_bbox([o])
                made.append(make_box(f"collider_{o.name}", lo, hi, coll, (1, 0.2, 0.2, 1)))
        else:
            c = context.scene.cursor.location
            made.append(make_box("collider_khoi", c + Vector((-0.5, -0.5, 0)), c + Vector((0.5, 0.5, 3)), coll, (1, 0.2, 0.2, 1)))
        self.report({"INFO"}, f"Đã tạo {len(made)} khối va chạm. Tường có cửa: tách thành các khối hai bên cửa.")
        return {"FINISHED"}


class VNMAP_OT_add_floor(bpy.types.Operator):
    bl_idname = "vnmap.add_floor"
    bl_label = "Thêm sàn / bục"
    bl_description = "Tạo vùng 'floor' theo vật thể đang chọn: nhân vật sẽ đứng lên mặt trên của nó (bậc thềm, bục, sân khấu)"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        coll = helper_collection(context.scene, "Game – sàn")
        sel = [o for o in context.selected_objects if o.type == "MESH" and not is_tagged(o, "floor")]
        if not sel:
            self.report({"WARNING"}, "Hãy chọn vật thể làm sàn / bục trước.")
            return {"CANCELLED"}
        for o in sel:
            lo, hi = world_bbox([o])
            make_box(f"floor_{o.name}", lo, hi, coll, (0.2, 0.6, 1, 1))
        self.report({"INFO"}, f"Đã tạo {len(sel)} vùng sàn.")
        return {"FINISHED"}


class VNMAP_OT_add_spawn(bpy.types.Operator):
    bl_idname = "vnmap.add_spawn"
    bl_label = "Đặt điểm xuất hiện"
    bl_description = "Đặt Empty 'spawn' tại con trỏ 3D. Nhân vật nhìn theo hướng mũi tên"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        scene = context.scene
        obj = next((o for o in scene.objects if o.name.lower().startswith("spawn")), None)
        if obj is None:
            obj = bpy.data.objects.new("spawn", None)
            obj.empty_display_type = "SINGLE_ARROW"
            obj.empty_display_size = 1.5
            helper_collection(scene, "Game – điểm").objects.link(obj)
            # Mũi tên của Empty chỉ theo trục Z cục bộ; nằm ngang và chỉ về +Y (nhìn vào mặt tiền).
            obj.rotation_euler = (math.radians(-90), 0, 0)
        obj.location = scene.cursor.location.copy()
        obj.location.z = 0
        self.report({"INFO"}, "Đã đặt điểm xuất hiện. Xoay quanh trục Z (R Z) để đổi hướng nhìn.")
        return {"FINISHED"}


class VNMAP_OT_check(bpy.types.Operator):
    bl_idname = "vnmap.check"
    bl_label = "Kiểm tra"
    bl_description = "Kiểm tra đơn vị, gốc toạ độ, khối va chạm, dung lượng trước khi xuất"

    def execute(self, context):
        issues = check_scene(context.scene)
        if not issues:
            self.report({"INFO"}, "Mọi thứ ổn, có thể xuất.")
        for level, msg in issues:
            self.report({level}, msg)
        return {"FINISHED"}


class VNMAP_OT_export(bpy.types.Operator):
    bl_idname = "vnmap.export"
    bl_label = "Xuất sang game"
    bl_description = "Xuất .glb vào public/models/ của game và cập nhật public/models/index.json"

    def execute(self, context):
        scene = context.scene
        issues = check_scene(scene)
        errors = [m for lvl, m in issues if lvl == "ERROR"]
        if errors:
            for m in errors:
                self.report({"ERROR"}, m)
            return {"CANCELLED"}

        model_id = slugify(scene.vnmap_id)
        out_dir = models_dir(scene)
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, f"{model_id}.glb")

        # Chỉ truyền các tuỳ chọn mà phiên bản Blender này có.
        available = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
        opts = {
            "filepath": path,
            "export_format": "GLB",
            "use_selection": False,
            "use_visible": False,
            "export_apply": True,
            "export_yup": True,
            "export_cameras": False,
            "export_lights": False,
            "export_punctual": False,
            "export_animations": False,
            "export_extras": False,
            "export_draco_mesh_compression_enable": scene.vnmap_draco,
            "export_draco_mesh_compression_level": 6,
            "export_image_format": "AUTO",
        }
        opts = {k: v for k, v in opts.items() if k == "filepath" or k in available}
        try:
            bpy.ops.export_scene.gltf(**opts)
        except Exception as e:  # noqa: BLE001
            if opts.get("export_draco_mesh_compression_enable"):
                # Một số bản Blender không có thư viện Draco: xuất lại không nén.
                opts["export_draco_mesh_compression_enable"] = False
                bpy.ops.export_scene.gltf(**opts)
                self.report({"WARNING"}, f"Không nén Draco được ({e}); đã xuất không nén.")
            else:
                raise

        # Cập nhật danh sách model của game.
        index_path = os.path.join(out_dir, "index.json")
        try:
            with open(index_path, encoding="utf-8") as f:
                entries = json.load(f)
            if not isinstance(entries, list):
                entries = []
        except (FileNotFoundError, json.JSONDecodeError):
            entries = []
        entry = {"id": model_id, "file": f"{model_id}.glb"}
        if scene.vnmap_name.strip():
            entry["name"] = scene.vnmap_name.strip()
        if scene.vnmap_use_coords:
            entry["lngLat"] = [round(scene.vnmap_lng, 7), round(scene.vnmap_lat, 7)]
        entry["facade"] = "auto" if scene.vnmap_facade_auto else round(scene.vnmap_facade % 360, 1)
        entry["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        entries = [e for e in entries if e.get("id") != model_id] + [entry]
        tmp = index_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, index_path)

        kb = os.path.getsize(path) / 1024
        self.report({"INFO"}, f"Đã xuất {model_id}.glb ({kb:,.0f} KB). Game đang chạy sẽ tự nạp lại.")
        return {"FINISHED"}


# ---------------------------------------------------------------- Giao diện


class VNMAP_PT_panel(bpy.types.Panel):
    bl_label = "Bản đồ VN"
    bl_idname = "VNMAP_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Bản đồ VN"

    def draw(self, context):
        s = context.scene
        lay = self.layout

        box = lay.box()
        box.label(text="Game", icon="WORLD")
        box.prop(s, "vnmap_project_dir", text="Thư mục")

        box = lay.box()
        box.label(text="Địa điểm", icon="PINNED")
        box.prop(s, "vnmap_name", text="Tên")
        box.prop(s, "vnmap_id", text="Mã")
        box.prop(s, "vnmap_use_coords", text="Gắn theo toạ độ")
        if s.vnmap_use_coords:
            box.prop(s, "vnmap_coords_text", text="Dán", icon="PASTEDOWN")
            row = box.row(align=True)
            row.prop(s, "vnmap_lat", text="Vĩ độ")
            row.prop(s, "vnmap_lng", text="Kinh độ")
        box.prop(s, "vnmap_facade_auto", text="Hướng mặt tiền tự động")
        if not s.vnmap_facade_auto:
            box.prop(s, "vnmap_facade", text="Mặt tiền nhìn về (°)")
            box.label(text="0 = Bắc · 90 = Đông · 180 = Nam · 270 = Tây")

        box = lay.box()
        box.label(text="Dựng cho game", icon="MOD_PHYSICS")
        col = box.column(align=True)
        col.operator("vnmap.add_collider", icon="MESH_CUBE")
        col.operator("vnmap.add_floor", icon="MESH_PLANE")
        col.operator("vnmap.add_spawn", icon="EMPTY_SINGLE_ARROW")
        box.label(text="Mặt tiền quay về phía -Y (Numpad 1)", icon="INFO")

        box = lay.box()
        box.prop(s, "vnmap_draco", text="Nén Draco (file nhỏ hơn)")
        row = box.row(align=True)
        row.operator("vnmap.check", icon="CHECKMARK")
        row.scale_y = 1.2
        exp = box.row()
        exp.scale_y = 1.6
        exp.operator("vnmap.export", icon="EXPORT")


def _on_coords_text(self, _context):
    parsed = parse_coords(self.vnmap_coords_text)
    if parsed:
        self.vnmap_lat, self.vnmap_lng = parsed


def _on_name(self, _context):
    if self.vnmap_name and not self.vnmap_id:
        self.vnmap_id = slugify(self.vnmap_name)


PROPS = {
    "vnmap_project_dir": StringProperty(name="Thư mục game", subtype="DIR_PATH", description="Thư mục gốc của game (chứa package.json và public/)"),
    "vnmap_name": StringProperty(
        name="Tên địa điểm",
        description="Đúng tên địa điểm trên bản đồ, vd. 'Nhà thờ Lớn Hà Nội'",
        update=_on_name,
    ),
    "vnmap_id": StringProperty(name="Mã model", description="Tên file .glb (chữ thường, không dấu), vd. nha-tho-lon-ha-noi"),
    "vnmap_use_coords": BoolProperty(
        name="Gắn theo toạ độ",
        default=True,
        description="Đặt gốc model đúng toạ độ này và gắn với địa điểm ở gần",
    ),
    "vnmap_coords_text": StringProperty(
        name="Dán toạ độ",
        description="Dán '21.0287, 105.849' hoặc link Google Maps / OpenStreetMap",
        update=_on_coords_text,
    ),
    "vnmap_lat": FloatProperty(name="Vĩ độ", default=21.0287, min=-90, max=90, precision=6),
    "vnmap_lng": FloatProperty(name="Kinh độ", default=105.8490, min=-180, max=180, precision=6),
    "vnmap_facade_auto": BoolProperty(
        name="Hướng tự động",
        default=True,
        description="Game tự xoay model theo mặt bằng toà nhà thật và con đường gần nhất",
    ),
    "vnmap_facade": FloatProperty(name="Hướng mặt tiền", default=180, min=0, max=360, precision=1, description="Hướng la bàn mà mặt tiền nhìn về"),
    "vnmap_draco": BoolProperty(name="Nén Draco", default=True),
}

CLASSES = (VNMAP_OT_add_collider, VNMAP_OT_add_floor, VNMAP_OT_add_spawn, VNMAP_OT_check, VNMAP_OT_export, VNMAP_PT_panel)


def register():
    for c in CLASSES:
        bpy.utils.register_class(c)
    for k, v in PROPS.items():
        setattr(bpy.types.Scene, k, v)


def unregister():
    for k in PROPS:
        if hasattr(bpy.types.Scene, k):
            delattr(bpy.types.Scene, k)
    for c in reversed(CLASSES):
        bpy.utils.unregister_class(c)


if __name__ == "__main__":
    register()
