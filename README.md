# Bản đồ Việt Nam

Bản đồ 3D tương tác của Việt Nam chạy trên trình duyệt. Đây là nền móng cho game: sau này người chơi sẽ bấm vào một địa điểm để vào bên trong nó.

## MVP 1 – có gì

- Mở màn từ quả địa cầu bay vào Việt Nam.
- Zoom, xoay, nghiêng bản đồ. Chuột phải + kéo, hoặc Ctrl + kéo; trên điện thoại dùng hai ngón.
- Đường phố, sông hồ, rừng, công viên, đồi núi (hillshade), nhà 3D theo chiều cao thật.
- Bật/tắt **địa hình 3D** và chuyển **địa cầu / bản đồ phẳng**.
- Nút nhảy nhanh tới Hà Nội, Huế, Đà Nẵng, Hội An, Đà Lạt, TP.HCM, Cần Thơ.
- **Địa điểm bấm được** (từ zoom 14): nơi thờ tự, trường học, bệnh viện, quán ăn, chợ... Bấm vào sẽ hiện bảng thông tin. Nhà thờ, chùa, đình, đền được nhận diện theo tên. Nút "Vào địa điểm" mở scene 3D (MVP 2).
- Ưu tiên tên tiếng Việt (`name:vi`).
- **Chủ quyền:** ẩn nhãn đảo/biển gốc ở khu vực Hoàng Sa, Trường Sa và Biển Đông; ẩn ranh giới tranh chấp và ranh giới trên biển. Thay bằng nhãn "Quần đảo Hoàng Sa (Việt Nam)", "Quần đảo Trường Sa (Việt Nam)", "Biển Đông", "Vịnh Bắc Bộ"... (xem `src/map/sovereignty.ts`).

## MVP 2: vào bên trong địa điểm

Bấm một địa điểm trên bản đồ, chọn **Vào địa điểm** để chuyển sang scene 3D góc nhìn thứ ba.

- **Công trình chính dựng theo mẫu**, kích thước và hướng lấy theo mặt bằng toà nhà thật trên bản đồ. Mặt tiền quay về con đường gần nhất.
  - *Nhà thờ*: kiểu Gothic, hai tháp chuông có chóp, cửa vòm, cửa sổ hoa hồng, kính màu. Bên trong có hàng ghế, lối giữa trải thảm, cột, cung thánh, bàn thờ, thánh giá, nến.
  - *Chùa / đình / đền*: cổng tam quan, sân gạch, chính điện mái hai tầng, hàng cột đỏ, đèn lồng, tháp. Bên trong có tượng Phật (chùa) hoặc khám thờ (đình, đền) và hương án.
  - *Địa điểm khác* (quán, trường...): dựng đúng hình mặt bằng thật, có cửa, mái hiên, biển hiệu. Chưa có nội thất.
- **Xung quanh lấy từ dữ liệu bản đồ thật** (bán kính ~160 m): nhà, đường, vỉa hè, mặt nước, bãi cỏ, hàng cây.
- **Nhân vật mặc định** có dáng đi, bảng tên trên đầu. Va chạm với tường, nhà, cột, ghế, cây và mặt nước.
- **Điều khiển**: `W A S D` hoặc phím mũi tên để đi, giữ `Shift` để chạy. Bấm xuống đất để đi tới đó. Kéo chuột để xoay camera, lăn chuột để zoom. `H` ẩn/hiện hướng dẫn, `Esc` về bản đồ. Trên điện thoại có cần điều khiển ảo, vuốt để xoay camera.
- Camera tự kéo lại gần khi bị tường hoặc mái che, nên vào trong nhà vẫn nhìn rõ.

Mã nguồn nằm trong `src/scene/`:

| File | Vai trò |
|---|---|
| `extract.ts` | Lấy nhà, đường, nước, cây quanh địa điểm từ tile bản đồ đã tải |
| `geo.ts` | Hệ toạ độ mét, hình học (bao lồi, hình chữ nhật bao nhỏ nhất) |
| `placement.ts` | Đặt mẫu công trình theo mặt bằng thật và hướng ra đường |
| `templates/` | Các mẫu: `church.ts`, `pagoda.ts`, `generic.ts` |
| `builder.ts` | Công cụ dựng khối, tường có cửa, mái, vòm; đăng ký va chạm |
| `environment.ts` | Mặt đất, đường, nhà xung quanh, nước, cỏ, cây |
| `character.ts` | Nhân vật mặc định (sẽ thay ở MVP 4) |
| `collision.ts` | Va chạm hình tròn với đa giác trên mặt phẳng |
| `runtime.ts` | Vòng chạy three.js: ánh sáng, bầu trời, camera, điều khiển |
| `LocationScene.tsx` | Giao diện scene (React) và cần điều khiển cảm ứng |

## Tự dựng địa điểm bằng Blender

Có thể thay mẫu có sẵn bằng model tự dựng cho từng địa điểm: dựng trong Blender, bấm **Xuất sang game**, file `.glb` được lưu vào `public/models/` và đăng ký trong `public/models/index.json`. Khi chạy `npm run dev`, game tự nạp lại mỗi lần xuất.

Hướng dẫn chi tiết, quy ước đặt tên (`collider…`, `floor…`, `spawn`) và nhà nguyện mẫu: xem [`blender/README.md`](blender/README.md).

## Chạy

```bash
npm install
npm run dev
```

Mở http://localhost:5173.

```bash
npm run build          # build ra thư mục dist/ (web tĩnh, host ở đâu cũng được)
npm run validate-style # kiểm tra style bản đồ theo đặc tả MapLibre
```

## Cấu trúc

| File | Vai trò |
|---|---|
| `src/map/style.ts` | Style bản đồ: các lớp đất, nước, đường, nhà 3D, nhãn, POI |
| `src/map/sovereignty.ts` | Nhãn chủ quyền và vùng ẩn nhãn gốc |
| `src/map/poi.ts` | Phân nhóm địa điểm, màu, tên loại bằng tiếng Việt |
| `src/map/places.ts` | Khung nhìn Việt Nam và các điểm nhảy nhanh |
| `src/map/worker.ts` | Trỏ đúng file worker của MapLibre cho Vite |
| `src/components/MapView.tsx` | Khởi tạo bản đồ, xử lý bấm chọn địa điểm |
| `src/components/PoiPanel.tsx` | Bảng thông tin địa điểm |
| `src/App.tsx` | Giao diện: thanh trên, nút công cụ, chú giải |

## Nguồn dữ liệu

- Vector tile: [OpenFreeMap](https://openfreemap.org) (schema OpenMapTiles), dữ liệu © OpenStreetMap. Miễn phí, không cần API key.
- Độ cao: [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) trên AWS.
- Font chữ: lấy từ OpenFreeMap (Noto Sans, có đủ dấu tiếng Việt).

Hiện app tải tile trực tiếp từ OpenFreeMap. Khi cần chủ động hơn (offline, tự host, gộp thêm Microsoft/Google Buildings), có thể cắt riêng vùng Việt Nam ra file PMTiles.
