from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from database import get_db
from api.dependencies import get_current_user, verify_workspace_access
from models.tenant_models import Business, Workspace, User, AuditLog
from models.gst_models import GSTR1_Document, GSTR2B_Document, GSTR3B_Draft, Announcement
from datetime import datetime

router = APIRouter(tags=["Dashboard"])

@router.get("/api/dashboard")
async def get_dashboard_data(
    workspace_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not workspace_id:
        # Return empty stats if no workspace is selected
        return {
            "success": True,
            "data": {
                "stats": {
                    "total_clients": 0,
                    "pending_returns": 0,
                    "total_tax_liability": 0,
                    "itc_available": 0,
                },
                "filing_status": {
                    "gstr1": {"status": "pending", "period": datetime.now().strftime("%m%Y")},
                    "gstr3b": {"status": "pending", "period": datetime.now().strftime("%m%Y")},
                    "gstr2b": {"status": "available", "period": datetime.now().strftime("%m%Y")}
                },
                "recent_filings": []
            }
        }

    # Verify membership
    verify_workspace_access(workspace_id, current_user=current_user, db=db)

    # Get businesses in this workspace
    businesses = db.query(Business).filter(Business.workspace_id == workspace_id).all()
    business_ids = [b.id for b in businesses]

    total_clients = len(businesses)
    current_period = datetime.now().strftime("%m%Y")

    filed_returns_count = db.query(GSTR3B_Draft).filter(
        GSTR3B_Draft.business_id.in_(business_ids),
        GSTR3B_Draft.return_period == current_period,
        GSTR3B_Draft.is_filed == True
    ).count() if business_ids else 0

    pending_returns = max(0, total_clients - filed_returns_count)

    liability = db.query(
        func.sum(GSTR1_Document.igst + GSTR1_Document.cgst + GSTR1_Document.sgst + GSTR1_Document.cess)
    ).filter(
        GSTR1_Document.business_id.in_(business_ids),
        GSTR1_Document.return_period == current_period
    ).scalar() or 0 if business_ids else 0

    itc = db.query(
        func.sum(GSTR2B_Document.igst + GSTR2B_Document.cgst + GSTR2B_Document.sgst + GSTR2B_Document.cess)
    ).filter(
        GSTR2B_Document.business_id.in_(business_ids),
        GSTR2B_Document.return_period == current_period
    ).scalar() or 0 if business_ids else 0

    recent_drafts = db.query(GSTR3B_Draft).filter(
        GSTR3B_Draft.business_id.in_(business_ids),
        GSTR3B_Draft.is_filed == True
    ).order_by(GSTR3B_Draft.id.desc()).limit(5).all() if business_ids else []

    recent_filings = [
        {
            "return_type": "GSTR3B",
            "period": d.return_period,
            "status": "filed",
            "filed_date": d.payload.get("filed_at"),
            "arn": d.payload.get("arn")
        }
        for d in recent_drafts
    ]

    return {
        "success": True,
        "data": {
            "stats": {
                "total_clients": total_clients,
                "pending_returns": pending_returns,
                "total_tax_liability": float(liability),
                "itc_available": float(itc),
            },
            "filing_status": {
                "gstr1": {"status": "pending", "period": current_period},
                "gstr3b": {"status": "filed" if filed_returns_count > 0 else "pending", "period": current_period},
                "gstr2b": {"status": "available", "period": current_period}
            },
            "recent_filings": recent_filings
        }
    }

@router.get("/api/dashboard/announcements")
async def get_announcements(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    announcements = db.query(Announcement).filter(
        Announcement.is_active == True
    ).order_by(Announcement.date.desc()).limit(limit).all()

    return {
        "success": True,
        "data": [
            {
                "id": str(a.id),
                "title": a.title,
                "date": a.date.isoformat() if a.date else None,
                "link": a.link,
                "description": a.content,
                "category": a.category
            }
            for a in announcements
        ],
        "total": len(announcements)
    }

@router.get("/api/dashboard/navigation")
async def get_navigation(
    current_user: User = Depends(get_current_user)
):
    return {
        "items": [
            {"id": "dashboard", "label": "Dashboard", "icon": "layout-dashboard", "path": "/dashboard"},
            {"id": "workspaces", "label": "Workspaces", "icon": "briefcase", "path": "/workspaces"},
            {"id": "compliance", "label": "Compliance", "icon": "check-square", "path": "/compliance"},
            {"id": "support", "label": "Support", "icon": "help-circle", "path": "/support"},
            {"id": "settings", "label": "Settings", "icon": "settings", "path": "/settings"},
        ]
    }

@router.get("/api/dashboard/audit-logs")
async def get_audit_logs(
    workspace_id: Optional[str] = Query(None),
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(AuditLog).filter(AuditLog.user_id == current_user.id)
    
    if workspace_id:
        # Verify access
        verify_workspace_access(workspace_id, current_user=current_user, db=db)
        query = query.filter(AuditLog.workspace_id == workspace_id)
    
    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    
    return {
        "logs": [
            {
                "id": log.id,
                "action": log.action,
                "details": log.details,
                "created_at": log.created_at.isoformat(),
                "entity_type": log.entity_type
            }
            for log in logs
        ],
        "total": len(logs)
    }

@router.get("/api/forms")
async def list_gst_forms(
    current_user: User = Depends(get_current_user)
):
    """Lists available GST forms and their statuses."""
    return [
        {
            "id": "gstr1",
            "name": "GSTR-1",
            "description": "Details of outward supplies of goods or services",
            "frequency": "Monthly/Quarterly",
            "due_date": "11th of next month",
            "status": "active"
        },
        {
            "id": "gstr3b",
            "name": "GSTR-3B",
            "description": "Summary of outward supplies and ITC claimed",
            "frequency": "Monthly",
            "due_date": "20th of next month",
            "status": "active"
        },
        {
            "id": "gstr2b",
            "name": "GSTR-2B",
            "description": "Auto-drafted ITC statement",
            "frequency": "Monthly",
            "due_date": "14th of next month",
            "status": "active"
        },
        {
            "id": "gstr9",
            "name": "GSTR-9",
            "description": "Annual return for regular taxpayers",
            "frequency": "Annually",
            "due_date": "31st Dec",
            "status": "coming_soon"
        }
    ]
