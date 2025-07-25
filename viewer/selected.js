document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const conversationContentDiv = document.getElementById('conversation-content');
    const taskSelect = document.getElementById('task-select');
    const convTypeSelect = document.getElementById('conv-type-select');
    const conversationSelect = document.getElementById('conversation-select');

    let allSelectedConversations = [];
    let filteredConversations = [];

    const responseCategoryMapping = {
        "answer_attempt": "Answer attempt",
        "hedge": "Hedge",
        "clarification": "Clarification",
        "interrogation": "Interrogation",
        "discussion": "Discussion",
        "refuse": "Refusal",
        "missing": "Missing"
    };

    // Sidebar toggle functionality
    if (sidebarToggle && sidebar) {
        // Set initial icon
        sidebarToggle.innerHTML = sidebar.classList.contains('collapsed')
            ? '<i class="fas fa-angle-right"></i>'
            : '<i class="fas fa-angle-left"></i>';

        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            sidebarToggle.innerHTML = sidebar.classList.contains('collapsed')
                ? '<i class="fas fa-angle-right"></i>'
                : '<i class="fas fa-angle-left"></i>';
        });
    }

    function formatMessageContent(contentString) {
        if (typeof contentString !== 'string') return '';
        // Check if the content contains code blocks
        if (!contentString.includes('```') && !contentString.includes('**')) {
            return contentString;
        }
        const converter = new showdown.Converter();
        let htmlContent = converter.makeHtml(contentString);
        return htmlContent;
    }

    function renderConversation() {
        if (!conversationContentDiv || !conversationSelect) return;
        conversationContentDiv.innerHTML = ''; // Clear previous content

        const selectedIndex = parseInt(conversationSelect.value);
        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= allSelectedConversations.length) {
            conversationContentDiv.innerHTML = '<p>Please select a conversation.</p>';
            return;
        }

        const conversationObject = allSelectedConversations[selectedIndex];
        const conversationTurns = conversationObject.trace;

        // Add note display if it exists
        if (conversationObject.note) {
            const noteDiv = document.createElement('div');
            noteDiv.classList.add('conversation-note');
            noteDiv.style.cssText = `
                background-color: #f8f9fa;
                border-left: 4px solid #007bff;
                padding: 12px 16px;
                margin-bottom: 20px;
                border-radius: 4px;
                font-style: italic;
                color: #495057;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            `;
            noteDiv.innerHTML = `<strong>Note:</strong> ${conversationObject.note}`;
            conversationContentDiv.appendChild(noteDiv);
        }

        conversationTurns.forEach((entry) => {
            const turnDiv = document.createElement('div');
            turnDiv.classList.add('code-turn');

            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message');
            const messageContentDiv = document.createElement('div');
            messageContentDiv.classList.add('message-content');

            let roleSpecificClass = '';
            let showContent = true;
            let evaluationData = null;
            let answerCategory = null;
            let roleLabelText = null;

            switch (entry.role) {
                case 'user':
                    roleSpecificClass = 'message-user';
                    roleLabelText = 'User';
                    messageContentDiv.innerHTML = formatMessageContent(entry.content);
                    break;
                case 'assistant':
                    roleSpecificClass = 'message-assistant';
                    roleLabelText = 'Assistant';
                    messageContentDiv.innerHTML = formatMessageContent(entry.content);
                    break;
                case 'log':
                    showContent = false;
                    if (entry.content && entry.content.type === 'answer-evaluation') {
                        evaluationData = entry.content;
                    }
                    if (entry.content && entry.content.type === 'system-verification') {
                        answerCategory = entry.content.response.response_type;
                    }
                    break;
                default:
                    showContent = false;
            }

            const messageWrapperDiv = document.createElement('div');
            messageWrapperDiv.classList.add('message-wrapper', `message-wrapper-${roleSpecificClass.replace('message-', '')}`);
            messageWrapperDiv.appendChild(messageDiv);

            if (showContent) {
                messageDiv.classList.add(roleSpecificClass);
                messageDiv.appendChild(messageContentDiv);

                const metadataContainer = document.createElement('div');
                metadataContainer.classList.add('turn-metadata');

                if (roleLabelText) {
                    const labelDiv = document.createElement('div');
                    labelDiv.classList.add('message-role-label', roleSpecificClass.replace('message-', ''));
                    labelDiv.textContent = roleLabelText;
                    messageWrapperDiv.appendChild(labelDiv);
                }

                if (entry.timestamp) {
                    const timestampSpan = document.createElement('span');
                    timestampSpan.textContent = new Date(entry.timestamp).toLocaleTimeString();

                    const timestampWrapperDiv = document.createElement('div');
                    timestampWrapperDiv.classList.add('timestamp');
                    timestampWrapperDiv.appendChild(timestampSpan);
                    metadataContainer.appendChild(timestampWrapperDiv);
                }

                messageWrapperDiv.appendChild(messageDiv);
                turnDiv.appendChild(messageWrapperDiv);

                if (roleSpecificClass === 'message-user') {
                    metadataContainer.style.alignSelf = 'flex-start';
                    metadataContainer.style.textAlign = 'left';
                } else {
                    metadataContainer.style.alignSelf = 'flex-end';
                    metadataContainer.style.textAlign = 'right';
                }

                turnDiv.appendChild(metadataContainer);
                conversationContentDiv.appendChild(turnDiv);
            }

            if (answerCategory && conversationContentDiv.lastChild) {
                const lastTurnDiv = conversationContentDiv.lastChild;
                let targetMetadataContainer = lastTurnDiv.querySelector('.turn-metadata');
                if (!targetMetadataContainer) {
                    targetMetadataContainer = document.createElement('div');
                    targetMetadataContainer.classList.add('turn-metadata');

                    const prevMessageBubble = lastTurnDiv.querySelector('.message');
                    if (prevMessageBubble && prevMessageBubble.classList.contains('message-user')) {
                        targetMetadataContainer.style.alignSelf = 'flex-start';
                        targetMetadataContainer.style.textAlign = 'left';
                    } else if (prevMessageBubble && prevMessageBubble.classList.contains('message-assistant')) {
                        targetMetadataContainer.style.alignSelf = 'flex-end';
                        targetMetadataContainer.style.textAlign = 'right';
                    } else {
                        targetMetadataContainer.style.alignSelf = 'flex-start';
                        targetMetadataContainer.style.textAlign = 'left';
                    }
                    lastTurnDiv.appendChild(targetMetadataContainer);
                }

                const categoryDiv = document.createElement('div');
                categoryDiv.classList.add('evaluation-status');
                categoryDiv.innerHTML = `Response category: <span class="${answerCategory}">${responseCategoryMapping[answerCategory]}</span>`;

                const categoryWrapperDiv = document.createElement('div');
                categoryWrapperDiv.appendChild(categoryDiv);
                targetMetadataContainer.appendChild(categoryWrapperDiv);
                answerCategory = null;
            }

            if (evaluationData && conversationContentDiv.lastChild) {
                const lastTurnDiv = conversationContentDiv.lastChild;
                let targetMetadataContainer = lastTurnDiv.querySelector('.turn-metadata');
                if (!targetMetadataContainer) {
                    targetMetadataContainer = document.createElement('div');
                    targetMetadataContainer.classList.add('turn-metadata');

                    const prevMessageBubble = lastTurnDiv.querySelector('.message');
                    if (prevMessageBubble && prevMessageBubble.classList.contains('message-user')) {
                        targetMetadataContainer.style.alignSelf = 'flex-start';
                        targetMetadataContainer.style.textAlign = 'left';
                    } else if (prevMessageBubble && prevMessageBubble.classList.contains('message-assistant')) {
                        targetMetadataContainer.style.alignSelf = 'flex-end';
                        targetMetadataContainer.style.textAlign = 'right';
                    } else {
                        targetMetadataContainer.style.alignSelf = 'flex-start';
                        targetMetadataContainer.style.textAlign = 'left';
                    }
                    lastTurnDiv.appendChild(targetMetadataContainer);
                }

                const evalDiv = document.createElement('div');
                evalDiv.classList.add('evaluation-status');
                const isCorrect = evaluationData.score === 1.0 || evaluationData.is_correct === true;
                evalDiv.innerHTML = `Answer evaluation: <span class="${isCorrect ? 'correct' : 'incorrect'}">${isCorrect ? '✔' : '✗'} ${isCorrect ? 'Correct' : 'Incorrect'}</span>`;

                const evalWrapperDiv = document.createElement('div');
                evalWrapperDiv.appendChild(evalDiv);
                targetMetadataContainer.appendChild(evalWrapperDiv);
                evaluationData = null;
            }
        });
    }

    function populateConversationDropdown() {
        if (!conversationSelect) return;
        conversationSelect.innerHTML = ''; // Clear existing options

        if (allSelectedConversations.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No conversations found';
            option.value = '';
            conversationSelect.appendChild(option);
            return;
        }

        allSelectedConversations.forEach((convo, index) => {
            const option = document.createElement('option');
            // Create descriptive label: "Task - TaskID (Model)"
            const taskDisplay = convo.task ? convo.task.charAt(0).toUpperCase() + convo.task.slice(1) : 'Unknown';
            const taskIdDisplay = convo.task_id || 'Unknown ID';
            const modelDisplay = convo.assistant_model || 'Unknown Model';
            const convTypeDisplay = convo.conv_type || 'unknown';
            
            option.textContent = `${taskDisplay} - ${taskIdDisplay} (${modelDisplay}, ${convTypeDisplay})`;
            option.value = index;
            conversationSelect.appendChild(option);
        });

        // Select first conversation by default
        if (allSelectedConversations.length > 0) {
            conversationSelect.value = 0;
            renderConversation();
        }
    }

    function populateTaskSelect() {
        if (!taskSelect) return;
        
        // Clear existing options except "All Tasks"
        taskSelect.innerHTML = '<option value="all">All Tasks</option>';
        
        // Get unique tasks
        const uniqueTasks = [...new Set(allSelectedConversations.map(convo => convo.task))].sort();
        
        uniqueTasks.forEach(task => {
            if (task) {
                const option = document.createElement('option');
                option.value = task;
                option.textContent = task.charAt(0).toUpperCase() + task.slice(1);
                taskSelect.appendChild(option);
            }
        });
    }

    function populateConvTypeSelect() {
        if (!convTypeSelect) return;
        
        // Clear existing options except "All Types"
        convTypeSelect.innerHTML = '<option value="all">All Types</option>';
        
        // Get unique conversation types
        const uniqueConvTypes = [...new Set(allSelectedConversations.map(convo => convo.conv_type))].sort();
        
        uniqueConvTypes.forEach(convType => {
            if (convType) {
                const option = document.createElement('option');
                option.value = convType;
                option.textContent = convType.charAt(0).toUpperCase() + convType.slice(1);
                convTypeSelect.appendChild(option);
            }
        });
    }

    function updateConversationsFilter() {
        const selectedTask = taskSelect ? taskSelect.value : 'all';
        const selectedConvType = convTypeSelect ? convTypeSelect.value : 'all';
        
        // Filter conversations based on selected task and conv_type
        filteredConversations = allSelectedConversations.filter(convo => {
            const taskMatch = selectedTask === 'all' || convo.task === selectedTask;
            const convTypeMatch = selectedConvType === 'all' || convo.conv_type === selectedConvType;
            return taskMatch && convTypeMatch;
        });
        
        // Update conversation dropdown with filtered results
        populateFilteredConversationDropdown();
    }

    function populateFilteredConversationDropdown() {
        if (!conversationSelect) return;
        conversationSelect.innerHTML = ''; // Clear existing options

        if (filteredConversations.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No conversations found for selected filters';
            option.value = '';
            conversationSelect.appendChild(option);
            conversationContentDiv.innerHTML = '<p>No conversations found for the selected filters.</p>';
            return;
        }

        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.textContent = 'Choose a conversation...';
        defaultOption.value = '';
        conversationSelect.appendChild(defaultOption);

        filteredConversations.forEach((convo, filteredIndex) => {
            const option = document.createElement('option');
            // Create descriptive label: "Task - TaskID (Model, Type)"
            const taskDisplay = convo.task ? convo.task.charAt(0).toUpperCase() + convo.task.slice(1) : 'Unknown';
            const taskIdDisplay = convo.task_id || 'Unknown ID';
            const modelDisplay = convo.assistant_model || 'Unknown Model';
            const convTypeDisplay = convo.conv_type || 'unknown';
            
            option.textContent = `${taskDisplay} - ${taskIdDisplay} (${modelDisplay}, ${convTypeDisplay})`;
            // Store the original index from allSelectedConversations
            const originalIndex = allSelectedConversations.indexOf(convo);
            option.value = originalIndex;
            conversationSelect.appendChild(option);
        });
    }

    async function loadSelectedConversations() {
        if (!conversationSelect) return;
        
        conversationSelect.innerHTML = '<option>Loading...</option>';
        conversationContentDiv.innerHTML = '<p>Loading selected conversations...</p>';

        try {
            const response = await fetch('logs/selected.jsonl');
            if (!response.ok) {
                throw new Error(`Failed to load selected.jsonl (status ${response.status})`);
            }

            const text = await response.text();
            const lines = text.trim().split('\n');
            
            allSelectedConversations = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    console.warn('Skipping invalid JSON line:', line, e);
                    return null;
                }
            }).filter(convo => convo !== null);

            if (allSelectedConversations.length > 0) {
                populateTaskSelect();
                populateConvTypeSelect();
                updateConversationsFilter();
            } else {
                conversationContentDiv.innerHTML = '<p>No valid conversations found in selected.jsonl.</p>';
                conversationSelect.innerHTML = '<option>No conversations found</option>';
            }

        } catch (error) {
            console.error('Failed to load selected conversations:', error);
            conversationContentDiv.innerHTML = `<p style="color: red;">Failed to load selected conversations. Error: ${error.message}</p>`;
            conversationSelect.innerHTML = '<option>Error loading conversations</option>';
        }
    }

    // Event listeners for filter selections
    if (taskSelect) {
        taskSelect.addEventListener('change', updateConversationsFilter);
    }
    
    if (convTypeSelect) {
        convTypeSelect.addEventListener('change', updateConversationsFilter);
    }
    
    // Event listener for conversation selection
    if (conversationSelect) {
        conversationSelect.addEventListener('change', renderConversation);
    }

    // Initial load when the page is ready
    loadSelectedConversations();
}); 