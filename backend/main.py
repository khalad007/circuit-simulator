import os
import json
import logging
from pathlib import Path
from google import genai
from google.genai import errors, types
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

load_dotenv(Path(__file__).resolve().parent / ".env")

api_key = os.getenv("GEMINI_API_KEY", "").strip()
gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash").strip() or "gemini-3.5-flash"
client = genai.Client(api_key=api_key) if api_key else None
logger = logging.getLogger(__name__)


def generate_content(**kwargs):
    if client is None:
        raise HTTPException(503, "GEMINI_API_KEY is missing. Set it in backend/.env and restart the backend.")
    try:
        return client.models.generate_content(model=gemini_model, **kwargs)
    except errors.APIError as exc:
        # Do not return or log raw provider errors, which can contain credentials.
        logger.warning("Gemini request failed with status %s", exc.code)
        message = (exc.message or "").lower()
        if exc.code in (401, 403) or (exc.code == 400 and "api key" in message):
            detail = "Gemini rejected the API key or its permissions. Check your Google AI Studio key in backend/.env, then restart the backend."
        elif exc.code == 404:
            detail = f"Gemini model '{gemini_model}' is unavailable. Set GEMINI_MODEL in backend/.env to a model available to your project, then restart the backend."
        elif exc.code == 429:
            detail = "Gemini quota or rate limit exceeded. Check your project's quota and billing in Google AI Studio, or try again later."
        else:
            detail = f"Gemini could not complete the request (provider status {exc.code}). Check your project configuration or try again later."
        raise HTTPException(429 if exc.code == 429 else 502, detail) from exc
    except Exception as exc:
        logger.warning("Gemini request failed (%s)", type(exc).__name__)
        raise HTTPException(502, "Could not reach Gemini. Check the backend's internet connection and try again.") from exc

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AIPromptPayload(BaseModel):
    prompt: str

class NodeData(BaseModel):
    voltage: Optional[float] = 9.0
    resistance: Optional[float] = 0.0
    capacitance: Optional[float] = 10.0
    isOpen: Optional[bool] = True
    isPressed: Optional[bool] = False
    lightLevel: Optional[float] = 50.0
    status: Optional[str] = "OFF"

class NodeItem(BaseModel):
    id: str
    type: str
    data: Optional[NodeData] = None

class Edge(BaseModel):
    id: str
    source: str
    target: str

class CircuitPayload(BaseModel):
    nodes: List[NodeItem]
    edges: List[Edge]

# ==================== CIRCUIT SIMULATOR ROUTE ====================
@app.post("/api/simulate")
async def simulate_circuit(payload: CircuitPayload):
    battery = next((n for n in payload.nodes if n.type == "battery"), None)

    if not battery or not payload.edges:
        return {"led_states": {}, "speaker_active": False, "siren_pitch": "OFF", "is_flipflop": False}

    pushbutton = next((n for n in payload.nodes if n.type == "pushbutton"), None)
    btn_pressed = pushbutton.data.isPressed if pushbutton and pushbutton.data else False

    for node in payload.nodes:
        if node.type == "switch" and node.data and node.data.isOpen:
            return {"led_states": {}, "speaker_active": False, "siren_pitch": "OFF", "is_flipflop": False}

    transistors = [n for n in payload.nodes if n.type == "transistor"]
    capacitors = [n for n in payload.nodes if n.type == "capacitor"]
    leds = [n for n in payload.nodes if n.type == "led"]

    is_flipflop = len(transistors) >= 2 and len(capacitors) >= 2 and len(leds) >= 2

    if is_flipflop:
        return {
            "led_states": {leds[0].id: "ON", leds[1].id: "OFF"},
            "speaker_active": False,
            "siren_pitch": "OFF",
            "is_flipflop": True
        }

    has_speaker = any(n.type == "speaker" for n in payload.nodes)
    if has_speaker and pushbutton:
        siren_state = "RISING" if btn_pressed else "FALLING"
        return {
            "led_states": {},
            "speaker_active": btn_pressed,
            "siren_pitch": siren_state,
            "is_flipflop": False
        }

    led_states = {led.id: "ON" for led in leds}

    return {
        "led_states": led_states,
        "speaker_active": has_speaker,
        "siren_pitch": "OFF",
        "is_flipflop": False
    }

# ==================== AI GENERATOR ROUTE ====================
@app.post("/api/ai/generate")
def generate_circuit_ai(payload: AIPromptPayload):
    try:
        system_prompt = """
        You are an expert circuit engineer. Convert the user's description into a circuit layout for React Flow.
        Allowed node types: 'battery', 'resistor', 'led', 'switch', 'pushbutton', 'capacitor', 'transistor', 'speaker', 'ldr'.
        
        Rules:
        1. Each node must have a unique string id (e.g. "b1", "led1").
        2. Coordinates x (100 to 600) and y (100 to 400).
        3. Edges connect sourceHandle ('pos' or 'neg') to targetHandle ('pos' or 'neg').
        
        Return ONLY a raw JSON object with this exact structure:
        {
          "nodes": [
            {"id": "b1", "type": "battery", "position": {"x": 100, "y": 150}, "data": {"voltage": 9}},
            {"id": "led1", "type": "led", "position": {"x": 350, "y": 150}, "data": {}}
          ],
          "edges": [
            {"id": "e1", "source": "b1", "sourceHandle": "pos", "target": "led1", "targetHandle": "pos"},
            {"id": "e2", "source": "b1", "sourceHandle": "neg", "target": "led1", "targetHandle": "neg"}
          ]
        }
        """

        response = generate_content(
            contents=f"{system_prompt}\nUser Prompt: {payload.prompt}",
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        circuit = json.loads(response.text or "")
        if not isinstance(circuit, dict) or not isinstance(circuit.get("nodes"), list) or not isinstance(circuit.get("edges"), list):
            raise ValueError("Missing circuit nodes or edges")
        return circuit
    except (ValueError, TypeError) as exc:
        raise HTTPException(502, "Gemini returned an invalid circuit. Try generating it again.") from exc

# ==================== AI DOCTOR ROUTE ====================
@app.post("/api/ai/analyze")
def analyze_circuit_ai(payload: CircuitPayload):
    prompt = f"""
        Analyze this electronic circuit schematic.
        Nodes: {payload.nodes}
        Edges: {payload.edges}
        
        Explain in 2-3 short, clear sentences whether this circuit functions properly, has a short circuit, or missing connections. Keep it concise for a beginner student.
        """

    response = generate_content(contents=prompt)
    if not response.text or not response.text.strip():
        raise HTTPException(502, "Gemini returned an empty analysis. Try again.")
    return {"analysis": response.text.strip()}
