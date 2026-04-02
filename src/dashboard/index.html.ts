export const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>mcpicker — Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e0e0e0; min-height: 100vh; }

  .header { padding: 24px 32px; border-bottom: 1px solid #1a1a2e; display: flex; align-items: center; gap: 12px; }
  .header h1 { font-size: 20px; font-weight: 600; color: #fff; }
  .header .badge { background: #2563eb; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 12px; }

  .container { display: flex; gap: 24px; padding: 24px 32px; flex-wrap: wrap; }

  .tool-card {
    background: #12121a;
    border: 1px solid #1e1e2e;
    border-radius: 12px;
    width: 320px;
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .tool-card.drag-over { border-color: #2563eb; box-shadow: 0 0 20px rgba(37, 99, 235, 0.2); }
  .tool-card-header {
    padding: 16px;
    border-bottom: 1px solid #1e1e2e;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tool-card-header h2 { font-size: 15px; font-weight: 600; color: #fff; }
  .tool-card-header .count { color: #666; font-size: 13px; }
  .tool-card-header .http-badge { background: #7c3aed22; color: #a78bfa; padding: 1px 6px; border-radius: 4px; font-size: 11px; margin-left: 8px; }

  .server-list { padding: 8px; }
  .server-item {
    padding: 10px 12px;
    border-radius: 8px;
    cursor: grab;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.15s;
    user-select: none;
  }
  .server-item:hover { background: #1a1a2e; }
  .server-item:active { cursor: grabbing; }
  .server-item.dragging { opacity: 0.4; }
  .server-name { font-size: 13px; font-weight: 500; }
  .server-type { font-size: 11px; padding: 2px 6px; border-radius: 4px; }
  .server-type.stdio { background: #0d946822; color: #34d399; }
  .server-type.http { background: #f59e0b22; color: #fbbf24; }

  .empty { padding: 24px; text-align: center; color: #444; font-size: 13px; }

  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #1a1a2e;
    border: 1px solid #2563eb;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.3s;
    z-index: 100;
  }
  .toast.show { transform: translateY(0); opacity: 1; }

  .drop-indicator {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(37, 99, 235, 0.05);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 50;
  }
  .drop-indicator.active { opacity: 1; }

  .status-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 8px 32px;
    background: #0a0a0f;
    border-top: 1px solid #1a1a2e;
    font-size: 12px;
    color: #555;
    display: flex;
    justify-content: space-between;
  }

  @media (max-width: 768px) {
    .container { padding: 16px; }
    .tool-card { width: 100%; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>mcpicker</h1>
  <span class="badge" id="totalBadge">loading...</span>
  <span style="color: #444; font-size: 13px; margin-left: auto;">Drag servers between tools to sync</span>
</div>

<div class="container" id="container"></div>
<div class="toast" id="toast"></div>
<div class="drop-indicator" id="dropIndicator"></div>
<div class="status-bar">
  <span id="statusText">Loading...</span>
  <span>mcpicker dashboard</span>
</div>

<script>
let tools = [];
let dragData = null;

async function loadTools() {
  const res = await fetch('/api/tools');
  tools = await res.json();
  render();
  const total = tools.reduce((s, t) => s + t.serverCount, 0);
  document.getElementById('totalBadge').textContent = total + ' servers across ' + tools.length + ' tools';
  document.getElementById('statusText').textContent = 'Ready — ' + tools.length + ' tools detected';
}

function render() {
  const container = document.getElementById('container');
  container.innerHTML = tools.map(tool => {
    const servers = Object.entries(tool.servers);
    const httpSupport = tool.httpSupport ? '' : '<span class="http-badge">no HTTP</span>';
    return \`
      <div class="tool-card" data-tool-id="\${tool.id}"
           ondragover="onDragOver(event, '\${tool.id}')"
           ondragleave="onDragLeave(event)"
           ondrop="onDrop(event, '\${tool.id}')">
        <div class="tool-card-header">
          <h2>\${tool.name}\${httpSupport}</h2>
          <span class="count">\${servers.length}</span>
        </div>
        <div class="server-list">
          \${servers.length === 0 ? '<div class="empty">No MCP servers</div>' :
            servers.map(([name, srv]) => \`
              <div class="server-item" draggable="true"
                   ondragstart="onDragStart(event, '\${tool.id}', '\${name}')"
                   ondragend="onDragEnd(event)">
                <span class="server-name">\${name}</span>
                <span class="server-type \${srv.type}">\${srv.type}</span>
              </div>
            \`).join('')}
        </div>
      </div>
    \`;
  }).join('');
}

function onDragStart(e, toolId, serverName) {
  dragData = { toolId, serverName };
  e.target.classList.add('dragging');
  document.getElementById('dropIndicator').classList.add('active');
  e.dataTransfer.effectAllowed = 'copy';
}

function onDragEnd(e) {
  e.target.classList.remove('dragging');
  document.getElementById('dropIndicator').classList.remove('active');
  document.querySelectorAll('.tool-card').forEach(c => c.classList.remove('drag-over'));
  dragData = null;
}

function onDragOver(e, toolId) {
  e.preventDefault();
  if (!dragData || dragData.toolId === toolId) return;
  e.currentTarget.classList.add('drag-over');
  e.dataTransfer.dropEffect = 'copy';
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function onDrop(e, targetToolId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  document.getElementById('dropIndicator').classList.remove('active');

  if (!dragData || dragData.toolId === targetToolId) return;

  const { toolId: sourceToolId, serverName } = dragData;
  dragData = null;

  showToast('Syncing ' + serverName + '...');

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId: sourceToolId,
        targetId: targetToolId,
        serverNames: [serverName]
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('\\u2713 Synced ' + serverName + ' successfully!');
      await loadTools();
    } else {
      showToast('\\u2717 Error: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    showToast('\\u2717 Failed: ' + err.message);
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

loadTools();
</script>
</body>
</html>`;
