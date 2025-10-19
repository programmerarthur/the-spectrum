// script.js
(function() {
    "use strict";

    /**
     * ---
     * SUPABASE CLIENT
     * ---
     * Replace with your own Supabase project URL and Anon Key.
     */
    const SUPABASE_URL = 'https://eidagqlezomywsjvdqvu.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpZGFncWxlem9teXdzanZkcXZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MjAxMTQsImV4cCI6MjA3NTk5NjExNH0.r4XLwZeSjWqM-CBFD7IT0-uQpzUVt72s2rHnmxSBlNA';

    let supabase;
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.error("Supabase client failed to initialize.", e);
        alert("Error: Could not connect to the backend. Please check your Supabase credentials.");
    }

    /**
     * ---
     * APPLICATION STATE
     * ---
     * A central object to hold our application's state.
     */
    const App = {
        state: {
            user: null, // Holds the Supabase user object
            session: null, // Holds the Supabase session
            quizResults: null, // Holds results from the last quiz
            ideology: null, // Holds matched ideology
            loading: false, // Global loading state
        },

        // --- 1. INITIALIZATION ---
        init() {
            if (!supabase) return; // Don't run if Supabase failed

            // Initialize Feather Icons
            feather.replace();

            // Setup global event listeners
            this.listeners.setupGlobalListeners();

            // Handle Auth State Changes (Login/Logout)
            supabase.auth.onAuthStateChange((event, session) => {
                App.state.user = session?.user || null;
                App.state.session = session || null;
                App.ui.updateNavUI(); // Update nav based on auth state
                App.router.handleRouteChange(); // Re-route to handle auth-only pages
            });

            // Handle Password Reset Flow
            // This checks if the user landed from a password reset link
            App.auth.handlePasswordResetToken();

            // Initial Route
            this.router.handleRouteChange();
        },

        // --- 2. ROUTER ---
        router: {
            routes: {
                '/': 'home',
                '/quiz': 'quiz',
                '/results': 'results',
                '/profile': 'profile',
                '/settings': 'settings',
                '/community': 'community',
                '/how-it-works': 'howItWorks',
            },

            async handleRouteChange() {
                const hash = window.location.hash.replace('#', '') || '/';
                const [path, param] = hash.split('/'); // e.g., /profile/uuid
                
                const routeHandler = App.router.routes[path];
                const main = document.getElementById('app');

                if (!main) return;

                // Handle protected routes
                const requiresAuth = ['/profile', '/settings', '/quiz']; // Quiz requires auth to save results
                if (requiresAuth.includes(path) && !App.state.user) {
                    window.location.hash = '/';
                    App.ui.showToast('You must be logged in to view that page.', 'info');
                    return;
                }

                // Handle results page logic
                if (path === '/results' && !App.state.quizResults) {
                     window.location.hash = '/quiz';
                     App.ui.showToast('You must complete a quiz to see results.', 'info');
                     return;
                }

                // Render page content
                App.ui.showPageLoader();
                try {
                    switch (routeHandler) {
                        case 'home':
                            main.innerHTML = App.views.HomePage();
                            break;
                        case 'quiz':
                            main.innerHTML = App.views.QuizPage();
                            App.quiz.start();
                            break;
                        case 'results':
                            main.innerHTML = App.views.ResultsPage();
                            App.quiz.renderResults();
                            break;
                        case 'profile':
                            main.innerHTML = await App.views.ProfilePage(param);
                            break;
                        case 'settings':
                            main.innerHTML = App.views.SettingsPage();
                            App.listeners.setupSettingsListeners(); // Attach listeners for this page
                            break;
                        case 'community':
                            main.innerHTML = App.views.CommunityPage();
                            break;
                        case 'howItWorks':
                            main.innerHTML = App.views.HowItWorksPage();
                            break;
                        default:
                            main.innerHTML = App.views.NotFoundPage();
                    }
                } catch (error) {
                    console.error("Error rendering page:", error);
                    main.innerHTML = App.views.ErrorPage(error.message);
                }

                App.ui.hidePageLoader();
                App.ui.updateActiveNavLinks();
                feather.replace(); // Re-run Feather Icons after new content is added
            }
        },

        // --- 3. EVENT LISTENERS ---
        listeners: {
            setupGlobalListeners() {
                const body = document.body;

                // Theme Toggle
                body.addEventListener('click', e => {
                    const toggle = e.target.closest('#theme-toggle');
                    if (toggle) App.ui.toggleTheme();
                });

                // Nav & Modals
                body.addEventListener('click', e => {
                    // Modal Triggers
                    const modalTrigger = e.target.closest('[data-modal-trigger]');
                    if (modalTrigger) {
                        e.preventDefault();
                        const modalId = modalTrigger.dataset.modalTrigger;
                        App.ui.showModal(modalId);
                    }

                    // Modal Close
                    const modalClose = e.target.closest('.modal-close');
                    if (modalClose) {
                        e.preventDefault();
                        App.ui.hideModal();
                    }
                    
                    // User Menu Dropdown
                    const userMenuBtn = e.target.closest('#user-menu-button');
                    if(userMenuBtn) {
                        document.getElementById('user-menu-dropdown').classList.toggle('hidden');
                    } else if (!e.target.closest('#user-menu-dropdown')) {
                        document.getElementById('user-menu-dropdown').classList.add('hidden');
                    }
                    
                    // Logout Button
                    const logoutBtn = e.target.closest('#logout-button');
                    if (logoutBtn) App.auth.logout();

                    // Mobile Menu
                    const mobileMenuBtn = e.target.closest('#mobile-menu-btn');
                    if(mobileMenuBtn) {
                        document.getElementById('mobile-menu').classList.toggle('hidden');
                    }

                    // Close mobile menu when a link is clicked
                    const navLink = e.target.closest('[data-nav-link]');
                    if (navLink) {
                        document.getElementById('mobile-menu').classList.add('hidden');
                        document.getElementById('user-menu-dropdown').classList.add('hidden');
                    }
                });
                
                // Close modal on backdrop click
                document.getElementById('modal-backdrop').addEventListener('click', () => App.ui.hideModal());

                // Auth Form Submissions (Event Delegation)
                body.addEventListener('submit', async e => {
                    const form = e.target;
                    
                    if (form.id === 'login-form') {
                        e.preventDefault();
                        const email = form.email.value;
                        const password = form.password.value;
                        App.auth.login(email, password, form.querySelector('button[type="submit"]'));
                    }
                    
                    if (form.id === 'signup-form') {
                        e.preventDefault();
                        const email = form.email.value;
                        const username = form.username.value;
                        const password = form.password.value;
                        App.auth.signup(email, username, password, form.querySelector('button[type="submit"]'));
                    }

                    if (form.id === 'forgot-password-form') {
                        e.preventDefault();
                        const email = form.email.value;
                        App.auth.sendPasswordResetEmail(email, form.querySelector('button[type="submit"]'));
                    }

                    if (form.id === 'reset-password-form') {
                        e.preventDefault();
                        const password = form.password.value;
                        App.auth.updatePassword(password, form.querySelector('button[type="submit"]'));
                    }
                });

                // Listen for hash changes (browser back/forward)
                window.addEventListener('hashchange', () => App.router.handleRouteChange());
            },

            setupSettingsListeners() {
                // This is a page-specific listener
                const adsToggle = document.getElementById('ads-toggle');
                if (adsToggle) {
                    adsToggle.addEventListener('change', (e) => {
                        const enabled = e.target.checked;
                        document.body.classList.toggle('ads-enabled', enabled);
                        localStorage.setItem('adsEnabled', enabled);
                        App.ui.showToast(`Ads ${enabled ? 'enabled' : 'disabled'}.`, 'info');
                    });
                }
            }
        },

        // --- 4. AUTHENTICATION (SUPABASE) ---
        auth: {
            async signup(email, username, password, btn) {
                App.ui.setButtonLoading(btn, true);
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username: username, // Add username to user_meta_data
                        }
                    }
                });

                if (error) {
                    App.ui.showToast(error.message, 'error');
                } else {
                    App.ui.hideModal();
                    App.ui.showToast('Signup successful! Please check your email to confirm.', 'success');
                }
                App.ui.setButtonLoading(btn, false);
            },

            async login(email, password, btn) {
                App.ui.setButtonLoading(btn, true);
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

                if (error) {
                    App.ui.showToast(error.message, 'error');
                } else {
                    App.ui.hideModal();
                    App.ui.showToast('Logged in successfully!', 'success');
                }
                App.ui.setButtonLoading(btn, false);
            },

            async logout() {
                await supabase.auth.signOut();
                App.state.quizResults = null;
                App.state.ideology = null;
                window.location.hash = '/';
                App.ui.showToast('Logged out.', 'info');
            },

            async sendPasswordResetEmail(email, btn) {
                App.ui.setButtonLoading(btn, true);
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin, // Supabase will append the token
                });
                
                if (error) {
                    App.ui.showToast(error.message, 'error');
                } else {
                    App.ui.hideModal();
                    App.ui.showToast('Password reset email sent. Check your inbox.', 'success');
                }
                App.ui.setButtonLoading(btn, false);
            },

            handlePasswordResetToken() {
                // This runs on page load. If a reset token is found,
                // it logs the user in and shows the update password modal.
                supabase.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'PASSWORD_RECOVERY') {
                        App.ui.showModal('resetPassword');
                    }
                });
            },

            async updatePassword(password, btn) {
                App.ui.setButtonLoading(btn, true);
                const { error } = await supabase.auth.updateUser({ password });

                if (error) {
                    App.ui.showToast(error.message, 'error');
                } else {
                    App.ui.hideModal();
                    App.ui.showToast('Password updated successfully!', 'success');
                }
                App.ui.setButtonLoading(btn, false);
            }
        },

        // --- 5. QUIZ LOGIC ---
        quiz: {
            currentQuestion: 0,
            scores: { econ: 0, dipl: 0, govt: 0, scty: 0 },
            questions: [], // Will be populated from `getQuestions()`

            start() {
                this.currentQuestion = 0;
                this.scores = { econ: 0, dipl: 0, govt: 0, scty: 0 };
                this.questions = this.getQuestions();
                this.renderQuestion();
            },

            renderQuestion() {
                const q = this.questions[this.currentQuestion];
                const container = document.getElementById('quiz-container');
                if (!container) return;

                const progress = ((this.currentQuestion + 1) / this.questions.length) * 100;

                container.innerHTML = `
                    <div class="quiz-question-card animate-fade-in-up">
                        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
                            <div class="bg-indigo-500 h-2.5 rounded-full" style="width: ${progress}%"></div>
                        </div>
                        <h2 class="text-xl md:text-2xl font-bold mb-6 text-center">
                            Question ${this.currentQuestion + 1} of ${this.questions.length}
                        </h2>
                        <p class="text-lg md:text-xl text-center min-h-[6rem]">
                            ${q.question}
                        </p>
                        
                        <div class="quiz-option-group">
                            <button class="quiz-option-btn" data-effect='${JSON.stringify(q.effects.strg_agree)}'>Strongly Agree</button>
                            <button class="quiz-option-btn" data-effect='${JSON.stringify(q.effects.agree)}'>Agree</button>
                            <button class="quiz-option-btn" data-effect='${JSON.stringify(q.effects.neutral)}'>Neutral</button>
                            <button class="quiz-option-btn" data-effect='${JSON.stringify(q.effects.disagree)}'>Disagree</button>
                            <button class="quiz-option-btn" data-effect='${JSON.stringify(q.effects.strg_disagree)}'>Strongly Disagree</button>
                        </div>
                        
                        <div class="flex justify-between mt-8">
                            <button id="quiz-prev" class="btn btn-outline" ${this.currentQuestion === 0 ? 'disabled' : ''}>Previous</button>
                            <button id="quiz-next" class="btn btn-primary" disabled>Next</button>
                        </div>
                    </div>
                `;

                // Add listeners for the new buttons
                document.getElementById('quiz-prev').addEventListener('click', () => this.prevQuestion());
                document.getElementById('quiz-next').addEventListener('click', () => this.nextQuestion());
                
                container.querySelectorAll('.quiz-option-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        // Store effect and highlight button
                        const effect = JSON.parse(e.currentTarget.dataset.effect);
                        this.questions[this.currentQuestion].answer = effect;

                        // Update selection visual
                        container.querySelectorAll('.quiz-option-btn').forEach(b => b.classList.remove('selected'));
                        e.currentTarget.classList.add('selected');
                        
                        // Enable Next
                        document.getElementById('quiz-next').disabled = false;
                    });
                });
            },

            nextQuestion() {
                if (this.currentQuestion < this.questions.length - 1) {
                    this.currentQuestion++;
                    this.renderQuestion();
                } else {
                    this.finishQuiz();
                }
            },

            prevQuestion() {
                if (this.currentQuestion > 0) {
                    this.currentQuestion--;
                    this.renderQuestion();
                }
            },

            async finishQuiz() {
                // Calculate final scores
                let finalScores = { econ: 50, dipl: 50, govt: 50, scty: 50 };
                let maxScores = { econ: 0, dipl: 0, govt: 0, scty: 0 };
                const questions = this.getQuestions(); // Get max values from source

                for (const q of questions) {
                    maxScores.econ += Math.abs(q.effects.strg_agree.econ);
                    maxScores.dipl += Math.abs(q.effects.strg_agree.dipl);
                    maxScores.govt += Math.abs(q.effects.strg_agree.govt);
                    maxScores.scty += Math.abs(q.effects.strg_agree.scty);
                }

                for (const q of this.questions) {
                    if (q.answer) {
                        finalScores.econ += q.answer.econ;
                        finalScores.dipl += q.answer.dipl;
                        finalScores.govt += q.answer.govt;
                        finalScores.scty += q.answer.scty;
                    }
                }

                // Normalize to 0-100 scale
                App.state.quizResults = {
                    econ: (finalScores.econ / maxScores.econ) * 100,
                    dipl: (finalScores.dipl / maxScores.dipl) * 100,
                    govt: (finalScores.govt / maxScores.govt) * 100,
                    scty: (finalScores.scty / maxScores.scty) * 100,
                };
                
                // Clamp values between 0 and 100
                for(let key in App.state.quizResults) {
                    App.state.quizResults[key] = Math.max(0, Math.min(100, App.state.quizResults[key]));
                }
                
                // Match ideology
                App.state.ideology = this.matchIdeology(App.state.quizResults);

                // Save to Supabase
                try {
                    const { error } = await supabase
                        .from('quiz_results')
                        .insert({ 
                            user_id: App.state.user.id, 
                            scores: App.state.quizResults,
                            ideology: App.state.ideology.name,
                            xp_gained: 100 // TODO: Tie to gamification system
                        });
                    if (error) throw error;
                    
                    // Also update the 'latest_ideology' on the user's profile
                    await supabase
                        .from('profiles')
                        .update({ latest_ideology: App.state.ideology.name })
                        .eq('id', App.state.user.id);
                    
                    App.ui.showToast('Quiz results saved!', 'success');
                } catch (error) {
                    console.error("Error saving quiz results:", error);
                    App.ui.showToast(`Error saving results: ${error.message}`, 'error');
                }

                // Redirect to results page
                window.location.hash = '/results';
            },

            renderResults() {
                const { econ, dipl, govt, scty } = App.state.quizResults;
                const ideology = App.state.ideology;

                // Set up axis labels
                const econLabel = econ > 60 ? "Markets" : (econ < 40 ? "Equality" : "Balanced");
                const diplLabel = dipl > 60 ? "Nation" : (dipl < 40 ? "World" : "Balanced");
                const govtLabel = govt > 60 ? "Authority" : (govt < 40 ? "Liberty" : "Balanced");
                const sctyLabel = scty > 60 ? "Tradition" : (scty < 40 ? "Progress" : "Balanced");

                // Render Radar Chart
                // We need to wait a tick for the canvas to be in the DOM
                setTimeout(() => {
                    const ctx = document.getElementById('results-chart');
                    if(!ctx) return;
                    
                    new Chart(ctx.getContext('2d'), {
                        type: 'radar',
                        data: {
                            labels: ['Economic (Equality-Markets)', 'Diplomatic (World-Nation)', 'Civil (Liberty-Authority)', 'Societal (Progress-Tradition)'],
                            datasets: [{
                                label: 'Your Results',
                                data: [econ, dipl, govt, scty],
                                fill: true,
                                backgroundColor: 'rgba(129, 140, 248, 0.2)',
                                borderColor: 'rgb(129, 140, 248)',
                                pointBackgroundColor: 'rgb(129, 140, 248)',
                                pointBorderColor: '#fff',
                                pointHoverBackgroundColor: '#fff',
                                pointHoverBorderColor: 'rgb(129, 140, 248)'
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                r: {
                                    angleLines: { color: 'rgba(255, 255, 255, 0.2)' },
                                    grid: { color: 'rgba(255, 255, 255, 0.2)' },
                                    pointLabels: { 
                                        color: '#f9fafb',
                                        font: { size: 12 }
                                    },
                                    ticks: {
                                        backdropColor: 'transparent',
                                        color: '#f9fafb',
                                        stepSize: 20
                                    },
                                    min: 0,
                                    max: 100
                                }
                            },
                            plugins: {
                                legend: {
                                    labels: { color: '#f9fafb' }
                                }
                            }
                        }
                    });
                }, 100);

                // Render Progress Bars
                document.getElementById('econ-bar').style.width = `${econ}%`;
                document.getElementById('dipl-bar').style.width = `${dipl}%`;
                document.getElementById('govt-bar').style.width = `${govt}%`;
                document.getElementById('scty-bar').style.width = `${scty}%`;

                document.getElementById('econ-label').textContent = econLabel;
                document.getElementById('dipl-label').textContent = diplLabel;
                document.getElementById('govt-label').textContent = govtLabel;
                document.getElementById('scty-label').textContent = sctyLabel;

                document.getElementById('econ-val').textContent = `${econ.toFixed(1)}%`;
                document.getElementById('dipl-val').textContent = `${dipl.toFixed(1)}%`;
                document.getElementById('govt-val').textContent = `${govt.toFixed(1)}%`;
                document.getElementById('scty-val').textContent = `${scty.toFixed(1)}%`;

                // Render Ideology
                document.getElementById('ideology-name').textContent = ideology.name;
                document.getElementById('ideology-desc').textContent = ideology.desc;
            },

            // Simplified ideology matching
            matchIdeology(scores) {
                const ideologies = this.getIdeologies();
                let closestMatch = null;
                let minDistance = Infinity;

                for (const ideology of ideologies) {
                    let distance = 0;
                    distance += Math.pow(scores.econ - ideology.scores.econ, 2);
                    distance += Math.pow(scores.dipl - ideology.scores.dipl, 2);
                    distance += Math.pow(scores.govt - ideology.scores.govt, 2);
                    distance += Math.pow(scores.scty - ideology.scores.scty, 2);
                    distance = Math.sqrt(distance);

                    if (distance < minDistance) {
                        minDistance = distance;
                        closestMatch = ideology;
                    }
                }
                return closestMatch;
            },

            // --- QUIZ DATA ---
            // In a real app, this would be fetched from the DB
            getQuestions() {
                // Effects: 10 = Strong, 5 = Regular, 0 = Neutral
                return [
                    // --- ECONOMIC ---
                    {
                        question: "Oppression by corporations is a bigger concern than oppression by governments.",
                        effects: {
                            strg_agree: { econ: -10, dipl: 0, govt: 0, scty: 0 },
                            agree:      { econ: -5, dipl: 0, govt: 0, scty: 0 },
                            neutral:    { econ: 0, dipl: 0, govt: 0, scty: 0 },
                            disagree:   { econ: 5, dipl: 0, govt: 0, scty: 0 },
                            strg_disagree:{ econ: 10, dipl: 0, govt: 0, scty: 0 },
                        }
                    },
                    {
                        question: "It is necessary for the government to intervene in the economy to protect consumers.",
                        effects: {
                            strg_agree: { econ: -10, dipl: 0, govt: 0, scty: 0 },
                            agree:      { econ: -5, dipl: 0, govt: 0, scty: 0 },
                            neutral:    { econ: 0, dipl: 0, govt: 0, scty: 0 },
                            disagree:   { econ: 5, dipl: 0, govt: 0, scty: 0 },
                            strg_disagree:{ econ: 10, dipl: 0, govt: 0, scty: 0 },
                        }
                    },
                    // ... (Add ~13 more economic questions)

                    // --- DIPLOMATIC ---
                    {
                        question: "My nation's values should be spread as widely as possible.",
                        effects: {
                            strg_agree: { econ: 0, dipl: 10, govt: 0, scty: 0 },
                            agree:      { econ: 0, dipl: 5, govt: 0, scty: 0 },
                            neutral:    { econ: 0, dipl: 0, govt: 0, scty: 0 },
                            disagree:   { econ: 0, dipl: -5, govt: 0, scty: 0 },
                            strg_disagree:{ econ: 0, dipl: -10, govt: 0, scty: 0 },
                        }
                    },
                    {
                        question: "International aid is a waste of money.",
                        effects: {
                            strg_agree: { econ: 0, dipl: 10, govt: 0, scty: 0 },
                            agree:      { econ: 0, dipl: 5, govt: 0, scty: 0 },
                            neutral:    { econ: 0, dipl: 0, govt: 0, scty: 0 },
                            disagree:   { econ: 0, dipl: -5, govt: 0, scty: 0 },
                            strg_disagree:{ econ: 0, dipl: -10, govt: 0, scty: 0 },
                        }
                    },
                    // ... (Add ~13 more diplomatic questions)

                    // --- CIVIL / GOVERNMENT ---
                    {
                        question: "The sacrifice of some civil liberties is necessary to protect us from acts of terrorism.",
                        effects: {
                            strg_agree: { econ: 0, dipl: 0, govt: 10, scty: 0 },
                            agree:      { econ: 0, dipl: 0, govt: 5, scty: 0 },
                            neutral:    { econ: 0, dipl: 0, govt: 0, scty: 0 },
                            disagree:   { econ: 0, dipl: 0, govt: -5, scty: 0 },
                            strg_disagree:{ econ: 0, dipl: 0, govt: -10, scty: 0 },
                        }
                    },
                    {
                        question: "Mass surveillance is an unacceptable infringement on personal freedom.",
                        effects: {
                            strg_agree: { econ: 0, dipl: 0, govt: -10, scty: 0 },
                            agree:      { econ: 0, dipl: 0, govt: -5, scty: 0 },
                            neutral:    { econ: 0, dipl: 0, govt: 0, scty: 0 },
                            disagree:   { econ: 0, dipl: 0, govt: 5, scty: 0 },
                            strg_disagree:{ econ: 0, dipl: 0, govt: 10, scty: 0 },
                        }
                    },
                    // ... (Add ~13 more civil questions)

                    // --- SOCIETAL ---
                    {
                        question: "Traditions are important and should be upheld.",
                        effects: {
                            strg_agree: { econ: 0, dipl: 0, govt: 0, scty: 10 },
                            agree:      { econ: 0, dipl: 0, govt: 0, scty: 5 },
                            neutral:    { econ: 0, dipl: 0, govt: 0, scty: 0 },
                            disagree:   { econ: 0, dipl: 0, govt: 0, scty: -5 },
                            strg_disagree:{ econ: 0, dipl: 0, govt: 0, scty: -10 },
                        }
                    },
                    {
                        question: "Technological progress should be pursued at all costs.",
                        effects: {
                            strg_agree: { econ: 0, dipl: 0, govt: 0, scty: -10 },
                            agree:      { econ: 0, dipl: 0, govt: 0, scty: -5 },
                            neutral:    { econ: 0, dipl: 0, govt: 0, scty: 0 },
                            disagree:   { econ: 0, dipl: 0, govt: 0, scty: 5 },
                            strg_disagree:{ econ: 0, dipl: 0, govt: 0, scty: 10 },
                        }
                    }
                    // ... (Add ~13 more societal questions)
                ].map(q => ({...q, answer: null })); // Add 'answer' slot
            },

            // --- IDEOLOGY DATA ---
            getIdeologies() {
                // Econ: 0=Equality, 100=Markets
                // Dipl: 0=World, 100=Nation
                // Govt: 0=Liberty, 100=Authority
                // Scty: 0=Progress, 100=Tradition
                return [
                    { name: 'Socialism', desc: "Advocates for social ownership and democratic control of the means of production.", scores: { econ: 10, dipl: 30, govt: 30, scty: 20 } },
                    { name: 'Liberalism', desc: "Believes in individual rights, democracy, and free-market capitalism.", scores: { econ: 60, dipl: 40, govt: 40, scty: 30 } },
                    { name: 'Conservatism', desc: "Emphasizes tradition, limited government, and a strong national defense.", scores: { econ: 70, dipl: 70, govt: 60, scty: 80 } },
                    { name: 'Libertarianism', desc: "Prioritizes individual liberty and minimizing the role of the state in all affairs.", scores: { econ: 90, dipl: 50, govt: 10, scty: 50 } },
                    { name: 'Authoritarianism', desc: "Characterized by a strong central power and limited political freedoms.", scores: { econ: 50, dipl: 80, govt: 90, scty: 70 } },
                    { name: 'Centrism', desc: "Holds a balanced perspective, incorporating elements from across the political spectrum.", scores: { econ: 50, dipl: 50, govt: 50, scty: 50 } },
                ];
            }
        },

        // --- 6. UI & COMPONENTS ---
        ui: {
            showPageLoader() {
                document.getElementById('app').innerHTML = `
                    <div class="page-loader">
                        <div class="spinner-lg"></div>
                    </div>
                `;
            },
            hidePageLoader() {
                // The page render function will overwrite the loader
            },

            setButtonLoading(button, isLoading) {
                if (isLoading) {
                    button.disabled = true;
                    button.dataset.originalText = button.innerHTML;
                    button.innerHTML = `<span class="spinner-sm"></span>`;
                } else {
                    button.disabled = false;
                    button.innerHTML = button.dataset.originalText;
                }
            },

            showToast(message, type = 'info') {
                const id = 'toast-' + Date.now();
                const toast = document.createElement('div');
                toast.id = id;
                toast.className = `toast toast-${type}`;
                
                let icon = 'info';
                if (type === 'success') icon = 'check-circle';
                if (type === 'error') icon = 'alert-triangle';

                toast.innerHTML = `
                    <i data-feather="${icon}"></i>
                    <span>${message}</span>
                `;
                
                document.getElementById('toast-container').appendChild(toast);
                feather.replace();

                // Animate in
                setTimeout(() => toast.classList.add('visible'), 100);

                // Auto-dismiss
                setTimeout(() => {
                    toast.classList.remove('visible');
                    toast.addEventListener('transitionend', () => toast.remove());
                }, 4000);
            },

            showModal(type) {
                const container = document.getElementById('modal-container');
                let content = '';
                
                if (type === 'login') content = App.components.LoginModal();
                if (type === 'signup') content = App.components.SignupModal();
                if (type === 'forgotPassword') content = App.components.ForgotPasswordModal();
                if (type === 'resetPassword') content = App.components.ResetPasswordModal();
                
                container.innerHTML = content;
                feather.replace();

                document.getElementById('modal-backdrop').classList.remove('hidden');
                container.classList.remove('hidden');
                setTimeout(() => {
                    document.getElementById('modal-backdrop').classList.add('visible');
                    container.classList.add('visible');
                }, 10);
            },

            hideModal() {
                const backdrop = document.getElementById('modal-backdrop');
                const container = document.getElementById('modal-container');
                
                backdrop.classList.remove('visible');
                container.classList.remove('visible');
                
                setTimeout(() => {
                    backdrop.classList.add('hidden');
                    container.classList.add('hidden');
                    container.innerHTML = '';
                }, 300);
            },
            
            toggleTheme() {
                const html = document.documentElement;
                html.classList.toggle('dark');
                const isDark = html.classList.contains('dark');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
            },

            loadTheme() {
                const theme = localStorage.getItem('theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            },

            updateNavUI() {
                const loggedInLinks = document.getElementById('logged-in-links');
                const loggedOutLinks = document.getElementById('logged-out-links');
                
                if (App.state.user) {
                    loggedInLinks.classList.remove('hidden');
                    loggedOutLinks.classList.add('hidden');
                    
                    const username = App.state.user.user_metadata?.username || 'User';
                    document.getElementById('user-menu-name').textContent = username;
                    document.getElementById('user-avatar-initial').textContent = username.charAt(0).toUpperCase();
                } else {
                    loggedInLinks.classList.add('hidden');
                    loggedOutLinks.classList.remove('hidden');
                }
            },

            updateActiveNavLinks() {
                const hash = window.location.hash || '#/';
                document.querySelectorAll('.nav-link').forEach(link => {
                    if (link.getAttribute('href') === `/${hash}`) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                });
            },

            loadAdSettings() {
                const adsEnabled = localStorage.getItem('adsEnabled') === 'true';
                document.body.classList.toggle('ads-enabled', adsEnabled);
                const adsToggle = document.getElementById('ads-toggle');
                if(adsToggle) adsToggle.checked = adsEnabled;
            }
        },

        // --- 7. VIEWS (PAGE TEMPLATES) ---
        views: {
            HomePage() {
                return `
                    <div class="text-center animate-fade-in-up">
                        <h1 class="text-5xl md:text-6xl font-bold font-display text-indigo-500 dark:text-indigo-300">
                            Find Your Place on the Spectrum.
                        </h1>
                        <p class="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mt-4 max-w-2xl mx-auto">
                            A comprehensive political quiz to help you discover your ideology,
                            track your views, and see where others stand.
                        </p>
                        <div class="mt-10">
                            <a href="/#quiz" class="btn btn-lg btn-primary">
                                Take the Quiz Now
                                <i data-feather="arrow-right" class="ml-2 w-5 h-5"></i>
                            </a>
                        </div>
                        
                        <div class="mt-20">
                            <h2 class="text-2xl font-bold">Recent Activity</h2>
                            <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mt-4 max-w-md mx-auto text-left">
                                <p class="text-gray-500 dark:text-gray-400">Activity feed coming in Milestone 3...</p>
                            </div>
                        </div>
                    </div>
                `;
            },
            
            QuizPage() {
                return `
                    <div>
                        <h1 class="text-center">Political Quiz</h1>
                        <div id="quiz-container" class="max-w-2xl mx-auto">
                            </div>
                    </div>
                `;
            },
            
            ResultsPage() {
                if (!App.state.quizResults) return App.views.ErrorPage('No results to display.');
                
                return `
                    <div class="animate-fade-in-up">
                        <h1 class="text-center">Your Results</h1>
                        <div class="bg-gray-800 dark:bg-gray-900 text-white p-6 sm:p-8 rounded-lg shadow-xl max-w-4xl mx-auto">
                            <h2 class="text-3xl font-bold font-display text-center">
                                Closest Match: 
                                <span id="ideology-name" class="text-indigo-300">...</span>
                            </h2>
                            <p id="ideology-desc" class="text-center text-lg text-gray-300 mt-2">...</p>
                            
                            <div class="w-full max-w-lg mx-auto h-64 md:h-96 my-8">
                                <canvas id="results-chart"></canvas>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <div class="flex justify-between font-bold mb-1">
                                        <span>Equality</span>
                                        <span>Markets</span>
                                    </div>
                                    <div class="results-axis-bar">
                                        <div id="econ-bar" class="results-axis-fill bg-indigo-400"></div>
                                    </div>
                                    <div class="flex justify-between text-sm mt-1">
                                        <span id="econ-label" class="font-medium">...</span>
                                        <span id="econ-val" class="font-bold">...</span>
                                    </div>
                                </div>
                                
                                <div>
                                    <div class="flex justify-between font-bold mb-1">
                                        <span>World</span>
                                        <span>Nation</span>
                                    </div>
                                    <div class="results-axis-bar">
                                        <div id="dipl-bar" class="results-axis-fill bg-green-400"></div>
                                    </div>
                                    <div class="flex justify-between text-sm mt-1">
                                        <span id="dipl-label" class="font-medium">...</span>
                                        <span id="dipl-val" class="font-bold">...</span>
                                    </div>
                                </div>
                                
                                <div>
                                    <div class="flex justify-between font-bold mb-1">
                                        <span>Liberty</span>
                                        <span>Authority</span>
                                    </div>
                                    <div class="results-axis-bar">
                                        <div id="govt-bar" class="results-axis-fill bg-red-400"></div>
                                    </div>
                                    <div class="flex justify-between text-sm mt-1">
                                        <span id="govt-label" class="font-medium">...</span>
                                        <span id="govt-val" class="font-bold">...</span>
                                    </div>
                                </div>
                                
                                <div>
                                    <div class="flex justify-between font-bold mb-1">
                                        <span>Progress</span>
                                        <span>Tradition</span>
                                    </div>
                                    <div class="results-axis-bar">
                                        <div id="scty-bar" class="results-axis-fill bg-yellow-400"></div>
                                    </div>
                                    <div class="flex justify-between text-sm mt-1">
                                        <span id="scty-label" class="font-medium">...</span>
                                        <span id="scty-val" class="font-bold">...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            },
            
            async ProfilePage(userId) {
                // For M1, we only show the current user's profile
                const user = App.state.user;
                if (!user) return `<h1>Profile</h1><p>You are not logged in.</p>`;

                // Fetch profile data and ALL results for the chart
                let profile, results, error;
                
                try {
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .select('username, created_at, latest_ideology, level, xp')
                        .eq('id', user.id)
                        .single();
                    if (profileError) throw profileError;
                    profile = profileData;

                    const { data: resultsData, error: resultsError } = await supabase
                        .from('quiz_results')
                        .select('created_at, scores')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: true });
                    if (resultsError) throw resultsError;
                    results = resultsData;

                } catch (e) {
                    console.error("Error fetching profile:", e);
                    return App.views.ErrorPage(`Could not load profile: ${e.message}`);
                }

                // Render Ideological Journey Chart
                setTimeout(() => {
                    const ctx = document.getElementById('journey-chart');
                    if (!ctx || !results || results.length < 2) {
                        if (ctx) ctx.parentElement.innerHTML = '<p class="text-gray-500 text-center">Complete at least two quizzes to see your journey.</p>';
                        return;
                    }
                    
                    new Chart(ctx.getContext('2d'), {
                        type: 'line',
                        data: {
                            labels: results.map(r => new Date(r.created_at).toLocaleDateString()),
                            datasets: [
                                { label: 'Economic', data: results.map(r => r.scores.econ), borderColor: '#818cf8', tension: 0.1 },
                                { label: 'Diplomatic', data: results.map(r => r.scores.dipl), borderColor: '#4ade80', tension: 0.1 },
                                { label: 'Civil', data: results.map(r => r.scores.govt), borderColor: '#f87171', tension: 0.1 },
                                { label: 'Societal', data: results.map(r => r.scores.scty), borderColor: '#facc15', tension: 0.1 }
                            ]
                        },
                        options: {
                             responsive: true,
                             scales: { y: { min: 0, max: 100 } }
                        }
                    });
                }, 100);

                return `
                    <div class="animate-fade-in-up">
                        <div class="bg-white dark:bg-gray-800 shadow-xl rounded-lg overflow-hidden max-w-4xl mx-auto">
                            <div class="h-48 bg-indigo-500">
                                </div>
                            <div class="p-6">
                                <div class="flex items-end -mt-24">
                                    <div class="w-32 h-32 rounded-full bg-gray-600 border-4 border-white dark:border-gray-800 flex items-center justify-center text-5xl font-bold text-white">
                                        ${profile.username.charAt(0).toUpperCase()}
                                    </div>
                                    </div>
                                
                                <h1 class="text-3xl font-bold mt-4">${profile.username}</h1>
                                <p class="text-lg text-indigo-500 dark:text-indigo-300 font-medium">${profile.latest_ideology || 'No quiz taken'}</p>
                                
                                <div class="mt-4">
                                    <h3 class="font-bold">Level ${profile.level || 1}</h3>
                                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                                        <div class="bg-green-500 h-4 rounded-full" style="width: ${profile.xp || 0}%"></div>
                                    </div>
                                    <p class="text-sm text-gray-500">${profile.xp || 0} / 100 XP to next level</p>
                                </div>
                                
                                <div class="mt-10">
                                    <h2 class="text-2xl font-bold">Ideological Journey</h2>
                                    <div class="mt-4 h-80">
                                        <canvas id="journey-chart"></canvas>
                                    </div>
                                </div>
                                
                                <div class="mt-10">
                                    <h2 class="text-2xl font-bold">Friends</h2>
                                    <p class="text-gray-500">Friends list coming in Milestone 2...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            },
            
            SettingsPage() {
                const adsEnabled = localStorage.getItem('adsEnabled') === 'true';
                
                return `
                    <div class="animate-fade-in-up max-w-xl mx-auto">
                        <h1>Settings</h1>
                        
                        <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                            <h2 class="text-xl font-bold">Preferences</h2>
                            
                            <div classs="flex items-center justify-between mt-4">
                                <label for="ads-toggle" class="font-medium">Show Advertisements</label>
                                <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                    Help support the platform by enabling non-intrusive ads.
                                </p>
                                <label class="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" id="ads-toggle" class="sr-only peer" ${adsEnabled ? 'checked' : ''}>
                                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            <hr class="my-6 border-gray-200 dark:border-gray-700">
                            
                            <h2 class="text-xl font-bold">Account</h2>
                            <div class="mt-4">
                                <button class="btn btn-outline" data-modal-trigger="forgotPassword">Reset Password</button>
                            </div>

                            <hr class="my-6 border-gray-200 dark:border-gray-700">

                            <h2 class="text-xl font-bold">Profile Customization (Coming Soon)</h2>
                            <div class="mt-4 space-y-4 opacity-50 cursor-not-allowed">
                                <div>
                                    <label class="form-label">Profile Title (Unlocks at Level 2)</label>
                                    <input type="text" class="form-input" placeholder="Your awesome title" disabled>
                                </div>
                                <div>
                                    <label class="form-label">Banner Color (Unlocks at Level 10)</label>
                                    <input type="color" class="w-full h-10" value="#6366f1" disabled>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            },
            
            CommunityPage() {
                return `
                    <div class="animate-fade-in-up max-w-3xl mx-auto">
                        <h1>Community</h1>
                        <p class="text-lg text-gray-600 dark:text-gray-400">
                            Browse other users, see their ideologies, and (soon) add them as friends.
                        </p>
                        <div class="mt-6">
                            <input type="search" class="form-input" placeholder="Search for users...">
                        </div>
                        
                        <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                            <h2 class="font-bold text-xl">User List</h2>
                            <p class="text-gray-500 mt-4">Full user list coming in Milestone 2...</p>
                        </div>
                    </div>
                `;
            },
            
            HowItWorksPage() {
                return `
                    <div class="animate-fade-in-up max-w-2xl mx-auto prose dark:prose-invert lg:prose-lg">
                        <h1>How It Works</h1>
                        <p>
                            "The Spectrum" is designed to be a comprehensive tool for political self-discovery.
                            Our core quiz is based on the 8values model, which measures your views across four distinct axes.
                        </p>
                        
                        <h2>The Four Axes</h2>
                        <h3>Economic Axis (Equality vs. Markets)</h3>
                        <p>
                            This axis measures your opinion on economic policy.
                            A high "Equality" score (closer to 0%) indicates a desire for a state-controlled or collectivized economy.
                            A high "Markets" score (closer to 100%) indicates a belief in free-market capitalism and minimal government intervention.
                        </p>
                        
                        <h3>Diplomatic Axis (World vs. Nation)</h3>
                        <p>
                            This axis measures your approach to foreign policy.
                            A high "World" score (closer to 0%) indicates a cosmopolitan, internationalist, and cooperative worldview.
                            A high "Nation" score (closer to 100%) indicates a nationalist, protectionist, and more isolationist worldview.
                        </p>

                        <h3>Civil Axis (Liberty vs. Authority)</h3>
                        <p>
                            This axis measures your view on the role of the state in personal lives.
                            A high "Liberty" score (closer to 0%) favors individual freedoms, privacy, and skepticism of state power.
                            A high "Authority" score (closer to 100%) believes a strong state is necessary to ensure order, security, and stability, even at the cost of some freedoms.
                        </p>
                        
                        <h3>Societal Axis (Progress vs. Tradition)</h3>
                        <p>
                            This axis measures your stance on social and cultural issues.
                            A high "Progress" score (closer to 0%) supports social change, scientific advancement, and new ideas.
                            A high "Tradition" score (closer to 100%) emphasizes the importance of traditional values, customs, and religious beliefs.
                        </p>
                        
                        <h2>Scoring & Matching</h2>
                        <p>
                            Each answer you give adds or subtracts points from one or more axes. Your final position on each axis is
                            calculated as a percentage. We then compare your 4-dimensional score against a database of predefined
                            ideologies, using a simple Euclidean distance formula to find the one you are "closest" to.
                        </p>
                        
                        <h2>"Formulate Your Words" (Coming Soon)</h2>
                        <p>
                            This feature (coming in Milestone 2) will use a client-side, keyword-based sentiment analysis model. It will
                            not be true AI, but a clever parser that looks for positive ("I strongly support," "absolutely") and
                            negative ("I oppose," "never") keywords to assign a score, giving you another way to express your views.
                        </p>
                    </div>
                `;
            },
            
            NotFoundPage() {
                return `
                    <div class="text-center">
                        <h1 class="text-6xl font-bold font-display text-indigo-500">404</h1>
                        <p class="text-2xl">Page Not Found</p>
                        <a href="/#" class="btn btn-primary mt-8">Go Home</a>
                    </div>
                `;
            },

            ErrorPage(error) {
                 return `
                    <div class="text-center">
                        <h1 class="text-4xl font-bold font-display text-red-500">An Error Occurred</h1>
                        <p class="text-xl">Something went wrong. Please try again later.</p>
                        <code class="block bg-gray-100 dark:bg-gray-800 p-4 rounded-md my-4 text-left">${error}</code>
                        <a href="/#" class="btn btn-primary mt-8">Go Home</a>
                    </div>
                `;
            }
        },

        // --- 8. UI COMPONENTS (MODAL TEMPLATES) ---
        components: {
            LoginModal() {
                return `
                    <div class="modal-content">
                        <button class="modal-close-btn modal-close"><i data-feather="x"></i></button>
                        <h3 class="modal-title">Log In</h3>
                        <form id="login-form" class="space-y-4">
                            <div>
                                <label for="login-email" class="form-label">Email</label>
                                <input type="email" id="login-email" name="email" class="form-input" required>
                            </div>
                            <div>
                                <label for="login-password" class="form-label">Password</label>
                                <input type="password" id="login-password" name="password" class="form-input" required>
                            </div>
                            <div class="text-sm">
                                <a href="#" class="font-medium text-indigo-600 dark:text-indigo-400 hover:underline" data-modal-trigger="forgotPassword">
                                    Forgot your password?
                                </a>
                            </div>
                            <button type="submit" class="btn btn-primary w-full">Log In</button>
                        </form>
                    </div>
                `;
            },
            
            SignupModal() {
                return `
                    <div class="modal-content">
                        <button class="modal-close-btn modal-close"><i data-feather="x"></i></button>
                        <h3 class="modal-title">Sign Up</h3>
                        <form id="signup-form" class="space-y-4">
                            <div>
                                <label for="signup-email" class="form-label">Email</label>
                                <input type="email" id="signup-email" name="email" class="form-input" required>
                            </div>
                             <div>
                                <label for="signup-username" class="form-label">Username</label>
                                <input type="text" id="signup-username" name="username" class="form-input" required minlength="3">
                            </div>
                            <div>
                                <label for="signup-password" class="form-label">Password</label>
                                <input type="password" id="signup-password" name="password" class="form-input" required minlength="6">
                            </div>
                            <button type="submit" class="btn btn-primary w-full">Create Account</button>
                        </form>
                    </div>
                `;
            },

            ForgotPasswordModal() {
                return `
                    <div class="modal-content">
                        <button class="modal-close-btn modal-close"><i data-feather="x"></i></button>
                        <h3 class="modal-title">Reset Password</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Enter your email and we'll send you a link to reset your password.
                        </p>
                        <form id="forgot-password-form" class="space-y-4">
                            <div>
                                <label for="reset-email" class="form-label">Email</label>
                                <input type="email" id="reset-email" name="email" class="form-input" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-full">Send Reset Link</button>
                        </form>
                    </div>
                `;
            },

            ResetPasswordModal() {
                return `
                    <div class="modal-content">
                        <button class="modal-close-btn modal-close"><i data-feather="x"></i></button>
                        <h3 class="modal-title">Create New Password</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            You are logged in. Enter a new password below to update your account.
                        </p>
                        <form id="reset-password-form" class="space-y-4">
                            <div>
                                <label for="new-password" class="form-label">New Password</label>
                                <input type="password" id="new-password" name="password" class="form-input" required minlength="6">
                            </div>
                            <button type="submit" class="btn btn-primary w-full">Update Password</button>
                        </form>
                    </div>
                `;
            }
        }
    };

    // --- DOM READY ---
    // Wait for the DOM to be fully loaded before initializing
    document.addEventListener('DOMContentLoaded', () => {
        App.ui.loadTheme();
        App.init();
        App.ui.loadAdSettings();
    });

})();


