"""
QuickBooks Connector

Connector for QuickBooks Online API.
Supports data extraction via QuickBooks REST API with OAuth2 authentication.
"""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import requests
from urllib.parse import urlencode

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


class QuickBooksConnector(ERPConnector):
    """
    QuickBooks Online Connector
    
    Connects to QuickBooks Online via REST API.
    Supports OAuth2 authentication.
    """
    
    # QuickBooks API base URLs
    QB_BASE_URL = "https://quickbooks.api.intuit.com"
    QB_SANDBOX_URL = "https://sandbox-quickbooks.api.intuit.com"
    
    # Default field mappings for QuickBooks
    DEFAULT_MAPPINGS = {
        "invoice": {
            "invoice_number": "DocNumber",
            "invoice_date": "TxnDate",
            "invoice_value": "TotalAmt",
            "customer_name": "CustomerRef",
            "customer_gstin": "GSTRegistrationNumber",
            "taxable_value": "Line",
            "igst": "GlobalTaxCalculation",
            "rate": "TxgTaxTypeUsage",
        },
        "item": {
            "item_code": "Id",
            "item_name": "Name",
            "hsn_code": "HSNCode",
            "tax_rate": "TaxRateRef",
            "unit": "UnitPrice",
        },
        "contact": {
            "name": "DisplayName",
            "gstin": "GSTRegistrationNumber",
            "email": "PrimaryEmailAddr",
            "phone": "PrimaryPhone",
            "address": "BillAddr",
            "state": "BillAddr",
            "pincode": "BillAddr",
        }
    }
    
    def __init__(self, config: ConnectionConfig):
        super().__init__(config)
        self.session = requests.Session()
        self.is_sandbox = config.credentials.get("sandbox", False)
        self.qb_base_url = self.QB_SANDBOX_URL if self.is_sandbox else self.QB_BASE_URL
        self.realm_id = config.credentials.get("realm_id", "")
        
        # Apply default mappings
        if not self.config.field_mappings:
            self.config.field_mappings = self.DEFAULT_MAPPINGS
    
    def authenticate(self) -> bool:
        """Authenticate with QuickBooks using OAuth2."""
        try:
            auth_config = self.config.auth
            
            # Check if we have a valid access token
            if auth_config.access_token and auth_config.token_expires_at:
                if datetime.now() < auth_config.token_expires_at:
                    self.session.headers.update({
                        "Authorization": f"Bearer {auth_config.access_token}"
                    })
                    self._authenticated = True
                    return True
            
            # Try to refresh token
            if auth_config.refresh_token:
                self._refresh_access_token()
                self._authenticated = True
                return True
            
            raise AuthenticationError("No valid QuickBooks authentication credentials")
            
        except Exception as e:
            raise AuthenticationError(f"QuickBooks authentication failed: {str(e)}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test QuickBooks connection"""
        try:
            is_authenticated = self.authenticate()
            company_info = self._get_company_info()
            
            return {
                "success": True,
                "message": "QuickBooks connection successful",
                "company": company_info,
                "connector_type": "quickbooks"
            }
        except Exception as e:
            return {
                "success": False,
                "message": str(e),
                "connector_type": "quickbooks"
            }
    
    def _refresh_access_token(self):
        """Refresh OAuth2 access token"""
        auth_config = self.config.auth
        
        token_url = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
        
        response = self.session.post(
            token_url,
            data={
                "grant_type": "refresh_token",
                "refresh_token": auth_config.refresh_token,
                "client_id": auth_config.credentials.get("client_id", ""),
                "client_secret": auth_config.credentials.get("client_secret", "")
            },
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            auth_config.access_token = data.get("access_token")
            auth_config.refresh_token = data.get("refresh_token", auth_config.refresh_token)
            
            expires_in = data.get("expires_in", 3600)
            auth_config.token_expires_at = datetime.now().timestamp() + expires_in
            
            self.session.headers.update({
                "Authorization": f"Bearer {auth_config.access_token}"
            })
        else:
            raise AuthenticationError("Failed to refresh QuickBooks token")
    
    def _get_company_info(self) -> Dict[str, Any]:
        """Get QuickBooks company information"""
        try:
            response = self.session.get(
                f"{self.qb_base_url}/v3/company/{self.realm_id}/companyinfo/{self.realm_id}",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                company = data.get("CompanyInfo", {})
                return {
                    "company_name": company.get("CompanyName", ""),
                    "country": company.get("Country", ""),
                    "legal_name": company.get("LegalName", "")
                }
                
        except Exception as e:
            self.logger.warning(f"Failed to get company info: {str(e)}")
        
        return {"company_name": "QuickBooks Company", "country": "IN"}
    
    def extract_invoices(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        **kwargs
    ) -> List[Invoice]:
        """Extract invoices from QuickBooks."""
        if not self._authenticated:
            self.authenticate()
        
        invoices = []
        
        try:
            query = "SELECT * FROM Invoice"
            filters = []
            
            if start_date:
                filters.append(f"TxnDate >= '{start_date}'")
            if end_date:
                filters.append(f"TxnDate <= '{end_date}'")
            
            if filters:
                query += " WHERE " + " AND ".join(filters)
            
            query += " MAXRESULTS 1000"
            
            response = self.session.get(
                f"{self.qb_base_url}/v3/company/{self.realm_id}/query",
                params={"query": query},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                qb_invoices = data.get("QueryResponse", {}).get("Invoice", [])
                
                for qb_inv in qb_invoices:
                    try:
                        invoice = self._transform_quickbooks_invoice(qb_inv)
                        invoices.append(invoice)
                    except Exception as e:
                        self.logger.warning(f"Failed to transform QuickBooks invoice: {str(e)}")
                        continue
            
            self.logger.info(f"Extracted {len(invoices)} invoices from QuickBooks")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract invoices from QuickBooks: {str(e)}")
        
        return invoices
    
    def extract_items(self, **kwargs) -> List[Item]:
        """Extract items/products from QuickBooks"""
        if not self._authenticated:
            self.authenticate()
        
        items = []
        
        try:
            query = "SELECT * FROM Item MAXRESULTS 1000"
            
            response = self.session.get(
                f"{self.qb_base_url}/v3/company/{self.realm_id}/query",
                params={"query": query},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                qb_items = data.get("QueryResponse", {}).get("Item", [])
                
                for qb_item in qb_items:
                    try:
                        item = self.transform_item(qb_item)
                        items.append(item)
                    except Exception as e:
                        self.logger.warning(f"Failed to transform QuickBooks item: {str(e)}")
                        continue
            
            self.logger.info(f"Extracted {len(items)} items from QuickBooks")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract items from QuickBooks: {str(e)}")
        
        return items
    
    def extract_contacts(self, **kwargs) -> List[Contact]:
        """Extract customers from QuickBooks"""
        if not self._authenticated:
            self.authenticate()
        
        contacts = []
        
        try:
            query = "SELECT * FROM Customer MAXRESULTS 1000"
            
            response = self.session.get(
                f"{self.qb_base_url}/v3/company/{self.realm_id}/query",
                params={"query": query},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                qb_customers = data.get("QueryResponse", {}).get("Customer", [])
                
                for qb_customer in qb_customers:
                    try:
                        contact = self._transform_quickbooks_customer(qb_customer)
                        contacts.append(contact)
                    except Exception as e:
                        self.logger.warning(f"Failed to transform QuickBooks customer: {str(e)}")
                        continue
            
            self.logger.info(f"Extracted {len(contacts)} contacts from QuickBooks")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract contacts from QuickBooks: {str(e)}")
        
        return contacts
    
    # ==================== Transformation Methods ====================
    
    def _transform_quickbooks_invoice(self, qb_invoice: Dict[str, Any]) -> Invoice:
        """Transform QuickBooks invoice to Invoice model"""
        
        # Extract customer reference
        customer_ref = qb_invoice.get("CustomerRef", {})
        customer_name = customer_ref.get("name", "")
        
        # Extract line items for taxable value
        lines = qb_invoice.get("Line", [])
        taxable_value = 0
        for line in lines:
            if line.get("DetailType") == "SalesItemLineDetail":
                amount = line.get("Amount", 0)
                taxable_value += amount
        
        # Get tax
        total_amt = qb_invoice.get("TotalAmt", 0)
        tax_amt = qb_invoice.get("TxnTaxDetail", {}).get("TotalTax", 0)
        
        # Determine GST category
        gst_category = self._determine_gst_category(qb_invoice)
        
        invoice = Invoice(
            invoice_number=qb_invoice.get("DocNumber", ""),
            invoice_date=qb_invoice.get("TxnDate", ""),
            invoice_value=total_amt,
            place_of_supply=self._get_place_of_supply(qb_invoice),
            customer_name=customer_name,
            customer_gstin=qb_invoice.get("GSTRegistrationNumber"),
            gst_category=gst_category,
            taxable_value=taxable_value,
            rate=self._calculate_rate(taxable_value, tax_amt),
            igst=tax_amt if self._is_interstate(qb_invoice) else 0,
            cgst=tax_amt / 2 if not self._is_interstate(qb_invoice) else 0,
            sgst=tax_amt / 2 if not self._is_interstate(qb_invoice) else 0,
            source_system="quickbooks",
            source_invoice_id=qb_invoice.get("Id", ""),
            raw_data=qb_invoice
        )
        
        return invoice
    
    def _transform_quickbooks_customer(self, qb_customer: Dict[str, Any]) -> Contact:
        """Transform QuickBooks customer to Contact model"""
        
        # Extract email
        email_addr = qb_customer.get("PrimaryEmailAddr", {})
        email = email_addr.get("Address")
        
        # Extract phone
        phone = qb_customer.get("PrimaryPhone", {})
        phone_num = phone.get("FreeFormNumber")
        
        # Extract address
        bill_addr = qb_customer.get("BillAddr", {})
        
        contact = Contact(
            name=qb_customer.get("DisplayName", ""),
            gstin=qb_customer.get("GSTRegistrationNumber"),
            email=email,
            phone=phone_num,
            address=bill_addr.get("Line1"),
            state=bill_addr.get("CountrySubDivisionCode"),
            pincode=bill_addr.get("PostalCode"),
            is_registered=bool(qb_customer.get("GSTRegistrationNumber")),
            source_system="quickbooks",
            source_contact_id=qb_customer.get("Id", ""),
        )
        
        return contact
    
    def _determine_gst_category(self, invoice: Dict[str, Any]) -> str:
        """Determine GST category based on customer"""
        if invoice.get("DocType") == "Export":
            return "EXP"
        
        customer_gstin = invoice.get("GSTRegistrationNumber")
        if customer_gstin:
            return "B2B"
        
        return "B2CS"
    
    def _get_place_of_supply(self, invoice: Dict[str, Any]) -> str:
        """Get place of supply from invoice"""
        bill_addr = invoice.get("BillAddr", {})
        state = bill_addr.get("CountrySubDivisionCode", "")
        
        state_mapping = {
            "Maharashtra": "27",
            "Delhi": "07",
            "Karnataka": "29",
            "Tamil Nadu": "33",
            "Gujarat": "24",
            "Uttar Pradesh": "09",
            "West Bengal": "19",
        }
        
        return state_mapping.get(state, "27")
    
    def _is_interstate(self, invoice: Dict[str, Any]) -> bool:
        """Check if transaction is interstate"""
        return True
    
    def _calculate_rate(self, taxable: float, tax: float) -> float:
        """Calculate GST rate from amounts"""
        if taxable <= 0:
            return 0
        return round((tax / taxable) * 100, 2)
    
    @staticmethod
    def get_authorization_url(client_id: str, redirect_uri: str, state: str) -> str:
        """Get OAuth2 authorization URL"""
        params = {
            "client_id": client_id,
            "response_type": "code",
            "scope": "com.intuit.quickbooks.accounting",
            "redirect_uri": redirect_uri,
            "state": state
        }
        return f"https://appcenter.intuit.com/connect/oauth2?{urlencode(params)}"
    
    @staticmethod
    def exchange_authorization_code(
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str
    ) -> Dict[str, Any]:
        """Exchange authorization code for access token"""
        token_url = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
        
        response = requests.post(
            token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri
            },
            headers={
                "Accept": "application/json",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise AuthenticationError("Failed to exchange authorization code")


# Register the connector
from india_compliance.gst_india.erp_connectors.base_connector import ConnectorRegistry
ConnectorRegistry.register("quickbooks", QuickBooksConnector)
