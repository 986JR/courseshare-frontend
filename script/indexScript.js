const API_BASE_URL = 'https://courseshare-backend.onrender.com/api';
const animationDuration = 400;

// Store OTP and email for password reset flow
let resetEmail = '';
let verifiedOTP = '';

/* --- TOAST NOTIFICATION SYSTEM --- */
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '';
    if (type === 'success') {
        icon = '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    } else if (type === 'error') {
        icon = '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
    } else if (type === 'info') {
        icon = '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    }
    
    toast.innerHTML = `
        ${icon}
        <div class="toast-message">${message}</div>
        <svg class="toast-close" fill="none" stroke="currentColor" viewBox="0 0 24 24" onclick="this.parentElement.remove()">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
    `;
    
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/* --- UTILITY FUNCTIONS --- */
function displayAuthMessage(message, type = 'success') {
    const msgBox = document.getElementById('auth-message-box');
    msgBox.className = 'p-3 mb-4 rounded-lg text-sm transition-opacity duration-300';
    msgBox.style.display = 'block';
    
    if (type === 'success') {
        msgBox.classList.add('bg-green-100', 'text-green-800', 'border', 'border-green-300');
    } else if (type === 'error') {
        msgBox.classList.add('bg-red-100', 'text-red-800', 'border', 'border-red-300');
    } else if (type === 'info') {
        msgBox.classList.add('bg-blue-100', 'text-blue-800', 'border', 'border-blue-300');
    }

    msgBox.textContent = message;
    setTimeout(() => msgBox.style.opacity = '1', 10);
    
    if (type !== 'error') {
        setTimeout(() => {
            msgBox.style.opacity = '0';
            setTimeout(() => msgBox.style.display = 'none', 300);
        }, 5000);
    }
}

function clearAllMessages() {
    const messages = document.querySelectorAll('.validation-message');
    messages.forEach(msg => msg.textContent = '');

    const msgBox = document.getElementById('auth-message-box');
    msgBox.style.opacity = '0';
    setTimeout(() => msgBox.style.display = 'none', 300);
}

function showLoading(formType) {
    const loadingOverlay = document.getElementById(`${formType}-loading`);
    if (loadingOverlay) {
        loadingOverlay.classList.add('active');
    }
    
    const form = document.getElementById(`${formType}-form`);
    if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
        }
    }
}

function hideLoading(formType) {
    const loadingOverlay = document.getElementById(`${formType}-loading`);
    if (loadingOverlay) {
        loadingOverlay.classList.remove('active');
    }
    
    const form = document.getElementById(`${formType}-form`);
    if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
        }
    }
}

/* --- MODAL CONTROL FUNCTIONS --- */
function setAuthView(viewId) {
    ['login-view', 'register-view', 'forgot-password-view', 'otp-verification-view', 'new-password-view'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.classList.toggle('hidden', id !== viewId);
        }
    });
    
    // Reset forms
    const forms = ['login-form', 'register-form', 'forgot-password-form', 'otp-form', 'new-password-form'];
    forms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) form.reset();
    });
    
    clearAllMessages();
}

function openAuthModal(view) {
    const modal = document.getElementById('auth-modal');
    const content = document.getElementById('auth-modal-content');
    
    if (view === 'register') {
        setAuthView('register-view');
    } else if (view === 'forgot') {
        setAuthView('forgot-password-view');
    } else {
        setAuthView('login-view');
    }

    modal.style.display = 'block';
    setTimeout(() => {
        modal.classList.add('open');
        content.focus();
    }, 10);
    
    const mobileMenu = document.getElementById('mobile-menu');
    if(mobileMenu.classList.contains('mobile-menu-open')) {
        closeMobileMenu();
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.classList.remove('open');
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, animationDuration);
    
    clearAllMessages();
    const forms = ['login-form', 'register-form', 'forgot-password-form', 'otp-form', 'new-password-form'];
    forms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) form.reset();
    });
    
    // Reset password reset flow data
    resetEmail = '';
    verifiedOTP = '';
}

function showLoginView(e) {
    if (e) e.preventDefault();
    setAuthView('login-view');
}

function showRegisterView(e) {
    if (e) e.preventDefault();
    setAuthView('register-view');
}

function showForgotPasswordView(e) {
    if (e) e.preventDefault();
    setAuthView('forgot-password-view');
}

function showOTPVerificationView() {
    setAuthView('otp-verification-view');
    // Focus on first OTP input
    setTimeout(() => {
        document.getElementById('otp-1').focus();
    }, 100);
}

function showNewPasswordView() {
    setAuthView('new-password-view');
}

/* --- INPUT VALIDATION LOGIC --- */
function displayValidationMessage(id, message) {
    const msgElement = document.getElementById(id);
    if (msgElement) {
        msgElement.textContent = message;
    }
}

function validateInput(input) {
    const msgId = input.id + '-msg';
    if (input.required && input.value.trim() === '') {
        if (document.activeElement !== input) { 
            displayValidationMessage(msgId, 'This field is required.');
        }
        return false;
    } else {
        displayValidationMessage(msgId, '');
    }
    return true;
}

function validateRegisterUsername(input) {
    const msgId = input.id + '-msg';
    const value = input.value.trim();

    if (!validateInput(input)) return false;

    if (!/^[a-zA-Z]/.test(value)) {
        displayValidationMessage(msgId, 'Username must start with a letter.');
        return false;
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        displayValidationMessage(msgId, 'Username can only contain letters, numbers, hyphens, or underscores.');
        return false;
    }

    displayValidationMessage(msgId, '');
    return true;
}

function validateRegisterEmail(input) { 
    const msgId = input.id + '-msg';
    const value = input.value;

    if (!validateInput(input)) return false;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        displayValidationMessage(msgId, 'Please enter a valid email format (e.g., user@domain.com).');
        return false;
    }
    
    if (value.length > 0 && /^[A-Z]/.test(value[0])) {
        displayValidationMessage(msgId, 'Email should not start with a capital letter.');
        return false;
    }

    displayValidationMessage(msgId, '');
    return true;
}

function validateRegisterPassword(input) {
    const msgId = input.id + '-msg';
    if (!validateInput(input)) return false;
    
    if (input.value.length < 6) {
        displayValidationMessage(msgId, 'Password must be at least 6 characters long.');
        return false;
    }
    
    displayValidationMessage(msgId, '');
    const confirmInput = document.getElementById('register-confirm-password');
    if (confirmInput && confirmInput.value.length > 0) {
        validateRegisterConfirmPassword(confirmInput);
    }
    
    return true;
}

function validateRegisterConfirmPassword(input) {
    const msgId = input.id + '-msg';
    const password = document.getElementById('register-password').value;

    if (!validateInput(input)) return false;

    if (input.value !== password) {
        displayValidationMessage(msgId, 'Passwords do not match.');
        return false;
    }

    displayValidationMessage(msgId, '');
    return true;
}

function validateNewPassword(input) {
    const msgId = input.id + '-msg';
    if (!validateInput(input)) return false;
    
    if (input.value.length < 6) {
        displayValidationMessage(msgId, 'Password must be at least 6 characters long.');
        return false;
    }
    
    displayValidationMessage(msgId, '');
    const confirmInput = document.getElementById('confirm-new-password');
    if (confirmInput && confirmInput.value.length > 0) {
        validateConfirmNewPassword(confirmInput);
    }
    
    return true;
}

function validateConfirmNewPassword(input) {
    const msgId = input.id + '-msg';
    const password = document.getElementById('new-password').value;

    if (!validateInput(input)) return false;

    if (input.value !== password) {
        displayValidationMessage(msgId, 'Passwords do not match.');
        return false;
    }

    displayValidationMessage(msgId, '');
    return true;
}

/* --- OTP INPUT HANDLING --- */
function handleOTPInput(event, position) {
    const input = event.target;
    const value = input.value;
    
    // Only allow digits
    if (!/^\d$/.test(value)) {
        input.value = '';
        return;
    }
    
    // Move to next input if current is filled
    if (value.length === 1 && position < 6) {
        const nextInput = document.getElementById(`otp-${position + 1}`);
        if (nextInput) {
            nextInput.focus();
        }
    }
    
    // Auto-submit when all 6 digits are entered
    if (position === 6) {
        const allFilled = [...Array(6)].every((_, i) => {
            const input = document.getElementById(`otp-${i + 1}`);
            return input && input.value.length === 1;
        });
        
        if (allFilled) {
            setTimeout(() => {
                handleOTPVerification(new Event('submit'));
            }, 300);
        }
    }
}

function handleOTPKeydown(event, position) {
    // Handle backspace
    if (event.key === 'Backspace') {
        const input = event.target;
        if (input.value === '' && position > 1) {
            const prevInput = document.getElementById(`otp-${position - 1}`);
            if (prevInput) {
                prevInput.focus();
                prevInput.value = '';
            }
        }
    }
}

function getOTPValue() {
    let otp = '';
    for (let i = 1; i <= 6; i++) {
        const input = document.getElementById(`otp-${i}`);
        if (input) {
            otp += input.value;
        }
    }
    return otp;
}

function clearOTPInputs() {
    for (let i = 1; i <= 6; i++) {
        const input = document.getElementById(`otp-${i}`);
        if (input) {
            input.value = '';
        }
    }
    document.getElementById('otp-1').focus();
}

/* --- API INTEGRATION & SUBMISSION HANDLERS --- */

async function handleRegister(e) {
    e.preventDefault();
    clearAllMessages();
    
    const usernameInput = document.getElementById('register-username');
    const emailInput = document.getElementById('register-email');
    const passwordInput = document.getElementById('register-password');
    const confirmInput = document.getElementById('register-confirm-password');
    
    const isUsernameValid = validateRegisterUsername(usernameInput);
    const isEmailValid = validateRegisterEmail(emailInput);
    const isPasswordValid = validateRegisterPassword(passwordInput);
    const isConfirmValid = validateRegisterConfirmPassword(confirmInput);
    
    if (!isUsernameValid || !isEmailValid || !isPasswordValid || !isConfirmValid) {
        validateRegisterUsername(usernameInput);
        validateRegisterEmail(emailInput);
        validateRegisterPassword(passwordInput);
        validateRegisterConfirmPassword(confirmInput);
        showToast('Please correct the errors in the registration form.', 'error');
        return;
    }

    const requestBody = {
        username: usernameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value
    };
    
    showLoading('register');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        hideLoading('register');
        
        if (response.ok) {
            showToast('Registered successfully! Please login with your credentials.', 'success');
            document.getElementById('register-form').reset();
            setTimeout(() => {
                setAuthView('login-view');
            }, 1500);
        } else {
            const errorMessage = data.message || 'Registration failed. Please try again.';
            showToast(errorMessage, 'error');
            displayAuthMessage(errorMessage, 'error');
        }
    } catch (error) {
        hideLoading('register');
        console.error('Registration error:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
        displayAuthMessage('Network error. Please check your connection and try again.', 'error');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    clearAllMessages();

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');

    const isUsernameValid = validateInput(usernameInput);
    const isPasswordValid = validateInput(passwordInput);
    
    if (!isUsernameValid || !isPasswordValid) {
        validateInput(usernameInput);
        validateInput(passwordInput);
        showToast('Please fill in all required login fields.', 'error');
        return;
    }

    const requestBody = {
        username: usernameInput.value.trim(),
        password: passwordInput.value
    };

    showLoading('login');

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        hideLoading('login');

        if (response.ok) {
            showToast('Login successful! Welcome back!', 'success');

            localStorage.setItem("authToken", data.accessToken);
            localStorage.setItem("tokenType", data.tokenType);
            localStorage.setItem("publicId", data.publicId);
            localStorage.setItem("authData", JSON.stringify({
                token: data.accessToken,
                type: data.tokenType,
                publicId: data.publicId
            }));

            document.getElementById('login-form').reset();
            setTimeout(() => window.location.href = "dashboard.html", 1200);
        } else {
            const errorMessage = data.message || "Login failed. Check your credentials.";
            showToast(errorMessage, 'error');
            displayAuthMessage(errorMessage, 'error');
        }
    } catch (error) {
        hideLoading('login');
        console.error("Login request failed:", error);
        showToast('Network error – check connection and try again.', 'error');
        displayAuthMessage('Network error – check connection and try again.', 'error');
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    clearAllMessages();
    
    const emailInput = document.getElementById('forgot-email');
    const isEmailValid = validateRegisterEmail(emailInput);
    
    if (!isEmailValid) {
        validateRegisterEmail(emailInput);
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    const email = emailInput.value.trim();
    resetEmail = email; // Store for later use
    
    showLoading('forgot');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/send-otp?email=${encodeURIComponent(email)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        hideLoading('forgot');
        
        if (response.ok) {
            const data = await response.text();
            showToast('OTP sent to your email! Please check your inbox.', 'success');
            displayAuthMessage('OTP sent successfully! Enter the 6-digit code below.', 'success');
            
            // Move to OTP verification view
            setTimeout(() => {
                showOTPVerificationView();
            }, 1500);
        } else {
            const errorMessage = await response.text();
            showToast(errorMessage || 'Failed to send OTP. Please try again.', 'error');
            displayAuthMessage(errorMessage || 'Failed to send OTP. Please try again.', 'error');
        }
    } catch (error) {
        hideLoading('forgot');
        console.error('Send OTP error:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
        displayAuthMessage('Network error. Please check your connection and try again.', 'error');
    }
}

async function handleOTPVerification(e) {
    e.preventDefault();
    clearAllMessages();
    
    const otp = getOTPValue();
    
    if (otp.length !== 6) {
        showToast('Please enter all 6 digits of the OTP.', 'error');
        return;
    }
    
    showLoading('otp');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/validate-otp?otp=${otp}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        hideLoading('otp');
        
        if (response.ok) {
            const data = await response.text();
            verifiedOTP = otp; // Store the verified OTP
            showToast('OTP verified successfully!', 'success');
            
            // Move to new password view
            setTimeout(() => {
                showNewPasswordView();
            }, 1000);
        } else {
            const errorMessage = await response.text();
            showToast(errorMessage || 'Invalid OTP. Please try again.', 'error');
            displayAuthMessage(errorMessage || 'Invalid OTP. Please try again.', 'error');
            clearOTPInputs();
        }
    } catch (error) {
        hideLoading('otp');
        console.error('OTP verification error:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
        displayAuthMessage('Network error. Please check your connection and try again.', 'error');
        clearOTPInputs();
    }
}

async function handleNewPassword(e) {
    e.preventDefault();
    clearAllMessages();
    
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-new-password');
    
    const isPasswordValid = validateNewPassword(newPasswordInput);
    const isConfirmValid = validateConfirmNewPassword(confirmPasswordInput);
    
    if (!isPasswordValid || !isConfirmValid) {
        validateNewPassword(newPasswordInput);
        validateConfirmNewPassword(confirmPasswordInput);
        showToast('Please correct the errors in the form.', 'error');
        return;
    }
    
    const newPassword = newPasswordInput.value;
    
    if (!verifiedOTP) {
        showToast('Session expired. Please start the password reset process again.', 'error');
        setTimeout(() => {
            setAuthView('forgot-password-view');
        }, 2000);
        return;
    }
    
    showLoading('new-password');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/reset-password?otp=${verifiedOTP}&newPassword=${encodeURIComponent(newPassword)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        hideLoading('new-password');
        
        if (response.ok) {
            const data = await response.text();
            showToast('Password reset successfully! You can now login with your new password.', 'success');
            displayAuthMessage('Password reset successfully! Redirecting to login...', 'success');
            
            // Reset the flow data
            resetEmail = '';
            verifiedOTP = '';
            
            // Redirect to login
            setTimeout(() => {
                setAuthView('login-view');
            }, 2000);
        } else {
            const errorMessage = await response.text();
            showToast(errorMessage || 'Failed to reset password. Please try again.', 'error');
            displayAuthMessage(errorMessage || 'Failed to reset password. Please try again.', 'error');
        }
    } catch (error) {
        hideLoading('new-password');
        console.error('Password reset error:', error);
        showToast('Network error. Please check your connection and try again.', 'error');
        displayAuthMessage('Network error. Please check your connection and try again.', 'error');
    }
}

async function resendOTP(e) {
    e.preventDefault();
    
    if (!resetEmail) {
        showToast('Session expired. Please start over.', 'error');
        setTimeout(() => {
            setAuthView('forgot-password-view');
        }, 1500);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/send-otp?email=${encodeURIComponent(resetEmail)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            showToast('New OTP sent to your email!', 'success');
            clearOTPInputs();
        } else {
            const errorMessage = await response.text();
            showToast(errorMessage || 'Failed to resend OTP.', 'error');
        }
    } catch (error) {
        console.error('Resend OTP error:', error);
        showToast('Network error. Please try again.', 'error');
    }
}

/* --- INITIALIZATION & LAYOUT LOGIC --- */
function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    mobileMenu.classList.remove('mobile-menu-open');
    mobileMenuButton.setAttribute('aria-expanded', 'false');
    setTimeout(() => {
        if (!mobileMenu.classList.contains('mobile-menu-open')) {
            mobileMenu.style.display = 'none';
        }
    }, animationDuration);
}

document.addEventListener('DOMContentLoaded', function() {
    const preloader = document.getElementById('preloader');
    const mainContent = document.getElementById('main-content');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const navbar = document.getElementById('navbar');
    
    window.addEventListener('load', () => {
        preloader.style.opacity = '0';
        setTimeout(() => {
            preloader.style.display = 'none';
            mainContent.style.opacity = '1';
        }, 500);
    });

    mobileMenuButton.addEventListener('click', () => {
        const isOpen = mobileMenu.classList.contains('mobile-menu-open');
        if (isOpen) {
            closeMobileMenu();
        } else {
            mobileMenu.style.display = 'block';
            setTimeout(() => {
                mobileMenu.classList.add('mobile-menu-open');
                mobileMenuButton.setAttribute('aria-expanded', 'true');
            }, 10);
        }
    });
    
    document.addEventListener('click', (event) => {
        if (window.innerWidth < 768 && mobileMenu.classList.contains('mobile-menu-open')) {
            if (!mobileMenu.contains(event.target) && !mobileMenuButton.contains(event.target)) {
                closeMobileMenu();
            }
        }
    });
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 0) {
            navbar.classList.add('shadow-md');
        } else {
            navbar.classList.remove('shadow-md');
        }
    });
    
    document.querySelectorAll('.input-field').forEach(input => {
        input.addEventListener('blur', () => {
            if (input.id.startsWith('register-username')) validateRegisterUsername(input);
            else if (input.id.startsWith('register-email') || input.id.startsWith('forgot-email')) validateRegisterEmail(input);
            else if (input.id.startsWith('register-password')) validateRegisterPassword(input);
            else if (input.id.startsWith('register-confirm-password')) validateRegisterConfirmPassword(input);
            else if (input.id.startsWith('new-password') && input.id !== 'confirm-new-password') validateNewPassword(input);
            else if (input.id.startsWith('confirm-new-password')) validateConfirmNewPassword(input);
            else if (input.id.startsWith('login')) validateInput(input);
        });
    });
});