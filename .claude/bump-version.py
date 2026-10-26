# Bump ?v= on every stylesheet and script in every page, in one go.
#
# Browsers hold on to CSS and JS for a long time, so a deploy is only really
# live once the ?v= number changes. Bumping only some of them is worse than
# bumping none: the pages then mix new code with old text. Run this before
# every push that touches anything under assets/.
#
#   python .claude/bump-version.py
#
import io, re, glob, os, sys

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

PAGES = sorted(glob.glob("*.html") + glob.glob("members/*.html") + glob.glob("admin/*.html"))
ASSET = re.compile(r"\.(js|css)\?v=(\d+)")

current = max((int(m.group(2)) for f in PAGES for m in ASSET.finditer(io.open(f, encoding="utf-8").read())), default=0)
nxt = int(sys.argv[1]) if len(sys.argv) > 1 else current + 1

touched = 0
for f in PAGES:
    s = io.open(f, encoding="utf-8").read()
    out = ASSET.sub(lambda m: ".%s?v=%d" % (m.group(1), nxt), s)
    if out != s:
        io.open(f, "w", encoding="utf-8", newline="").write(out)
        touched += 1

print("v=%d -> v=%d in %d of %d pages" % (current, nxt, touched, len(PAGES)))
