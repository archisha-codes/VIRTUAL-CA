# <div align="center">

<h1><a href="https://VIRTUAL-CA.app">VIRTUAL-CA</a></h1>

</div>

## Introduction
VIRTUAL-CA is a modern, premium web application for GST compliance, offering a seamless experience for GSTR-1 preparation, filing, and reporting.

## Key Features

### File GSTR-1 like a Pro
![Feature Image 1](./assets/feature1.png)

Automated return preparation with intelligent data mapping and error validation.

### Smart GST Invoice Management (IMS)
![Feature Image 2](./assets/feature2.png)

Simplified invoice actions to ensure accurate and efficient GSTR-3B submissions.

### Other Features
- **Advanced Purchase Reconciliation** – Maximize ITC claims with automated reconciliation based on GSTR‑2B and GSTR‑2A.
- **E‑Invoice & E‑Waybill Integration** – Seamless integration with NIC portal (IRP).
- **Real‑time Validation** – Instant GSTIN verification and document validation against government APIs.
- **Intelligent Reporting** – Pre‑built reports for GSTR‑1, GSTR‑2A/2B reconciliation, and tax liability.

## Quick Start

### Installation

1. Clone the repository.
2. Ensure Docker and Docker‑Compose are installed.
3. Set up environment variables (see below).

### Run with Docker (Full Stack)
```bash
# Build and start all services
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

### Run Backend Only
```bash
# Build the Docker image for the backend
docker build -t virtual-ca ./backend

# Run the container
docker run -p 8000:8000 virtual-ca
```

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET_KEY` | JWT signing secret | `your-secret-key-change-in-production` |
| `GST_API_KEY` | API key for authentication | `gst-secret-key-change-in-production` |
| `DATABASE_URL` | Database connection URL | `sqlite:///./test.db` |

### Frontend (`frontend/.env`)
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000` |
| `VITE_STRIPE_KEY` | Stripe publishable key (used for UI only) | `your_actual_key_here` |

Create the `.env` files from the examples:
```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

## API Endpoints
Once the services are running, you can access:
- **Swagger UI**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`
- **Upload**: `POST http://localhost:8000/upload-sales-excel`

## Tech Stack

### Backend
- **FastAPI** – Modern Python web framework
- **pandas** – Excel data processing
- **openpyxl** – Excel file handling
- **PyJWT** – JWT authentication

### Frontend
- **React 18** – UI library
- **React Router** – Client‑side routing
- **React Toastify** – Notifications
- **Axios** – HTTP client

## DevOps
- **Docker** – Containerization
- **Docker Compose** – Multi‑container orchestration
- **Nginx** – Reverse proxy (production)

## Contributing
- [Issue Guidelines](https://github.com/frappe/erpnext/wiki/Issue-Guidelines)
- [Pull Request Requirements](https://github.com/frappe/erpnext/wiki/Contribution-Guidelines)

## License
This project is licensed under the [GNU General Public License (v3)](https://github.com/resilient-tech/india-compliance/blob/develop/license.txt).

<div align="center" style="padding-top: 0.75rem;">

<br/>
<br/>
Empowering Businesses&nbsp;|&nbsp;Simplifying Compliance

</div>
