# Dựng địa điểm bằng Blender

Quy trình: dựng model trong Blender → bấm **Xuất sang game** → game tự dùng model đó thay cho mẫu có sẵn khi người chơi vào địa điểm.

## 1. Cài add-on (một lần)

1. Mở Blender (4.2 trở lên, đã thử với 5.2).
2. **Edit → Preferences → Add-ons**, bấm mũi tên **⌄** ở góc phải → **Install from Disk…**
3. Chọn file `blender/vn_map_exporter.py` → bật **Bản đồ VN – Xuất model**.
4. Trong khung 3D nhấn **N** → tab **Bản đồ VN**.

## 2. Thử với nhà nguyện mẫu

1. Tab **Scripting** → **Open** → chọn `blender/example_chapel.py` → **Run Script**. Script sẽ xoá scene hiện tại.
2. Trong tab **Bản đồ VN**:
   - **Thư mục**: chọn thư mục gốc của game (chứa `package.json`).
   - **Gắn theo toạ độ** → ô **Dán**: dán toạ độ hoặc link Google Maps / OpenStreetMap của một địa điểm trên bản đồ. Ví dụ `21.0287, 105.8490` là Nhà thờ Lớn Hà Nội.
3. Bấm **Kiểm tra**, rồi **Xuất sang game**.
4. Chạy game bằng `npm run dev`, bay tới địa điểm đó, bấm vào địa điểm → **Vào địa điểm**.

Khi game đang chạy, mỗi lần bấm **Xuất sang game**, scene tự nạp model mới và giữ nguyên vị trí nhân vật. Không cần tải lại trang.

## 3. Quy ước khi dựng

| Quy ước | Vì sao |
|---|---|
| Đơn vị **mét** (Scene → Units: Metric, Unit Scale 1) | Game hiểu 1 đơn vị = 1 m. Nhân vật cao ~1,72 m |
| Gốc toạ độ ở **tâm công trình**, đáy sát **Z = 0** | Gốc model được đặt đúng toạ độ đã khai báo |
| **Mặt tiền quay về phía −Y** (phía người nhìn khi bấm Numpad 1) | Game xoay mặt tiền ra đường, hoặc theo hướng la bàn nếu tự nhập |
| Vật thể tên `collider…` | Khối va chạm, bị ẩn trong game. Mỗi khối tính theo hình nhìn từ trên xuống (bao lồi), nên **tường có cửa phải tách thành nhiều khối hai bên cửa**. Khối có đáy cao hơn 2 m (tường trên khung cửa) không chặn đường |
| Vật thể tên `floor…` | Sàn hoặc bục: nhân vật đứng lên mặt trên của nó (bậc thềm, bục cung thánh, sân khấu) |
| Empty tên `spawn` | Chỗ nhân vật xuất hiện, nhìn theo hướng mũi tên |

Các nút trong add-on tạo sẵn những vật thể này:
- **Thêm khối va chạm**: tạo hộp `collider_…` bao quanh từng vật thể đang chọn.
- **Thêm sàn / bục**: tạo vùng `floor_…` từ vật thể đang chọn.
- **Đặt điểm xuất hiện**: đặt `spawn` tại con trỏ 3D.

Không có `collider…` thì cả model được coi là một khối đặc, người chơi chỉ đi vòng bên ngoài.

## 4. Gắn model vào địa điểm

Add-on ghi vào `public/models/index.json`, ví dụ:

```json
[
  {
    "id": "nha-tho-lon-ha-noi",
    "file": "nha-tho-lon-ha-noi.glb",
    "name": "Nhà thờ Lớn Hà Nội",
    "lngLat": [105.849, 21.0287],
    "facade": "auto",
    "updated": "2026-11-06T10:00:00Z"
  }
]
```

- `name`: gắn với địa điểm **đúng tên này** trên bản đồ (không phân biệt hoa thường).
- `lngLat`: gốc model đặt đúng toạ độ này. Địa điểm nào trong bán kính `matchRadius` m (mặc định 60) cũng dùng model này.
- `facade`:
  - `"auto"`: game tự xoay theo mặt bằng toà nhà thật và con đường gần nhất.
  - Một con số: hướng la bàn mà mặt tiền nhìn về (0 = Bắc, 90 = Đông, 180 = Nam, 270 = Tây). Dùng khi hướng tự động đoán sai.

Có thể sửa tay file này. Muốn bỏ model thì xoá mục tương ứng.

## 5. Mẹo để giống ngoài đời

- **Ảnh tham chiếu**: chụp hoặc lấy ảnh mặt tiền chụp thẳng, kèm vài góc chéo. Dùng [fSpy](https://fspy.io) để lấy góc máy từ ảnh rồi dựng khớp theo.
- **Kích thước**: lấy chiều dài, chiều rộng từ bản đồ (mặt bằng trên OpenStreetMap). Chiều cao ước theo số tầng hoặc tỉ lệ trong ảnh.
- **Nhẹ cho điện thoại**: dưới ~300 nghìn tam giác, texture tối đa 2048 px. Bật nén Draco (mặc định đã bật).
- **Ánh sáng**: game có sẵn ánh sáng mặt trời và trời. Đèn trong Blender chưa được xuất sang.
