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

    // If traces view is active, reload traces
    const tracesView = document.getElementById('traces-view');
    if (tracesView && tracesView.classList.contains('active')) {
        loadTraces();
    }
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
            <div class="item-info item-info-monospace">${escapeHtml(payload.url)}</div>
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
            <div class="item-info"><strong>Trace ID:</strong> <span class="item-info-monospace">${traceId}</span></div>
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
            <h4>IDs</h4>
            <div class="detail-row"><span class="detail-label">Trace ID:</span><span class="detail-value detail-value-monospace">${span.traceId}</span></div>
            <div class="detail-row"><span class="detail-label">Span ID:</span><span class="detail-value detail-value-monospace">${span.spanId}</span></div>
            ${span.parentId ? `<div class="detail-row"><span class="detail-label">Parent ID:</span><span class="detail-value detail-value-monospace">${span.parentId}</span></div>` : ''}
        </div>

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
    `;

    if (span.tags && Object.keys(span.tags).length > 0) {
        html += '<div class="detail-section"><h4>Meta</h4>';
        const sortedTags = Object.entries(span.tags).sort(([a], [b]) => a.localeCompare(b));
        for (const [key, value] of sortedTags) {
            html += `<div class="detail-row"><span class="detail-label detail-label-monospace">${escapeHtml(key)}:</span><span class="detail-value detail-value-monospace">${escapeHtml(value)}</span></div>`;
        }
        html += '</div>';
    }

    if (span.metrics && Object.keys(span.metrics).length > 0) {
        html += '<div class="detail-section"><h4>Metrics</h4>';
        const sortedMetrics = Object.entries(span.metrics).sort(([a], [b]) => a.localeCompare(b));
        for (const [key, value] of sortedMetrics) {
            html += `<div class="detail-row"><span class="detail-label detail-label-monospace">${escapeHtml(key)}:</span><span class="detail-value detail-value-monospace">${value}</span></div>`;
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

    // Always show only non-empty traces
    let filtered = traces.filter(t => t.spanCount > 0);

    if (filtered.length === 0) {
        list.innerHTML = '<p class="empty-message">No traces received yet</p>';
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
            <div class="item-info"><strong>Trace ID:</strong> <span class="item-info-monospace">${escapeHtml(trace.traceId)}</span></div>
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

// Build flamegraph data structure from spans
function buildFlamegraphData(spans) {
    if (!spans || spans.length === 0) {
        return null;
    }

    // Calculate trace bounds
    const minStart = Math.min(...spans.map(s => s.start));
    const maxEnd = Math.max(...spans.map(s => s.start + s.duration));
    const traceDuration = maxEnd - minStart;

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

    // Assign depth levels and calculate relative positioning
    const allSpansWithDepth = [];

    function assignDepth(span, depth = 0) {
        span.depth = depth;
        span.relativeStart = (span.start - minStart) / traceDuration;
        span.relativeWidth = span.duration / traceDuration;
        allSpansWithDepth.push(span);

        if (span.children && span.children.length > 0) {
            // Sort children by start time
            span.children.sort((a, b) => a.start - b.start);
            span.children.forEach(child => assignDepth(child, depth + 1));
        }
    }

    rootSpans.forEach(span => assignDepth(span));

    // Calculate max depth for height
    const maxDepth = Math.max(...allSpansWithDepth.map(s => s.depth));

    return {
        spans: allSpansWithDepth,
        traceDuration,
        minStart,
        maxDepth
    };
}

// Generate consistent color for a service
const serviceColors = new Map();
const colorPalette = [
    '#6741d9', '#2f9e44', '#f76707', '#1971c2',
    '#e03131', '#7048e8', '#0ca678', '#d9480f'
];

function getServiceColor(serviceName) {
    if (!serviceName) return '#95a5a6';

    if (!serviceColors.has(serviceName)) {
        serviceColors.set(
            serviceName,
            colorPalette[serviceColors.size % colorPalette.length]
        );
    }
    return serviceColors.get(serviceName);
}

// Render flamegraph using SVG
function renderSpanTree(spans) {
    const container = document.getElementById('spanTreeList');

    if (!spans || spans.length === 0) {
        container.innerHTML = '<p class="empty-message">No spans in trace</p>';
        return;
    }

    const flamegraphData = buildFlamegraphData(spans);
    if (!flamegraphData) {
        container.innerHTML = '<p class="empty-message">Unable to build flamegraph</p>';
        return;
    }

    const { spans: spansWithDepth, traceDuration, maxDepth } = flamegraphData;

    // SVG dimensions
    const barHeight = 24;
    const barGap = 2;
    const rowHeight = barHeight + barGap;
    const timeAxisHeight = 30;
    const svgHeight = (maxDepth + 1) * rowHeight + timeAxisHeight + 10;
    const svgWidth = container.clientWidth || 800;

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', svgHeight);
    svg.setAttribute('class', 'flamegraph-svg');

    // Create time axis
    const timeAxisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    timeAxisGroup.setAttribute('class', 'time-axis');

    // Background for time axis
    const timeAxisBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    timeAxisBg.setAttribute('x', 0);
    timeAxisBg.setAttribute('y', 0);
    timeAxisBg.setAttribute('width', '100%');
    timeAxisBg.setAttribute('height', timeAxisHeight);
    timeAxisBg.setAttribute('fill', '#f8f9fa');
    timeAxisGroup.appendChild(timeAxisBg);

    // Time axis line
    const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisLine.setAttribute('x1', 0);
    axisLine.setAttribute('y1', timeAxisHeight - 1);
    axisLine.setAttribute('x2', '100%');
    axisLine.setAttribute('y2', timeAxisHeight - 1);
    axisLine.setAttribute('stroke', '#ddd');
    axisLine.setAttribute('stroke-width', 1);
    timeAxisGroup.appendChild(axisLine);

    // Add time markers
    const markerCount = 5;
    for (let i = 0; i <= markerCount; i++) {
        const x = (i / markerCount) * 100;
        const timeValue = (traceDuration / markerCount) * i;

        // Marker line
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        marker.setAttribute('x1', `${x}%`);
        marker.setAttribute('y1', timeAxisHeight - 5);
        marker.setAttribute('x2', `${x}%`);
        marker.setAttribute('y2', timeAxisHeight - 1);
        marker.setAttribute('stroke', '#999');
        marker.setAttribute('stroke-width', 1);
        timeAxisGroup.appendChild(marker);

        // Marker text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', `${x}%`);
        text.setAttribute('y', timeAxisHeight - 10);
        text.setAttribute('text-anchor', i === 0 ? 'start' : (i === markerCount ? 'end' : 'middle'));
        text.setAttribute('font-size', '11');
        text.setAttribute('fill', '#666');
        text.textContent = formatDuration(timeValue);
        timeAxisGroup.appendChild(text);
    }

    svg.appendChild(timeAxisGroup);

    // Render spans as bars
    spansWithDepth.forEach(span => {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'flamegraph-bar-group');
        group.setAttribute('data-span-id', span.spanId);

        const y = span.depth * rowHeight + timeAxisHeight;
        const x = span.relativeStart * 100; // percentage
        const width = span.relativeWidth * 100; // percentage

        // Calculate absolute width for text clipping
        const absoluteWidth = (span.relativeWidth * svgWidth);

        // Create clipPath for text
        const clipId = `clip-${span.spanId}`;
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', clipId);
        const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clipRect.setAttribute('x', `${x}%`);
        clipRect.setAttribute('y', y);
        clipRect.setAttribute('width', `${width}%`);
        clipRect.setAttribute('height', barHeight);
        clipPath.appendChild(clipRect);
        svg.appendChild(clipPath);

        // Bar rectangle
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', `${x}%`);
        rect.setAttribute('y', y);
        rect.setAttribute('width', `${width}%`);
        rect.setAttribute('height', barHeight);
        rect.setAttribute('rx', 2);

        const color = span.error ? '#e74c3c' : getServiceColor(span.service);
        rect.setAttribute('fill', color);
        rect.setAttribute('stroke', '#333');
        rect.setAttribute('stroke-width', 1);
        rect.setAttribute('class', 'flamegraph-bar-rect');

        group.appendChild(rect);

        // Text label (only if bar is wide enough)
        if (absoluteWidth > 50) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', `${x}%`);
            text.setAttribute('y', y + barHeight / 2 + 4);
            text.setAttribute('font-size', '11');
            text.setAttribute('fill', 'white');
            text.setAttribute('clip-path', `url(#${clipId})`);
            text.setAttribute('class', 'flamegraph-bar-text');
            text.style.pointerEvents = 'none';

            // Add padding to text
            const textX = (span.relativeStart * svgWidth) + 4;
            text.setAttribute('x', textX);

            const label = `${span.service || 'N/A'} - ${span.name || span.resource || 'N/A'} (${formatDuration(span.duration)})`;
            text.textContent = label;

            group.appendChild(text);
        }

        // Tooltip title
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${span.service || 'N/A'} - ${span.name || span.resource || 'N/A'}\nDuration: ${formatDuration(span.duration)}\nStart: ${formatDuration(span.start - flamegraphData.minStart)}`;
        group.appendChild(title);

        // Click handler
        group.style.cursor = 'pointer';
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            selectTraceSpan(span);
        });

        // Hover effect
        group.addEventListener('mouseenter', () => {
            rect.setAttribute('filter', 'brightness(1.2)');
            group.style.filter = 'brightness(1.2)';
        });
        group.addEventListener('mouseleave', () => {
            rect.removeAttribute('filter');
            group.style.filter = '';
        });

        // Highlight if selected
        if (selectedTraceSpanId === span.spanId) {
            rect.setAttribute('stroke', '#000');
            rect.setAttribute('stroke-width', 3);
        }

        svg.appendChild(group);
    });

    // Clear and render
    container.innerHTML = '';
    container.appendChild(svg);
}

// Select a span from trace view
function selectTraceSpan(span) {
    selectedTraceSpanId = span.spanId;

    // Update selection styling in SVG
    document.querySelectorAll('#spanTreeList .flamegraph-bar-group').forEach(group => {
        const rect = group.querySelector('.flamegraph-bar-rect');
        if (group.dataset.spanId === span.spanId) {
            rect.setAttribute('stroke', '#000');
            rect.setAttribute('stroke-width', 3);
        } else {
            rect.setAttribute('stroke', '#333');
            rect.setAttribute('stroke-width', 1);
        }
    });

    renderTraceSpanDetails(span);
}

// Render span details for trace view
function renderTraceSpanDetails(span) {
    const details = document.getElementById('traceSpanDetails');

    const startTime = new Date(span.start / 1000000).toISOString();

    let html = `
        <div class="detail-section">
            <h4>IDs</h4>
            <div class="detail-row"><span class="detail-label">Trace ID:</span><span class="detail-value detail-value-monospace">${span.traceId}</span></div>
            <div class="detail-row"><span class="detail-label">Span ID:</span><span class="detail-value detail-value-monospace">${span.spanId}</span></div>
            ${span.parentId ? `<div class="detail-row"><span class="detail-label">Parent ID:</span><span class="detail-value detail-value-monospace">${span.parentId}</span></div>` : ''}
        </div>

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
    `;

    if (span.tags && Object.keys(span.tags).length > 0) {
        html += '<div class="detail-section"><h4>Meta</h4>';
        const sortedTags = Object.entries(span.tags).sort(([a], [b]) => a.localeCompare(b));
        for (const [key, value] of sortedTags) {
            html += `<div class="detail-row"><span class="detail-label detail-label-monospace">${escapeHtml(key)}:</span><span class="detail-value detail-value-monospace">${escapeHtml(value)}</span></div>`;
        }
        html += '</div>';
    }

    if (span.metrics && Object.keys(span.metrics).length > 0) {
        html += '<div class="detail-section"><h4>Metrics</h4>';
        const sortedMetrics = Object.entries(span.metrics).sort(([a], [b]) => a.localeCompare(b));
        for (const [key, value] of sortedMetrics) {
            html += `<div class="detail-row"><span class="detail-label detail-label-monospace">${escapeHtml(key)}:</span><span class="detail-value detail-value-monospace">${value}</span></div>`;
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
    // No filter needed for traces view - always show only non-empty traces
}

// Initialize
setupViewSwitcher();
setupUrlFilter();
setupPayloadFilter();
setupTraceFilter();
startConnection();

