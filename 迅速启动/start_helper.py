# -*- coding: utf-8 -*-
import socket
import os

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            hostname = socket.gethostname()
            ip = socket.gethostbyname(hostname)
            return ip
        except Exception:
            return "127.0.0.1"

def generate_qr_ascii(url):
    try:
        import segno
        qr = segno.make(url, error='l')
        print("\n  === SCAN TO ACCESS (same WiFi) ===")
        qr.terminal(border=2)
        return True
    except ImportError:
        try:
            import qrcode
            qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=1, border=1)
            qr.add_data(url)
            qr.make(fit=True)
            print("\n  === SCAN TO ACCESS (same WiFi) ===")
            qr.print_ascii(invert=True)
            return True
        except ImportError:
            print(f"\n  QR lib not installed. Manual URL: {url}")
            return False

def generate_qr_image(url, save_path):
    try:
        import segno
        qr = segno.make(url, error='l')
        qr.save(save_path, scale=10, border=4)
        return True
    except ImportError:
        try:
            import qrcode
            qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=4)
            qr.add_data(url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            img.save(save_path)
            return True
        except ImportError:
            return False

def main():
    port = 8000
    path = "/login/"
    local_ip = get_local_ip()
    url = f"http://{local_ip}:{port}{path}"
    localhost_url = f"http://127.0.0.1:{port}{path}"

    print()
    print("=" * 55)
    print("  ECUST Interview System - Access Info")
    print("=" * 55)
    print()
    print(f"  Local (this PC):")
    print(f"    {localhost_url}")
    print()
    print(f"  LAN (all devices on same WiFi):")
    print(f"    {url}")
    print()
    print(f"  Share the URL or QR code below with everyone")

    generate_qr_ascii(url)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    qr_path = os.path.join(script_dir, "QR_CODE.png")
    if generate_qr_image(url, qr_path):
        print(f"\n  QR image saved: {qr_path}")
        print(f"  Print or project this in the interview room")
    else:
        print(f"\n  Generate QR manually: https://cli.im -> {url}")

    print()
    print("=" * 55)
    print("  Tips:")
    print("  1. All devices must be on the SAME WiFi")
    print("  2. Interviewer PC + candidate phones all work")
    print("  3. If phones can't access, check firewall settings")
    print("=" * 55)
    print()

if __name__ == "__main__":
    main()