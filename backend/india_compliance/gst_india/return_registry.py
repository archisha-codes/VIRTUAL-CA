# GST India - Return Period Registry
# Manages tax return periods and filing status including period locking

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime, date
from enum import Enum
import json
import os


class ReturnStatus(str, Enum):
    """Status of tax return"""
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    FILED = "filed"
    LOCKED = "locked"
    AMENDMENT = "amendment"


class ReturnType(str, Enum):
    """Type of GST return"""
    GSTR1 = "GSTR-1"
    GSTR2 = "GSTR-2"
    GSTR2B = "GSTR-2B"
    GSTR3B = "GSTR-3B"
    GSTR4 = "GSTR-4"
    GSTR9 = "GSTR-9"


@dataclass
class ReturnPeriod:
    """
    Represents a tax return period with locking mechanism.
    
    Attributes:
        period: Return period code (e.g., "122025" for Dec 2025)
        return_type: Type of return
        status: Current status of the return
        filing_date: Date when return was filed (if applicable)
        locked_date: Date when period was locked
        amendment_flag: Whether amendments are allowed
        created_at: Timestamp when record was created
        updated_at: Timestamp when record was last updated
        filed_by: User who filed the return
        lock_reason: Reason for locking (if locked)
    """
    period: str
    return_type: ReturnType
    status: ReturnStatus = ReturnStatus.DRAFT
    filing_date: Optional[date] = None
    locked_date: Optional[date] = None
    amendment_flag: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    filed_by: str = ""
    lock_reason: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        # Convert string to enum if needed
        if isinstance(self.return_type, str):
            self.return_type = ReturnType(self.return_type)
        if isinstance(self.status, str):
            self.status = ReturnStatus(self.status)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "period": self.period,
            "return_type": self.return_type.value,
            "status": self.status.value,
            "filing_date": self.filing_date.isoformat() if self.filing_date else None,
            "locked_date": self.locked_date.isoformat() if self.locked_date else None,
            "amendment_flag": self.amendment_flag,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "filed_by": self.filed_by,
            "lock_reason": self.lock_reason,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReturnPeriod':
        """Create ReturnPeriod from dictionary"""
        return cls(
            period=data["period"],
            return_type=data.get("return_type", "GSTR-3B"),
            status=data.get("status", "draft"),
            filing_date=date.fromisoformat(data["filing_date"]) if data.get("filing_date") else None,
            locked_date=date.fromisoformat(data["locked_date"]) if data.get("locked_date") else None,
            amendment_flag=data.get("amendment_flag", False),
            filed_by=data.get("filed_by", ""),
            lock_reason=data.get("lock_reason", ""),
            metadata=data.get("metadata", {})
        )
    
    def can_edit(self) -> bool:
        """Check if the return can be edited"""
        return self.status in [ReturnStatus.DRAFT, ReturnStatus.IN_PROGRESS]
    
    def can_file(self) -> bool:
        """Check if the return can be filed"""
        return self.status in [ReturnStatus.DRAFT, ReturnStatus.IN_PROGRESS]
    
    def can_lock(self) -> bool:
        """Check if the return can be locked"""
        return self.status == ReturnStatus.FILED
    
    def is_locked(self) -> bool:
        """Check if the return period is locked"""
        return self.status == ReturnStatus.LOCKED
    
    def file_return(self, filed_by: str):
        """File the return"""
        if not self.can_file():
            raise ValueError(f"Cannot file return in {self.status.value} status")
        
        self.status = ReturnStatus.FILED
        self.filing_date = date.today()
        self.filed_by = filed_by
        self.updated_at = datetime.now()
    
    def lock_period(self, reason: str = "Auto-locked after filing"):
        """Lock the return period"""
        if not self.can_lock():
            raise ValueError(f"Cannot lock return in {self.status.value} status")
        
        self.status = ReturnStatus.LOCKED
        self.locked_date = date.today()
        self.lock_reason = reason
        self.updated_at = datetime.now()
    
    def unlock_for_amendment(self):
        """Unlock period for amendment"""
        if not self.is_locked():
            raise ValueError("Can only unlock locked returns for amendment")
        
        self.status = ReturnStatus.AMENDMENT
        self.amendment_flag = True
        self.updated_at = datetime.now()
    
    def revert_to_draft(self):
        """Revert to draft status"""
        if self.is_locked():
            raise ValueError("Cannot revert locked return to draft")
        
        self.status = ReturnStatus.DRAFT
        self.filing_date = None
        self.updated_at = datetime.now()


class ReturnRegistry:
    """
    Registry for managing tax return periods.
    
    Handles:
    - Creating new return periods
    - Tracking filing status
    - Period locking/unlocking
    - Amendment tracking
    """
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize the registry.
        
        Args:
            storage_path: Path to JSON file for persistence (optional)
        """
        self.storage_path = storage_path
        self.returns: Dict[str, ReturnPeriod] = {}
        
        if storage_path and os.path.exists(storage_path):
            self._load_from_file()
    
    def _get_key(self, period: str, return_type: ReturnType) -> str:
        """Generate unique key for a return"""
        return f"{return_type.value}_{period}"
    
    def create_return(
        self, 
        period: str, 
        return_type: ReturnType
    ) -> ReturnPeriod:
        """
        Create a new return period.
        
        Args:
            period: Return period code
            return_type: Type of return
            
        Returns:
            Created ReturnPeriod
        """
        key = self._get_key(period, return_type)
        
        if key in self.returns:
            raise ValueError(f"Return {key} already exists")
        
        new_return = ReturnPeriod(
            period=period,
            return_type=return_type
        )
        
        self.returns[key] = new_return
        self._save_to_file()
        
        return new_return
    
    def get_return(
        self, 
        period: str, 
        return_type: ReturnType
    ) -> Optional[ReturnPeriod]:
        """
        Get return period by period and type.
        
        Args:
            period: Return period code
            return_type: Type of return
            
        Returns:
            ReturnPeriod if found, None otherwise
        """
        key = self._get_key(period, return_type)
        return self.returns.get(key)
    
    def get_or_create(
        self, 
        period: str, 
        return_type: ReturnType
    ) -> ReturnPeriod:
        """
        Get existing return or create new one.
        
        Args:
            period: Return period code
            return_type: Type of return
            
        Returns:
            ReturnPeriod (existing or new)
        """
        existing = self.get_return(period, return_type)
        if existing:
            return existing
        return self.create_return(period, return_type)
    
    def file_return(
        self, 
        period: str, 
        return_type: ReturnType, 
        filed_by: str
    ) -> ReturnPeriod:
        """
        File a return.
        
        Args:
            period: Return period code
            return_type: Type of return
            filed_by: User filing the return
            
        Returns:
            Filed ReturnPeriod
        """
        return_period = self.get_or_create(period, return_type)
        return_period.file_return(filed_by)
        self._save_to_file()
        return return_period
    
    def lock_period(
        self, 
        period: str, 
        return_type: ReturnType,
        reason: str = "Filed by taxpayer"
    ) -> ReturnPeriod:
        """
        Lock a return period.
        
        Args:
            period: Return period code
            return_type: Type of return
            reason: Reason for locking
            
        Returns:
            Locked ReturnPeriod
            
        Raises:
            ValueError: If return cannot be locked
        """
        return_period = self.get_return(period, return_type)
        
        if not return_period:
            raise ValueError(f"Return {period} not found")
        
        return_period.lock_period(reason)
        self._save_to_file()
        return return_period
    
    def check_locked(
        self, 
        period: str, 
        return_type: ReturnType
    ) -> bool:
        """
        Check if a return period is locked.
        
        Args:
            period: Return period code
            return_type: Type of return
            
        Returns:
            True if locked, False otherwise
        """
        return_period = self.get_return(period, return_type)
        return return_period.is_locked() if return_period else False
    
    def get_all_returns(
        self, 
        return_type: Optional[ReturnType] = None,
        status: Optional[ReturnStatus] = None
    ) -> List[ReturnPeriod]:
        """
        Get all returns, optionally filtered.
        
        Args:
            return_type: Filter by return type
            status: Filter by status
            
        Returns:
            List of ReturnPeriod
        """
        results = list(self.returns.values())
        
        if return_type:
            results = [r for r in results if r.return_type == return_type]
        
        if status:
            results = [r for r in results if r.status == status]
        
        return results
    
    def get_summary(self) -> Dict[str, Any]:
        """Get summary of all returns"""
        return {
            "total_returns": len(self.returns),
            "by_status": {
                status.value: len([r for r in self.returns.values() if r.status == status])
                for status in ReturnStatus
            },
            "by_type": {
                rtype.value: len([r for r in self.returns.values() if r.return_type == rtype])
                for rtype in ReturnType
            }
        }
    
    def _save_to_file(self):
        """Save registry to JSON file"""
        if not self.storage_path:
            return
        
        data = {key: ret.to_dict() for key, ret in self.returns.items()}
        
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        
        with open(self.storage_path, 'w') as f:
            json.dump(data, f, indent=2)
    
    def _load_from_file(self):
        """Load registry from JSON file"""
        if not self.storage_path or not os.path.exists(self.storage_path):
            return
        
        with open(self.storage_path, 'r') as f:
            data = json.load(f)
        
        for key, ret_data in data.items():
            self.returns[key] = ReturnPeriod.from_dict(ret_data)


# Global registry instance
_global_registry: Optional[ReturnRegistry] = None


def get_registry(storage_path: Optional[str] = None) -> ReturnRegistry:
    """
    Get or create the global return registry.
    
    Args:
        storage_path: Optional path for persistence
        
    Returns:
        Global ReturnRegistry instance
    """
    global _global_registry
    
    if _global_registry is None:
        _global_registry = ReturnRegistry(storage_path)
    
    return _global_registry


def check_period_locked(
    period: str, 
    return_type: ReturnType = ReturnType.GSTR3B
) -> bool:
    """
    Quick check if a period is locked.
    
    Args:
        period: Return period code
        return_type: Type of return
        
    Returns:
        True if locked
    """
    registry = get_registry()
    return registry.check_locked(period, return_type)


def lock_period_if_filed(
    period: str, 
    return_type: ReturnType = ReturnType.GSTR3B,
    reason: str = "Auto-locked after filing"
):
    """
    Lock a period after filing.
    
    Args:
        period: Return period code
        return_type: Type of return
        reason: Reason for locking
    """
    registry = get_registry()
    return_period = registry.get_return(period, return_type)
    
    if return_period and return_period.status == ReturnStatus.FILED:
        return_period.lock_period(reason)
