#!/usr/bin/env python3
"""Local dev server for this site.

Behaves like `python -m http.server`, except:
- Unmatched paths serve 404.html instead of Python's default error page,
  matching how Cloudflare Pages serves this site in production.
- HTML responses get a live-reload script injected, so the browser tab
  auto-refreshes whenever a file under the project changes. Dev-only:
  nothing is written to disk, so the injected script never reaches
  production.

Run with:

    python serve.py [port]

Default port is 8080.
"""
import http.server
import os
import sys
import threading
import time
import urllib.parse

WATCH_EXTS = {'.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico'}
IGNORE_DIRS = {'.git', 'node_modules', '__pycache__'}
POLL_INTERVAL = 0.5

LIVERELOAD_SCRIPT = b"""
<script>
(function () {
  var es = new EventSource('/__livereload');
  es.onmessage = function (e) {
    if (e.data === 'reload') location.reload();
  };
})();
</script>
"""

_version_lock = threading.Lock()
_current_version = 0


def _compute_signature(root):
    sig = 0.0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        for fn in filenames:
            if os.path.splitext(fn)[1].lower() in WATCH_EXTS:
                try:
                    sig += os.path.getmtime(os.path.join(dirpath, fn))
                except OSError:
                    pass
    return sig


def _watch_loop(root):
    global _current_version
    last_sig = _compute_signature(root)
    while True:
        time.sleep(POLL_INTERVAL)
        sig = _compute_signature(root)
        if sig != last_sig:
            last_sig = sig
            with _version_lock:
                _current_version += 1


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/__livereload':
            self._serve_livereload_stream()
            return

        requested = urllib.parse.urlsplit(self.path).path
        local_path = self.translate_path(requested)
        if os.path.isdir(local_path):
            local_path = os.path.join(local_path, 'index.html')
        if not os.path.exists(local_path):
            self.path = '/404.html'
            local_path = self.translate_path('/404.html')

        if local_path.endswith('.html'):
            self._serve_html_with_livereload(local_path)
            return

        return super().do_GET()

    def _serve_html_with_livereload(self, local_path):
        try:
            with open(local_path, 'rb') as f:
                body = f.read()
        except OSError:
            self.send_error(404, 'File not found')
            return

        if b'</body>' in body:
            body = body.replace(b'</body>', LIVERELOAD_SCRIPT + b'</body>', 1)
        else:
            body += LIVERELOAD_SCRIPT

        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_livereload_stream(self):
        global _current_version
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Connection', 'keep-alive')
        self.end_headers()
        with _version_lock:
            last_seen = _current_version
        try:
            while True:
                with _version_lock:
                    seen = _current_version
                if seen != last_seen:
                    last_seen = seen
                    self.wfile.write(b'data: reload\n\n')
                else:
                    self.wfile.write(b': keep-alive\n\n')
                self.wfile.flush()
                time.sleep(POLL_INTERVAL)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass

    def log_message(self, format, *args):
        if self.path != '/__livereload':
            super().log_message(format, *args)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(root)  # serve the site no matter where the script is launched from
    watcher = threading.Thread(target=_watch_loop, args=(root,), daemon=True)
    watcher.start()
    with http.server.ThreadingHTTPServer(('', port), Handler) as httpd:
        print(f"Serving on http://localhost:{port} (live reload on, unmatched paths -> 404.html)")
        httpd.serve_forever()
