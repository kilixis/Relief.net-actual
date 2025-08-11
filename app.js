// Backend API URL
const API_BASE_URL = 'http://localhost:5000/api';

// Global variables
let map;
let myLocation = null;
let requests = [];
let myLocationMarker = null;
let routingControl = null;
let redIcon, meIcon;

// Local storage keys (only for profile now)
const PROFILE_KEY = "reliefnet-profile";

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('map.html') || window.location.pathname.includes('map')) {
        initializeMap();
    }
});

// Map initialization
function initializeMap() {
    // Get role from URL
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role') || 'victim';
    
    // Set initial role
    const roleSelect = document.getElementById('role-select');
    if (roleSelect) {
        roleSelect.value = role;
        roleSelect.addEventListener('change', handleRoleChange);
    }
    
    // Initialize map
    map = L.map('map').setView([20, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Create custom icons
    createIcons();
    
    // Load profile and requests
    loadProfile();
    loadRequests();
    
    // Set up event listeners
    setupEventListeners();
    
    // Start location tracking
    startLocationTracking();
    
    // Update UI based on role
    updateUI(role);
}

function createIcons() {
    const redSvg = `
    <svg width="28" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill="#ef4444" d="M12 2C7.59 2 4 5.59 4 10c0 5.25 7 12 8 12s8-6.75 8-12c0-4.41-3.59-8-8-8Zm0 10.5A2.5 2.5 0 1 1 12 7.5a2.5 2.5 0 0 1 0 5Z"/>
    </svg>`;
    
    const blueSvg = `
    <svg width="28" height="40" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill="#0ea5e9" d="M12 2C7.59 2 4 5.59 4 10c0 5.25 7 12 8 12s8-6.75 8-12c0-4.41-3.59-8-8-8Zm0 10.5A2.5 2.5 0 1 1 12 7.5a2.5 2.5 0 0 1 0 5Z"/>
    </svg>`;
    
    redIcon = L.divIcon({
        html: redSvg,
        className: "",
        iconSize: [28, 40],
        iconAnchor: [14, 36],
        popupAnchor: [0, -28],
    });
    
    meIcon = L.divIcon({
        html: blueSvg,
        className: "",
        iconSize: [28, 40],
        iconAnchor: [14, 36],
        popupAnchor: [0, -28],
    });
}

function loadProfile() {
    // Load profile from localStorage
    try {
        const raw = localStorage.getItem(PROFILE_KEY);
        const profile = raw ? JSON.parse(raw) : { name: '', phone: '' };
        
        document.getElementById('name').value = profile.name || '';
        document.getElementById('phone').value = profile.phone || '';
    } catch {
        document.getElementById('name').value = '';
        document.getElementById('phone').value = '';
    }
}

function loadRequests() {
    // Load requests from MySQL via API
    fetch(`${API_BASE_URL}/requests`)
        .then(response => response.json())
        .then(data => {
            requests = data;
            displayRequests();
            updateRequestMarkers();
        })
        .catch(error => {
            console.error('Error loading requests:', error);
            showToast('Error', 'Failed to load help requests');
        });
}

function setupEventListeners() {
    // Profile saving
    document.getElementById('name').addEventListener('input', saveProfile);
    document.getElementById('phone').addEventListener('input', saveProfile);
    
    // Form submission
    document.getElementById('submit-btn').addEventListener('click', submitRequest);
    
    // Real-time validation
    document.getElementById('name').addEventListener('input', validateForm);
    document.getElementById('phone').addEventListener('input', validateForm);
}

function startLocationTracking() {
    if (!navigator.geolocation) {
        showToast('Location unavailable', 'Enable location services to use this app.');
        return;
    }
    
    navigator.geolocation.watchPosition(
        (position) => {
            myLocation = [position.coords.latitude, position.coords.longitude];
            updateLocationDisplay();
            updateMyLocationMarker();
            
            if (myLocationMarker === null) {
                map.setView(myLocation, 13);
            }
            
            validateForm();
        },
        (error) => {
            console.error('Location error:', error);
            document.getElementById('location-display').textContent = 'Location unavailable';
        }
    );
}

function updateLocationDisplay() {
    if (myLocation) {
        document.getElementById('location-display').textContent = 
            `Lat ${myLocation[0].toFixed(5)}, Lng ${myLocation[1].toFixed(5)}`;
    }
}

function updateMyLocationMarker() {
    if (myLocationMarker) {
        map.removeLayer(myLocationMarker);
    }
    
    if (myLocation) {
        myLocationMarker = L.marker(myLocation, { icon: meIcon })
            .addTo(map)
            .bindPopup('You are here');
    }
}

function handleRoleChange(event) {
    const newRole = event.target.value;
    const url = new URL(window.location);
    url.searchParams.set('role', newRole);
    window.location.href = url.toString();
}

function updateUI(role) {
    const title = document.getElementById('sidebar-title');
    const victimForm = document.getElementById('victim-form');
    const volunteerForm = document.getElementById('volunteer-form');
    
    if (role === 'victim') {
        title.textContent = 'Submit Emergency';
        victimForm.style.display = 'flex';
        volunteerForm.style.display = 'none';
    } else {
        title.textContent = 'Find Requests';
        victimForm.style.display = 'none';
        volunteerForm.style.display = 'block';
    }
}

function validateForm() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const submitBtn = document.getElementById('submit-btn');
    
    const isValid = myLocation && name && phone;
    submitBtn.disabled = !isValid;
}

function submitRequest() {
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const disasterType = document.getElementById('disaster-type').value;
    const resources = document.getElementById('resources').value;
    const description = document.getElementById('description').value;
    
    if (!myLocation) {
        showToast('Location unavailable', 'Enable location services to submit a request.');
        return;
    }
    
    if (!name || !phone) {
        showToast('Your details required', 'Please enter your name and phone number.');
        return;
    }
    
    const newRequest = {
        id: Date.now().toString(),
        lat: myLocation[0],
        lng: myLocation[1],
        disasterType,
        resources: resources.split(',').map(r => r.trim()).filter(Boolean),
        description,
        victimName: name,
        victimPhone: phone,
        createdAt: Date.now()
    };
    
    // Send to MySQL via API
    fetch(`${API_BASE_URL}/requests`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRequest)
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showToast('Error', data.error);
        } else {
            // Clear form
            document.getElementById('resources').value = '';
            document.getElementById('description').value = '';
            
            // Reload requests to show the new one
            loadRequests();
            
            showToast('Request submitted', 'Your emergency is now visible as a red pin.');
        }
    })
    .catch(error => {
        console.error('Error submitting request:', error);
        showToast('Error', 'Failed to submit request');
    });
}

function displayRequests() {
    const container = document.getElementById('requests-list');
    
    if (requests.length === 0) {
        container.innerHTML = '<div class="no-requests">No requests yet.</div>';
        return;
    }
    
    container.innerHTML = '';
    requests.forEach(request => {
        const card = createRequestCard(request);
        container.appendChild(card);
    });
}

function createRequestCard(request) {
    const card = document.createElement('div');
    card.className = 'request-card';
    
    const resourcesHtml = request.resources.length > 0 
        ? `<div class="request-resources">${request.resources.map(r => `<span class="resource-badge">${r}</span>`).join('')}</div>`
        : '';
    
    const descriptionHtml = request.description ? `<div class="request-description">${request.description}</div>` : '';
    
    card.innerHTML = `
        <h3>${request.disasterType}</h3>
        <div class="request-meta">
            ${new Date(request.createdAt).toLocaleString()}<br>
            Victim: ${request.victimName} • ${request.victimPhone}
        </div>
        ${resourcesHtml}
        ${descriptionHtml}
        <button class="btn btn-primary btn-sm" onclick="routeToRequest(${request.lat}, ${request.lng})">Respond</button>
    `;
    
    return card;
}

function updateRequestMarkers() {
    // Remove existing request markers
    map.eachLayer(layer => {
        if (layer.options && layer.options.icon === redIcon) {
            map.removeLayer(layer);
        }
    });
    
    // Add new markers
    requests.forEach(request => {
        const marker = L.marker([request.lat, request.lng], { icon: redIcon })
            .addTo(map)
            .bindPopup(createPopupContent(request));
    });
}

function createPopupContent(request) {
    const resourcesHtml = request.resources.length > 0 
        ? `<div>${request.resources.map(r => `<span class="resource-badge">${r}</span>`).join('')}</div>`
        : '';
    
    const descriptionHtml = request.description ? `<div>${request.description}</div>` : '';
    
    return `
        <div>
            <div><strong>${request.disasterType}</strong></div>
            <div>Victim: ${request.victimName} • ${request.victimPhone}</div>
            ${resourcesHtml}
            ${descriptionHtml}
            <button class="btn btn-primary btn-sm" onclick="routeToRequest(${request.lat}, ${request.lng})">Respond</button>
        </div>
    `;
}

function routeToRequest(lat, lng) {
    if (!myLocation) {
        showToast('Location unavailable', 'Enable location services to respond to requests.');
        return;
    }
    
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    
    if (!name || !phone) {
        showToast('Your details required', 'Please enter your name and phone number to respond.');
        return;
    }
    
    // Remove existing routing
    if (routingControl) {
        map.removeControl(routingControl);
    }
    
    // Create new routing
    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(myLocation[0], myLocation[1]),
            L.latLng(lat, lng)
        ],
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        lineOptions: {
            styles: [
                { color: '#0ea5e9', opacity: 0.9, weight: 6 },
                { color: '#ffffff', opacity: 0.9, weight: 2 },
            ],
        },
        show: false,
        collapsible: true,
    }).addTo(map);
}

// Local storage utilities (only for profile)
function saveProfile() {
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, phone }));
}

// Toast notifications
function showToast(title, description) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 0.5rem;
        padding: 1rem;
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1);
        max-width: 300px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    toast.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.25rem; color: #1e293b;">${title}</div>
        <div style="font-size: 0.875rem; color: #64748b;">${description}</div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);