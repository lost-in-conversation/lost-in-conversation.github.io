document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const displayConvoIdHeader = document.getElementById('display-convo-id'); // For the main header
    const conversationContentDiv = document.getElementById('conversation-content');

    // Sidebar controls
    const taskSelect = document.getElementById('task');
    const conversationTypeSelect = document.getElementById('conversation-type');
    const assistantModelSelect = document.getElementById('assistant-model');
    const conversationIdSelect = document.getElementById('conversation-id-select'); // Dropdown to select a convo from loaded file
    const conversationIdDirectInput = document.getElementById('conversation-id-direct'); // Direct input for an index
    const taskIDSelect = document.getElementById('task-id'); // Dropdown for Task IDs

    let allLoadedConversations = [];
    let currentLogFilePath = ''; // This might represent the "primary" or first successfully loaded path
    let currentSelectedTaskID = null;

    const responseCategoryMapping = {
        "answer_attempt": "Answer attempt",
        "hedge": "Hedge",
        "clarification": "Clarification",
        "interrogation": "Interrogation",
        "discussion": "Discussion",
        "refuse": "Refusal",
        "missing": "Missing"
    }

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

    function getSidebarSelections() {
        const selectedTask = taskSelect?.value || 'math';
        const selectedTaskID = taskIDSelect?.value || null;
        const selectedConvType = conversationTypeSelect?.value || 'concat';
        const selectedAssistantModel = assistantModelSelect?.value || 'gpt-4o';
        const selectedConversationID = parseInt(conversationIdSelect?.value || '0', 10);
        console.log(selectedTask, selectedConvType, selectedAssistantModel, selectedConversationID);
        return { selectedTask, selectedTaskID, selectedConvType, selectedAssistantModel, selectedConversationID };
    }

    function buildLogFilePath(task) {
        return `logs/${task}.jsonl`;
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
        if (!conversationContentDiv) return;
        conversationContentDiv.innerHTML = ''; // Clear previous content

        const { selectedTaskID, selectedConvType, selectedAssistantModel, selectedConversationID } = getSidebarSelections();

        const conversationObject = allLoadedConversations.filter(convo => convo.task_id === selectedTaskID && convo.conv_type === selectedConvType && convo.assistant_model === selectedAssistantModel)[selectedConversationID];
        const conversationTurns = conversationObject.trace;

        if (displayConvoIdHeader) {
            let shortLogPathDisplay = `${selectedTaskID} / ${selectedConvType} / ${selectedAssistantModel}`;
            if (currentLogFilePath) { // If a specific file was identified as primary
                 shortLogPathDisplay = currentLogFilePath.replace('logs/','').replace('.jsonl','').replace(/[/_]/g, ' ');
            }
            displayConvoIdHeader.textContent = `${shortLogPathDisplay} (${conversationDisplayId})`;
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
            let roleLabelText = null; // Variable to hold the label text

            switch (entry.role) {
                case 'user':
                    roleSpecificClass = 'message-user';
                    roleLabelText = 'User'; // Set label for user
                    messageContentDiv.innerHTML = formatMessageContent(entry.content);
                    break;
                case 'assistant':
                    roleSpecificClass = 'message-assistant';
                    roleLabelText = 'Assistant'; // Set label for assistant
                    messageContentDiv.innerHTML = formatMessageContent(entry.content);
                    break;
                case 'log':
                    showContent = false;
                    if (entry.content && entry.content.type === 'answer-evaluation') {
                        evaluationData = entry.content; // Store for later attachment
                    }
                    if (entry.content && entry.content.type === 'system-verification') {
                        answerCategory = entry.content.response.response_type; // Store for later attachment
                    }
                    break;
                default:
                    showContent = false;
            }

            // create a wrapper div for message role + content
            const messageWrapperDiv = document.createElement('div');
            messageWrapperDiv.classList.add( 'message-wrapper', `message-wrapper-${roleSpecificClass.replace('message-', '')}`);
            messageWrapperDiv.appendChild(messageDiv);

            if (showContent) {
                messageDiv.classList.add(roleSpecificClass);
                messageDiv.appendChild(messageContentDiv);

                const metadataContainer = document.createElement('div');
                metadataContainer.classList.add('turn-metadata');

                // Append role label first if applicable, so it appears above the message bubble
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

                messageWrapperDiv.appendChild(messageDiv); // Then append the message bubble itself
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
                if(!targetMetadataContainer) { // Should exist if timestamp was added
                    targetMetadataContainer = document.createElement('div');
                    targetMetadataContainer.classList.add('turn-metadata');

                    const prevMessageBubble = lastTurnDiv.querySelector('.message');
                     // Corrected alignment for evaluation metadata
                    if (prevMessageBubble && prevMessageBubble.classList.contains('message-user')) {
                        // User messages are on the left, their metadata too.
                        targetMetadataContainer.style.alignSelf = 'flex-start';
                        targetMetadataContainer.style.textAlign = 'left';
                    } else if (prevMessageBubble && prevMessageBubble.classList.contains('message-assistant')){
                        // Assistant messages are on the right, their metadata too.
                        targetMetadataContainer.style.alignSelf = 'flex-end';
                        targetMetadataContainer.style.textAlign = 'right';
                    } else {
                        // Default or for system messages (if they ever have direct eval data like this)
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
                answerCategory = null; // Reset after use

            }
            if (evaluationData && conversationContentDiv.lastChild) {
                const lastTurnDiv = conversationContentDiv.lastChild;
                let targetMetadataContainer = lastTurnDiv.querySelector('.turn-metadata');
                if(!targetMetadataContainer) { // Should exist if timestamp was added
                    targetMetadataContainer = document.createElement('div');
                    targetMetadataContainer.classList.add('turn-metadata');

                    const prevMessageBubble = lastTurnDiv.querySelector('.message');
                     // Corrected alignment for evaluation metadata
                    if (prevMessageBubble && prevMessageBubble.classList.contains('message-user')) {
                        // User messages are on the left, their metadata too.
                        targetMetadataContainer.style.alignSelf = 'flex-start';
                        targetMetadataContainer.style.textAlign = 'left';
                    } else if (prevMessageBubble && prevMessageBubble.classList.contains('message-assistant')){
                        // Assistant messages are on the right, their metadata too.
                        targetMetadataContainer.style.alignSelf = 'flex-end';
                        targetMetadataContainer.style.textAlign = 'right';
                    } else {
                        // Default or for system messages (if they ever have direct eval data like this)
                        targetMetadataContainer.style.alignSelf = 'flex-start';
                        targetMetadataContainer.style.textAlign = 'left';
                    }
                    lastTurnDiv.appendChild(targetMetadataContainer);
                }

                const evalDiv = document.createElement('div');
                evalDiv.classList.add('evaluation-status');
                const isCorrect = evaluationData.score === 1.0;
                evalDiv.innerHTML = `Answer evaluation: <span class="${isCorrect ? 'correct' : 'incorrect'}">${isCorrect ? '✔' : '✗'} ${isCorrect ? 'Correct' : 'Incorrect'}</span>`;

                const evalWrapperDiv = document.createElement('div');
                evalWrapperDiv.appendChild(evalDiv);
                targetMetadataContainer.appendChild(evalWrapperDiv);
                evaluationData = null; // Reset after use
            }
        });
    }

    function populateTaskIDDropdown() {
        if (!taskIDSelect) return;
        taskIDSelect.innerHTML = ''; // Clear existing options

        const taskIDs = [...new Set(allLoadedConversations.map(convo => convo.task_id).filter(id => id))];

        if (taskIDs.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No Task IDs found';
            option.value = '';
            taskIDSelect.appendChild(option);
            populateConversationIdDropdownForTask(null); // Clear convo dropdown
            return;
        }

        taskIDs.sort().forEach(taskID => {
            const option = document.createElement('option');
            option.textContent = taskID;
            option.value = taskID;
            taskIDSelect.appendChild(option);
        });
        if (taskIDs.length > 0) {
            currentSelectedTaskID = taskIDs[0];
            taskIDSelect.value = currentSelectedTaskID;
            populateConversationIdDropdownForTask(currentSelectedTaskID);
        } else {
            populateConversationIdDropdownForTask(null);
        }
    }

    function populateConversationIdDropdownForTask(selectedTaskID) {
        if (!conversationIdSelect) return;
        conversationIdSelect.innerHTML = ''; // Clear existing options
        currentSelectedTaskID = selectedTaskID; // Update current task ID

        // Get current selections to maintain state
        const { selectedConvType, selectedAssistantModel } = getSidebarSelections();


        const conversationsForTask = selectedTaskID
            ? allLoadedConversations.filter(convo => convo.task_id === selectedTaskID && convo.conv_type === selectedConvType.toLowerCase() && convo.assistant_model === selectedAssistantModel.toLowerCase())
            : [];

        conversationsForTask.forEach(convo => {
            const option = document.createElement('option');
            let convoName = `Sample ${conversationsForTask.indexOf(convo) + 1}`; // Fallback using local index
            option.textContent = convoName;
            option.value = conversationsForTask.indexOf(convo); // Still store global index for reference
            conversationIdSelect.appendChild(option);
        });

        if (conversationsForTask.length > 0) {
            conversationIdSelect.value = 0;
            renderConversation();
        } else {
             conversationContentDiv.innerHTML = '<p>No conversations found for this selection.</p>';
             if (displayConvoIdHeader) displayConvoIdHeader.textContent = 'No conversations';
        }
    }

    async function loadLogFile() {
        const { selectedTask } = getSidebarSelections();

        allLoadedConversations = []; // Clear previous conversations
        currentLogFilePath = ''; // Reset primary log file path for display

        if (displayConvoIdHeader) {
            displayConvoIdHeader.textContent = `Loading for ${selectedTask}...`;
        }
        conversationContentDiv.innerHTML = `<p>Loading conversations for ${selectedTask}...</p>`;
        taskIDSelect.innerHTML = '<option>Loading tasks...</option>';
        conversationIdSelect.innerHTML = '<option>Loading conversations...</option>';

        const logFilePath = buildLogFilePath(selectedTask);
        currentLogFilePath = logFilePath;

        try {
            console.log(`Loading: ${logFilePath}`);

            const response = await fetch(logFilePath);
            if (!response.ok) {
                console.warn(`HTTP error! status: ${response.status} for ${logFilePath}`);
                throw new Error(`Failed to load ${logFilePath} (status ${response.status})`);
            }

            const text = await response.text();
            const lines = text.trim().split('\n');
            const conversationsFromFile = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    console.warn(`Skipping invalid JSON line in ${logFilePath}:`, line, e);
                    return null; // Skip this line
                }
            });

            allLoadedConversations = conversationsFromFile;

            if (allLoadedConversations.length > 0) {
                populateTaskIDDropdown(); // This will populate task IDs, then convo IDs, then render.
            } else {
                conversationContentDiv.innerHTML = '<p>No conversations found for the selected model.</p>';
                populateTaskIDDropdown(); // This will show "No Task IDs" etc.
                if (displayConvoIdHeader) displayConvoIdHeader.textContent = 'No conversations found';
            }

        } catch (error) {
            console.error(`Failed to load or parse log file ${logFilePath}:`, error);
            conversationContentDiv.innerHTML = `<p style="color: red;">Failed to load conversation data. Ensure file exists and is valid JSONL. Check console for details.</p><p style="color: red;">Error: ${error.message}</p>`;
            populateTaskIDDropdown(); // This will show "No Task IDs"
            if (displayConvoIdHeader) displayConvoIdHeader.textContent = 'Error loading file';
            return; // Stop further processing
        }
    }

    // Event Listeners for sidebar controls that trigger file loading
    [taskSelect].forEach(select => {
        if (select) {
            select.addEventListener('change', loadLogFile);
        }
    });

    if (conversationTypeSelect) {
        conversationTypeSelect.addEventListener('change', renderConversation);
    }

    if (assistantModelSelect) {
        assistantModelSelect.addEventListener('change', renderConversation);
    }

    // Event listener for Task ID selection
    if (taskIDSelect) {
        taskIDSelect.addEventListener('change', renderConversation);
    }

    // Event Listener for selecting a specific conversation from the loaded file
    if (conversationIdSelect) {
        conversationIdSelect.addEventListener('change', renderConversation);
    }

    // Initial load when the page is ready
    loadLogFile();
});