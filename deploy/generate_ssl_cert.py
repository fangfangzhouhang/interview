# generate_ssl_cert.py
# Generate self-signed SSL certificate using cryptography

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta

try:
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.backends import default_backend
except ImportError:
    print("=" * 60)
    print("ERROR: cryptography library not installed")
    print("=" * 60)
    print()
    print("Please install cryptography:")
    print("  C:\\test6\\venv\\Scripts\\pip.exe install cryptography")
    print()
    sys.exit(1)

# Nginx SSL directory
NGINX_SSL_DIR = Path(r'C:\nginx\ssl')
NGINX_SSL_DIR.mkdir(parents=True, exist_ok=True)

CERT_PATH = NGINX_SSL_DIR / 'server.crt'
KEY_PATH = NGINX_SSL_DIR / 'server.key'

# Certificate validity in days
CERT_DAYS = 365


def generate_ssl_cert():
    """Generate self-signed SSL certificate using cryptography"""
    print("=" * 60)
    print("SSL Certificate Generator (cryptography)")
    print("=" * 60)
    print()

    # Check if certificates already exist
    if CERT_PATH.exists() and KEY_PATH.exists():
        print("[INFO] SSL certificates already exist:")
        print(f"  Certificate: {CERT_PATH}")
        print(f"  Private Key: {KEY_PATH}")
        print()
        response = input("Regenerate certificates? (y/N): ")
        if response.lower() != 'y':
            print("[OK] Using existing certificates")
            return True

    print("[INFO] Generating new SSL certificates...")
    print()

    try:
        # Generate private key
        print("[INFO] Generating RSA private key (2048 bits)...")
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        print("[OK] Private key generated")

        # Build certificate subject
        print("[INFO] Building certificate...")
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "CN"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Shanghai"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, "Shanghai"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Interview System"),
            x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Development"),
            x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
        ])

        # Build certificate
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(private_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.utcnow())
            .not_valid_after(datetime.utcnow() + timedelta(days=CERT_DAYS))
            .add_extension(
                x509.SubjectAlternativeName([
                    x509.DNSName("localhost"),
                    x509.DNSName("127.0.0.1"),
                    x509.DNSName("::1"),
                ]),
                critical=False,
            )
            .add_extension(
                x509.BasicConstraints(ca=True, path_length=None),
                critical=True,
            )
            .add_extension(
                x509.KeyUsage(
                    digital_signature=True,
                    content_commitment=False,
                    key_encipherment=True,
                    data_encipherment=False,
                    key_agreement=False,
                    key_cert_sign=True,
                    crl_sign=True,
                    encipher_only=False,
                    decipher_only=False,
                ),
                critical=True,
            )
            .add_extension(
                x509.ExtendedKeyUsage([
                    x509.ExtendedKeyUsageOID.SERVER_AUTH,
                    x509.ExtendedKeyUsageOID.CLIENT_AUTH,
                ]),
                critical=False,
            )
            .sign(private_key, hashes.SHA256(), default_backend())
        )
        print("[OK] Certificate built")

        # Save private key
        print("[INFO] Saving private key...")
        with open(KEY_PATH, 'wb') as f:
            f.write(
                private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption(),
                )
            )
        print(f"[OK] Private key saved: {KEY_PATH}")

        # Save certificate
        print("[INFO] Saving certificate...")
        with open(CERT_PATH, 'wb') as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        print(f"[OK] Certificate saved: {CERT_PATH}")

        print()
        print("[OK] SSL certificate generated successfully!")
        print(f"  Valid for: {CERT_DAYS} days")
        print(f"  Expires: {datetime.utcnow() + timedelta(days=CERT_DAYS)}")
        print()
        return True

    except Exception as e:
        print(f"[ERROR] Failed to generate certificate: {e}")
        import traceback
        traceback.print_exc()
        return False


def verify_ssl_cert():
    """Verify SSL certificates"""
    print()
    print("=" * 60)
    print("Verifying SSL Certificates")
    print("=" * 60)
    print()

    if not CERT_PATH.exists():
        print(f"[ERROR] Certificate not found: {CERT_PATH}")
        return False

    if not KEY_PATH.exists():
        print(f"[ERROR] Private key not found: {KEY_PATH}")
        return False

    # Check file sizes
    cert_size = CERT_PATH.stat().st_size
    key_size = KEY_PATH.stat().st_size

    if cert_size < 100:
        print(f"[ERROR] Certificate file too small: {cert_size} bytes")
        return False

    if key_size < 100:
        print(f"[ERROR] Private key file too small: {key_size} bytes")
        return False

    print(f"[OK] Certificate: {CERT_PATH} ({cert_size} bytes)")
    print(f"[OK] Private Key: {KEY_PATH} ({key_size} bytes)")

    # Try to load certificate
    try:
        with open(CERT_PATH, 'rb') as f:
            cert_data = f.read()
            loaded_cert = x509.load_pem_x509_certificate(cert_data, default_backend())
            print(f"[OK] Certificate loaded successfully")
            print(f"  Subject: {loaded_cert.subject}")
            print(f"  Issuer: {loaded_cert.issuer}")
            print(f"  Valid from: {loaded_cert.not_valid_before}")
            print(f"  Valid until: {loaded_cert.not_valid_after}")
            print(f"  Serial: {loaded_cert.serial_number}")
    except Exception as e:
        print(f"[ERROR] Cannot load certificate: {e}")
        return False

    # Try to load private key
    try:
        with open(KEY_PATH, 'rb') as f:
            key_data = f.read()
            loaded_key = serialization.load_pem_private_key(
                key_data,
                password=None,
                backend=default_backend()
            )
            print(f"[OK] Private key loaded successfully")
            print(f"  Key type: {type(loaded_key).__name__}")
    except Exception as e:
        print(f"[ERROR] Cannot load private key: {e}")
        return False

    return True


def display_certificate_info():
    """Display certificate information"""
    print()
    print("=" * 60)
    print("Certificate Information")
    print("=" * 60)
    print()

    try:
        with open(CERT_PATH, 'rb') as f:
            cert_data = f.read()
            cert = x509.load_pem_x509_certificate(cert_data, default_backend())

        print(f"Subject: {cert.subject}")
        print(f"Issuer: {cert.issuer}")
        print(f"Version: {cert.version}")
        print(f"Serial Number: {cert.serial_number}")
        print(f"Not Valid Before: {cert.not_valid_before}")
        print(f"Not Valid After: {cert.not_valid_after}")

        # Get extensions
        for ext in cert.extensions:
            print(f"Extension: {ext.oid._name}")
            print(f"  Critical: {ext.critical}")
            print(f"  Value: {ext.value}")

    except Exception as e:
        print(f"[ERROR] Cannot read certificate: {e}")


def create_certificate_with_san():
    """Generate certificate with Subject Alternative Names"""
    print("=" * 60)
    print("Generating Certificate with SAN")
    print("=" * 60)
    print()

    # Generate private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )

    # Build subject
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "CN"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Shanghai"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "Shanghai"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Interview System"),
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
    ])

    # Build certificate with SAN
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.utcnow())
        .not_valid_after(datetime.utcnow() + timedelta(days=CERT_DAYS))
        .add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.DNSName("127.0.0.1"),
                x509.DNSName("::1"),
                x509.DNSName("*.localhost"),
                x509.IPAddress.from_string("127.0.0.1"),
                x509.IPAddress.from_string("::1"),
            ]),
            critical=False,
        )
        .add_extension(
            x509.BasicConstraints(ca=True, path_length=None),
            critical=True,
        )
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=True,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([
                x509.ExtendedKeyUsageOID.SERVER_AUTH,
                x509.ExtendedKeyUsageOID.CLIENT_AUTH,
            ]),
            critical=False,
        )
        .sign(private_key, hashes.SHA256(), default_backend())
    )

    # Save files
    with open(KEY_PATH, 'wb') as f:
        f.write(
            private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )

    with open(CERT_PATH, 'wb') as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    print("[OK] Certificate with SAN generated successfully!")
    print(f"  Certificate: {CERT_PATH}")
    print(f"  Private Key: {KEY_PATH}")
    print()
    print("Subject Alternative Names included:")
    print("  - localhost")
    print("  - 127.0.0.1")
    print("  - ::1")
    print("  - *.localhost")


if __name__ == '__main__':
    print()
    print("SSL Certificate Generator (cryptography)")
    print("=" * 60)
    print()

    # Check cryptography version
    try:
        import cryptography
        print(f"[INFO] cryptography version: {cryptography.__version__}")
    except:
        pass

    print()

    # Generate certificate
    success = generate_ssl_cert()

    if success:
        # Verify certificate
        verify_ssl_cert()

        # Display certificate info
        display_certificate_info()

        print()
        print("=" * 60)
        print("Certificate generation completed!")
        print("=" * 60)
        print()
        print("Next steps:")
        print("  1. Run: python deploy/02_setup_nginx.py")
        print("  2. Start Nginx: scripts/start_nginx.bat")
        print("  3. Access: https://localhost")
        print("  (Accept browser security warning)")
        print()
        print("Certificate details:")
        print(f"  Certificate: {CERT_PATH}")
        print(f"  Private Key: {KEY_PATH}")
        print(f"  Valid for: {CERT_DAYS} days")
        print()
    else:
        print()
        print("=" * 60)
        print("Certificate generation FAILED!")
        print("=" * 60)
        print()
        print("Please check:")
        print("  1. cryptography library is installed")
        print("  2. You have write permission to C:\\nginx\\ssl")
        print("  3. No other process is using the certificate files")
        print()
        sys.exit(1)
