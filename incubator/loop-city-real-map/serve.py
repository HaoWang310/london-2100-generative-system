"""Serve Loop City on the real map (this folder) at http://127.0.0.1:8795/

Only for testing on this laptop. Nothing here talks to GitHub.
The map tiles come from the internet (OpenFreeMap); the app code and the terrain are read from this folder.
Close the window to stop.
  --no-browser   start without opening the browser
  --port N       use this port (default: the first free one from 8795)
Based on serve.py in "02_Hao base - local copy (20 Nov)".
"""
import functools
import http.server
import os
import socket
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))


def free_port(start=8795, tries=20):
    for port in range(start, start + tries):
        with socket.socket() as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    raise SystemExit('No free port between %d and %d.' % (start, start + tries - 1))


class Handler(http.server.SimpleHTTPRequestHandler):
    # Windows can report .js as text/plain, which stops the browser loading the modules.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript', '.mjs': 'application/javascript',
        '.json': 'application/json', '.geojson': 'application/geo+json',
        '.webp': 'image/webp', '.html': 'text/html; charset=utf-8', '.md': 'text/plain; charset=utf-8',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')  # always the files as they are now
        super().end_headers()

    def log_message(self, *args):
        pass


PORT = int(sys.argv[sys.argv.index('--port') + 1]) if '--port' in sys.argv else free_port()
server = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), functools.partial(Handler, directory=ROOT))
url = f'http://127.0.0.1:{PORT}/'
print('Loop City on the real map (v13, base map):', url, flush=True)
print('Close this window to stop.', flush=True)
if '--no-browser' not in sys.argv:
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
server.serve_forever()
