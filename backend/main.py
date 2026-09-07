from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from collections import defaultdict, deque

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.post("/api/simulate")
async def simulate_circuit(payload: CircuitPayload):
    nodes_map = {n.id: n for n in payload.nodes}
    battery = next((n for n in payload.nodes if n.type == "battery"), None)

    if not battery or not payload.edges:
        return {"led_states": {}, "speaker_active": False, "siren_pitch": "LOW", "is_flipflop": False}

    # Check if a Push Button exists and whether it is being held down
    pushbutton = next((n for n in payload.nodes if n.type == "pushbutton"), None)
    btn_pressed = pushbutton.data.isPressed if pushbutton and pushbutton.data else False

    # Check for Open SPST Switches
    for node in payload.nodes:
        if node.type == "switch" and node.data and node.data.isOpen:
            return {"led_states": {}, "speaker_active": False, "siren_pitch": "OFF", "is_flipflop": False}

    # Check if circuit is a 2-Transistor Flip-Flop (Astable Multivibrator)
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

    # Emergency Siren Logic (Push Button + Speaker)
    has_speaker = any(n.type == "speaker" for n in payload.nodes)
    if has_speaker and pushbutton:
        siren_state = "RISING" if btn_pressed else "FALLING"
        return {
            "led_states": {},
            "speaker_active": btn_pressed,
            "siren_pitch": siren_state,
            "is_flipflop": False
        }

    # Standard LED illumination logic
    led_states = {}
    for led in leds:
        led_states[led.id] = "ON"

    return {
        "led_states": led_states,
        "speaker_active": has_speaker,
        "siren_pitch": "OFF",
        "is_flipflop": False
    }