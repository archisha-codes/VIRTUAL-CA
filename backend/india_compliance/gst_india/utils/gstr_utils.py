from enum import Enum
from concurrent.futures import ThreadPoolExecutor

from fastapi import HTTPException, status

from india_compliance.gst_india.api_classes.taxpayer_base import (
    TaxpayerBaseAPI,
    otp_handler,
)
from india_compliance.gst_india.api_classes.taxpayer_returns import IMSAPI, ReturnsAPI
from india_compliance.gst_india.utils import create_notification
from india_compliance.gst_india.utils.gstr_1.gstr_1_download import (
    save_gstr_1_filed_data,
    save_gstr_1_unfiled_data,
)

# Thread pool for background tasks (replacement for frappe.enqueue)
_executor = ThreadPoolExecutor(max_workers=4)


class ReturnType(Enum):
    GSTR2A = "GSTR2a"
    GSTR2B = "GSTR2b"
    GSTR1 = "GSTR1"
    UnfiledGSTR1 = "Unfiled GSTR1"
    IMS = "IMS"


def request_otp(company_gstin):
    """
    TODO: Add proper authentication/authorization for FastAPI.
    Currently removed frappe.has_permission check.
    """
    # TODO: Add FastAPI dependency for authentication
    # from fastapi import Depends
    # from india_compliance.gst_india.utils.auth import require_gst_settings_access
    
    return TaxpayerBaseAPI(company_gstin).request_otp()


def authenticate_otp(company_gstin, otp):
    """
    TODO: Add proper authentication/authorization for FastAPI.
    Currently removed frappe.has_permission check.
    """
    api = TaxpayerBaseAPI(company_gstin)
    response = api.autheticate_with_otp(otp)

    return api.process_response(response)


def generate_evc_otp(company_gstin, pan, request_type):
    """
    TODO: Add proper authentication/authorization for FastAPI.
    Currently removed frappe.has_permission check.
    """
    return TaxpayerBaseAPI(company_gstin).initiate_otp_for_evc(pan, request_type)


def download_queued_request():
    """
    TODO: This function uses frappe.get_all and frappe.enqueue.
    Replace with actual database queries and background task queue when schema is available.
    """
    # queued_requests = frappe.get_all(
    #     "GSTR Import Log",
    #     filters={"request_id": ["is", "set"]},
    #     fields=[...],
    # )
    queued_requests = []  # Placeholder
    
    if not queued_requests:
        # toggle_scheduled_jobs(stopped=True)
        return

    for doc in queued_requests:
        # _executor.submit(_download_queued_request, doc=doc)
        pass  # Placeholder


def _download_queued_request(doc):
    """
    TODO: This function uses frappe.db.delete and frappe.db.set_value.
    Replace with actual database operations when schema is available.
    """
    from india_compliance.gst_india.utils.gstr_2 import (
        _download_gstr_2a,
        save_gstr_2b,
        save_ims_invoices,
    )

    GSTR_FUNCTIONS = {
        ReturnType.GSTR2A.value: _download_gstr_2a,
        ReturnType.GSTR2B.value: save_gstr_2b,
        ReturnType.GSTR1.value: save_gstr_1_filed_data,
        ReturnType.UnfiledGSTR1.value: save_gstr_1_unfiled_data,
        ReturnType.IMS.value: save_ims_invoices,
    }

    API_CLASS = {
        ReturnType.GSTR2A.value: ReturnsAPI,
        ReturnType.GSTR2B.value: ReturnsAPI,
        ReturnType.GSTR1.value: ReturnsAPI,
        ReturnType.UnfiledGSTR1.value: ReturnsAPI,
        ReturnType.IMS.value: IMSAPI,
    }

    try:
        api = API_CLASS[doc.get("return_type", "")](doc.get("gstin"))
        response = api.download_files(
            doc.get("return_period"),
            doc.get("request_id"),
        )

    except Exception as e:
        # frappe.db.delete("GSTR Import Log", doc.name)
        raise e

    if response.error_type == "no_docs_found":
        return  # create_import_log(...)  # TODO: Replace with actual import log creation

    if response.error_type == "queued":
        return

    if response.error_type:
        return  # frappe.db.delete("GSTR Import Log", {"name": doc.name})

    # frappe.db.set_value("GSTR Import Log", doc.name, "request_id", None)
    GSTR_FUNCTIONS[doc.get("return_type", "")](
        doc.get("gstin"), 
        doc.get("return_period"), 
        response
    )


def publish_action_status_notification(
    return_type, return_period, request_type, status_cd, gstin, request_id=None
):
    status_message_map = {
        "P": f"Success: {return_type} data {request_type} for GSTIN {gstin} and return period {return_period}",
        "PE": f"Partial Success: {return_type} data {request_type} for GSTIN {gstin} and return period {return_period}",
        "ER": f"Error: {return_type} data {request_type} for GSTIN {gstin} and return period {return_period}",
    }

    message_content = {
        "subject": status_message_map.get(status_cd),
        "body": status_message_map.get(status_cd),
    }

    if return_type == "GSTR-1":
        document_type = "GSTR-1"
    elif return_type == "IMS":
        document_type = "GST Invoice Management System"
    else:
        document_type = return_type

    # TODO: Replace with proper background task queue
    # _executor.submit(create_notification, message_content=message_content, ...)
    pass


# Export otp_handler decorator for use in other modules
otp_handler = otp_handler
