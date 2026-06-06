import json
import logging
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# Thread pool for background tasks (replacement for frappe.enqueue)
_executor = ThreadPoolExecutor(max_workers=4)


def enqueue_integration_request(**kwargs):
    """
    TODO: Replace with proper background task queue (e.g., Celery, RQ).
    For now, uses threading as a simple replacement for frappe.enqueue.
    """
    _executor.submit(
        create_integration_request,
        **kwargs,
    )


def create_integration_request(
    url=None,
    request_id=None,
    request_headers=None,
    data=None,
    output=None,
    error=None,
    reference_doctype=None,
    reference_name=None,
    update_gstr_action=False,
):
    """
    TODO: This function creates Integration Request documents in database.
    Replace with actual database insert when schema is available.
    For now, logs the request details.
    """
    integration_data = {
        "integration_request_service": "India Compliance API",
        "request_id": request_id,
        "url": url,
        "request_headers": pretty_json(request_headers),
        "data": pretty_json(data),
        "output": pretty_json(output),
        "error": pretty_json(error),
        "status": "Failed" if error else "Completed",
        "reference_doctype": reference_doctype,
        "reference_docname": reference_name,
    }
    
    logger.info(f"Integration Request created: {integration_data}")
    
    # TODO: Replace with actual database insert
    # doc = frappe.get_doc({...})
    # doc.insert(ignore_permissions=True, ignore_links=True)
    
    # if update_gstr_action:
    #     link_integration_request(request_id, doc.name)


def link_integration_request(request_id, doc_name):
    """
    TODO: This function links integration request to GSTR Action.
    Replace with actual database update when schema is available.
    """
    logger.info(f"Linking integration request: request_id={request_id}, doc_name={doc_name}")
    # TODO: Replace with actual database update
    # frappe.db.set_value(
    #     "GSTR Action", {"request_id": request_id}, {"integration_request": doc_name}
    # )


def pretty_json(obj):
    if not obj:
        return ""

    if isinstance(obj, str):
        return obj

    # Native Python replacement for frappe.as_json
    return json.dumps(obj, indent=4, default=str)
