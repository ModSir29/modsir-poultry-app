// Global State for current session
window.currentUser = null;
window.currentFarmId = null;
window.currentUserRole = null;

// Listen for auth state changes
auth.onAuthStateChanged(async (user) => {
    // Using Firebase email verification flow (no magic link)

    if (user) {
        // --- EMAIL & VERIFICATION CHECK ---
        const isGoogle = user.providerData && user.providerData.some(p => p.providerId === 'google.com');
        
        if (!isGoogle && !user.emailVerified) {
             // Show the email verification UI and do not sign the user out immediately.
             const signupForm = document.getElementById('signup-form');
             const verifyScreen = document.getElementById('verify-screen');
             const targetEmail = document.getElementById('verify-target-email');
             if (signupForm && verifyScreen && targetEmail) {
                 signupForm.style.display = 'none';
                 verifyScreen.style.display = 'block';
                 targetEmail.innerText = user.email || '';
             }
             showToast("Verification Required", "Please check your email and click the verification link to continue.", "info");
             return;
        }

        // User is logged in and verified
        window.currentUser = user;
        let userData = null;
        try {
            // Fetch user profile from Firestore to get their Farm ID and Role
            let userDoc = await db.collection('users').doc(user.uid).get();
            
            // If user is brand new (Metadata check), give Firestore a bit more time to index
            const isNewUser = (user.metadata && user.metadata.creationTime === user.metadata.lastSignInTime);
            if (isNewUser && !userDoc.exists) {
                await new Promise(r => setTimeout(r, 2000));
                userDoc = await db.collection('users').doc(user.uid).get();
            }

            // Fix Race Condition: If signing up, Auth triggers instantly before the profile DB write finishes.
            // We wait and retry a few times to give the DB time to save the profile.
            let retries = 5;
            while (!userDoc.exists && retries > 0) {
                await new Promise(r => setTimeout(r, 500)); // wait 500ms
                userDoc = await db.collection('users').doc(user.uid).get();
                retries--;
            }

            // Fetch User Role & Setup UI
            userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                userData = userDoc.data();
                window.currentUserRole = userData.role || 'worker';
                
                // Fetch all farms owned by this user
                const farmsSnapshot = await db.collection('farms').where('ownerId', '==', user.uid).get();
                
                // --- AUTO-RECOVERY: If farms were deleted, create a new one ---
                if (farmsSnapshot.empty && userData.role === 'admin') {
                    console.warn("No farms found for admin. Recovering...");
                    const newFarmId = 'farm_' + Math.random().toString(36).substr(2, 9);
                    const newFarmName = (userData.name || 'My') + "'s Recovery Farm";
                    
                    await db.collection('farms').doc(newFarmId).set({
                        name: newFarmName,
                        ownerId: user.uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    await db.collection('users').doc(user.uid).update({
                        activeFarmId: newFarmId,
                        farmId: newFarmId
                    });
                    
                    // Refresh snapshot
                    return window.location.reload(); 
                }

                const switcher = document.getElementById('farm-switcher');
                if (switcher) switcher.innerHTML = '';
                let firstFarmId = null;

                farmsSnapshot.forEach(doc => {
                    if (!firstFarmId) firstFarmId = doc.id;
                    let opt = document.createElement('option');
                    opt.value = doc.id;
                    opt.text = doc.data().name;
                    if (switcher) switcher.appendChild(opt);
                });

                // Set current farm to preferred or first found
                window.currentFarmId = (userData && (userData.activeFarmId || userData.farmId)) || firstFarmId;
                
                if (switcher && switcher.querySelector(`option[value="${window.currentFarmId}"]`)) {
                    switcher.value = window.currentFarmId;
                } else if (firstFarmId && switcher) {
                    window.currentFarmId = firstFarmId;
                    switcher.value = window.currentFarmId;
                }

                if (farmsSnapshot.empty && switcher) {
                    switcher.innerHTML = '<option value="">No Farms Found</option>';
                } else if (document.getElementById('dynamic-farm-switcher')) {
                    document.getElementById('dynamic-farm-switcher').style.display = 'flex';
                }

                await applyFarmConstraints();

                // Load Owner Profile data into settings
                if(typeof loadOwnerProfile === 'function') loadOwnerProfile(user.uid);

                // Show App, Hide Auth
                const authScreen = document.getElementById('auth-screen');
                const mainApp = document.getElementById('main-app');
                if (authScreen) authScreen.style.display = 'none';
                if (mainApp) mainApp.style.display = 'flex';

                // Role logic
                if (window.currentUserRole === 'worker') {
                    const financeNav = document.querySelector('.sidebar-nav [data-page="finance"]');
                    const plannerNav = document.querySelector('.sidebar-nav [data-page="planner"]');
                    const settingsNav = document.querySelector('.sidebar-nav [data-page="settings"]');
                    const profitCard = document.getElementById('detail-profit-card');
                    if (financeNav) financeNav.style.display = 'none';
                    if (plannerNav) plannerNav.style.display = 'none';
                    if (settingsNav) settingsNav.style.display = 'none';
                    if (profitCard) profitCard.style.display = 'none';
                }

                // Init Dashboard logic if present
                if (typeof initLogic === 'function') initLogic();
            } else {
                console.log("No user profile found. Allowing basic view.");
                const authScreen = document.getElementById('auth-screen');
                const mainApp = document.getElementById('main-app');
                if (authScreen) authScreen.style.display = 'none';
                if (mainApp) mainApp.style.display = 'flex';
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }

        // Update UI User Display
        const displayNameEl = document.getElementById('user-display-name');
        if (displayNameEl) displayNameEl.innerText = (userData && userData.name) ? userData.name : (user.displayName || "User");

        // Sync Sidebar Location from Firestore
        if (userData && userData.location) {
            const sideLoc = document.getElementById('sidebar-farm-location');
            if (sideLoc) sideLoc.innerText = `Location: ${userData.location}`;
            localStorage.setItem('modsir_farm_location', userData.location);
        }

        // Fetch Settings explicitly to update farm name
        if (typeof initSettings === 'function') initSettings();

        // Refresh dashboard stats now that we have a farmId
        if (typeof updateDashboardStats === 'function') {
            updateDashboardStats();
        }
    } else {
        // User is logged out
        window.currentUser = null;
        window.currentFarmId = null;
        window.currentUserRole = null;

        // Show Auth, Hide App
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

// Switch between Login and Signup forms
window.toggleAuth = function (mode) {
    if (mode === 'signup') {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
    } else {
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    }
}

// Handle Login
window.handleLogin = async function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged will handle the UI switch
    } catch (error) {
        alert("Login Failed: " + error.message);
    }
}

// Handle Signup (Creates User, Profile, and Farm)
window.handleSignup = async function (e) {
    e.preventDefault();
    const farmName = document.getElementById('signup-farm').value;
    const farmType = document.getElementById('signup-farm-type').value;
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        // 1. Create Firebase Auth User
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // For simplicity, the Farm ID will be the Owner's UID initially
        const farmId = user.uid;

        // 2. Create Global Farm Document
        await db.collection('farms').doc(farmId).set({
            name: farmName,
            type: farmType,
            ownerId: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3. Create user profile document in Firestore
        await db.collection('users').doc(user.uid).set({
            name: name || 'User',
            email: email,
            role: 'admin',
            activeFarmId: farmId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 4. Send Firebase email verification
        try {
            await user.sendEmailVerification();
        } catch (e) {
            console.error('Failed to send verification email:', e);
        }

        // 5. Update UI to show Check Email screen
        const signupForm = document.getElementById('signup-form');
        const verifyScreen = document.getElementById('verify-screen');
        const targetEmail = document.getElementById('verify-target-email');
        
        if (signupForm && verifyScreen && targetEmail) {
            signupForm.style.display = 'none';
            verifyScreen.style.display = 'block';
            targetEmail.innerText = email;
        }

        showToast("Verification Email Sent", "Please check your email and click the verification link.", "success");

    } catch (error) {
        showToast("Signup Failed", error.message, "error");
    }
}

window.applyFarmConstraints = async function() {
    let farmDoc = await db.collection('farms').doc(window.currentFarmId).get();
    if(farmDoc.exists) {
        window.currentFarmType = farmDoc.data().type || 'Mixed';
        localStorage.setItem('modsir_farm_name', farmDoc.data().name); // For PDF receipts
    } else {
        window.currentFarmType = 'Mixed';
    }

    // SMART BUSINESS LOGIC: FARM TYPE RESTRICTIONS
    if (window.currentFarmType === 'Broiler') {
        document.querySelector('.sidebar-nav [data-page="eggs"]').style.display = 'none';
        const eggBtn = document.getElementById('egg-action-btn');
        if(eggBtn) eggBtn.style.display = 'none';
        document.querySelector('.dashboard-tabs').style.display = 'none';
        if (typeof switchDashboardView === 'function') switchDashboardView('broiler');
    } else if (window.currentFarmType === 'Layer') {
        document.querySelector('.sidebar-nav [data-page="eggs"]').style.display = 'flex';
        document.querySelector('.dashboard-tabs').style.display = 'none';
        if (typeof switchDashboardView === 'function') switchDashboardView('layer');
    } else {
        document.querySelector('.sidebar-nav [data-page="eggs"]').style.display = 'flex';
        document.querySelector('.dashboard-tabs').style.display = 'flex';
        if (typeof switchDashboardView === 'function') switchDashboardView('overview');
    }
}

window.switchFarm = async function(farmId) {
    if(!farmId) return;
    window.currentFarmId = farmId;
    await db.collection('users').doc(window.currentUser.uid).update({ activeFarmId: farmId });
    await applyFarmConstraints();
    
    // Refresh application state
    if(typeof updateDashboardStats === 'function') updateDashboardStats();
    if(typeof closeAllModals === 'function') closeAllModals();
    
    const activePageUrl = Array.from(document.querySelectorAll('.sidebar-nav .nav-item')).find(n => n.classList.contains('active'));
    if(activePageUrl && window.renderPageTable) {
        const pageId = activePageUrl.getAttribute('data-page');
        if(pageId === 'dashboard') {}
        else if(pageId === 'finance') renderMoneyFlowDashboard();
        else if(pageId === 'operations') renderOperationsDashboard();
        else renderPageTable(pageId);
    }
}

window.createNewFarm = async function(e) {
    e.preventDefault();
    const fname = document.getElementById('new-farm-name').value;
    const ftype = document.getElementById('new-farm-type').value;
    try {
        const farmRef = await db.collection('farms').add({
            name: fname,
            type: ftype,
            ownerId: window.currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('New Farm created!');
        if(typeof closeModal === 'function') closeModal('new-farm-modal');
        
        const switcher = document.getElementById('farm-switcher');
        const opt = document.createElement('option');
        opt.value = farmRef.id;
        opt.text = fname;
        switcher.appendChild(opt);
        switcher.value = farmRef.id;
        switchFarm(farmRef.id);
        
        document.getElementById('dynamic-farm-switcher').style.display = 'flex';

    } catch(err) {
        alert("Error creating farm: " + err.message);
    }
}

// Handle Logout
window.handleLogout = async function () {
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

// Password UI Helpers
window.togglePasswordVisibility = function (inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        iconEl.classList.remove('fa-eye');
        iconEl.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        iconEl.classList.remove('fa-eye-slash');
        iconEl.classList.add('fa-eye');
    }
}

window.handleForgotPassword = async function () {
    const email = document.getElementById('login-email').value;
    if (!email) {
        alert("Please enter your email address in the field above first.");
        return;
    }
    try {
        await auth.sendPasswordResetEmail(email);
        alert("Password reset email sent! Check your inbox to create a new password.");
    } catch (error) {
        alert("Error resetting password: " + error.message);
    }
}

window.handleResendVerification = async function() {
    try {
        // Try the current user object first
        if (window.currentUser && typeof window.currentUser.sendEmailVerification === 'function') {
            await window.currentUser.sendEmailVerification();
            showToast("Sent", "A new verification email has been sent. Check your inbox.", "success");
            return;
        }
        // Fallback: use email from login field
        const email = document.getElementById('login-email') ? document.getElementById('login-email').value : null;
        if (!email) return showToast("Required", "Enter your email in the login field first.", "info");
        showToast("Info", "Please log in first, then request a resend from the verification screen.", "info");
    } catch (e) {
        showToast("Error", e.message || "Failed to resend verification.", "error");
    }
}

/* --- GOOGLE LOGIN --- */
window.handleGoogleLogin = async function() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // If first time, create profile
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            const farmId = 'farm_' + Math.random().toString(36).substr(2, 9);
            const farmName = (user.displayName || 'My') + "'s Farm";

            await db.collection('farms').doc(farmId).set({
                name: farmName,
                ownerId: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await db.collection('users').doc(user.uid).set({
                name: user.displayName || 'User',
                email: user.email,
                role: 'admin',
                activeFarmId: farmId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            localStorage.setItem('modsir_farm_name', farmName);
        }
        showToast("Success", "Welcome back!", "success");
    } catch (error) {
        showToast("Google Auth Error", error.message, "error");
    }
}

// Email verification helpers removed magic-link logic; using Firebase email verification instead.

window.checkVerificationStatus = function() {
    showToast("Checking...", "Verification status updates automatically when you click the link in your email.", "info");
    // Reload state to let Firebase detect verification
    setTimeout(() => window.location.reload(), 2000);
}

window.handleResendOTP = async function() {
    // Attempt to resend the Firebase email verification to the current user
    try {
        if (window.currentUser && typeof window.currentUser.sendEmailVerification === 'function') {
            await window.currentUser.sendEmailVerification();
            showToast("Sent", "Verification email resent. Check your inbox.", "success");
            return;
        }

        // Fallback: try to read the email shown on the verify screen and prompt the user to login
        const email = document.getElementById('verify-target-email') ? document.getElementById('verify-target-email').innerText : null;
        if (email) {
            showToast("Info", "Please login with the same email to resend verification.", "info");
            return;
        }

        showToast("Error", "Unable to resend verification. Please login and try again.", "error");
    } catch (e) {
        showToast("Error", e.message || 'Failed to resend verification.', "error");
    }
}

// --- PHONE OTP (SMS) VERIFICATION FLOW ---
window.sendPhoneOTP = async function() {
    const phone = document.getElementById('verify-phone').value;
    if (!phone || phone.trim() === '') return showToast('Required', 'Enter phone number including country code.', 'info');

    try {
        // Render/invisible reCAPTCHA if not already
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                'size': 'invisible'
            });
            window.recaptchaVerifier.render().catch(e => console.warn('reCAPTCHA render error', e));
        }

        const appVerifier = window.recaptchaVerifier;
        const confirmationResult = await auth.signInWithPhoneNumber(phone, appVerifier);
        // Store confirmationResult globally for later confirm
        window._phoneConfirmation = confirmationResult;
        document.getElementById('sms-otp-section').style.display = 'block';
        showToast('Sent', 'OTP sent to ' + phone, 'success');
    } catch (e) {
        console.error('sendPhoneOTP error', e);
        showToast('Error', e.message || 'Failed to send OTP', 'error');
    }
}

window.confirmPhoneOTP = async function() {
    const code = document.getElementById('verify-otp-code').value;
    if (!code || !window._phoneConfirmation) return showToast('Required', 'Enter OTP sent to your phone.', 'info');

    try {
        // Confirm the code which returns a userCredential
        const phoneCredentialUser = await window._phoneConfirmation.confirm(code);

        // phoneCredentialUser is a UserCredential; now link the phone credential to currentUser if possible
        if (window.currentUser && window.currentUser.uid && phoneCredentialUser.user) {
            // Create Phone credential from verificationId and code to link
            const verificationId = window._phoneConfirmation.verificationId || (phoneCredentialUser.verificationId);
            let phoneCred = null;
            if (verificationId) {
                phoneCred = firebase.auth.PhoneAuthProvider.credential(verificationId, code);
            }

            if (phoneCred && typeof window.currentUser.linkWithCredential === 'function') {
                try {
                    await window.currentUser.linkWithCredential(phoneCred);
                } catch (linkErr) {
                    // If linking fails because credential already used, proceed
                    console.warn('linkWithCredential failed:', linkErr);
                }
            }

            // Mark phone verified in Firestore user doc
            try {
                await db.collection('users').doc(window.currentUser.uid).update({ phone: document.getElementById('verify-phone').value, phoneVerified: true });
            } catch (e) { console.warn('Could not update user phoneVerified:', e); }

            showToast('Verified', 'Phone verified successfully. You can now use your account.', 'success');
            // Hide verify UI
            const verifyScreen = document.getElementById('verify-screen');
            if (verifyScreen) verifyScreen.style.display = 'none';
            if (typeof updateDashboardStats === 'function') updateDashboardStats();
        }
    } catch (e) {
        console.error('confirmPhoneOTP error', e);
        showToast('Error', e.message || 'Invalid OTP', 'error');
    }
}

// Secondary App for Worker Creation (Avoids logging Admin out)
let secondaryAuth = null;
try {
    const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
    secondaryAuth = secondaryApp.auth();
} catch (e) {
    console.error("Secondary app init failed", e);
}

window.handleWorkerAdd = async function (e) {
    e.preventDefault();
    if (!secondaryAuth) return alert("Worker management not initialized properly.");
    if (window.currentUserRole !== 'admin') return alert("Only Admins can add workers.");

    const email = document.getElementById('new-worker-email').value;
    const password = "password123"; // default temp password

    // Add loading state
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
    btn.disabled = true;

    try {
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        const newUid = userCredential.user.uid;

        await db.collection('users').doc(newUid).set({
            name: 'Farm Worker',
            email: email,
            role: 'worker',
            farmId: window.currentFarmId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await secondaryAuth.signOut(); // Clean up session on secondary app

        alert(`Worker added!\nEmail: ${email}\nPassword: ${password}\nThey can change this password later via "Forgot Password".`);
        e.target.reset();
        loadWorkers(); // Refresh list
    } catch (err) {
        alert("Error adding worker: " + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

window.loadWorkers = async function () {
    if (window.currentUserRole !== 'admin') return;
    document.getElementById('worker-management-section').style.display = 'block';

    const listEl = document.getElementById('worker-list');
    listEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Loading workers...</p>';

    try {
        const snapshot = await db.collection('users')
            .where('farmId', '==', window.currentFarmId)
            .where('role', '==', 'worker')
            .get();

        if (snapshot.empty) {
            listEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Nobody here but us chickens. Add a worker below.</p>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-panel); padding:10px 15px; border-radius:8px; border:1px solid var(--bg-panel-border);">
                    <div>
                        <strong style="color:var(--text-main);">${data.email}</strong><br>
                        <span style="color:var(--text-muted); font-size:0.85rem;"><i class="fa-solid fa-clipboard-user"></i> Role: Worker</span>
                    </div>
                </div>
            `;
        });
        listEl.innerHTML = html;

    } catch (e) {
        listEl.innerHTML = '<p class="text-danger">Failed to load workers.</p>';
        console.error(e);
    }
}
