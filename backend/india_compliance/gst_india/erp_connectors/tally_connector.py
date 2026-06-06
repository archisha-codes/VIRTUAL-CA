"""
Tally ERP Connector

Connector for Tally Prime ERP system.
Supports data extraction via Tally's XML/JSON interface.
"""

import json
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
    AuthConfig,
)
from india_compliance.gst_india.erp_connectors.exceptions import (
    AuthenticationError,
    ConnectionError,
    DataExtractionError,
)


class TallyConnector(ERPConnector):
    """
    Tally Prime Connector
    
    Connects to Tally Prime via its XML/JSON gateway interface.
    """
    
    # Default field mappings for Tally
    DEFAULT_MAPPINGS = {
        "invoice": {
            "invoice_number": "VoucherNumber",
            "invoice_date": "VoucherDate",
            "invoice_value": "VoucherTotal",
            "customer_name": "PartyName",
            "customer_gstin": "PartyLedgerName",
            "taxable_value": "TaxableAmount",
            "igst": "IGSTAmount",
            "cgst": "CGSTAmount",
            "sgst": "SGSTAmount",
            "cess": "CESSAmount",
        },
        "item": {
            "item_code": "StockItemName",
            "item_name": "StockItemName",
            "hsn_code": "HSNCode",
            "tax_rate": "Rate",
            "unit": "Unit",
        },
        "contact": {
            "name": "PartyName",
            "gstin": "GSTIN",
            "email": "Email",
            "phone": "Phone",
            "address": "Address",
            "state": "StateName",
        }
    }
    
    def __init__(self, config: ConnectionConfig):
        super().__init__(config)
        self.session = requests.Session()
        self.tally_url = f"http://{config.base_url}:{config.port or 9000}"
        
        # Apply default mappings if not configured
        if not self.config.field_mappings:
            self.config.field_mappings = self.DEFAULT_MAPPINGS
    
    def authenticate(self) -> bool:
        """
        Authenticate with Tally Prime.
        
        Tally uses a simple XML request for connection testing.
        """
        try:
            # Test connection with a simple request
            response = self._send_request("""
                <ENVELOPE>
                    <HEADER>
                        <VERSION>1</VERSION>
                        <TALLYREQUEST>Export</TALLYREQUEST>
                        <TYPE>Data</TYPE>
                        <ID>Company</ID>
                    </HEADER>
                    <BODY>
                        <DESC>
                            <STATICVARIABLES>
                                <SVEXPORTFORMAT>XML</SVEXPORTFORMAT>
                            </STATICVARIABLES>
                        </DESC>
                    </BODY>
                </ENVELOPE>
            """)
            
            if response and "COMPANY" in response.upper():
                self._authenticated = True
                self.logger.info("Successfully authenticated with Tally Prime")
                return True
            
            raise AuthenticationError("Failed to connect to Tally Prime")
            
        except requests.exceptions.ConnectionError:
            raise ConnectionError("Cannot connect to Tally Prime. Check if Tally is running and gateway is enabled.")
        except Exception as e:
            raise AuthenticationError(f"Tally authentication failed: {str(e)}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the Tally connection"""
        try:
            is_authenticated = self.authenticate()
            
            # Get company info
            company_info = self._get_company_info()
            
            return {
                "success": True,
                "message": "Connection successful",
                "company": company_info,
                "connector_type": "tally"
            }
        except Exception as e:
            return {
                "success": False,
                "message": str(e),
                "connector_type": "tally"
            }
    
    def _get_company_info(self) -> Dict[str, Any]:
        """Get Tally company information"""
        try:
            response = self._send_request("""
                <ENVELOPE>
                    <HEADER>
                        <VERSION>1</VERSION>
                        <TALLYREQUEST>Export</TALLYREQUEST>
                        <TYPE>Data</TYPE>
                        <ID>Company</ID>
                    </HEADER>
                    <BODY>
                        <DESC>
                            <STATICVARIABLES>
                                <SVEXPORTFORMAT>XML</SVEXPORTFORMAT>
                            </STATICVARIABLES>
                        </DESC>
                    </BODY>
                </ENVELOPE>
            """)
            
            # Parse company info from XML response
            # This is a simplified version
            return {
                "name": "Tally Company",
                "status": "Connected"
            }
        except Exception:
            return {"name": "Unknown", "status": "Unknown"}
    
    def extract_invoices(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        voucher_type: str = "Sales",
        **kwargs
    ) -> List[Invoice]:
        """
        Extract invoices from Tally.
        
        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            voucher_type: Type of voucher (Sales, Purchase, etc.)
            
        Returns:
            List of Invoice objects
        """
        if not self._authenticated:
            self.authenticate()
        
        invoices = []
        
        try:
            # Build the XML request for sales vouchers
            xml_request = self._build_voucher_query(start_date, end_date, voucher_type)
            response = self._send_request(xml_request)
            
            # Parse the response
            vouchers = self._parse_vouchers(response)
            
            for voucher in vouchers:
                try:
                    invoice = self._transform_tally_voucher(voucher)
                    invoices.append(invoice)
                except Exception as e:
                    self.logger.warning(f"Failed to transform voucher: {str(e)}")
                    continue
            
            self.logger.info(f"Extracted {len(invoices)} invoices from Tally")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract invoices: {str(e)}")
        
        return invoices
    
    def extract_items(self, **kwargs) -> List[Item]:
        """Extract items from Tally"""
        if not self._authenticated:
            self.authenticate()
        
        items = []
        
        try:
            xml_request = """
                <ENVELOPE>
                    <HEADER>
                        <VERSION>1</VERSION>
                        <TALLYREQUEST>Export</TALLYREQUEST>
                        <TYPE>Data</TYPE>
                        <ID>StockItem</ID>
                    </HEADER>
                    <BODY>
                        <DESC>
                            <STATICVARIABLES>
                                <SVEXPORTFORMAT>XML</SVEXPORTFORMAT>
                            </STATICVARIABLES>
                        </DESC>
                    </BODY>
                </ENVELOPE>
            """
            
            response = self._send_request(xml_request)
            stock_items = self._parse_stock_items(response)
            
            for item in stock_items:
                try:
                    transformed_item = self.transform_item(item)
                    items.append(transformed_item)
                except Exception as e:
                    self.logger.warning(f"Failed to transform item: {str(e)}")
                    continue
            
            self.logger.info(f"Extracted {len(items)} items from Tally")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract items: {str(e)}")
        
        return items
    
    def extract_contacts(self, **kwargs) -> List[Contact]:
        """Extract contacts/ledgers from Tally"""
        if not self._authenticated:
            self.authenticate()
        
        contacts = []
        
        try:
            xml_request = """
                <ENVELOPE>
                    <HEADER>
                        <VERSION>1</VERSION>
                        <TALLYREQUEST>Export</TALLYREQUEST>
                        <TYPE>Data</TYPE>
                        <ID>Ledger</ID>
                    </HEADER>
                    <BODY>
                        <DESC>
                            <STATICVARIABLES>
                                <SVEXPORTFORMAT>XML</SVEXPORTFORMAT>
                            </STATICVARIABLES>
                        </DESC>
                    </BODY>
                </ENVELOPE>
            """
            
            response = self._send_request(xml_request)
            ledgers = self._parse_ledgers(response)
            
            for ledger in ledgers:
                try:
                    transformed_contact = self.transform_contact(ledger)
                    # Only include parties with GSTIN
                    if transformed_contact.gstin:
                        contacts.append(transformed_contact)
                except Exception as e:
                    self.logger.warning(f"Failed to transform ledger: {str(e)}")
                    continue
            
            self.logger.info(f"Extracted {len(contacts)} contacts from Tally")
            
        except Exception as e:
            raise DataExtractionError(f"Failed to extract contacts: {str(e)}")
        
        return contacts
    
    # ==================== Helper Methods ====================
    
    def _send_request(self, xml_payload: str) -> str:
        """Send XML request to Tally"""
        self._check_rate_limit()
        
        headers = {
            "Content-Type": "application/xml",
            "Accept": "application/xml"
        }
        
        try:
            response = self.session.post(
                f"{self.tally_url}",
                data=xml_payload.encode('utf-8'),
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                return response.text
            else:
                raise ConnectionError(f"Tally returned status {response.status_code}")
                
        except requests.exceptions.Timeout:
            raise ConnectionError("Tally request timed out")
        except requests.exceptions.ConnectionError as e:
            raise ConnectionError(f"Cannot connect to Tally: {str(e)}")
    
    def _build_voucher_query(
        self,
        start_date: Optional[str],
        end_date: Optional[str],
        voucher_type: str
    ) -> str:
        """Build XML query for voucher extraction"""
        date_filter = ""
        if start_date and end_date:
            date_filter = f"""
                <DATEFROM>{start_date}</DATEFROM>
                <DATETO>{end_date}</DATETO>
            """
        
        return f"""
            <ENVELOPE>
                <HEADER>
                    <VERSION>1</VERSION>
                    <TALLYREQUEST>Export</TALLYREQUEST>
                    <TYPE>Data</TYPE>
                    <ID>VoucherType:{voucher_type}</ID>
                </HEADER>
                <BODY>
                    <DESC>
                        <STATICVARIABLES>
                            <SVEXPORTFORMAT>XML</SVEXPORTFORMAT>
                            <ISINCLUSIVE>Yes</ISINCLUSIVE>
                            {date_filter}
                        </STATICVARIABLES>
                    </DESC>
                </BODY>
            </ENVELOPE>
        """
    
    def _parse_vouchers(self, xml_response: str) -> List[Dict[str, Any]]:
        """Parse voucher XML response into dictionaries"""
        # Simplified XML parsing - in production use proper XML parser
        vouchers = []
        
        # This is a mock implementation
        # In reality, parse the XML using ElementTree or similar
        try:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(xml_response)
            
            for voucher in root.findall(".//VOUCHER"):
                voucher_data = {}
                
                # Extract basic fields
                for child in voucher:
                    tag = child.tag.replace(" ", "_")
                    voucher_data[tag] = child.text
                
                if voucher_data.get("VOUCHERTYPENAME") in ["Sales", "Sales Order"]:
                    vouchers.append(voucher_data)
                    
        except Exception as e:
            self.logger.warning(f"XML parsing error: {str(e)}")
        
        return vouchers
    
    def _parse_stock_items(self, xml_response: str) -> List[Dict[str, Any]]:
        """Parse stock item XML response"""
        items = []
        
        try:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(xml_response)
            
            for item in root.findall(".//STOCKITEM"):
                item_data = {}
                
                for child in item:
                    tag = child.tag.replace(" ", "_")
                    item_data[tag] = child.text
                
                items.append(item_data)
                
        except Exception as e:
            self.logger.warning(f"XML parsing error: {str(e)}")
        
        return items
    
    def _parse_ledgers(self, xml_response: str) -> List[Dict[str, Any]]:
        """Parse ledger XML response"""
        ledgers = []
        
        try:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(xml_response)
            
            for ledger in root.findall(".//LEDGER"):
                ledger_data = {}
                
                for child in ledger:
                    tag = child.tag.replace(" ", "_")
                    ledger_data[tag] = child.text
                
                ledgers.append(ledger_data)
                
        except Exception as e:
            self.logger.warning(f"XML parsing error: {str(e)}")
        
        return ledgers
    
    def _transform_tally_voucher(self, voucher: Dict[str, Any]) -> Invoice:
        """Transform Tally voucher to Invoice model"""
        mappings = self.config.field_mappings.get('invoice', {})
        
        # Determine GST category based on voucher type
        voucher_type = voucher.get('VOUCHERTYPENAME', '')
        if voucher_type in ['Sales', 'Sales Order']:
            # Check if it's B2B, B2CL, or Export
            party_name = voucher.get('PartyLedgerName', '')
            if party_name:
                # B2B for registered dealers
                gst_category = 'B2B'
            else:
                # B2CS for unregistered
                gst_category = 'B2CS'
        else:
            gst_category = 'B2B'  # Default
        
        invoice = Invoice(
            invoice_number=voucher.get(mappings.get('invoice_number', 'VoucherNumber'), ''),
            invoice_date=voucher.get(mappings.get('invoice_date', 'VoucherDate'), ''),
            invoice_value=float(voucher.get(mappings.get('invoice_value', 'VoucherTotal'), 0) or 0),
            place_of_supply=voucher.get('StateName', 'Maharashtra'),
            customer_name=voucher.get(mappings.get('customer_name', 'PartyName'), ''),
            customer_gstin=self._extract_gstin(voucher.get('PartyLedgerName', '')),
            gst_category=gst_category,
            taxable_value=float(voucher.get(mappings.get('taxable_value', 'TaxableAmount'), 0) or 0),
            rate=self._calculate_rate(voucher),
            igst=float(voucher.get(mappings.get('igst', 'IGSTAmount'), 0) or 0),
            cgst=float(voucher.get(mappings.get('cgst', 'CGSTAmount'), 0) or 0),
            sgst=float(voucher.get(mappings.get('sgst', 'SGSTAmount'), 0) or 0),
            cess=float(voucher.get(mappings.get('cess', 'CESSAmount'), 0) or 0),
            is_return=voucher_type.lower().includes('credit') or voucher_type.lower().includes('return'),
            is_debit_note=voucher_type.lower().includes('debit'),
            source_system='tally',
            source_invoice_id=voucher.get('VOUCHERKEY', ''),
            raw_data=voucher
        )
        
        return invoice
    
    def _extract_gstin(self, party_ledger: str) -> Optional[str]:
        """Extract GSTIN from party ledger name or related field"""
        # Tally often stores GSTIN in a separate field
        # This is a placeholder for actual extraction logic
        return None
    
    def _calculate_rate(self, voucher: Dict[str, Any]) -> float:
        """Calculate GST rate from tax amounts"""
        taxable = float(voucher.get('TaxableAmount', 0) or 0)
        if taxable <= 0:
            return 0
        
        igst = float(voucher.get('IGSTAmount', 0) or 0)
        cgst = float(voucher.get('CGSTAmount', 0) or 0)
        sgst = float(voucher.get('SGSTAmount', 0) or 0)
        
        total_tax = igst + cgst + sgst
        rate = (total_tax / taxable) * 100
        
        return round(rate, 2)


# Register the connector
from india_compliance.gst_india.erp_connectors.base_connector import ConnectorRegistry
ConnectorRegistry.register("tally", TallyConnector)
