// State
let currentTicket = null;
let currentServer = null;

// Constants
const STATUS_COLORS = {
    open: 'badge-open',
    assigned: 'badge-assigned',
    waiting: 'badge-waiting',
    escalated: 'badge-escalated',
    closed: 'badge-closed',
    archived: 'badge-archived'
};

// Utils
function formatDate(date) {
    return new Date(date).toLocaleString();
}

// API Calls
async function fetchTicket(ticketId) {
    const response = await fetch(`/api/tickets/${ticketId}`);
    return await response.json();
}

async function fetchGuildTickets(guildId, filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/guilds/${guildId}/tickets?${params}`);
    return await response.json();
}

async function updateTicket(ticketId, updates) {
    const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    return await response.json();
}

async function sendMessage(ticketId, content) {
    const response = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    });
    return await response.json();
}

// UI Updates
function updateTicketView(ticket) {
    currentTicket = ticket;
    
    // Header
    document.getElementById('ticketTitle').textContent = `Ticket #${ticket.id}`;
    document.getElementById('ticketStatus').textContent = ticket.status.toUpperCase();
    document.getElementById('ticketStatus').className = `badge ${STATUS_COLORS[ticket.status]}`;
    
    // Info
    document.getElementById('ticketAuthor').textContent = ticket.authorTag;
    document.getElementById('ticketCreatedAt').textContent = formatDate(ticket.createdAt);
    document.getElementById('ticketUpdatedAt').textContent = formatDate(ticket.updatedAt);
    document.getElementById('ticketAssignee').textContent = ticket.assigneeTag || 'Não atribuído';

    // Settings
    document.getElementById('prioritySelect').value = ticket.priority;
    document.getElementById('categorySelect').value = ticket.category;

    // Update claim button
    const claimBtn = document.getElementById('claimBtn');
    claimBtn.textContent = ticket.assigneeId ? 'Unclaim' : 'Claim';

    // Disable buttons if ticket is closed
    const isActive = !['closed', 'archived'].includes(ticket.status);
    claimBtn.disabled = !isActive;
    document.getElementById('messageInput').disabled = !isActive;
    document.getElementById('sendMessage').disabled = !isActive;

    loadMessages(ticket.id);
    loadTimeline(ticket.id);
}

function showTicketList() {
    document.getElementById('ticketView').classList.add('hidden');
    document.getElementById('ticketList').classList.remove('hidden');
}

function showTicketView() {
    document.getElementById('ticketList').classList.add('hidden');
    document.getElementById('ticketView').classList.remove('hidden');
}

async function loadMessages(ticketId) {
    const messages = await fetch(`/api/tickets/${ticketId}/messages`).then(r => r.json());
    const container = document.getElementById('messageList');
    container.innerHTML = '';

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div class="flex items-start space-x-2">
                <img src="${msg.authorAvatar}" class="w-8 h-8 rounded-full">
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-medium">${msg.authorTag}</span>
                        <span class="text-sm text-gray-400">${formatDate(msg.createdAt)}</span>
                    </div>
                    <p class="whitespace-pre-wrap">${msg.content}</p>
                    ${msg.attachments?.length ? '<div class="mt-2 flex flex-wrap gap-2">' + 
                        msg.attachments.map(att => 
                            `<a href="${att.url}" target="_blank" class="text-blue-400 hover:underline">${att.name}</a>`
                        ).join('') + '</div>' : ''}
                </div>
            </div>
        `;
        container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
}

async function loadTimeline(ticketId) {
    const events = await fetch(`/api/tickets/${ticketId}/events`).then(r => r.json());
    const container = document.getElementById('timeline');
    container.innerHTML = '';

    events.forEach(event => {
        const div = document.createElement('div');
        div.className = 'flex items-center space-x-2 py-2';
        div.innerHTML = `
            <div class="w-2 h-2 rounded-full bg-blue-500"></div>
            <div class="flex-1">
                <p>${event.description}</p>
                <span class="text-sm text-gray-400">${formatDate(event.timestamp)}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

// Event Handlers
document.getElementById('serverSelect').addEventListener('change', async (e) => {
    currentServer = e.target.value;
    if (currentServer) {
        const tickets = await fetchGuildTickets(currentServer);
        renderTicketList(tickets);
    }
});

document.getElementById('sendMessage').addEventListener('click', async () => {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (content && currentTicket) {
        input.disabled = true;
        try {
            await sendMessage(currentTicket.id, content);
            input.value = '';
            await loadMessages(currentTicket.id);
        } catch (error) {
            alert('Erro ao enviar mensagem');
        }
        input.disabled = false;
    }
});

document.getElementById('claimBtn').addEventListener('click', async () => {
    if (!currentTicket) return;

    try {
        const updates = {
            assigneeId: currentTicket.assigneeId ? null : getUserId() // getUserId() should return current user's ID
        };
        const updated = await updateTicket(currentTicket.id, updates);
        updateTicketView(updated);
    } catch (error) {
        alert('Erro ao atribuir ticket');
    }
});

document.getElementById('closeBtn').addEventListener('click', () => {
    document.getElementById('closeTicketModal').classList.remove('hidden');
    document.getElementById('closeTicketModal').classList.add('flex');
});

document.getElementById('cancelClose').addEventListener('click', () => {
    document.getElementById('closeTicketModal').classList.remove('flex');
    document.getElementById('closeTicketModal').classList.add('hidden');
});

document.getElementById('confirmClose').addEventListener('click', async () => {
    const reason = document.getElementById('closeReason').value;
    const resolution = document.getElementById('closeResolution').value;
    const generateTranscript = document.getElementById('generateTranscriptOnClose').checked;

    try {
        await updateTicket(currentTicket.id, {
            status: 'closed',
            closeReason: reason,
            resolution: resolution
        });

        if (generateTranscript) {
            await fetch(`/api/tickets/${currentTicket.id}/transcript`);
        }

        document.getElementById('closeTicketModal').classList.add('hidden');
        showTicketList();
    } catch (error) {
        alert('Erro ao fechar ticket');
    }
});

// Tab Handling
document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.add('hidden');
        });
        
        // Show selected tab
        document.getElementById(`${tabName}Tab`).classList.remove('hidden');
        
        // Update button styles
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.classList.remove('bg-gray-700');
        });
        button.classList.add('bg-gray-700');
    });
});

// Settings Event Handlers
document.getElementById('prioritySelect').addEventListener('change', async (e) => {
    if (!currentTicket) return;
    try {
        await updateTicket(currentTicket.id, { priority: e.target.value });
    } catch (error) {
        alert('Erro ao atualizar prioridade');
        e.target.value = currentTicket.priority;
    }
});

document.getElementById('categorySelect').addEventListener('change', async (e) => {
    if (!currentTicket) return;
    try {
        await updateTicket(currentTicket.id, { category: e.target.value });
    } catch (error) {
        alert('Erro ao atualizar categoria');
        e.target.value = currentTicket.category;
    }
});

document.getElementById('tagInput').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && e.target.value.trim() && currentTicket) {
        const tag = e.target.value.trim();
        try {
            await updateTicket(currentTicket.id, {
                tags: [...currentTicket.tags, tag]
            });
            e.target.value = '';
            updateTicketView(await fetchTicket(currentTicket.id));
        } catch (error) {
            alert('Erro ao adicionar tag');
        }
    }
});

document.getElementById('addParticipant').addEventListener('click', async () => {
    const input = document.getElementById('participantInput');
    const userId = input.value.trim();
    
    if (userId && currentTicket) {
        try {
            await fetch(`/api/tickets/${currentTicket.id}/participants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            input.value = '';
            updateTicketView(await fetchTicket(currentTicket.id));
        } catch (error) {
            alert('Erro ao adicionar participante');
        }
    }
});

// Quick Actions
document.getElementById('generateTranscript').addEventListener('click', async () => {
    if (!currentTicket) return;
    try {
        const response = await fetch(`/api/tickets/${currentTicket.id}/transcript`);
        const data = await response.json();
        window.open(data.url, '_blank');
    } catch (error) {
        alert('Erro ao gerar transcrição');
    }
});

document.getElementById('exportTicket').addEventListener('click', async () => {
    if (!currentTicket) return;
    try {
        window.location.href = `/api/tickets/${currentTicket.id}/export?format=pdf`;
    } catch (error) {
        alert('Erro ao exportar ticket');
    }
});

document.getElementById('escalateTicket').addEventListener('click', async () => {
    if (!currentTicket) return;
    try {
        await updateTicket(currentTicket.id, {
            status: 'escalated',
            priority: 'high'
        });
        updateTicketView(await fetchTicket(currentTicket.id));
    } catch (error) {
        alert('Erro ao escalar ticket');
    }
});

// Init
async function init() {
    try {
        // Load user info
        const user = await fetch('/api/auth/user').then(r => r.json());
        document.getElementById('userAvatar').src = user.avatar;
        document.getElementById('userName').textContent = user.tag;

        // Load servers
        const guilds = await fetch('/api/guilds').then(r => r.json());
        const select = document.getElementById('serverSelect');
        guilds.forEach(guild => {
            const option = document.createElement('option');
            option.value = guild.id;
            option.textContent = guild.name;
            select.appendChild(option);
        });

        // Load tickets if server is pre-selected
        const params = new URLSearchParams(window.location.search);
        const guildId = params.get('guild');
        if (guildId) {
            select.value = guildId;
            select.dispatchEvent(new Event('change'));
        }

        // Load specific ticket if provided
        const ticketId = params.get('ticket');
        if (ticketId) {
            const ticket = await fetchTicket(ticketId);
            if (ticket) {
                updateTicketView(ticket);
                showTicketView();
            }
        }
    } catch (error) {
        console.error('Error initializing:', error);
    }
}

init();
