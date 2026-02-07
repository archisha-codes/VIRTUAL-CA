<div align="center">

<h1><a href="https://VIRTUAL-CA.app">VIRTUAL-CA</a></h1>

## Introduction
VIRTUAL-CA
## Key Features

### File GSTR-1 like a Pro

Automated return preparation with intelligent data mapping and error validation

<https://github.com/user-attachments/assets/6c2fed18-cc3a-4b74-8594-e9b71628e07a>

### Smart GST Invoice Management (IMS)

Simplified invoice actions to ensure accurate and efficient GSTR-3B submissions

<https://github.com/user-attachments/assets/650da417-a659-4542-b105-e3e2cf47fffb>

### Other Features

- **Advanced Purchase Reconciliation**
 Maximize ITC claims with automated reconciliation based on GSTR-2B and GSTR-2A

- **E-Invoice & E-Waybill Integration**
  Seamless integration with NIC portal (IRP)

- **Real-time Validation**
  Instant GSTIN verification and document validation against government APIs

- **Intelligent Reporting**
  Pre-built reports for GSTR-1, GSTR-2A/2B reconciliation, and tax liability

## Quick Start

### Installation

For detailed instructions, please [refer to the documentation](https://docs.indiacompliance.app/docs/getting-started/installation)

### In-app Purchases

Some of the automation features available in India Compliance require access to [GST APIs](https://discuss.frappe.io/t/introducing-india-compliance/86335#a-note-on-gst-apis-3). Since there are some costs associated with these APIs, they can be accessed by signing up for an India Compliance Account after installing this app.

## Contributing

- [Issue Guidelines](https://github.com/frappe/erpnext/wiki/Issue-Guidelines)
- [Pull Request Requirements](https://github.com/frappe/erpnext/wiki/Contribution-Guidelines)

## Docker Deployment

The GSTR processing backend can be run in Docker containers.

### Backend Only

```bash
# Build the Docker image
docker build -t virtual-ca .

# Run the container
docker run -p 8000:8000 virtual-ca
```

### Full Stack (Backend + Frontend)

```bash
# Start all services
docker-compose up --build

# Access points:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET_KEY` | JWT signing secret | `your-secret-key-change-in-production` |
| `GST_API_KEY` | API key for authentication | `gst-secret-key-change-in-production` |
| `REACT_APP_API_URL` | Frontend API URL | `http://localhost:8000` |

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

### API Endpoints

Once running, access:
- **Swagger UI**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Upload**: POST http://localhost:8000/upload-sales-excel

### With Custom API Key

```bash
docker run -p 8000:8000 -e GST_API_KEY=your-secure-key virtual-ca
```

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **pandas** - Excel data processing
- **openpyxl** - Excel file handling
- **PyJWT** - JWT authentication

### Frontend
- **React 18** - UI library
- **React Router** - Client-side routing
- **React Toastify** - Notifications
- **Axios** - HTTP client

### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Reverse proxy (production)

## License

This project is licensed under [GNU General Public License (v3)](https://github.com/resilient-tech/india-compliance/blob/develop/license.txt)

<br />
<br />
<div align="center" style="padding-top: 0.75rem;">


<br />
<br />

Empowering Businesses &nbsp;|&nbsp; Simplifying Compliance
</div>
