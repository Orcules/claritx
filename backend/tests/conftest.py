import os
import sys

# Backend modules use flat imports (e.g. "from database import ..."),
# so the backend directory itself must be on sys.path.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
