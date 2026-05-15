import sys
import os

# Add the current directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base, SessionLocal
from models.tenant_models import User, Workspace, WorkspaceMember, Business, UserRole
from models.gst_models import GSTR1_Document, GSTR2B_Document, GSTR3B_Draft, Announcement
from datetime import datetime, date

def init_db():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")

def seed_data():
    db = SessionLocal()
    try:
        # Check if we already have data
        if db.query(User).count() > 0:
            print("Users already exist. Skipping user seed.")
        else:
            print("Seeding users...")
            admin = User(
                email="admin@example.com",
                full_name="Admin User",
                hashed_password="admin123-hashed", # Placeholder
                is_active=True
            )
            # In a real app, we'd hash this. For now, we'll just store it 
            # and ensure our auth logic can handle it or we use the mock login for now.
            # But the dependencies query the DB by email.
            db.add(admin)
            db.commit()
            db.refresh(admin)

            # Create a demo workspace for this user
            ws = Workspace(name="Default CA Firm", created_by=admin.id)
            db.add(ws)
            db.commit()
            db.refresh(ws)

            # Add membership
            member = WorkspaceMember(workspace_id=ws.id, user_id=admin.id, role=UserRole.OWNER)
            db.add(member)
            db.commit()

        if db.query(Announcement).count() > 0:
            print("Announcements already seeded.")
            return

        print("Seeding announcements...")
        # ... (rest of the announcements)
        
        # Add sample announcements
        announcements = [
            Announcement(
                title="GSTN Advisory: New GSTR-1 IFF Facility",
                content="Taxpayers can now use the Invoice Furnishing Facility (IFF) for the first two months of a quarter.",
                category="compliance",
                link="https://www.gst.gov.in/newsandupdates/read/650",
                date=date(2026, 3, 5)
            ),
            Announcement(
                title="Interest Calculation Mechanism in GSTR-3B",
                content="System-calculated interest will now be auto-populated in GSTR-3B based on delayed filing.",
                category="filing",
                link="https://www.gst.gov.in/newsandupdates/read/649",
                date=date(2026, 3, 3)
            ),
            Announcement(
                title="GST Portal Maintenance",
                content="The GST portal will be down for scheduled maintenance on 15th May 2026.",
                category="maintenance",
                link="https://www.gst.gov.in/newsandupdates/read/648",
                date=date(2026, 2, 28)
            )
        ]
        db.add_all(announcements)
        
        # Add a demo user and workspace if they don't exist
        # Note: We use fixed IDs to match the frontend "demo acc" if possible
        # but let's just create a fresh one.
        
        db.commit()
        print("Initial data seeded successfully.")
    except Exception as e:
        print(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    seed_data()
