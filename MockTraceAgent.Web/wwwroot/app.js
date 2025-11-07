// SignalR connection
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/traces")
    .withAutomaticReconnect()
    .build();

let selectedTraceId = null;
let traces = [];

// Start SignalR connection
async function startConnection() {
    try {
        await connection.start();
        console.log("SignalR connected");
        updateConnectionStatus(true);
        loadExistingTraces();
    } catch (err) {
        console.error("SignalR connection error:", err);
        updateConnectionStatus(false);
        setTimeout(startConnection, 5000);
    }
}

// Handle incoming trace updates
connection.on("ReceiveTrace", (trace) => {
    console.log("New trace received:", trace);
    traces.unshift(trace);
    addTraceToList(trace);
    updateStatistics();
});

// Connection status handlers
connection.onreconnecting(() => {
    console.log("SignalR reconnecting...");
    updateConnectionStatus(false);
});

connection.onreconnected(() => {
    console.log("SignalR reconnected");
    updateConnectionStatus(true);
    loadExistingTraces();
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

// Load existing traces from API
async function loadExistingTraces() {
    try {
        const response = await fetch('/api/traces');
        traces = await response.json();
        renderTraceList();
        updateStatistics();
    } catch (err) {
        console.error("Error loading traces:", err);
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

// Render trace list
function renderTraceList() {
    const traceList = document.getElementById('traceList');

    if (traces.length === 0) {
        traceList.innerHTML = '<p class="empty-message">No traces received yet. Waiting for incoming traces...</p>';
        return;
    }

    traceList.innerHTML = '';
    traces.forEach(trace => {
        addTraceToList(trace);
    });
}

// Add single trace to list
function addTraceToList(trace) {
    const traceList = document.getElementById('traceList');

    // Remove empty message if present
    const emptyMessage = traceList.querySelector('.empty-message');
    if (emptyMessage) {
        emptyMessage.remove();
    }

    const traceItem = document.createElement('div');
    traceItem.className = 'trace-item';
    traceItem.dataset.traceId = trace.id;

    if (selectedTraceId === trace.id) {
        traceItem.classList.add('selected');
    }

    traceItem.innerHTML = `
        <div class="trace-item-header">
            <span class="trace-id">${trace.id.substring(0, 8)}</span>
            <span class="trace-time">${trace.receivedAt}</span>
        </div>
        <div class="trace-item-info">
            <span><strong>URL:</strong> ${trace.url}</span>
        </div>
        <div class="trace-item-info">
            <span>${formatBytes(trace.contentLength)}</span>
            <span>${trace.traceChunkCount} chunks</span>
            <span>${trace.totalSpanCount} spans</span>
        </div>
    `;

    traceItem.addEventListener('click', () => selectTrace(trace.id));

    // Add to top of list
    traceList.insertBefore(traceItem, traceList.firstChild);
}

// Select and display trace details
async function selectTrace(traceId) {
    selectedTraceId = traceId;

    // Update selected state in list
    document.querySelectorAll('.trace-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.traceId === traceId);
    });

    // Load trace details
    try {
        const response = await fetch(`/api/traces/${traceId}`);
        const trace = await response.json();
        displayTraceDetails(trace);
    } catch (err) {
        console.error("Error loading trace details:", err);
    }
}

// Display trace details
function displayTraceDetails(trace) {
    const detailsPanel = document.getElementById('traceDetails');

    detailsPanel.innerHTML = `
        <h3>Trace Details</h3>

        <div class="trace-info">
            <div class="trace-info-row">
                <span class="trace-info-label">Trace ID:</span>
                <span class="trace-info-value">${trace.id}</span>
            </div>
            <div class="trace-info-row">
                <span class="trace-info-label">Received At:</span>
                <span class="trace-info-value">${trace.receivedAt}</span>
            </div>
            <div class="trace-info-row">
                <span class="trace-info-label">URL:</span>
                <span class="trace-info-value">${trace.url}</span>
            </div>
            <div class="trace-info-row">
                <span class="trace-info-label">Content Length:</span>
                <span class="trace-info-value">${formatBytes(trace.contentLength)}</span>
            </div>
            <div class="trace-info-row">
                <span class="trace-info-label">Trace Chunks:</span>
                <span class="trace-info-value">${trace.traceChunkCount}</span>
            </div>
            <div class="trace-info-row">
                <span class="trace-info-label">Total Spans:</span>
                <span class="trace-info-value">${trace.totalSpanCount}</span>
            </div>
        </div>

        <div class="actions">
            <a href="/api/traces/${trace.id}/raw" class="btn" download="trace-${trace.id}.bin">Download Raw MessagePack</a>
            <a href="/api/traces/${trace.id}/json" class="btn btn-secondary" download="trace-${trace.id}.json">Download JSON</a>
        </div>

        <div class="tabs">
            <div class="tab active" data-tab="spans">Span Hierarchy</div>
            <div class="tab" data-tab="json">JSON View</div>
        </div>

        <div class="tab-content active" id="tab-spans">
            ${trace.traceChunks ? renderSpanHierarchy(trace.traceChunks) : '<p>No span data available</p>'}
        </div>

        <div class="tab-content" id="tab-json">
            <div class="json-viewer">${trace.traceChunks ? syntaxHighlight(JSON.stringify(trace.traceChunks, null, 2)) : 'No data'}</div>
        </div>
    `;

    // Setup tab switching
    detailsPanel.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            detailsPanel.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            detailsPanel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });
}

// Render span hierarchy
function renderSpanHierarchy(traceChunks) {
    let html = '<div class="span-tree">';

    traceChunks.forEach((chunk, chunkIndex) => {
        html += `<h4>Trace Chunk ${chunkIndex + 1}</h4>`;

        // Build parent-child relationships
        const spanMap = new Map();
        const rootSpans = [];

        chunk.forEach(span => {
            spanMap.set(span.spanId, { ...span, children: [] });
        });

        chunk.forEach(span => {
            const spanNode = spanMap.get(span.spanId);
            if (span.parentId && spanMap.has(span.parentId)) {
                spanMap.get(span.parentId).children.push(spanNode);
            } else {
                rootSpans.push(spanNode);
            }
        });

        // Render tree
        rootSpans.forEach(span => {
            html += renderSpanNode(span, 0);
        });
    });

    html += '</div>';
    return html;
}

// Render individual span node
function renderSpanNode(span, depth) {
    const duration = formatDuration(span.duration);
    const errorClass = span.error ? 'error' : '';

    let html = `
        <div class="span-node" style="margin-left: ${depth * 2}rem;">
            <div class="span-card ${errorClass}">
                <div class="span-card-header">
                    <span class="span-name">${span.name || 'unnamed'}</span>
                    <span class="span-duration">${duration}</span>
                </div>
                <div class="span-info">
                    <span class="span-info-label">Service:</span> ${span.service || 'N/A'}
                </div>
                <div class="span-info">
                    <span class="span-info-label">Resource:</span> ${span.resource || 'N/A'}
                </div>
                <div class="span-info">
                    <span class="span-info-label">Type:</span> ${span.type || 'N/A'}
                </div>
                <div class="span-info">
                    <span class="span-info-label">Span ID:</span> ${span.spanId}
                </div>
                ${span.parentId ? `<div class="span-info"><span class="span-info-label">Parent ID:</span> ${span.parentId}</div>` : ''}
                ${span.error ? '<div class="span-info" style="color: #e74c3c;"><span class="span-info-label">Error:</span> Yes</div>' : ''}
                ${renderTags(span.tags)}
                ${renderMetrics(span.metrics)}
            </div>
        </div>
    `;

    // Render children
    if (span.children && span.children.length > 0) {
        span.children.forEach(child => {
            html += renderSpanNode(child, depth + 1);
        });
    }

    return html;
}

// Render span tags
function renderTags(tags) {
    if (!tags || Object.keys(tags).length === 0) {
        return '';
    }

    let html = '<div class="span-tags"><strong>Tags:</strong> ';
    for (const [key, value] of Object.entries(tags)) {
        html += `<span class="span-tag"><span class="span-tag-key">${key}:</span> ${value}</span>`;
    }
    html += '</div>';
    return html;
}

// Render span metrics
function renderMetrics(metrics) {
    if (!metrics || Object.keys(metrics).length === 0) {
        return '';
    }

    let html = '<div class="span-tags"><strong>Metrics:</strong> ';
    for (const [key, value] of Object.entries(metrics)) {
        html += `<span class="span-tag"><span class="span-tag-key">${key}:</span> ${value}</span>`;
    }
    html += '</div>';
    return html;
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

// Syntax highlight JSON
function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
                return '<span style="color: #c678dd;">' + match + '</span>';
            } else {
                cls = 'string';
                return '<span style="color: #98c379;">' + match + '</span>';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
            return '<span style="color: #d19a66;">' + match + '</span>';
        } else if (/null/.test(match)) {
            cls = 'null';
            return '<span style="color: #56b6c2;">' + match + '</span>';
        }
        return '<span style="color: #d19a66;">' + match + '</span>';
    });
}

// Initialize
startConnection();
