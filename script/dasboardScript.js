/* ==================================================
    GLOBAL VARIABLES
================================================== */
const overlay = document.getElementById('overlay');
const mobileMenu = document.getElementById('mobileMenu');
const profilePanel = document.getElementById('profilePanel');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const profileBtn = document.getElementById('profileBtn');
const reviewsModal = document.getElementById('reviewsModal');
const addReviewModal = document.getElementById('addReviewModal');
const coursesModal = document.getElementById('coursesModal');
const myEnrollmentsModal = document.getElementById('myEnrollmentsModal');
const uploadModal = document.getElementById('uploadModal');
const createCourseModal = document.getElementById('createCourseModal');
const editProfileModal = document.getElementById('editProfileModal');
const deleteAccountModal = document.getElementById('deleteAccountModal');
const myFilesModal = document.getElementById('myFilesModal');

const API_BASE_URL = "http://localhost:8080/api";
let currentActiveCourse = null;
let currentFileForReview = null;
let selectedRating = 0;
let userEnrollments = [];
let selectedFile = null;
let searchTimeout = null;
let myFilesCurrentPage = 0;

let myFilesTotalPages = 0; 
let selectedCategorySlug = null;
let categorySearchTimeout = null;
let allCategories = []; 

// Refresh token handling
let isRefreshing = false;
let refreshPromise = null;

/* ==================================================
    DEBUG HELPERS (for testing in console)
================================================== */
window.debugAuth = {
  // Show current token
  showToken: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    console.log("🔑 Current Access Token:");
    console.log("Full token:", token);
    console.log("First 50 chars:", token?.substring(0, 50) + "...");
    console.log("Token length:", token?.length);
    return token;
  },
  
  // Check if token is expired (requires jwt-decode or manual parsing)
  checkExpiry: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      console.log("❌ No token found");
      return null;
    }
    
    try {
      // Parse JWT (simple version - decode the payload)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      
      const expDate = new Date(payload.exp * 1000);
      const now = new Date();
      const timeLeft = expDate - now;
      
      console.log("📅 Token Expiry Info:");
      console.log("Expires at:", expDate.toLocaleString());
      console.log("Current time:", now.toLocaleString());
      console.log("Time left:", Math.floor(timeLeft / 1000), "seconds");
      console.log("Is expired:", timeLeft < 0);
      
      return {
        expiresAt: expDate,
        isExpired: timeLeft < 0,
        timeLeftSeconds: Math.floor(timeLeft / 1000)
      };
    } catch (err) {
      console.error("❌ Error parsing token:", err);
      return null;
    }
  },
  
  // Manually trigger refresh
  forceRefresh: async () => {
    console.log("🔄 Manually triggering token refresh...");
    const result = await refreshAccessToken();
    console.log("Result:", result ? "✅ Success" : "❌ Failed");
    return result;
  },
  
  // Show all auth-related localStorage
  showAll: () => {
    console.log("📦 All Auth Data:");
    console.log("Token:", localStorage.getItem(TOKEN_KEY)?.substring(0, 50) + "...");
    console.log("Token Type:", localStorage.getItem(TOKEN_TYPE_KEY));
    console.log("Public ID:", localStorage.getItem('publicId'));
  },
  
  // Test API call
  testCall: async (endpoint = '/users/me') => {
    console.log(`🧪 Testing API call to: ${endpoint}`);
    try {
      const response = await apiFetch(`${API_BASE_URL}${endpoint}`);
      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);
      return data;
    } catch (err) {
      console.error("Test call failed:", err);
      return null;
    }
  }
};

console.log("🛠️ Debug tools loaded! Use window.debugAuth in console:");
console.log("  - debugAuth.showToken()      : Show current token");
console.log("  - debugAuth.checkExpiry()    : Check if token is expired");
console.log("  - debugAuth.forceRefresh()   : Manually refresh token");
console.log("  - debugAuth.showAll()        : Show all auth data");
console.log("  - debugAuth.testCall()       : Test an API call");

/* ==================================================
    AUTH CONSTANTS
================================================== */
const TOKEN_KEY = "authToken";
const TOKEN_TYPE_KEY = "tokenType";

/* ==================================================
    TOAST MESSAGES
================================================== */
function showToast(message, type = 'error') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
      <span>${message}</span>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/* ==================================================
    FORCE LOGOUT
================================================== */
async function forceLogout() {
  console.log("🚪 Force logout initiated");
  console.log("📋 Current token before logout:", localStorage.getItem(TOKEN_KEY)?.substring(0, 20) + "...");
  
  try {
    // Don't use apiFetch here to avoid infinite loops
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
    console.log("✅ Logout request sent to server");
  } catch (err) {
    console.error("❌ Logout error:", err);
  }

  localStorage.clear();
  console.log("🗑️ LocalStorage cleared");
  console.log("🔄 Redirecting to login page...");
  window.location.href = "index.html";
}

/* ==================================================
    LOCALSTORAGE CHANGE MONITOR (DEBUG HELPER)
================================================== */
// Override localStorage.setItem to log all changes
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  if (key === TOKEN_KEY) {
    console.log("💾 LocalStorage UPDATE:", {
      key: key,
      oldValue: localStorage.getItem(key)?.substring(0, 20) + "...",
      newValue: value?.substring(0, 20) + "...",
      timestamp: new Date().toISOString()
    });
  }
  originalSetItem.apply(this, arguments);
};

/* ==================================================
    REFRESH ACCESS TOKEN
================================================== */
async function refreshAccessToken() {
  // If already refreshing, return the existing promise
  if (isRefreshing) {
    console.log("⏳ Refresh already in progress, waiting...");
    return refreshPromise;
  }

  isRefreshing = true;
  
  // Store old token for comparison
  const oldToken = localStorage.getItem(TOKEN_KEY);
  console.log("🔄 Starting token refresh...");
  console.log("📋 Old token (first 20 chars):", oldToken ? oldToken.substring(0, 20) + "..." : "null");
  
  refreshPromise = (async () => {
    try {
      console.log("📡 Calling refresh endpoint:", `${API_BASE_URL}/auth/refresh`);
      
      // Call refresh endpoint - HTTP-only cookie is sent automatically
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include" // Browser sends the HTTP-only refresh token cookie
      });

      console.log("📥 Refresh response status:", res.status);

      if (!res.ok) {
        console.error("❌ Refresh failed with status:", res.status);
        const errorText = await res.text();
        console.error("❌ Error response:", errorText);
        return false;
      }

      const data = await res.json();
      console.log("📦 Refresh response data:", {
        hasAccessToken: !!data.accessToken,
        tokenType: data.tokenType,
        hasPublicId: !!data.publicId
      });
      
      // Store the new access token
      if (data.accessToken) {
        const newToken = data.accessToken;
        
        localStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(TOKEN_TYPE_KEY, data.tokenType || "Bearer");
        
        // Update publicId if provided
        if (data.publicId) {
          localStorage.setItem('publicId', data.publicId);
        }
        
        // Verify the token was actually stored
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const tokenChanged = oldToken !== newToken;
        
        console.log("✅ Token refresh complete!");
        console.log("📋 New token (first 20 chars):", newToken.substring(0, 20) + "...");
        console.log("🔄 Token changed:", tokenChanged);
        console.log("💾 Verified stored token matches:", storedToken === newToken);
        
        if (!tokenChanged) {
          console.warn("⚠️ WARNING: New token is same as old token!");
        } else {
          // Show a subtle notification that token was refreshed
          showToast('Session refreshed', 'success');
        }
        
        return true;
      } else {
        console.error("❌ No access token in refresh response");
        console.error("❌ Response data:", data);
        return false;
      }
      
    } catch (err) {
      console.error("❌ Refresh token request failed:", err);
      console.error("❌ Error details:", {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
      console.log("🏁 Refresh process ended. isRefreshing set to false");
    }
  })();

  return refreshPromise;
}

/* ==================================================
    AUTH-AWARE FETCH WRAPPER
================================================== */
async function apiFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const tokenType = localStorage.getItem(TOKEN_TYPE_KEY) || "Bearer";

  console.log(`📡 API Request to: ${url}`);
  console.log(`🔑 Using token (first 20 chars): ${token ? token.substring(0, 20) + "..." : "null"}`);

  // Build headers with access token (only if token exists)
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `${tokenType} ${token}` } : {})
  };

  // First attempt with current access token
  let response = await fetch(url, {
    ...options,
    headers,
    credentials: "include" // Always include cookies
  });

  console.log(`📥 Response status: ${response.status}`);

  // If not 401, return the response immediately
  if (response.status !== 401) {
    console.log(`✅ Request successful (status ${response.status})`);
    return response;
  }

  // Handle 401 - try to refresh the token
  console.log("⚠️ 401 Unauthorized - Access token expired!");
  console.log("🔄 Attempting token refresh...");
  
  const refreshed = await refreshAccessToken();
  
  if (!refreshed) {
    console.error("❌ Token refresh failed - forcing logout");
    forceLogout();
    throw new Error("Session expired. Please login again.");
  }

  // Retry with the new token
  const newToken = localStorage.getItem(TOKEN_KEY);
  const newTokenType = localStorage.getItem(TOKEN_TYPE_KEY) || "Bearer";
  
  console.log("🔄 Retrying original request with new token...");
  console.log(`🔑 New token (first 20 chars): ${newToken ? newToken.substring(0, 20) + "..." : "null"}`);
  
  const retryHeaders = {
    ...(options.headers || {}),
    Authorization: `${newTokenType} ${newToken}`
  };

  response = await fetch(url, {
    ...options,
    headers: retryHeaders,
    credentials: "include"
  });

  console.log(`📥 Retry response status: ${response.status}`);

  // If still 401 after refresh, force logout
  if (response.status === 401) {
    console.error("❌ Still 401 after refresh - forcing logout");
    forceLogout();
    throw new Error("Session expired. Please login again.");
  }

  console.log("✅ Request successful after token refresh!");
  return response;
}

/* ==================================================
    CHECK AUTH
================================================== */
function checkAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

/* ==================================================
    FETCH USER DETAILS
================================================== */
async function fetchUserDetails() {
  const publicId = localStorage.getItem('publicId');

  try {
    const response = await apiFetch(`${API_BASE_URL}/users/${publicId}`, {
      method: "GET"
    });

    if (!response.ok) {
      showToast("Unable to load user details.");
      return null;
    }

    return await response.json();

  } catch (err) {
    console.error("Network error:", err);
    showToast("Network issue. Check connection.");
    return null;
  }
}

/* ==================================================
    UPDATE UI
================================================== */
function updateUI(userData) {
  if (!userData) return;

  const { username, email, role, enrollmentsCount, uploadsCount, averageRating } = userData;
  const roleText = role === "ADMIN" ? "Admin" : "ShareMind";

  // Update username
  document.getElementById("usernameTop").textContent = username;
  document.getElementById("usernameDesktop").textContent = username;
  document.getElementById("usernameMobile").textContent = username;

  // Update email
  if (email) {
    document.getElementById("emailDesktop").textContent = email;
    document.getElementById("emailMobile").textContent = email;
  }

  // Update role
  document.getElementById("roleDesktop").textContent = roleText;
  document.getElementById("roleMobile").textContent = roleText;

  // Update stats - Desktop
  document.getElementById("enrolledDesktop").textContent = enrollmentsCount;
  document.getElementById("uploadsDesktop").textContent = uploadsCount;
  document.getElementById("ratingDesktop").textContent = averageRating.toFixed(1);

  // Update stats - Mobile
  document.getElementById("enrolledMobile").textContent = enrollmentsCount;
  document.getElementById("uploadsMobile").textContent = uploadsCount;
  document.getElementById("ratingMobile").textContent = averageRating.toFixed(1);
}

/* ==================================================
    LOGOUT
================================================== */
async function logout(event) {
  if (event) event.preventDefault();

  try {
    await apiFetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST"
    });
  } catch (err) {
    console.warn("Logout network issue, clearing session anyway.");
  }

  localStorage.clear();
  showToast("Logging out...");
  setTimeout(() => (window.location.href = "index.html"), 1200);
}

/* ==================================================
    LOAD COURSES
================================================== */
async function loadCourses() {
  try {
    const res = await apiFetch(`${API_BASE_URL}/courses`);

    if (!res.ok) throw new Error("Failed to fetch courses");

    const courses = await res.json();
    renderCourses(courses);

  } catch (err) {
    console.error("Courses fetch error", err);
    document.getElementById("coursesList").innerHTML =
      `<p class="col-span-full text-red-500 text-center py-4">Failed to load courses.</p>`;
  }
}

/* ==================================================
    RENDER COURSES
================================================== */
function renderCourses(courses) {
  const row1 = document.getElementById("coursesRow1");
  const row2 = document.getElementById("coursesRow2");
  
  row1.innerHTML = "";
  row2.innerHTML = "";

  if (!courses || courses.length === 0) {
    row1.innerHTML = `<p class="text-gray-500 py-2">No courses available.</p>`;
    return;
  }

  // Split courses into two rows
  const midpoint = Math.ceil(courses.length / 2);
  const row1Courses = courses.slice(0, midpoint);
  const row2Courses = courses.slice(midpoint);

  // Render Row 1 - duplicate for infinite scroll effect
  const row1Content = row1Courses.map(c => createCourseButton(c)).join('');
  row1.innerHTML = row1Content + row1Content; // Duplicate for seamless loop

  // Render Row 2 - duplicate for infinite scroll effect
  const row2Content = row2Courses.map(c => createCourseButton(c)).join('');
  row2.innerHTML = row2Content + row2Content; // Duplicate for seamless loop
}

/* ==================================================
    CREATE COURSE BUTTON
================================================== */
function createCourseButton(course) {
  return `
    <button 
      class="course-btn px-4 py-2 border-2 border-gray-300 rounded-lg hover:border-indigo-500 text-sm font-medium text-gray-700 hover:text-indigo-600"
      onclick="selectCourse('${course.courseCode}', this)"
      data-course-code="${course.courseCode}">
      ${course.title}
    </button>
  `;
}

/* ==================================================
    SELECT COURSE
================================================== */
function selectCourse(courseCode, element) {
  // Remove active class from all course buttons
  document.querySelectorAll('.course-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Add active class to all buttons with same course code (including duplicates)
  document.querySelectorAll(`[data-course-code="${courseCode}"]`).forEach(btn => {
    btn.classList.add('active');
  });
  
  currentActiveCourse = courseCode;
  loadResources(courseCode);
}

/* ==================================================
    SCROLL COURSES
================================================== */
function scrollCoursesLeft() {
  const wrapper = document.getElementById('coursesScrollWrapper');
  wrapper.scrollBy({
    left: -300,
    behavior: 'smooth'
  });
}

function scrollCoursesRight() {
  const wrapper = document.getElementById('coursesScrollWrapper');
  wrapper.scrollBy({
    left: 300,
    behavior: 'smooth'
  });
}

/* ==================================================
    LOAD RESOURCES
================================================== */
async function loadResources(courseCode) {
  const box = document.getElementById("resources");
  const placeholder = document.getElementById("resourcesPlaceholder");
  
  if (placeholder) placeholder.style.display = 'none';
  
  box.innerHTML = `<div class="col-span-full flex justify-center py-8"><div class="spinner"></div></div>`;

  try {
    const res = await apiFetch(`${API_BASE_URL}/files/course/${courseCode}`);

    if (!res.ok) throw new Error("Failed to fetch resources");

    const data = await res.json();
    const files = data.items || [];
    renderResources(files);

  } catch (err) {
    console.error("Resources fetch error", err);
    box.innerHTML = `<p class="col-span-full text-red-500 text-center py-8">Failed to load course files.</p>`;
  }
}

/* ==================================================
    RENDER RESOURCES
================================================== */
async function renderResources(files) {
  const box = document.getElementById("resources");
  box.innerHTML = "";

  if (!files || files.length === 0) {
    box.innerHTML = `
      <div class="col-span-full text-center py-12 bg-white rounded-lg shadow-sm">
        <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>
        <p class="text-gray-500">No files uploaded in this course yet.</p>
      </div>`;
    return;
  }

  // Fetch reviews for all files in parallel
  const filesWithReviews = await Promise.all(
    files.map(async (file) => {
      const reviewData = await fetchFileReviews(file.publicId);
      return {
        ...file,
        reviewData
      };
    })
  );

  // Render each file card
  filesWithReviews.forEach(file => {
    const icon = getFileIcon(file.fileType);
    
    // Calculate average rating from reviews
    let averageRating = 0;
    let totalReviews = 0;
    
    if (file.reviewData && file.reviewData.iteems && file.reviewData.iteems.length > 0) {
      const reviews = file.reviewData.iteems;
      totalReviews = file.reviewData.totalElements || reviews.length;
      const sumRatings = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
      averageRating = sumRatings / reviews.length;
    }
    
    const stars = renderStars(averageRating);

    const card = document.createElement('article');
    card.className = 'resource-card bg-white p-4 sm:p-5 rounded-lg shadow-sm';
    
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row items-start gap-4">
        <!-- File Icon -->
        <div class="flex-shrink-0">
          ${icon}
        </div>
        
        <!-- File Details -->
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-gray-800 text-lg mb-1">${file.fileName}</h3>
          
          <div class="flex items-center gap-3 mb-2 flex-wrap">
            <span class="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              ${file.courseCode}
            </span>
            <span class="text-xs text-gray-500">
              by <strong>${file.uploadedByPublicId}</strong>
            </span>
          </div>
          
          <!-- Rating -->
          <div class="flex items-center gap-2 mb-3">
            <div class="star-rating">
              ${stars}
            </div>
            <span class="text-sm text-gray-600">
              ${averageRating > 0 ? averageRating.toFixed(1) : '0.0'} 
              (${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'})
            </span>
          </div>
          
          <!-- Action Buttons -->
          <div class="flex gap-2 flex-wrap">
            <button onclick="viewFile('${file.publicId}', '${file.fileName}')" 
                    class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              View File
            </button>
            
            <button onclick="openReviews('${file.publicId}', '${file.fileName}')" 
                    class="px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition font-medium text-sm">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
              Reviews (${totalReviews})
            </button>

            <button onclick="openAddReviewModal('${file.publicId}', '${file.fileName}')" 
                    class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Add Review
            </button>
          </div>
        </div>
      </div>
    `;
    
    box.appendChild(card);
  });
}

/* ==================================================
    FETCH FILE REVIEWS
================================================== */
async function fetchFileReviews(filePublicId) {
  try {
    const response = await apiFetch(`${API_BASE_URL}/files/${filePublicId}/reviews`);

    if (!response.ok) {
      console.warn(`Failed to fetch reviews for file ${filePublicId}`);
      return null;
    }

    return await response.json();
    
  } catch (error) {
    console.error("Error fetching file reviews:", error);
    return null;
  }
}

/* ==================================================
    RENDER STAR RATING
================================================== */
function renderStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  let starsHtml = '';
  
  // Full stars
  for (let i = 0; i < fullStars; i++) {
    starsHtml += '<span class="star filled">★</span>';
  }
  
  // Half star
  if (hasHalfStar) {
    starsHtml += '<span class="star filled">★</span>';
  }
  
  // Empty stars
  for (let i = 0; i < emptyStars; i++) {
    starsHtml += '<span class="star">★</span>';
  }
  
  return starsHtml;
}

/* ==================================================
    VIEW FILE WITH TOKEN
================================================== */
async function viewFile(filePublicId, fileName) {
  const downloadUrl = `${API_BASE_URL}/files/${filePublicId}/download`;
  
  try {
    showToast('Loading file...', 'success');
    
    const response = await apiFetch(downloadUrl, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error("Failed to fetch file");
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const fileType = blob.type;
    
    if (fileType.includes('pdf') || fileType.includes('image')) {
      const newWindow = window.open(blobUrl, '_blank');
      if (!newWindow) {
        showToast("Please allow pop-ups to view files", 'error');
        downloadFileFromBlob(blob, fileName);
      }
    } else {
      downloadFileFromBlob(blob, fileName);
    }
    
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    
  } catch (error) {
    console.error("Error viewing file:", error);
    showToast("Failed to load file. Please try again.", 'error');
  }
}

/* ==================================================
    DOWNLOAD FILE FROM BLOB
================================================== */
function downloadFileFromBlob(blob, fileName) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  showToast('Download started', 'success');
}

/* ==================================================
    OPEN REVIEWS MODAL
================================================== */
async function openReviews(filePublicId, fileName) {
  currentFileForReview = { publicId: filePublicId, fileName: fileName };
  
  reviewsModal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  document.getElementById('modalFileName').textContent = `Reviews: ${fileName}`;
  document.getElementById('reviewsContent').innerHTML = '<div class="spinner"></div>';
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/files/${filePublicId}/reviews`);

    if (!response.ok) throw new Error("Failed to fetch reviews");

    const data = await response.json();
    console.log("Reviews response:", data);
    const reviews = data.iteems || data.items || [];
    
    renderReviews(reviews);
    
  } catch (error) {
    console.error("Error fetching reviews:", error);
    document.getElementById('reviewsContent').innerHTML = 
      '<p class="text-red-500 text-center py-8">Failed to load reviews.</p>';
  }
}

/* ==================================================
    RENDER REVIEWS
================================================== */
function renderReviews(reviews) {
  const container = document.getElementById('reviewsContent');
  
  if (!reviews || reviews.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12">
        <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
        </svg>
        <p class="text-gray-500">No reviews yet. Be the first to review!</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  reviews.forEach(review => {
    const stars = renderStars(review.rating || 0);
    const date = new Date(review.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    const reviewCard = document.createElement('div');
    reviewCard.className = 'review-card bg-gray-50 p-4 rounded-lg mb-3';
    
    reviewCard.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <div class="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
            ${(review.reviewerUsernsame || review.reviewerUsername || 'A').charAt(0).toUpperCase()}
          </div>
        </div>
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div>
              <h4 class="font-semibold text-gray-800">${review.reviewerUsernsame || review.reviewerUsername || 'Anonymous'}</h4>
              <p class="text-xs text-gray-500">${review.reviewerPublicId}</p>
            </div>
            <span class="text-xs text-gray-500">${date}</span>
          </div>
          
          <div class="star-rating mb-2">
            ${stars}
          </div>
          
          ${review.comment ? `<p class="text-gray-700 text-sm">${review.comment}</p>` : '<p class="text-gray-500 text-sm italic">No comment provided</p>'}
        </div>
      </div>
    `;
    
    container.appendChild(reviewCard);
  });
}

/* ==================================================
    OPEN ADD REVIEW MODAL
================================================== */
function openAddReviewModal(filePublicId, fileName) {
  currentFileForReview = { publicId: filePublicId, fileName: fileName };
  
  addReviewModal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  // Reset form
  selectedRating = 0;
  document.getElementById('reviewComment').value = '';
  document.getElementById('ratingText').textContent = 'Click a star to rate';
  document.querySelectorAll('.rating-star').forEach(star => {
    star.classList.remove('selected');
  });
}

/* ==================================================
    CLOSE ADD REVIEW MODAL
================================================== */
function closeAddReviewModal() {
  addReviewModal.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* ==================================================
    RATING SELECTOR INTERACTION
================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const ratingStars = document.querySelectorAll('.rating-star');
  
  ratingStars.forEach(star => {
    star.addEventListener('click', function() {
      selectedRating = parseInt(this.dataset.rating);
      
      // Update star colors
      ratingStars.forEach((s, index) => {
        if (index < selectedRating) {
          s.classList.add('selected');
        } else {
          s.classList.remove('selected');
        }
      });
      
      // Update text
      const ratingTexts = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
      document.getElementById('ratingText').textContent = `${ratingTexts[selectedRating]} (${selectedRating} star${selectedRating > 1 ? 's' : ''})`;
    });
  });
  
  // Form submission
  document.getElementById('reviewForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitReview();
  });
});

/* ==================================================
    SUBMIT REVIEW
================================================== */
async function submitReview() {
  if (selectedRating === 0) {
    showToast('Please select a rating', 'error');
    return;
  }
  
  const comment = document.getElementById('reviewComment').value.trim();
  
  const reviewData = {
    rating: selectedRating,
    comment: comment || ""
  };
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/files/${currentFileForReview.publicId}/reviews`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(reviewData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit review');
    }
    
    showToast('Review submitted successfully!', 'success');
    closeAddReviewModal();
    
    // Refresh the current course resources to update ratings
    if (currentActiveCourse) {
      await loadResources(currentActiveCourse);
    }
    
    // If reviews modal is open, refresh it
    if (reviewsModal.classList.contains('show')) {
      openReviews(currentFileForReview.publicId, currentFileForReview.fileName);
    }
    
  } catch (error) {
    console.error('Error submitting review:', error);
    showToast('Failed to submit review. Please try again.', 'error');
  }
}

/* ==================================================
    CLOSE REVIEWS MODAL
================================================== */
function closeReviewsModal() {
  reviewsModal.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* ==================================================
    FILE ICON HELPER
================================================== */
function getFileIcon(type) {
  const iconClass = "w-12 h-12 sm:w-14 sm:h-14";
  
  if (type.includes("pdf")) {
    return `<svg class="${iconClass} text-red-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
      <path d="M14 2v6h6M9 13h6M9 17h6" stroke="white" stroke-width="1"/>
    </svg>`;
  }
  if (type.includes("image")) {
    return `<svg class="${iconClass} text-green-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
    </svg>`;
  }
  if (type.includes("video")) {
    return `<svg class="${iconClass} text-purple-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
    </svg>`;
  }
  if (type.includes("word") || type.includes("doc")) {
    return `<svg class="${iconClass} text-blue-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
      <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" stroke="white" stroke-width="1"/>
    </svg>`;
  }
  
  return `<svg class="${iconClass} text-gray-400" fill="currentColor" viewBox="0 0 24 24">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
    <path d="M14 2v6h6" stroke="white" stroke-width="1"/>
  </svg>`;
}

/* ==================================================
    MENU CONTROLS
================================================== */
function openMobileMenu() {
  mobileMenu.classList.add("show");
  overlay.classList.add("show");
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  mobileMenu.classList.remove("show");
  overlay.classList.remove("show");
  document.body.style.overflow = '';
}

function toggleProfilePanel() {
  const isOpen = profilePanel.classList.toggle("show");
  overlay.classList.toggle("show", isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

hamburgerBtn?.addEventListener("click", () => {
  const isOpen = mobileMenu.classList.toggle("show");
  overlay.classList.toggle("show", isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

profileBtn?.addEventListener("click", toggleProfilePanel);

overlay?.addEventListener("click", () => {
  closeMobileMenu();
  if (profilePanel.classList.contains("show")) {
    toggleProfilePanel();
  }
  if (reviewsModal.classList.contains("show")) {
    closeReviewsModal();
  }
  if (addReviewModal.classList.contains("show")) {
    closeAddReviewModal();
  }
  if (coursesModal.classList.contains("show")) {
    closeCoursesModal();
  }
  if (myEnrollmentsModal.classList.contains("show")) {
    closeMyEnrollmentsModal();
  }
  if (uploadModal.classList.contains("show")) {
    closeUploadModal();
  }
  if (createCourseModal.classList.contains("show")) {
    closeCreateCourseModal();
  }
  if (editProfileModal.classList.contains("show")) {
    closeEditProfileModal();
  }
  if (deleteAccountModal.classList.contains("show")) {
    closeDeleteAccountModal();
  }
  if (myFilesModal.classList.contains("show")) {
    closeMyFilesModal();
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeMobileMenu();
    if (profilePanel.classList.contains("show")) {
      toggleProfilePanel();
    }
    if (reviewsModal.classList.contains("show")) {
      closeReviewsModal();
    }
    if (addReviewModal.classList.contains("show")) {
      closeAddReviewModal();
    }
    if (coursesModal.classList.contains("show")) {
      closeCoursesModal();
    }
    if (myEnrollmentsModal.classList.contains("show")) {
      closeMyEnrollmentsModal();
    }
    if (uploadModal.classList.contains("show")) {
      closeUploadModal();
    }
    if (createCourseModal.classList.contains("show")) {
      closeCreateCourseModal();
    }
    if (editProfileModal.classList.contains("show")) {
      closeEditProfileModal();
    }
    if (deleteAccountModal.classList.contains("show")) {
      closeDeleteAccountModal();
    }
    if (myFilesModal.classList.contains("show")) {
      closeMyFilesModal();
    }
  }
});

/* ==================================================
    DASHBOARD INIT
================================================== */
async function initDashboard() {
  if (!checkAuth()) return;
  
  const [user] = await Promise.all([
    fetchUserDetails(),
    loadCourses(),
    loadUserEnrollments()
  ]);
  
  updateUI(user);
}

/* ==================================================
    LOAD USER ENROLLMENTS
================================================== */
async function loadUserEnrollments() {
  try {
    const res = await apiFetch(`${API_BASE_URL}/enrollments/me`);

    if (!res.ok) throw new Error("Failed to fetch enrollments");

    userEnrollments = await res.json();
    console.log("User enrollments loaded:", userEnrollments);

  } catch (err) {
    console.error("Enrollments fetch error", err);
  }
}

/* ==================================================
    OPEN COURSES MODAL
================================================== */
async function openCoursesModal(event) {
  if (event) event.preventDefault();
  
  coursesModal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  document.getElementById('coursesContent').innerHTML = '<div class="spinner"></div>';
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/courses`);

    if (!response.ok) throw new Error("Failed to fetch courses");

    const courses = await response.json();
    renderCoursesInModal(courses);
    
  } catch (error) {
    console.error("Error fetching courses:", error);
    document.getElementById('coursesContent').innerHTML = 
      '<p class="text-red-500 text-center py-8">Failed to load courses.</p>';
  }
}

/* ==================================================
    RENDER COURSES IN MODAL
================================================== */
function renderCoursesInModal(courses) {
  const container = document.getElementById('coursesContent');
  
  if (!courses || courses.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8">
        <p class="text-gray-500">No courses available.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  courses.forEach(course => {
    const isEnrolled = userEnrollments.some(e => e.courseCode === course.courseCode);
    const enrollment = userEnrollments.find(e => e.courseCode === course.courseCode);
    
    const courseCard = document.createElement('div');
    courseCard.className = 'border rounded-lg p-4 hover:shadow-md transition mb-4';
    
    const date = new Date(course.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    courseCard.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <h4 class="font-bold text-lg text-gray-800">${course.title}</h4>
            ${isEnrolled ? '<span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Enrolled</span>' : ''}
          </div>
          
          <div class="space-y-1 text-sm text-gray-600">
            <p><strong>Code:</strong> ${course.courseCode}</p>
            <p><strong>Category:</strong> ${course.categoryName}</p>
            <p><strong>Created:</strong> ${date}</p>
          </div>
        </div>
        
        <div class="flex-shrink-0">
          ${isEnrolled ? 
            `<button onclick="unenrollFromCourse('${enrollment.publicId}', '${course.courseCode}')" 
                     class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm">
              Unenroll
            </button>` :
            `<button onclick="enrollInCourse('${course.courseCode}')" 
                     class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm">
              Enroll Now
            </button>`
          }
        </div>
      </div>
    `;
    
    container.appendChild(courseCard);
  });
}

/* ==================================================
    ENROLL IN COURSE
================================================== */
async function enrollInCourse(courseCode) {
  const userPublicId = localStorage.getItem("publicId");
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/enrollments`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userPublicId: userPublicId,
        courseCode: courseCode
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to enroll');
    }
    
    const enrollment = await response.json();
    userEnrollments.push(enrollment);
    
    showToast('Successfully enrolled in course!', 'success');
    
    // Refresh courses modal
    openCoursesModal();
    
  } catch (error) {
    console.error('Error enrolling:', error);
    showToast('Failed to enroll. You may already be enrolled.', 'error');
  }
}

/* ==================================================
    UNENROLL FROM COURSE
================================================== */
async function unenrollFromCourse(enrollmentPublicId, courseCode) {
  if (!confirm('Are you sure you want to unenroll from this course?')) {
    return;
  }
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/enrollments/${enrollmentPublicId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error('Failed to unenroll');
    }
    
    // Remove from local enrollments
    userEnrollments = userEnrollments.filter(e => e.publicId !== enrollmentPublicId);
    
    showToast('Successfully unenrolled from course', 'success');
    
    // Refresh courses modal if open
    if (coursesModal.classList.contains('show')) {
      openCoursesModal();
    }
    
    // Refresh enrollments modal if open
    if (myEnrollmentsModal.classList.contains('show')) {
      renderMyEnrollments();
    }
    
  } catch (error) {
    console.error('Error unenrolling:', error);
    showToast('Failed to unenroll. Please try again.', 'error');
  }
}

/* ==================================================
    CLOSE COURSES MODAL
================================================== */
function closeCoursesModal() {
  coursesModal.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* ==================================================
    OPEN MY ENROLLMENTS
================================================== */
async function openMyEnrollments(event) {
  if (event) event.preventDefault();
  
  myEnrollmentsModal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  document.getElementById('enrollmentsContent').innerHTML = '<div class="spinner"></div>';
  
  await loadUserEnrollments();
  renderMyEnrollments();
}

/* ==================================================
    RENDER MY ENROLLMENTS
================================================== */
function renderMyEnrollments() {
  const container = document.getElementById('enrollmentsContent');
  
  if (!userEnrollments || userEnrollments.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12">
        <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
        </svg>
        <p class="text-gray-500 mb-4">You haven't enrolled in any courses yet.</p>
        <button onclick="closeMyEnrollmentsModal(); openCoursesModal();" 
                class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
          Browse Courses
        </button>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  userEnrollments.forEach(enrollment => {
    const date = new Date(enrollment.enrolledAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const enrollmentCard = document.createElement('div');
    enrollmentCard.className = 'border rounded-lg p-4 hover:shadow-md transition mb-4';
    
    enrollmentCard.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <h4 class="font-bold text-lg text-gray-800 mb-2">${enrollment.courseCode}</h4>
          
          <div class="space-y-1 text-sm text-gray-600 mb-3">
            <p><strong>Enrolled:</strong> ${date}</p>
            <p><strong>Enrollment ID:</strong> ${enrollment.publicId}</p>
          </div>
          
          <button onclick="loadResourcesForEnrollment('${enrollment.courseCode}')" 
                  class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm">
            View Resources
          </button>
        </div>
        
        <div class="flex-shrink-0">
          <button onclick="unenrollFromCourse('${enrollment.publicId}', '${enrollment.courseCode}')" 
                  class="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium text-sm">
            Unenroll
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(enrollmentCard);
  });
}

/* ==================================================
    LOAD RESOURCES FOR ENROLLMENT
================================================== */
function loadResourcesForEnrollment(courseCode) {
  closeMyEnrollmentsModal();
  
  // Find and click the course button
  const courseButtons = document.querySelectorAll('.course-btn');
  courseButtons.forEach(btn => {
    if (btn.textContent.includes(courseCode) || btn.dataset.code === courseCode) {
      btn.click();
    }
  });
  
  // If button not found, load resources directly
  currentActiveCourse = courseCode;
  loadResources(courseCode);
}

/* ==================================================
    CLOSE MY ENROLLMENTS MODAL
================================================== */
function closeMyEnrollmentsModal() {
  myEnrollmentsModal.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* ==================================================
    OPEN UPLOAD MODAL
================================================== */
async function openUploadModal(event) {
  if (event) event.preventDefault();
  
  uploadModal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  // Reset form
  document.getElementById('uploadForm').reset();
  selectedFile = null;
  document.getElementById('fileInfo').classList.add('hidden');
  
  // Load enrolled courses into select
  await loadEnrolledCoursesForUpload();
}

/* ==================================================
    LOAD ENROLLED COURSES FOR UPLOAD
================================================== */
async function loadEnrolledCoursesForUpload() {
  const select = document.getElementById('uploadCourseSelect');
  
  if (userEnrollments.length === 0) {
    await loadUserEnrollments();
  }
  
  if (userEnrollments.length === 0) {
    select.innerHTML = '<option value="">No enrolled courses. Please enroll in a course first.</option>';
    return;
  }
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/courses`);
    
    if (!response.ok) throw new Error("Failed to fetch courses");
    
    const allCourses = await response.json();
    
    // Filter to only show enrolled courses
    const enrolledCourses = allCourses.filter(course => 
      userEnrollments.some(e => e.courseCode === course.courseCode)
    );
    
    select.innerHTML = '<option value="">-- Select a course --</option>';
    enrolledCourses.forEach(course => {
      const option = document.createElement('option');
      option.value = course.courseCode;
      option.textContent = `${course.courseCode} - ${course.title}`;
      select.appendChild(option);
    });
    
  } catch (error) {
    console.error('Error loading courses:', error);
    select.innerHTML = '<option value="">Error loading courses</option>';
  }
}

/* ==================================================
    HANDLE FILE SELECT
================================================== */
function handleFileSelect(event) {
  selectedFile = event.target.files[0];
  
  if (selectedFile) {
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    
    fileName.textContent = selectedFile.name;
    fileSize.textContent = `(${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`;
    fileInfo.classList.remove('hidden');
  }
}

/* ==================================================
    CLOSE UPLOAD MODAL
================================================== */
function closeUploadModal() {
  uploadModal.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* ==================================================
    UPLOAD FILE FORM SUBMISSION
================================================== */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await uploadFile();
  });
  
  document.getElementById('createCourseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await createCourse();
  });
  
  document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await updateProfile();
  });
});

/* ==================================================
    UPLOAD FILE
================================================== */
async function uploadFile() {
  const courseCode = document.getElementById('uploadCourseSelect').value;
  const description = document.getElementById('fileDescription').value.trim();
  
  if (!courseCode) {
    showToast('Please select a course', 'error');
    return;
  }
  
  if (!selectedFile) {
    showToast('Please select a file', 'error');
    return;
  }
  
  // Create FormData
  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('courseCode', courseCode);
  formData.append('description', description || '');
  
  const uploadBtn = document.getElementById('uploadBtn');
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading...';
  
  try {
    // Don't set Content-Type for FormData - browser handles it
    const response = await apiFetch(`${API_BASE_URL}/files/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }
    
    const result = await response.json();
    console.log('Upload successful:', result);
    
    showToast('File uploaded successfully!', 'success');
    closeUploadModal();
    
    // Refresh resources if viewing the same course
    if (currentActiveCourse === courseCode) {
      await loadResources(courseCode);
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    showToast(error.message || 'Failed to upload file', 'error');
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload File';
  }
}

/* ==================================================
    OPEN CREATE COURSE MODAL
================================================== */
function openCreateCourseModal() {
  createCourseModal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  document.getElementById('createCourseForm').reset();
}

/* ==================================================
    CLOSE CREATE COURSE MODAL
================================================== */
function closeCreateCourseModal() {
  createCourseModal.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* ==================================================
    CREATE COURSE
================================================== */
async function createCourse() {
  const title = document.getElementById('courseTitle').value.trim();
  const categoryName = document.getElementById('courseCategory').value.trim();
  const description = document.getElementById('courseDescription').value.trim();
  const categorySlug = selectedCategorySlug || document.getElementById('courseCategory').value.trim();
  
  if (!title || !categoryName || !description) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/courses`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: title,
        description: description,
        categorySlug: categorySlug,
        categoryName: categoryName,
        courseCode: null
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create course');
    }
    
    const newCourse = await response.json();
    console.log('Course created:', newCourse);
    
    showToast('Course created successfully!', 'success');
    
    // Auto-enroll the creator in the course
    await enrollInCourse(newCourse.courseCode);
    
    closeCreateCourseModal();
    
    // Refresh courses list and enrolled courses
    await Promise.all([
      loadCourses(),
      loadUserEnrollments()
    ]);
    
    // Refresh upload modal courses if it's open
    if (uploadModal.classList.contains('show')) {
      await loadEnrolledCoursesForUpload();
      document.getElementById('uploadCourseSelect').value = newCourse.courseCode;
    }
    
  } catch (error) {
    console.error('Create course error:', error);
    showToast(error.message || 'Failed to create course', 'error');
  }
}

/* ==================================================
    SEARCH FILES
================================================== */
async function handleSearch(event) {
  const query = event.target.value.trim();
  
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  // If query is empty, clear search
  if (!query) {
    clearSearch();
    return;
  }
  
  // Debounce search by 500ms
  searchTimeout = setTimeout(async () => {
    await searchFiles(query);
  }, 500);
}

async function searchFiles(query) {
  const searchSection = document.getElementById('searchResultsSection');
  const searchResults = document.getElementById('searchResults');
  const resourcesSection = document.getElementById('resources').parentElement;
  
  // Show search section, hide resources section
  searchSection.classList.remove('hidden');
  resourcesSection.classList.add('hidden');
  
  searchResults.innerHTML = '<div class="spinner"></div>';
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/files/search?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) throw new Error("Search failed");
    
    const data = await response.json();
    const files = data.items || [];
    
    renderSearchResults(files, query);
    
  } catch (error) {
    console.error('Search error:', error);
    searchResults.innerHTML = '<p class="text-red-500 text-center py-8">Search failed. Please try again.</p>';
  }
}

function renderSearchResults(files, query) {
  const container = document.getElementById('searchResults');
  
  if (!files || files.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 bg-white rounded-lg shadow-sm">
        <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-gray-500">No files found for "${query}"</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `<p class="text-sm text-gray-600 mb-4">Found ${files.length} result(s) for "${query}"</p>`;
  
  files.forEach(file => {
    const icon = getFileIcon(file.fileType);
    
    const card = document.createElement('article');
    card.className = 'resource-card bg-white p-4 sm:p-5 rounded-lg shadow-sm mb-4';
    
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row items-start gap-4">
        <div class="flex-shrink-0">
          ${icon}
        </div>
        
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-gray-800 text-lg mb-1">${file.fileName}</h3>
          
          <div class="flex items-center gap-3 mb-2 flex-wrap">
            <span class="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
              ${file.courseCode}
            </span>
            <span class="text-xs text-gray-500">
              by <strong>${file.uploadedByPublicId}</strong>
            </span>
          </div>
          
          ${file.description ? `<p class="text-sm text-gray-600 mb-3">${file.description}</p>` : ''}
          
          <div class="flex gap-2 flex-wrap">
            <button onclick="viewFile('${file.publicId}', '${file.fileName}')" 
                    class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm">
              View File
            </button>
            
            <button onclick="openReviews('${file.publicId}', '${file.fileName}')" 
                    class="px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition font-medium text-sm">
              Reviews
            </button>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}

function clearSearch() {
  const searchSection = document.getElementById('searchResultsSection');
  const resourcesSection = document.getElementById('resources').parentElement;
  
  searchSection.classList.add('hidden');
  resourcesSection.classList.remove('hidden');
  
  document.getElementById('searchInput').value = '';
}

/* ==================================================
    EDIT PROFILE MODAL
================================================== */
function openEditProfileModal() {
  editProfileModal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  // Reset form
  document.getElementById('editProfileForm').reset();
}

function closeEditProfileModal() {
  editProfileModal.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* ==================================================
    UPDATE PROFILE
================================================== */
async function updateProfile() {
  const username = document.getElementById('editUsername').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const password = document.getElementById('editPassword').value.trim();
  
  // Check if at least one field is filled
  if (!username && !email && !password) {
    showToast('Please fill in at least one field to update', 'error');
    return;
  }
  
  const publicId = localStorage.getItem("publicId");
  
  // Build update object with only filled fields
  const updateData = {};
  if (username) updateData.username = username;
  if (email) updateData.email = email;
  if (password) updateData.password = password;
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/users/${publicId}`, {
      method: 'PATCH',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      
      if (error.status === 404) {
        throw new Error('User not found');
      } else if (error.status === 409) {
        throw new Error('Email already in use');
      } else {
        throw new Error(error.error || 'Update failed');
      }
    }
    
    const updatedUser = await response.json();
    console.log('Profile updated:', updatedUser);
    
    showToast('Profile updated successfully!', 'success');
    closeEditProfileModal();
    
    // Refresh user details
    const user = await fetchUserDetails();
    updateUI(user);
    
  } catch (error) {
    console.error('Update profile error:', error);
    showToast(error.message || 'Failed to update profile', 'error');
  }
}

/* ==================================================
    DELETE ACCOUNT
================================================== */
function openDeleteAccountModal() {
  deleteAccountModal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  // Reset checkboxes
  document.getElementById('confirmDelete1').checked = false;
  document.getElementById('confirmDelete2').checked = false;
}

function closeDeleteAccountModal() {
  deleteAccountModal.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

async function confirmDeleteAccount() {
  const confirm1 = document.getElementById('confirmDelete1').checked;
  const confirm2 = document.getElementById('confirmDelete2').checked;
  
  if (!confirm1 || !confirm2) {
    showToast('Please confirm both checkboxes', 'error');
    return;
  }
  
  const publicId = localStorage.getItem("publicId");
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/users/${publicId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Access denied. Cannot delete account.');
      }
      throw new Error('Failed to delete account');
    }
    
    const result = await response.json();
    console.log('Account deleted:', result);
    
    showToast('Account deleted successfully. Goodbye!', 'success');
    
    // Clear all data and redirect
    localStorage.clear();
    
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);
    
  } catch (error) {
    console.error('Delete account error:', error);
    showToast(error.message || 'Failed to delete account', 'error');
  }
}

/* ==================================================
    OPEN MY FILES MODAL
================================================== */
async function openMyFilesModal(event) {
  if (event) event.preventDefault();
  
  myFilesModal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  // Reset pagination
  myFilesCurrentPage = 0;
  myFilesTotalPages = 0;
  
  document.getElementById('myFilesContent').innerHTML = '<div class="spinner"></div>';
  document.getElementById('myFilesLoadMore').classList.add('hidden');
  
  await loadMyFiles();
}

/* ==================================================
    CLOSE MY FILES MODAL
================================================== */
function closeMyFilesModal() {
  myFilesModal.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* ==================================================
    LOAD MY FILES
================================================== */
async function loadMyFiles() {
  try {
    const response = await apiFetch(`${API_BASE_URL}/files/me?page=${myFilesCurrentPage}&size=5`);
    
    if (!response.ok) throw new Error("Failed to fetch files");
    
    const data = await response.json();
    myFilesTotalPages = data.totalPages;
    
    renderMyFiles(data.items, data.totalElements, data.last);
    
  } catch (error) {
    console.error('My files fetch error:', error);
    document.getElementById('myFilesContent').innerHTML = 
      '<p class="text-red-500 text-center py-8">Failed to load your files.</p>';
  }
}

/* ==================================================
    RENDER MY FILES
================================================== */
function renderMyFiles(files, totalElements, isLast) {
  const container = document.getElementById('myFilesContent');
  const countElement = document.getElementById('myFilesCount');
  const loadMoreBtn = document.getElementById('myFilesLoadMore');
  
  // Update count
  countElement.textContent = `${totalElements} file${totalElements !== 1 ? 's' : ''} uploaded`;
  
  // If first page, clear container
  if (myFilesCurrentPage === 0) {
    container.innerHTML = '';
  }
  
  if (!files || files.length === 0) {
    if (myFilesCurrentPage === 0) {
      container.innerHTML = `
        <div class="text-center py-12">
          <svg class="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p class="text-gray-500 mb-4">You haven't uploaded any files yet.</p>
          <button onclick="closeMyFilesModal(); openUploadModal();" 
                  class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
            Upload Your First File
          </button>
        </div>
      `;
    }
    return;
  }
  
  files.forEach(file => {
    const icon = getFileIcon(file.fileType);
    const uploadDate = new Date(file.uploadedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    const fileSize = (file.Size / 1024).toFixed(2); // KB
    const fileSizeDisplay = fileSize > 1024 
      ? `${(fileSize / 1024).toFixed(2)} MB` 
      : `${fileSize} KB`;
    
    const card = document.createElement('article');
    card.className = 'resource-card bg-white p-4 sm:p-5 rounded-lg shadow-sm mb-4 border border-gray-200';
    
    card.innerHTML = `
      <div class="flex flex-col sm:flex-row items-start gap-4">
        <div class="flex-shrink-0">
          ${icon}
        </div>
        
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-gray-800 text-lg mb-2">${file.fileName}</h3>
          
          <div class="flex items-center gap-4 mb-2 flex-wrap text-sm">
            <span class="text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded">
              ${file.courseCode}
            </span>
            <span class="text-gray-500">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              ${uploadDate}
            </span>
            <span class="text-gray-500">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              </svg>
              ${fileSizeDisplay}
            </span>
          </div>
          
          ${file.description ? `
            <p class="text-sm text-gray-600 mb-3 line-clamp-2">${file.description}</p>
          ` : ''}
          
          <div class="flex gap-2 flex-wrap">
            <button onclick="viewFile('${file.publicId}', '${file.fileName}')" 
                    class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              View File
            </button>
            
            <button onclick="openReviews('${file.publicId}', '${file.fileName}')" 
                    class="px-4 py-2 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition font-medium text-sm">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
              </svg>
              Reviews
            </button>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
  
  // Show/hide load more button
  if (!isLast) {
    loadMoreBtn.classList.remove('hidden');
  } else {
    loadMoreBtn.classList.add('hidden');
  }
}

/* ==================================================
    LOAD MORE MY FILES
================================================== */
async function loadMoreMyFiles() {
  myFilesCurrentPage++;
  await loadMyFiles();
} 

/* ==================================================
    CATEGORY MANAGEMENT
================================================== */

// Hide dropdown when clicking outside
document.addEventListener('click', function(event) {
  const dropdown = document.getElementById('categoryDropdown');
  const input = document.getElementById('courseCategory');
  
  if (dropdown && input && !dropdown.contains(event.target) && event.target !== input) {
    dropdown.classList.add('hidden');
  }
});

// Show category dropdown
function showCategoryDropdown() {
  const dropdown = document.getElementById('categoryDropdown');
  dropdown.classList.remove('hidden');
  
  // If no categories loaded yet, fetch all
  if (allCategories.length === 0) {
    fetchAllCategories();
  }
}

// Search categories with debounce
function searchCategories(event) {
  const query = event.target.value.trim();
  
  clearTimeout(categorySearchTimeout);
  
  if (query.length === 0) {
    fetchAllCategories();
    return;
  }
  
  categorySearchTimeout = setTimeout(async () => {
    await fetchCategorySuggestions(query);
  }, 300);
}

// Fetch all categories
async function fetchAllCategories() {
  try {
    const response = await apiFetch(`${API_BASE_URL}/categories`);
    
    if (!response.ok) throw new Error("Failed to fetch categories");
    
    const categories = await response.json();
    allCategories = categories;
    renderCategoryList(categories);
    
  } catch (error) {
    console.error('Categories fetch error:', error);
    document.getElementById('categoryList').innerHTML = 
      '<p class="text-red-500 text-sm px-3 py-2">Failed to load categories</p>';
  }
}

// Fetch category suggestions based on search query
async function fetchCategorySuggestions(query) {
  try {
    const response = await apiFetch(`${API_BASE_URL}/categories/suggest-slug?name=${encodeURIComponent(query)}`);
    
    if (!response.ok) throw new Error("Failed to fetch suggestions");
    
    const data = await response.json();
    
    // Fetch full details for suggested slugs
    if (data.suggestions && data.suggestions.length > 0) {
      const fullCategories = await Promise.all(
        data.suggestions.map(slug => fetchCategoryBySlug(slug))
      );
      
      const validCategories = fullCategories.filter(cat => cat !== null);
      renderCategoryList(validCategories);
    } else {
      document.getElementById('categoryList').innerHTML = 
        '<p class="text-gray-500 text-sm px-3 py-2">No categories found</p>';
    }
    
  } catch (error) {
    console.error('Category suggestions fetch error:', error);
    document.getElementById('categoryList').innerHTML = 
      '<p class="text-red-500 text-sm px-3 py-2">Failed to fetch suggestions</p>';
  }
}

// Fetch category details by slug
async function fetchCategoryBySlug(slug) {
  try {
    const response = await apiFetch(`${API_BASE_URL}/categories`);
    
    if (!response.ok) return null;
    
    const categories = await response.json();
    return categories.find(cat => cat.slug === slug) || null;
    
  } catch (error) {
    console.error('Category fetch error:', error);
    return null;
  }
}

// Render category list in dropdown
function renderCategoryList(categories) {
  const listContainer = document.getElementById('categoryList');
  
  if (!categories || categories.length === 0) {
    listContainer.innerHTML = '<p class="text-gray-500 text-sm px-3 py-2">No categories found</p>';
    return;
  }
  
  listContainer.innerHTML = categories.map(category => `
    <button 
      type="button"
      onclick='selectCategory(${JSON.stringify(category)})'
      class="w-full px-3 py-2 text-left hover:bg-gray-100 transition">
      <div class="font-medium text-gray-900">${category.name}</div>
      <div class="text-xs text-gray-500">${category.slug}</div>
    </button>
  `).join('');
}

// Select a category
function selectCategory(category) {
  selectedCategorySlug = category.slug;
  
  // Update input field
  document.getElementById('courseCategory').value = category.name;
  
  // Hide dropdown
  document.getElementById('categoryDropdown').classList.add('hidden');
  
  // Show category details
  document.getElementById('selectedCategoryName').textContent = category.name;
  document.getElementById('selectedCategorySlug').textContent = `Slug: ${category.slug}`;
  document.getElementById('selectedCategoryDescription').textContent = category.description;
  document.getElementById('selectedCategoryDetails').classList.remove('hidden');
}

// Clear selected category
function clearSelectedCategory() {
  selectedCategorySlug = null;
  document.getElementById('courseCategory').value = '';
  document.getElementById('selectedCategoryDetails').classList.add('hidden');
  document.getElementById('courseCategory').focus();
}

/* ==================================================
    CREATE CATEGORY MODAL
================================================== */
const createCategoryModal = document.getElementById('createCategoryModal');

function openCreateCategoryModal() {
  // Close the category dropdown
  document.getElementById('categoryDropdown').classList.add('hidden');
  
  // Open create category modal
  createCategoryModal.classList.add('show');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeCreateCategoryModal() {
  createCategoryModal.classList.remove('show');
  overlay.classList.remove('show');
  document.body.style.overflow = '';
  
  // Reset form
  document.getElementById('createCategoryForm').reset();
}

// Handle create category form submission
document.getElementById('createCategoryForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const name = document.getElementById('categoryName').value.trim();
  const slug = document.getElementById('categorySlug').value.trim();
  const description = document.getElementById('categoryDescription').value.trim();
  
  if (!name || !slug || !description) {
    showToast('All fields are required', 'error');
    return;
  }
  
  try {
    const response = await apiFetch(`${API_BASE_URL}/categories`, {
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, slug, description })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create category');
    }
    
    const newCategory = await response.json();
    
    showToast('Category created successfully!', 'success');
    closeCreateCategoryModal();
    
    // Select the newly created category
    selectCategory(newCategory);
    
    // Refresh categories list
    allCategories = [];
    fetchAllCategories();
    
  } catch (error) {
    console.error('Create category error:', error);
    showToast(error.message || 'Failed to create category', 'error');
  }
});

/* ==================================================
    RUN ON PAGE LOAD
================================================== */
window.addEventListener("DOMContentLoaded", initDashboard);