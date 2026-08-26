import os
import sys

# 1. Add project root to Python path so Django can locate modules (backend, eld, etc.)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 2. Point to your Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

# 3. Import WSGI handler and expose it as 'app' for Vercel
from backend.wsgi import application

app = application