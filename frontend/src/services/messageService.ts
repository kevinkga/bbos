// Message service to handle Antd message calls safely
// This prevents context warnings when message API is used outside of provider

interface MessageInstance {
  success: (content: string) => void;
  error: (content: string) => void;
  warning: (content: string) => void;
  info: (content: string) => void;
}

class MessageService {
  private messageInstance: MessageInstance | null = null;

  setMessageInstance(instance: MessageInstance) {
    this.messageInstance = instance;
  }

  success(content: string) {
    if (this.messageInstance) {
      this.messageInstance.success(content);
    } else {
      console.log(`✅ Success: ${content}`);
    }
  }

  error(content: string) {
    if (this.messageInstance) {
      this.messageInstance.error(content);
    } else {
      console.error(`❌ Error: ${content}`);
    }
  }

  warning(content: string) {
    if (this.messageInstance) {
      this.messageInstance.warning(content);
    } else {
      console.warn(`⚠️ Warning: ${content}`);
    }
  }

  info(content: string) {
    if (this.messageInstance) {
      this.messageInstance.info(content);
    } else {
      console.info(`ℹ️ Info: ${content}`);
    }
  }
}

export const messageService = new MessageService();
export default messageService; 