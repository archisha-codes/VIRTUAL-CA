"""
Consolidated Reporting

Provides consolidated reporting capabilities across multiple GSTINs in a workspace.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime

from india_compliance.gst_india.workspace.models import (
    Workspace,
    GSTINRegistration,
    GSTINStatus,
    ConsolidatedMetrics,
)
from india_compliance.gst_india.workspace.manager import WorkspaceManager


class ConsolidatedReporting:
    """
    Provides consolidated reporting across all GSTINs in a workspace.
    """
    
    @staticmethod
    def get_pan_summary(pan: str, period: str) -> Dict[str, Any]:
        """
        Get PAN-level summary across all GSTINs for a period.
        
        This aggregates data from all workspaces with the given PAN.
        """
        # Find workspaces with this PAN
        from india_compliance.gst_india.workspace.manager import _workspaces_db
        
        workspaces = [ws for ws in _workspaces_db.values() if ws.pan == pan and ws.is_active]
        
        if not workspaces:
            return {
                "pan": pan,
                "period": period,
                "workspaces": [],
                "total_gstins": 0,
                "active_gstins": 0,
            }
        
        all_gstins = []
        for ws in workspaces:
            all_gstins.extend(ws.gstins)
        
        active_gstins = [g for g in all_gstins if g.status == GSTINStatus.ACTIVE]
        
        # Mock aggregated data
        return {
            "pan": pan,
            "period": period,
            "workspaces": [{"id": ws.id, "name": ws.name} for ws in workspaces],
            "total_gstins": len(all_gstins),
            "active_gstins": len(active_gstins),
            "taxable_value": sum(g.__dict__.get("taxable_value", 0) for g in active_gstins),
            "total_igst": sum(g.__dict__.get("total_igst", 0) for g in active_gstins),
            "total_cgst": sum(g.__dict__.get("total_cgst", 0) for g in active_gstins),
            "total_sgst": sum(g.__dict__.get("total_sgst", 0) for g in active_gstins),
        }
    
    @staticmethod
    def get_inter_state_summary(workspace_id: str, period: str) -> Dict[str, Any]:
        """
        Get inter-state summary for all GSTINs in a workspace.
        
        This shows the distribution of inter-state supplies across states.
        """
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Mock inter-state data
        states_data = {}
        for gstin in workspace.gstins:
            if gstin.status != GSTINStatus.ACTIVE:
                continue
            
            state = gstin.state
            if state not in states_data:
                states_data[state] = {
                    "gstin": gstin.gstin,
                    "state": state,
                    "inter_state_supplies": {
                        "taxable_value": 0.0,
                        "igst": 0.0,
                    },
                    "intra_state_supplies": {
                        "taxable_value": 0.0,
                        "cgst": 0.0,
                        "sgst": 0.0,
                    },
                }
            
            # Mock data (in production, fetch from actual filings)
            states_data[state]["inter_state_supplies"]["taxable_value"] += 100000.0
            states_data[state]["inter_state_supplies"]["igst"] += 18000.0
            states_data[state]["intra_state_supplies"]["taxable_value"] += 50000.0
            states_data[state]["intra_state_supplies"]["cgst"] += 4500.0
            states_data[state]["intra_state_supplies"]["sgst"] += 4500.0
        
        return {
            "workspace_id": workspace_id,
            "pan": workspace.pan,
            "period": period,
            "states": list(states_data.values()),
            "total_inter_state": sum(s["inter_state_supplies"]["taxable_value"] for s in states_data.values()),
            "total_intra_state": sum(s["intra_state_supplies"]["taxable_value"] for s in states_data.values()),
        }
    
    @staticmethod
    def get_tax_liability_summary(workspace_id: str, period: str) -> Dict[str, Any]:
        """
        Get tax liability summary across all GSTINs.
        """
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        total_liability = 0.0
        total_igst = 0.0
        total_cgst = 0.0
        total_sgst = 0.0
        total_cess = 0.0
        
        gstin_summary = []
        
        for gstin in workspace.gstins:
            if gstin.status != GSTINStatus.ACTIVE:
                continue
            
            # Mock data (in production, fetch from actual GSTR-3B filings)
            igst = 25000.0
            cgst = 15000.0
            sgst = 15000.0
            cess = 5000.0
            liability = igst + cgst + sgst + cess
            
            total_liability += liability
            total_igst += igst
            total_cgst += cgst
            total_sgst += sgst
            total_cess += cess
            
            gstin_summary.append({
                "gstin": gstin.gstin,
                "legal_name": gstin.legal_name,
                "state": gstin.state,
                "igst": igst,
                "cgst": cgst,
                "sgst": sgst,
                "cess": cess,
                "total_liability": liability,
            })
        
        return {
            "workspace_id": workspace_id,
            "pan": workspace.pan,
            "period": period,
            "total_liability": total_liability,
            "total_igst": total_igst,
            "total_cgst": total_cgst,
            "total_sgst": total_sgst,
            "total_cess": total_cess,
            "gstins": gstin_summary,
        }
    
    @staticmethod
    def get_itc_summary(workspace_id: str, period: str) -> Dict[str, Any]:
        """
        Get Input Tax Credit summary across all GSTINs.
        """
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        total_itc = 0.0
        itc_igst = 0.0
        itc_cgst = 0.0
        itc_sgst = 0.0
        itc_cess = 0.0
        
        gstin_summary = []
        
        for gstin in workspace.gstins:
            if gstin.status != GSTINStatus.ACTIVE:
                continue
            
            # Mock data (in production, fetch from actual GSTR-2B filings)
            igst_itc = 15000.0
            cgst_itc = 8000.0
            sgst_itc = 8000.0
            cess_itc = 2000.0
            itc_total = igst_itc + cgst_itc + sgst_itc + cess_itc
            
            total_itc += itc_total
            itc_igst += igst_itc
            itc_cgst += cgst_itc
            itc_sgst += sgst_itc
            itc_cess += cess_itc
            
            gstin_summary.append({
                "gstin": gstin.gstin,
                "legal_name": gstin.legal_name,
                "state": gstin.state,
                "itc_igst": igst_itc,
                "itc_cgst": cgst_itc,
                "itc_sgst": sgst_itc,
                "itc_cess": cess_itc,
                "total_itc": itc_total,
            })
        
        return {
            "workspace_id": workspace_id,
            "pan": workspace.pan,
            "period": period,
            "total_itc": total_itc,
            "itc_igst": itc_igst,
            "itc_cgst": itc_cgst,
            "itc_sgst": itc_sgst,
            "itc_cess": itc_cess,
            "gstins": gstin_summary,
        }
    
    @staticmethod
    def compare_gstins(
        workspace_id: str,
        period: str,
        gstin_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Compare performance across multiple GSTINs.
        
        Args:
            workspace_id: Workspace ID
            period: Return period
            gstin_ids: List of GSTIN IDs to compare (optional, defaults to all)
        """
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        # Filter GSTINs
        if gstin_ids:
            gstins = [g for g in workspace.gstins if g.id in gstin_ids]
        else:
            gstins = [g for g in workspace.gstins if g.status == GSTINStatus.ACTIVE]
        
        comparison = []
        
        for gstin in gstins:
            # Mock comparison data
            comparison.append({
                "gstin": gstin.gstin,
                "legal_name": gstin.legal_name,
                "state": gstin.state,
                "registration_type": gstin.registration_type,
                "taxable_value": 150000.0,
                "tax_liability": 27000.0,
                "itc_claimed": 18000.0,
                "net_liability": 9000.0,
                "filing_status": "filed",
            })
        
        # Calculate totals
        total_taxable = sum(c["taxable_value"] for c in comparison)
        total_liability = sum(c["tax_liability"] for c in comparison)
        total_itc = sum(c["itc_claimed"] for c in comparison)
        
        return {
            "workspace_id": workspace_id,
            "pan": workspace.pan,
            "period": period,
            "gstins": comparison,
            "total": {
                "taxable_value": total_taxable,
                "tax_liability": total_liability,
                "itc_claimed": total_itc,
                "net_liability": total_liability - total_itc,
            },
            "average": {
                "taxable_value": total_taxable / len(comparison) if comparison else 0,
                "tax_liability": total_liability / len(comparison) if comparison else 0,
            },
        }
    
    @staticmethod
    def get_consolidated_metrics(workspace_id: str, period: str) -> ConsolidatedMetrics:
        """
        Get comprehensive consolidated metrics for a workspace.
        """
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        active_gstins = [g for g in workspace.gstins if g.status == GSTINStatus.ACTIVE]
        inactive_gstins = [g for g in workspace.gstins if g.status != GSTINStatus.ACTIVE]
        
        # Initialize metrics
        metrics = ConsolidatedMetrics(
            total_gstins=len(workspace.gstins),
            active_gstins=len(active_gstins),
            inactive_gstins=len(inactive_gstins),
            period=period,
        )
        
        # Aggregate by state and category
        for gstin in active_gstins:
            # Mock data
            taxable_value = 150000.0
            igst = 27000.0
            cgst = 13500.0
            sgst = 13500.0
            cess = 2000.0
            itc = 20000.0
            
            metrics.total_taxable_value += taxable_value
            metrics.total_igst += igst
            metrics.total_cgst += cgst
            metrics.total_sgst += sgst
            metrics.total_cess += cess
            metrics.total_liability += (igst + cgst + sgst + cess)
            metrics.total_itc += itc
            
            # By state
            if gstin.state not in metrics.by_state:
                metrics.by_state[gstin.state] = {
                    "taxable_value": 0.0,
                    "igst": 0.0,
                    "cgst": 0.0,
                    "sgst": 0.0,
                    "cess": 0.0,
                }
            metrics.by_state[gstin.state]["taxable_value"] += taxable_value
            metrics.by_state[gstin.state]["igst"] += igst
            metrics.by_state[gstin.state]["cgst"] += cgst
            metrics.by_state[gstin.state]["sgst"] += sgst
            metrics.by_state[gstin.state]["cess"] += cess
            
            # By category
            category = gstin.category.value if hasattr(gstin.category, 'value') else str(gstin.category)
            if category not in metrics.by_category:
                metrics.by_category[category] = {
                    "taxable_value": 0.0,
                    "igst": 0.0,
                    "cgst": 0.0,
                    "sgst": 0.0,
                    "cess": 0.0,
                }
            metrics.by_category[category]["taxable_value"] += taxable_value
            metrics.by_category[category]["igst"] += igst
            metrics.by_category[category]["cgst"] += cgst
            metrics.by_category[category]["sgst"] += sgst
            metrics.by_category[category]["cess"] += cess
            
            # Filing status (mock)
            if gstin.last_filed_period == period:
                metrics.filed_returns += 1
            else:
                metrics.pending_returns += 1
        
        return metrics
    
    @staticmethod
    def get_filing_status_summary(workspace_id: str, period: str) -> Dict[str, Any]:
        """
        Get filing status summary for all GSTINs.
        """
        workspace = WorkspaceManager.get_workspace(workspace_id)
        
        status_summary = {
            "filed": [],
            "pending": [],
            "overdue": [],
            "not_started": [],
        }
        
        for gstin in workspace.gstins:
            gstin_status = {
                "gstin": gstin.gstin,
                "legal_name": gstin.legal_name,
                "state": gstin.state,
            }
            
            if gstin.status != GSTINStatus.ACTIVE:
                status_summary["not_started"].append(gstin_status)
            elif gstin.last_filed_period == period:
                status_summary["filed"].append(gstin_status)
            else:
                # Check if overdue based on due dates
                if period < "2026-03":  # Mock logic
                    status_summary["overdue"].append(gstin_status)
                else:
                    status_summary["pending"].append(gstin_status)
        
        return {
            "workspace_id": workspace_id,
            "period": period,
            "summary": {
                "total": len(workspace.gstins),
                "filed": len(status_summary["filed"]),
                "pending": len(status_summary["pending"]),
                "overdue": len(status_summary["overdue"]),
                "not_started": len(status_summary["not_started"]),
            },
            "details": status_summary,
        }
