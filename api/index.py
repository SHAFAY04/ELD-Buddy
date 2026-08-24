import os
from django.core.wsgi import get_wsgi_application

# Point to your Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

app = get_wsgi_application()