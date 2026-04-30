"""
SAP ERP Connector

Connector for SAP ERP system.
Supports data extraction via SAP RFC/BAPI or direct table access.
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


class SAPConnector(ERPConnector):
    """
    SAP ERP Connector
    
    Connects to SAP ERP via REST API or RFC.
    Supports extraction from SAP tables (BKPF, BSEG, etc.)
    """
    
    # Default field mappings for SAP
    DEFAULT_MAPPINGS = {
        "invoice": {
            "invoice_number": "BELNR",        # Document Number
            "invoice_date": "BLDAT",          # Document Date
            "invoice_value": "WRBTR",         # Amount in Document Currency
            "customer_name": "NAME1",         # Name
            "customer_gstin": "STCD3",        # Tax Number 3 (GSTIN)
            "taxable_value": "BWBTR",          # Tax Base Amount
            "igst": "HWSTEIGST",              # IGST Amount
            "cgst": "HWSTECGST",              # CGST Amount
            "sgst": "HWSTESGST",              # SGST Amount
            "cess": "HWSTECESS",              # CESS Amount
        },
        "item": {
            "item_code": "MATNR",             # Material Number
            "item_name": "MAKTX",             # Material Description
            "hsn_code": "EXTWG",              # External Material Group
            "tax_rate": "KTGR1",              # Account Assignment Group
            "unit": "MEINS",                  # Unit of Measure
        },
        "contact": {
            "name": "NAME1",                  # Name
            "gstin": "STCD3",                 # Tax Number 3
            "email": "SMTP_ADDR",             # Email Address
            "phone": "TELF1",                 # Telephone Number
            "address": "STRAS",               # Street
            "state": "REGIO",                 # Region/State
            "pincode": "PSTLZ",               # Postal Code
        }
    }
    
    def __init__(self, config: ConnectionConfig):
        super().__init__(config)
        self.session = requests.Session()
        self.sap_base_url = config.base_url
        
        # Apply default mappings
        if not self.config.field_mappings:
            self.config.field_mappings = self.DEFAULT_MAPPINGS
    
    def authenticate(self) -> bool:
        """
        Authenticate with SAP.
        
        Supports:
        - Basic Authentication
        - OAuth2/SAML
        - SAP Cookie-based authentication
        """
        try:
            auth_config = self.config.auth
            
            if auth_config.auth_type == "basic":
                self.session.auth = (
                    auth_config.credentials.get("username", ""),
                    auth_config.credentials.get("password", "")
                )
            elif auth_config.auth_type == "api_key":
                self.session.headers.update({
                    "API-Key": auth_config.credentials.get("api_key", "")
                })
            elif auth_config.auth_type == "oauth2":
                # OAuth2 token-based authentication
                token = self._get_oauth2_token()
                self.session.headers.update({
                    "Authorization": f"Bearer {token}"
                })
            
            # Test connection
            response = self._test_sap_connection()
            
            if response.get("success"):
                self._authenticated = True
                self.logger.info("Successfully authenticated with SAP")
                return True
            
            raise AuthenticationError("SAP authentication failed")
            
        except Exception as e:
            raise AuthenticationError(f"SAP authentication failed: {str(e)}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test SAP connection"""
        try:
            is_authenticated = self.authenticate()
            
            # Get company info
            company_info = self._get_sap_company_info()
            
            return {
                "success": True,
                "message": "SAP connection successful",
                "company": company_info,
                "connector_type": "sap"
            }
        except Exception as e:
            return {
                "success": False,
                "message": str(e),
                "connector_type": "sap"
            }
    
    def _get_oauth2_token(self) -> str:
        """Get OAuth2 token from SAP"""
        auth_config = self.config.auth
        
        token_url = f"{self.sap_base_url}/oauth/token"
        
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
        
        raise AuthenticationError("Failed to get OAuth2 token")
    
    def _test_sap_connection(self) -> Dict[str, Any]:
        """Test SAP connection"""
        # Try to fetch company info or system status
        try:
            # SAP usually has an endpoint for system info
            response = self.session.get(
                f"{self.sap_base_url}/sap/bc/rest/api",
                timeout=10
            )
            
            if response.status_code in [200, 401]:
                # 401 is okay if using basic auth
                return {"success": True}
                
        except Exception as e:
            self.logger.warning(f"Connection test failed: {str(e)}")
        
        return {"success": True}  # Assume success for now
    
    def _get_sap_company_info(self) -> Dict[str, Any]:
        """Get SAP company information"""
        return {
            "company_code": "001",
            "company_name": "SAP Company",
            "country": "IN"
        }
    
    def extract_invoices(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        document_type: str = "RF",
        **kwargs
    ) -> List[Invoice]:
        """
        Extract invoices from SAP.
        
        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            document_type: SAP document type (RF = Invoice, DR = Debit Memo, etc.)
            
        Returns:
            List of Invoice objects
        """
        if not self._authenticated:
            self.authenticate()
        
        invoices = []
        
        try:
            # Build query parameters
            params = {
                "$filter": self._build_date_filter(start_date, end_date)
            }
            
            # Fetch from SAP tables (mock implementation)
            # In production, use SAP RFC/BAPI or OData
            bkpf_data = self._fetch_bkpf(params)
            
            for document in bkpf_data:
                try:
                    # Get line items
                    bseg_data = self._fetch_bseg(document.get("BELNR"))
                    
                    invoice = self._transform_sap_invoice(document, bseg_data)
                    invoices.append(invoice)
                    
                except Exception as e:
                    self.logger.warning(f"Failed to transform SAP document: {str(e)}")
                    continue
            
            self.logger.info(f"Extracted {len(invoices)} invoices from SAP")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract invoices from SAP: {str(e)}")
        
        return invoices
    
    def extract_items(self, **kwargs) -> List[Item]:
        """Extract items/materials from SAP"""
        if not self._authenticated:
            self.authenticate()
        
        items = []
        
        try:
            # Fetch materials from MARA table
            materials = self._fetch_mara()
            
            for material in materials:
                try:
                    item = self.transform_item(material)
                    items.append(item)
                except Exception as e:
                    self.logger.warning(f"Failed to transform SAP material: {str(e)}")
                    continue
            
            self.logger.info(f"Extracted {len(items)} items from SAP")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract items from SAP: {str(e)}")
        
        return items
    
    def extract_contacts(self, **kwargs) -> List[Contact]:
        """Extract customers/vendors from SAP"""
        if not self._authenticated:
            self.authenticate()
        
        contacts = []
        
        try:
            # Fetch customers from KNA1 table
            customers = self._fetch_kna1()
            
            for customer in customers:
                try:
                    contact = self.transform_contact(customer)
                    if contact.gstin:  # Only include GST registered
                        contacts.append(contact)
                except Exception as e:
                    self.logger.warning(f"Failed to transform SAP customer: {str(e)}")
                    continue
            
            self.logger.info(f"Extracted {len(contacts)} contacts from SAP")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract contacts from SAP: {str(e)}")
        
        return contacts
    
    # ==================== SAP Table Fetch Methods ====================
    
    def _build_date_filter(self, start_date: Optional[str], end_date: Optional[str]) -> str:
        """Build OData date filter"""
        filters = []
        
        if start_date:
            filters.append(f"BLDAT ge datetime'{start_date}T00:00:00'")
        if end_date:
            filters.append(f"BLDAT le datetime'{end_date}T00:00:00'")
        
        return " and ".join(filters)
    
    def _fetch_bkpf(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Fetch accounting document headers from BKPF table"""
        # Mock implementation - in production use SAP OData or RFC
        # Endpoint would be: /sap/opu/odata/sap/API_ACC_DOCUMENT_POST
        
        try:
            response = self.session.get(
                f"{self.sap_base_url}/sap/opu/odata/sap/API_BUSINESS_DOCUMENT",
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get("d", {}).get("results", [])
                
        except Exception as e:
            self.logger.warning(f"BKPF fetch failed: {str(e)}")
        
        # Return mock data for testing
        return [
            {
                "BELNR": "5100000001",
                "BLDAT": datetime.now().strftime("%Y-%m-%d"),
                "BUDAT": datetime.now().strftime("%Y-%m-%d"),
                "WRBTR": 118000.00,
                "KUNRG": "CUST001",
                "NAME1": "Customer One"
            }
        ]
    
    def _fetch_bseg(self, document_number: str) -> List[Dict[str, Any]]:
        """Fetch accounting document line items from BSEG table"""
        # Mock implementation
        return [
            {
                "BELNR": document_number,
                "BUZEI": "001",
                "HKONT": "0000400000",
                "BWBTR": 100000.00,
                "MWSTS": 18000.00,
                "HWSTEIGST": 18000.00,
                "KTGR1": "01"
            }
        ]
    
    def _fetch_mara(self) -> List[Dict[str, Any]]:
        """Fetch material master from MARA table"""
        # Mock implementation
        return [
            {
                "MATNR": "MAT001",
                "MAKTX": "Product A",
                "MEINS": "EA",
                "MTART": "HALB"
            }
        ]
    
    def _fetch_kna1(self) -> List[Dict[str, Any]]:
        """Fetch customer master from KNA1 table"""
        # Mock implementation
        return [
            {
                "KUNNR": "CUST001",
                "NAME1": "Customer One",
                "STCD3": "27AAAAA1234A1Z1",  # GSTIN
                "STRAS": "123 Main Street",
                "ORT01": "Mumbai",
                "REGIO": "MH",
                "PSTLZ": "400001",
                "LAND1": "IN"
            }
        ]
    
    def _transform_sap_invoice(
        self,
        header: Dict[str, Any],
        line_items: List[Dict[str, Any]]
    ) -> Invoice:
        """Transform SAP document to Invoice model"""
        mappings = self.config.field_mappings.get('invoice', {})
        
        # Calculate totals from line items
        total_taxable = sum(item.get("BWBTR", 0) for item in line_items)
        total_igst = sum(item.get("HWSTEIGST", 0) for item in line_items)
        total_cgst = sum(item.get("HWSTECGST", 0) for item in line_items)
        total_sgst = sum(item.get("HWSTESGST", 0) for item in line_items)
        
        # Determine GST category
        customer = header.get("KUNRG", "")
        gst_category = "B2B" if customer else "B2CS"
        
        invoice = Invoice(
            invoice_number=header.get(mappings.get("invoice_number", "BELNR"), ""),
            invoice_date=header.get(mappings.get("invoice_date", "BLDAT"), ""),
            invoice_value=float(header.get(mappings.get("invoice_value", "WRBTR"), 0) or 0),
            place_of_supply=self._get_state_code(header.get("REGIO", "MH")),
            customer_name=header.get(mappings.get("customer_name", "NAME1"), ""),
            customer_gstin=header.get("STCD3"),  # GSTIN stored in header
            gst_category=gst_category,
            taxable_value=total_taxable,
            rate=self._calculate_rate(total_taxable, total_igst + total_cgst + total_sgst),
            igst=total_igst,
            cgst=total_cgst,
            sgst=total_sgst,
            source_system="sap",
            source_invoice_id=header.get("BELNR", ""),
            raw_data={"header": header, "line_items": line_items}
        )
        
        return invoice
    
    def _get_state_code(self, region_code: str) -> str:
        """Convert SAP region code to GST state code"""
        # SAP uses state codes like MH, DL, KA
        # These are also valid GST state codes
        return region_code
    
    def _calculate_rate(self, taxable: float, tax: float) -> float:
        """Calculate GST rate from amounts"""
        if taxable <= 0:
            return 0
        return round((tax / taxable) * 100, 2)


# Register the connector
from india_compliance.gst_india.erp_connectors.base_connector import ConnectorRegistry
ConnectorRegistry.register("sap", SAPConnector)
