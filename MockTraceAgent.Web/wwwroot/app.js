// SignalR connection
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/traces")
    .withAutomaticReconnect()
    .build();

// State variables
let payloads = [];
let traces = [];
let selectedPayloadId = null;
let selectedChunkIndex = null;
let selectedPayloadSpanId = null;
let selectedTraceId = null;
let selectedTraceSpanId = null;
let urlFilter = '/v0.4/traces';
let showOnlyNonEmpty = true;
let showOnlyNonEmptyTraces = true;

// Current payload state
let currentTraceChunks = null;
let currentChunkSpans = null;

// HTML escape function
function escapeHtml(unsafe) {
    if (unsafe == null) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Start SignalR connection
async function startConnection() {
    try {
        await connection.start();
        console.log("SignalR connected");
        updateConnectionStatus(true);
        loadExistingPayloads();
    } catch (err) {
        console.error("SignalR connection error:", err);
        updateConnectionStatus(false);
        setTimeout(startConnection, 5000);
    }
}

// Handle incoming payload updates
connection.on("ReceiveTrace", (payload) => {
    console.log("New payload received:", payload);
    payloads.unshift(payload);
    renderPayloadList();
    updateStatistics();
});

// Connection handlers
connection.onreconnecting(() => {
    console.log("SignalR reconnecting...");
    updateConnectionStatus(false);
});

connection.onreconnected(() => {
    console.log("SignalR reconnected");
    updateConnectionStatus(true);
    loadExistingPayloads();
});

connection.onclose(() => {
    console.log("SignalR disconnected");
    updateConnectionStatus(false);
    setTimeout(startConnection, 5000);
});

// Update connection status in UI
function updateConnectionStatus(isConnected) {
    const statusElement = document.getElementById('connectionStatus');
    statusElement.textContent = isConnected ? 'Connected' : 'Disconnected';
    statusElement.className = isConnected ? 'stat-value connected' : 'stat-value';
}

// Load existing payloads from API
async function loadExistingPayloads() {
    try {
        const response = await fetch('/api/payloads');
        payloads = await response.json();
        renderPayloadList();
        updateStatistics();
    } catch (err) {
        console.error("Error loading payloads:", err);
    }
}

// Update statistics
async function updateStatistics() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();

        document.getElementById('totalTraces').textContent = stats.totalTraces.toLocaleString();
        document.getElementById('totalSpans').textContent = stats.totalSpans.toLocaleString();
        document.getElementById('totalBytes').textContent = formatBytes(stats.totalBytes);
    } catch (err) {
        console.error("Error updating statistics:", err);
    }
}

// Format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format duration (nanoseconds to human readable)
function formatDuration(nanos) {
    if (nanos < 1000) return nanos + ' ns';
    if (nanos < 1000000) return (nanos / 1000).toFixed(2) + ' μs';
    if (nanos < 1000000000) return (nanos / 1000000).toFixed(2) + ' ms';
    return (nanos / 1000000000).toFixed(2) + ' s';
}

// ============================================================================
// PAYLOADS VIEW
// ============================================================================

// Render payload list
function renderPayloadList() {
    const list = document.getElementById('payloadList');

    let filtered = payloads;

    // Apply URL filter
    if (urlFilter) {
        filtered = filtered.filter(p => p.url.includes(urlFilter));
    }

    // Apply non-empty filter
    if (showOnlyNonEmpty) {
        filtered = filtered.filter(p => {
            const isTraceEndpoint = p.url.includes('/v0.4/traces');
            return !isTraceEndpoint || p.totalSpanCount > 0;
        });
    }

    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty-message">No payloads match filters</p>';
        return;
    }

    // Sort by received time (newest first)
    const sorted = [...filtered].sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));

    list.innerHTML = '';
    sorted.forEach(payload => {
        const item = document.createElement('div');
        item.className = 'list-item';
        if (selectedPayloadId === payload.id) {
            item.classList.add('selected');
        }

        const isTraceEndpoint = payload.url.includes('/v0.4/traces');
        const statsHtml = isTraceEndpoint
            ? `${payload.traceChunkCount} chunks, ${payload.totalSpanCount} spans`
            : formatBytes(payload.contentLength);

        item.innerHTML = `
            <div class="item-time">${escapeHtml(payload.receivedAt)}</div>
            <div class="item-info">${escapeHtml(payload.url)}</div>
            <div class="item-stats">${statsHtml}</div>
        `;

        item.addEventListener('click', () => selectPayload(payload.id));
        list.appendChild(item);
    });
}

// Select a payload
async function selectPayload(payloadId) {
    selectedPayloadId = payloadId;
    selectedChunkIndex = null;
    selectedPayloadSpanId = null;
    currentChunkSpans = null;

    // Update UI
    renderPayloadList();

    // Load payload details
    try {
        const response = await fetch(`/api/payloads/${payloadId}`);
        const payload = await response.json();
        currentTraceChunks = payload.traceChunks;
        renderChunkList();
    } catch (err) {
        console.error("Error loading payload details:", err);
    }

    // Clear downstream panes
    document.getElementById('spanList').innerHTML = '<p class="empty-message">Select a trace chunk</p>';
    document.getElementById('payloadSpanDetails').innerHTML = '<p class="empty-message">Select a span</p>';
}

// Render trace chunk list
function renderChunkList() {
    const list = document.getElementById('chunkList');

    if (!currentTraceChunks || currentTraceChunks.length === 0) {
        list.innerHTML = '<p class="empty-message">No trace chunks in payload</p>';
        return;
    }

    list.innerHTML = '';
    currentTraceChunks.forEach((chunk, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        if (selectedChunkIndex === index) {
            item.classList.add('selected');
        }

        const traceId = chunk[0]?.traceId || 'N/A';

        item.innerHTML = `
            <div class="item-info"><strong>Trace ID:</strong> ${traceId}</div>
            <div class="item-stats">${chunk.length} spans</div>
        `;

        item.addEventListener('click', () => selectChunk(index));
        list.appendChild(item);
    });
}

// Select a trace chunk
function selectChunk(index) {
    selectedChunkIndex = index;
    selectedPayloadSpanId = null;

    // Store the current chunk's spans
    currentChunkSpans = currentTraceChunks[index];

    // Update UI
    renderChunkList();
    renderSpanList();

    // Clear span details
    document.getElementById('payloadSpanDetails').innerHTML = '<p class="empty-message">Select a span</p>';
}

// Render flat span list (no hierarchy)
function renderSpanList() {
    const list = document.getElementById('spanList');

    if (!currentChunkSpans || currentChunkSpans.length === 0) {
        list.innerHTML = '<p class="empty-message">No spans in chunk</p>';
        return;
    }

    list.innerHTML = '';
    currentChunkSpans.forEach(span => {
        const item = document.createElement('div');
        item.className = 'list-item span-item';
        if (selectedPayloadSpanId === span.spanId) {
            item.classList.add('selected');
        }
        if (span.error) {
            item.classList.add('error');
        }

        item.innerHTML = `
            <div class="span-header">
                <span class="span-service">${escapeHtml(span.service) || 'N/A'}</span>
                <span class="span-duration">${formatDuration(span.duration)}</span>
            </div>
            <div class="span-resource">${escapeHtml(span.resource) || 'N/A'}</div>
        `;

        item.addEventListener('click', () => selectPayloadSpan(span));
        list.appendChild(item);
    });
}

// Select a span from payload view
function selectPayloadSpan(span) {
    selectedPayloadSpanId = span.spanId;

    // Update UI
    renderSpanList();

    renderPayloadSpanDetails(span);
}

// Render span details for payload view
function renderPayloadSpanDetails(span) {
    const details = document.getElementById('payloadSpanDetails');

    const startTime = new Date(span.start / 1000000).toISOString();

    let html = `
        <div class="detail-section">
            <h4>Basic Info</h4>
            <div class="detail-row"><span class="detail-label">Service:</span><span class="detail-value">${escapeHtml(span.service) || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Resource:</span><span class="detail-value">${escapeHtml(span.resource) || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">${escapeHtml(span.name) || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Type:</span><span class="detail-value">${escapeHtml(span.type) || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Duration:</span><span class="detail-value">${formatDuration(span.duration)}</span></div>
            <div class="detail-row"><span class="detail-label">Start:</span><span class="detail-value">${startTime}</span></div>
            <div class="detail-row"><span class="detail-label">Error:</span><span class="detail-value ${span.error ? 'error-text' : ''}">${span.error ? 'Yes' : 'No'}</span></div>
        </div>

        <div class="detail-section">
            <h4>IDs</h4>
            <div class="detail-row"><span class="detail-label">Trace ID:</span><span class="detail-value">${span.traceId}</span></div>
            <div class="detail-row"><span class="detail-label">Span ID:</span><span class="detail-value">${span.spanId}</span></div>
            ${span.parentId ? `<div class="detail-row"><span class="detail-label">Parent ID:</span><span class="detail-value">${span.parentId}</span></div>` : ''}
        </div>
    `;

    if (span.tags && Object.keys(span.tags).length > 0) {
        html += '<div class="detail-section"><h4>Tags</h4>';
        for (const [key, value] of Object.entries(span.tags)) {
            html += `<div class="detail-row"><span class="detail-label">${escapeHtml(key)}:</span><span class="detail-value">${escapeHtml(value)}</span></div>`;
        }
        html += '</div>';
    }

    if (span.metrics && Object.keys(span.metrics).length > 0) {
        html += '<div class="detail-section"><h4>Metrics</h4>';
        for (const [key, value] of Object.entries(span.metrics)) {
            html += `<div class="detail-row"><span class="detail-label">${escapeHtml(key)}:</span><span class="detail-value">${value}</span></div>`;
        }
        html += '</div>';
    }

    details.innerHTML = html;
}

// ============================================================================
// TRACES VIEW
// ============================================================================

// Load traces from backend
async function loadTraces() {
    try {
        const response = await fetch('/api/traces');
        traces = await response.json();
        renderTraceList();
    } catch (err) {
        console.error("Error loading traces:", err);
    }
}

// Render trace list
function renderTraceList() {
    const list = document.getElementById('traceList');

    let filtered = traces;
    if (showOnlyNonEmptyTraces) {
        filtered = filtered.filter(t => t.spanCount > 0);
    }

    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty-message">No traces match filters</p>';
        return;
    }

    list.innerHTML = '';
    filtered.forEach(trace => {
        const item = document.createElement('div');
        item.className = 'list-item';
        if (selectedTraceId === trace.traceId) {
            item.classList.add('selected');
        }

        item.innerHTML = `
            <div class="item-info"><strong>Trace ID:</strong> ${escapeHtml(trace.traceId)}</div>
            <div class="item-stats">${trace.spanCount} spans</div>
            <div class="item-time">${escapeHtml(trace.lastSeen)}</div>
        `;

        item.addEventListener('click', () => selectTrace(trace.traceId));
        list.appendChild(item);
    });
}

// Select a trace
async function selectTrace(traceId) {
    selectedTraceId = traceId;
    selectedTraceSpanId = null;

    // Update UI
    renderTraceList();

    // Load trace details
    try {
        const response = await fetch(`/api/traces/${traceId}`);
        const trace = await response.json();
        renderSpanTree(trace.spans);
    } catch (err) {
        console.error("Error loading trace details:", err);
    }

    // Clear span details
    document.getElementById('traceSpanDetails').innerHTML = '<p class="empty-message">Select a span</p>';
}

// Render span tree (hierarchical)
function renderSpanTree(spans) {
    const list = document.getElementById('spanTreeList');

    if (!spans || spans.length === 0) {
        list.innerHTML = '<p class="empty-message">No spans in trace</p>';
        return;
    }

    // Build parent-child relationships
    const spanMap = new Map();
    const rootSpans = [];

    spans.forEach(span => {
        spanMap.set(span.spanId, { ...span, children: [] });
    });

    spans.forEach(span => {
        const spanNode = spanMap.get(span.spanId);
        if (span.parentId && spanMap.has(span.parentId)) {
            spanMap.get(span.parentId).children.push(spanNode);
        } else {
            rootSpans.push(spanNode);
        }
    });

    // Render tree
    list.innerHTML = '';
    rootSpans.forEach(span => {
        renderSpanTreeNode(span, 0, list);
    });
}

// Render individual span tree node
function renderSpanTreeNode(span, depth, container) {
    const item = document.createElement('div');
    item.className = 'list-item span-tree-node';
    item.style.marginLeft = `${depth * 1.5}rem`;
    if (selectedTraceSpanId === span.spanId) {
        item.classList.add('selected');
    }
    if (span.error) {
        item.classList.add('error');
    }

    item.innerHTML = `
        <div class="span-header">
            <span class="span-service">${escapeHtml(span.service) || 'N/A'}</span>
            <span class="span-duration">${formatDuration(span.duration)}</span>
        </div>
        <div class="span-resource">${escapeHtml(span.resource) || 'N/A'}</div>
    `;

    item.addEventListener('click', (e) => {
        e.stopPropagation();
        selectTraceSpan(span);
    });

    container.appendChild(item);

    // Render children
    if (span.children && span.children.length > 0) {
        span.children.forEach(child => {
            renderSpanTreeNode(child, depth + 1, container);
        });
    }
}

// Select a span from trace view
function selectTraceSpan(span) {
    selectedTraceSpanId = span.spanId;

    // Update UI - need to re-render entire tree to update selection
    document.querySelectorAll('#spanTreeList .list-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.target.closest('.list-item')?.classList.add('selected');

    renderTraceSpanDetails(span);
}

// Render span details for trace view
function renderTraceSpanDetails(span) {
    const details = document.getElementById('traceSpanDetails');

    const startTime = new Date(span.start / 1000000).toISOString();

    let html = `
        <div class="detail-section">
            <h4>Basic Info</h4>
            <div class="detail-row"><span class="detail-label">Service:</span><span class="detail-value">${escapeHtml(span.service) || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Resource:</span><span class="detail-value">${escapeHtml(span.resource) || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Name:</span><span class="detail-value">${escapeHtml(span.name) || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Type:</span><span class="detail-value">${escapeHtml(span.type) || 'N/A'}</span></div>
            <div class="detail-row"><span class="detail-label">Duration:</span><span class="detail-value">${formatDuration(span.duration)}</span></div>
            <div class="detail-row"><span class="detail-label">Start:</span><span class="detail-value">${startTime}</span></div>
            <div class="detail-row"><span class="detail-label">Error:</span><span class="detail-value ${span.error ? 'error-text' : ''}">${span.error ? 'Yes' : 'No'}</span></div>
        </div>

        <div class="detail-section">
            <h4>IDs</h4>
            <div class="detail-row"><span class="detail-label">Trace ID:</span><span class="detail-value">${span.traceId}</span></div>
            <div class="detail-row"><span class="detail-label">Span ID:</span><span class="detail-value">${span.spanId}</span></div>
            ${span.parentId ? `<div class="detail-row"><span class="detail-label">Parent ID:</span><span class="detail-value">${span.parentId}</span></div>` : ''}
        </div>
    `;

    if (span.tags && Object.keys(span.tags).length > 0) {
        html += '<div class="detail-section"><h4>Tags</h4>';
        for (const [key, value] of Object.entries(span.tags)) {
            html += `<div class="detail-row"><span class="detail-label">${escapeHtml(key)}:</span><span class="detail-value">${escapeHtml(value)}</span></div>`;
        }
        html += '</div>';
    }

    if (span.metrics && Object.keys(span.metrics).length > 0) {
        html += '<div class="detail-section"><h4>Metrics</h4>';
        for (const [key, value] of Object.entries(span.metrics)) {
            html += `<div class="detail-row"><span class="detail-label">${escapeHtml(key)}:</span><span class="detail-value">${value}</span></div>`;
        }
        html += '</div>';
    }

    details.innerHTML = html;
}

// ============================================================================
// VIEW SWITCHING & FILTERS
// ============================================================================

function setupViewSwitcher() {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;

            // Update button states
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update view content
            document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
            document.getElementById(`${view}-view`).classList.add('active');

            // Load data for the selected view
            if (view === 'traces') {
                loadTraces();
            }
        });
    });
}

function setupUrlFilter() {
    const urlFilterInput = document.getElementById('urlFilter');
    urlFilterInput.addEventListener('input', (e) => {
        urlFilter = e.target.value;
        renderPayloadList();
    });
}

function setupPayloadFilter() {
    const checkbox = document.getElementById('showOnlyNonEmpty');
    const urlFilterInput = document.getElementById('urlFilter');

    if (checkbox.checked) {
        urlFilterInput.disabled = true;
    }

    checkbox.addEventListener('change', (e) => {
        showOnlyNonEmpty = e.target.checked;

        if (e.target.checked) {
            urlFilter = '/v0.4/traces';
            urlFilterInput.value = '/v0.4/traces';
            urlFilterInput.disabled = true;
        } else {
            urlFilterInput.disabled = false;
        }

        renderPayloadList();
    });
}

function setupTraceFilter() {
    const checkbox = document.getElementById('showOnlyNonEmptyTraces');
    if (checkbox) {
        checkbox.addEventListener('change', (e) => {
            showOnlyNonEmptyTraces = e.target.checked;
            renderTraceList();
        });
    }
}

// Initialize
setupViewSwitcher();
setupUrlFilter();
setupPayloadFilter();
setupTraceFilter();
startConnection();

