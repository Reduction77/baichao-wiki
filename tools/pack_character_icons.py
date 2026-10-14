#!/usr/bin/env python3
"""Cache character skill/chain icons and pack a verified offline Pages archive."""
import concurrent.futures, hashlib, http.client, io, json, os, pathlib, threading, time, urllib.parse, zipfile
from sync_data import image_url

ROOT = pathlib.Path(__file__).resolve().parents[1]
WEB = ROOT / 'web'
local = threading.local()

def download(url):
    name = hashlib.sha256(url.encode()).hexdigest()[:20] + '.webp'
    dest = WEB / 'assets/character-icons' / name
    if dest.exists():
        data = dest.read_bytes()
        if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
            return url, 'assets/character-icons/' + name
    for attempt in range(3):
        try:
            conn = getattr(local, 'connection', None)
            if conn is None:
                proxy = os.environ.get('https_proxy') or os.environ.get('HTTPS_PROXY')
                if proxy:
                    parsed = urllib.parse.urlparse(proxy)
                    if parsed.scheme != 'http':
                        raise ValueError('Only HTTP CONNECT proxies are supported')
                    conn = http.client.HTTPSConnection(parsed.hostname, parsed.port or 80, timeout=40)
                    conn.set_tunnel('static.nanoka.cc', 443)
                else:
                    conn = http.client.HTTPSConnection('static.nanoka.cc', timeout=40)
                local.connection = conn
            conn.request('GET', url.removeprefix('https://static.nanoka.cc'))
            response = conn.getresponse()
            data = response.read()
            if response.status != 200 or data[:4] != b'RIFF' or data[8:12] != b'WEBP':
                raise ValueError('Invalid icon response: ' + str(response.status))
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return url, 'assets/character-icons/' + name
        except Exception:
            if getattr(local, 'connection', None):
                local.connection.close()
            local.connection = None
            if attempt == 2:
                raise
            time.sleep(attempt + 1)

def main():
    meta = json.loads((WEB / 'data/index.json').read_text())
    existing = {}
    for path in [WEB / 'data' / meta['snapshot'] / 'images.json', WEB / 'assets/pilot/images.json']:
        existing.update(json.loads(path.read_text()))
    refs = set()
    for path in (WEB / 'data' / meta['snapshot'] / 'character').glob('*.json'):
        character = json.loads(path.read_text())
        refs.update(image_url(node.get('skill', {}).get('icon')) for node in character['skill_trees'].values())
        refs.update(image_url(chain.get('icon')) for chain in character['chains'].values())
    refs.discard('')
    needed = sorted(refs - existing.keys())
    images = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for count, (url, ref) in enumerate(pool.map(download, needed), 1):
            images[url] = ref
            if count % 50 == 0 or count == len(needed):
                print(f'Icons verified: {count}/{len(needed)}', flush=True)
    mapping = WEB / 'assets/character-icons.json'
    mapping.parent.mkdir(parents=True, exist_ok=True)
    mapping.write_text(json.dumps(images, ensure_ascii=False, sort_keys=True) + '\n')
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in [mapping, *[WEB / ref for ref in sorted(images.values())]]:
            info = zipfile.ZipInfo(path.relative_to(WEB).as_posix(), (2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())
    body = output.getvalue()
    folder = ROOT / 'snapshots/character-icons'
    folder.mkdir(parents=True, exist_ok=True)
    manifest = {'images': len(images), 'sha256': hashlib.sha256(body).hexdigest(), 'fragments': []}
    for index, offset in enumerate(range(0, len(body), 512 * 1024)):
        part = body[offset:offset + 512 * 1024]
        name = f'icons.{index:03d}.bin'
        (folder / name).write_bytes(part)
        manifest['fragments'].append({'file': name, 'sha256': hashlib.sha256(part).hexdigest()})
    (folder / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('Packed', len(images), 'icons;', len(body), 'bytes', flush=True)

if __name__ == '__main__':
    main()
