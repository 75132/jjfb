"""配置 JSON 加载。Items.json 路径顺序固定；其余文件按绝对路径 + mtime 缓存。"""
import json
import os

_ITEMS_CACHE = {'mtime': None, 'data': None, 'path': None}
_JSON_FILE_CACHE = {}


def _candidate_paths():
    server_dir = os.path.dirname(os.path.abspath(__file__))
    repo_dir = os.path.dirname(server_dir)
    return (
        os.path.join(server_dir, 'data', 'Items.json'),
        os.path.join(server_dir, 'handlers', 'json', 'Items.json'),
        os.path.join(repo_dir, 'assets', 'resources', 'json', 'Items.json'),
    )


def resolve_items_json_path():
    for path in _candidate_paths():
        if os.path.exists(path):
            return path
    return None


def load_items_json():
    """返回 Items.json 解析结果。文件不存在或读失败时返回空列表。"""
    global _ITEMS_CACHE
    path = resolve_items_json_path()
    if not path:
        return []
    try:
        mt = os.path.getmtime(path)
        if _ITEMS_CACHE['path'] == path and _ITEMS_CACHE['mtime'] == mt and _ITEMS_CACHE['data'] is not None:
            return _ITEMS_CACHE['data']
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        _ITEMS_CACHE = {'mtime': mt, 'data': data, 'path': path}
        return data
    except Exception as e:
        print(f'[config_loader] 加载 Items.json 失败: {e}')
        return []


def load_json_file(path):
    """按 mtime 缓存 json.load。返回 (data, from_cache)。文件不存在或解析失败时抛异常，不写入缓存。"""
    key = os.path.normcase(os.path.abspath(path))
    mt = os.path.getmtime(path)
    hit = _JSON_FILE_CACHE.get(key)
    if hit is not None and hit[0] == mt:
        return hit[1], True
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    _JSON_FILE_CACHE[key] = (mt, data)
    return data, False
