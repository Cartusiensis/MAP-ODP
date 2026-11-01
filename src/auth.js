/* ============================
   AUTHENTICATION (OTP Flow)
============================ */
import { db } from './supabase.js';
import { showToast } from './utils.js';
import { fetchSupabaseData } from './sites.js';
import { fetchPolesFromCloud, getValidPoleUrls } from './poles.js';

const SESSION_MAX_MS = 24 * 60 * 60 * 1000;

let authStep = 'email'; // Tracks whether we are sending email or verifying code

export async function handleAuthFlow(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const btn = document.getElementById('auth-submit-btn');
    const errorEl = document.getElementById('auth-error');

    errorEl.classList.add('hidden');

    if (authStep === 'email') {
        // --- STEP 1: SEND OTP ---
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending Code...';

        const { error } = await db.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: false // Only pre-registered users may log in
            }
        });

        if (error) {
            btn.innerHTML = '<span>Send Login Code</span>';
            errorEl.innerText = error.message;
            errorEl.classList.remove('hidden');
        } else {
            // Success! Show OTP field
            authStep = 'otp';
            document.getElementById('email-step').classList.add('hidden');
            document.getElementById('otp-step').classList.remove('hidden');

            // Make email input readonly just in case we show it again later
            document.getElementById('auth-email').readOnly = true;

            btn.innerHTML = '<span>Verify & Login</span>';
            showToast('Code sent! Check your email.', 'success');
        }

    } else if (authStep === 'otp') {
        // --- STEP 2: VERIFY OTP ---
        const token = document.getElementById('auth-otp').value.trim();
        if (!token) return;

        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...';

        const { error } = await db.auth.verifyOtp({
            email: email,
            token: token,
            type: 'email'
        });

        if (error) {
            btn.innerHTML = '<span>Verify & Login</span>';
            errorEl.innerText = "Invalid or expired code. Try again.";
            errorEl.classList.remove('hidden');
        } else {
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Success';
            unlockApp();
        }
    }
}

export async function handleLogout() {
    await db.auth.signOut();
    // Reload the page to reset all map states and show login again
    window.location.reload();
}

function unlockApp() {
    // Hide the login screen
    const overlay = document.getElementById('auth-overlay');
    overlay.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => overlay.classList.add('hidden'), 300);

    // Fetch the data ONLY after successful login
    fetchSupabaseData();

    if (getValidPoleUrls().length > 0) {
        fetchPolesFromCloud();
    }
}

export function checkSessionAge(session) {
    if (!session || !session.user || !session.user.last_sign_in_at) {
        handleLogout();
        return;
    }

    // Time since they logged in via OTP
    const loginTime = new Date(session.user.last_sign_in_at).getTime();
    const elapsed = Date.now() - loginTime;

    if (elapsed >= SESSION_MAX_MS) {
        handleLogout();
    } else {
        unlockApp();

        // Kick them out exactly when the 24 hours is up
        // (in case they leave the map tab open in the background all day)
        setTimeout(() => {
            handleLogout();
        }, SESSION_MAX_MS - elapsed);
    }
}

export async function restoreSession() {
    const { data: { session } } = await db.auth.getSession();
    if (session) checkSessionAge(session);
}
