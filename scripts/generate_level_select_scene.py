"""
生成 LevelSelect.scene — 最小化场景文件
仅包含 Canvas + Camera + LevelSelectBootstrap 组件
所有 UI 节点由 LevelSelectBootstrap.onLoad() 在运行时创建
"""
import json
import uuid as _uuid
import os

SCENE_DIR = r"G:\个人项目\未完成\AIGC实践项目\GraphRay\assets\scenes"
SCENE_NAME = "LevelSelect"
BOOTSTRAP_UUID_HEX = "b8c9d0e1-f2a3-4b45-cdef-6789abcdef01"  # LevelSelectBootstrap.ts.meta

# ======== Cocos UUID 压缩 ========
BASE64_KEY_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

def compress_uuid_hex(hex_str: str, reserved_head_length: int = 5) -> str:
    """将标准 hex UUID 压缩为 Cocos 23 字符格式"""
    hex_str = hex_str.replace("-", "")
    head = hex_str[:reserved_head_length]
    i = reserved_head_length
    result = head
    while i < len(hex_str):
        if i + 2 >= len(hex_str):
            break
        v1 = int(hex_str[i], 16)
        v2 = int(hex_str[i+1], 16)
        v3 = int(hex_str[i+2], 16)
        result += BASE64_KEY_CHARS[(v1 << 2) | (v2 >> 2)]
        result += BASE64_KEY_CHARS[((v2 & 3) << 4) | v3]
        i += 3
    return result

BOOTSTRAP_CID = compress_uuid_hex(BOOTSTRAP_UUID_HEX)

# ======== 生成 UUIDs ========
scene_uuid = str(_uuid.uuid4())
canvas_compressed_id = compress_uuid_hex(str(_uuid.uuid4()).replace("-", ""))
camera_compressed_id = compress_uuid_hex(str(_uuid.uuid4()).replace("-", ""))


def vec3(x=0, y=0, z=0):
    return {"__type__": "cc.Vec3", "x": x, "y": y, "z": z}

def quat(x=0, y=0, z=0, w=1):
    return {"__type__": "cc.Quat", "x": x, "y": y, "z": z, "w": w}

def color(r=255, g=255, b=255, a=255):
    return {"__type__": "cc.Color", "r": r, "g": g, "b": b, "a": a}

# 场景数据结构 — 4 层：
#   [0] SceneAsset
#   [1] Scene (cc.Scene)
#   [2] Canvas node
#   [3] Camera node
#   [4] Canvas's UITransform
#   [5] Canvas's Camera (cc.Camera)
#   [6] Canvas's Widget
#   [7] LevelSelectBootstrap component
#   [8] Camera's UITransform
#   [9] Camera's Camera (cc.Camera)
#   [10] SceneGlobals

scene_data = [
    # [0] SceneAsset
    {
        "__type__": "cc.SceneAsset",
        "_name": SCENE_NAME,
        "_objFlags": 0,
        "__editorExtras__": {},
        "_native": "",
        "scene": {"__id__": 1}
    },
    # [1] Scene
    {
        "__type__": "cc.Scene",
        "_name": SCENE_NAME,
        "_objFlags": 0,
        "__editorExtras__": {},
        "_parent": None,
        "_children": [
            {"__id__": 2},   # Canvas
            {"__id__": 3},   # Camera
        ],
        "_active": True,
        "_components": [],
        "_prefab": None,
        "_lpos": vec3(0, 0, 0),
        "_lrot": quat(0, 0, 0, 1),
        "_lscale": vec3(1, 1, 1),
        "_mobility": 0,
        "_layer": 1073741824,
        "_euler": vec3(0, 0, 0),
        "autoReleaseAssets": False,
        "_globals": {"__id__": 10},
        "_id": scene_uuid
    },
    # [2] Canvas node
    {
        "__type__": "cc.Node",
        "_name": "Canvas",
        "_objFlags": 0,
        "__editorExtras__": {},
        "_parent": {"__id__": 1},
        "_children": [],
        "_active": True,
        "_components": [
            {"__id__": 4},  # UITransform
            {"__id__": 5},  # cc.Camera
            {"__id__": 6},  # cc.Widget
            {"__id__": 7},  # LevelSelectBootstrap
        ],
        "_prefab": None,
        "_lpos": vec3(960, 540, 0),
        "_lrot": quat(0, 0, 0, 1),
        "_lscale": vec3(1, 1, 1),
        "_mobility": 0,
        "_layer": 33554432,
        "_euler": vec3(0, 0, 0),
        "_id": canvas_compressed_id
    },
    # [3] Camera node
    {
        "__type__": "cc.Node",
        "_name": "Camera",
        "_objFlags": 0,
        "__editorExtras__": {},
        "_parent": {"__id__": 1},
        "_children": [],
        "_active": True,
        "_components": [
            {"__id__": 8},  # UITransform
            {"__id__": 9},  # cc.Camera
        ],
        "_prefab": None,
        "_lpos": vec3(960, 540, 1000),
        "_lrot": quat(0, 0, 0, 1),
        "_lscale": vec3(1, 1, 1),
        "_mobility": 0,
        "_layer": 1073741824,
        "_euler": vec3(0, 0, 0),
        "_id": camera_compressed_id
    },
    # [4] Canvas UITransform
    {
        "__type__": "cc.UITransform",
        "_name": "",
        "_objFlags": 0,
        "__editorExtras__": {},
        "node": {"__id__": 2},
        "_enabled": True,
        "__prefab": None,
        "_contentSize": {"__type__": "cc.Size", "width": 1920, "height": 1080},
        "_anchorPoint": {"__type__": "cc.Vec2", "x": 0.5, "y": 0.5},
        "_id": compress_uuid_hex(str(_uuid.uuid4()).replace("-", ""))
    },
    # [5] Canvas Camera
    {
        "__type__": "cc.Camera",
        "_name": "",
        "_objFlags": 0,
        "__editorExtras__": {},
        "node": {"__id__": 2},
        "_enabled": True,
        "__prefab": None,
        "_projection": 0,
        "_priority": 0,
        "_fov": 45,
        "_fovAxis": 0,
        "_orthoHeight": 540,
        "_near": 0.1,
        "_far": 2000,
        "_color": color(51, 51, 51, 255),
        "_depth": 1,
        "_stencil": 0,
        "_clearFlags": 7,
        "_rect": {"__type__": "cc.Rect", "x": 0, "y": 0, "width": 1, "height": 1},
        "_aperture": 19,
        "_shutter": 7,
        "_iso": 0,
        "_screenScale": 1,
        "_visibility": 1108344832,
        "_targetTexture": None,
        "_id": compress_uuid_hex(str(_uuid.uuid4()).replace("-", ""))
    },
    # [6] Canvas Widget
    {
        "__type__": "cc.Widget",
        "_name": "",
        "_objFlags": 0,
        "__editorExtras__": {},
        "node": {"__id__": 2},
        "_enabled": True,
        "__prefab": None,
        "_alignFlags": 45,
        "_target": None,
        "_left": 0,
        "_right": 0,
        "_top": 0,
        "_bottom": 0,
        "_horizontalCenter": 0,
        "_verticalCenter": 0,
        "_isAbsLeft": True,
        "_isAbsRight": True,
        "_isAbsTop": True,
        "_isAbsBottom": True,
        "_isAlignOnce": False,
        "_id": compress_uuid_hex(str(_uuid.uuid4()).replace("-", ""))
    },
    # [7] LevelSelectBootstrap component
    {
        "__type__": BOOTSTRAP_CID,
        "_name": "",
        "_objFlags": 0,
        "__editorExtras__": {},
        "node": {"__id__": 2},
        "_enabled": True,
        "__prefab": None,
        "_id": compress_uuid_hex(str(_uuid.uuid4()).replace("-", ""))
    },
    # [8] Camera UITransform
    {
        "__type__": "cc.UITransform",
        "_name": "",
        "_objFlags": 0,
        "__editorExtras__": {},
        "node": {"__id__": 3},
        "_enabled": True,
        "__prefab": None,
        "_contentSize": {"__type__": "cc.Size", "width": 1, "height": 1},
        "_anchorPoint": {"__type__": "cc.Vec2", "x": 0.5, "y": 0.5},
        "_id": compress_uuid_hex(str(_uuid.uuid4()).replace("-", ""))
    },
    # [9] Camera's Camera
    {
        "__type__": "cc.Camera",
        "_name": "",
        "_objFlags": 0,
        "__editorExtras__": {},
        "node": {"__id__": 3},
        "_enabled": True,
        "__prefab": None,
        "_projection": 0,
        "_priority": 1,
        "_fov": 45,
        "_fovAxis": 0,
        "_orthoHeight": 540,
        "_near": 0.1,
        "_far": 2000,
        "_color": color(0, 0, 0, 255),
        "_depth": 1,
        "_stencil": 0,
        "_clearFlags": 6,
        "_rect": {"__type__": "cc.Rect", "x": 0, "y": 0, "width": 1, "height": 1},
        "_aperture": 19,
        "_shutter": 7,
        "_iso": 0,
        "_screenScale": 1,
        "_visibility": 1108344832,
        "_targetTexture": None,
        "_id": compress_uuid_hex(str(_uuid.uuid4()).replace("-", ""))
    },
    # [10] SceneGlobals
    {
        "__type__": "cc.SceneGlobals",
        "ambient": {"__id__": 11},
        "shadows": {"__id__": 12},
        "_skybox": {"__id__": 13},
        "fog": {"__id__": 14},
        "octree": {"__id__": 15},
        "skin": {"__id__": 16},
        "lightProbeInfo": {"__id__": 17},
        "postSettings": {"__id__": 18},
        "bakedWithStationaryMainLight": False,
        "bakedWithHighpLightmap": False,
        "_id": compress_uuid_hex(str(_uuid.uuid4()).replace("-", ""))
    },
    # [11] - [18] SceneGlobals 子节点（使用默认值）
    *[
        {
            "__type__": f"cc.{t}",
            "_objFlags": 0,
            "_name": "",
            "_id": compress_uuid_hex(str(_uuid.uuid4()).replace("-", ""))
        }
        for t in ["AmbientInfo", "ShadowsInfo", "SkyboxInfo", "FogInfo",
                  "OctreeInfo", "SkinInfo", "LightProbeInfo", "PostSettingsInfo"]
    ]
]

# 保存
path = os.path.join(SCENE_DIR, SCENE_NAME + ".scene")
with open(path, "w", encoding="utf-8") as f:
    json.dump(scene_data, f, ensure_ascii=False, indent=2)
print(f"✓ 场景已生成: {path}")

# 生成 .meta
meta_path = path + ".meta"
meta = {
    "ver": "1.0.8",
    "importer": "scene",
    "imported": True,
    "uuid": scene_uuid,
    "files": [],
    "subMetas": {},
    "userData": {}
}
with open(meta_path, "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)
print(f"✓ 场景 .meta 已生成: {meta_path}")
print(f"  场景 UUID: {scene_uuid}")
