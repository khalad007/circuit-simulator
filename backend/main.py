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
    isOpen: Optional[bool] = True
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
        return {"led_status": "OFF", "speaker_active": False, "current_mA": 0}

    # Build an undirected adjacency graph from wires (edges)
    graph = defaultdict(list)
    for edge in payload.edges:
        graph[edge.source].append(edge.target)
        graph[edge.target].append(edge.source)

    # Check if any switch in the circuit is OPEN (blocking current)
    for node in payload.nodes:
        if node.type == "switch" and node.data and node.data.isOpen:
            # Switch is OPEN -> circuit broken
            return {"led_status": "OFF", "speaker_active": False, "current_mA": 0}

    # BFS: Find if there's a closed path returning to the battery
    visited = set()
    queue = deque([battery.id])
    circuit_closed = False

    while queue:
        curr = queue.popleft()
        visited.add(curr)

        for neighbor in graph[curr]:
            if neighbor == battery.id and len(visited) > 1:
                circuit_closed = True
            if neighbor not in visited:
                queue.append(neighbor)

    if not circuit_closed:
        return {"led_status": "OFF", "speaker_active": False, "current_mA": 0}

    # Calculate Total Resistance
    resistors = [n for n in payload.nodes if n.type == "resistor" and n.id in visited]
    total_resistance = 0.5 + sum((r.data.resistance or 0) for r in resistors if r.data)

    battery_voltage = battery.data.voltage if battery.data and battery.data.voltage else 9.0
    current_amps = (battery_voltage - 2.0) / max(total_resistance, 0.1)
    current_mA = current_amps * 1000

    # Determine LED state
    led_status = "OFF"
    if any(n.type == "led" for n in payload.nodes if n.id in visited):
        if current_mA > 50:
            led_status = "BLOWN"
        elif current_mA >= 5:
            led_status = "ON"

    speaker_active = any(n.type == "speaker" for n in payload.nodes if n.id in visited)

    return {
        "led_status": led_status,
        "speaker_active": speaker_active,
        "current_mA": round(current_mA, 2)
    }