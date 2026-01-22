from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from services.triage.app import app as triage_app
from services.research.app import app as research_app
from services.review.app import app as review_app
from services.presentation.app import app as presentation_app

app = FastAPI(title="A2A Unified Backend")

# Global CORS Policy - One Origin to Rule Them All
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount individual agents as sub-applications
# Each agent keeps its own routes but shares the port
app.mount("/triage", triage_app)
app.mount("/research", research_app)
app.mount("/review", review_app)
app.mount("/presentation", presentation_app)

@app.get("/")
def root():
    return {"status": "A2A Unified Backend Running"}
