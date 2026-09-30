from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from simulation import SimulationEngine
import uvicorn

app = FastAPI(title="Intelligent Network Routing API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SimulationEngine()

class NetworkConfig(BaseModel):
    num_nodes: int = 50
    degree: int = 3
    topology: str = "average"

class RoutingRequest(BaseModel):
    source: str
    target: str
    metric: str = "latency"

class MSTRequest(BaseModel):
    algorithm: str = "kruskal"
    metric: str = "cost"
    start_node: str = None

class IntelligentPathRequest(BaseModel):
    source: str
    target: str
    metric: str = "latency"

class IntelligentMSTRequest(BaseModel):
    metric: str = "cost"

class UpdateLinkRequest(BaseModel):
    source: str
    target: str
    latency: float
    bandwidth: float
    packet_loss: float
    reliability: float
    cost: float
    net_credit: float = 0.0
    sla_bonus: float = 0.0

@app.post("/api/network/generate")
def generate_network(config: NetworkConfig):
    stats = engine.setup_random_network(config.num_nodes, config.degree, config.topology)

    nodes = list(engine.graph.nodes.keys())
    links = []
    for node_id, node in engine.graph.nodes.items():
        for link in node.links:
            links.append({
                "source": node_id,
                "target": link.target,
                "features": link.get_features()
            })

    return {
        "stats": stats,
        "graph": {
            "nodes": [{"id": n} for n in nodes],
            "links": links
        }
    }

@app.post("/api/network/update-link")
def update_network_link(req: UpdateLinkRequest):
    if req.source not in engine.graph.nodes or req.target not in engine.graph.nodes:
        raise HTTPException(status_code=404, detail="Source or target node not found")

    engine.graph.update_edge(
        req.source, req.target,
        req.latency, req.bandwidth, req.packet_loss, req.reliability, req.cost,
        req.net_credit, req.sla_bonus
    )
    return {"status": "success"}

@app.post("/api/routing/shortest-path")
def get_shortest_path(req: RoutingRequest):
    if req.source not in engine.graph.nodes or req.target not in engine.graph.nodes:
        raise HTTPException(status_code=404, detail="Source or target node not found")
    result = engine.run_routing_simulation(req.source, req.target, req.metric)
    return result

@app.post("/api/routing/mst")
def get_mst(req: MSTRequest):
    result = engine.run_mst_simulation(req.algorithm, req.metric, req.start_node)
    return result

@app.post("/api/routing/intelligent-path")
def get_intelligent_path(req: IntelligentPathRequest):
    """
    Complexity-Aware Algorithm Selection for shortest path routing.
    Automatically analyzes graph and selects optimal algorithm.
    """
    if req.source not in engine.graph.nodes or req.target not in engine.graph.nodes:
        raise HTTPException(status_code=404, detail="Source or target node not found")
    result = engine.run_intelligent_routing(req.source, req.target, req.metric)
    return result

@app.post("/api/routing/intelligent-mst")
def get_intelligent_mst(req: IntelligentMSTRequest):
    """
    Complexity-Aware Algorithm Selection for MST.
    Automatically selects Kruskal or Prim based on graph density.
    """
    result = engine.run_intelligent_mst(req.metric)
    return result

class PrecomputeRequest(BaseModel):
    metric: str = "latency"

@app.post("/api/routing/precompute")
def precompute_paths(req: PrecomputeRequest):
    """Precompute all shortest paths using Floyd-Warshall."""
    return engine.precompute_all_paths(req.metric)

@app.post("/api/routing/precomputed-path")
def get_cached_path(req: RoutingRequest):
    """Retrieve an already precomputed shortest path in O(1)."""
    if req.source not in engine.graph.nodes or req.target not in engine.graph.nodes:
        raise HTTPException(status_code=404, detail="Source or target node not found")
    return engine.get_precomputed_path(req.source, req.target)

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
