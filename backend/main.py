from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

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
    status: Optional[str] = "OFF"

class NodeItem(BaseModel):
    id: str
    type: str
    data: Optional[NodeData] = None

class Edge(BaseModel):
    source: str
    target: str
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None

class CircuitPayload(BaseModel):
    nodes: List[NodeItem]
    edges: List[Edge]

@app.post("/api/simulate")
async def simulate_circuit(payload: CircuitPayload):
    # Find components
    battery = next((n for n in payload.nodes if n.type == "battery"), None)
    led = next((n for n in payload.nodes if n.type == "led"), None)
    resistors = [n for n in payload.nodes if n.type == "resistor"]

    if not battery or not led:
        return {"led_status": "OFF", "current_mA": 0}

    # Check if a circuit loop exists through edges
    has_pos_wire = any(e.sourceHandle == "pos" or e.targetHandle == "pos" for e in payload.edges)
    has_neg_wire = any(e.sourceHandle == "neg" or e.targetHandle == "neg" for e in payload.edges)

    if not (has_pos_wire and has_neg_wire):
        return {"led_status": "OFF", "current_mA": 0}

    # Calculate Total Resistance in circuit loop
    # Base wire internal resistance = 0.5 Ohms
    total_resistance = 0.5 + sum((r.data.resistance or 0) for r in resistors if r.data)
    
    battery_voltage = battery.data.voltage if battery.data and battery.data.voltage else 9.0
    led_forward_voltage = 2.0  # Standard LED voltage drop

    # Ohm's Law: I = (V_batt - V_led) / R
    if battery_voltage <= led_forward_voltage:
        return {"led_status": "OFF", "current_mA": 0}

    current_amps = (battery_voltage - led_forward_voltage) / total_resistance
    current_mA = current_amps * 1000

    # Determine LED state based on current (mA)
    # Safe range for typical LED: 5mA to 45mA. Above 50mA burns/blasts it out!
    if current_mA > 50:
        status = "BLOWN"
    elif current_mA >= 5:
        status = "ON"
    else:
        status = "OFF"

    return {"led_status": status, "current_mA": round(current_mA, 2)}