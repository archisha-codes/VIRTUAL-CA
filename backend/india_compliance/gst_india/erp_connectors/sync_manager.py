"""
Sync Manager Module

Manages synchronization between ERP systems and GST platform.
Handles scheduled syncs, incremental syncs, and error recovery.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging
import uuid
import threading

from india_compliance.gst_india.erp_connectors.base_connector import (
    ERPConnector,
    ConnectionConfig,
    Invoice,
    Item,
    Contact,
    SyncResult,
    ConnectorRegistry,
)
from india_compliance.gst_india.erp_connectors.exceptions import SyncError


@dataclass
class SyncSchedule:
    """Sync schedule configuration"""
    schedule_id: str
    connection_id: str
    connector_type: str
    
    # Schedule settings
    frequency: str  # hourly, daily, weekly, monthly
    time: str = "00:00"  # Time of day for scheduled sync
    day_of_week: Optional[int] = None  # For weekly (0=Monday)
    day_of_month: Optional[int] = None  # For monthly
    
    # Sync settings
    sync_type: str = "incremental"  # full, incremental
    date_field: str = "invoice_date"  # Field to use for incremental sync
    
    # Status
    is_active: bool = True
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    
    # Filters
    start_date: Optional[str] = None  # For initial full sync
    document_types: List[str] = field(default_factory=lambda: ["invoice"])


@dataclass
class Connection:
    """ERP Connection configuration"""
    connection_id: str
    connector_type: str
    name: str
    
    # Connection settings
    base_url: str
    port: Optional[int] = None
    
    # Authentication
    auth_type: str
    credentials: Dict[str, str] = field(default_factory=dict)
    headers: Dict[str, str] = field(default_factory=dict)
    
    # Status
    is_active: bool = True
    is_default: bool = False
    
    # Sync settings
    default_sync_type: str = "incremental"
    sync_interval_minutes: int = 60
    
    # Field mappings
    field_mappings: Dict[str, Any] = field(default_factory=dict)
    
    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    last_sync: Optional[datetime] = None
    last_sync_status: Optional[str] = None


class SyncManager:
    """
    Manages synchronization between ERP systems and GST platform.
    """
    
    def __init__(self):
        self.logger = logging.getLogger("SyncManager")
        
        # Storage
        self.connections: Dict[str, Connection] = {}
        self.schedules: Dict[str, SyncSchedule] = {}
        self.sync_history: Dict[str, SyncResult] = {}
        
        # Active sync jobs
        self.active_syncs: Dict[str, SyncResult] = {}
        
        # Scheduler thread
        self._scheduler_thread: Optional[threading.Thread] = None
        self._stop_scheduler = threading.Event()
    
    # ==================== Connection Management ====================
    
    def create_connection(self, config: Dict[str, Any]) -> Connection:
        """Create a new ERP connection"""
        
        connection = Connection(
            connection_id=str(uuid.uuid4()),
            connector_type=config["connector_type"],
            name=config["name"],
            base_url=config["base_url"],
            port=config.get("port"),
            auth_type=config.get("auth_type", "api_key"),
            credentials=config.get("credentials", {}),
            headers=config.get("headers", {}),
            is_active=config.get("is_active", True),
            is_default=config.get("is_default", False),
            default_sync_type=config.get("default_sync_type", "incremental"),
            sync_interval_minutes=config.get("sync_interval_minutes", 60),
            field_mappings=config.get("field_mappings", {}),
        )
        
        self.connections[connection.connection_id] = connection
        self.logger.info(f"Created connection: {connection.name} ({connection.connector_type})")
        
        return connection
    
    def update_connection(self, connection_id: str, config: Dict[str, Any]) -> Connection:
        """Update an existing connection"""
        
        if connection_id not in self.connections:
            raise ValueError(f"Connection not found: {connection_id}")
        
        connection = self.connections[connection_id]
        
        # Update fields
        for key, value in config.items():
            if hasattr(connection, key):
                setattr(connection, key, value)
        
        connection.updated_at = datetime.now()
        
        self.logger.info(f"Updated connection: {connection.name}")
        
        return connection
    
    def delete_connection(self, connection_id: str) -> bool:
        """Delete a connection"""
        
        if connection_id not in self.connections:
            return False
        
        # Delete associated schedules
        schedules_to_delete = [
            sid for sid, sch in self.schedules.items()
            if sch.connection_id == connection_id
        ]
        for sid in schedules_to_delete:
            del self.schedules[sid]
        
        del self.connections[connection_id]
        
        self.logger.info(f"Deleted connection: {connection_id}")
        
        return True
    
    def get_connection(self, connection_id: str) -> Optional[Connection]:
        """Get connection by ID"""
        return self.connections.get(connection_id)
    
    def list_connections(
        self,
        connector_type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[Connection]:
        """List connections with optional filters"""
        
        connections = list(self.connections.values())
        
        if connector_type:
            connections = [c for c in connections if c.connector_type == connector_type]
        
        if is_active is not None:
            connections = [c for c in connections if c.is_active == is_active]
        
        return connections
    
    # ==================== Sync Operations ====================
    
    def trigger_sync(
        self,
        connection_id: str,
        sync_type: str = "incremental",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        **kwargs
    ) -> SyncResult:
        """Trigger a manual sync"""
        
        connection = self.get_connection(connection_id)
        if not connection:
            raise ValueError(f"Connection not found: {connection_id}")
        
        if not connection.is_active:
            raise SyncError("Connection is not active")
        
        # Create sync result
        sync_result = SyncResult(
            sync_id=str(uuid.uuid4()),
            connector_type=connection.connector_type,
            connection_id=connection_id,
            status="success",
            started_at=datetime.now(),
            sync_type=sync_type
        )
        
        # Store in active syncs
        self.active_syncs[sync_result.sync_id] = sync_result
        
        try:
            # Create connector
            config = self._create_connector_config(connection)
            connector = ConnectorRegistry.create_connector(
                connection.connector_type,
                config
            )
            
            # Authenticate
            connector.authenticate()
            
            # Extract data based on sync type
            if sync_type == "full":
                # Full sync - get all data
                invoices = connector.extract_invoices()
                items = connector.extract_items()
                contacts = connector.extract_contacts()
            else:
                # Incremental sync - get data since last sync
                last_sync = connection.last_sync
                if last_sync:
                    start_date = last_sync.strftime("%Y-%m-%d")
                
                invoices = connector.extract_invoices(
                    start_date=start_date,
                    end_date=end_date
                )
                items = connector.extract_items()
                contacts = connector.extract_contacts()
            
            # Update sync result
            sync_result.invoices_extracted = len(invoices)
            sync_result.items_extracted = len(items)
            sync_result.contacts_extracted = len(contacts)
            sync_result.records_processed = len(invoices) + len(items) + len(contacts)
            
            # TODO: Import data to GST system
            # For now, just count as imported
            sync_result.invoices_imported = len(invoices)
            
            sync_result.completed_at = datetime.now()
            
            # Update connection
            connection.last_sync = datetime.now()
            connection.last_sync_status = "success"
            
            self.logger.info(
                f"Sync completed: {sync_result.invoices_extracted} invoices, "
                f"{sync_result.items_extracted} items, {sync_result.contacts_extracted} contacts"
            )
            
        except Exception as e:
            sync_result.status = "failed"
            sync_result.completed_at = datetime.now()
            sync_result.errors.append({
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            
            connection.last_sync_status = "failed"
            
            self.logger.error(f"Sync failed: {str(e)}")
        
        finally:
            # Move from active to history
            if sync_result.sync_id in self.active_syncs:
                del self.active_syncs[sync_result.sync_id]
            
            self.sync_history[sync_result.sync_id] = sync_result
        
        return sync_result
    
    def get_sync_status(self, sync_id: str) -> Optional[SyncResult]:
        """Get status of a sync operation"""
        
        if sync_id in self.active_syncs:
            return self.active_syncs[sync_id]
        
        return self.sync_history.get(sync_id)
    
    def get_sync_history(
        self,
        connection_id: Optional[str] = None,
        limit: int = 50
    ) -> List[SyncResult]:
        """Get sync history"""
        
        history = list(self.sync_history.values())
        
        if connection_id:
            history = [h for h in history if h.connection_id == connection_id]
        
        # Sort by date descending
        history.sort(key=lambda x: x.started_at, reverse=True)
        
        return history[:limit]
    
    # ==================== Schedule Management ====================
    
    def create_schedule(self, config: Dict[str, Any]) -> SyncSchedule:
        """Create a new sync schedule"""
        
        schedule = SyncSchedule(
            schedule_id=str(uuid.uuid4()),
            connection_id=config["connection_id"],
            connector_type=config.get("connector_type", ""),
            frequency=config.get("frequency", "daily"),
            time=config.get("time", "00:00"),
            day_of_week=config.get("day_of_week"),
            day_of_month=config.get("day_of_month"),
            sync_type=config.get("sync_type", "incremental"),
            date_field=config.get("date_field", "invoice_date"),
            is_active=config.get("is_active", True),
            start_date=config.get("start_date"),
            document_types=config.get("document_types", ["invoice"]),
        )
        
        # Calculate next run time
        schedule.next_run = self._calculate_next_run(schedule)
        
        self.schedules[schedule.schedule_id] = schedule
        
        self.logger.info(
            f"Created schedule: {schedule.frequency} sync for connection "
            f"{schedule.connection_id}"
        )
        
        return schedule
    
    def update_schedule(
        self,
        schedule_id: str,
        config: Dict[str, Any]
    ) -> SyncSchedule:
        """Update an existing schedule"""
        
        if schedule_id not in self.schedules:
            raise ValueError(f"Schedule not found: {schedule_id}")
        
        schedule = self.schedules[schedule_id]
        
        for key, value in config.items():
            if hasattr(schedule, key):
                setattr(schedule, key, value)
        
        # Recalculate next run
        if schedule.is_active:
            schedule.next_run = self._calculate_next_run(schedule)
        
        return schedule
    
    def delete_schedule(self, schedule_id: str) -> bool:
        """Delete a schedule"""
        
        if schedule_id not in self.schedules:
            return False
        
        del self.schedules[schedule_id]
        
        return True
    
    def list_schedules(
        self,
        connection_id: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[SyncSchedule]:
        """List schedules with filters"""
        
        schedules = list(self.schedules.values())
        
        if connection_id:
            schedules = [s for s in schedules if s.connection_id == connection_id]
        
        if is_active is not None:
            schedules = [s for s in schedules if s.is_active == is_active]
        
        return schedules
    
    def _calculate_next_run(self, schedule: SyncSchedule) -> datetime:
        """Calculate next run time for a schedule"""
        
        now = datetime.now()
        
        # Parse time
        hour, minute = map(int, schedule.time.split(":"))
        
        if schedule.frequency == "hourly":
            # Run every hour at the specified minute
            next_run = now.replace(minute=minute, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(hours=1)
        
        elif schedule.frequency == "daily":
            # Run daily at specified time
            next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)
        
        elif schedule.frequency == "weekly":
            # Run weekly on specified day
            days_ahead = schedule.day_of_week - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            
            next_run = now + timedelta(days=days_ahead)
            next_run = next_run.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        elif schedule.frequency == "monthly":
            # Run monthly on specified day
            if now.day >= schedule.day_of_month:
                next_run = now.replace(month=now.month + 1, day=schedule.day_of_month)
            else:
                next_run = now.replace(day=schedule.day_of_month)
            
            next_run = next_run.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        else:
            # Default to daily
            next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)
        
        return next_run
    
    # ==================== Scheduler ====================
    
    def start_scheduler(self):
        """Start the background scheduler"""
        
        if self._scheduler_thread and self._scheduler_thread.is_alive():
            return
        
        self._stop_scheduler.clear()
        self._scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self._scheduler_thread.start()
        
        self.logger.info("Scheduler started")
    
    def stop_scheduler(self):
        """Stop the background scheduler"""
        
        self._stop_scheduler.set()
        
        if self._scheduler_thread:
            self._scheduler_thread.join(timeout=5)
        
        self.logger.info("Scheduler stopped")
    
    def _run_scheduler(self):
        """Run the scheduler loop"""
        
        while not self._stop_scheduler.is_set():
            try:
                now = datetime.now()
                
                # Check for schedules that need to run
                for schedule in self.schedules.values():
                    if not schedule.is_active:
                        continue
                    
                    if schedule.next_run and schedule.next_run <= now:
                        # Trigger sync
                        self.logger.info(f"Triggering scheduled sync: {schedule.schedule_id}")
                        
                        try:
                            self.trigger_sync(
                                schedule.connection_id,
                                sync_type=schedule.sync_type,
                                start_date=schedule.start_date
                            )
                        except Exception as e:
                            self.logger.error(f"Scheduled sync failed: {str(e)}")
                        
                        # Update last run and calculate next
                        schedule.last_run = now
                        schedule.next_run = self._calculate_next_run(schedule)
                
                # Sleep for a minute
                self._stop_scheduler.wait(60)
                
            except Exception as e:
                self.logger.error(f"Scheduler error: {str(e)}")
                self._stop_scheduler.wait(60)
    
    # ==================== Helper Methods ====================
    
    def _create_connector_config(self, connection: Connection) -> ConnectionConfig:
        """Create ConnectionConfig from Connection"""
        
        from india_compliance.gst_india.erp_connectors.base_connector import (
            AuthConfig,
            ConnectionConfig,
        )
        
        auth = AuthConfig(
            auth_type=connection.auth_type,
            credentials=connection.credentials,
            headers=connection.headers,
        )
        
        config = ConnectionConfig(
            connection_id=connection.connection_id,
            connector_type=connection.connector_type,
            name=connection.name,
            base_url=connection.base_url,
            port=connection.port,
            auth=auth,
            is_active=connection.is_active,
            is_default=connection.is_default,
            default_sync_type=connection.default_sync_type,
            sync_interval_minutes=connection.sync_interval_minutes,
            field_mappings=connection.field_mappings,
        )
        
        return config
    
    # ==================== Recovery ====================
    
    def retry_failed_sync(self, sync_id: str) -> SyncResult:
        """Retry a failed sync"""
        
        if sync_id not in self.sync_history:
            raise ValueError(f"Sync not found: {sync_id}")
        
        failed_sync = self.sync_history[sync_id]
        
        if failed_sync.status != "failed":
            raise ValueError("Can only retry failed syncs")
        
        # Trigger new sync with same parameters
        return self.trigger_sync(
            failed_sync.connection_id,
            sync_type=failed_sync.sync_type
        )
    
    def get_connection_stats(self, connection_id: str) -> Dict[str, Any]:
        """Get connection statistics"""
        
        connection = self.get_connection(connection_id)
        if not connection:
            return {}
        
        # Get sync history for this connection
        history = self.get_sync_history(connection_id, limit=100)
        
        total_syncs = len(history)
        successful_syncs = len([h for h in history if h.status == "success"])
        failed_syncs = len([h for h in history if h.status == "failed"])
        
        total_invoices = sum(h.invoices_extracted for h in history)
        
        return {
            "connection_id": connection_id,
            "connector_type": connection.connector_type,
            "name": connection.name,
            "is_active": connection.is_active,
            "last_sync": connection.last_sync.isoformat() if connection.last_sync else None,
            "last_sync_status": connection.last_sync_status,
            "total_syncs": total_syncs,
            "successful_syncs": successful_syncs,
            "failed_syncs": failed_syncs,
            "total_invoices_extracted": total_invoices,
            "success_rate": (successful_syncs / total_syncs * 100) if total_syncs > 0 else 0,
        }


# Singleton instance
_sync_manager: Optional[SyncManager] = None


def get_sync_manager() -> SyncManager:
    """Get singleton sync manager instance"""
    global _sync_manager
    
    if _sync_manager is None:
        _sync_manager = SyncManager()
    
    return _sync_manager
