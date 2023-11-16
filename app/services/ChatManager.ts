// ChatManager.ts

import {
  prepareUploadFile,
  initializeAssistant,
  createChatThread,
  runChatAssistant
} from '../modules/assistantModules';

import {
  submitUserMessage,
  fetchAssistantResponse,
  updateChatState
} from '../modules/chatModules';

/**
 * Interface for the state of the chat
 */
interface ChatState {
  assistantId: string | null;
  threadId: string | null;
  messages: any[]; // Adjust the type as per your message structure
  isLoading: boolean;
  error: Error | null;
  runId: string | null; 
  setChatMessages: (messages: any[]) => void;
  assistantResponseReceived: boolean;
  setStatusMessage: (message: string) => void;
}

/**
 * Class to manage the state and operations of the chat
 */
class ChatManager {

  private state: ChatState;
  private static instance: ChatManager | null = null;

  private constructor(setChatMessages: (messages: any[]) => void, setStatusMessage: (message: string) => void) {
    this.state = {
      assistantId: null,
      threadId: null,
      messages: [],
      isLoading: false,
      error: null,
      runId: null,
      setChatMessages: setChatMessages,
      assistantResponseReceived: false,
      setStatusMessage: setStatusMessage,
    };
    console.log('ChatManager initialized');
  }
  
  // Add the getCurrentMessages method here
  public getCurrentMessages(): any[] {
    return this.state.messages;
  }

  public static getInstance(setChatMessages: (messages: any[]) => void, setStatusMessage: (message: string) => void): ChatManager {
    if (this.instance === null) {
      this.instance = new ChatManager(setChatMessages, setStatusMessage);
    }
    return this.instance;
  }

  async startAssistant(assistantDetails: any, file: File | null, initialMessage: string): Promise<void> {
    console.log('Starting assistant...');
    this.state.setStatusMessage('Initializing chat assistant...');
    this.state.isLoading = true;
    try {
      const fileId = file ? await prepareUploadFile(file) : null;
      if (fileId === null) {
        throw new Error('FileId is null');
      }
      this.state.setStatusMessage('Uploading file...');
      const assistantId = await initializeAssistant(assistantDetails, fileId);
      if (assistantId === null) {
        throw new Error('AssistantId is null');
      }
      this.state.setStatusMessage('Creating assistant...');
      this.state.assistantId = assistantId;
      const threadId = await createChatThread(initialMessage);
      if (threadId === null) {
        throw new Error('ThreadId is null');
      }
      this.state.setStatusMessage('Creating thread...');
      this.state.threadId = threadId;
      const runId = await runChatAssistant(this.state.assistantId, this.state.threadId);
      if (runId === null) {
        throw new Error('RunId is null');
      }
      this.state.setStatusMessage('Running assistant...');
      this.state.runId = runId; // Set runId in the state
  
      // Fetch and list messages after running the assistant
      if (this.state.runId && this.state.threadId) {
        const runId = this.state.runId as string;
        const threadId = this.state.threadId as string;
        
        console.log('Fetching assistant response with runId:', runId, 'and threadId:', threadId);
        const assistantResponse = await fetchAssistantResponse(runId, threadId);
        console.log('Fetched message:', assistantResponse);
        
        this.state.assistantResponseReceived = true;
        console.log('Adding message to chat state. Current state:', this.state);
        
        // Create a new message with the assistant's response
        const newMessage = { role: 'assistant', content: assistantResponse };
        
        this.state.messages = [...this.state.messages, newMessage];
        this.state.setChatMessages(this.state.messages);
        
        console.log('Added message to chat state. Updated state:', this.state);
      } else {
        console.error('RunId or ThreadId is null. Current state:', this.state);
      }
  
    } catch (error) {
      this.state.error = error as Error;
      console.error('Error in starting assistant:', error);
    } finally {
      this.state.setStatusMessage('Done');
      this.state.isLoading = false;
    }
  }

  async sendMessage(input: string): Promise<void> {

    console.log('Sending message...');
    this.state.isLoading = true;

    // Create new user message and add it to the state
    const newUserMessage = { role: 'user', content: input };
    this.state.messages = [...this.state.messages, newUserMessage];
    this.state.setChatMessages(this.state.messages);

    try {
      if (this.state.threadId && this.state.assistantId) { 
        
        await submitUserMessage(input, this.state.threadId);
        console.log('User message submitted. Running assistant...');
        
        this.state.runId = await runChatAssistant(this.state.assistantId as string, this.state.threadId as string);
        console.log('Assistant run successfully. Fetching assistant response...');
        
        const response = await fetchAssistantResponse(this.state.runId as string, this.state.threadId as string);
        console.log('Assistant response fetched. Adding to chat state...');
        
        // Create new messages
        const newMessages = [{ role: 'user', content: input }, { role: 'assistant', content: response }];
        
        // directly pushing message to chat 
        // Create new assistant message and add it to the state
        const newAssistantMessage = { role: 'assistant', content: response };
        this.state.messages = [...this.state.messages, newAssistantMessage];
        this.state.setChatMessages(this.state.messages);
        
        //For testing purpose
        //await updateChatState(this.state.messages, newMessages, this.state.setChatMessages);
        
        console.log('Message added to chat state:', this.state.messages);
      } else {
        console.error('ThreadId or AssistantId is null');
      }
    } catch (error) {
      this.state.error = error as Error;
      console.error('Error in sending message:', error);
    } finally {
      this.state.isLoading = false; // Set loading to false when sending ends
    }
  }

  getChatState(): ChatState {
    console.log('Getting chat state');
    return this.state;
  }
}

export default ChatManager;