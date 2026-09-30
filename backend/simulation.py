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
        """Run Dijkstra (or use cache) for shortest path based on a specific metric"""
        # Fast path: check cache
        if hasattr(self, "routing_table") and self.routing_table["metric"] == metric:
            return self.get_precomputed_path(source, target)

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

    def precompute_all_paths(self, metric: str = "latency"):
        """
        Runs Floyd-Warshall to precompute shortest paths between all pairs of nodes.
        Returns the execution time and number of pairs computed.
        Caches the result in the engine.
        """
        weight_func = self._build_weight_func(metric)
        
        start_time = time.perf_counter()
        dist, next_node, has_negative_cycle = RoutingAlgorithms.floyd_warshall(self.graph, weight_func)
        end_time = time.perf_counter()

        self.routing_table = {
            "dist": dist,
            "next_node": next_node,
            "metric": metric,
            "has_negative_cycle": has_negative_cycle
        }

        V = len(self.graph.nodes)
        
        # Serialize matrix for frontend (handling float('inf'))
        matrix = {}
        nodes = list(self.graph.nodes.keys())
        for u in nodes:
            matrix[u] = {}
            for v in nodes:
                val = dist[u][v]
                matrix[u][v] = -1.0 if val == float('inf') else round(val, 2)
        
        return {
            "algorithm": "Floyd-Warshall",
            "metric": metric,
            "pairs_computed": V * V,
            "has_negative_cycle": has_negative_cycle,
            "time_ms": (end_time - start_time) * 1000,
            "matrix": matrix,
            "nodes": nodes
        }

    def get_precomputed_path(self, source: str, target: str):
        """
        Retrieves a precomputed path in O(path_length) time.
        """
        if not hasattr(self, "routing_table") or self.routing_table["dist"][source][target] == float('inf'):
            return {"path": [], "cost": -1.0, "time_ms": 0.0}

        path = [source]
        current = source
        visited_check = {source}
        while current != target:
            current = self.routing_table["next_node"][current][target]
            if current is None or current in visited_check:
                # Cycle detected, return valid simple path found so far
                break
            visited_check.add(current)
            path.append(current)

        return {
            "algorithm": "Precomputed Table (O(1) query)",
            "metric": self.routing_table["metric"],
            "path": path,
            "cost": self.routing_table["dist"][source][target],
            "time_ms": 0.0  # Instantaneous cache hit
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
