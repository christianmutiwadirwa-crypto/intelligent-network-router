import random
from typing import Dict, List, Tuple

class Link:
    def __init__(self, target: str, latency: float, bandwidth: float,
                 packet_loss: float, reliability: float, cost: float,
                 net_credit: float = 0.0, sla_bonus: float = 0.0):
        self.target = target
        self.latency = latency
        self.bandwidth = bandwidth
        self.packet_loss = packet_loss
        self.reliability = reliability
        self.cost = cost
        # --- Negative-capable metrics ---
        # net_credit: Financial incentive from ISP/CDN partnerships.
        # Negative = routing through this link earns a credit (reduces cost).
        # Range: -8.0 to +5.0
        self.net_credit = net_credit
        # sla_bonus: Quality bonus for links with SLA guarantees.
        # Negative = the link is SLA-preferred and gives a routing bonus.
        # Range: -5.0 to +10.0
        self.sla_bonus = sla_bonus

    def get_features(self) -> dict:
        return {
            "latency": self.latency,
            "bandwidth": self.bandwidth,
            "packet_loss": self.packet_loss,
            "reliability": self.reliability,
            "cost": self.cost,
            "net_credit": self.net_credit,
            "sla_bonus": self.sla_bonus
        }

class Node:
    def __init__(self, node_id: str, node_type: str = "unknown", x: float = None, y: float = None):
        self.node_id = node_id
        self.node_type = node_type
        self.x = x
        self.y = y
        self.links: List[Link] = []

    def add_link(self, target: str, latency: float, bandwidth: float,
                 packet_loss: float, reliability: float, cost: float,
                 net_credit: float = 0.0, sla_bonus: float = 0.0):
        self.links.append(Link(target, latency, bandwidth, packet_loss,
                               reliability, cost, net_credit, sla_bonus))

class NetworkGraph:
    def __init__(self):
        self.nodes: Dict[str, Node] = {}

    def add_node(self, node_id: str, node_type: str = "unknown", x: float = None, y: float = None):
        if node_id not in self.nodes:
            self.nodes[node_id] = Node(node_id, node_type, x, y)
        else:
            if node_type != "unknown":
                self.nodes[node_id].node_type = node_type
            if x is not None:
                self.nodes[node_id].x = x
            if y is not None:
                self.nodes[node_id].y = y

    def add_edge(self, source: str, target: str, latency: float, bandwidth: float,
                 packet_loss: float, reliability: float, cost: float,
                 net_credit: float = 0.0, sla_bonus: float = 0.0,
                 bidirectional: bool = True):
        self.add_node(source)
        self.add_node(target)
        self.nodes[source].add_link(target, latency, bandwidth, packet_loss,
                                    reliability, cost, net_credit, sla_bonus)
        if bidirectional:
            self.nodes[target].add_link(source, latency, bandwidth, packet_loss,
                                        reliability, cost, net_credit, sla_bonus)

    def update_edge(self, source: str, target: str, latency: float, bandwidth: float,
                    packet_loss: float, reliability: float, cost: float,
                    net_credit: float = 0.0, sla_bonus: float = 0.0,
                    bidirectional: bool = True):
        for link in self.nodes[source].links:
            if link.target == target:
                link.latency = latency
                link.bandwidth = bandwidth
                link.packet_loss = packet_loss
                link.reliability = reliability
                link.cost = cost
                link.net_credit = net_credit
                link.sla_bonus = sla_bonus
                break
        if bidirectional:
            for link in self.nodes[target].links:
                if link.target == source:
                    link.latency = latency
                    link.bandwidth = bandwidth
                    link.packet_loss = packet_loss
                    link.reliability = reliability
                    link.cost = cost
                    link.net_credit = net_credit
                    link.sla_bonus = sla_bonus
                    break

    def _random_edge_features(self):
        """Generate a full set of edge features including negative-capable metrics."""
        return {
            "latency": random.uniform(5.0, 100.0),
            "bandwidth": random.uniform(10.0, 1000.0),
            "packet_loss": random.uniform(0.0, 0.05),
            "reliability": random.uniform(0.95, 0.9999),
            "cost": random.uniform(1.0, 10.0),
            # ~40% of links will have a negative net_credit (sponsored/partner links)
            "net_credit": random.uniform(-8.0, 5.0),
            # ~30% of links will have a negative sla_bonus (SLA-guaranteed preferred links)
            "sla_bonus": random.uniform(-5.0, 10.0),
        }

    def generate_random_network(self, num_nodes: int, degree: int = 3, topology: str = "average"):
        """Generates a random network topology with all edge metrics."""
        self.nodes = {}
        for i in range(num_nodes):
            self.add_node(f"R{i}")

        nodes = list(self.nodes.keys())

        if topology == "realistic":
            # 1. Spanning tree to guarantee connectivity
            unvisited = set(nodes[1:])
            visited = [nodes[0]]

            while unvisited:
                current = random.choice(visited)
                if len(self.nodes[current].links) >= 4:
                    continue
                target = random.sample(list(unvisited), 1)[0]
                unvisited.remove(target)
                visited.append(target)
                f = self._random_edge_features()
                self.add_edge(current, target, f["latency"], f["bandwidth"],
                              f["packet_loss"], f["reliability"], f["cost"],
                              f["net_credit"], f["sla_bonus"])

            # 2. Add random redundant links, max degree 4
            num_redundant = num_nodes // 2
            attempts = 0
            while num_redundant > 0 and attempts < num_nodes * 10:
                attempts += 1
                u = random.choice(nodes)
                v = random.choice(nodes)
                if u != v and not any(link.target == v for link in self.nodes[u].links):
                    if len(self.nodes[u].links) < 4 and len(self.nodes[v].links) < 4:
                        f = self._random_edge_features()
                        self.add_edge(u, v, f["latency"], f["bandwidth"],
                                      f["packet_loss"], f["reliability"], f["cost"],
                                      f["net_credit"], f["sla_bonus"])
                        num_redundant -= 1

        else:  # average (Preferential / Barabasi-Albert style)
            for node in nodes:
                targets = random.sample([n for n in nodes if n != node], min(degree, len(nodes) - 1))
                for target in targets:
                    if not any(link.target == target for link in self.nodes[node].links):
                        f = self._random_edge_features()
                        self.add_edge(node, target, f["latency"], f["bandwidth"],
                                      f["packet_loss"], f["reliability"], f["cost"],
                                      f["net_credit"], f["sla_bonus"])
