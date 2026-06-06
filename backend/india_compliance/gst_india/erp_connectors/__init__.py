"""
ERP Connectors Package

This package contains connectors for various ERP systems to enable
flexible data ingestion for GST compliance.
"""

from india_compliance.gst_india.erp_connectors.base_connector import (
    ERPConnector,
    Invoice,
    Item,
    Contact,
    SyncResult,
)
from india_compliance.gst_india.erp_connectors.data_mapper import DataMapper
from india_compliance.gst_india.erp_connectors.sync_manager import SyncManager

__all__ = [
    "ERPConnector",
    "Invoice",
    "Item",
    "Contact",
    "SyncResult",
    "DataMapper",
    "SyncManager",
]
