"""
Zoho Connector

Connector for Zoho Books API.
Supports data extraction via Zoho REST API with OAuth2 authentication.
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


class ZohoConnector(ERPConnector):
    """
    Zoho Books Connector
    
    Connects to Zoho Books via REST API.
    Supports OAuth2 authentication.
    """
    
    # Zoho API base URLs
    ZOHO_BASE_URL = "https://www.zohoapis.com"
    ZOHO_SANDBOX_URL = "https://sandbox.zohoapis.com"
    
    # Default field mappings for Zoho
    DEFAULT_MAPPINGS = {
        "invoice": {
            "invoice_number": "invoice_number",
            "invoice_date": "date",
            "invoice_value": "total",
            "customer_name": "customer_name",
            "customer_gstin": "gst_treatment",
            "taxable_value": "sub_total",
            "igst": "igst",
            "cgst": "cgst",
            "sgst": "sgst",
            "cess": "cess",
        },
        "item": {
            "item_code": "item_id",
            "item_name": "name",
            "hsn_code": "hsn_code",
            "tax_rate": "tax_rate",
            "unit": "unit",
        },
        "contact": {
            "name": "contact_name",
            "gstin": "gstin",
            "email": "email",
            "phone": "phone",
            "address": "billing_address",
            "state": "state",
            "pincode": "zip",
        }
    }
    
    def __init__(self, config: ConnectionConfig):
        super().__init__(config)
        self.session = requests.Session()
        self.is_sandbox = config.credentials.get("sandbox", False)
        self.zoho_base_url = self.ZOHO_SANDBOX_URL if self.is_sandbox else self.ZOHO_BASE_URL
        self.org_id = config.credentials.get("org_id", "")
        
        # Apply default mappings
        if not self.config.field_mappings:
            self.config.field_mappings = self.DEFAULT_MAPPINGS
    
    def authenticate(self) -> bool:
        """Authenticate with Zoho using OAuth2."""
        try:
            auth_config = self.config.auth
            
            # Check if we have a valid access token
            if auth_config.access_token and auth_config.token_expires_at:
                if datetime.now() < auth_config.token_expires_at:
                    self.session.headers.update({
                        "Authorization": f"Zoho-oauthtoken {auth_config.access_token}"
                    })
                    self._authenticated = True
                    return True
            
            # Try to refresh token
            if auth_config.refresh_token:
                self._refresh_access_token()
                self._authenticated = True
                return True
            
            raise AuthenticationError("No valid Zoho authentication credentials")
            
        except Exception as e:
            raise AuthenticationError(f"Zoho authentication failed: {str(e)}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test Zoho connection"""
        try:
            is_authenticated = self.authenticate()
            company_info = self._get_organization_info()
            
            return {
                "success": True,
                "message": "Zoho connection successful",
                "company": company_info,
                "connector_type": "zoho"
            }
        except Exception as e:
            return {
                "success": False,
                "message": str(e),
                "connector_type": "zoho"
            }
    
    def _refresh_access_token(self):
        """Refresh OAuth2 access token"""
        auth_config = self.config.auth
        
        token_url = "https://accounts.zoho.com/oauth/v2/token"
        
        response = self.session.post(
            token_url,
            data={
                "refresh_token": auth_config.refresh_token,
                "client_id": auth_config.credentials.get("client_id", ""),
                "client_secret": auth_config.credentials.get("client_secret", ""),
                "grant_type": "refresh_token"
            },
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            auth_config.access_token = data.get("access_token")
            
            expires_in = data.get("expires_in", 3600)
            auth_config.token_expires_at = datetime.now().timestamp() + expires_in
            
            self.session.headers.update({
                "Authorization": f"Zoho-oauthtoken {auth_config.access_token}"
            })
        else:
            raise AuthenticationError("Failed to refresh Zoho token")
    
    def _get_organization_info(self) -> Dict[str, Any]:
        """Get Zoho organization information"""
        try:
            response = self.session.get(
                f"{self.zoho_base_url}/books/v3/organizations/{self.org_id}",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                org = data.get("organization", {})
                return {
                    "organization_name": org.get("name", ""),
                    "country": org.get("country", ""),
                    "industry": org.get("industry", "")
                }
                
        except Exception as e:
            self.logger.warning(f"Failed to get organization info: {str(e)}")
        
        return {"organization_name": "Zoho Organization", "country": "IN"}
    
    def extract_invoices(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        **kwargs
    ) -> List[Invoice]:
        """Extract invoices from Zoho Books."""
        if not self._authenticated:
            self.authenticate()
        
        invoices = []
        
        try:
            params = {}
            if start_date:
                params["date_start"] = start_date
            if end_date:
                params["date_end"] = end_date
            
            # Paginate through all invoices
            page = 1
            while True:
                params["page"] = page
                response = self.session.get(
                    f"{self.zoho_base_url}/books/v3/invoices",
                    params=params,
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    zoho_invoices = data.get("invoices", [])
                    
                    if not zoho_invoices:
                        break
                    
                    for zoho_inv in zoho_invoices:
                        try:
                            invoice = self._transform_zoho_invoice(zoho_inv)
                            invoices.append(invoice)
                        except Exception as e:
                            self.logger.warning(f"Failed to transform Zoho invoice: {str(e)}")
                            continue
                    
                    page += 1
                else:
                    break
            
            self.logger.info(f"Extracted {len(invoices)} invoices from Zoho")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract invoices from Zoho: {str(e)}")
        
        return invoices
    
    def extract_items(self, **kwargs) -> List[Item]:
        """Extract items/products from Zoho"""
        if not self._authenticated:
            self.authenticate()
        
        items = []
        
        try:
            page = 1
            while True:
                response = self.session.get(
                    f"{self.zoho_base_url}/books/v3/items",
                    params={"page": page, "per_page": 200},
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    zoho_items = data.get("items", [])
                    
                    if not zoho_items:
                        break
                    
                    for zoho_item in zoho_items:
                        try:
                            item = self.transform_item(zoho_item)
                            items.append(item)
                        except Exception as e:
                            self.logger.warning(f"Failed to transform Zoho item: {str(e)}")
                            continue
                    
                    page += 1
                else:
                    break
            
            self.logger.info(f"Extracted {len(items)} items from Zoho")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract items from Zoho: {str(e)}")
        
        return items
    
    def extract_contacts(self, **kwargs) -> List[Contact]:
        """Extract customers/contacts from Zoho"""
        if not self._authenticated:
            self.authenticate()
        
        contacts = []
        
        try:
            page = 1
            while True:
                response = self.session.get(
                    f"{self.zoho_base_url}/books/v3/contacts",
                    params={"page": page, "per_page": 200},
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    zoho_contacts = data.get("contacts", [])
                    
                    if not zoho_contacts:
                        break
                    
                    for zoho_contact in zoho_contacts:
                        try:
                            contact = self._transform_zoho_contact(zoho_contact)
                            if contact.gstin:  # Only include GST registered
                                contacts.append(contact)
                        except Exception as e:
                            self.logger.warning(f"Failed to transform Zoho contact: {str(e)}")
                            continue
                    
                    page += 1
                else:
                    break
            
            self.logger.info(f"Extracted {len(contacts)} contacts from Zoho")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract contacts from Zoho: {str(e)}")
        
        return contacts
    
    # ==================== Transformation Methods ====================
    
    def _transform_zoho_invoice(self, zoho_invoice: Dict[str, Any]) -> Invoice:
        """Transform Zoho invoice to Invoice model"""
        
        # Extract customer info
        customer = zoho_invoice.get("customer", {})
        customer_name = customer.get("name", "") if isinstance(customer, dict) else ""
        customer_gstin = zoho_invoice.get("customer", {}).get("gstin") if isinstance(customer, dict) else None
        
        # Get tax details from line items
        line_items = zoho_invoice.get("line_items", [])
        taxable_value = 0
        igst = 0
        cgst = 0
        sgst = 0
        cess = 0
        
        for item in line_items:
            taxable_value += item.get("taxable_amount", 0)
            tax = item.get("tax", 0)
            
            # Check tax type
            if zoho_invoice.get("is_interstate", False):
                igst += tax
            else:
                cgst += tax / 2
                sgst += tax / 2
            
            cess += item.get("cess", 0)
        
        # Determine GST category
        gst_category = self._determine_gst_category(zoho_invoice)
        
        invoice = Invoice(
            invoice_number=zoho_invoice.get("invoice_number", ""),
            invoice_date=zoho_invoice.get("date", ""),
            invoice_value=float(zoho_invoice.get("total", 0) or 0),
            place_of_supply=self._get_state_from_zoho(zoho_invoice.get("place_of_supply", "")),
            customer_name=customer_name,
            customer_gstin=customer_gstin,
            gst_category=gst_category,
            taxable_value=taxable_value,
            rate=self._calculate_rate(taxable_value, igst + cgst + sgst),
            igst=igst,
            cgst=cgst,
            sgst=sgst,
            cess=cess,
            source_system="zoho",
            source_invoice_id=zoho_invoice.get("invoice_id", ""),
            raw_data=zoho_invoice
        )
        
        return invoice
    
    def _transform_zoho_contact(self, zoho_contact: Dict[str, Any]) -> Contact:
        """Transform Zoho contact to Contact model"""
        
        # Extract address
        billing = zoho_contact.get("billing_address", {})
        
        contact = Contact(
            name=zoho_contact.get("contact_name", ""),
            gstin=zoho_contact.get("gstin"),
            email=zoho_contact.get("email"),
            phone=zoho_contact.get("phone"),
            address=billing.get("address"),
            state=billing.get("state"),
            pincode=billing.get("zip"),
            is_registered=bool(zoho_contact.get("gstin")),
            source_system="zoho",
            source_contact_id=zoho_contact.get("contact_id", ""),
        )
        
        return contact
    
    def _determine_gst_category(self, invoice: Dict[str, Any]) -> str:
        """Determine GST category based on invoice"""
        # Check if export
        if invoice.get("is_export", False):
            return "EXP"
        
        # Check customer GSTIN
        customer = invoice.get("customer", {})
        if isinstance(customer, dict) and customer.get("gstin"):
            return "B2B"
        
        return "B2CS"
    
    def _get_state_from_zoho(self, state_name: str) -> str:
        """Convert Zoho state name to GST state code"""
        state_mapping = {
            "Maharashtra": "27",
            "Delhi": "07",
            "Karnataka": "29",
            "Tamil Nadu": "33",
            "Gujarat": "24",
            "Uttar Pradesh": "09",
            "West Bengal": "19",
            "Rajasthan": "08",
            "Madhya Pradesh": "23",
            "Telangana": "36",
            "Andhra Pradesh": "28",
        }
        
        return state_mapping.get(state_name, "27")
    
    def _calculate_rate(self, taxable: float, tax: float) -> float:
        """Calculate GST rate from amounts"""
        if taxable <= 0:
            return 0
        return round((tax / taxable) * 100, 2)
    
    @staticmethod
    def get_authorization_url(client_id: str, redirect_uri: str, state: str) -> str:
        """Get OAuth2 authorization URL"""
        params = {
            "response_type": "code",
            "client_id": client_id,
            "scope": "ZohoBooks.fullaccess.all",
            "redirect_uri": redirect_uri,
            "state": state
        }
        return f"https://accounts.zoho.com/oauth/v2/auth?{urlencode(params)}"
    
    @staticmethod
    def exchange_authorization_code(
        code: str,
        client_id: str,
        client_secret: str,
        redirect_uri: str
    ) -> Dict[str, Any]:
        """Exchange authorization code for access token"""
        token_url = "https://accounts.zoho.com/oauth/v2/token"
        
        response = requests.post(
            token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri
            },
            timeout=30
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise AuthenticationError("Failed to exchange authorization code")


# Register the connector
from india_compliance.gst_india.erp_connectors.base_connector import ConnectorRegistry
ConnectorRegistry.register("zoho", ZohoConnector)
