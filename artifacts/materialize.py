import base64
import gzip
import hashlib
import os
import pathlib

dest = os.environ.get("PERSONAL_DEST", "personal.html")
parts = sorted(pathlib.Path("artifacts").glob("personal.part*.b64"))
if not parts:
    raise SystemExit("no artifacts/personal.part*.b64")
html = gzip.decompress(base64.b64decode("".join(p.read_text() for p in parts)))
expect = "19831dbb91fad6b26b0a14e31eac33e08e76eacf"
got = hashlib.sha1(b"blob %d\x00" % len(html) + html).hexdigest()
if got != expect:
    raise SystemExit(f"blob mismatch {got} != {expect}")
pathlib.Path(dest).write_bytes(html)
print("wrote", dest, "bytes", len(html), "gitblob", got)
for p in parts:
    p.unlink(missing_ok=True)
pathlib.Path("artifacts/materialize.py").unlink(missing_ok=True)
wf = pathlib.Path(".github/workflows/materialize-personal.yml")
wf.unlink(missing_ok=True)
try:
    pathlib.Path("artifacts").rmdir()
except OSError:
    pass
try:
    wf.parent.rmdir()
except OSError:
    pass
