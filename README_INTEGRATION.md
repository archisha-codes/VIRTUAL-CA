# Virtual CA - GSTR Compliance System

A full-stack GST compliance application with FastAPI backend and React frontend for processing GSTR-1 Excel files and generating GSTR-3B summaries.

## 🚀 Quick Start

### 1. Start the Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start the Frontend

```bash
cd services/frontend

# Install dependencies
npm install

# Start the React development server
npm start
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API Docs**: http://localhost:8000/docs

## 🔐 Demo Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Full access |
| user | user123 | Limited access |

## 📁 Project Structure

```
india-compliance/
├── main.py                    # FastAPI application
├── integration_test.py        # Integration tests
├── requirements.txt           # Python dependencies
├── india_compliance/         # India GST utilities
│   └── gst_india/
│       └── utils/
│           ├── gstr_1/       # GSTR-1 processing
│           │   ├── processor.py
│           │   └── gstr_1_data.py
│           ├── gstr3b/       # GSTR-3B logic
│           │   └── gstr3b_data.py
│           └── gstr_export.py # Excel/JSON exports
└── services/frontend/         # React application
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── UploadPage.jsx
    │   │   ├── SummaryPage.jsx
    │   │   ├── ErrorLogPage.jsx
    │   │   └── DownloadPage.jsx
    │   └── components/
    │       └── Navbar.jsx
    └── package.json
```

## 📊 API Endpoints

### Authentication
- `POST /login` - Get JWT token
- `GET /me` - Get current user info

### File Processing
- `POST /upload-sales-excel` - Upload and process GSTR-1 Excel
- `POST /upload-gstr1-excel` - Alias for upload endpoint

### Downloads
- `GET /download-gstr1-json` - Download GSTR-1 as JSON
- `GET /download-gstr1-excel` - Download GSTR-1 as Excel
- `GET /download-gstr3b-excel` - Download GSTR-3B report
- `GET /gstr1-template-download` - Download Excel template

### Utilities
- `GET /gstr1-template-format` - Get template format specs
- `GET /validation-errors` - Get validation error codes
- `POST /export-errors-csv` - Export validation errors

## 🔌 API Integration

### JavaScript/React

```javascript
import { uploadExcel, downloadGSTR3BExcel, downloadFile } from './api';

// Upload file
const result = await uploadExcel(file);

// Download GSTR-3B
const blob = await downloadGSTR3BExcel();
downloadFile(blob, 'GSTR3B_Report.xlsx');
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Upload Excel
curl -X POST http://localhost:8000/upload-sales-excel \
  -H "Authorization: Bearer <token>" \
  -F "file=@sales_data.xlsx"

# Download GSTR-3B
curl -X GET http://localhost:8000/download-gstr3b-excel \
  -H "Authorization: Bearer <token>" \
  --output gstr3b_report.xlsx
```

## 📋 GSTR-3B Sections

The system generates GSTR-3B summaries for:

- **3.1(a)**: Taxable Outward Supplies (B2B, B2C, CDNR, CDNUR)
- **3.1(b)**: Zero Rated Exports (with/without tax payment)
- **3.1(c)**: Nil Rated, Exempt, and Non-GST Supplies
- **3.1(d)**: Reverse Charge Supplies
- **3.2**: Interstate B2C Supplies (>₹2.5 lakh)

## 🧪 Testing

### Backend Tests

```bash
# Run pytest
pytest tests/ -v

# Run integration tests
python integration_test.py
```

### Frontend Tests

```bash
cd services/frontend
npm test
```

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build
```

## 📝 Validation Rules

The system validates:
- **GSTIN Format**: 15-character valid GSTIN
- **Date Format**: DD/MM/YYYY
- **Tax Rates**: Valid GST rates (0, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28)
- **Place of Supply**: Valid state codes
- **Invoice Values**: Positive numbers only

## 🔒 Security Features

- JWT-based authentication
- Rate limiting (60 requests/minute)
- Audit logging
- API key support
- CORS configuration

## 📄 License

MIT License
