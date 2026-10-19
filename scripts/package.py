"""Create a minimal unpackable Chrome extension archive using Python's stdlib."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from shutil import copyfile
root = Path(__file__).resolve().parents[1]
target = root / 'dist' / 'video-to-prompt.zip'
target.parent.mkdir(exist_ok=True)
files = ['manifest.json', 'background.js', 'content.js', 'core.js', 'sidepanel.html', 'sidepanel.css', 'sidepanel.js', 'README.md', 'PRIVACY.md']
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
copyfile(target, root / 'video-to-prompt.zip')
print(target)
