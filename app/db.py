from pymongo import MongoClient

from app.config import MONGO_DB, MONGO_URI

# tz_aware=True: las fechas regresan con zona horaria (se guardan en UTC)
cliente = MongoClient(MONGO_URI, tz_aware=True)
db = cliente[MONGO_DB]
