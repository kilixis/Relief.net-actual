class AIChatbot {
    constructor() {
        this.apiKey = 'AIzaSyAOpyvWgzbK6bP3aMOx-7SRNl-tPRfNoLE';
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
        this.chatButton = document.getElementById('aiChatButton');
        this.chatContainer = document.getElementById('aiChatContainer');
        this.chatMessages = document.getElementById('aiChatMessages');
        this.chatInput = document.getElementById('aiChatInput');
        this.chatSend = document.getElementById('aiChatSend');
        this.chatClose = document.getElementById('aiChatClose');
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.chatButton.addEventListener('click', () => this.toggleChat());
        this.chatClose.addEventListener('click', () => this.closeChat());
        this.chatSend.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Close chat when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.chatContainer.contains(e.target) && !this.chatButton.contains(e.target)) {
                this.closeChat();
            }
        });
    }

    toggleChat() {
        const isVisible = this.chatContainer.style.display === 'flex';
        this.chatContainer.style.display = isVisible ? 'none' : 'flex';
        if (!isVisible) {
            this.chatInput.focus();
        }
    }

    closeChat() {
        this.chatContainer.style.display = 'none';
    }

    addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${isUser ? 'user' : 'assistant'}`;
        
        if (isUser) {
            // User messages stay as plain text
            messageDiv.textContent = message;
        } else {
            // AI messages: convert markdown to HTML
            const htmlMessage = this.convertMarkdownToHTML(message);
            messageDiv.innerHTML = htmlMessage;
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    convertMarkdownToHTML(text) {
        // Convert markdown to HTML
        let html = text
            // Bold text: **text** or __text__ -> <strong>text</strong>
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            // Italic text: *text* or _text_ -> <em>text</em>
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            // Line breaks: convert \n to <br>
            .replace(/\n/g, '<br>')
            // Numbered lists: 1. item -> <ol><li>item</li></ol>
            .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
            // Bullet points: - item or * item -> <ul><li>item</li></ul>
            .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
        
        // Wrap consecutive <li> elements in appropriate list tags
        html = html
            .replace(/(<li>.*<\/li>)/gs, (match) => {
                // Check if this is part of a numbered list (if original had numbers)
                if (text.match(/^\d+\./m)) {
                    return '<ol>' + match + '</ol>';
                } else {
                    return '<ul>' + match + '</ul>';
                }
            });
        
        // Clean up nested lists
        html = html
            .replace(/<\/ol>\s*<ol>/g, '')
            .replace(/<\/ul>\s*<ul>/g, '');
        
        return html;
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        this.addMessage(message, true);
        this.chatInput.value = '';
        this.chatSend.disabled = true;

        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ai-message assistant';
        loadingDiv.innerHTML = '<div class="ai-loading">AI is thinking...</div>';
        this.chatMessages.appendChild(loadingDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        try {
            const response = await this.callGeminiAPI(message);
            this.chatMessages.removeChild(loadingDiv);
            this.addMessage(response);
        } catch (error) {
            this.chatMessages.removeChild(loadingDiv);
            const errorMessage = this.handleAPIError(error);
            this.addMessage(errorMessage);
            console.error('AI Error:', error);
        } finally {
            this.chatSend.disabled = false;
            this.chatInput.focus();
        }
    }

    async callGeminiAPI(message, retryCount = 0) {
        const maxRetries = 2;
        const context = this.getEmergencyContext();
        const prompt = `You are an AI Emergency Assistant for ReliefNet, a disaster relief platform. 

Current context: ${context}

User message: ${message}

Please provide helpful, actionable advice related to emergency situations, disaster response, or using the ReliefNet platform. Keep responses concise but informative.`;

        try {
            const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 500
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('API Error Response:', errorData);
                
                // Handle specific error cases
                if (response.status === 503 && retryCount < maxRetries) {
                    console.log(`Service unavailable, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
                    await this.delay(1000 * (retryCount + 1)); // Exponential backoff
                    return this.callGeminiAPI(message, retryCount + 1);
                }
                
                // Handle different error types
                if (response.status === 400) {
                    throw new Error('Invalid request format. Please try again.');
                } else if (response.status === 401) {
                    throw new Error('API key is invalid or expired.');
                } else if (response.status === 403) {
                    throw new Error('API access denied. Check your API key permissions.');
                } else if (response.status === 429) {
                    throw new Error('Too many requests. Please wait a moment and try again.');
                } else if (response.status === 503) {
                    throw new Error('AI service is temporarily unavailable. Please try again later.');
                } else {
                    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
                }
            }

            const data = await response.json();
            console.log('Full API Response:', JSON.stringify(data, null, 2)); // Debug log
            
            return this.parseGeminiResponse(data);
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Network error: Please check your internet connection');
            }
            throw error;
        }
    }

    // Helper method for delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    parseGeminiResponse(data) {
        // Validate basic response structure
        if (!data || typeof data !== 'object') {
            console.error('Invalid response format:', data);
            throw new Error('Invalid response format: data is not an object');
        }

        // Check for error in response
        if (data.error) {
            console.error('API Error:', data.error);
            throw new Error(`API Error: ${data.error.message || 'Unknown error'}`);
        }

        // Check candidates array
        if (!Array.isArray(data.candidates) || data.candidates.length === 0) {
            console.error('No candidates in response:', data);
            throw new Error('No candidates in response');
        }

        const candidate = data.candidates[0];
        console.log('Candidate structure:', JSON.stringify(candidate, null, 2)); // Debug log

        // Handle MAX_TOKENS finish reason
        if (candidate.finishReason === 'MAX_TOKENS') {
            console.warn('Response was truncated due to MAX_TOKENS limit');
        }

        // Check for content blocking
        if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'BLOCKED_REASON_UNSPECIFIED') {
            throw new Error('Response was blocked due to safety filters');
        }

        // Try to extract text from various possible response structures
        let responseText = null;

        // Method 1: Standard structure (content.parts[0].text)
        if (candidate.content && 
            candidate.content.parts && 
            Array.isArray(candidate.content.parts) && 
            candidate.content.parts.length > 0) {
            
            const firstPart = candidate.content.parts[0];
            if (firstPart && firstPart.text) {
                responseText = firstPart.text;
            }
        }
        // Method 2: Direct text property
        else if (candidate.text) {
            responseText = candidate.text;
        }
        // Method 3: Output property (some API versions)
        else if (candidate.output) {
            responseText = candidate.output;
        }
        // Method 4: Message property
        else if (candidate.message && candidate.message.content) {
            responseText = candidate.message.content;
        }

        // If still no text found, log the full candidate for debugging
        if (!responseText) {
            console.error('Could not extract text from candidate. Full candidate object:');
            console.error('Candidate keys:', Object.keys(candidate));
            if (candidate.content) {
                console.error('Content keys:', Object.keys(candidate.content));
                if (candidate.content.parts) {
                    console.error('Parts array length:', candidate.content.parts.length);
                    console.error('First part:', candidate.content.parts[0]);
                    if (candidate.content.parts[0]) {
                        console.error('First part keys:', Object.keys(candidate.content.parts[0]));
                    }
                }
            }
            throw new Error('No text found in API response');
        }

        // Handle truncated responses
        let finalText = responseText.trim();
        if (candidate.finishReason === 'MAX_TOKENS') {
            finalText += '\n\n(Note: Response was truncated due to length limits)';
        }

        return finalText;
    }

    handleAPIError(error) {
        console.error('AI Chat Error:', error);
        
        if (error.message.includes('Network error')) {
            return 'I\'m having trouble connecting to the internet. Please check your connection and try again.';
        } else if (error.message.includes('API key is invalid')) {
            return 'There\'s an issue with the AI service configuration. Please contact support.';
        } else if (error.message.includes('API access denied')) {
            return 'Access to the AI service is currently restricted. Please try again later.';
        } else if (error.message.includes('Too many requests')) {
            return 'I\'m receiving too many requests right now. Please wait a moment and try again.';
        } else if (error.message.includes('temporarily unavailable')) {
            return 'The AI service is temporarily unavailable. Please try again in a few moments.';
        } else if (error.message.includes('Invalid request format')) {
            return 'There was an issue with your message format. Please try rephrasing and send again.';
        } else if (error.message.includes('safety filters')) {
            return 'I can\'t provide a response to that message due to safety guidelines. Please try rephrasing your question.';
        } else if (error.message.includes('API Error:')) {
            return `Service error: ${error.message.replace('API Error: ', '')}`;
        } else if (error.message.includes('No text found') || error.message.includes('Invalid response')) {
            return 'I received an unexpected response from the AI service. Please try again.';
        } else {
            return 'Sorry, I encountered an unexpected error. Please try again later.';
        }
    }

    getEmergencyContext() {
        const currentPath = window.location.pathname;
        let context = '';

        if (currentPath.includes('map.html')) {
            context = 'User is on the ReliefNet map page, can see emergency requests and submit help requests.';
            
            // Check if user has location
            if (navigator.geolocation) {
                context += ' User has location services enabled.';
            }
            
            // Check current role
            const urlParams = new URLSearchParams(window.location.search);
            const role = urlParams.get('role') || 'victim';
            context += ` Current role: ${role}.`;
        } else {
            context = 'User is on the ReliefNet homepage, can share emergency location.';
        }

        return context;
    }
}

// Initialize AI chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AIChatbot();
});