/**
 * QuantumAI Landing Page Form Handler
 * Handles form submission and communicates with the backend API
 */

// Configuration
const API_BASE_URL = '/api';
const LANDING_ENDPOINT = `${API_BASE_URL}/landing`;

/**
 * Display success message to user
 */
function showSuccessMessage(message) {
    // Create success message element
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        font-family: Arial, sans-serif;
        max-width: 300px;
    `;
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 5000);
}

/**
 * Display error message to user
 */
function showErrorMessage(message, errors = []) {
    // Create error message element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        font-family: Arial, sans-serif;
        max-width: 300px;
    `;
    
    let errorText = message;
    if (errors && errors.length > 0) {
        errorText += '\n\n' + errors.map(err => `• ${err.msg}`).join('\n');
    }
    
    errorDiv.textContent = errorText;
    document.body.appendChild(errorDiv);
    
    // Remove after 7 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 7000);
}

/**
 * Show loading state on form
 */
function setFormLoading(form, isLoading) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const preloader = form.querySelector('.preloader');
    
    if (isLoading) {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }
        if (preloader) {
            preloader.style.display = 'block';
        }
    } else {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
        if (preloader) {
            preloader.style.display = 'none';
        }
    }
}

/**
 * Extract form data and prepare for submission
 */
function extractFormData(form) {
    const formData = new FormData(form);
    const data = {};
    
    // Extract basic form fields
    data.firstName = formData.get('name') || '';
    data.lastName = formData.get('lastname') || '';
    data.email = formData.get('email') || '';
    data.phone = formData.get('phone') || '';
    
    // Extract country code from hidden field or phone input
    const phoneInput = form.querySelector('input[name="phone"]');
    let countryCode = '';
    
    if (phoneInput) {
        // Try to get country code from intl-tel-input
        const itiInstance = window.intlTelInputGlobals.getInstance(phoneInput);
        if (itiInstance) {
            const countryData = itiInstance.getSelectedCountryData();
            countryCode = countryData.dialCode || '';
        }
    }
    
    // Fallback to hidden field
    if (!countryCode) {
        const hiddenField = form.querySelector('input[name="params[phc]"]');
        if (hiddenField) {
            countryCode = hiddenField.value || '';
        }
    }
    
    // Default to +1 if no country code found
    if (!countryCode) {
        countryCode = '1';
    }
    
    // Ensure country code has + prefix
    data.prefix = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    
    console.log('Extracted form data:', data);
    return data;
}

/**
 * Validate form data before submission
 */
function validateFormData(data) {
    const errors = [];
    
    if (!data.firstName || data.firstName.trim().length < 2) {
        errors.push('First name must be at least 2 characters');
    }
    
    if (!data.lastName || data.lastName.trim().length < 2) {
        errors.push('Last name must be at least 2 characters');
    }
    
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('Please enter a valid email address');
    }
    
    if (!data.phone || data.phone.trim().length < 7) {
        errors.push('Please enter a valid phone number');
    }
    
    return errors;
}

/**
 * Submit form data to backend API
 */
async function submitFormData(data) {
    try {
        const response = await fetch(LANDING_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'Submission failed');
        }
        
        return result;
    } catch (error) {
        console.error('Form submission error:', error);
        throw error;
    }
}

/**
 * Main form submission handler
 * Called when any form is submitted
 */
async function onLeadSubmit(form, redirect = false) {
    try {
        console.log('Form submission started');
        
        // Show loading state
        setFormLoading(form, true);
        
        // Extract and validate form data
        const formData = extractFormData(form);
        const validationErrors = validateFormData(formData);
        
        if (validationErrors.length > 0) {
            showErrorMessage('Please fix the following errors:', validationErrors.map(err => ({ msg: err })));
            setFormLoading(form, false);
            return false;
        }
        
        // Submit to backend
        console.log('Submitting form data to backend...');
        const result = await submitFormData(formData);
        
        console.log('Form submission successful:', result);
        
        // Show success message
        showSuccessMessage(result.message || 'Thank you! Your information has been submitted successfully.');
        
        // Reset form
        form.reset();
        
        // Hide popup if it's a popup form
        const popup = document.getElementById('popup_custom');
        if (popup && form.closest('#popup_custom')) {
            popup.style.visibility = 'hidden';
        }
        
        // Optional redirect (not used by default)
        if (redirect && result.redirectUrl) {
            setTimeout(() => {
                window.location.href = result.redirectUrl;
            }, 2000);
        }
        
        console.log('✅ Form submission completed successfully');
        console.log('🚀 QuantumAI injection process has been started in the background');
        
        return true;
        
    } catch (error) {
        console.error('Form submission failed:', error);
        
        let errorMessage = 'Submission failed. Please try again.';
        let errors = [];
        
        if (error.message) {
            errorMessage = error.message;
        }
        
        // Handle specific error responses
        if (error.response) {
            try {
                const errorData = await error.response.json();
                if (errorData.errors) {
                    errors = errorData.errors;
                }
                if (errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch (parseError) {
                console.error('Error parsing error response:', parseError);
            }
        }
        
        showErrorMessage(errorMessage, errors);
        return false;
        
    } finally {
        // Always hide loading state
        setFormLoading(form, false);
    }
}

/**
 * Initialize form handlers when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('QuantumAI Form Handler initialized');
    
    // Add global error handler for unhandled promises
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
    });
    
    // Close popup when clicking the close button
    const closeButton = document.querySelector('#popup_custom .close_button');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            const popup = document.getElementById('popup_custom');
            if (popup) {
                popup.style.visibility = 'hidden';
            }
        });
    }
    
    // Close popup when clicking outside
    const popupOverlay = document.querySelector('#popup_custom .popup_overlay');
    if (popupOverlay) {
        popupOverlay.addEventListener('click', function() {
            const popup = document.getElementById('popup_custom');
            if (popup) {
                popup.style.visibility = 'hidden';
            }
        });
    }
});

// Make onLeadSubmit globally available
window.onLeadSubmit = onLeadSubmit;

console.log('✅ QuantumAI connector.js loaded successfully'); 