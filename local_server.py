from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

WEBSITE_DIR = Path(__file__).resolve().parent / "website"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEBSITE_DIR), **kwargs)

    def do_GET(self):
        path = urlsplit(self.path).path

        if path == "/" or not Path(path).suffix:
            self.path = "/index.html"

        super().do_GET()


server = ThreadingHTTPServer(("localhost", 8000), Handler)
print("Task Tracker running at http://localhost:8000")
server.serve_forever()