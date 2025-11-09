// SignalR connection
const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/traces")
    .withAutomaticReconnect()
    .build();

let selectedTraceId = null;
let traces = [];
let urlFilter = '/v0.4/traces';
let showOnlyNonEmpty = true;

// HTML escape function to prevent XSS
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
        const response = await fetch('/api/payloads');
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

// Get filtered traces based on URL filter and empty payload filter
function getFilteredTraces() {
    let filtered = traces;

    // Apply URL filter
    if (urlFilter) {
        filtered = filtered.filter(trace => trace.url.includes(urlFilter));
    }

    // Apply non-empty filter
    if (showOnlyNonEmpty) {
        filtered = filtered.filter(trace => {
            const isTraceEndpoint = trace.url.includes('/v0.4/traces');
            // Keep non-trace endpoints, and trace endpoints with spans > 0
            return !isTraceEndpoint || trace.totalSpanCount > 0;
        });
    }

    return filtered;
}

// Render trace list
function renderTraceList() {
    const traceList = document.getElementById('traceList');
    const filteredTraces = getFilteredTraces();

    if (traces.length === 0) {
        traceList.innerHTML = '<p class="empty-message">No traces received yet. Waiting for incoming traces...</p>';
        return;
    }

    if (filteredTraces.length === 0) {
        traceList.innerHTML = '<p class="empty-message">No traces match the current filter.</p>';
        return;
    }

    // Sort by receivedAt (most recent first)
    const sortedTraces = [...filteredTraces].sort((a, b) => {
        return new Date(b.receivedAt) - new Date(a.receivedAt);
    });

    traceList.innerHTML = '';
    sortedTraces.forEach(trace => {
        addTraceToList(trace);
    });
}

// Add single trace to list
function addTraceToList(trace) {
    const traceList = document.getElementById('traceList');

    // Check if trace matches current filters
    if (urlFilter && !trace.url.includes(urlFilter)) {
        return; // Skip this trace if it doesn't match the URL filter
    }

    // Check non-empty filter
    const isTraceEndpoint = trace.url.includes('/v0.4/traces');
    if (showOnlyNonEmpty && isTraceEndpoint && trace.totalSpanCount === 0) {
        return; // Skip empty trace payloads if showing only non-empty
    }

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

    // Add class for empty payloads (zero spans) or non-trace endpoints
    if (!isTraceEndpoint || (isTraceEndpoint && trace.totalSpanCount === 0)) {
        traceItem.classList.add('empty-payload');
    }

    // Build the stats line - only show chunks/spans for trace endpoints
    let statsHtml = `<span>${formatBytes(trace.contentLength)}</span>`;
    if (isTraceEndpoint) {
        statsHtml += `
            <span>${trace.traceChunkCount} chunks</span>
            <span class="${trace.totalSpanCount === 0 ? 'zero-spans' : ''}">${trace.totalSpanCount} spans</span>
        `;
    }

    traceItem.innerHTML = `
        <div class="trace-item-header">
            <span class="trace-time">${escapeHtml(trace.receivedAt)}</span>
        </div>
        <div class="trace-item-info">
            <span><strong>URL:</strong> ${escapeHtml(trace.url)}</span>
        </div>
        <div class="trace-item-info">
            ${statsHtml}
        </div>
        <div class="trace-item-actions">
            <a href="/api/payloads/${escapeHtml(trace.id)}/raw" class="trace-item-btn" download="payload-${escapeHtml(trace.id)}.bin" title="Download Raw MessagePack">
                <span>📦 Raw</span>
            </a>
            <a href="/api/payloads/${escapeHtml(trace.id)}/json" class="trace-item-btn" download="payload-${escapeHtml(trace.id)}.json" title="Download JSON">
                <span>📄 JSON</span>
            </a>
        </div>
    `;

    traceItem.addEventListener('click', (e) => {
        // Don't trigger selection if clicking on download buttons
        if (e.target.closest('.trace-item-actions')) {
            return;
        }
        selectTrace(trace.id);
    });

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
        const response = await fetch(`/api/payloads/${traceId}`);
        const trace = await response.json();
        displayTraceDetails(trace);
    } catch (err) {
        console.error("Error loading trace details:", err);
    }
}

// Display trace details
function displayTraceDetails(trace) {
    const detailsPanel = document.getElementById('traceDetails');
    const isTraceEndpoint = trace.url.includes('/v0.4/traces');

    // Only show details for trace endpoints
    if (!isTraceEndpoint) {
        detailsPanel.innerHTML = '<p class="empty-message">Select a trace payload to view details</p>';
        return;
    }

    detailsPanel.innerHTML = `
        <h3>Payload Details</h3>

        <div class="tabs">
            <div class="tab active" data-tab="spans">Span Hierarchy</div>
            <div class="tab" data-tab="json">JSON View</div>
        </div>

        <div class="tab-content active" id="tab-spans">
            ${trace.traceChunks ? renderSpanHierarchyDrilldown(trace.traceChunks) : '<p>No span data available</p>'}
        </div>

        <div class="tab-content" id="tab-json">
            <pre class="json-viewer">${trace.traceChunks ? syntaxHighlight(JSON.stringify(trace.traceChunks, null, 2)) : 'No data'}</pre>
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

    // Setup drilldown event handlers
    setupDrilldownHandlers(trace.traceChunks);
}

// Setup event handlers for span hierarchy drilldown
function setupDrilldownHandlers(traceChunks) {
    if (!traceChunks) return;

    // Store trace chunks for later access
    window.currentTraceChunks = traceChunks;

    // Chunk selection handler
    setTimeout(() => {
        document.querySelectorAll('.chunk-item').forEach(item => {
            item.addEventListener('click', () => {
                // Remove previous selection
                document.querySelectorAll('.chunk-item').forEach(i => i.classList.remove('selected'));
                // Add selection to clicked item
                item.classList.add('selected');

                const chunkIndex = parseInt(item.dataset.chunkIndex);
                const chunk = traceChunks[chunkIndex];

                // Render span tree
                const spanTreeDiv = document.getElementById('spanTree');
                spanTreeDiv.innerHTML = renderSpanTree(chunk);

                // Clear span details
                document.getElementById('spanDetails').innerHTML = '<p class="empty-message">Select a span to view details</p>';

                // Store current chunk
                window.currentChunk = chunk;

                // Setup span tree click handlers
                setupSpanTreeHandlers();
            });
        });
    }, 0);
}

// Setup event handlers for span tree nodes
function setupSpanTreeHandlers() {
    document.querySelectorAll('.span-tree-node').forEach(node => {
        node.addEventListener('click', (e) => {
            e.stopPropagation();

            // Remove previous selection
            document.querySelectorAll('.span-tree-node').forEach(n => n.classList.remove('selected'));
            // Add selection to clicked node
            node.classList.add('selected');

            const spanId = node.dataset.spanId;
            const span = findSpanById(window.currentChunk, spanId);

            if (span) {
                // Render span details
                const spanDetailsDiv = document.getElementById('spanDetails');
                spanDetailsDiv.innerHTML = renderSpanDetails(span);
            }
        });
    });
}

// Find span by ID in chunk
function findSpanById(chunk, spanId) {
    return chunk.find(span => span.spanId.toString() === spanId.toString());
}

// Render span hierarchy drilldown with three panes
function renderSpanHierarchyDrilldown(traceChunks) {
    return `
        <div class="drilldown-container">
            <div class="drilldown-pane chunks-pane">
                <h4>Trace Chunks</h4>
                <div id="chunksList">
                    ${renderTraceChunksList(traceChunks)}
                </div>
            </div>
            <div class="drilldown-pane spans-pane">
                <h4>Span Tree</h4>
                <div id="spanTree">
                    <p class="empty-message">Select a trace chunk to view spans</p>
                </div>
            </div>
            <div class="drilldown-pane span-details-pane">
                <h4>Span Details</h4>
                <div id="spanDetails">
                    <p class="empty-message">Select a span to view details</p>
                </div>
            </div>
        </div>
    `;
}

// Render list of trace chunks
function renderTraceChunksList(traceChunks) {
    let html = '';
    traceChunks.forEach((chunk, chunkIndex) => {
        const traceId = chunk[0]?.traceId || 'N/A';
        const spanCount = chunk.length;
        html += `
            <div class="chunk-item" data-chunk-index="${chunkIndex}">
                <div class="chunk-info">
                    <span class="chunk-label">Trace ID:</span>
                    <span class="chunk-value">${traceId}</span>
                </div>
                <div class="chunk-info">
                    <span class="chunk-label">Spans:</span>
                    <span class="chunk-value">${spanCount}</span>
                </div>
            </div>
        `;
    });
    return html;
}

// Render span tree for a selected chunk
function renderSpanTree(chunk) {
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
    let html = '<div class="span-tree-list">';
    rootSpans.forEach(span => {
        html += renderSpanTreeNode(span, 0);
    });
    html += '</div>';
    return html;
}

// Render minimal span node for tree view
function renderSpanTreeNode(span, depth) {
    const duration = formatDuration(span.duration);
    const errorClass = span.error ? 'error' : '';

    let html = `
        <div class="span-tree-node ${errorClass}" style="margin-left: ${depth * 1.5}rem;" data-span-id="${span.spanId}">
            <div class="span-tree-item">
                <span class="span-tree-service">${escapeHtml(span.service) || 'N/A'}</span>
                <span class="span-tree-resource">${escapeHtml(span.resource) || 'N/A'}</span>
                <span class="span-tree-duration">${duration}</span>
            </div>
        </div>
    `;

    // Render children
    if (span.children && span.children.length > 0) {
        span.children.forEach(child => {
            html += renderSpanTreeNode(child, depth + 1);
        });
    }

    return html;
}

// Render full span details
function renderSpanDetails(span) {
    const duration = formatDuration(span.duration);
    const startTime = new Date(span.start / 1000000).toISOString();

    let html = `
        <div class="span-detail-section">
            <div class="span-detail-row">
                <span class="span-detail-label">Service:</span>
                <span class="span-detail-value">${escapeHtml(span.service) || 'N/A'}</span>
            </div>
            <div class="span-detail-row">
                <span class="span-detail-label">Resource:</span>
                <span class="span-detail-value">${escapeHtml(span.resource) || 'N/A'}</span>
            </div>
            <div class="span-detail-row">
                <span class="span-detail-label">Name:</span>
                <span class="span-detail-value">${escapeHtml(span.name) || 'unnamed'}</span>
            </div>
            <div class="span-detail-row">
                <span class="span-detail-label">Type:</span>
                <span class="span-detail-value">${escapeHtml(span.type) || 'N/A'}</span>
            </div>
            <div class="span-detail-row">
                <span class="span-detail-label">Span ID:</span>
                <span class="span-detail-value">${span.spanId}</span>
            </div>
            <div class="span-detail-row">
                <span class="span-detail-label">Trace ID:</span>
                <span class="span-detail-value">${span.traceId}</span>
            </div>
            ${span.parentId ? `
            <div class="span-detail-row">
                <span class="span-detail-label">Parent ID:</span>
                <span class="span-detail-value">${span.parentId}</span>
            </div>
            ` : ''}
            <div class="span-detail-row">
                <span class="span-detail-label">Start:</span>
                <span class="span-detail-value">${startTime}</span>
            </div>
            <div class="span-detail-row">
                <span class="span-detail-label">Duration:</span>
                <span class="span-detail-value">${duration}</span>
            </div>
            <div class="span-detail-row">
                <span class="span-detail-label">Error:</span>
                <span class="span-detail-value ${span.error ? 'error-text' : ''}">${span.error ? 'Yes' : 'No'}</span>
            </div>
        </div>

        ${renderTagsSection(span.tags)}
        ${renderMetricsSection(span.metrics)}
    `;

    return html;
}

// Render tags section for span details
function renderTagsSection(tags) {
    if (!tags || Object.keys(tags).length === 0) {
        return '';
    }

    let html = '<div class="span-detail-section"><h5>Tags</h5>';
    for (const [key, value] of Object.entries(tags)) {
        html += `
            <div class="span-detail-row">
                <span class="span-detail-label">${escapeHtml(key)}:</span>
                <span class="span-detail-value">${escapeHtml(value)}</span>
            </div>
        `;
    }
    html += '</div>';
    return html;
}

// Render metrics section for span details
function renderMetricsSection(metrics) {
    if (!metrics || Object.keys(metrics).length === 0) {
        return '';
    }

    let html = '<div class="span-detail-section"><h5>Metrics</h5>';
    for (const [key, value] of Object.entries(metrics)) {
        html += `
            <div class="span-detail-row">
                <span class="span-detail-label">${escapeHtml(key)}:</span>
                <span class="span-detail-value">${value}</span>
            </div>
        `;
    }
    html += '</div>';
    return html;
}

// Old render span hierarchy (keeping for compatibility)
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
                    <span class="span-name">${escapeHtml(span.name) || 'unnamed'}</span>
                    <span class="span-duration">${duration}</span>
                </div>
                <div class="span-info">
                    <span class="span-info-label">Service:</span> ${escapeHtml(span.service) || 'N/A'}
                </div>
                <div class="span-info">
                    <span class="span-info-label">Resource:</span> ${escapeHtml(span.resource) || 'N/A'}
                </div>
                <div class="span-info">
                    <span class="span-info-label">Type:</span> ${escapeHtml(span.type) || 'N/A'}
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
        html += `<span class="span-tag"><span class="span-tag-key">${escapeHtml(key)}:</span> ${escapeHtml(value)}</span>`;
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
        html += `<span class="span-tag"><span class="span-tag-key">${escapeHtml(key)}:</span> ${value}</span>`;
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

// Setup URL filter
function setupUrlFilter() {
    const urlFilterInput = document.getElementById('urlFilter');

    urlFilterInput.addEventListener('input', (e) => {
        urlFilter = e.target.value;
        renderTraceList();
    });
}

// Setup non-empty payload filter
function setupNonEmptyPayloadFilter() {
    const showOnlyNonEmptyCheckbox = document.getElementById('showOnlyNonEmpty');
    const urlFilterInput = document.getElementById('urlFilter');

    // Set initial state
    if (showOnlyNonEmptyCheckbox.checked) {
        urlFilterInput.disabled = true;
    }

    showOnlyNonEmptyCheckbox.addEventListener('change', (e) => {
        showOnlyNonEmpty = e.target.checked;

        // When checked, set URL filter to /v0.4/traces and disable textbox
        if (e.target.checked) {
            urlFilter = '/v0.4/traces';
            urlFilterInput.value = '/v0.4/traces';
            urlFilterInput.disabled = true;
        } else {
            // When unchecked, enable textbox
            urlFilterInput.disabled = false;
        }

        renderTraceList();
    });
}

// Combined traces view variables
let combinedTraces = new Map(); // traceId -> { traceId, spans: [], firstSeen, lastSeen }
let showOnlyNonEmptyTraces = true;
let selectedCombinedTraceId = null;

// Process payloads to extract and combine traces
function processCombinedTraces() {
    combinedTraces.clear();

    traces.forEach(payload => {
        if (!payload.url.includes('/v0.4/traces') || !payload.traceChunks) {
            return;
        }

        payload.traceChunks.forEach(chunk => {
            chunk.forEach(span => {
                const traceId = span.traceId;
                if (!combinedTraces.has(traceId)) {
                    combinedTraces.set(traceId, {
                        traceId: traceId,
                        spans: [],
                        firstSeen: payload.receivedAt,
                        lastSeen: payload.receivedAt
                    });
                }

                const trace = combinedTraces.get(traceId);
                trace.spans.push(span);

                // Update time range
                if (payload.receivedAt < trace.firstSeen) {
                    trace.firstSeen = payload.receivedAt;
                }
                if (payload.receivedAt > trace.lastSeen) {
                    trace.lastSeen = payload.receivedAt;
                }
            });
        });
    });

    renderCombinedTraceList();
}

// Render combined trace list
function renderCombinedTraceList() {
    const traceList = document.getElementById('combinedTraceList');

    if (combinedTraces.size === 0) {
        traceList.innerHTML = '<p class="empty-message">No traces received yet. Waiting for incoming traces...</p>';
        return;
    }

    // Filter traces
    let tracesArray = Array.from(combinedTraces.values());
    if (showOnlyNonEmptyTraces) {
        tracesArray = tracesArray.filter(trace => trace.spans.length > 0);
    }

    if (tracesArray.length === 0) {
        traceList.innerHTML = '<p class="empty-message">No traces match the current filter.</p>';
        return;
    }

    // Sort by last seen (most recent first)
    tracesArray.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

    traceList.innerHTML = '';
    tracesArray.forEach(trace => {
        addCombinedTraceToList(trace);
    });
}

// Add combined trace to list
function addCombinedTraceToList(trace) {
    const traceList = document.getElementById('combinedTraceList');

    const traceItem = document.createElement('div');
    traceItem.className = 'trace-item';
    traceItem.dataset.traceId = trace.traceId;

    if (selectedCombinedTraceId === trace.traceId) {
        traceItem.classList.add('selected');
    }

    if (trace.spans.length === 0) {
        traceItem.classList.add('empty-payload');
    }

    traceItem.innerHTML = `
        <div class="trace-item-header">
            <span class="trace-time">${escapeHtml(trace.lastSeen)}</span>
        </div>
        <div class="trace-item-info">
            <span><strong>Trace ID:</strong> ${escapeHtml(trace.traceId.toString())}</span>
        </div>
        <div class="trace-item-info">
            <span>${trace.spans.length} spans</span>
        </div>
    `;

    traceItem.addEventListener('click', () => selectCombinedTrace(trace.traceId));

    traceList.insertBefore(traceItem, traceList.firstChild);
}

// Select and display combined trace details
function selectCombinedTrace(traceId) {
    selectedCombinedTraceId = traceId;

    // Update selected state in list
    document.querySelectorAll('#combinedTraceList .trace-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.traceId === traceId.toString());
    });

    const trace = combinedTraces.get(traceId);
    if (!trace) return;

    displayCombinedTraceDetails(trace);
}

// Display combined trace details
function displayCombinedTraceDetails(trace) {
    const detailsPanel = document.getElementById('traceDetails');

    detailsPanel.innerHTML = `
        <h3>Trace Details</h3>

        <div class="trace-info" style="margin-bottom: 1.5rem;">
            <div class="trace-info-row">
                <span class="trace-info-label">Trace ID:</span>
                <span class="trace-info-value">${escapeHtml(trace.traceId.toString())}</span>
            </div>
            <div class="trace-info-row">
                <span class="trace-info-label">Total Spans:</span>
                <span class="trace-info-value">${trace.spans.length}</span>
            </div>
            <div class="trace-info-row">
                <span class="trace-info-label">First Seen:</span>
                <span class="trace-info-value">${escapeHtml(trace.firstSeen)}</span>
            </div>
            <div class="trace-info-row">
                <span class="trace-info-label">Last Seen:</span>
                <span class="trace-info-value">${escapeHtml(trace.lastSeen)}</span>
            </div>
        </div>

        <h4 style="margin-bottom: 1rem;">Span Tree</h4>
        <div style="flex: 1; overflow-y: auto;">
            ${renderCombinedTraceSpanTree(trace.spans)}
        </div>
    `;
}

// Render span tree for combined trace
function renderCombinedTraceSpanTree(spans) {
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
    let html = '<div class="span-tree-list">';
    rootSpans.forEach(span => {
        html += renderSpanTreeNode(span, 0);
    });
    html += '</div>';

    // Setup click handlers after render
    setTimeout(() => {
        setupCombinedTraceSpanHandlers(spans);
    }, 0);

    return html;
}

// Setup span click handlers for combined trace view
function setupCombinedTraceSpanHandlers(spans) {
    document.querySelectorAll('.span-tree-node').forEach(node => {
        node.addEventListener('click', (e) => {
            e.stopPropagation();

            // Remove previous selection
            document.querySelectorAll('.span-tree-node').forEach(n => n.classList.remove('selected'));
            // Add selection to clicked node
            node.classList.add('selected');

            const spanId = node.dataset.spanId;
            const span = spans.find(s => s.spanId.toString() === spanId.toString());

            if (span) {
                // Show span details inline
                showCombinedTraceSpanDetails(span);
            }
        });
    });
}

// Show span details for combined trace view
function showCombinedTraceSpanDetails(span) {
    // Find or create details container
    let detailsContainer = document.getElementById('combinedSpanDetails');
    if (!detailsContainer) {
        detailsContainer = document.createElement('div');
        detailsContainer.id = 'combinedSpanDetails';
        detailsContainer.style.cssText = 'margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid #ddd;';
        document.querySelector('#traceDetails > div:last-child').appendChild(detailsContainer);
    }

    detailsContainer.innerHTML = `
        <h5 style="margin-bottom: 1rem;">Span Details</h5>
        ${renderSpanDetails(span)}
    `;
}

// Setup view switcher
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

            // Clear right panel
            document.getElementById('traceDetails').innerHTML = '<p class="empty-message">Select a trace to view details</p>';

            // Process combined traces if switching to traces view
            if (view === 'traces') {
                processCombinedTraces();
            }
        });
    });
}

// Setup combined traces filter
function setupCombinedTracesFilter() {
    const checkbox = document.getElementById('showOnlyNonEmptyTraces');
    if (checkbox) {
        checkbox.addEventListener('change', (e) => {
            showOnlyNonEmptyTraces = e.target.checked;
            renderCombinedTraceList();
        });
    }
}

// Initialize
setupUrlFilter();
setupNonEmptyPayloadFilter();
setupViewSwitcher();
setupCombinedTracesFilter();
startConnection();
