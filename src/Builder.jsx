import React, { useState, useRef, useCallback, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Router, Monitor, Link2, Trash2, Send, MousePointer2, RefreshCcw, XCircle, Settings } from 'lucide-react';
import axios from 'axios';
import { routerImg, pcImg } from './device-icons';

const createDefaultTopology = () => {
  const nodes = [
    { id: 'Router_1', type: 'router', x: -100, y: 0, fx: -100, fy: 0 },
    { id: 'Router_2', type: 'router', x: 0, y: -80, fx: 0, fy: -80 },
    { id: 'Router_3', type: 'router', x: 100, y: -80, fx: 100, fy: -80 },
    { id: 'Router_4', type: 'router', x: 0, y: 0, fx: 0, fy: 0 },
    { id: 'Router_5', type: 'router', x: 100, y: 0, fx: 100, fy: 0 },
    { id: 'Router_6', type: 'router', x: 100, y: 80, fx: 100, fy: 80 },
    { id: 'Router_7', type: 'router', x: 0, y: 80, fx: 0, fy: 80 },
    { id: 'PC_1', type: 'pc', x: -150, y: -50, fx: -150, fy: -50 },
    { id: 'PC_2', type: 'pc', x: -150, y: 50, fx: -150, fy: 50 },
    { id: 'PC_3', type: 'pc', x: -50, y: -130, fx: -50, fy: -130 },
    { id: 'PC_4', type: 'pc', x: 50, y: -130, fx: 50, fy: -130 },
    { id: 'PC_5', type: 'pc', x: 150, y: -130, fx: 150, fy: -130 },
    { id: 'PC_6', type: 'pc', x: 150, y: -40, fx: 150, fy: -40 },
    { id: 'PC_7', type: 'pc', x: 150, y: 40, fx: 150, fy: 40 },
    { id: 'PC_8', type: 'pc', x: 150, y: 130, fx: 150, fy: 130 },
    { id: 'PC_9', type: 'pc', x: -50, y: 130, fx: -50, fy: 130 },
    { id: 'PC_10', type: 'pc', x: 50, y: 130, fx: 50, fy: 130 },
  ];
  
  const addLink = (s, t, lat, bw, pl, cost) => ({ 
    source: s, target: t, latency: lat, bandwidth: bw, packet_loss: pl, cost: cost 
  });
  
  const links = [
    addLink('Router_1', 'Router_2', 20, 100, 0.2, 5),
    addLink('Router_1', 'Router_4', 15, 500, 0.1, 10),
    addLink('Router_1', 'Router_7', 25, 100, 0.5, 3),
    addLink('Router_2', 'Router_3', 45, 1000, 0.5, 8),
    addLink('Router_2', 'Router_4', 10, 1000, 0.1, 15),
    addLink('Router_4', 'Router_5', 12, 1000, 0.1, 12),
    addLink('Router_4', 'Router_7', 18, 500, 0.2, 8),
    addLink('Router_3', 'Router_5', 30, 500, 0.3, 6),
    addLink('Router_5', 'Router_6', 22, 100, 0.4, 4),
    addLink('Router_7', 'Router_6', 40, 100, 0.6, 2),
    addLink('PC_1', 'Router_1', 2, 1000, 0, 0),
    addLink('PC_2', 'Router_1', 2, 1000, 0, 0),
    addLink('PC_3', 'Router_2', 2, 1000, 0, 0),
    addLink('PC_4', 'Router_2', 2, 1000, 0, 0),
    addLink('PC_5', 'Router_3', 2, 1000, 0, 0),
    addLink('PC_6', 'Router_5', 2, 1000, 0, 0),
    addLink('PC_7', 'Router_5', 2, 1000, 0, 0),
    addLink('PC_8', 'Router_6', 2, 1000, 0, 0),
    addLink('PC_9', 'Router_7', 2, 1000, 0, 0),
    addLink('PC_10', 'Router_7', 2, 1000, 0, 0),
  ];
  return { nodes, links };
};

const Builder = ({ setCustomGraphData, setPage }) => {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [mode, setMode] = useState('select'); // select, add_router, add_pc, add_link, delete
  const [selectedEntity, setSelectedEntity] = useState({ type: 'none', data: null });
  const [linkSourceNode, setLinkSourceNode] = useState(null);
  
  // Link editing state
  const [linkForm, setLinkForm] = useState({ latency: 10, bandwidth: 100, packet_loss: 0, cost: 50 });
  
  const graphRef = useRef();
  const containerRef = useRef();

  useEffect(() => {
    // Load default topology on first mount
    const def = createDefaultTopology();
    setNodes(def.nodes);
    setLinks(def.links);
    
    // Zoom to fit slightly delayed to allow canvas measurement
    setTimeout(() => {
      if (graphRef.current) graphRef.current.zoomToFit(400, 50);
    }, 500);
  }, []);

  // When a link is selected, populate form
  useEffect(() => {
    if (selectedEntity.type === 'link' && selectedEntity.data) {
      setLinkForm({
        latency: selectedEntity.data.latency ?? 10,
        bandwidth: selectedEntity.data.bandwidth ?? 100,
        packet_loss: selectedEntity.data.packet_loss ?? 0,
        cost: selectedEntity.data.cost ?? 50
      });
    }
  }, [selectedEntity]);

  const handleAddDevice = (deviceType) => {
    if (!graphRef.current) return;
    
    // Top left of the screen with a small margin
    let graphCoords = { x: -200, y: -200 };
    if (typeof graphRef.current.screen2GraphCoords === 'function') {
        graphCoords = graphRef.current.screen2GraphCoords(50, 50);
    }

    const prefix = deviceType === 'router' ? 'Router' : 'PC';
    let idNum = 1;
    while(nodes.some(n => n.id === `${prefix}_${idNum}`)) {
      idNum++;
    }
    
    const newNode = { 
      id: `${prefix}_${idNum}`, 
      type: deviceType, 
      x: graphCoords.x, 
      y: graphCoords.y, 
      fx: graphCoords.x, 
      fy: graphCoords.y 
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedEntity({ type: 'node', data: newNode });
    setMode('select');
  };

  const handleBackgroundClick = useCallback((e) => {
    setSelectedEntity({ type: 'none', data: null });
    setLinkSourceNode(null);
  }, []);

  const handleNodeClick = useCallback(node => {
    if (mode === 'add_link') {
      if (!linkSourceNode) {
        setLinkSourceNode(node);
      } else if (linkSourceNode.id !== node.id) {
        // Prevent duplicate links
        const exists = links.find(l => 
          ((l.source.id || l.source) === linkSourceNode.id && (l.target.id || l.target) === node.id) ||
          ((l.target.id || l.target) === linkSourceNode.id && (l.source.id || l.source) === node.id)
        );
        
        if (!exists) {
          const newLink = { 
            source: linkSourceNode.id, 
            target: node.id, 
            latency: 10, bandwidth: 100, packet_loss: 0, cost: 50 
          };
          setLinks(prev => [...prev, newLink]);
          setSelectedEntity({ type: 'link', data: newLink });
          // Remain in add_link mode, but reset source to allow next link starting fresh
          setLinkSourceNode(null);
          // Optional: switch to select mode to let them edit properties immediately
          setMode('select');
        } else {
          setLinkSourceNode(null);
        }
      } else {
        setLinkSourceNode(null); // Clicked self
      }
    } else if (mode === 'delete') {
      setNodes(prev => prev.filter(n => n.id !== node.id));
      setLinks(prev => prev.filter(l => 
        (l.source.id || l.source) !== node.id && 
        (l.target.id || l.target) !== node.id
      ));
      if (selectedEntity.data && selectedEntity.data.id === node.id) {
        setSelectedEntity({ type: 'none', data: null });
      }
    } else if (mode === 'select') {
      setSelectedEntity({ type: 'node', data: node });
    }
  }, [mode, linkSourceNode, links, selectedEntity]);

  const handleLinkClick = useCallback(link => {
     if (mode === 'delete') {
        setLinks(prev => prev.filter(l => l !== link));
        if (selectedEntity.data === link) setSelectedEntity({ type: 'none', data: null });
     } else if (mode === 'select') {
        setSelectedEntity({ type: 'link', data: link });
     }
  }, [mode, selectedEntity]);

  const handleLinkUpdate = () => {
    if (selectedEntity.type !== 'link' || !selectedEntity.data) return;
    
    // Validate
    const lat = Math.max(0, parseFloat(linkForm.latency) || 0);
    const bw = Math.max(0.1, parseFloat(linkForm.bandwidth) || 100);
    const pl = Math.max(0, Math.min(100, parseFloat(linkForm.packet_loss) || 0));
    const cost = Math.max(0, parseFloat(linkForm.cost) || 0);

    setLinks(prev => prev.map(l => {
      if (l === selectedEntity.data) {
        const updated = { ...l, latency: lat, bandwidth: bw, packet_loss: pl, cost: cost };
        setSelectedEntity({ type: 'link', data: updated });
        return updated;
      }
      return l;
    }));
  };

  const handleNodeRename = (e) => {
    e.preventDefault();
    const newName = e.target.elements.nodeName.value.trim();
    if (!newName || selectedEntity.type !== 'node') return;
    
    // Check dupe
    if (nodes.some(n => n.id === newName && n !== selectedEntity.data)) {
      alert("A node with this name already exists!");
      return;
    }

    const oldId = selectedEntity.data.id;
    
    setNodes(prev => prev.map(n => n === selectedEntity.data ? { ...n, id: newName } : n));
    setLinks(prev => prev.map(l => {
      let updated = false;
      let s = l.source.id || l.source;
      let t = l.target.id || l.target;
      if (s === oldId) { s = newName; updated = true; }
      if (t === oldId) { t = newName; updated = true; }
      if (updated) {
        return { ...l, source: s, target: t };
      }
      return l;
    }));
    
    setSelectedEntity({ type: 'node', data: { ...selectedEntity.data, id: newName } });
  };

  const deploy = async () => {
    if (nodes.length < 2 || links.length < 1) {
      alert("You need at least 2 nodes and 1 link to simulate a network.");
      return;
    }
    
    const normalizedLinks = links.map(l => ({
      source: l.source.id || l.source,
      target: l.target.id || l.target,
      latency: l.latency || 10,
      bandwidth: l.bandwidth || 100,
      cost: l.cost || 50,
      packet_loss: l.packet_loss || 0,
      reliability: 99.9,
      net_credit: 0,
      sla_bonus: 0
    }));
    
    const req = {
       nodes: nodes.map(n => ({ id: n.id, type: n.type, fx: n.x, fy: n.y })),
       links: normalizedLinks
    };
    
    try {
      const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:8000/api';
      const res = await axios.post(`${API_BASE}/network/custom`, req);
      setCustomGraphData(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to deploy custom network to the simulator.");
    }
  };

  const clearAll = () => {
    if(window.confirm("Are you sure you want to completely clear the network topology?")) {
      setNodes([]);
      setLinks([]);
      setSelectedEntity({ type: 'none', data: null });
      setLinkSourceNode(null);
    }
  };

  const restoreDefault = () => {
    if(window.confirm("Restore the default topology? All custom changes will be lost.")) {
      const def = createDefaultTopology();
      setNodes(def.nodes);
      setLinks(def.links);
      setSelectedEntity({ type: 'none', data: null });
      setLinkSourceNode(null);
      setTimeout(() => { if (graphRef.current) graphRef.current.zoomToFit(400, 50); }, 100);
    }
  };

  const paintNode = useCallback((node, ctx, globalScale) => {
    const isSelected = selectedEntity.type === 'node' && selectedEntity.data && selectedEntity.data.id === node.id;
    const isLinkSource = linkSourceNode && linkSourceNode.id === node.id;
    
    const size = 12; // radius size

    // Draw glow/halo for state
    let strokeColor = 'transparent';
    let hasGlow = false;
    
    if (isSelected) { strokeColor = '#f59e0b'; hasGlow = true; } // orange for selected
    if (isLinkSource) { strokeColor = '#10b981'; hasGlow = true; } // green for link source

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
  }, [selectedEntity, linkSourceNode]);

  const paintLink = useCallback((link, ctx, globalScale) => {
     if (!link.latency) return;

     const start = link.source;
     const end = link.target;
     if (typeof start !== 'object' || typeof end !== 'object') return;

     const midX = (start.x + end.x) / 2;
     const midY = (start.y + end.y) / 2;
     
     const label = `${link.latency}ms`;
     const fontSize = 4;
     ctx.font = `bold ${fontSize}px Sans-Serif`;

     const textWidth = ctx.measureText(label).width;
     const padding = 1.5;
     
     const isSelected = selectedEntity.data === link;
     
     ctx.fillStyle = isSelected ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.5)';
     ctx.beginPath();
     ctx.roundRect(midX - textWidth / 2 - padding, midY - fontSize / 2 - padding, textWidth + padding * 2, fontSize + padding * 2, 2);
     ctx.fill();

     ctx.textAlign = 'center';
     ctx.textBaseline = 'middle';
     ctx.fillStyle = isSelected ? '#f59e0b' : 'rgba(255,255,255,0.75)';
     ctx.fillText(label, midX, midY);
  }, [selectedEntity]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', height: '100%' }}>
      {/* TOOLBAR */}
      <div style={{ display: 'flex', padding: '12px 24px', gap: '12px', background: 'var(--panel-bg)', borderBottom: '1px solid var(--glass-border)', alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, marginRight: '12px', fontSize: '1.2rem', color: '#f59e0b' }}>Network Builder</h2>
        
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '4px', gap: '4px' }}>
          <button className={`btn ${mode === 'select' ? 'active' : ''}`} style={{ background: mode === 'select' ? '#475569' : 'transparent', border: 'none' }} onClick={() => {setMode('select'); setLinkSourceNode(null);}}>
             <MousePointer2 size={16} /> Select
          </button>
          <button className="btn" style={{ background: 'transparent', border: 'none' }} onClick={() => handleAddDevice('router')}>
             <Router size={16} /> Add Router
          </button>
          <button className="btn" style={{ background: 'transparent', border: 'none' }} onClick={() => handleAddDevice('pc')}>
             <Monitor size={16} /> Add PC
          </button>
          <button className={`btn ${mode === 'add_link' ? 'active' : ''}`} style={{ background: mode === 'add_link' ? '#10b981' : 'transparent', border: 'none' }} onClick={() => setMode('add_link')}>
             <Link2 size={16} /> Link Nodes
          </button>
          <button className={`btn ${mode === 'delete' ? 'active' : ''}`} style={{ background: mode === 'delete' ? '#ef4444' : 'transparent', border: 'none' }} onClick={() => {setMode('delete'); setLinkSourceNode(null);}}>
             <Trash2 size={16} /> Delete
          </button>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--glass-border)', margin: '0 8px' }}></div>
        
        <button className="btn" style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444' }} onClick={clearAll}>
           <XCircle size={16} /> Clear All
        </button>
        <button className="btn" style={{ background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6' }} onClick={restoreDefault}>
           <RefreshCcw size={16} /> Default
        </button>
        
        <button className="btn" onClick={deploy} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', marginLeft: 'auto', boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)' }}>
           <Send size={16} /> Deploy & Sim
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
         {/* CANVAS */}
         <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: mode === 'select' ? 'default' : 'crosshair' }}>
            <ForceGraph2D
               ref={graphRef}
               graphData={{ nodes, links }}
               nodeCanvasObject={paintNode}
               onNodeClick={handleNodeClick}
               onLinkClick={handleLinkClick}
               onBackgroundClick={handleBackgroundClick}
               onNodeDragEnd={node => {
                  node.fx = node.x;
                  node.fy = node.y;
               }}
               nodeRelSize={12}
               linkCanvasObjectMode={() => 'after'}
               linkCanvasObject={paintLink}
               linkColor={link => selectedEntity.data === link ? '#f59e0b' : 'rgba(255,255,255,0.2)'}
               linkWidth={link => selectedEntity.data === link ? 4 : 2}
               backgroundColor="transparent"
               d3AlphaDecay={0.05}
               cooldownTicks={0}
            />

         </div>

            {/* Mode Overlays */}
            {mode === 'add_link' && (
               <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', padding: '12px 24px', borderRadius: '8px', color: '#10b981', backdropFilter: 'blur(4px)', pointerEvents: 'none' }}>
                  {linkSourceNode ? `Select target node to connect ${linkSourceNode.id}` : 'Select source node to link'}
               </div>
            )}

         {/* RIGHT SIDEBAR */}
         <div style={{ width: '320px', background: 'rgba(0,0,0,0.4)', borderLeft: '1px solid var(--glass-border)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
            
            {selectedEntity.type === 'none' && (
               <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                     <Settings size={20} color="#94a3b8" />
                     <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>Network</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                        <span>Total Nodes</span>
                        <span style={{ fontWeight: 'bold', color: '#fff' }}>{nodes.length}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                        <span>Routers</span>
                        <span style={{ fontWeight: 'bold', color: '#8b5cf6' }}>{nodes.filter(n => n.type === 'router').length}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                        <span>PCs</span>
                        <span style={{ fontWeight: 'bold', color: '#3b82f6' }}>{nodes.filter(n => n.type === 'pc').length}</span>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                        <span>Total Links</span>
                        <span style={{ fontWeight: 'bold', color: '#fff' }}>{links.length}</span>
                     </div>
                  </div>
               </>
            )}

            {selectedEntity.type === 'node' && selectedEntity.data && (
               <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                     {selectedEntity.data.type === 'router' ? <Router size={20} color="#8b5cf6" /> : <Monitor size={20} color="#3b82f6" />}
                     <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem', textTransform: 'capitalize' }}>{selectedEntity.data.type}</h3>
                  </div>
                  <form onSubmit={handleNodeRename} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                     <div className="form-group">
                        <label>Node Name</label>
                        <input type="text" name="nodeName" defaultValue={selectedEntity.data.id} className="input" />
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontSize: '0.9rem' }}>
                        <span>Connections</span>
                        <span>{links.filter(l => (l.source.id || l.source) === selectedEntity.data.id || (l.target.id || l.target) === selectedEntity.data.id).length}</span>
                     </div>
                     <button type="submit" className="btn" style={{ background: '#3b82f6', width: '100%', justifyContent: 'center' }}>Rename Node</button>
                  </form>
               </>
            )}

            {selectedEntity.type === 'link' && selectedEntity.data && (
               <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                     <Link2 size={20} color="#10b981" />
                     <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>Link Properties</h3>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: '8px', wordBreak: 'break-all' }}>
                     <strong>{selectedEntity.data.source.id || selectedEntity.data.source}</strong> ↔ <strong>{selectedEntity.data.target.id || selectedEntity.data.target}</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                     <div className="form-group">
                        <label>Latency (ms)</label>
                        <input type="number" min="0" step="0.1" value={linkForm.latency} onChange={e => setLinkForm({...linkForm, latency: e.target.value})} className="input" />
                     </div>
                     <div className="form-group">
                        <label>Bandwidth (Mbps)</label>
                        <input type="number" min="0.1" step="1" value={linkForm.bandwidth} onChange={e => setLinkForm({...linkForm, bandwidth: e.target.value})} className="input" />
                     </div>
                     <div className="form-group">
                        <label>Packet Loss (%)</label>
                        <input type="number" min="0" max="100" step="0.1" value={linkForm.packet_loss} onChange={e => setLinkForm({...linkForm, packet_loss: e.target.value})} className="input" />
                     </div>
                     <div className="form-group">
                        <label>Financial Cost</label>
                        <input type="number" min="0" step="0.1" value={linkForm.cost} onChange={e => setLinkForm({...linkForm, cost: e.target.value})} className="input" />
                     </div>
                     <button onClick={handleLinkUpdate} className="btn" style={{ background: '#10b981', width: '100%', justifyContent: 'center' }}>Apply Changes</button>
                  </div>
               </>
            )}

         </div>
      </div>
    </div>
  );
};

export default Builder;
