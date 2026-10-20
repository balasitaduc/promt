"""Create a minimal unpackable Chrome extension archive using Python's stdlib."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from shutil import copyfile
import argparse
parser = argparse.ArgumentParser(description='Build a reviewable extension ZIP locally; copying to the repository root is explicit.')
parser.add_argument('--copy-to-root', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
target = root / 'dist' / 'video-to-prompt.zip'
target.parent.mkdir(exist_ok=True)
files = ['manifest.json', 'background.js', 'content.js', 'core.js', 'deep.js', 'local.js', 'storage.js', 'reports.js', 'vision.js', 'vision-worker.js', 'vision-config.js', 'sidepanel.html', 'sidepanel.css', 'sidepanel.js', 'README.md', 'MODELS.md', 'PRIVACY.md', 'SECURITY.md']
files += [str(path.relative_to(root)) for path in sorted((root / 'vendor').iterdir()) if path.is_file()]
assert (root / 'vendor' / 'ort-wasm-simd-threaded.wasm').is_file(), 'Run npm run build:vision before packaging'
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
if args.copy_to_root:
    copyfile(target, root / 'video-to-prompt.zip')
print(target)
