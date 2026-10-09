import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Network, GitGraph, Zap, Play, Settings, MousePointerClick, X, Brain, ChevronRight } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';
import './index.css';
import Builder from './Builder';
import { routerImg, pcImg } from './device-icons';

const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:8000/api';

function App() {
  const [networkStats, setNetworkStats] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [page, setPage] = useState('simulator');
  const [topologySource, setTopologySource] = useState('default');
  const [loading, setLoading] = useState(false);
  const [nodeCount, setNodeCount] = useState(30);
  const [degree, setDegree] = useState(3);
  const [topology, setTopology] = useState('average');
  
  const [sourceNode, setSourceNode] = useState(null);
  const [targetNode, setTargetNode] = useState(null);

  const [routingResult, setRoutingResult] = useState(null);
  const [mstResult, setMstResult] = useState(null);
  const [metric, setMetric] = useState('latency');
  const [showWeights, setShowWeights] = useState('none');
  const [intelligentResult, setIntelligentResult] = useState(null);
  const [toast, setToast] = useState(null);
  const graphRef = useRef();

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 6000);
  };

  // Edge editing state
  const [editingLink, setEditingLink] = useState(null);
  const [linkEditForm, setLinkEditForm] = useState({ latency: 0, bandwidth: 0, packet_loss: 0, reliability: 0, cost: 0, net_credit: 0, sla_bonus: 0 });
  const [isUpdatingLink, setIsUpdatingLink] = useState(false);

  // Animation state
  const [activePathEdgeIndex, setActivePathEdgeIndex] = useState(-1);
  const [isExploring, setIsExploring] = useState(false);

  useEffect(() => {
    if (routingResult && routingResult.path && routingResult.path.length > 1) {
      setActivePathEdgeIndex(0);
      setIsExploring(true);
      let step = 0;
      let exploring = true;
      
      const interval = setInterval(() => {
        if (exploring) {
          exploring = false;
          setIsExploring(false);
        } else {
          step++;
          if (step >= routingResult.path.length - 1) {
            clearInterval(interval);
          } else {
            exploring = true;
            setIsExploring(true);
            setActivePathEdgeIndex(step);
          }
        }
      }, 700); // 700ms to explore, 700ms to lock in
      return () => clearInterval(interval);
    } else {
      setActivePathEdgeIndex(-1);
      setIsExploring(false);
    }
  }, [routingResult]);

  const generateNetwork = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/network/generate`, {
        num_nodes: parseInt(nodeCount),
        degree: parseInt(degree),
        topology: topology
      });
      setNetworkStats(res.data.stats);
      setGraphData(res.data.graph);
      setTopologySource('default');
      setRoutingResult(null);
      setMstResult(null);
      setIntelligentResult(null);
      setSourceNode(null);
      setTargetNode(null);
      setEditingLink(null);
      
      // Auto zoom to fit after generating
      setTimeout(() => {
        if(graphRef.current) graphRef.current.zoomToFit(400, 20);
      }, 500);
      
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    generateNetwork();
  }, []);

  const runShortestPath = async () => {
    if (!sourceNode || !targetNode) {
      showToast('Please select a Source and Target node by clicking on the graph.');
      return;
    }
    setLoading(true);
    try {
      // For metrics that can have negative weights, route through intelligent endpoint
      // which automatically selects Bellman-Ford when needed
      const negativeMetrics = ['net_credit', 'sla_bonus'];
      const endpoint = negativeMetrics.includes(metric)
        ? `${API_BASE}/routing/intelligent-path`
        : `${API_BASE}/routing/shortest-path`;

      const res = await axios.post(endpoint, {
        source: sourceNode.id,
        target: targetNode.id,
        metric
      });
      if (res.data.cost === -1.0) {
        showToast('No path exists between the selected nodes.');
        setRoutingResult(null);
        if (negativeMetrics.includes(metric)) setIntelligentResult(null);
        setLoading(false);
        return;
      }
      setRoutingResult(res.data);
      setMstResult(null);
      if (negativeMetrics.includes(metric)) setIntelligentResult(res.data);
      setGraphData(prev => ({ ...prev }));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const runMST = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/routing/mst`, {
        algorithm: 'kruskal',
        metric
      });
      setMstResult(res.data);
      setRoutingResult(null);
      setGraphData(prev => ({ ...prev }));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const runIntelligentPath = async () => {
    if (!sourceNode || !targetNode) {
      showToast('Please select a Source and Target node by clicking on the graph.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/routing/intelligent-path`, {
        source: sourceNode.id,
        target: targetNode.id,
        metric
      });
      if (res.data.cost === -1.0) {
        showToast('No path exists between the selected nodes.');
        setRoutingResult(null);
        setIntelligentResult(null);
        setLoading(false);
        return;
      }
      setRoutingResult(res.data);
      setMstResult(null);
      setIntelligentResult(res.data);
      setGraphData(prev => ({ ...prev }));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const runIntelligentMST = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/routing/intelligent-mst`, { metric });
      setMstResult(res.data);
      setRoutingResult(null);
      setIntelligentResult(res.data);
      setGraphData(prev => ({ ...prev }));
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };


  const handleNodeClick = useCallback(node => {
    if (!sourceNode) {
      setSourceNode(node);
    } else if (!targetNode && node.id !== sourceNode.id) {
      setTargetNode(node);
    } else {
      setSourceNode(node);
      setTargetNode(null);
    }
  }, [sourceNode, targetNode]);

  const handleLinkClick = useCallback(link => {
    setEditingLink(link);
    setLinkEditForm({
      latency: link.features?.latency || 0,
      bandwidth: link.features?.bandwidth || 0,
      packet_loss: link.features?.packet_loss || 0,
      reliability: link.features?.reliability || 0,
      cost: link.features?.cost || 0,
      net_credit: link.features?.net_credit ?? 0,
      sla_bonus: link.features?.sla_bonus ?? 0
    });
  }, []);

  const submitLinkUpdate = async () => {
    setIsUpdatingLink(true);
    try {
       const sourceId = editingLink.source.id || editingLink.source;
       const targetId = editingLink.target.id || editingLink.target;
       
       await axios.post(`${API_BASE}/network/update-link`, {
          source: sourceId,
          target: targetId,
          latency: parseFloat(linkEditForm.latency),
          bandwidth: parseFloat(linkEditForm.bandwidth),
          packet_loss: parseFloat(linkEditForm.packet_loss),
          reliability: parseFloat(linkEditForm.reliability),
          cost: parseFloat(linkEditForm.cost),
          net_credit: parseFloat(linkEditForm.net_credit),
          sla_bonus: parseFloat(linkEditForm.sla_bonus)
       });

       // Update local state visually
       const newLinks = graphData.links.map(l => {
          if (l === editingLink) {
             return {
                ...l,
                features: {
                   latency: parseFloat(linkEditForm.latency),
                   bandwidth: parseFloat(linkEditForm.bandwidth),
                   packet_loss: parseFloat(linkEditForm.packet_loss),
                   reliability: parseFloat(linkEditForm.reliability),
                   cost: parseFloat(linkEditForm.cost),
                   net_credit: parseFloat(linkEditForm.net_credit),
                   sla_bonus: parseFloat(linkEditForm.sla_bonus)
                }
             };
          }
          return l;
       });

       setGraphData({ nodes: graphData.nodes, links: newLinks });
       setEditingLink(null);

       // Re-run simulation if we have a result visible
       if (routingResult) runShortestPath();
       if (mstResult) runMST();
       
    } catch(err) {
       console.error("Failed to update link", err);
       alert("Failed to update link.");
    }
    setIsUpdatingLink(false);
  };

  const getNodeColor = node => {
    if (sourceNode && node.id === sourceNode.id) return '#10b981';
    if (targetNode && node.id === targetNode.id) return '#ef4444';
    
    if (routingResult && activePathEdgeIndex >= 0) {
      const lockedUpToIndex = isExploring ? activePathEdgeIndex : activePathEdgeIndex + 1;
      const activeNodes = routingResult.path.slice(0, lockedUpToIndex + 1);
      if (activeNodes.includes(node.id)) return '#f59e0b';
    }
    return '#3b82f6';
  };

  const paintDeviceNode = useCallback((node, ctx, globalScale) => {
    let isSource = sourceNode && node.id === sourceNode.id;
    let isTarget = targetNode && node.id === targetNode.id;
    let isPath = false;
    
    if (routingResult && activePathEdgeIndex >= 0) {
      const lockedUpToIndex = isExploring ? activePathEdgeIndex : activePathEdgeIndex + 1;
      const activeNodes = routingResult.path.slice(0, lockedUpToIndex + 1);
      if (activeNodes.includes(node.id)) isPath = true;
    }
    
    const size = 12; // radius size

    // Draw glow/halo for state
    let strokeColor = 'transparent';
    let hasGlow = false;
    
    if (isSource) { strokeColor = '#10b981'; hasGlow = true; }
    else if (isTarget) { strokeColor = '#ef4444'; hasGlow = true; }
    else if (isPath) { strokeColor = '#f59e0b'; hasGlow = true; }

    if (hasGlow) {
       ctx.beginPath();
       ctx.arc(node.x, node.y, size * 1.2, 0, 2 * Math.PI, false);
       ctx.fillStyle = strokeColor;
       ctx.shadowBlur = 15;
       ctx.shadowColor = strokeColor;
       ctx.fill();
       ctx.shadowBlur = 0; // reset
    }

    if (node.type === 'pc') {
       ctx.drawImage(pcImg, node.x - size, node.y - size, size * 2, size * 2);
    } else if (node.type === 'router') {
       ctx.drawImage(routerImg, node.x - size, node.y - size, size * 2, size * 2);
    } else {
       ctx.beginPath();
       ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
       ctx.fillStyle = '#94a3b8';
       ctx.fill();
    }
    
    // Label
    const label = node.id;
    const fontSize = 12/globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + size + 4, ...bckgDimensions);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, node.x, node.y + size + 4 + fontSize / 2);

  }, [sourceNode, targetNode, routingResult, activePathEdgeIndex, isExploring]);

  const getLinkColor = link => {
    if (editingLink && link === editingLink) return '#38bdf8'; // Highlight editing link in cyan
    
    if (routingResult && activePathEdgeIndex >= 0) {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      const path = routingResult.path;
      
      let isLockedInPath = false;
      const lockedUpToIndex = isExploring ? activePathEdgeIndex - 1 : activePathEdgeIndex;
      
      for (let i = 0; i <= lockedUpToIndex; i++) {
        if (i < path.length - 1) {
          if ((path[i] === sourceId && path[i+1] === targetId) ||
              (path[i] === targetId && path[i+1] === sourceId)) {
            isLockedInPath = true;
            break;
          }
        }
      }
      
      if (isLockedInPath) return '#f59e0b';
      
      if (isExploring && activePathEdgeIndex < path.length - 1) {
        const currentNode = path[activePathEdgeIndex];
        if (sourceId === currentNode || targetId === currentNode) {
          return '#6ee7b7'; // Exploration color (light cyan/green)
        }
      }
    }
    
    if (mstResult && mstResult.mst_edges) {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      
      for(let edge of mstResult.mst_edges) {
          if ((edge[0] === sourceId && edge[1] === targetId) || 
              (edge[0] === targetId && edge[1] === sourceId)) {
              return '#8b5cf6';
          }
      }
      return 'rgba(255,255,255,0.05)';
    }
    
    return 'rgba(255, 255, 255, 0.2)';
  };

  const getLinkWidth = link => {
     if (editingLink && link === editingLink) return 4;
     if (routingResult) {
        if (getLinkColor(link) === '#f59e0b') return 3;
     }
     if (mstResult && mstResult.mst_edges) {
         if (getLinkColor(link) === '#8b5cf6') return 2;
     }
     return 1;
  };

  const getMetricLabel = (link) => {
    const features = link.features;
    if (!features) return '';
    if (metric === 'latency') return `${features.latency?.toFixed(1)}ms`;
    if (metric === 'bandwidth') return `${features.bandwidth?.toFixed(0)}M`;
    if (metric === 'packet_loss') return `${(features.packet_loss * 100)?.toFixed(2)}%`;
    if (metric === 'cost') return `$${features.cost?.toFixed(1)}`;
    if (metric === 'net_credit') return `C${features.net_credit?.toFixed(1)}`;
    if (metric === 'sla_bonus') return `S${features.sla_bonus?.toFixed(1)}`;
    return '';
  };

  const paintLink = useCallback((link, ctx) => {
    if (showWeights !== 'show') return;
    const label = getMetricLabel(link);
    if (!label) return;

    const start = link.source;
    const end = link.target;
    if (typeof start !== 'object' || typeof end !== 'object') return;

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    // Determine label color: highlight active path/mst links
    const linkCol = getLinkColor(link);
    const isActive = linkCol === '#f59e0b' || linkCol === '#8b5cf6';

    const fontSize = 3.5;
    ctx.font = `bold ${fontSize}px Sans-Serif`;

    // Background pill
    const textWidth = ctx.measureText(label).width;
    const padding = 1.5;
    ctx.fillStyle = isActive ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(midX - textWidth / 2 - padding, midY - fontSize / 2 - padding, textWidth + padding * 2, fontSize + padding * 2, 2);
    ctx.fill();

    // Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isActive ? (linkCol === '#f59e0b' ? '#f59e0b' : '#a78bfa') : 'rgba(255,255,255,0.75)';
    ctx.fillText(label, midX, midY);
  }, [showWeights, metric, routingResult, mstResult, editingLink, sourceNode, targetNode]);

  const handleLoadCustomGraph = (data) => {
    setNetworkStats(data.stats);
    setGraphData(data.graph);
    setTopologySource('builder');
    if (['net_credit', 'sla_bonus'].includes(metric)) {
      setMetric('latency');
    }
    setRoutingResult(null);
    setMstResult(null);
    setIntelligentResult(null);
    setSourceNode(null);
    setTargetNode(null);
    setPage('simulator');
    setTimeout(() => {
      if(graphRef.current) graphRef.current.zoomToFit(400, 20);
    }, 500);
  };

  if (page === 'builder') {
    return <Builder setCustomGraphData={handleLoadCustomGraph} setPage={setPage} />;
  }

  return (
    <div className="container" style={{ maxWidth: '1600px' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
         <h1 style={{ margin: 0, fontSize: '1.2rem', color: '#38bdf8', flex: 1 }}>Network Router</h1>
         <button className="btn" onClick={() => setPage('simulator')} style={{ background: '#3b82f6' }}>Simulator Mode</button>
         <button className="btn" onClick={() => setPage('builder')} style={{ background: 'transparent', border: '1px solid #3b82f6' }}>Builder Mode</button>
      </div>
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 68, 68, 0.95)',
          color: 'white',
          padding: '14px 24px',
          borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          zIndex: 9999,
          backdropFilter: 'blur(8px)',
          maxWidth: '540px',
          width: 'max-content',
          textAlign: 'center',
          lineHeight: '1.5',
          fontSize: '0.88rem',
          animation: 'fade-in-out 6s ease-in-out forwards'
        }}>
          {toast}
        </div>
      )}
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--accent-primary)', padding: '12px', borderRadius: '12px' }}>
          <Network size={32} color="white" />
        </div>
        <div>
          <h1 style={{ marginBottom: 0 }}>Intelligent Network Routing</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, marginTop: '4px' }}>
            Interactive Algorithmic Visualization
          </p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 300px', gap: '24px', height: 'calc(100vh - 120px)' }}>
        
        {/* Left Sidebar: Controls */}
        <div className="flex-col" style={{ gap: '24px', overflowY: 'auto' }}>
          {/* Network Generation */}
          <div className="glass-panel flex-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Settings size={20} color="var(--accent-primary)" />
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Topology</h2>
            </div>
            
            <div className="form-group">
              <label>Number of Nodes</label>
              <input type="number" className="input" value={nodeCount} onChange={e => setNodeCount(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Average Degree</label>
              <input type="number" className="input" value={degree} onChange={e => setDegree(e.target.value)} />
            </div>
            
            <div className="form-group">
              <label>Topology Model</label>
              <select className="select" value={topology} onChange={e => setTopology(e.target.value)}>
                <option value="average">Preferential (Hubs & Leaves)</option>
                <option value="realistic">Physical WAN (Strict Ports)</option>
              </select>
            </div>
            
            <button className="btn" onClick={generateNetwork} disabled={loading}>
              <Zap size={18} />
              {loading ? 'Generating...' : 'Regenerate Graph'}
            </button>
            
            {networkStats && (
              <div style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Nodes: {networkStats.nodes}</span>
                <span>Edges: {networkStats.edges}</span>
              </div>
            )}
          </div>

          {/* Simulation */}
          <div className="glass-panel flex-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Play size={20} color="var(--accent-secondary)" />
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Simulation</h2>
            </div>
            
            <div className="form-group">
              <label>Optimization Metric</label>
              <select className="select" value={metric} onChange={e => setMetric(e.target.value)}>
                <option value="latency">Latency</option>
                <option value="bandwidth">Bandwidth</option>
                <option value="packet_loss">Packet Loss</option>
                <option value="cost">Financial Cost</option>
                <option value="net_credit" disabled={topologySource === 'builder'}>Network Credit</option>
                <option value="sla_bonus" disabled={topologySource === 'builder'}>SLA Bonus</option>
              </select>
            </div>

            <div className="form-group">
              <label>Edge Weights</label>
              <select className="select" value={showWeights} onChange={e => setShowWeights(e.target.value)}>
                <option value="none">No Weights</option>
                <option value="show">Show Weights</option>
              </select>
            </div>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <MousePointerClick size={16} color="var(--text-secondary)" />
                <span style={{ color: 'var(--text-secondary)' }}>Click nodes on graph to select:</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>Source:</span>
                <span>{sourceNode ? sourceNode.id : 'None selected'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Target:</span>
                <span>{targetNode ? targetNode.id : 'None selected'}</span>
              </div>
            </div>

            <button 
              className="btn" 
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', marginBottom: '8px' }}
              onClick={runShortestPath}
              disabled={!sourceNode || !targetNode || loading}
            >
              <Zap size={18} /> Dijkstra Path
            </button>
            <button 
              className="btn" 
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', marginBottom: '12px' }}
              onClick={runMST}
              disabled={!networkStats || loading}
            >
              <GitGraph size={18} /> Kruskal's MST
            </button>

            {/* Divider */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0 12px' }} />
            <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Intelligent Mode</p>

            <button
              className="btn"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', marginBottom: '8px', boxShadow: '0 0 16px rgba(245,158,11,0.3)' }}
              onClick={runIntelligentPath}
              disabled={!sourceNode || !targetNode || loading}
            >
              <Brain size={18} /> Auto-Route Path
            </button>
            <button
              className="btn"
              style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', boxShadow: '0 0 16px rgba(6,182,212,0.3)' }}
              onClick={runIntelligentMST}
              disabled={!networkStats || loading}
            >
              <Brain size={18} /> Auto-Route MST
            </button>
          </div>
        </div>

        {/* Center: Graph Visualization */}
        <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
          {graphData.nodes.length > 0 && (
            <ForceGraph2D
              ref={graphRef}
              width={undefined} 
              height={undefined}
              graphData={graphData}
              nodeColor={topologySource === 'default' ? getNodeColor : undefined}
              nodeCanvasObject={topologySource === 'builder' ? paintDeviceNode : undefined}
              nodeRelSize={topologySource === 'builder' ? 12 : 6}
              linkColor={getLinkColor}
              linkWidth={getLinkWidth}
              onNodeClick={handleNodeClick}
              onLinkClick={handleLinkClick}
              onNodeDragEnd={node => {
                node.fx = node.x;
                node.fy = node.y;
              }}
              nodeLabel="id"
              linkCanvasObjectMode={() => showWeights === 'show' ? 'after' : undefined}
              linkCanvasObject={paintLink}
              backgroundColor="transparent"
              cooldownTicks={topologySource === 'builder' ? 0 : 100}
            />
          )}
          
          {(!sourceNode || !targetNode) && !routingResult && !mstResult && (
             <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem', pointerEvents: 'none' }}>
                Click nodes to set Source/Target. Click edges to edit weights.
             </div>
          )}

          {/* Edit Edge Modal */}
          {editingLink && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--panel-bg)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--accent-primary)',
              borderRadius: '12px',
              padding: '24px',
              width: '320px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              zIndex: 1000
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                  Edit Link {editingLink.source.id || editingLink.source} ↔ {editingLink.target.id || editingLink.target}
                </h3>
                <button onClick={() => setEditingLink(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-col" style={{ gap: '12px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Latency (ms)</label>
                   <input type="number" step="0.1" className="input" style={{ width: '120px', padding: '6px' }} value={linkEditForm.latency} onChange={e => setLinkEditForm({...linkEditForm, latency: e.target.value})} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Bandwidth</label>
                   <input type="number" step="0.1" className="input" style={{ width: '120px', padding: '6px' }} value={linkEditForm.bandwidth} onChange={e => setLinkEditForm({...linkEditForm, bandwidth: e.target.value})} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                   <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Cost ($)</label>
                   <input type="number" step="0.1" className="input" style={{ width: '120px', padding: '6px' }} value={linkEditForm.cost} onChange={e => setLinkEditForm({...linkEditForm, cost: e.target.value})} />
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                     <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Net Credit</label>
                     <input type="number" step="0.1" className="input" style={{ width: '120px', padding: '6px' }} value={linkEditForm.net_credit} onChange={e => setLinkEditForm({...linkEditForm, net_credit: e.target.value})} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>SLA Bonus</label>
                     <input type="number" step="0.1" className="input" style={{ width: '120px', padding: '6px' }} value={linkEditForm.sla_bonus} onChange={e => setLinkEditForm({...linkEditForm, sla_bonus: e.target.value})} />
                  </div>
                </div>
              </div>

              <button className="btn" style={{ width: '100%' }} onClick={submitLinkUpdate} disabled={isUpdatingLink}>
                {isUpdatingLink ? 'Updating...' : 'Save & Recalculate'}
              </button>
            </div>
          )}
        </div>

        {/* Right Sidebar: Results */}
        <div className="flex-col" style={{ gap: '24px', overflowY: 'auto' }}>
           {/* Results Panel */}
           <div className="glass-panel flex-col">
              <h2 style={{ margin: 0, fontSize: '1.2rem', marginBottom: '16px' }}>Simulation Results</h2>
              
              {!routingResult && !mstResult ? (
                 <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                   Run a simulation to view the output results.
                 </p>
              ) : null}

              {/* Intelligence Report */}
              {intelligentResult?.algorithm_selection && (
                <div style={{ padding: '14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '8px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Brain size={16} color="#f59e0b" />
                    <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.9rem' }}>Intelligence Report</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Selected: </span>
                    <span style={{ color: '#10b981' }}>{intelligentResult.algorithm_selection.selected}</span>
                    <span style={{ color: 'var(--text-secondary)' }}> {intelligentResult.algorithm_selection.selected_complexity}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '8px' }}>
                    {intelligentResult.algorithm_selection.reason}
                  </div>
                  {/* Rejected algorithms */}
                  {Object.entries(intelligentResult.algorithm_selection.rejected || {}).map(([alg, info]) => (
                    <div key={alg} style={{ fontSize: '0.75rem', padding: '6px 8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px' }}>
                      <span style={{ color: '#ef4444' }}>✗ {alg}</span>
                      <span style={{ color: 'var(--text-secondary)' }}> — {info.reason}</span>
                    </div>
                  ))}
                  {/* Graph stats */}
                  {intelligentResult.graph_stats && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'rgba(255,255,255,0.07)', borderRadius: '12px' }}>V={intelligentResult.graph_stats.V}</span>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'rgba(255,255,255,0.07)', borderRadius: '12px' }}>E={intelligentResult.graph_stats.E}</span>
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'rgba(255,255,255,0.07)', borderRadius: '12px' }}>Density={intelligentResult.graph_stats.density}</span>
                    </div>
                  )}
                </div>
              )}



              {routingResult && (
                <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '1rem', color: '#f59e0b', marginBottom: '12px' }}>Shortest Path</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Metric</span>
                      <span style={{ textTransform: 'capitalize' }}>{routingResult.metric}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Cost</span>
                      <span style={{ fontWeight: 'bold' }}>{routingResult.cost === -1.0 ? 'Unreachable' : routingResult.cost.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Hops</span>
                      <span>{routingResult.path.length > 0 ? routingResult.path.length - 1 : 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Exec Time</span>
                      <span style={{ color: '#10b981' }}>{routingResult.time_ms.toFixed(3)} ms</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                     <strong>Path: </strong>{routingResult.path.length > 0 ? routingResult.path.join(' ➔ ') : 'No path exists between these nodes.'}
                  </div>
                </div>
              )}

              {mstResult && (
                <div style={{ padding: '16px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '1rem', color: '#a78bfa', marginBottom: '12px' }}>Minimum Spanning Tree</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Algorithm</span>
                      <span>{mstResult.algorithm}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Metric</span>
                      <span style={{ textTransform: 'capitalize' }}>{mstResult.metric}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Cost</span>
                      <span style={{ fontWeight: 'bold' }}>{mstResult.total_cost.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Edges in Tree</span>
                      <span>{mstResult.edges_in_mst}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Exec Time</span>
                      <span style={{ color: '#10b981' }}>{mstResult.time_ms.toFixed(3)} ms</span>
                    </div>
                  </div>
                </div>
              )}
           </div>


        </div>

      </div>

    </div>
  );
}

export default App;
