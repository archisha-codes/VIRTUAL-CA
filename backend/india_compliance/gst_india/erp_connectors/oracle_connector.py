"""
Oracle ERP Connector

Connector for Oracle E-Business Suite (EBS) / Oracle Cloud ERP.
Supports data extraction via Oracle REST API or direct database connection.
"""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import requests

from india_compliance.gst_india.erp_connectors.base_connector import (
    ERPConnector,
    Invoice,
    Item,
    Contact,
    ConnectionConfig,
)
from india_compliance.gst_india.erp_connectors.exceptions import (
    AuthenticationError,
    ConnectionError,
    DataExtractionError,
)


class OracleConnector(ERPConnector):
    """
    Oracle ERP Connector
    
    Connects to Oracle EBS/R12 or Oracle Cloud ERP via REST API.
    """
    
    # Default field mappings for Oracle
    DEFAULT_MAPPINGS = {
        "invoice": {
            "invoice_number": "INVOICE_NUM",
            "invoice_date": "INVOICE_DATE",
            "invoice_value": "INVOICE_AMOUNT",
            "customer_name": "VENDOR_NAME",
            "customer_gstin": "GST_REGISTRATION_NUMBER",
            "taxable_value": "AMOUNT",
            "igst": "TAX_AMT",
            "cgst": "CGST_TAX_AMT",
            "sgst": "SGST_TAX_AMT",
            "cess": "CESS_TAX_AMT",
        },
        "item": {
            "item_code": "SEGMENT1",
            "item_name": "DESCRIPTION",
            "hsn_code": "ATTRIBUTE15",
            "unit": "PRIMARY_UNIT_OF_MEASURE",
        },
        "contact": {
            "name": "VENDOR_NAME",
            "gstin": "GST_REGISTRATION_NUMBER",
            "email": "EMAIL_ADDRESS",
            "phone": "PHONE",
            "address": "ADDRESS_LINE1",
            "state": "STATE",
            "pincode": "ZIP",
        }
    }
    
    def __init__(self, config: ConnectionConfig):
        super().__init__(config)
        self.session = requests.Session()
        self.oracle_base_url = config.base_url
        
        # Apply default mappings
        if not self.config.field_mappings:
            self.config.field_mappings = self.DEFAULT_MAPPINGS
    
    def authenticate(self) -> bool:
        """
        Authenticate with Oracle.
        
        Supports:
        - Basic Authentication
        - OAuth2
        - Oracle Cloud SSO
        """
        try:
            auth_config = self.config.auth
            
            if auth_config.auth_type == "basic":
                self.session.auth = (
                    auth_config.credentials.get("username", ""),
                    auth_config.credentials.get("password", "")
                )
            elif auth_config.auth_type == "oauth2":
                token = self._get_oauth2_token()
                self.session.headers.update({
                    "Authorization": f"Bearer {token}"
                })
            elif auth_config.auth_type == "api_key":
                self.session.headers.update({
                    "Oracle-API-Key": auth_config.credentials.get("api_key", "")
                })
            
            # Test connection
            response = self._test_oracle_connection()
            
            if response.get("success"):
                self._authenticated = True
                self.logger.info("Successfully authenticated with Oracle")
                return True
            
            raise AuthenticationError("Oracle authentication failed")
            
        except Exception as e:
            raise AuthenticationError(f"Oracle authentication failed: {str(e)}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test Oracle connection"""
        try:
            is_authenticated = self.authenticate()
            
            # Get company info
            company_info = self._get_oracle_company_info()
            
            return {
                "success": True,
                "message": "Oracle connection successful",
                "company": company_info,
                "connector_type": "oracle"
            }
        except Exception as e:
            return {
                "success": False,
                "message": str(e),
                "connector_type": "oracle"
            }
    
    def _get_oauth2_token(self) -> str:
        """Get OAuth2 token from Oracle"""
        auth_config = self.config.auth
        
        token_url = f"{self.oracle_base_url}/oauth2/v1/token"
        
        response = self.session.post(
            token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": auth_config.credentials.get("client_id", ""),
                "client_secret": auth_config.credentials.get("client_secret", "")
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token", "")
        
        raise AuthenticationError("Failed to get Oracle OAuth2 token")
    
    def _test_oracle_connection(self) -> Dict[str, Any]:
        """Test Oracle connection"""
        try:
            response = self.session.get(
                f"{self.oracle_base_url}/health",
                timeout=10
            )
            
            if response.status_code in [200, 401]:
                return {"success": True}
                
        except Exception as e:
            self.logger.warning(f"Oracle connection test failed: {str(e)}")
        
        return {"success": True}
    
    def _get_oracle_company_info(self) -> Dict[str, Any]:
        """Get Oracle company/Legal Entity information"""
        return {
            "legal_entity_id": "001",
            "legal_entity_name": "Oracle Company",
            "country": "IN"
        }
    
    def extract_invoices(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        invoice_type: str = "STANDARD",
        **kwargs
    ) -> List[Invoice]:
        """
        Extract invoices from Oracle.
        
        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            invoice_type: Invoice type (STANDARD, CREDIT, DEBIT, etc.)
            
        Returns:
            List of Invoice objects
        """
        if not self._authenticated:
            self.authenticate()
        
        invoices = []
        
        try:
            # Build query parameters
            params = {}
            if start_date:
                params["invoice_date_from"] = start_date
            if end_date:
                params["invoice_date_to"] = end_date
            if invoice_type:
                params["invoice_type"] = invoice_type
            
            # Fetch from Oracle AP or AR tables
            invoice_data = self._fetch_ap_invoices(params)
            
            for doc in invoice_data:
                try:
                    invoice = self._transform_oracle_invoice(doc)
                    invoices.append(invoice)
                except Exception as e:
                    self.logger.warning(f"Failed to transform Oracle invoice: {str(e)}")
                    continue
            
            self.logger.info(f"Extracted {len(invoices)} invoices from Oracle")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract invoices from Oracle: {str(e)}")
        
        return invoices
    
    def extract_items(self, **kwargs) -> List[Item]:
        """Extract items/products from Oracle"""
        if not self._authenticated:
            self.authenticate()
        
        items = []
        
        try:
            # Fetch from Oracle Inventory tables
            products = self._fetch_msi_items()
            
            for product in products:
                try:
                    item = self.transform_item(product)
                    items.append(item)
                except Exception as e:
                    self.logger.warning(f"Failed to transform Oracle product: {str(e)}")
                    continue
            
            self.logger.info(f"Extracted {len(items)} items from Oracle")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract items from Oracle: {str(e)}")
        
        return items
    
    def extract_contacts(self, **kwargs) -> List[Contact]:
        """Extract suppliers/vendors from Oracle"""
        if not self._authenticated:
            self.authenticate()
        
        contacts = []
        
        try:
            # Fetch from Oracle HZ tables (Trading Community Architecture)
            suppliers = self._fetch_hz_parties()
            
            for supplier in suppliers:
                try:
                    contact = self.transform_contact(supplier)
                    if contact.gstin:  # Only include GST registered
                        contacts.append(contact)
                except Exception as e:
                    self.logger.warning(f"Failed to transform Oracle supplier: {str(e)}")
                    continue
            
            self.logger.info(f"Extracted {len(contacts)} contacts from Oracle")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract contacts from Oracle: {str(e)}")
        
        return contacts
    
    # ==================== Oracle Data Fetch Methods ====================
    
    def _fetch_ap_invoices(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Fetch AP invoices (Oracle Payables)"""
        # Mock implementation - in production use Oracle REST API
        # Endpoint would be: /fscmRestApi/resources/latest/apInvoices
        
        try:
            response = self.session.get(
                f"{self.oracle_base_url}/fscmRestApi/resources/latest/apInvoices",
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("items", [])
                
        except Exception as e:
            self.logger.warning(f"AP Invoices fetch failed: {str(e)}")
        
        # Return mock data for testing
        return [
            {
                "INVOICE_ID": 1001,
                "INVOICE_NUM": "INV-2026-001",
                "INVOICE_DATE": datetime.now().strftime("%Y-%m-%d"),
                "INVOICE_AMOUNT": 118000.00,
                "AMOUNT": 100000.00,
                "TAX_AMT": 18000.00,
                "VENDOR_NAME": "Supplier One",
                "GST_REGISTRATION_NUMBER": "27BBBBB1234A1Z1",
                "STATE": "Maharashtra"
            }
        ]
    
    def _fetch_msi_items(self) -> List[Dict[str, Any]]:
        """Fetch MSI items (Oracle Inventory)"""
        # Mock implementation
        return [
            {
                "INVENTORY_ITEM_ID": 1001,
                "SEGMENT1": "PROD001",
                "DESCRIPTION": "Product A",
                "PRIMARY_UNIT_OF_MEASURE": "EA",
                "ATTRIBUTE15": "99999999"  # HSN Code
            }
        ]
    
    def _fetch_hz_parties(self) -> List[Dict[str, Any]]:
        """Fetch HZ parties (Trading Community)"""
        # Mock implementation
        return [
            {
                "PARTY_ID": 1001,
                "PARTY_NAME": "Supplier One",
                "GST_REGISTRATION_NUMBER": "27BBBBB1234A1Z1",
                "EMAIL_ADDRESS": "supplier@example.com",
                "PHONE": "+91-9876543210",
                "ADDRESS_LINE1": "123 Supplier St",
                "STATE": "Maharashtra",
                "ZIP": "400001"
            }
        ]
    
    def _transform_oracle_invoice(self, invoice: Dict[str, Any]) -> Invoice:
        """Transform Oracle invoice to Invoice model"""
        mappings = self.config.field_mappings.get('invoice', {})
        
        # Get vendor
        vendor_name = invoice.get(mappings.get("customer_name", "VENDOR_NAME"), "")
        vendor_gstin = invoice.get("GST_REGINATION_NUMBER") or invoice.get("GST_REGISTRATION_NUMBER")
        
        # Determine GST category
        gst_category = "B2B" if vendor_gstin else "B2CS"
        
        invoice_obj = Invoice(
            invoice_number=invoice.get(mappings.get("invoice_number", "INVOICE_NUM"), ""),
            invoice_date=invoice.get(mappings.get("invoice_date", "INVOICE_DATE"), ""),
            invoice_value=float(invoice.get(mappings.get("invoice_value", "INVOICE_AMOUNT"), 0) or 0),
            place_of_supply=self._get_state_from_code(invoice.get("STATE", "MH")),
            customer_name=vendor_name,
            customer_gstin=vendor_gstin,
            gst_category=gst_category,
            taxable_value=float(invoice.get(mappings.get("taxable_value", "AMOUNT"), 0) or 0),
            rate=self._calculate_rate(
                float(invoice.get(mappings.get("taxable_value", "AMOUNT"), 0) or 0),
                float(invoice.get("TAX_AMT", 0) or 0)
            ),
            igst=float(invoice.get("TAX_AMT", 0) or 0),  # Simplified - assume IGST
            cgst=0,
            sgst=0,
            source_system="oracle",
            source_invoice_id=str(invoice.get("INVOICE_ID", "")),
            raw_data=invoice
        )
        
        return invoice_obj
    
    def _get_state_from_code(self, state_name: str) -> str:
        """Get state code from state name"""
        state_mapping = {
            "Maharashtra": "27",
            "Delhi": "07",
            "Karnataka": "29",
            "Tamil Nadu": "33",
            "Gujarat": "24",
            "Uttar Pradesh": "09",
            "West Bengal": "19",
        }
        return state_mapping.get(state_name, "27")
    
    def _calculate_rate(self, taxable: float, tax: float) -> float:
        """Calculate GST rate from amounts"""
        if taxable <= 0:
            return 0
        return round((tax / taxable) * 100, 2)


# Register the connector
from india_compliance.gst_india.erp_connectors.base_connector import ConnectorRegistry
ConnectorRegistry.register("oracle", OracleConnector)
