import time
from network_graph import NetworkGraph
from algorithms import RoutingAlgorithms, ComplexityAnalyzer

class SimulationEngine:
    def __init__(self):
        self.graph = NetworkGraph()

    def setup_random_network(self, num_nodes: int = 50, degree: int = 3, topology: str = "average"):
        self.graph = NetworkGraph()
        self.graph.generate_random_network(num_nodes, degree, topology)
        return {"nodes": len(self.graph.nodes), "edges": sum(len(n.links) for n in self.graph.nodes.values()) // 2}

    def setup_custom_network(self, nodes: list, links: list):
        self.graph = NetworkGraph()
        for node in nodes:
            self.graph.add_node(
                node["id"], 
                node.get("type", "default"), 
                node.get("fx", node.get("x")), 
                node.get("fy", node.get("y"))
            )
        
        # In this simplistic version, links might only be passed one-way from the frontend
        # but NetworkGraph handles bidirectional connections in add_edge
        for link in links:
            self.graph.add_edge(
                link["source"],
                link["target"],
                latency=link.get("latency", 10.0),
                bandwidth=link.get("bandwidth", 100.0),
                packet_loss=link.get("packet_loss", 0.0),
                reliability=link.get("reliability", 99.9),
                cost=link.get("cost", 50.0),
                net_credit=link.get("net_credit", 0.0),
                sla_bonus=link.get("sla_bonus", 0.0)
            )
        return {"nodes": len(self.graph.nodes), "edges": sum(len(n.links) for n in self.graph.nodes.values()) // 2}

    def _build_weight_func(self, metric: str):
        def weight_func(features):
            if metric == "latency":
                return features["latency"]
            elif metric == "bandwidth":
                return 1000.0 / features["bandwidth"]
            elif metric == "packet_loss":
                return features["packet_loss"]
            elif metric == "cost":
                return features["cost"]
            elif metric == "net_credit":
                # Network Credit: sponsored/partner links have negative cost (a reward).
                # Lower (more negative) = cheaper to route through. May trigger Bellman-Ford.
                return features.get("net_credit", 0.0)
            elif metric == "sla_bonus":
                # SLA Bonus: SLA-guaranteed links have negative cost (preferred quality).
                # Negative value = routing bonus. May trigger Bellman-Ford.
                return features.get("sla_bonus", 0.0)
            else:
                return features["latency"]
        return weight_func

    def run_routing_simulation(self, source: str, target: str, metric: str = "latency"):
        """Run Dijkstra for shortest path based on a specific metric"""
        weight_func = self._build_weight_func(metric)
        start_time = time.perf_counter()
        path, cost = RoutingAlgorithms.dijkstra(self.graph, source, target, weight_func)
        end_time = time.perf_counter()

        return {
            "algorithm": "Dijkstra",
            "metric": metric,
            "path": path,
            "cost": -1.0 if cost == float('inf') else cost,
            "time_ms": (end_time - start_time) * 1000
        }

    def run_mst_simulation(self, algorithm: str = "kruskal", metric: str = "cost", start_node: str = None):
        """Run Prim or Kruskal for MST based on a specific metric"""
        def weight_func(features):
            return features.get(metric, features["cost"])

        start_time = time.perf_counter()
        if algorithm.lower() == "kruskal":
            mst, cost = RoutingAlgorithms.kruskal(self.graph, weight_func)
        else:
            if not start_node:
                start_node = list(self.graph.nodes.keys())[0]
            mst, cost = RoutingAlgorithms.prim(self.graph, start_node, weight_func)
        end_time = time.perf_counter()

        return {
            "algorithm": algorithm.capitalize(),
            "metric": metric,
            "edges_in_mst": len(mst),
            "mst_edges": mst,
            "total_cost": cost,
            "time_ms": (end_time - start_time) * 1000
        }

    def run_intelligent_routing(self, source: str, target: str, metric: str = "latency"):
        """
        Complexity-Aware Algorithm Selection for shortest path.
        Analyzes the graph, selects the optimal algorithm, runs it, and explains the decision.
        """
        weight_func = self._build_weight_func(metric)

        # Step 1: Analyze the graph
        graph_stats = ComplexityAnalyzer.analyze_graph(self.graph, weight_func)

        # Fast path check: if we already ran Floyd-Warshall for this metric
        if hasattr(self, "routing_table") and self.routing_table["metric"] == metric:
            selection = {
                "selected": "Precomputed Table (Floyd-Warshall)",
                "selected_complexity": "O(1) query",
                "reason": "An all-pairs shortest path table was already precomputed for this metric. Retrieving the result instantly.",
                "rejected": {
                    "Dijkstra": {"reason": "Not needed, table exists"},
                    "Bellman-Ford": {"reason": "Not needed, table exists"}
                }
            }
            res = self.get_precomputed_path(source, target)
            return {
                "mode": "intelligent",
                "metric": metric,
                "path": res["path"],
                "cost": res["cost"],
                "time_ms": res["time_ms"],
                "graph_stats": graph_stats,
                "algorithm_selection": selection,
                "has_negative_cycle": self.routing_table.get("has_negative_cycle", False)
            }

        # Step 2: Select the best algorithm
        selection = ComplexityAnalyzer.select_path_algorithm(graph_stats)

        # Step 3: Run the selected algorithm
        start_time = time.perf_counter()
        if selection["selected"] == "Bellman-Ford":
            path, cost, has_neg_cycle = RoutingAlgorithms.bellman_ford(
                self.graph, source, target, weight_func
            )
        else:  # Dijkstra
            path, cost = RoutingAlgorithms.dijkstra(
                self.graph, source, target, weight_func
            )
            has_neg_cycle = False
        end_time = time.perf_counter()

        return {
            "mode": "intelligent",
            "metric": metric,
            "path": path,
            "cost": -1.0 if cost == float('inf') else cost,
            "time_ms": (end_time - start_time) * 1000,
            "graph_stats": graph_stats,
            "algorithm_selection": selection,
            "has_negative_cycle": has_neg_cycle if selection["selected"] == "Bellman-Ford" else False
        }

    def run_intelligent_mst(self, metric: str = "cost"):
        """
        Complexity-Aware Algorithm Selection for MST.
        Analyzes graph density, selects Kruskal or Prim, runs it, explains the decision.
        """
        def weight_func(features):
            return features.get(metric, features["cost"])

        # Step 1: Analyze graph
        graph_stats = ComplexityAnalyzer.analyze_graph(self.graph, weight_func)

        # Step 2: Select best algorithm
        selection = ComplexityAnalyzer.select_mst_algorithm(graph_stats)

        # Step 3: Run the selected algorithm
        start_time = time.perf_counter()
        if selection["selected"] == "Prim":
            start_node = list(self.graph.nodes.keys())[0]
            mst, cost = RoutingAlgorithms.prim(self.graph, start_node, weight_func)
        else:  # Kruskal
            mst, cost = RoutingAlgorithms.kruskal(self.graph, weight_func)
        end_time = time.perf_counter()

        return {
            "mode": "intelligent",
            "metric": metric,
            "algorithm": selection["selected"],
            "edges_in_mst": len(mst),
            "mst_edges": mst,
            "total_cost": cost,
            "time_ms": (end_time - start_time) * 1000,
            "graph_stats": graph_stats,
            "algorithm_selection": selection
        }



if __name__ == "__main__":
    engine = SimulationEngine()
    print("Setting up network...")
    stats = engine.setup_random_network(30, 3)
    print(stats)

    nodes = list(engine.graph.nodes.keys())

    print("\n--- Intelligent Path ---")
    res = engine.run_intelligent_routing(nodes[0], nodes[-1], "latency")
    print(f"Algorithm: {res['algorithm_selection']['selected']}")
    print(f"Reason: {res['algorithm_selection']['reason']}")
    print(f"Path: {res['path']}, Cost: {res['cost']:.2f}, Time: {res['time_ms']:.3f}ms")

    print("\n--- Intelligent MST ---")
    res2 = engine.run_intelligent_mst("cost")
    print(f"Algorithm: {res2['algorithm_selection']['selected']}")
    print(f"Reason: {res2['algorithm_selection']['reason']}")
    print(f"MST Edges: {res2['edges_in_mst']}, Cost: {res2['total_cost']:.2f}")
