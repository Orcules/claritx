from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy import text
from datetime import datetime
import uuid
from database import get_db_connection
from auth import verify_token
from models import ClientRequest, Client

router = APIRouter(prefix="/clients", tags=["clients"])

@router.post("", response_model=Client)
async def create_client(
    client_req: ClientRequest, 
    user: dict = Depends(verify_token),
    conn = Depends(get_db_connection)
):
    """
    Creates a new client record.
    """
    manager_id = user.get("sub") or user.get("username")
    if not manager_id:
        raise HTTPException(status_code=401, detail="User identification failed")

    client_id = str(uuid.uuid4())
    now = datetime.now()

    try:
        query = text("""
            INSERT INTO clients (id, manager_id, name, email, phone, notes, created_at, updated_at)
            VALUES (:id, :manager_id, :name, :email, :phone, :notes, :created_at, :updated_at)
            RETURNING id, manager_id, name, email, phone, notes, created_at, updated_at
        """)
        
        result = await conn.execute(query, {
            "id": client_id,
            "manager_id": manager_id,
            "name": client_req.name,
            "email": client_req.email,
            "phone": client_req.phone,
            "notes": client_req.notes,
            "created_at": now,
            "updated_at": now
        })
        
        row = result.fetchone()
        await conn.commit()

        return Client(
            id=str(row[0]),
            manager_id=str(row[1]),
            name=row[2],
            email=row[3],
            phone=row[4],
            notes=row[5],
            created_at=row[6],
            updated_at=row[7]
        )
    except Exception as e:
        await conn.rollback()
        print(f"Error creating client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[Client])
async def list_clients(
    user: dict = Depends(verify_token),
    conn = Depends(get_db_connection)
):
    """
    Lists all clients for the current manager.
    """
    manager_id = user.get("sub") or user.get("username")
    
    try:
        query = text("""
            SELECT id, manager_id, name, email, phone, notes, created_at, updated_at
            FROM clients
            WHERE manager_id = :manager_id
            ORDER BY created_at DESC
        """)
        
        result = await conn.execute(query, {"manager_id": manager_id})
        rows = result.fetchall()
        
        clients = []
        for row in rows:
            clients.append(Client(
                id=str(row[0]),
                manager_id=str(row[1]),
                name=row[2],
                email=row[3],
                phone=row[4],
                notes=row[5],
                created_at=row[6],
                updated_at=row[7]
            ))
        
        return clients
    except Exception as e:
        print(f"Error listing clients: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{client_id}")
async def delete_client(
    client_id: str,
    user: dict = Depends(verify_token),
    conn = Depends(get_db_connection)
):
    """
    Deletes a client record.
    """
    manager_id = user.get("sub") or user.get("username")
    
    try:
        query = text("""
            DELETE FROM clients
            WHERE id = :id AND manager_id = :manager_id
        """)
        
        await conn.execute(query, {"id": client_id, "manager_id": manager_id})
        await conn.commit()
        
        return {"status": "success"}
    except Exception as e:
        await conn.rollback()
        print(f"Error deleting client: {e}")
        raise HTTPException(status_code=500, detail=str(e))
