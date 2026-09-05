# Xây dựng mô hình AI nhận diện khuôn mặt SPAS

Tài liệu này giải thích đúng thứ tự các cell trong hai notebook Kaggle của nhóm:

- [Face Attendance YOLO11n Detector](https://www.kaggle.com/code/akai4705/face-attendance-yolo11n-detector)
- [Face Attendance ArcFace Recognition](https://www.kaggle.com/code/akai4705/face-attendance-arcface-recognition)

Mục tiêu của pipeline là tách bài toán thành hai mô hình:

```text
Ảnh camera
    ↓
Model 1: YOLO11n tìm khuôn mặt và BBox
    ↓
Crop khuôn mặt
    ↓
Model 2: InceptionResnetV1/ArcFace tạo vector 512D
    ↓
Cosine similarity với gallery hoặc roster của lớp
    ↓
MATCHED / UNKNOWN_PERSON / AMBIGUOUS
```

## 1. Nguồn dữ liệu và môi trường

### Model 1 — YOLO11n

- Dataset: `canomercik/wider-face-dataset-for-yolov12-format`.
- Định dạng: `train/images`, `train/labels`, `valid/images` hoặc `val/images`.
- Nhãn YOLO gồm năm giá trị: `class_id center_x center_y width height`.
- Chỉ có một lớp: `face`.
- Notebook dùng GPU Kaggle, có thể dùng toàn bộ GPU nhìn thấy bởi PyTorch.

### Model 2 — ArcFace recognition

- Dataset identity: `yakhyokhuja/webface-112x112/webface_112x112`.
- Trọng số nền: `timesler/facenet-pytorch-vggface2`.
- Mỗi thư mục con đại diện cho một identity.
- Vector đầu ra: 512 chiều.
- Notebook chọn tối đa 1.500 identity, tối đa 50 ảnh/identity và chỉ giữ identity có ít nhất 8 ảnh.

### Chạy notebook

1. Mở notebook trên Kaggle.
2. Bật Internet nếu cần cài package.
3. Chọn GPU trong phần Accelerator.
4. Chạy cell theo đúng thứ tự từ trên xuống dưới.
5. Không dùng output cũ nếu đã thay đổi dataset, checkpoint hoặc tham số.
6. Tải các file trong `/kaggle/working` về để đưa vào AI service.

---

## 2. Notebook Model 1 — YOLO11n Face Detector

### Tóm tắt các cell

| Cell | Vai trò | Kết quả chính |
|---|---|---|
| 0 | Mô tả pipeline | Không chạy code |
| 1 | Khai báo cấu hình và tìm dataset | Tạo `face.yaml`, chọn GPU |
| 2 | EDA trước preprocessing | `eda_before.json` |
| 3 | Minh họa preprocessing | `eda_after_preprocessing.png` |
| 4 | Train YOLO11n | `weights/best.pt` |
| 5 | Validation metric | `metrics.json` |
| 6 | Test ảnh thật | Ảnh có BBox và file output |

### Cell 0 — Mục tiêu

Cell Markdown chỉ ghi rõ thứ tự: EDA → preprocessing → train → metric → inference ảnh thật. Đây là cách trình bày dễ review vì mỗi bước có đầu vào và đầu ra riêng.

### Cell 1 — Cấu hình, tìm dữ liệu và tạo YAML

Cell này làm bốn việc:

1. Import thư viện xử lý file, ảnh, biểu đồ, NumPy và PyTorch.
2. Khai báo seed, số epoch, kích thước ảnh, batch size và số worker.
3. Tìm thư mục thật sự chứa `train/images` trong `/kaggle/input`.
4. Tạo file cấu hình YOLO chỉ có lớp `face`, đồng thời chọn GPU.

`DEVICE` là danh sách GPU nếu Kaggle có từ hai GPU trở lên; nếu không thì dùng GPU 0 hoặc CPU. Vì vậy notebook không khóa cứng vào một thiết bị cụ thể.

```python
from pathlib import Path
import json
import random
import cv2
import matplotlib.pyplot as plt
import numpy as np
import torch

SEED = 42
EPOCHS = 50
IMAGE_SIZE = 640
BATCH_SIZE = 8
WORKERS = 4
INPUT_ROOT = Path('/kaggle/input/datasets/canomercik/wider-face-dataset-for-yolov12-format')
OUTPUT_DIR = Path('/kaggle/working/model-1-face-detector')
CONFIG_DIR = Path('/kaggle/working/face-detector-config')
REAL_TEST_SOURCE = None

def find_dataset_root(root: Path):
    candidates = [root] + ([path for path in root.rglob('*') if path.is_dir()] if root.is_dir() else [])
    return next((path for path in candidates if (path / 'train' / 'images').is_dir()), None)

DATASET_ROOT = find_dataset_root(INPUT_ROOT)
if DATASET_ROOT is None:
    raise FileNotFoundError('Không tìm thấy train/images. Hãy sửa INPUT_ROOT tới dataset YOLO.')
VAL_SPLIT = 'valid' if (DATASET_ROOT / 'valid' / 'images').is_dir() else 'val'
if not (DATASET_ROOT / VAL_SPLIT / 'images').is_dir():
    raise FileNotFoundError('Không tìm thấy valid/images hoặc val/images.')
CONFIG_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
data_yaml = CONFIG_DIR / 'face.yaml'
data_yaml.write_text(f'path: {DATASET_ROOT}\ntrain: train/images\nval: {VAL_SPLIT}/images\nnames:\n  0: face\n', encoding='utf-8')
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)
DEVICE = list(range(torch.cuda.device_count())) if torch.cuda.is_available() and torch.cuda.device_count() > 1 else (0 if torch.cuda.is_available() else 'cpu')
print({'dataset': str(DATASET_ROOT), 'validation_split': VAL_SPLIT, 'device': DEVICE, 'data_yaml': str(data_yaml)})
```

### Cell 2 — EDA trước preprocessing

Cell này kiểm tra:

- Có bao nhiêu ảnh trong từng split.
- Có ảnh nào OpenCV không đọc được.
- Kích thước trung bình của ảnh.
- Số lượng bounding box.
- Tỷ lệ diện tích BBox so với ảnh, lấy từ nhãn YOLO.
- Một số ảnh mẫu để dùng ở cell preprocessing và inference.

EDA được lưu thành `eda_before.json`, giúp báo cáo có số liệu thay vì chỉ nhận xét bằng mắt.

```python
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

def image_paths(folder):
    return sorted(path for path in folder.rglob('*') if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS)

def label_path(image_path):
    parts = list(image_path.parts)
    if 'images' in parts:
        index = len(parts) - 1 - parts[::-1].index('images')
        parts[index] = 'labels'
        return Path(*parts).with_suffix('.txt')
    return image_path.parent.parent / 'labels' / f'{image_path.stem}.txt'

def read_labels(path):
    rows = []
    if not path.is_file():
        return rows
    for line in path.read_text(encoding='utf-8').splitlines():
        values = line.split()
        if len(values) == 5:
            try:
                rows.append(list(map(float, values)))
            except ValueError:
                pass
    return rows

eda = {'classes': {'0': 'face'}, 'splits': {}, 'corrupt_images': []}
for split in ['train', VAL_SPLIT, 'test']:
    folder = DATASET_ROOT / split / 'images'
    if not folder.is_dir():
        continue
    paths = image_paths(folder)
    widths, heights, box_sizes, label_count = [], [], [], 0
    samples = []
    for path in paths:
        image = cv2.imread(str(path))
        if image is None:
            eda['corrupt_images'].append(str(path)); continue
        height, width = image.shape[:2]
        widths.append(width); heights.append(height)
        if len(samples) < 12: samples.append(str(path))
        labels = read_labels(label_path(path)); label_count += len(labels)
        box_sizes.extend([row[3] * row[4] for row in labels])
    eda['splits'][split] = {
        'images': len(paths), 'valid_images': len(widths), 'labels': label_count,
        'mean_width': round(float(np.mean(widths)), 2) if widths else 0,
        'mean_height': round(float(np.mean(heights)), 2) if heights else 0,
        'mean_bbox_area_ratio': round(float(np.mean(box_sizes)), 6) if box_sizes else 0,
        'sample_images': samples,
    }
(OUTPUT_DIR / 'eda_before.json').write_text(json.dumps(eda, indent=2), encoding='utf-8')
print(json.dumps(eda, indent=2))
```

### Cell 3 — Preprocessing và kiểm tra trực quan

YOLO cần ảnh vuông. Hàm `letterbox` giữ nguyên tỷ lệ ảnh, resize theo cạnh lớn nhất rồi đặt ảnh lên nền xám kích thước `640x640`. Cách này tránh kéo méo khuôn mặt.

Cell tạo ảnh so sánh hai hàng:

- Hàng trên: ảnh gốc.
- Hàng dưới: ảnh sau letterbox.

```python
def letterbox(image, size=640):
    height, width = image.shape[:2]
    scale = min(size / max(width, 1), size / max(height, 1))
    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    resized = cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)
    left = (size - new_size[0]) // 2; top = (size - new_size[1]) // 2
    canvas[top:top + new_size[1], left:left + new_size[0]] = resized
    return canvas

samples = [Path(path) for path in eda['splits']['train']['sample_images'][:6]]
figure, axes = plt.subplots(2, len(samples), figsize=(18, 6), squeeze=False)
for index, path in enumerate(samples):
    image = cv2.cvtColor(cv2.imread(str(path)), cv2.COLOR_BGR2RGB)
    axes[0, index].imshow(image); axes[0, index].set_title('Ảnh gốc'); axes[0, index].axis('off')
    axes[1, index].imshow(letterbox(image, IMAGE_SIZE)); axes[1, index].set_title(f'Letterbox {IMAGE_SIZE}x{IMAGE_SIZE}'); axes[1, index].axis('off')
figure.tight_layout(); figure.savefig(OUTPUT_DIR / 'eda_after_preprocessing.png', dpi=140); plt.show()
print(OUTPUT_DIR / 'eda_after_preprocessing.png')
```

### Cell 4 — Train YOLO11n

Cell cài `ultralytics`, nạp checkpoint nền `yolo11n.pt` và fine-tune cho một lớp `face`.

Tham số đang dùng:

| Tham số | Giá trị | Ý nghĩa |
|---|---:|---|
| `epochs` | 50 | Số vòng học |
| `imgsz` | 640 | Kích thước đầu vào |
| `batch` | 8 | Số ảnh mỗi batch |
| `workers` | 4 | Luồng nạp dữ liệu |
| `device` | tự động | Dùng GPU hoặc CPU |

```python
import subprocess
subprocess.run(['pip', '-q', 'install', 'ultralytics'], check=True)
from ultralytics import YOLO

model = YOLO('yolo11n.pt')
model.train(
    data=str(data_yaml), epochs=EPOCHS, imgsz=IMAGE_SIZE, batch=BATCH_SIZE,
    workers=WORKERS, device=DEVICE, project=str(OUTPUT_DIR.parent),
    name=OUTPUT_DIR.name, exist_ok=True, plots=True,
)
print('Checkpoint:', OUTPUT_DIR / 'weights' / 'best.pt')
```

Checkpoint dùng để tích hợp vào service là:

```text
/kaggle/working/model-1-face-detector/weights/best.pt
```

### Cell 5 — Validation metric

Cell đánh giá lại model trên split validation và lưu bốn metric chính:

- `precision`: tỷ lệ dự đoán khuôn mặt là đúng.
- `recall`: tỷ lệ khuôn mặt thật được tìm thấy.
- `map50`: mAP với IoU 0.5.
- `map50_95`: mAP trung bình nhiều ngưỡng IoU từ 0.5 đến 0.95.

```python
metrics = model.val(
    data=str(data_yaml), split=VAL_SPLIT, imgsz=IMAGE_SIZE, device=DEVICE,
    plots=True, project=str(OUTPUT_DIR.parent), name=f'{OUTPUT_DIR.name}-metrics', exist_ok=True,
)
box = metrics.box
detector_metrics = {
    'precision': float(box.mp), 'recall': float(box.mr),
    'map50': float(box.map50), 'map50_95': float(box.map),
}
(OUTPUT_DIR / 'metrics.json').write_text(json.dumps(detector_metrics, indent=2), encoding='utf-8')
print(detector_metrics)
```

### Cell 6 — Inference trên ảnh thật

Cell dùng checkpoint tốt nhất để chạy một ảnh thực tế, vẽ BBox bằng `prediction.plot()` và lưu ảnh kết quả. `conf=0.35` là ngưỡng tin cậy cho bước demo, có thể điều chỉnh khi QA.

```python
from IPython.display import Image as DisplayImage, display

if REAL_TEST_SOURCE is None:
    REAL_TEST_SOURCE = Path(eda['splits']['train']['sample_images'][0])
else:
    REAL_TEST_SOURCE = Path(REAL_TEST_SOURCE)

REAL_OUTPUT = OUTPUT_DIR / 'real_inference'
REAL_OUTPUT.mkdir(parents=True, exist_ok=True)
prediction = model.predict(source=str(REAL_TEST_SOURCE), conf=0.35, device=DEVICE, save=False, verbose=False)[0]
annotated = prediction.plot()
result_path = REAL_OUTPUT / (REAL_TEST_SOURCE.stem + '_detected.jpg')
cv2.imwrite(str(result_path), annotated)
display(DisplayImage(filename=str(result_path)))
print({'input': str(REAL_TEST_SOURCE), 'output': str(result_path), 'detections': len(prediction.boxes)})
```

---

## 3. Notebook Model 2 — ArcFace recognition

### Tóm tắt các cell

| Cell | Vai trò | Kết quả chính |
|---|---|---|
| 0 | Mô tả pipeline | Không chạy code |
| 1 | Cấu hình và seed | Chọn dataset, GPU, output |
| 2 | EDA trước preprocessing | `eda_before.json` |
| 3 | Lọc identity và chia train/validation | `labels.json` |
| 4 | Transform và preview preprocessing | `eda_after_preprocessing.png` |
| 5 | ArcMargin, Dataset, DataLoader | Sẵn sàng train |
| 6 | Fine-tune backbone | `embedder_best.pt`, `metrics.json` |
| 7 | Tạo gallery và metric cosine | `gallery_512d.npy`, `recognition_metrics.json` |
| 8 | Test ảnh thật | Nhãn identity và cosine score |

### Cell 0 — Mục tiêu

Cell Markdown mô tả đầy đủ chuỗi EDA → preprocessing → train → metric → gallery cosine → inference ảnh thật.

### Cell 1 — Cấu hình và seed

Cell khai báo:

- Ảnh được resize về `160x160`.
- Backbone tạo embedding `512D`.
- Tối đa 1.500 identity.
- Tối đa 50 ảnh cho mỗi identity.
- Identity phải có ít nhất 8 ảnh.
- Dùng 5 ảnh để tạo gallery cho mỗi identity.
- Train 50 epoch, batch 64, learning rate `1e-4`.
- Dùng AMP khi có CUDA để giảm thời gian và bộ nhớ.

```python
from __future__ import annotations
import json
import random
from collections import Counter
from contextlib import nullcontext
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import torch
from PIL import Image, ImageDraw
from torch import nn
from torch.nn import functional as F
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from tqdm.auto import tqdm

INPUT_ROOT = Path('/kaggle/input/datasets')
WEBFACE_ROOT = INPUT_ROOT / 'yakhyokhuja' / 'webface-112x112' / 'webface_112x112'
FACENET_ROOT = INPUT_ROOT / 'timesler' / 'facenet-pytorch-vggface2'
OUTPUT_DIR = Path('/kaggle/working/model-2-recognition')
REAL_TEST_SOURCE = None
SEED = 42
IMAGE_SIZE = 160
EMBEDDING_DIM = 512
MAX_IDENTITIES = 1500
MAX_IMAGES_PER_IDENTITY = 50
MIN_IMAGES_PER_IDENTITY = 8
ENROLL_IMAGES = 5
EPOCHS = 50
BATCH_SIZE = 64
NUM_WORKERS = 4
LEARNING_RATE = 1e-4

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
GPU_IDS = list(range(torch.cuda.device_count())) if DEVICE.type == 'cuda' else []
print({'webface': str(WEBFACE_ROOT), 'device': str(DEVICE), 'gpu_count': len(GPU_IDS), 'output': str(OUTPUT_DIR)})
```

### Cell 2 — EDA identity và ảnh lỗi

Cell duyệt từng thư mục identity, kiểm tra ảnh bằng PIL và thống kê:

- Tổng identity.
- Tổng ảnh hợp lệ.
- Số identity đủ tối thiểu 8 ảnh.
- Identity ít và nhiều ảnh nhất.
- Kích thước ảnh trung bình.
- Danh sách ảnh lỗi.

```python
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}

def valid_image(path):
    try:
        with Image.open(path) as image: image.verify()
        return True
    except Exception:
        return False

identity_dirs = sorted(path for path in WEBFACE_ROOT.iterdir() if path.is_dir())
identity_counts = {}
corrupt_images = []
sizes = []
for identity_dir in identity_dirs:
    files = [path for path in identity_dir.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS]
    valid_files = []
    for path in files:
        if valid_image(path):
            valid_files.append(path)
            with Image.open(path) as image: sizes.append(image.size)
        else:
            corrupt_images.append(str(path))
    identity_counts[identity_dir.name] = len(valid_files)

eda_before = {
    'identities': len(identity_dirs),
    'images': sum(identity_counts.values()),
    'identities_with_minimum_images': sum(count >= MIN_IMAGES_PER_IDENTITY for count in identity_counts.values()),
    'min_images_per_identity': min(identity_counts.values()) if identity_counts else 0,
    'max_images_per_identity': max(identity_counts.values()) if identity_counts else 0,
    'mean_width': round(float(np.mean([size[0] for size in sizes])), 2) if sizes else 0,
    'mean_height': round(float(np.mean([size[1] for size in sizes])), 2) if sizes else 0,
    'corrupt_images': corrupt_images,
    'count_preview': dict(list(sorted(identity_counts.items()))[:20]),
}
(OUTPUT_DIR / 'eda_before.json').write_text(json.dumps(eda_before, indent=2), encoding='utf-8')
print(json.dumps(eda_before, indent=2))
```

### Cell 3 — Lọc identity và chia train/validation

Cell chỉ giữ identity có ít nhất `max(8, 5 + 2)` ảnh. Sau đó:

1. Giới hạn tối đa 1.500 identity.
2. Gán mỗi identity một label số.
3. Trộn ảnh bằng seed cố định.
4. Chia khoảng 20% ảnh vào validation, phần còn lại vào train.
5. Lưu ánh xạ identity → label vào `labels.json`.

Gallery ở cell 7 được tạo từ năm ảnh trong phần train; validation không được dùng để xây gallery.

```python
candidates = []
for identity, count in identity_counts.items():
    files = [path for path in sorted((WEBFACE_ROOT / identity).iterdir()) if path.suffix.lower() in IMAGE_EXTENSIONS and valid_image(path)]
    if len(files) >= max(MIN_IMAGES_PER_IDENTITY, ENROLL_IMAGES + 2):
        candidates.append((identity, files[:MAX_IMAGES_PER_IDENTITY]))
random.Random(SEED).shuffle(candidates)
candidates = candidates[:MAX_IDENTITIES]
identities = [identity for identity, _ in candidates]
label_map = {identity: index for index, identity in enumerate(sorted(identities))}
rows = []
for identity, files in candidates:
    files = list(files); random.Random(f'{SEED}:{identity}').shuffle(files)
    val_count = min(max(2, round(len(files) * 0.2)), len(files) - ENROLL_IMAGES)
    for index, path in enumerate(files):
        rows.append({'path': str(path), 'identity': identity, 'split': 'val' if index < val_count else 'train'})
train_rows = [row for row in rows if row['split'] == 'train']
val_rows = [row for row in rows if row['split'] == 'val']
if not train_rows or not val_rows:
    raise ValueError('Dataset không đủ dữ liệu sau khi lọc identity.')
(OUTPUT_DIR / 'labels.json').write_text(json.dumps(label_map, indent=2), encoding='utf-8')
print({'selected_identities': len(label_map), 'train_images': len(train_rows), 'val_images': len(val_rows), 'enroll_images_per_identity': ENROLL_IMAGES})
```

### Cell 4 — Preprocessing và tăng cường dữ liệu

Train transform gồm:

- Resize `160x160`.
- Lật ngang ngẫu nhiên.
- Thay đổi nhẹ brightness, contrast, saturation.
- Xoay và dịch nhẹ.
- Chuyển sang tensor và normalize về khoảng phù hợp với backbone.

Validation chỉ resize và normalize, không augmentation, để metric phản ánh dữ liệu thật hơn.

```python
standardize = transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5))
train_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.08),
    transforms.RandomAffine(degrees=5, translate=(0.03, 0.03)),
    transforms.ToTensor(), standardize,
])
eval_transform = transforms.Compose([transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)), transforms.ToTensor(), standardize])

figure, axes = plt.subplots(2, 6, figsize=(18, 6))
for index, identity in enumerate(identities[:6]):
    path = next(row['path'] for row in rows if row['identity'] == identity)
    with Image.open(path) as image: raw = image.convert('RGB')
    processed = eval_transform(raw)
    axes[0, index].imshow(raw); axes[0, index].set_title(identity); axes[0, index].axis('off')
    axes[1, index].imshow(torch.clamp(processed * 0.5 + 0.5, 0, 1).permute(1, 2, 0)); axes[1, index].set_title('resize + normalize'); axes[1, index].axis('off')
figure.suptitle('ArcFace preprocessing: trước và sau'); figure.tight_layout(); figure.savefig(OUTPUT_DIR / 'eda_after_preprocessing.png', dpi=140); plt.show()
print(OUTPUT_DIR / 'eda_after_preprocessing.png')
```

### Cell 5 — ArcMargin, Dataset và DataLoader

`InceptionResnetV1` là backbone tạo embedding. `ArcMarginProduct` tạo loss có margin góc để các identity tách nhau tốt hơn trên không gian vector.

`FaceDataset` đọc ảnh và trả về tensor cùng label số. `DataLoader` hỗ trợ shuffle, pin memory và persistent workers khi có CUDA.

```python
if FACENET_ROOT.is_dir():
    wheel = next(FACENET_ROOT.glob('facenet_pytorch-*.whl'), None)
    if wheel is not None:
        import subprocess; subprocess.run(['pip', '-q', 'install', str(wheel)], check=True)
from facenet_pytorch import InceptionResnetV1

weights_path = FACENET_ROOT / '20180402-114759-vggface2-features.pth'
if not weights_path.is_file():
    raise FileNotFoundError('Không tìm thấy VGGFace2 weights trong FACENET_ROOT.')

class ArcMarginProduct(nn.Module):
    def __init__(self, embedding_dim, class_count, scale=32.0, margin=0.35):
        super().__init__()
        self.weight = nn.Parameter(torch.empty(class_count, embedding_dim))
        nn.init.xavier_uniform_(self.weight)
        self.scale, self.margin = scale, margin
    def forward(self, embeddings, labels):
        cosine = F.linear(F.normalize(embeddings), F.normalize(self.weight)).clamp(-1 + 1e-7, 1 - 1e-7)
        target = torch.cos(torch.acos(cosine) + self.margin)
        one_hot = F.one_hot(labels, num_classes=cosine.size(1)).float()
        return (cosine * (1.0 - one_hot) + target * one_hot) * self.scale

class FaceDataset(Dataset):
    def __init__(self, records, labels, transform): self.records, self.labels, self.transform = records, labels, transform
    def __len__(self): return len(self.records)
    def __getitem__(self, index):
        record = self.records[index]
        with Image.open(record['path']) as image: pixels = self.transform(image.convert('RGB'))
        return pixels, self.labels[record['identity']]

loader_args = {'batch_size': BATCH_SIZE, 'num_workers': NUM_WORKERS, 'pin_memory': DEVICE.type == 'cuda', 'persistent_workers': NUM_WORKERS > 0}
train_loader = DataLoader(FaceDataset(train_rows, label_map, train_transform), shuffle=True, **loader_args)
val_loader = DataLoader(FaceDataset(val_rows, label_map, eval_transform), shuffle=False, **loader_args)
```

### Cell 6 — Fine-tune backbone và lưu checkpoint tốt nhất

Điểm quan trọng của cell này là:

```python
InceptionResnetV1(classify=False, pretrained=None, num_classes=8631)
```

Khi `pretrained=None`, thư viện yêu cầu phải truyền `num_classes`. Giá trị `8631` khớp với checkpoint VGGFace2 được nạp bằng `load_state_dict`. Đây là nguyên nhân của lỗi `At least one of "pretrained" or "num_classes" must be specified` trước đây.

Mỗi epoch gồm train, validation top-1/top-5, cập nhật CosineAnnealing và chỉ lưu checkpoint khi top-1 tốt hơn.

```python
embedder = InceptionResnetV1(classify=False, pretrained=None, num_classes=8631)
embedder.load_state_dict(torch.load(weights_path, map_location='cpu', weights_only=True), strict=True)
embedder = embedder.to(DEVICE)
if len(GPU_IDS) > 1: embedder = nn.DataParallel(embedder, device_ids=GPU_IDS)
head = ArcMarginProduct(EMBEDDING_DIM, len(label_map)).to(DEVICE)
optimizer = torch.optim.AdamW(list(embedder.parameters()) + list(head.parameters()), lr=LEARNING_RATE, weight_decay=1e-4)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-6)
use_amp = DEVICE.type == 'cuda'
scaler = torch.amp.GradScaler('cuda', enabled=use_amp)
best_top1, history = 0.0, []

for epoch in range(1, EPOCHS + 1):
    embedder.train(); head.train()
    for images, labels in tqdm(train_loader, desc=f'ArcFace {epoch}/{EPOCHS}'):
        images = images.to(DEVICE, non_blocking=True); labels = labels.to(DEVICE, non_blocking=True)
        optimizer.zero_grad(set_to_none=True)
        context = torch.autocast(device_type='cuda', enabled=True) if use_amp else nullcontext()
        with context:
            loss = F.cross_entropy(head(embedder(images), labels), labels, label_smoothing=0.05)
        scaler.scale(loss).backward(); scaler.step(optimizer); scaler.update()
    embedder.eval(); head.eval(); correct = total = top5_correct = 0
    with torch.inference_mode():
        for images, labels in val_loader:
            labels = labels.to(DEVICE, non_blocking=True); logits = head(embedder(images.to(DEVICE, non_blocking=True)), labels)
            predictions = logits.argmax(1); top5 = logits.topk(min(5, logits.shape[1]), dim=1).indices
            correct += int((predictions == labels).sum()); top5_correct += int((top5 == labels[:, None]).any(dim=1).sum()); total += labels.numel()
    top1 = correct / max(total, 1); top5_accuracy = top5_correct / max(total, 1); scheduler.step()
    row = {'epoch': epoch, 'val_top1': top1, 'val_top5': top5_accuracy, 'lr': optimizer.param_groups[0]['lr']}
    history.append(row); print(row)
    if top1 > best_top1:
        best_top1 = top1
        state_dict = embedder.module.state_dict() if isinstance(embedder, nn.DataParallel) else embedder.state_dict()
        torch.save({'state_dict': state_dict, 'head': head.state_dict(), 'image_size': IMAGE_SIZE, 'embedding_dim': EMBEDDING_DIM, 'backbone': 'InceptionResnetV1-VGGFace2'}, OUTPUT_DIR / 'embedder_best.pt')

(OUTPUT_DIR / 'metrics.json').write_text(json.dumps({'best_val_top1': best_top1, 'history': history}, indent=2), encoding='utf-8')
print({'best_val_top1': best_top1, 'checkpoint': str(OUTPUT_DIR / 'embedder_best.pt')})
```

### Cell 7 — Tạo gallery và đánh giá cosine similarity

Cell này chuyển bài toán classification lúc train thành bài toán nhận diện lúc chạy hệ thống:

1. Nạp backbone tốt nhất, bỏ classification head.
2. Mỗi identity lấy 5 ảnh enrollment trong train.
3. Tạo embedding cho từng ảnh.
4. Lấy trung bình 5 embedding rồi L2 normalize.
5. Xếp các vector thành ma trận gallery `N x 512`.
6. Với ảnh validation, tính `gallery_matrix @ embedding` vì các vector đã normalize.
7. Tính top-1, top-5, cosine đúng identity và margin với người đứng thứ hai.

```python
checkpoint = torch.load(OUTPUT_DIR / 'embedder_best.pt', map_location=DEVICE, weights_only=True)
export_model = InceptionResnetV1(classify=False, pretrained=None, num_classes=8631).to(DEVICE)
export_model.load_state_dict(checkpoint['state_dict'], strict=True); export_model.eval()

def embed_path(path):
    with Image.open(path) as image: pixels = eval_transform(image.convert('RGB')).unsqueeze(0).to(DEVICE)
    with torch.inference_mode(): return F.normalize(export_model(pixels), dim=1)[0].cpu().numpy()

gallery_names, gallery_vectors = [], []
for identity in sorted(label_map):
    enrollment = [row['path'] for row in train_rows if row['identity'] == identity][:ENROLL_IMAGES]
    vector = np.mean([embed_path(path) for path in enrollment], axis=0); vector /= max(np.linalg.norm(vector), 1e-12)
    gallery_names.append(identity); gallery_vectors.append(vector)
gallery_matrix = np.stack(gallery_vectors)

correct = top5_correct = total = 0; true_scores = []; margins = []
for row in val_rows:
    similarities = gallery_matrix @ embed_path(row['path']); order = np.argsort(similarities)[::-1]
    predicted = gallery_names[int(order[0])]; correct += int(predicted == row['identity'])
    top5_correct += int(row['identity'] in [gallery_names[int(index)] for index in order[:5]])
    true_scores.append(float(similarities[gallery_names.index(row['identity'])]))
    margins.append(float(similarities[order[0]] - similarities[order[1]]) if len(order) > 1 else 1.0); total += 1

recognition_metrics = {
    'gallery_top1_accuracy': correct / max(total, 1),
    'gallery_top5_accuracy': top5_correct / max(total, 1),
    'gallery_identities': len(gallery_names), 'evaluated_images': total,
    'true_cosine_mean': float(np.mean(true_scores)), 'true_cosine_min': float(np.min(true_scores)),
    'top1_margin_mean': float(np.mean(margins)),
}
np.save(OUTPUT_DIR / 'gallery_512d.npy', gallery_matrix)
(OUTPUT_DIR / 'gallery_labels.json').write_text(json.dumps(gallery_names, indent=2), encoding='utf-8')
(OUTPUT_DIR / 'recognition_metrics.json').write_text(json.dumps(recognition_metrics, indent=2), encoding='utf-8')
print(recognition_metrics)
```

### Cell 8 — Khôi phục gallery và test ảnh thật

Cell này có thêm phần khôi phục `gallery_matrix` và `gallery_names` từ file. Nhờ vậy có thể chạy riêng cell cuối sau khi kernel đã restart mà không gặp lỗi `NameError: name 'gallery_matrix' is not defined`.

Ngưỡng `0.45` trong cell chỉ là ngưỡng demo trên ảnh test. Khi đưa vào hệ thống, ngưỡng nhận diện được cấu hình theo roster qua Backend/AI service và cần được đánh giá lại bằng dữ liệu thực tế.

```python
if 'gallery_matrix' not in globals() or 'gallery_names' not in globals():
    gallery_matrix = np.load(OUTPUT_DIR / 'gallery_512d.npy').astype(np.float32)
    gallery_names = json.loads((OUTPUT_DIR / 'gallery_labels.json').read_text(encoding='utf-8'))
    gallery_matrix /= np.clip(np.linalg.norm(gallery_matrix, axis=1, keepdims=True), 1e-8, None)

if REAL_TEST_SOURCE is None:
    REAL_TEST_SOURCE = Path(val_rows[0]['path'])
else:
    REAL_TEST_SOURCE = Path(REAL_TEST_SOURCE)
real_paths = [REAL_TEST_SOURCE] if REAL_TEST_SOURCE.is_file() else sorted(path for path in REAL_TEST_SOURCE.rglob('*') if path.suffix.lower() in IMAGE_EXTENSIONS)[:6]
REAL_OUTPUT = OUTPUT_DIR / 'real_inference'; REAL_OUTPUT.mkdir(parents=True, exist_ok=True)
for path in real_paths:
    with Image.open(path) as image: result = image.convert('RGB').resize((IMAGE_SIZE, IMAGE_SIZE))
    similarities = gallery_matrix @ embed_path(path); index = int(np.argmax(similarities)); score = float(similarities[index])
    identity = gallery_names[index] if score >= 0.45 else 'UNKNOWN_PERSON'
    canvas = result.copy(); draw = ImageDraw.Draw(canvas); draw.rectangle((0, 0, IMAGE_SIZE - 1, IMAGE_SIZE - 1), outline='green' if identity != 'UNKNOWN_PERSON' else 'red', width=3)
    draw.text((5, 5), f'{identity} {score:.3f}', fill='green' if identity != 'UNKNOWN_PERSON' else 'red')
    target = REAL_OUTPUT / path.name; canvas.save(target); display(canvas)
    print({'input': str(path), 'output': str(target), 'identity': identity, 'cosine': score})
```

---

## 4. Đóng gói model cho AI service

AI service hiện tại đọc model từ `ai-service/models` hoặc đường dẫn trong biến môi trường:

```text
FACE_DETECTOR_PATH       → face_best.pt
FACE_RECOGNITION_PATH    → facenet_best.pt
```

Đóng gói tối thiểu:

```text
ai-service/
├── models/
│   ├── face_best.pt       # copy từ YOLO .../weights/best.pt
│   └── facenet_best.pt    # copy từ ArcFace .../embedder_best.pt
└── main.py
```

`facenet_best.pt` phải giữ object checkpoint có khóa `state_dict`, vì `ai-service/main.py` nạp `checkpoint['state_dict']`. Không đổi sang chỉ lưu raw state dict nếu chưa sửa loader.

Luồng inference ở service:

1. `face_boxes()` gọi YOLO với `imgsz=640`, `conf=0.35`.
2. `crop()` thêm margin 20% quanh BBox.
3. `align_face()` thử các góc 0/90/180/270 rồi căn landmark về template 160x160.
4. `embedding()` chạy InceptionResnetV1 và L2 normalize vector 512D.
5. `recognize_frame()` tính cosine với ma trận roster của đúng session.
6. AI trả BBox, score, pose, quality, evidence crop và frame preview.

## 5. Gallery toàn bộ và roster lớp

Notebook dùng gallery toàn bộ identity để đánh giá chất lượng model. Hệ thống SPAS không tìm kiếm tự do trên toàn trường khi điểm danh:

```text
Danh sách lớp A: SV001, SV002, SV003
        ↓
Backend nạp roster của session A vào AI
        ↓
AI tạo ma trận N x 512 của đúng roster
        ↓
Ảnh camera → vector 512D
        ↓
Cosine với ma trận roster A
        ↓
Đạt threshold → MATCHED
Không đạt → UNKNOWN_PERSON
Khoảng cách top-1/top-2 quá nhỏ → AMBIGUOUS
```

Sinh viên của lớp khác, giảng viên hoặc người ngoài roster không được tự động gán thành thành viên lớp hiện tại.

## 6. Metric cần đưa vào báo cáo

### Detector

- Số ảnh và BBox trong train/validation.
- Số ảnh lỗi.
- Precision, recall, mAP50, mAP50-95.
- Ảnh preprocessing trước/sau.
- Ảnh inference thật có BBox.

### Recognition

- Số identity và số ảnh sau lọc.
- Số ảnh train/validation.
- Số ảnh lỗi.
- `best_val_top1`, `val_top5` theo epoch.
- `gallery_top1_accuracy`, `gallery_top5_accuracy`.
- `true_cosine_mean`, `true_cosine_min`.
- `top1_margin_mean`.
- Ảnh inference thật có identity và cosine score.

Không nên chỉ báo cáo accuracy. Với điểm danh, cần lưu thêm false accept/false reject, UNKNOWN và AMBIGUOUS trên dữ liệu camera lớp học.
