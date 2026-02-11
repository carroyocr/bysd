"""
Migration: Update sexo field for archived_participants (BYSD-2026)
Source: Excel file provided by admin
Run: python migrations/update_sexo_2026.py
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

BIB_SEXO_MAP = {
    "001": "Masculino", "002": "Masculino", "003": "Masculino", "004": "Masculino",
    "005": "Masculino", "006": "Masculino", "007": "Masculino", "008": "Femenino",
    "009": "Masculino", "010": "Masculino", "011": "Masculino", "012": "Masculino",
    "013": "Masculino", "014": "Masculino", "015": "Femenino", "016": "Masculino",
    "017": "Femenino", "018": "Masculino", "019": "Masculino", "020": "Masculino",
    "021": "Masculino", "022": "Masculino", "023": "Masculino", "024": "Femenino",
    "025": "Masculino", "026": "Masculino", "027": "Femenino", "028": "Femenino",
    "029": "Femenino", "030": "Masculino", "031": "Femenino", "032": "Masculino",
    "033": "Femenino", "034": "Masculino", "035": "Femenino", "036": "Masculino",
    "037": "Masculino", "038": "Masculino", "039": "Femenino", "040": "Femenino",
    "041": "Femenino", "042": "Masculino", "043": "Masculino", "044": "Masculino",
    "045": "Masculino", "046": "Masculino", "047": "Masculino", "048": "Masculino",
    "049": "Masculino", "050": "Masculino", "051": "Masculino", "052": "Masculino",
    "053": "Masculino", "054": "Masculino", "055": "Masculino", "056": "Masculino",
    "057": "Masculino", "058": "Masculino", "059": "Masculino", "060": "Femenino",
    "061": "Masculino", "062": "Masculino", "063": "Masculino", "064": "Masculino",
    "065": "Masculino", "066": "Masculino", "067": "Masculino", "068": "Masculino",
    "069": "Masculino", "070": "Masculino", "071": "Masculino", "072": "Femenino",
    "073": "Masculino", "074": "Femenino", "075": "Femenino", "076": "Femenino",
    "077": "Masculino", "078": "Masculino", "079": "Masculino", "080": "Masculino",
    "081": "Masculino", "082": "Masculino", "083": "Masculino", "084": "Masculino",
    "085": "Masculino", "086": "Masculino", "087": "Femenino", "088": "Femenino",
    "089": "Femenino", "090": "Masculino",
}

async def run_migration():
    client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
    db = client[os.environ.get("DB_NAME")]
    
    updated = 0
    not_found = 0
    
    for bib, sexo in BIB_SEXO_MAP.items():
        result = await db.archived_participants.update_one(
            {"bib": bib},
            {"$set": {"sexo": sexo}}
        )
        if result.modified_count > 0:
            updated += 1
        elif result.matched_count == 0:
            not_found += 1
    
    print(f"Migration complete: {updated} updated, {not_found} not found, {len(BIB_SEXO_MAP)} total")
    client.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
