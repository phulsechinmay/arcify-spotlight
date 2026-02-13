import { Logger } from './logger.js';

class InstallationOnboarding {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 3;
        this.settings = {
            archiving: false
        };
        this.shortcuts = {
            'toggleSpotlight': 'Alt+L',
            'toggleSpotlightNewTab': 'Alt+T'
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateUI();
        this.loadSettings();
        this.loadKeyboardShortcuts();
    }

    bindEvents() {
        // Navigation buttons
        const prevBtn = document.getElementById('prevBtn');
        if (prevBtn) prevBtn.addEventListener('click', () => this.previousStep());

        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) nextBtn.addEventListener('click', () => this.nextStep());

        // Toggle buttons
        const archiveToggle = document.getElementById('archiveToggle');
        if (archiveToggle) {
            archiveToggle.addEventListener('click', () => this.toggleArchiving());
        }

        // Progress dots
        document.querySelectorAll('.progress-dot').forEach((dot, index) => {
            dot.addEventListener('click', () => this.goToStep(index + 1));
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.previousStep();
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                this.nextStep();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.closeOnboarding();
            }
        });
    }

    async nextStep() {
        if (this.currentStep < this.totalSteps) {
            this.goToStep(this.currentStep + 1);
        } else {
            this.completeOnboarding();
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.goToStep(this.currentStep - 1);
        }
    }

    goToStep(step) {
        if (step < 1 || step > this.totalSteps) return;

        const stepIdMap = {
            1: 'step1',
            2: 'step2',
            3: 'step3'
        };

        // Hide current step
        const currentStepId = stepIdMap[this.currentStep];
        const currentStepElement = document.getElementById(currentStepId);
        if (currentStepElement) {
            currentStepElement.classList.remove('active');
        }

        // Show new step
        const newStepId = stepIdMap[step];
        const newStepElement = document.getElementById(newStepId);
        if (newStepElement) {
            newStepElement.classList.add('active');
        }

        // Update current step
        this.currentStep = step;

        // Update UI
        this.updateUI();
    }

    updateUI() {
        // Update step counter
        const stepCounter = document.getElementById('currentStep');
        if (stepCounter) {
            stepCounter.textContent = this.currentStep;
        }

        // Update navigation buttons
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');

        if (prevBtn) prevBtn.disabled = this.currentStep === 1;
        if (nextBtn) nextBtn.textContent = this.currentStep === this.totalSteps ? 'Get Started' : 'Next';

        // Update progress dots
        document.querySelectorAll('.progress-dot').forEach((dot, index) => {
            const stepNumber = index + 1;
            dot.classList.remove('active', 'completed');

            if (stepNumber === this.currentStep) {
                dot.classList.add('active');
            } else if (stepNumber < this.currentStep) {
                dot.classList.add('completed');
            }
        });

        // Update toggle buttons
        this.updateToggleButtons();
    }

    updateToggleButtons() {
        const archiveToggle = document.getElementById('archiveToggle');

        if (archiveToggle) {
            archiveToggle.textContent = this.settings.archiving ? 'Archiving is Enabled' : 'Enable Tab Archiving';
            archiveToggle.className = `toggle-button ${this.settings.archiving ? 'on' : 'off'}`;
        }
    }

    toggleArchiving() {
        this.settings.archiving = !this.settings.archiving;
        this.updateToggleButtons();
        this.saveSettings();
    }

    loadSettings() {
        if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['autoArchiveEnabled'], (result) => {
                this.settings.archiving = result.autoArchiveEnabled !== undefined ? result.autoArchiveEnabled : false;
                this.updateToggleButtons();
            });
        }
    }

    saveSettings() {
        if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({
                autoArchiveEnabled: this.settings.archiving
            });
        }
    }

    async loadKeyboardShortcuts() {
        try {
            const commands = await chrome.commands.getAll();
            const shortcuts = {};

            commands.forEach(command => {
                if (command.shortcut) {
                    shortcuts[command.name] = command.shortcut;
                }
            });

            this.shortcuts = {
                'toggleSpotlight': shortcuts['toggleSpotlight'] || 'Alt+L',
                'toggleSpotlightNewTab': shortcuts['toggleSpotlightNewTab'] || 'Alt+T'
            };
            Logger.log('Keyboard shortcuts loaded:', this.shortcuts);
            this.updateShortcutDisplay(shortcuts);
        } catch (error) {
            Logger.error('Error loading keyboard shortcuts:', error);
            this.shortcuts = {
                'toggleSpotlight': 'Alt+L',
                'toggleSpotlightNewTab': 'Alt+T'
            };
            this.updateShortcutDisplay({});
        }
    }

    updateShortcutDisplay(shortcuts) {
        const shortcutElements = {
            'toggleSpotlight': this.shortcuts['toggleSpotlight'],
            'toggleSpotlightNewTab': this.shortcuts['toggleSpotlightNewTab']
        };

        Object.keys(shortcutElements).forEach(key => {
            const element = document.querySelector(`[data-shortcut="${key}"]`);
            if (element) {
                element.textContent = shortcutElements[key];
            }
        });
    }

    completeOnboarding() {
        this.saveSettings();

        if (chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.set({ onboardingCompleted: true });
        }

        // Construct redirect URL with shortcuts
        // Check if we are in dev environment (injected by Vite build)
        const isDev = typeof __IS_DEV__ !== 'undefined' && __IS_DEV__;
        const baseUrl = isDev ? 'http://localhost:3000' : 'https://arcify.io';
        const params = new URLSearchParams();

        if (this.shortcuts['toggleSpotlight']) {
            params.append('toggleSpotlight', this.shortcuts['toggleSpotlight']);
        }
        if (this.shortcuts['toggleSpotlightNewTab']) {
            params.append('toggleSpotlightNewTab', this.shortcuts['toggleSpotlightNewTab']);
        }

        const redirectUrl = `${baseUrl}?${params.toString()}`;

        // Redirect to arcify.io
        window.location.href = redirectUrl;
    }

    closeOnboarding() {
        if (window.close) {
            window.close();
        } else {
            document.body.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <div style="background: white; padding: 3rem; border-radius: 16px; text-align: center; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
                        <h1 style="color: #007AFF; margin-bottom: 1rem;">Setup Complete!</h1>
                        <p style="color: #666; margin-bottom: 2rem;">You can now close this window and start using Arcify.</p>
                        <button onclick="window.close()" style="background: #007AFF; color: white; border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer;">Close Window</button>
                    </div>
                </div>
            `;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.onboarding = new InstallationOnboarding();
});

if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'getSettings') {
            sendResponse({ settings: window.onboarding?.settings || {} });
        }
    });
}
