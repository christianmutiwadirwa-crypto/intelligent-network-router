import heapq
import math
from typing import Dict, List, Tuple, Callable
from network_graph import NetworkGraph, Node

class RoutingAlgorithms:
    @staticmethod
    def dijkstra(graph: NetworkGraph, source_id: str, target_id: str, weight_func: Callable[[dict], float]) -> Tuple[List[str], float]:
        """
        Finds the shortest path from source to target using Dijkstra's algorithm.
        Complexity: O((V + E) log V)
        Only valid for non-negative edge weights.
        """
        if source_id not in graph.nodes or target_id not in graph.nodes:
            return [], float('inf')

        distances = {node: float('inf') for node in graph.nodes}
        distances[source_id] = 0
        paths = {node: [] for node in graph.nodes}
        paths[source_id] = [source_id]
        pq = [(0, source_id)]

        while pq:
            current_dist, current_node = heapq.heappop(pq)
            if current_node == target_id:
                break
            if current_dist > distances[current_node]:
                continue
            for link in graph.nodes[current_node].links:
                neighbor = link.target
                weight = weight_func(link.get_features())
                distance = current_dist + weight
                if distance < distances[neighbor]:
                    # Cycle avoidance for simple paths
                    if neighbor not in paths[current_node]:
                        distances[neighbor] = distance
                        paths[neighbor] = paths[current_node] + [neighbor]
                        heapq.heappush(pq, (distance, neighbor))

        final_path = paths[target_id]
        if final_path and final_path[0] == source_id and final_path[-1] == target_id:
            return final_path, distances[target_id]
        return [], float('inf')

    @staticmethod
    def bellman_ford(graph: NetworkGraph, source_id: str, target_id: str, weight_func: Callable[[dict], float]) -> Tuple[List[str], float, bool]:
        """
        Finds the shortest path using Bellman-Ford algorithm.
        Handles negative edge weights and detects negative cycles.
        Complexity: O(V * E)
        Returns: (path, cost, has_negative_cycle)
        """
        if source_id not in graph.nodes or target_id not in graph.nodes:
            return [], float('inf'), False

        V = len(graph.nodes)
        distances = {node: float('inf') for node in graph.nodes}
        distances[source_id] = 0
        paths = {node: [] for node in graph.nodes}
        paths[source_id] = [source_id]

        # Collect all directed edges
        edges = []
        for node_id, node in graph.nodes.items():
            for link in node.links:
                w = weight_func(link.get_features())
                edges.append((node_id, link.target, w))

        # Relax edges V-1 times
        for _ in range(V - 1):
            updated = False
            for u, v, w in edges:
                if distances[u] != float('inf') and distances[u] + w < distances[v]:
                    # Prevent loops for simple path
                    if v not in paths[u]:
                        distances[v] = distances[u] + w
                        paths[v] = paths[u] + [v]
                        updated = True
            if not updated:
                break

        # Check for negative cycles
        has_negative_cycle = False
        for u, v, w in edges:
            if distances[u] != float('inf') and distances[u] + w < distances[v]:
                if v not in paths[u]:
                    has_negative_cycle = True
                    break

        final_path = paths[target_id]
        if final_path and final_path[0] == source_id and final_path[-1] == target_id:
            return final_path, distances[target_id], has_negative_cycle
        return [], float('inf'), has_negative_cycle

    @staticmethod
    def kruskal(graph: NetworkGraph, weight_func: Callable[[dict], float]) -> Tuple[List[Tuple[str, str, float]], float]:
        """
        Finds Minimum Spanning Tree using Kruskal's algorithm.
        Complexity: O(E log E) — best for sparse graphs
        """
        edges = []
        seen_edges = set()
        for node_id, node in graph.nodes.items():
            for link in node.links:
                u, v = node_id, link.target
                edge_id = tuple(sorted([u, v]))
                if edge_id not in seen_edges:
                    seen_edges.add(edge_id)
                    weight = weight_func(link.get_features())
                    edges.append((weight, u, v))

        edges.sort()

        parent = {node: node for node in graph.nodes}
        rank = {node: 0 for node in graph.nodes}

        def find(i):
            if parent[i] == i:
                return i
            parent[i] = find(parent[i])
            return parent[i]

        def union(i, j):
            root_i = find(i)
            root_j = find(j)
            if rank[root_i] < rank[root_j]:
                parent[root_i] = root_j
            elif rank[root_i] > rank[root_j]:
                parent[root_j] = root_i
            else:
                parent[root_j] = root_i
                rank[root_i] += 1

        mst = []
        total_cost = 0
        for weight, u, v in edges:
            if find(u) != find(v):
                union(u, v)
                mst.append((u, v, weight))
                total_cost += weight

        return mst, total_cost

    @staticmethod
    def floyd_warshall(graph: NetworkGraph, weight_func: Callable[[dict], float]) -> Tuple[Dict[str, Dict[str, float]], Dict[str, Dict[str, str]], bool]:
        """
        Finds shortest paths between all pairs of nodes using Floyd-Warshall algorithm.
        Complexity: O(V^3)
        Returns: (distances, next_node, has_negative_cycle)
        """
        nodes = list(graph.nodes.keys())
        V = len(nodes)
        
        # Initialize distance matrix with infinity and next matrix with None
        dist = {u: {v: float('inf') for v in nodes} for u in nodes}
        next_node = {u: {v: None for v in nodes} for u in nodes}

        # Distance to self is 0
        for u in nodes:
            dist[u][u] = 0.0
            next_node[u][u] = u

        # Add all edges to distance matrix
        for u, node in graph.nodes.items():
            for link in node.links:
                v = link.target
                w = weight_func(link.get_features())
                # If there are multiple edges, keep the minimum (though not applicable in our simple graph)
                if w < dist[u][v]:
                    dist[u][v] = w
                    next_node[u][v] = v

        # Floyd-Warshall core
        for k in nodes:
            for i in nodes:
                for j in nodes:
                    if dist[i][k] != float('inf') and dist[k][j] != float('inf'):
                        if dist[i][k] + dist[k][j] < dist[i][j]:
                            dist[i][j] = dist[i][k] + dist[k][j]
                            next_node[i][j] = next_node[i][k]

        # Check for negative cycles
        has_negative_cycle = False
        for i in nodes:
            if dist[i][i] < 0:
                has_negative_cycle = True
                break

        return dist, next_node, has_negative_cycle

    @staticmethod
    def prim(graph: NetworkGraph, start_node_id: str, weight_func: Callable[[dict], float]) -> Tuple[List[Tuple[str, str, float]], float]:
        """
        Finds Minimum Spanning Tree using Prim's algorithm.
        Complexity: O(E log V) with priority queue — best for dense graphs
        """
        if start_node_id not in graph.nodes:
            return [], 0.0

        mst = []
        visited = {start_node_id}
        total_cost = 0
        pq = []

        for link in graph.nodes[start_node_id].links:
            weight = weight_func(link.get_features())
            heapq.heappush(pq, (weight, start_node_id, link.target))

        while pq and len(visited) < len(graph.nodes):
            weight, u, v = heapq.heappop(pq)
            if v not in visited:
                visited.add(v)
                mst.append((u, v, weight))
                total_cost += weight
                for link in graph.nodes[v].links:
                    if link.target not in visited:
                        next_weight = weight_func(link.get_features())
                        heapq.heappush(pq, (next_weight, v, link.target))

        return mst, total_cost


class ComplexityAnalyzer:
    """
    Analyzes graph structural properties and selects the optimal algorithm.
    This is the 'intelligent' core of the system — Complexity-Aware Algorithm Selection.
    """

    @staticmethod
    def analyze_graph(graph: NetworkGraph, weight_func: Callable[[dict], float]) -> dict:
        """Compute structural properties of the graph"""
        V = len(graph.nodes)

        seen = set()
        E = 0
        has_negative_weights = False
        for node_id, node in graph.nodes.items():
            for link in node.links:
                eid = tuple(sorted([node_id, link.target]))
                if eid not in seen:
                    seen.add(eid)
                    E += 1
                    w = weight_func(link.get_features())
                    if w < 0:
                        has_negative_weights = True

        max_possible_edges = V * (V - 1) / 2 if V > 1 else 1
        density = E / max_possible_edges
        avg_degree = (2 * E) / V if V > 0 else 0

        return {
            "V": V,
            "E": E,
            "density": round(density, 4),
            "avg_degree": round(avg_degree, 2),
            "has_negative_weights": has_negative_weights,
            "max_possible_edges": int(max_possible_edges)
        }

    @staticmethod
    def select_path_algorithm(graph_stats: dict) -> dict:
        """Select and explain the best shortest-path algorithm for this graph."""
        V = graph_stats["V"]
        E = graph_stats["E"]
        density = graph_stats["density"]
        has_neg = graph_stats["has_negative_weights"]

        dijkstra_ops = int((V + E) * math.log2(V + 1))
        bellman_ford_ops = V * E

        if has_neg:
            selected = "Bellman-Ford"
            reason = (
                f"Negative edge weights detected in graph. "
                f"Dijkstra's algorithm is INVALID — it may produce incorrect paths on negative-weight graphs. "
                f"Bellman-Ford is the only correct algorithm for this topology."
            )
            rejected = {
                "Dijkstra": {
                    "ops": dijkstra_ops,
                    "complexity": "O((V+E)logV)",
                    "reason": "INVALID on negative-weight graphs"
                }
            }
        else:
            selected = "Dijkstra"
            speedup = bellman_ford_ops / max(dijkstra_ops, 1)
            reason = (
                f"All edge weights are positive. Graph density = {density:.2%} ({E} edges, {V} nodes). "
                f"Dijkstra O((V+E)logV) ≈ {dijkstra_ops:,} operations. "
                f"Bellman-Ford O(V·E) ≈ {bellman_ford_ops:,} operations. "
                f"Dijkstra is {speedup:.1f}x faster — selected."
            )
            rejected = {
                "Bellman-Ford": {
                    "ops": bellman_ford_ops,
                    "complexity": "O(V·E)",
                    "reason": f"Unnecessary overhead: {bellman_ford_ops:,} ops vs {dijkstra_ops:,} ops for positive-weight graph"
                }
            }

        return {
            "selected": selected,
            "reason": reason,
            "selected_complexity": "O((V+E)logV)" if selected == "Dijkstra" else "O(V·E)",
            "selected_ops": dijkstra_ops if selected == "Dijkstra" else bellman_ford_ops,
            "rejected": rejected
        }

    @staticmethod
    def select_mst_algorithm(graph_stats: dict) -> dict:
        """Select and explain the best MST algorithm for this graph."""
        V = graph_stats["V"]
        E = graph_stats["E"]
        density = graph_stats["density"]

        kruskal_ops = int(E * math.log2(E + 1))
        prim_ops = int((V + E) * math.log2(V + 1))

        if density < 0.3:
            selected = "Kruskal"
            speedup = prim_ops / max(kruskal_ops, 1)
            reason = (
                f"Sparse graph (density={density:.2%}). "
                f"Fewer edges means edge-sorting is cheap. "
                f"Kruskal O(E·logE) ≈ {kruskal_ops:,} ops vs Prim O(E·logV) ≈ {prim_ops:,} ops. "
                f"Kruskal is {speedup:.1f}x faster — selected."
            )
            rejected = {
                "Prim": {
                    "ops": prim_ops,
                    "complexity": "O(E·logV)",
                    "reason": f"Priority queue overhead unnecessary on sparse graph: {prim_ops:,} ops vs {kruskal_ops:,} ops"
                }
            }
        else:
            selected = "Prim"
            speedup = kruskal_ops / max(prim_ops, 1)
            reason = (
                f"Dense graph (density={density:.2%}). "
                f"Sorting all {E} edges for Kruskal becomes expensive. "
                f"Prim O(E·logV) ≈ {prim_ops:,} ops vs Kruskal O(E·logE) ≈ {kruskal_ops:,} ops. "
                f"Prim is {speedup:.1f}x faster — selected."
            )
            rejected = {
                "Kruskal": {
                    "ops": kruskal_ops,
                    "complexity": "O(E·logE)",
                    "reason": f"Sorting {E} edges too expensive on dense graph: {kruskal_ops:,} ops vs {prim_ops:,} ops"
                }
            }

        return {
            "selected": selected,
            "reason": reason,
            "selected_complexity": "O(E·logE)" if selected == "Kruskal" else "O(E·logV)",
            "selected_ops": kruskal_ops if selected == "Kruskal" else prim_ops,
            "rejected": rejected
        }
