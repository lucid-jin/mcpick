export const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>mcpicker — Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e0e0e0; min-height: 100vh; }

  .header { padding: 20px 32px; border-bottom: 1px solid #1a1a2e; display: flex; align-items: center; gap: 12px; }
  .header h1 { font-size: 20px; font-weight: 600; color: #fff; }
  .header .badge { background: #2563eb; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
  .header .hint { color: #555; font-size: 13px; margin-left: auto; }

  .container { display: flex; gap: 20px; padding: 20px 32px; flex-wrap: wrap; padding-bottom: 60px; }

  .tool-card {
    background: #12121a;
    border: 1px solid #1e1e2e;
    border-radius: 12px;
    width: 300px;
    overflow: hidden;
    transition: all 0.2s;
    position: relative;
  }
  .tool-card.not-installed { opacity: 0.4; }
  .tool-card.drag-over { border-color: #2563eb; box-shadow: 0 0 20px rgba(37, 99, 235, 0.2); }
  .tool-card.drag-over.warn { border-color: #f59e0b; box-shadow: 0 0 20px rgba(245, 158, 11, 0.2); }
  .tool-card.drag-over.blocked { border-color: #ef4444; box-shadow: 0 0 20px rgba(239, 68, 68, 0.2); }

  .tool-card-header {
    padding: 14px 16px;
    border-bottom: 1px solid #1e1e2e;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tool-card-header h2 { font-size: 14px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 8px; }
  .tool-card-header .count { color: #666; font-size: 12px; }

  .tag { padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 500; }
  .tag.no-http { background: #ef444422; color: #f87171; }
  .tag.toml { background: #f59e0b22; color: #fbbf24; }
  .tag.installed { background: #0d946822; color: #34d399; }
  .tag.missing { background: #33333344; color: #666; }

  .tool-meta { padding: 6px 16px; font-size: 11px; color: #444; border-bottom: 1px solid #1e1e2e; }

  .server-list { padding: 6px; max-height: 300px; overflow-y: auto; }
  .server-item {
    padding: 8px 10px;
    border-radius: 6px;
    cursor: grab;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.15s;
    user-select: none;
    gap: 8px;
  }
  .server-item:hover { background: #1a1a2e; }
  .server-item:active { cursor: grabbing; }
  .server-item.dragging { opacity: 0.3; }
  .server-name { font-size: 12px; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .server-type { font-size: 10px; padding: 1px 5px; border-radius: 3px; flex-shrink: 0; }
  .server-type.stdio { background: #0d946822; color: #34d399; }
  .server-type.http { background: #f59e0b22; color: #fbbf24; }

  .delete-btn {
    opacity: 0;
    background: none;
    border: none;
    color: #ef4444;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 4px;
    border-radius: 4px;
    transition: all 0.15s;
    flex-shrink: 0;
  }
  .server-item:hover .delete-btn { opacity: 0.6; }
  .delete-btn:hover { opacity: 1 !important; background: #ef444422; }

  .empty { padding: 20px; text-align: center; color: #333; font-size: 12px; }

  .drop-hint {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 8px;
    text-align: center;
    font-size: 11px;
    background: #1a1a2e;
    border-top: 1px solid #2e2e3e;
    display: none;
  }
  .tool-card.drag-over .drop-hint { display: block; }
  .tool-card.drag-over .drop-hint { color: #60a5fa; }
  .tool-card.drag-over.warn .drop-hint { color: #fbbf24; }
  .tool-card.drag-over.blocked .drop-hint { color: #f87171; }

  .toast {
    position: fixed;
    bottom: 50px;
    right: 24px;
    background: #1a1a2e;
    border: 1px solid #2563eb;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    transform: translateY(100px);
    opacity: 0;
    transition: all 0.3s;
    z-index: 100;
    max-width: 400px;
  }
  .toast.show { transform: translateY(0); opacity: 1; }
  .toast.error { border-color: #ef4444; }
  .toast.warn { border-color: #f59e0b; }

  .drop-indicator {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(37, 99, 235, 0.03);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 50;
  }
  .drop-indicator.active { opacity: 1; }

  .status-bar {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    padding: 6px 32px;
    background: #0a0a0f;
    border-top: 1px solid #1a1a2e;
    font-size: 11px;
    color: #444;
    display: flex;
    justify-content: space-between;
  }

  @media (max-width: 768px) {
    .container { padding: 12px; gap: 12px; }
    .tool-card { width: 100%; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>mcpicker</h1>
  <span class="badge" id="totalBadge">loading...</span>
  <span class="hint">Drag servers between tools to sync</span>
</div>

<div class="container" id="container"></div>
<div class="toast" id="toast"></div>
<div class="drop-indicator" id="dropIndicator"></div>
<div class="status-bar">
  <span id="statusText">Loading...</span>
  <span>mcpicker dashboard :4747</span>
</div>

<script>
let tools = [];
let dragData = null;

async function loadTools() {
  const res = await fetch('/api/tools');
  tools = await res.json();
  render();
  const total = tools.reduce((s, t) => s + t.serverCount, 0);
  document.getElementById('totalBadge').textContent = total + ' servers / ' + tools.length + ' tools';
  document.getElementById('statusText').textContent = 'Ready';
}

function getToolTags(tool) {
  const tags = [];
  if (!tool.httpSupport) tags.push('<span class="tag no-http">no HTTP</span>');
  if (tool.format === 'toml') tags.push('<span class="tag toml">TOML</span>');
  return tags.join('');
}

function getDropInfo(sourceTool, targetTool, serverType) {
  if (targetTool.format === 'toml') {
    return { class: 'blocked', hint: 'TOML write not yet supported' };
  }
  if (serverType === 'http' && !targetTool.httpSupport) {
    return { class: 'warn', hint: 'HTTP server will be auto-converted via mcp-remote' };
  }
  return { class: '', hint: 'Drop to sync here' };
}

function render() {
  const container = document.getElementById('container');
  container.innerHTML = tools.map(tool => {
    const servers = Object.entries(tool.servers);
    const tags = getToolTags(tool);
    const installed = tool.serverCount > 0 || tool.configExists !== false;

    return \`
      <div class="tool-card \${!installed ? 'not-installed' : ''}" data-tool-id="\${tool.id}" data-format="\${tool.format}" data-http="\${tool.httpSupport}"
           ondragover="onDragOver(event, '\${tool.id}')"
           ondragleave="onDragLeave(event)"
           ondrop="onDrop(event, '\${tool.id}')">
        <div class="tool-card-header">
          <h2>\${tool.name} \${tags}</h2>
          <span class="count">\${servers.length}</span>
        </div>
        <div class="tool-meta">\${tool.configPath}</div>
        <div class="server-list">
          \${servers.length === 0 ? '<div class="empty">No MCP servers configured</div>' :
            servers.map(([name, srv]) => \`
              <div class="server-item" draggable="true"
                   data-server-type="\${srv.type}"
                   ondragstart="onDragStart(event, '\${tool.id}', '\${name}', '\${srv.type}')"
                   ondragend="onDragEnd(event)">
                <span class="server-name">\${name}</span>
                <span class="server-type \${srv.type}">\${srv.type}</span>
                <button class="delete-btn" onclick="onDelete(event, '\${tool.id}', '\${name}')" title="Delete server">x</button>
              </div>
            \`).join('')}
        </div>
        <div class="drop-hint" id="drop-hint-\${tool.id}"></div>
      </div>
    \`;
  }).join('');
}

function onDragStart(e, toolId, serverName, serverType) {
  dragData = { toolId, serverName, serverType };
  e.target.classList.add('dragging');
  document.getElementById('dropIndicator').classList.add('active');
  e.dataTransfer.effectAllowed = 'copy';
}

function onDragEnd(e) {
  e.target.classList.remove('dragging');
  document.getElementById('dropIndicator').classList.remove('active');
  document.querySelectorAll('.tool-card').forEach(c => {
    c.classList.remove('drag-over', 'warn', 'blocked');
  });
  dragData = null;
}

function onDragOver(e, toolId) {
  e.preventDefault();
  if (!dragData || dragData.toolId === toolId) return;

  const card = e.currentTarget;
  const targetTool = tools.find(t => t.id === toolId);
  const info = getDropInfo(
    tools.find(t => t.id === dragData.toolId),
    targetTool,
    dragData.serverType
  );

  card.classList.add('drag-over');
  card.classList.remove('warn', 'blocked');
  if (info.class) card.classList.add(info.class);

  const hint = document.getElementById('drop-hint-' + toolId);
  if (hint) hint.textContent = info.hint;

  e.dataTransfer.dropEffect = info.class === 'blocked' ? 'none' : 'copy';
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over', 'warn', 'blocked');
}

async function onDrop(e, targetToolId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over', 'warn', 'blocked');
  document.getElementById('dropIndicator').classList.remove('active');

  if (!dragData || dragData.toolId === targetToolId) return;

  const targetTool = tools.find(t => t.id === targetToolId);
  const info = getDropInfo(
    tools.find(t => t.id === dragData.toolId),
    targetTool,
    dragData.serverType
  );

  if (info.class === 'blocked') {
    showToast(info.hint, 'error');
    dragData = null;
    return;
  }

  const { toolId: sourceToolId, serverName } = dragData;
  dragData = null;

  const converting = info.class === 'warn';
  showToast(
    (converting ? 'Converting & syncing ' : 'Syncing ') + serverName + '...',
    converting ? 'warn' : ''
  );

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
      const msg = converting
        ? '\\u2713 ' + serverName + ' synced (HTTP \\u2192 mcp-remote)'
        : '\\u2713 ' + serverName + ' synced!';
      showToast(msg, '');
      await loadTools();
    } else {
      showToast('\\u2717 ' + (data.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showToast('\\u2717 ' + err.message, 'error');
  }
}

let lastAction = null;

async function onDelete(e, toolId, serverName) {
  e.stopPropagation();
  const tool = tools.find(t => t.id === toolId);
  const srv = tool.servers[serverName];
  if (!confirm('Delete "' + serverName + '" from ' + tool.name + '?\\n\\n(Auto-backup will be created)')) return;

  try {
    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId, serverName })
    });
    const data = await res.json();
    if (data.success) {
      lastAction = { type: 'delete', toolId, serverName, server: srv };
      showToastWithUndo('Deleted ' + serverName);
      await loadTools();
    } else {
      showToast('Error: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
}

async function undoLastAction() {
  if (!lastAction) return;
  if (lastAction.type === 'delete') {
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: lastAction.toolId,
          targetId: lastAction.toolId,
          serverNames: [lastAction.serverName],
          serverData: { [lastAction.serverName]: lastAction.server }
        })
      });
      showToast('Restored ' + lastAction.serverName, '');
      lastAction = null;
      await loadTools();
    } catch (err) {
      showToast('Undo failed: ' + err.message, 'error');
    }
  }
}

function showToastWithUndo(msg) {
  const toast = document.getElementById('toast');
  toast.innerHTML = msg + ' <button onclick="undoLastAction()" style="margin-left:12px;background:#2563eb;border:none;color:#fff;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:12px;">Undo</button>';
  toast.className = 'toast show';
  setTimeout(() => { toast.classList.remove('show'); }, 8000);
}

function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

loadTools();
</script>
</body>
</html>`;
