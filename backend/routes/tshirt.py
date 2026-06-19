"""
T-shirt design voting: public carousel + voting + admin upload.
Images are stored as base64 in MongoDB (deploy-safe, no static folder dependency).
"""
from fastapi import APIRouter, HTTPException, Header, UploadFile, File, Form, Response, Query
from typing import Optional
from datetime import datetime, timezone
import base64
import os
import jwt

router = APIRouter(prefix="/tshirt", tags=["tshirt"])


def _verify_admin(authorization: Optional[str]):
    try:
        token = authorization.replace("Bearer ", "") if authorization else ""
        jwt.decode(token, os.getenv("JWT_SECRET_KEY", "backyard-ultra-secret-2026"), algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="No autorizado")


@router.get("/designs")
async def get_designs(voter_id: Optional[str] = Query(None)):
    """Public: list t-shirt designs with vote counts, ranking and the current voter's choice."""
    from server import db as database

    designs = await database.tshirt_designs.find(
        {}, {"image_data": 0}
    ).sort("created_at", 1).to_list(100)

    # Vote counts per design
    pipeline = [{"$group": {"_id": "$design_id", "count": {"$sum": 1}}}]
    agg = await database.tshirt_votes.aggregate(pipeline).to_list(1000)
    counts = {c["_id"]: c["count"] for c in agg}

    # Current voter's choice
    my_vote = None
    if voter_id:
        v = await database.tshirt_votes.find_one({"voter_id": voter_id})
        if v:
            my_vote = v["design_id"]

    items = []
    for d in designs:
        did = str(d["_id"])
        items.append({
            "id": did,
            "name": d.get("name", ""),
            "proposed_by": d.get("proposed_by", ""),
            "image_url": f"/api/tshirt/designs/{did}/image",
            "vote_count": counts.get(did, 0),
            "created_at": d.get("created_at").isoformat() if d.get("created_at") else None,
        })

    # Assign ranking by vote count (desc). Ties share order by created.
    ranked = sorted(items, key=lambda x: x["vote_count"], reverse=True)
    rank_map = {}
    for idx, it in enumerate(ranked):
        rank_map[it["id"]] = idx + 1
    for it in items:
        it["rank"] = rank_map[it["id"]]

    total_votes = sum(counts.values())
    return {"designs": items, "total_votes": total_votes, "my_vote": my_vote}


@router.get("/designs/{design_id}/image")
async def get_design_image(design_id: str):
    """Public: serve the design image bytes."""
    from server import db as database
    from bson import ObjectId
    try:
        oid = ObjectId(design_id)
    except Exception:
        raise HTTPException(status_code=404, detail="No encontrada")
    d = await database.tshirt_designs.find_one({"_id": oid})
    if not d or not d.get("image_data"):
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    raw = base64.b64decode(d["image_data"])
    return Response(content=raw, media_type=d.get("content_type", "image/jpeg"),
                    headers={"Cache-Control": "public, max-age=3600"})


@router.post("/vote")
async def vote(payload: dict):
    """Public: cast or change a vote. One vote per voter_id (anonymous device id)."""
    from server import db as database
    from bson import ObjectId

    voter_id = (payload.get("voter_id") or "").strip()
    design_id = (payload.get("design_id") or "").strip()
    if not voter_id or not design_id:
        raise HTTPException(status_code=400, detail="Datos incompletos")

    try:
        oid = ObjectId(design_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Diseño inválido")
    design = await database.tshirt_designs.find_one({"_id": oid})
    if not design:
        raise HTTPException(status_code=404, detail="Diseño no encontrado")

    # Upsert: one vote per voter, changing the design overwrites the previous choice
    await database.tshirt_votes.update_one(
        {"voter_id": voter_id},
        {"$set": {"design_id": design_id, "updated_at": datetime.now(timezone.utc)},
         "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    return {"success": True, "design_id": design_id}


@router.post("/admin/designs")
async def create_design(
    file: UploadFile = File(...),
    proposed_by: str = Form(...),
    name: str = Form(""),
    authorization: Optional[str] = Header(None),
):
    """Admin: upload a new t-shirt design (stored as base64 in MongoDB)."""
    from server import db as database

    _verify_admin(authorization)

    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen no debe superar 8MB")

    doc = {
        "name": name.strip(),
        "proposed_by": proposed_by.strip(),
        "image_data": base64.b64encode(content).decode("utf-8"),
        "content_type": file.content_type or "image/jpeg",
        "created_at": datetime.now(timezone.utc),
    }
    result = await database.tshirt_designs.insert_one(doc)
    return {"success": True, "id": str(result.inserted_id)}


@router.delete("/admin/designs/{design_id}")
async def delete_design(design_id: str, authorization: Optional[str] = Header(None)):
    """Admin: delete a design and its votes."""
    from server import db as database
    from bson import ObjectId

    _verify_admin(authorization)

    try:
        oid = ObjectId(design_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID inválido")

    res = await database.tshirt_designs.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Diseño no encontrado")
    await database.tshirt_votes.delete_many({"design_id": design_id})
    return {"success": True}
