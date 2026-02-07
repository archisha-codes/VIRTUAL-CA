/**
 * PropTypes for Components
 * Reusable prop type definitions for all components
 */

import PropTypes from 'prop-types';

// UploadForm PropTypes
export const UploadFormPropTypes = {
  onUpload: PropTypes.func,
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
  uploading: PropTypes.bool,
  setUploading: PropTypes.func,
  companyGstin: PropTypes.string,
  returnPeriod: PropTypes.string,
};

// SummaryTable PropTypes
export const SummaryTablePropTypes = {
  gstr1Summary: PropTypes.object,
  gstr3bSummary: PropTypes.object,
};

// ErrorPanel PropTypes
export const ErrorPanelPropTypes = {
  errors: PropTypes.arrayOf(
    PropTypes.shape({
      row: PropTypes.number,
      field: PropTypes.string,
      error: PropTypes.string,
      error_code: PropTypes.string,
      severity: PropTypes.oneOf(['CRITICAL', 'ERROR', 'WARNING']),
      section: PropTypes.string,
      suggestion: PropTypes.string,
    })
  ),
  onDismiss: PropTypes.func,
  onExport: PropTypes.func,
};

// DownloadButtons PropTypes
export const DownloadButtonsPropTypes = {
  gstr1Data: PropTypes.object,
  gstr3bData: PropTypes.object,
  companyGstin: PropTypes.string,
  returnPeriod: PropTypes.string,
  onError: PropTypes.func,
};

// Navbar PropTypes
export const NavbarPropTypes = {
  user: PropTypes.shape({
    name: PropTypes.string,
    email: PropTypes.string,
  }),
  onLogout: PropTypes.func,
};

// ErrorLogPage PropTypes
export const ErrorLogPagePropTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      timestamp: PropTypes.string,
      level: PropTypes.string,
      message: PropTypes.string,
      context: PropTypes.object,
    })
  ),
  onClear: PropTypes.func,
};
