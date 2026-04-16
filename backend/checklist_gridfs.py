"""Fotos do checklist em GridFS — referências `gridfs:<ObjectId>` (fora do documento BSON da vistoria)."""

from __future__ import annotations

import logging
from io import BytesIO
from typing import Any, Optional, Set

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket

logger = logging.getLogger(__name__)

GRIDFS_URL_PREFIX = "gridfs:"
BUCKET_NAME = "checklist_photos"
MAX_CHECKLIST_PHOTO_BYTES = 12 * 1024 * 1024


def _bucket(db: AsyncIOMotorDatabase) -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(db, bucket_name=BUCKET_NAME)


def iter_gridfs_file_ids_from_rooms(rooms: Optional[list]) -> Set[str]:
    out: Set[str] = set()
    if not rooms:
        return out
    for room in rooms:
        if not isinstance(room, dict):
            continue
        for item in room.get("items") or []:
            if not isinstance(item, dict):
                continue
            for p in item.get("photos") or []:
                if not isinstance(p, dict):
                    continue
                url = p.get("url")
                if not isinstance(url, str):
                    continue
                if not url.startswith(GRIDFS_URL_PREFIX):
                    continue
                fid = url[len(GRIDFS_URL_PREFIX) :].strip()
                if len(fid) == 24:
                    try:
                        ObjectId(fid)
                        out.add(fid)
                    except InvalidId:
                        continue
    return out


async def upload_checklist_photo(
    db: AsyncIOMotorDatabase,
    *,
    inspection_id: str,
    owner_uid: str,
    data: bytes,
    content_type: str,
) -> str:
    if len(data) > MAX_CHECKLIST_PHOTO_BYTES:
        raise ValueError("Ficheiro demasiado grande (máx. 12 MB por foto).")

    ct = (content_type or "application/octet-stream").split(";")[0].strip().lower()
    if not ct.startswith("image/"):
        ct = "image/jpeg"

    bucket = _bucket(db)
    meta = {
        "inspection_id": inspection_id,
        "uid": owner_uid,
        "contentType": ct,
    }
    file_id = await bucket.upload_from_stream(
        "checklist.jpg",
        BytesIO(data),
        metadata=meta,
    )
    return f"{GRIDFS_URL_PREFIX}{str(file_id)}"


async def read_checklist_photo_for_owner(
    db: AsyncIOMotorDatabase,
    *,
    inspection_id: str,
    owner_uid: str,
    file_id_hex: str,
) -> tuple[bytes, str]:
    try:
        oid = ObjectId(file_id_hex.strip())
    except InvalidId as e:
        raise FileNotFoundError from e

    bucket = _bucket(db)
    try:
        stream = await bucket.open_download_stream(oid)
    except Exception as e:
        raise FileNotFoundError from e

    meta = stream.metadata or {}
    if meta.get("inspection_id") != inspection_id or meta.get("uid") != owner_uid:
        raise PermissionError("Foto não pertence a esta vistoria.")

    raw = await stream.read()
    ct = meta.get("contentType") or "image/jpeg"
    return raw, str(ct)


async def delete_gridfs_file_if_orphan(
    db: AsyncIOMotorDatabase,
    *,
    inspection_id: str,
    owner_uid: str,
    file_id_hex: str,
) -> None:
    try:
        oid = ObjectId(file_id_hex.strip())
    except InvalidId:
        return

    coll = db[f"{BUCKET_NAME}.files"]
    doc = await coll.find_one({"_id": oid})
    if not doc:
        return
    meta = doc.get("metadata") or {}
    if meta.get("inspection_id") != inspection_id or meta.get("uid") != owner_uid:
        return
    bucket = _bucket(db)
    try:
        await bucket.delete(oid)
    except Exception as e:
        logger.warning("GridFS delete %s: %s", oid, e)


async def delete_orphaned_after_checklist_update(
    db: AsyncIOMotorDatabase,
    *,
    inspection_id: str,
    owner_uid: str,
    old_rooms: Any,
    new_rooms: Any,
) -> None:
    old_ids = iter_gridfs_file_ids_from_rooms(old_rooms if isinstance(old_rooms, list) else [])
    new_ids = iter_gridfs_file_ids_from_rooms(new_rooms if isinstance(new_rooms, list) else [])
    for fid in old_ids - new_ids:
        await delete_gridfs_file_if_orphan(
            db, inspection_id=inspection_id, owner_uid=owner_uid, file_id_hex=fid
        )


async def delete_all_checklist_photos_for_inspection(
    db: AsyncIOMotorDatabase, inspection_id: str
) -> None:
    bucket = _bucket(db)
    coll = db[f"{BUCKET_NAME}.files"]
    cursor = coll.find({"metadata.inspection_id": inspection_id}, {"_id": 1})
    async for doc in cursor:
        oid = doc.get("_id")
        if oid is None:
            continue
        try:
            await bucket.delete(oid)
        except Exception as e:
            logger.warning("GridFS delete (inspection cleanup) %s: %s", oid, e)
