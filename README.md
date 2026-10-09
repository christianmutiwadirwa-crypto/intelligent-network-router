# 🌐 Intelligent Network Routing & Topology Builder

Welcome to the **Intelligent Network Routing & Topology Builder**! This application is a powerful, interactive tool for visualizing network graphs, simulating routing algorithms, and building custom network topologies on the fly.

![Network Simulation](https://img.shields.io/badge/Status-Active-success)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB)
![Python](https://img.shields.io/badge/Backend-Python%20%2B%20Flask-3776AB)

## ✨ Key Features

- 🏗️ **Interactive Topology Builder**: Drag-and-drop interface inspired by Cisco Packet Tracer. Build your own network topologies using routers and PCs, link them up, and assign custom weights.
- ⚡ **Real-Time Simulation Engine**: Deploy your custom network and instantly run routing algorithms to visualize data flow.
- 🧠 **Intelligent Auto-Routing**: Beyond simple shortest-path, the intelligent engine dynamically selects the most optimal algorithm (Dijkstra, Bellman-Ford, Kruskal's MST) based on the metric you are optimizing for (Latency, Bandwidth, Financial Cost, etc.).
- 🎨 **Glassmorphism UI**: A beautiful, modern, dark-themed UI that is a joy to use.

## 🚀 Algorithms Supported
- **Dijkstra's Algorithm**: For calculating the absolute shortest path on standard metrics.
- **Bellman-Ford Algorithm**: Automatically selected when optimizing for metrics that can have negative weights (e.g., Network Credit, SLA Bonus).
- **Kruskal's Algorithm**: Used for computing Minimum Spanning Trees (MST) to optimize broadcast domains and redundancy.

---

## 💻 Local Development

### 1. Start the Backend
The backend is powered by Python and handles the heavy lifting of the routing algorithms.
```bash
cd backend
pip install -r requirements.txt
python api.py
```
*The backend will run on `http://localhost:8000`*

### 2. Start the Frontend
The frontend is a blazing-fast React application built with Vite.
```bash
cd frontend
npm install
npm run dev
```
*The frontend will run on `http://localhost:5174`*

---

## ☁️ Vercel Deployment

This project is fully ready to be deployed on **Vercel** (which is 100% free for hobbyists!). Vercel will host the React frontend, while the Python API acts as Serverless Functions.

### Deployment Steps:
1. Push this repository to your GitHub account.
2. Go to [Vercel.com](https://vercel.com/) and sign in with GitHub.
3. Click **Add New** -> **Project** and import this repository.
4. **Important Settings:**
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `cd frontend && npm run build`
   - **Output Directory**: `frontend/dist`
5. Click **Deploy**! 

*Vercel will automatically read the `vercel.json` file in the root directory and configure the Python backend serverless functions alongside the React frontend.*
