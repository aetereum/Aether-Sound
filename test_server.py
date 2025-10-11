from http.server import HTTPServer, SimpleHTTPRequestHandler
import socket

class TestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/plain')
        self.end_headers()
        self.wfile.write(b'Python test server is working!')

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

if __name__ == '__main__':
    PORT = 8888
    server = HTTPServer(('0.0.0.0', PORT), TestHandler)
    ip = get_ip()
    print(f'''
==========================================
    Python Test Server
==========================================
Server running at:
- http://localhost:{PORT}
- http://127.0.0.1:{PORT}
- http://{ip}:{PORT}

Press Ctrl+C to stop
==========================================
''')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down...')
        server.server_close()