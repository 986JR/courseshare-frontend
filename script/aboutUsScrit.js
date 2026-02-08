const API_BASE_URL = 'https://courseshare-backend.onrender.com/api';
const animationDuration = 400;

// Store OTP and email for password reset flow
let resetEmail = '';
let verifiedOTP = '';

let selectedCategorySlug = null;
let categorySearchTimeout = null;
let allCategories = [];

/* --- TOAST NOTIFICATION SYSTEM --- */
function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    
    // Create toast container if it doesn't exist
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
        document.body.appendChild(toastContainer);
    }
    
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
    
    // If message box doesn't exist, just use console and return
    if (!msgBox) {
        console.log(`[${type.toUpperCase()}] ${message}`);
        return;
    }
    
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
    if (msgBox) {
        msgBox.style.opacity = '0';
        setTimeout(() => msgBox.style.display = 'none', 300);
    }
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
    
    if (!modal) {
        console.error('Auth modal not found in the page');
        return;
    }
    
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
        if (content) content.focus();
    }, 10);
    
    const mobileMenu = document.getElementById('mobile-menu');
    if(mobileMenu && mobileMenu.classList.contains('mobile-menu-open')) {
        closeMobileMenu();
    }
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    
    if (!modal) return;
    
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
    
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
        displayValidationMessage(msgId, 'Only letters, numbers, and underscores allowed.');
        return false;
    }
    
    if (value.length < 3 || value.length > 20) {
        displayValidationMessage(msgId, 'Username must be between 3 and 20 characters.');
        return false;
    }
    
    displayValidationMessage(msgId, '');
    return true;
}

function validateRegisterEmail(input) {
    const msgId = input.id + '-msg';
    const value = input.value.trim();

    if (!validateInput(input)) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
        displayValidationMessage(msgId, 'Please enter a valid email address.');
        return false;
    }
    
    displayValidationMessage(msgId, '');
    return true;
}

function validateRegisterPassword(input) {
    const msgId = input.id + '-msg';
    const value = input.value;

    if (!validateInput(input)) return false;

    if (value.length < 8) {
        displayValidationMessage(msgId, 'Password must be at least 8 characters long.');
        return false;
    }
    
    displayValidationMessage(msgId, '');
    return true;
}

function validateRegisterConfirmPassword(input) {
    const msgId = input.id + '-msg';
    const passwordValue = document.getElementById('register-password').value;
    const confirmValue = input.value;

    if (!validateInput(input)) return false;

    if (confirmValue !== passwordValue) {
        displayValidationMessage(msgId, 'Passwords do not match.');
        return false;
    }
    
    displayValidationMessage(msgId, '');
    return true;
}

function validateNewPassword(input) {
    const msgId = input.id + '-msg';
    const value = input.value;

    if (!validateInput(input)) return false;

    if (value.length < 8) {
        displayValidationMessage(msgId, 'Password must be at least 8 characters long.');
        return false;
    }
    
    displayValidationMessage(msgId, '');
    return true;
}

function validateConfirmNewPassword(input) {
    const msgId = input.id + '-msg';
    const passwordValue = document.getElementById('new-password').value;
    const confirmValue = input.value;

    if (!validateInput(input)) return false;

    if (confirmValue !== passwordValue) {
        displayValidationMessage(msgId, 'Passwords do not match.');
        return false;
    }
    
    displayValidationMessage(msgId, '');
    return true;
}

/* --- OTP INPUT HANDLING --- */
function handleOTPInput(currentInput, index) {
    const value = currentInput.value;
    
    // Only allow digits
    if (!/^\d*$/.test(value)) {
        currentInput.value = '';
        return;
    }
    
    // Move to next input if digit entered
    if (value.length === 1 && index < 6) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        if (nextInput) {
            nextInput.focus();
        }
    }
}

function handleOTPKeydown(event, index) {
    // Handle backspace
    if (event.key === 'Backspace') {
        const currentInput = document.getElementById(`otp-${index}`);
        
        if (currentInput.value === '' && index > 1) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            if (prevInput) {
                prevInput.focus();
                prevInput.value = '';
            }
        }
    }
    
    // Handle paste
    if (event.ctrlKey && event.key === 'v') {
        event.preventDefault();
        navigator.clipboard.readText().then(text => {
            const digits = text.replace(/\D/g, '').slice(0, 6);
            for (let i = 0; i < digits.length && i < 6; i++) {
                const input = document.getElementById(`otp-${i + 1}`);
                if (input) {
                    input.value = digits[i];
                }
            }
            if (digits.length > 0) {
                const lastFilledIndex = Math.min(digits.length, 6);
                const lastInput = document.getElementById(`otp-${lastFilledIndex}`);
                if (lastInput) lastInput.focus();
            }
        });
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

/* --- AUTHENTICATION HANDLERS --- */
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

    if (isUsernameValid && isEmailValid && isPasswordValid && isConfirmValid) {
        const requestBody = {
            username: usernameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value
        };

        showLoading('register');

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            hideLoading('register');

            if (response.ok) {
                showToast('Registration successful! Please log in.', 'success');
                displayAuthMessage('Registration successful! Redirecting to login...', 'success');
                
                document.getElementById('register-form').reset();
                setTimeout(() => {
                    setAuthView('login-view');
                }, 2000);
            } else {
                const errorMessage = data.message || 'Registration failed. Please try again.';
                showToast(errorMessage, 'error');
                displayAuthMessage(errorMessage, 'error');
            }

        } catch (error) {
            hideLoading('register');
            console.error("Registration Error:", error);
            showToast('Network error. Unable to reach server.', 'error');
            displayAuthMessage('Network error. Unable to reach server.', 'error');
        }

    } else {
        // Re-validate to display all messages if submission failed locally
        validateRegisterUsername(usernameInput);
        validateRegisterEmail(emailInput);
        validateRegisterPassword(passwordInput);
        validateRegisterConfirmPassword(confirmInput);
        showToast('Please correct the errors in the registration form.', 'error');
        displayAuthMessage('Please correct the errors in the registration form.', 'error');
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
            setTimeout(() => {
                closeAuthModal();
                window.location.href = "dashboard.html";
            }, 1200);
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
    
    resetEmail = emailInput.value.trim();
    showLoading('forgot-password');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/send-otp?email=${encodeURIComponent(resetEmail)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        hideLoading('forgot-password');
        
        if (response.ok) {
            const data = await response.text();
            showToast('OTP sent to your email! Please check your inbox.', 'success');
            
            // Move to OTP verification view
            setTimeout(() => {
                showOTPVerificationView();
            }, 1000);
        } else {
            const errorMessage = await response.text();
            showToast(errorMessage || 'Failed to send OTP. Please try again.', 'error');
            displayAuthMessage(errorMessage || 'Failed to send OTP. Please try again.', 'error');
        }
    } catch (error) {
        hideLoading('forgot-password');
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

/* --- MOBILE MENU CONTROL --- */
function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    
    if (mobileMenu) {
        mobileMenu.classList.remove('mobile-menu-open');
        setTimeout(() => {
            if (!mobileMenu.classList.contains('mobile-menu-open')) {
                mobileMenu.style.display = 'none';
            }
        }, animationDuration);
    }
    
    if (mobileMenuButton) {
        mobileMenuButton.setAttribute('aria-expanded', 'false');
    }
}

/* --- INITIALIZATION & LAYOUT LOGIC --- */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Lucide icons if available
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    const preloader = document.getElementById('preloader');
    const mainContent = document.getElementById('main-content');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const navbar = document.getElementById('navbar');
    
    if (preloader && mainContent) {
        window.addEventListener('load', () => {
            preloader.style.opacity = '0';
            setTimeout(() => {
                preloader.style.display = 'none';
                mainContent.style.opacity = '1';
            }, 500);
        });
    }

    if (mobileMenuButton && mobileMenu) {
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
    }
    
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 0) {
                navbar.classList.add('shadow-md');
            } else {
                navbar.classList.remove('shadow-md');
            }
        });
    }
    
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const modal = document.getElementById('auth-modal');
            if (modal && modal.classList.contains('open')) {
                closeAuthModal();
            }
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