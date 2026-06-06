"""
Generic/Rest API Connector

Connector for custom/other ERP systems via REST API.
Supports configurable endpoints and mappings.
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


class GenericConnector(ERPConnector):
    """
    Generic REST API Connector
    
    Connects to any REST API with configurable endpoints and mappings.
    Supports:
    - Custom endpoints for each data type
    - Custom authentication
    - JSON/XML responses
    - Webhook support
    """
    
    def __init__(self, config: ConnectionConfig):
        super().__init__(config)
        self.session = requests.Session()
        self.base_url = config.base_url
        
        # Extract custom configurations
        self.endpoints = config.credentials.get("endpoints", {})
        self.auth_type = config.auth.auth_type
        self.custom_headers = config.auth.headers
        
        # Set up authentication
        self._setup_authentication()
        
        # Apply field mappings
        if not config.field_mappings:
            config.field_mappings = self._get_default_mappings()
    
    def _setup_authentication(self):
        """Set up authentication based on config"""
        auth_config = self.config.auth
        
        if self.auth_type == "api_key":
            api_key = auth_config.credentials.get("api_key", "")
            self.session.headers.update({"X-API-Key": api_key})
            
        elif self.auth_type == "basic":
            self.session.auth = (
                auth_config.credentials.get("username", ""),
                auth_config.credentials.get("password", "")
            )
            
        elif self.auth_type == "bearer":
            token = auth_config.credentials.get("token", "")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            
        elif self.auth_type == "oauth2":
            if auth_config.access_token:
                self.session.headers.update({
                    "Authorization": f"Bearer {auth_config.access_token}"
                })
        
        # Add custom headers
        for key, value in self.custom_headers.items():
            self.session.headers.update({key: value})
    
    def _get_default_mappings(self) -> Dict[str, Any]:
        """Get default field mappings"""
        return {
            "invoice": {
                "invoice_number": "invoice_number",
                "invoice_date": "invoice_date",
                "invoice_value": "total_amount",
                "customer_name": "customer_name",
                "customer_gstin": "gstin",
                "taxable_value": "taxable_amount",
                "rate": "tax_rate",
                "igst": "igst_amount",
                "cgst": "cgst_amount",
                "sgst": "sgst_amount",
                "cess": "cess_amount",
            },
            "item": {
                "item_code": "item_code",
                "item_name": "item_name",
                "hsn_code": "hsn_code",
                "tax_rate": "tax_rate",
                "unit": "unit",
            },
            "contact": {
                "name": "name",
                "gstin": "gstin",
                "email": "email",
                "phone": "phone",
                "address": "address",
                "state": "state",
                "pincode": "pincode",
            }
        }
    
    def authenticate(self) -> bool:
        """Authenticate with the REST API."""
        try:
            # Test connection
            response = self.session.get(
                f"{self.base_url}/health",
                timeout=10
            )
            
            # If no health endpoint, try to fetch something basic
            if response.status_code == 404:
                # Try the configured endpoints
                test_endpoint = self.endpoints.get("invoices", "")
                if test_endpoint:
                    response = self.session.get(
                        f"{self.base_url}{test_endpoint}",
                        params={"limit": 1},
                        timeout=10
                    )
            
            if response.status_code in [200, 201, 401]:
                self._authenticated = True
                return True
            
            raise AuthenticationError(f"Authentication failed with status {response.status_code}")
            
        except requests.exceptions.ConnectionError:
            raise ConnectionError(f"Cannot connect to {self.base_url}")
        except Exception as e:
            raise AuthenticationError(f"Authentication failed: {str(e)}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the REST API connection"""
        try:
            is_authenticated = self.authenticate()
            
            return {
                "success": True,
                "message": "REST API connection successful",
                "connector_type": "generic"
            }
        except Exception as e:
            return {
                "success": False,
                "message": str(e),
                "connector_type": "generic"
            }
    
    def extract_invoices(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        **kwargs
    ) -> List[Invoice]:
        """Extract invoices from REST API."""
        if not self._authenticated:
            self.authenticate()
        
        invoices = []
        
        try:
            endpoint = self.endpoints.get("invoices", "/invoices")
            params = {}
            
            # Add date filters if supported
            if start_date:
                params["from_date"] = start_date
            if end_date:
                params["to_date"] = end_date
            
            # Add custom filters
            params.update(kwargs.get("params", {}))
            
            # Make request
            response = self.session.get(
                f"{self.base_url}{endpoint}",
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Handle different response formats
                items = self._extract_items_from_response(data, "invoices")
                
                for item in items:
                    try:
                        invoice = self.transform_invoice(item)
                        invoices.append(invoice)
                    except Exception as e:
                        self.logger.warning(f"Failed to transform invoice: {str(e)}")
                        continue
            
            self.logger.info(f"Extracted {len(invoices)} invoices from REST API")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract invoices: {str(e)}")
        
        return invoices
    
    def extract_items(self, **kwargs) -> List[Item]:
        """Extract items from REST API."""
        if not self._authenticated:
            self.authenticate()
        
        items = []
        
        try:
            endpoint = self.endpoints.get("items", "/items")
            params = kwargs.get("params", {})
            
            response = self.session.get(
                f"{self.base_url}{endpoint}",
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                items_data = self._extract_items_from_response(data, "items")
                
                for item in items_data:
                    try:
                        item_obj = self.transform_item(item)
                        items.append(item_obj)
                    except Exception as e:
                        self.logger.warning(f"Failed to transform item: {str(e)}")
                        continue
            
            self.logger.info(f"Extracted {len(items)} items from REST API")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract items: {str(e)}")
        
        return items
    
    def extract_contacts(self, **kwargs) -> List[Contact]:
        """Extract contacts from REST API."""
        if not self._authenticated:
            self.authenticate()
        
        contacts = []
        
        try:
            # Try different endpoint names
            endpoint = (
                self.endpoints.get("contacts") or 
                self.endpoints.get("customers") or 
                self.endpoints.get("vendors") or
                "/contacts"
            )
            params = kwargs.get("params", {})
            
            response = self.session.get(
                f"{self.base_url}{endpoint}",
                params=params,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                contacts_data = self._extract_items_from_response(data, "contacts")
                
                for contact_data in contacts_data:
                    try:
                        contact = self.transform_contact(contact_data)
                        if contact.gstin:
                            contacts.append(contact)
                    except Exception as e:
                        self.logger.warning(f"Failed to transform contact: {str(e)}")
                        continue
            
            self.logger.info(f"Extracted {len(contacts)} contacts from REST API")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract contacts: {str(e)}")
        
        return contacts
    
    def _extract_items_from_response(
        self, 
        data: Any, 
        resource_type: str
    ) -> List[Dict[str, Any]]:
        """Extract items from various response formats"""
        
        # If it's a list, return directly
        if isinstance(data, list):
            return data
        
        # If it's a dict, try common keys
        if isinstance(data, dict):
            # Try common plural keys
            for key in [resource_type, resource_type + "s", "data", "items", "records"]:
                if key in data:
                    value = data[key]
                    if isinstance(value, list):
                        return value
        
        return []
    
    # ==================== Webhook Support ====================
    
    def register_webhook(self, webhook_url: str, events: List[str]) -> Dict[str, Any]:
        """Register a webhook for real-time updates"""
        try:
            response = self.session.post(
                f"{self.base_url}/webhooks",
                json={
                    "url": webhook_url,
                    "events": events
                },
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                return response.json()
            else:
                return {"error": f"Failed to register webhook: {response.status_code}"}
                
        except Exception as e:
            return {"error": str(e)}
    
    def process_webhook(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming webhook payload"""
        event_type = payload.get("event", "")
        event_data = payload.get("data", {})
        
        if "invoice" in event_type.lower():
            return {"type": "invoice", "data": self.transform_invoice(event_data)}
        elif "item" in event_type.lower():
            return {"type": "item", "data": self.transform_item(event_data)}
        elif "contact" in event_type.lower():
            return {"type": "contact", "data": self.transform_contact(event_data)}
        
        return {"type": "unknown", "data": event_data}


# Register the connector
from india_compliance.gst_india.erp_connectors.base_connector import ConnectorRegistry
ConnectorRegistry.register("generic", GenericConnector)
ConnectorRegistry.register("rest_api", GenericConnector)
