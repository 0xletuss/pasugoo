// API Configuration
const API_BASE_URL = 'https://pasugo.onrender.com';

// Make API_BASE_URL globally accessible
window.API_BASE_URL = API_BASE_URL;

// Helper function for API calls
async function apiCall(endpoint, method = 'GET', data = null) {
    const token = localStorage.getItem('access_token');
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers,
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Authentication functions
async function login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            password,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
    }

    const result = await response.json();
    localStorage.setItem('access_token', result.data.access_token);
    localStorage.setItem('refresh_token', result.data.refresh_token);
    localStorage.setItem('user', JSON.stringify(result.data.user));
    return result.data;
}

async function register(fullName, email, phoneNumber, password, userType, address = '') {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            full_name: fullName,
            email,
            phone_number: phoneNumber,
            password,
            user_type: userType,
            address,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
    }

    return await response.json();
}

function logout() {
    localStorage.removeItem('access_token');
    window.location.href = 'index.html';
}

// Utility functions
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function isLoggedIn() {
    return !!localStorage.getItem('access_token');
}

function requireLogin() {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
    }
}
